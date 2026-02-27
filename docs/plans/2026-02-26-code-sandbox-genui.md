# Code Sandbox Generative UI Tool — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `runCode` tool to the research agent that executes JavaScript/TypeScript code in a sandboxed environment and renders an interactive code + output component inline in chat.

**Architecture:** New AI SDK `tool()` with a generator execute function (yields loading → complete states). Server-side execution via isolated-vm or a lightweight eval sandbox. A `CodeSandboxSection` component renders in the tool-section switch, showing syntax-highlighted code + output panel. Follows the exact same pattern as search/fetch/todo tools.

**Tech Stack:** Vercel AI SDK `tool()`, Zod schemas, React, Tailwind, existing CollapsibleMessage + ProcessHeader components, shiki (syntax highlighting — already in dev deps via streamdown)

---

## Sandbox Strategy

We use a **server-side sandbox** rather than client-side (WebContainers) for two reasons:

1. WebContainers require SharedArrayBuffer (COOP/COEP headers) which break Supabase Auth
2. Server-side execution keeps the tool pattern consistent — tool executes on server, returns data, component renders it

For the initial implementation, we use Node.js `vm` module with a timeout. This is sufficient for a personal project. The tool executes JavaScript only, with a 5-second timeout, no filesystem/network access.

**Future upgrade path:** swap `vm` for `isolated-vm` or a Docker container for stronger isolation.

---

## Task 1: Define the runCode Tool

**Files:**

- Create: `lib/tools/code.ts`
- Test: `lib/tools/__tests__/code.test.ts`

**Step 1: Write the failing test**

Create: `lib/tools/__tests__/code.test.ts`

```typescript
import { describe, expect, it } from 'vitest'

import { codeExecutionTool } from '../code'

describe('codeExecutionTool', () => {
  it('has the correct description and schema', () => {
    expect(codeExecutionTool.description).toContain('Execute')
    expect(codeExecutionTool.inputSchema).toBeDefined()
  })

  it('executes simple JavaScript and returns output', async () => {
    const result = codeExecutionTool.execute!(
      {
        code: 'const x = 2 + 2; x',
        language: 'javascript'
      },
      { toolCallId: 'test-1', messages: [] }
    )

    const chunks: any[] = []
    for await (const chunk of result as AsyncIterable<any>) {
      chunks.push(chunk)
    }

    const final = chunks[chunks.length - 1]
    expect(final.state).toBe('complete')
    expect(final.output).toContain('4')
    expect(final.error).toBeUndefined()
  })

  it('captures console.log output', async () => {
    const result = codeExecutionTool.execute!(
      {
        code: 'console.log("hello"); console.log("world")',
        language: 'javascript'
      },
      { toolCallId: 'test-2', messages: [] }
    )

    const chunks: any[] = []
    for await (const chunk of result as AsyncIterable<any>) {
      chunks.push(chunk)
    }

    const final = chunks[chunks.length - 1]
    expect(final.state).toBe('complete')
    expect(final.logs).toContain('hello')
    expect(final.logs).toContain('world')
  })

  it('returns error for invalid code', async () => {
    const result = codeExecutionTool.execute!(
      {
        code: 'throw new Error("boom")',
        language: 'javascript'
      },
      { toolCallId: 'test-3', messages: [] }
    )

    const chunks: any[] = []
    for await (const chunk of result as AsyncIterable<any>) {
      chunks.push(chunk)
    }

    const final = chunks[chunks.length - 1]
    expect(final.state).toBe('complete')
    expect(final.error).toContain('boom')
  })

  it('times out on infinite loops', async () => {
    const result = codeExecutionTool.execute!(
      {
        code: 'while(true) {}',
        language: 'javascript'
      },
      { toolCallId: 'test-4', messages: [] }
    )

    const chunks: any[] = []
    for await (const chunk of result as AsyncIterable<any>) {
      chunks.push(chunk)
    }

    const final = chunks[chunks.length - 1]
    expect(final.state).toBe('complete')
    expect(final.error).toBeDefined()
    expect(final.error).toMatch(/timed?\s*out|execution time/i)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun run test -- lib/tools/__tests__/code.test.ts
```

Expected: FAIL — cannot find `../code`

