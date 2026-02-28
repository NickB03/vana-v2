# Fix Planning & Display Tool Rendering

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two interrelated bugs: (1) planning tools are triggered but not used correctly during chat, and (2) display tools render as ugly "Custom Tool" wrappers after page reload instead of their rich UI components.

**Architecture:** The agent pipeline uses two distinct planning mechanisms: `displayPlan` (static, fire-and-forget UI for how-to guides) and `todoWrite` (stateful task tracker for research planning). The model calls the wrong one or has neither available. Separately, display tool parts lose their type during DB save/load roundtrip, causing a rendering branch mismatch.

**Tech Stack:** Next.js 16, Vercel AI SDK (ToolLoopAgent), TypeScript, React, Drizzle ORM

---

### Task 1: Enable todoWrite for all adaptive mode users

The `todoWrite` tool is gated behind `modelType === 'quality'` but most users (guests, cloud) are forced to `'speed'`. The prompt tells the model to use `todoWrite` for medium/complex queries, but the tool isn't available.

**Files:**
- Modify: `lib/agents/researcher.ts:139`

**Step 1: Remove the modelType gate**

In `lib/agents/researcher.ts`, change line 139 from:

```typescript
        if (writer && 'todoWrite' in todoTools && modelType === 'quality') {
```

to:

```typescript
        if (writer && 'todoWrite' in todoTools) {
```

**Step 2: Run typecheck**

Run: `bun typecheck`
Expected: PASS (no type changes, just removing a condition)

**Step 3: Commit**

```bash
git add lib/agents/researcher.ts
git commit -m "fix: enable todoWrite for all adaptive mode users

Previously gated behind modelType === 'quality', but most users are
forced to 'speed'. The prompt already handles complexity assessment."
```

---

### Task 2: Remove displayPlan from adaptive mode tools

In adaptive mode, `todoWrite` is the correct planning tool (stateful, supports CREATE/UPDATE/FINALIZE). Having `displayPlan` alongside creates ambiguity — the model picks the static one and items stay "pending" forever.

**Files:**
- Modify: `lib/agents/researcher.ts:129-137`

**Step 1: Remove displayPlan from the adaptive activeToolsList**

In `lib/agents/researcher.ts`, change lines 129-137 from:

```typescript
        activeToolsList = [
          'search',
          'fetch',
          'displayPlan',
          'displayTable',
          'displayCitations',
          'displayLinkPreview',
          'displayOptionList'
        ]
```

to:

```typescript
        activeToolsList = [
          'search',
          'fetch',
          'displayTable',
          'displayCitations',
          'displayLinkPreview',
          'displayOptionList'
        ]
```

**Step 2: Run typecheck**

Run: `bun typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/agents/researcher.ts
git commit -m "fix: remove displayPlan from adaptive mode tools

In adaptive mode, todoWrite is the correct planning tool (stateful,
updatable). displayPlan is static and can't track progress."
```

---

### Task 3: Tighten displayPlan prompt guidance and tool description

The prompt trigger list for `displayPlan` is too broad ("any query where the answer is naturally a sequence of steps"), causing the model to call it for research/summarize queries where it's inappropriate. The tool description also says "task breakdown" which encourages misuse.

**Files:**
- Modify: `lib/agents/prompts/search-mode-prompts.ts:106-110` (quick mode displayPlan)
- Modify: `lib/agents/prompts/search-mode-prompts.ts:303-307` (adaptive mode displayPlan)
- Modify: `lib/tools/display-plan.ts:27-28` (tool description)

**Step 1: Update quick mode displayPlan guidance**

In `lib/agents/prompts/search-mode-prompts.ts`, replace lines 106-110:

```
**displayPlan** — Use for ANY how-to, learning path, guide, or multi-step process:
- TRIGGER: Questions starting with "how do I", "how to", "steps to", "guide to", "learn", "get started with", "process for", or any query where the answer is naturally a sequence of steps
- Examples: "how do I learn Python", "how to deploy to AWS", "steps to start a business"
- Each step needs: id, label, status (use "pending" for all steps in a fresh plan)
- Call this tool BEFORE writing your text answer
```

with:

```
**displayPlan** — Use ONLY for how-to guides, learning paths, or step-by-step instructions for the USER to follow:
- TRIGGER: Questions starting with "how do I", "how to", "steps to", "guide to", "learn", "get started with", "process for"
- Do NOT use displayPlan for research queries, summaries, comparisons, news, or any query where YOU are gathering information — just search and answer directly
- Examples: "how do I learn Python", "how to deploy to AWS", "steps to start a business"
- Each step needs: id, label, status (use "pending" for all steps)
- Call this tool BEFORE writing your text answer
```

**Step 2: Update adaptive mode displayPlan guidance**

In the same file, replace lines 303-307:

```
**displayPlan** — Use for ANY how-to, learning path, guide, or multi-step process:
- TRIGGER: Questions starting with "how do I", "how to", "steps to", "guide to", "learn", "get started with", "process for", or any query where the answer is naturally a sequence of steps
- Examples: "how do I learn Python", "how to deploy to AWS", "steps to start a business"
- Each step needs: id (unique), label (description), status (use "pending" for all steps in a fresh plan)
- Call this tool BEFORE writing your text answer
```

