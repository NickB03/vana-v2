# Streaming Architecture

This document provides a detailed technical reference for the streaming infrastructure in Vana v2. It covers how Server-Sent Events (SSE) deliver real-time AI responses to the client, the two stream paths (authenticated and ephemeral), message preparation, smooth streaming, parallel operations, error handling, and the SSE protocol.

## Table of Contents

- [Overview](#overview)
- [Stream Types](#stream-types)
- [Stream Lifecycle](#stream-lifecycle)
- [Mermaid Diagram](#mermaid-diagram)
- [Message Preparation](#message-preparation)
- [Smooth Streaming](#smooth-streaming)
- [Parallel Operations](#parallel-operations)
- [Error Handling](#error-handling)
- [SSE Protocol](#sse-protocol)

---

## Overview

Vana v2 uses **Server-Sent Events (SSE)** to stream AI responses from the server to the client in real time. Rather than waiting for the entire research agent to finish before returning a response, the system streams partial results incrementally: tool calls appear as they execute, text tokens arrive word-by-word, and related questions stream in after the main answer completes.

This architecture enables:

- **Progressive rendering**: The UI updates as data arrives. Search results, citations, and answer text appear incrementally rather than all at once.
- **Perceived low latency**: `smoothStream` buffers tokens and emits them word-by-word, creating a natural typing effect even when the LLM produces tokens in bursts.
- **Non-blocking side effects**: Title generation, related question generation, and database persistence all run concurrently with or after the main stream, never blocking the user-facing response.
- **Graceful degradation**: If the user navigates away or the connection drops, the `AbortSignal` propagates through the entire pipeline, canceling LLM calls and tool executions.

The streaming infrastructure lives in `lib/streaming/` and is built on top of the [Vercel AI SDK](https://sdk.vercel.ai/docs)'s `createUIMessageStream` and `createUIMessageStreamResponse` primitives.

---

## Stream Types

Two stream creation functions handle the two authentication contexts:

### Authenticated Streams (`create-chat-stream-response.ts`)

Used when a logged-in user sends a message. This is the full-featured path with database persistence, chat ownership verification, and title generation.

**Source:** `lib/streaming/create-chat-stream-response.ts`

Key characteristics:

- Requires `chatId` and `userId`
- Loads existing chat for authorization (skipped for new chats via `isNewChat` optimization)
- Persists user messages and AI responses to the database via `persistStreamResults`
- Generates chat titles in parallel for new conversations
- Creates Langfuse traces for observability when tracing is enabled
- Handles both `submit-message` and `regenerate-message` triggers

### Ephemeral Streams (`create-ephemeral-chat-stream-response.ts`)

Used for guest/anonymous users when `ENABLE_GUEST_CHAT=true`. This path has no database persistence and reduced configuration.

**Source:** `lib/streaming/create-ephemeral-chat-stream-response.ts`

Key characteristics:

- Accepts full `messages` array from the client (since there is no server-side history)
- No database reads or writes
- No title generation
- No `onFinish` callback (nothing to persist)
- Still supports related question generation and smooth streaming
- Rate-limited by IP via Upstash Redis (enforced in the API route)

### Comparison Table

| Feature                   | Authenticated                     | Ephemeral                      |
| ------------------------- | --------------------------------- | ------------------------------ |
| Database persistence      | Yes (chat, messages, parts)       | No                             |
| Chat ownership check      | Yes (403 if mismatch)             | No                             |
| Title generation          | Yes (parallel, new chats only)    | No                             |
| Related questions         | Yes                               | Yes                            |
| Smooth streaming          | Yes (`word` chunking)             | Yes (`word` chunking)          |
| Langfuse tracing          | Yes (when enabled)                | Yes (when enabled)             |
| Message source            | Server-side history + new message | Full message array from client |
| `onFinish` callback       | `persistStreamResults`            | None                           |
| Rate limiting             | Overall chat limit per user       | IP-based guest limit           |
| OpenAI reasoning strip    | Yes                               | Yes                            |
| Context window management | Yes                               | Yes                            |

---

## Stream Lifecycle

Here is the step-by-step flow of a single chat request from the moment the client sends a message to when the stream closes.

### 1. Client Sends Message

The React `Chat` component (`components/chat.tsx`) uses the AI SDK's `useChat` hook with a `DefaultChatTransport` configured to POST to `/api/chat`. The transport's `prepareSendMessagesRequest` attaches `chatId`, `trigger`, `messageId`, `isNewChat`, and (for guests) the full messages array.

### 2. API Route Receives Request

`app/api/chat/route.ts` (POST handler, `maxDuration = 300` seconds):

1. Parses the request body
2. Validates trigger-specific fields (`message` for submit, `messageId` for regenerate)
3. Checks if the request originates from a share page (blocked with 403)
4. Authenticates the user via `getCurrentUserId()`
5. Determines guest status and enforces rate limits (`checkAndEnforceGuestLimit` or `checkAndEnforceOverallChatLimit`)

### 3. Model Selection

The route reads `searchMode` and `modelType` from cookies, then calls `selectModel()` to resolve the appropriate model configuration. Guest users and cloud deployments are forced to `speed` model type. The selected model is validated against the provider registry.

### 4. Stream Path Dispatch

Based on authentication status, the route delegates to one of:

- `createChatStreamResponse(config)` for authenticated users
- `createEphemeralChatStreamResponse(config)` for guests

### 5. Authorization and Chat Loading (Authenticated Only)

For existing chats, `loadChat(chatId, userId)` fetches the chat record and verifies ownership. New chats skip this step entirely (the `isNewChat` optimization avoids an unnecessary database round-trip).

### 6. Stream Creation with `createUIMessageStream`

The Vercel AI SDK's `createUIMessageStream` is called with an `execute` callback, an `onError` handler, and (for authenticated streams) an `onFinish` handler. The `execute` callback receives a `writer` (a `UIMessageStreamWriter`) that can emit events to the client.

### 7. Message Preparation

Inside `execute`, `prepareMessages(context, message)` resolves the full conversation history. See [Message Preparation](#message-preparation) for details. The resulting `UIMessage[]` is then:

1. Stripped of reasoning parts (for OpenAI models, to avoid Responses API compatibility issues)
2. Converted to `ModelMessage[]` via `convertToModelMessages`
3. Pruned with `pruneMessages` (removes old reasoning, tool calls, and empty messages)
4. Truncated if the total token count exceeds the model's context window

### 8. Title Generation (Parallel, New Chats Only)

If this is a new chat, `generateChatTitle()` fires immediately and runs concurrently with the main agent stream. It uses the same model to generate a 3-5 word title from the user's first message. The returned promise is stored in `titlePromise` and awaited later in `onFinish`.

### 9. Research Agent Streaming

The `researcher()` factory (`lib/agents/researcher.ts`) creates a `ToolLoopAgent` configured with:

- The selected model
- A system prompt based on search mode (quick or adaptive)
- Active tools (search, fetch, display tools, and optionally todoWrite)
- A step limit (20 for quick mode, 50 for adaptive mode)
- Telemetry configuration for Langfuse

The agent is invoked with:

```typescript
const result = await researchAgent.stream({
  messages: modelMessages,
  abortSignal,
  experimental_transform: smoothStream({ chunking: 'word' })
})
```

The `smoothStream` transform buffers output tokens and re-emits them word-by-word. The agent's output stream is then merged into the main writer:

```typescript
result.consumeStream()
writer.merge(
  result.toUIMessageStream({
    messageMetadata: ({ part }) => {
      if (part.type === 'start') {
        return { traceId: parentTraceId, searchMode, modelId }
      }
    }
  })
)
```

The `messageMetadata` callback attaches trace context to the stream's `start` event so the client knows which model and search mode produced the response.

### 10. Tool Loop Execution

During streaming, the `ToolLoopAgent` may invoke tools multiple times. Each tool call and result is streamed to the client in real time. The agent continues calling tools until:

- It produces a final text response without a tool call
- It reaches the step limit (`stepCountIs(maxSteps)`)
- The `AbortSignal` fires

### 11. Related Questions Generation

After the agent stream completes, if there are response messages, `streamRelatedQuestions()` is called. This:

1. Writes a `data-relatedQuestions` event with `status: 'loading'`
2. Calls `createRelatedQuestionsStream()` which uses `streamText` with structured output to generate follow-up questions
3. Streams each question as it arrives with `status: 'streaming'`
4. Writes a final event with `status: 'success'` and all questions

### 12. Stream Finalization (`onFinish`)

For authenticated streams, when the stream closes normally (not aborted), the `onFinish` callback calls `persistStreamResults()` which:

1. Attaches metadata (traceId, searchMode, modelId) to the response message
2. Awaits the `titlePromise` if it was started
3. Awaits any pending initial chat/message persistence (for new chats)
4. Saves the AI response message to the database with retry logic
5. Updates the chat title if one was generated

### 13. Response Return

`createUIMessageStreamResponse({ stream, consumeSseStream: consumeStream })` wraps the stream in a standard `Response` with SSE headers. Back in the API route, cache tags are revalidated and analytics are tracked (non-blocking).

---

## Mermaid Diagram

```mermaid
sequenceDiagram
    participant Client as React Client<br/>(useChat hook)
    participant Route as POST /api/chat
    participant Auth as Auth + Rate Limit
    participant ModelSel as Model Selection
    participant Stream as createUIMessageStream
    participant Prepare as prepareMessages
    participant DB as Database<br/>(Drizzle + Supabase)
    participant Agent as ToolLoopAgent
    participant Smooth as smoothStream
    participant LLM as LLM Provider
    participant Tools as Tools<br/>(search, fetch, display)
    participant Title as Title Generator
    participant Related as Related Questions
    participant Persist as persistStreamResults

    Client->>Route: POST /api/chat {message, chatId, trigger}
    Route->>Auth: getCurrentUserId()
    Auth-->>Route: userId | null

    alt Guest user
        Route->>Auth: checkAndEnforceGuestLimit(ip)
    else Authenticated user
        Route->>Auth: checkAndEnforceOverallChatLimit(userId)
    end

    Route->>ModelSel: selectModel({cookieStore, searchMode})
    ModelSel-->>Route: Model config

    alt Authenticated
        Route->>Stream: createChatStreamResponse(config)
    else Guest
        Route->>Stream: createEphemeralChatStreamResponse(config)
    end

    Note over Stream: execute callback begins

    Stream->>Prepare: prepareMessages(context, message)

    alt New chat (submit-message)
        Prepare->>DB: createChatWithFirstMessage() [async, non-blocking]
        Prepare-->>Stream: [userMessage]
    else Existing chat (submit-message)
        Prepare->>DB: upsertMessage()
        Prepare-->>Stream: [...history, userMessage]
    else Regenerate
        Prepare->>DB: deleteMessagesFromIndex()
        Prepare-->>Stream: messages up to regeneration point
    end

    Note over Stream: Convert UIMessage -> ModelMessage
    Stream->>Stream: stripReasoningParts (OpenAI only)
    Stream->>Stream: convertToModelMessages
    Stream->>Stream: pruneMessages (reasoning, toolCalls, empty)
    Stream->>Stream: truncateMessages (if over context window)

    opt New chat
        Stream->>Title: generateChatTitle() [parallel, non-blocking]
    end

    Stream->>Agent: researcher({model, writer, searchMode})
    Agent->>LLM: stream({messages, abortSignal, smoothStream})

    loop Tool Loop (max 20 or 50 steps)
        LLM-->>Agent: tool_call (e.g., search)
        Agent->>Tools: execute tool
        Tools-->>Agent: tool result (streaming)
        Agent-->>Smooth: tool result chunks
        Smooth-->>Client: SSE: tool-call + tool-result events
        Agent->>LLM: continue with tool results
    end

    LLM-->>Agent: final text response
    Agent-->>Smooth: text tokens
    Smooth-->>Client: SSE: text-delta events (word-by-word)

    Note over Stream: Agent stream complete

    Stream->>Related: streamRelatedQuestions(writer, messages)
    Related-->>Client: SSE: data-relatedQuestions {status: loading}
    Related->>LLM: streamText (structured output)
    loop Each question
        LLM-->>Related: question object
        Related-->>Client: SSE: data-relatedQuestions {status: streaming}
    end
    Related-->>Client: SSE: data-relatedQuestions {status: success}

    Note over Stream: execute callback ends

    opt Authenticated stream
        Stream->>Persist: onFinish(responseMessage)
        Persist->>Persist: await titlePromise
        Persist->>DB: upsertMessage (AI response)
        Persist->>DB: updateChatTitle (if generated)
    end

    Stream-->>Client: SSE: stream close

    Note over Client: useChat updates messages state
    Client->>Client: onFinish -> dispatch 'chat-history-updated'
```

---

## Message Preparation

The `prepareMessages` function (`lib/streaming/helpers/prepare-messages.ts`) resolves the conversation history that will be sent to the LLM. Its behavior depends on the trigger type and whether this is a new or existing chat.

### Submit Message (New Chat)

For new chats (`isNewChat === true`), the function takes an optimistic approach:

1. Assigns an ID to the message if it does not have one
2. Fires `createChatWithFirstMessage()` as a background promise (stored on `context.pendingInitialSave`)
3. Returns `[userMessage]` immediately without waiting for the database write

This optimization means the LLM begins processing before the chat is even persisted, reducing time-to-first-token.

### Submit Message (Existing Chat)

For existing chats:

1. If the chat does not exist in the database yet, creates it with `createChat()`
2. Persists the new user message with `upsertMessage()`
3. Returns the cached `initialChat.messages` with the new message appended (avoiding an extra database read)
4. Falls back to `loadChat()` only if no cached chat data is available

### Regenerate Message

When the user regenerates a response:

1. Loads the chat (uses cached `initialChat` if available)
2. Finds the target message by ID (with a fallback to the last assistant/user message)
3. If the target is an assistant message: deletes it and all subsequent messages, returns the remaining history
4. If the target is a user message (edit + regenerate): updates the message content, deletes everything after it, returns the updated history

### Post-Preparation Processing

After `prepareMessages` returns, the message array goes through several transformations:

1. **Reasoning part stripping** (`stripReasoningParts`): For OpenAI models only. Removes `reasoning` parts from assistant messages to avoid compatibility issues with OpenAI's Responses API, which requires reasoning items to be paired with their following items.

2. **Model message conversion** (`convertToModelMessages`): Transforms `UIMessage[]` (the SDK's UI-facing format with `parts`) into `ModelMessage[]` (the format expected by LLM providers with `content`).

3. **Message pruning** (`pruneMessages`): Removes stale data to reduce token usage:
   - Reasoning: removed from all messages except the last
   - Tool calls: removed from all messages except the last 2
   - Empty messages: removed entirely

4. **Context window truncation** (`truncateMessages`): If the total token count exceeds the model's context window (minus output tokens and a 10% safety buffer), older messages are dropped while preserving the first user message and as many recent messages as possible. Token counting uses `js-tiktoken` with `cl100k_base` encoding.

---

## Smooth Streaming

The `smoothStream` transform from the Vercel AI SDK controls how tokens are delivered to the client. It is configured with `{ chunking: 'word' }` in both authenticated and ephemeral streams:

```typescript
experimental_transform: smoothStream({ chunking: 'word' })
```

### What It Does

Without `smoothStream`, the LLM's output arrives in irregular bursts. Some providers send large chunks of text at once, while others trickle tokens one by one. This creates a "jumpy" appearance in the UI.

`smoothStream` buffers incoming tokens and re-emits them at a consistent rate:

- **Word chunking**: Tokens are buffered until a complete word boundary is detected (typically a space or punctuation), then the entire word is emitted. This produces a natural "typing" effect without the jitter of character-by-character streaming.

### Effect on Perceived Latency

- **Time-to-first-token** is slightly increased (tokens are held until a word boundary), but the difference is imperceptible (usually < 100ms).
- **Perceived streaming speed** is significantly improved because the output flows at a steady, readable pace rather than arriving in unpredictable bursts.
- The transform only affects text output; tool call results and metadata events pass through immediately.

---

## Parallel Operations

Several operations run concurrently with the main stream to minimize total response time. None of these block the SSE output to the client.

### Title Generation

**When:** New authenticated chats only (first message in a conversation).

**How:** `generateChatTitle()` is called immediately before the agent stream starts. It runs a lightweight `generateText` call with a system prompt requesting a 3-5 word title. The returned promise (`titlePromise`) is awaited later in `onFinish`, so title generation overlaps with the entire agent execution.

**Fallback:** If title generation fails or is aborted, the first 75 characters of the user's message are used as the title. If even that is empty, `'New Chat'` is used.

### Related Questions Generation

**When:** After the agent stream completes, if there are response messages.

**How:** `streamRelatedQuestions()` uses `streamText` with structured output (`Output.array`) to generate 3 follow-up questions. Each question streams to the client as it is generated, giving the user immediate follow-up options.

**Lifecycle events sent to client:**

1. `{ status: 'loading' }` -- spinner shown
2. `{ status: 'streaming', questions: [...] }` -- questions appear one by one
3. `{ status: 'success', questions: [...] }` -- final state

### Database Persistence

**When:** Authenticated streams only, in the `onFinish` callback (after the stream closes).

**How:** `persistStreamResults()` runs after the response has been fully streamed:

1. Awaits the title promise
2. Awaits any pending initial chat save (for new chats that used the optimistic path)
3. Saves the AI response message with `upsertMessage()` (with retry logic via `retryDatabaseOperation`)
4. Updates the chat title if one was generated

**Resilience:** Database operations use retry logic. If the initial chat creation fails, a fallback re-attempts the operation. Duplicate key errors (from race conditions) are caught and treated as success. Title update failures are logged but do not throw, since title updates are non-critical.

### Analytics Tracking

**When:** After the stream response is created but before it is returned.

**How:** An immediately-invoked async function fires analytics tracking (`trackChatEvent`) without awaiting the result. Failures are caught and logged silently.

---

## Error Handling

### Stream Execution Errors

Errors thrown inside the `execute` callback are caught and passed to the `onError` handler:

```typescript
onError: (error: unknown) => {
  return error instanceof Error ? error.message : String(error)
}
```

The error message is sent to the client as part of the SSE stream, where the `useChat` hook's `onError` callback handles it.

### Timeout Handling

The API route sets `maxDuration = 300` (5 minutes). This is the maximum execution time for the serverless function. If the stream exceeds this limit, the connection is terminated by the runtime. The `AbortSignal` from the request (`req.signal`) is passed through the entire pipeline:

- To the agent's `stream()` call
- To title generation
- To related questions generation

When the signal fires, all in-flight LLM calls and tool executions are canceled.

### Client Disconnection

When the client navigates away or closes the tab, the browser terminates the SSE connection. This triggers the `AbortSignal`, which cascades through:

1. `req.signal` in the API route
2. `abortSignal` in the stream config
3. The agent's streaming call
4. Tool executions (search, fetch)
5. Title and related question generation

The `onFinish` callback checks `isAborted` and skips persistence if the stream was aborted:

```typescript
onFinish: async ({ responseMessage, isAborted }) => {
  if (isAborted || !responseMessage) return
  // ... persist
}
```

### Database Persistence Errors

The persistence layer (`persistStreamResults`) is designed to never break the stream:

- Message saves use retry logic (`retryDatabaseOperation`)
- Initial chat creation has a fallback path that handles duplicate key errors
- Title update failures are logged but do not throw
- All persistence happens in `onFinish` (after the stream has already been sent to the client)

### Client-Side Error Handling

The `useChat` hook's `onError` callback in `components/chat.tsx` classifies errors:

| Error Type           | Detection                                                    | UI Response                         |
| -------------------- | ------------------------------------------------------------ | ----------------------------------- |
| Rate limit (429)     | Message contains `429`, `rate limit`, or `too many requests` | Error modal with rate limit message |
| Authentication (401) | Message contains `401` or `unauthorized`                     | Error modal with auth prompt        |
| Forbidden (403)      | Message contains `403` or `forbidden`                        | Error modal                         |
| General errors       | Everything else                                              | Toast notification                  |

---

## SSE Protocol

### Response Headers

`createUIMessageStreamResponse` returns a `Response` with standard SSE headers:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### Event Format

The Vercel AI SDK's UI message stream protocol sends events in SSE format. Each event is a JSON-encoded object with a `type` field. Key event types include:

| Event Type                  | Description                        | Payload                                      |
| --------------------------- | ---------------------------------- | -------------------------------------------- |
| `start`                     | Stream begins                      | Metadata: `{ traceId, searchMode, modelId }` |
| `text-delta`                | Incremental text chunk             | `{ textDelta: "word " }`                     |
| `tool-call`                 | Agent invokes a tool               | `{ toolCallId, toolName, args }`             |
| `tool-result`               | Tool execution result              | `{ toolCallId, result }`                     |
| `tool-call-streaming-start` | Tool call begins streaming         | `{ toolCallId, toolName }`                   |
| `tool-call-delta`           | Streaming tool call argument chunk | `{ toolCallId, argsTextDelta }`              |
| `data-relatedQuestions`     | Related questions update           | `{ id, status, questions? }`                 |
| `finish`                    | Stream complete                    | Final message metadata                       |
| `error`                     | Error occurred                     | Error message string                         |

### How the Client Consumes the Stream

The React client uses the AI SDK's `useChat` hook (`@ai-sdk/react`) which:

1. Opens an SSE connection to `/api/chat` via `DefaultChatTransport`
2. Parses incoming events and updates the `messages` state reactively
3. Throttles UI updates to every 100ms (`experimental_throttle: 100`) to avoid excessive re-renders during fast streaming
4. Exposes `status` (which can be `'streaming'`, `'awaiting'`, `'ready'`, or `'error'`) for the UI to show loading indicators
5. Fires `onFinish` when the stream completes, dispatching a `chat-history-updated` custom event to refresh the sidebar

The `messages` array is structured as `UIMessage[]` where each message has `parts` (text, tool calls, tool results, reasoning, etc.) that map to the generative UI component tree.

---

## Key Files

| File                                                     | Purpose                                              |
| -------------------------------------------------------- | ---------------------------------------------------- |
| `app/api/chat/route.ts`                                  | API endpoint; auth, model selection, stream dispatch |
| `lib/streaming/create-chat-stream-response.ts`           | Authenticated stream creation                        |
| `lib/streaming/create-ephemeral-chat-stream-response.ts` | Guest/ephemeral stream creation                      |
| `lib/streaming/helpers/prepare-messages.ts`              | Message history resolution                           |
| `lib/streaming/helpers/persist-stream-results.ts`        | Post-stream database persistence                     |
| `lib/streaming/helpers/stream-related-questions.ts`      | Related questions streaming                          |
| `lib/streaming/helpers/strip-reasoning-parts.ts`         | OpenAI reasoning compatibility                       |
| `lib/streaming/helpers/types.ts`                         | `StreamContext` interface                            |
| `lib/streaming/types.ts`                                 | `BaseStreamConfig` interface                         |
| `lib/agents/researcher.ts`                               | `ToolLoopAgent` factory                              |
| `lib/agents/title-generator.ts`                          | Parallel title generation                            |
| `lib/agents/generate-related-questions.ts`               | Related questions LLM call                           |
| `lib/utils/context-window.ts`                            | Token counting and message truncation                |
| `components/chat.tsx`                                    | Client-side `useChat` hook and stream consumption    |