**Step 3: Write the implementation**

Create: `lib/tools/code.ts`

```typescript
import vm from 'node:vm'

import { tool } from 'ai'
import { z } from 'zod'

const TIMEOUT_MS = 5000

export const codeExecutionTool = tool({
  description:
    'Execute JavaScript code and return the output. Use this to run calculations, data transformations, string processing, algorithm demonstrations, or any computation the user needs. Always show your work by writing code rather than computing mentally.',
  inputSchema: z.object({
    code: z.string().describe('The JavaScript code to execute'),
    language: z
      .enum(['javascript'])
      .default('javascript')
      .describe('Programming language (currently JavaScript only)')
  }),
  async *execute({ code, language }) {
    yield {
      state: 'running' as const,
      code,
      language
    }

    const logs: string[] = []
    let output: string | undefined
    let error: string | undefined
    const startTime = Date.now()

    try {
      // Create a sandbox with captured console
      const sandbox = {
        console: {
          log: (...args: any[]) =>
            logs.push(args.map(a => stringify(a)).join(' ')),
          error: (...args: any[]) =>
            logs.push(`[error] ${args.map(a => stringify(a)).join(' ')}`),
          warn: (...args: any[]) =>
            logs.push(`[warn] ${args.map(a => stringify(a)).join(' ')}`)
        },
        JSON,
        Math,
        Date,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Map,
        Set,
        Promise,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        encodeURIComponent,
        decodeURIComponent,
        setTimeout: undefined,
        setInterval: undefined,
        fetch: undefined,
        require: undefined,
        process: undefined
      }

      const context = vm.createContext(sandbox)
      const script = new vm.Script(code, { timeout: TIMEOUT_MS })
      const result = script.runInContext(context, { timeout: TIMEOUT_MS })

      if (result !== undefined) {
        output = stringify(result)
      }
    } catch (err: any) {
      if (
        err?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' ||
        err?.message?.includes('timed out')
      ) {
        error = `Execution timed out after ${TIMEOUT_MS}ms`
      } else {
        error = err?.message || String(err)
      }
    }

    const executionTime = Date.now() - startTime

    yield {
      state: 'complete' as const,
      code,
      language,
      output,
      logs: logs.join('\n'),
      error,
      executionTime
    }
  }
})

function stringify(value: any): string {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
```

**Step 4: Run tests**

```bash
bun run test -- lib/tools/__tests__/code.test.ts
```

Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add lib/tools/code.ts lib/tools/__tests__/code.test.ts
git commit -m "feat: add code execution tool with vm sandbox"
```

---

## Task 2: Register Tool in Types and Agent

**Files:**

- Modify: `lib/types/ai.ts:50-57`
- Modify: `lib/types/agent.ts:14-19`
- Modify: `lib/agents/researcher.ts`

**Step 1: Add tool to UITools type**

In `lib/types/ai.ts`, add the import and type entry:

```typescript
// Add import at top (after existing tool imports)
import { codeExecutionTool } from '@/lib/tools/code'
```

Add to the `UITools` type:

```typescript
export type UITools = {
  search: InferUITool<typeof searchTool>
  fetch: InferUITool<typeof fetchTool>
  askQuestion: InferUITool<typeof askQuestionTool>
  todoWrite: InferUITool<typeof todoTools.todoWrite>
  runCode: InferUITool<typeof codeExecutionTool>
  // Dynamic tools will be added at runtime
  [key: string]: any
}
```

**Step 2: Add to ResearcherTools type**

In `lib/types/agent.ts`, add import:

```typescript
import type { codeExecutionTool } from '../tools/code'
```

Update the type:

```typescript
export type ResearcherTools = {
  search: ReturnType<typeof createSearchTool>
  fetch: typeof fetchTool
  askQuestion: ReturnType<typeof createQuestionTool>
  runCode: typeof codeExecutionTool
} & ReturnType<typeof createTodoTools>
```

Add invocation type:

```typescript
export type CodeToolInvocation = UIToolInvocation<ResearcherTools['runCode']>
```

Add to the union:

```typescript
export type ResearcherToolInvocation =
  | SearchToolInvocation
  | FetchToolInvocation
  | QuestionToolInvocation
  | TodoWriteToolInvocation
  | CodeToolInvocation