with:

```
**displayPlan** — Use ONLY for how-to guides, learning paths, or step-by-step instructions for the USER to follow:
- TRIGGER: Questions starting with "how do I", "how to", "steps to", "guide to", "learn", "get started with", "process for"
- Do NOT use displayPlan for research queries or summaries — use todoWrite for research planning instead
- Examples: "how do I learn Python", "how to deploy to AWS", "steps to start a business"
- Each step needs: id (unique), label (description), status (use "pending" for all steps)
- Call this tool BEFORE writing your text answer
```

**Step 3: Update the displayPlan tool description**

In `lib/tools/display-plan.ts`, replace line 27-28:

```typescript
  description:
    'Display a visual plan/checklist with progress tracking. Use when presenting a multi-step plan, roadmap, or task breakdown to the user. Each step has a status indicator.',
```

with:

```typescript
  description:
    'Display a visual step-by-step guide or how-to checklist for the user to follow. Use ONLY for instructional content like tutorials, guides, or learning paths — NOT for research planning or task tracking. Each step has a status indicator.',
```

**Step 4: Run typecheck and lint**

Run: `bun typecheck && bun lint`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/agents/prompts/search-mode-prompts.ts lib/tools/display-plan.ts
git commit -m "fix: tighten displayPlan triggers to how-to guides only

Add explicit negative guidance to prevent model from calling displayPlan
for research/summarize queries. Clarify tool description to distinguish
instructional content from research planning."
```

---

### Task 4: Add todoWrite fallback guidance in adaptive prompt

Defensive prompt: if `todoWrite` ever becomes unavailable (edge case), tell the model to skip planning rather than getting confused.

**Files:**
- Modify: `lib/agents/prompts/search-mode-prompts.ts:368-370`

**Step 1: Add fallback after the todoWrite CRITICAL RULE section**

In `lib/agents/prompts/search-mode-prompts.ts`, after line 370 (`- Only proceed to the final answer after completedCount === totalCount`), add:

```
**FALLBACK**: If todoWrite is not available in your tools list, skip the planning step and proceed directly with search. Do not write plans in text output.
```

**Step 2: Run lint**

Run: `bun lint`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/agents/prompts/search-mode-prompts.ts
git commit -m "fix: add todoWrite fallback guidance in adaptive prompt"
```

---

### Task 5: Fix DB roundtrip type reconstruction for display tools (Critical UI bug)

Display tools save as `type: 'tool-dynamic'` with `tool_dynamic_type: 'display'` but load back as `type: 'dynamic-tool'`. This misses the `startsWith('tool-display')` check in `render-message.tsx:160`, causing fallthrough to the generic `DynamicToolDisplay` wrapper ("Custom Tool" header + raw JSON).

**Files:**
- Modify: `lib/utils/message-mapping.ts:422-431`

**Step 1: Reconstruct display tool types on DB load**

In `lib/utils/message-mapping.ts`, replace lines 422-431:

```typescript
        if (toolName === 'dynamic') {
          return {
            type: 'dynamic-tool',
            toolCallId: part.tool_toolCallId || '',
            toolName: part.tool_dynamic_name || '',
            state: part.tool_state as any, // Maps directly to AI SDK states
            input: part.tool_dynamic_input,
            output: part.tool_dynamic_output,
            errorText: part.tool_errorText
          }
        }
```

with:

```typescript
        if (toolName === 'dynamic') {
          // Reconstruct display tools to their original type for rich rendering
          if (part.tool_dynamic_type === 'display' && part.tool_dynamic_name) {
            return {
              type: `tool-${part.tool_dynamic_name}` as any,
              toolCallId: part.tool_toolCallId || '',
              state: part.tool_state as any,
              input: part.tool_dynamic_input,
              output: part.tool_dynamic_output,
              errorText: part.tool_errorText
            }
          }
          // Regular dynamic tools (MCP, etc.)
          return {
            type: 'dynamic-tool',
            toolCallId: part.tool_toolCallId || '',
            toolName: part.tool_dynamic_name || '',
            state: part.tool_state as any,
            input: part.tool_dynamic_input,
            output: part.tool_dynamic_output,
            errorText: part.tool_errorText
          }
        }
```

**Step 2: Run typecheck**

Run: `bun typecheck`
Expected: PASS (the `as any` cast matches the existing pattern)

**Step 3: Commit**

```bash
git add lib/utils/message-mapping.ts
git commit -m "fix: reconstruct display tool types on DB load

Display tools saved as tool-dynamic with tool_dynamic_type='display'
were loading back as 'dynamic-tool', missing the rich UI rendering
branch. Now reconstructs the original type (e.g., 'tool-displayPlan')
so render-message.tsx catches them correctly."
```

---

### Task 6: DynamicToolDisplay — skip wrapper for registered tool UIs