```

**Step 3: Register in researcher agent**

In `lib/agents/researcher.ts`, add import:

```typescript
import { codeExecutionTool } from '../tools/code'
```

Add to both quick and adaptive activeToolsList (after the existing entries):

```typescript
// In the switch statement, for both cases:
activeToolsList = ['search', 'fetch', 'runCode'] // quick mode
// ...
activeToolsList = ['search', 'fetch', 'runCode'] // adaptive mode (before todoWrite push)
```

Add to the tools object:

```typescript
const tools: ResearcherTools = {
  search: searchTool,
  fetch: fetchTool,
  askQuestion: askQuestionTool,
  runCode: codeExecutionTool,
  ...todoTools
} as ResearcherTools
```

**Step 4: Verify types**

```bash
bun typecheck
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/types/ai.ts lib/types/agent.ts lib/agents/researcher.ts
git commit -m "feat: register runCode tool in types and researcher agent"
```

---

## Task 3: Create CodeSandboxSection Component

**Files:**

- Create: `components/code-sandbox-section.tsx`

**Step 1: Create the component**

Create: `components/code-sandbox-section.tsx`

```tsx
'use client'

import { Check, Code2, Copy, Play, Terminal, XCircle } from 'lucide-react'
import { useState } from 'react'

import type { ToolPart } from '@/lib/types/ai'
import { cn } from '@/lib/utils'

import { useArtifact } from '@/components/artifact/artifact-context'
import { CollapsibleMessage } from '@/components/collapsible-message'
import { ProcessHeader } from '@/components/process-header'

interface CodeSandboxSectionProps {
  tool: ToolPart<'runCode'>
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  borderless?: boolean
  isFirst?: boolean
  isLast?: boolean
}

export function CodeSandboxSection({
  tool,
  isOpen,
  onOpenChange,
  borderless = false,
  isFirst = false,
  isLast = false
}: CodeSandboxSectionProps) {
  const { open } = useArtifact()
  const [copied, setCopied] = useState(false)
  const output = tool.state === 'output-available' ? tool.output : undefined
  const isRunning = !output || output.state === 'running'
  const isComplete = output?.state === 'complete'
  const hasError = isComplete && !!output?.error
  const hasOutput = isComplete && (!!output?.output || !!output?.logs)

  const code = output?.code || tool.input?.code || ''
  const language = output?.language || tool.input?.language || 'javascript'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Truncate code for header preview
  const firstLine = code.split('\n')[0]?.slice(0, 60) || 'Code'
  const lineCount = code.split('\n').length

  const header = (
    <ProcessHeader
      label={
        <span className="flex items-center gap-1.5 truncate">
          <Code2 className="h-3 w-3 shrink-0" />
          <span className="truncate font-mono text-[11px]">{firstLine}</span>
        </span>
      }
      meta={
        isRunning ? (
          <span className="flex items-center gap-1 text-amber-500">
            <Play className="h-3 w-3 animate-pulse" />
            Running...
          </span>
        ) : hasError ? (
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="h-3 w-3" />
            Error
          </span>
        ) : (
          <span className="flex items-center gap-1 text-emerald-500">
            <Check className="h-3 w-3" />
            {output?.executionTime ? `${output.executionTime}ms` : 'Done'}
          </span>
        )
      }
      onInspect={() => open(tool)}
      isLoading={isRunning}
    />
  )

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      header={header}
      showIcon={false}
      showBorder={!borderless}
      variant="process"
      showSeparator={false}
      chevronSize="sm"
    >
      <div className="space-y-2 px-1 pb-1">
        {/* Code block */}
        <div className="relative rounded-md border bg-muted/30 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/50">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {language}
            </span>
            <button
              onClick={handleCopy}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Copy code"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>
          <pre className="p-3 text-xs font-mono overflow-x-auto leading-relaxed">
            <code>{code}</code>
          </pre>
        </div>

        {/* Output */}
        {isRunning && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed text-xs text-muted-foreground">
            <Terminal className="h-3 w-3 animate-pulse" />
            Executing...
          </div>
        )}

        {isComplete && (output?.logs || output?.output || output?.error) && (
          <div
            className={cn(
              'rounded-md border overflow-hidden',
              hasError
                ? 'border-destructive/30 bg-destructive/5'
                : 'border-emerald-500/20 bg-emerald-500/5'
            )}
          >
            <div
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 border-b text-[10px] font-medium uppercase tracking-wider',
                hasError
                  ? 'border-destructive/20 text-destructive'
                  : 'border-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              )}
            >
              <Terminal className="h-3 w-3" />
              {hasError ? 'Error' : 'Output'}
            </div>
            <pre className="p-3 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap">
              {output.logs && (
                <span className="text-muted-foreground">{output.logs}</span>
              )}
              {output.logs && output.output && '\n'}
              {output.output && (
                <span className="text-foreground">{output.output}</span>
              )}
              {output.error && (
                <span className="text-destructive">{output.error}</span>
              )}
            </pre>
          </div>
        )}
      </div>
    </CollapsibleMessage>
  )
}
```

**Step 2: Commit**

```bash
git add components/code-sandbox-section.tsx
git commit -m "feat: add code sandbox section component for genUI rendering"
```

---

## Task 4: Wire into ToolSection Rendering Switch

**Files:**

- Modify: `components/tool-section.tsx:1-117`

**Step 1: Add import**

In `components/tool-section.tsx`, add import after existing component imports:

```typescript
import { CodeSandboxSection } from './code-sandbox-section'
```

**Step 2: Add case to switch**

In the `switch (tool.type)` block (after the `tool-todoWrite` case, before `default`):

```typescript
    case 'tool-runCode':
      return (
        <CodeSandboxSection
          tool={tool as ToolPart<'runCode'>}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          borderless={borderless}
          isFirst={isFirst}
          isLast={isLast}
        />
      )
```

**Step 3: Commit**

```bash
git add components/tool-section.tsx
git commit -m "feat: wire code sandbox into tool section rendering"
```

---

## Task 5: Add Artifact Panel Support

**Files:**

- Modify: `components/artifact/artifact-content.tsx:1-34`
- Modify: `components/artifact/tool-invocation-content.tsx:1-14`
- Create: `components/artifact/code-artifact-content.tsx`

**Step 1: Create artifact content component**

Create: `components/artifact/code-artifact-content.tsx`

```tsx
'use client'

import { Check, Copy, Terminal } from 'lucide-react'
import { useState } from 'react'

import type { ToolPart } from '@/lib/types/ai'
import { cn } from '@/lib/utils'

export function CodeArtifactContent({ tool }: { tool: ToolPart<'runCode'> }) {
  const [copied, setCopied] = useState(false)
  const output = tool.state === 'output-available' ? tool.output : undefined
  const isComplete = output?.state === 'complete'
  const code = output?.code || tool.input?.code || ''
  const language = output?.language || tool.input?.language || 'javascript'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Code Execution</h3>
        {isComplete && output?.executionTime && (
          <span className="text-xs text-muted-foreground">
            {output.executionTime}ms
          </span>
        )}
      </div>

      {/* Code */}
      <div className="relative rounded-lg border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
          <span className="text-xs font-medium text-muted-foreground uppercase">
            {language}
          </span>
          <button
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <pre className="p-4 text-sm font-mono overflow-x-auto leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>

      {/* Output */}
      {isComplete && (output?.logs || output?.output || output?.error) && (
        <div
          className={cn(
            'rounded-lg border overflow-hidden',
            output.error ? 'border-destructive/30' : 'border-emerald-500/20'
          )}
        >
          <div
            className={cn(
              'flex items-center gap-2 px-4 py-2 border-b text-xs font-medium',
              output.error
                ? 'text-destructive border-destructive/20'
                : 'text-emerald-600 dark:text-emerald-400 border-emerald-500/15'
            )}
          >
            <Terminal className="h-3.5 w-3.5" />
            {output.error ? 'Error' : 'Output'}
          </div>
          <pre className="p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {output.logs && (
              <span className="text-muted-foreground">{output.logs}</span>
            )}
            {output.logs && output.output && '\n'}
            {output.output && (
              <span className="text-foreground">{output.output}</span>
            )}
            {output.error && (
              <span className="text-destructive">{output.error}</span>
            )}
          </pre>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Add to ToolInvocationContent**

In `components/artifact/tool-invocation-content.tsx`, add import:

```typescript
import { CodeArtifactContent } from '@/components/artifact/code-artifact-content'
```

Add case in the switch:

```typescript
export function ToolInvocationContent({ part }: { part: ToolPart }) {
  switch (part.type) {
    case 'tool-search':
      return <SearchArtifactContent tool={part as ToolPart<'search'>} />
    case 'tool-runCode':
      return <CodeArtifactContent tool={part as ToolPart<'runCode'>} />
    default:
      return <div className="p-4">Details for this tool are not available</div>
  }
}
```

**Step 3: Add to ArtifactContent routing**

In `components/artifact/artifact-content.tsx`, add `'tool-runCode'` to the tool cases:

```typescript
    case 'tool-search':
    case 'tool-fetch':
    case 'tool-askQuestion':
    case 'tool-runCode':
      return <ToolInvocationContent part={part} />
```

**Step 4: Commit**

```bash
git add components/artifact/code-artifact-content.tsx components/artifact/tool-invocation-content.tsx components/artifact/artifact-content.tsx
git commit -m "feat: add code sandbox artifact panel support"
```

---

## Task 6: Verification

**Step 1: Type checking**

```bash
bun typecheck
```

Expected: PASS

**Step 2: Lint**

```bash
bun lint
```

Expected: PASS. Fix any import order issues.

**Step 3: Run all tests**

```bash
bun run test
```

Expected: All existing tests PASS + new code tool tests PASS.

**Step 4: Format**

```bash
bun format
```

**Step 5: Build**

```bash
bun run build
```

Expected: Production build succeeds.

**Step 6: Manual smoke test**

```bash
bun dev
```

Test these prompts in the chat:

1. "What is 2^32?" — LLM should call runCode, render code + output inline
2. "Write a function to check if a number is prime, then test it with 17 and 100" — multi-step code
3. "Sort this array: [5, 3, 8, 1, 9, 2]" — simple computation
4. "What's the fibonacci sequence up to 20 terms?" — console.log output

Verify:

- Code block renders with syntax highlighting
- Output shows in green-bordered panel
- Errors show in red-bordered panel
- "Inspect" button opens artifact panel with full-size view
- Loading state shows while executing
- Execution time badge displays

**Step 7: Final commit**

```bash
git add -A
git commit -m "chore: formatting and verification fixes for code sandbox tool"
```

---

## Files Summary

| Action | File                                              | What                                      |
| ------ | ------------------------------------------------- | ----------------------------------------- |
| Create | `lib/tools/code.ts`                               | Code execution tool with vm sandbox       |
| Create | `lib/tools/__tests__/code.test.ts`                | Tool unit tests                           |
| Create | `components/code-sandbox-section.tsx`             | Inline chat component                     |
| Create | `components/artifact/code-artifact-content.tsx`   | Artifact panel view                       |
| Modify | `lib/types/ai.ts`                                 | Add `runCode` to UITools                  |
| Modify | `lib/types/agent.ts`                              | Add to ResearcherTools + invocation types |
| Modify | `lib/agents/researcher.ts`                        | Register tool + add to activeToolsList    |
| Modify | `components/tool-section.tsx`                     | Add rendering case                        |
| Modify | `components/artifact/tool-invocation-content.tsx` | Add artifact case                         |
| Modify | `components/artifact/artifact-content.tsx`        | Add routing case                          |

**Unchanged:** `/api/chat/route.ts`, streaming pipeline, DB schema, all existing tools and components.

---

## Agent Team Assignment (if using teams)

This is a single-track implementation (each task depends on the previous), so **one agent** is optimal:

| Task | Description                   | Depends on |
| ---- | ----------------------------- | ---------- |
| 1    | Define tool + tests           | —          |
| 2    | Register in types + agent     | 1          |
| 3    | Create section component      | 1          |
| 4    | Wire into tool-section switch | 2, 3       |
| 5    | Add artifact panel support    | 3          |
| 6    | Verification                  | 4, 5       |

Tasks 3 and 2 can run in parallel (Agent A: types/agent, Agent B: component), then converge at Task 4.