Defense-in-depth: if a display tool ever reaches `DynamicToolDisplay` (e.g., non-display dynamic tools that match a registry entry), render only the rich component without the "Custom Tool" header/input/status wrapper.

**Files:**
- Modify: `components/tool-ui/registry.tsx` (add `isRegisteredToolUI` helper)
- Modify: `components/dynamic-tool-display.tsx:44-143` (early return for registered tools)

**Step 1: Add isRegisteredToolUI helper to registry**

In `components/tool-ui/registry.tsx`, add after the `tryRenderToolUI` function (after line 110):

```typescript
/**
 * Check if a tool name has a registered UI component.
 */
export function isRegisteredToolUI(toolName: string): boolean {
  return entries.some(e => e.name === toolName)
}
```

**Step 2: Update DynamicToolDisplay to skip wrapper for registered tools**

In `components/dynamic-tool-display.tsx`, add the import at line 5:

```typescript
import { isRegisteredToolUI, tryRenderToolUIByName } from './tool-ui/registry'
```

(replacing the existing import of just `tryRenderToolUIByName`)

Then in the component body, add an early return after line 66 (`const displayName = getDisplayName(part.toolName)`):

```typescript
  // For registered tool UIs, render the rich component directly without wrapper
  if (isRegisteredToolUI(part.toolName)) {
    if (part.state === 'output-available') {
      const rendered = tryRenderToolUIByName(part.toolName, part.output)
      if (rendered) return <div className="my-2">{rendered}</div>
    }
    if (part.state === 'input-streaming' || part.state === 'input-available') {
      return <div className="my-2 h-24 animate-pulse rounded-lg bg-muted" />
    }
  }
```

**Step 3: Run typecheck and lint**

Run: `bun typecheck && bun lint`
Expected: PASS

**Step 4: Commit**

```bash
git add components/tool-ui/registry.tsx components/dynamic-tool-display.tsx
git commit -m "fix: skip generic wrapper for registered tool UIs

If a display tool reaches DynamicToolDisplay (defense-in-depth path),
render the rich component directly instead of wrapping in Custom Tool
header + raw JSON input."
```

---

### Task 7: Add fallback placeholder for schema parse failures

When `tryRenderToolUIByName` returns null (schema parse failed), show a placeholder instead of silently dropping the component.

**Files:**
- Modify: `components/render-message.tsx:164-172`
- Modify: `components/tool-section.tsx:120-131`

**Step 1: Add fallback in render-message.tsx**

In `components/render-message.tsx`, replace lines 164-172:

```tsx
      if (part.state === 'output-available' && part.output) {
        const rendered = tryRenderToolUIByName(toolName, part.output)
        if (rendered) {
          elements.push(
            <div key={`${messageId}-display-tool-${index}`} className="my-2">
              {rendered}
            </div>
          )
        }
      }
```

with:

```tsx
      if (part.state === 'output-available' && part.output) {
        const rendered = tryRenderToolUIByName(toolName, part.output)
        elements.push(
          <div key={`${messageId}-display-tool-${index}`} className="my-2">
            {rendered ?? (
              <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                {toolName} output could not be rendered
              </div>
            )}
          </div>
        )
      }
```

**Step 2: Add same fallback in tool-section.tsx**

In `components/tool-section.tsx`, replace lines 120-124:

```tsx
      if (tool.state === 'output-available' && tool.output) {
        const toolName = tool.type.substring(5) // Remove 'tool-' prefix
        const rendered = tryRenderToolUIByName(toolName, tool.output)
        if (rendered) return <div className="my-2">{rendered}</div>
      }
```

with:

```tsx
      if (tool.state === 'output-available' && tool.output) {
        const toolName = tool.type.substring(5) // Remove 'tool-' prefix
        const rendered = tryRenderToolUIByName(toolName, tool.output)
        return (
          <div className="my-2">
            {rendered ?? (
              <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                {toolName} output could not be rendered
              </div>
            )}
          </div>
        )
      }
```

**Step 3: Run typecheck and lint**

Run: `bun typecheck && bun lint`
Expected: PASS

**Step 4: Commit**

```bash
git add components/render-message.tsx components/tool-section.tsx
git commit -m "fix: show placeholder when display tool schema parsing fails

Previously silently dropped the component. Now shows a dashed border
placeholder so the user knows something was attempted."
```

---

### Task 8: Final verification

**Step 1: Full build check**

Run: `bun typecheck && bun lint && bun run build`
Expected: All PASS

**Step 2: Manual testing checklist**

Start dev server: `bun dev`

Test these scenarios:
1. **Quick + "Summarize recent climate change research"**: `displayPlan` should NOT be called. Model searches and answers directly.
2. **Quick + "How do I learn Python"**: `displayPlan` IS called with instructional steps.
3. **Adaptive + speed + complex query**: `todoWrite` IS called with CREATE/UPDATE/FINALIZE flow.
4. **Adaptive + speed + simple query**: `todoWrite` NOT called (simple queries skip per prompt).
5. **Page reload on any display tool**: Rich UI renders correctly, not "Custom Tool" wrapper.
6. **Console**: No new errors or warnings.
