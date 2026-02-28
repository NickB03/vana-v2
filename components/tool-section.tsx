'use client'

import { UseChatHelpers } from '@ai-sdk/react'

import type { ToolPart, UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'

import { tryRenderToolUIByName } from './tool-ui/registry'
import FetchSection from './fetch-section'
import { QuestionConfirmation } from './question-confirmation'
import { SearchSection } from './search-section'
import { ToolTodoDisplay } from './tool-todo-display'

interface ToolSectionProps {
  tool: ToolPart
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  onQuerySelect: (query: string) => void
  borderless?: boolean
  isFirst?: boolean
  isLast?: boolean
}

export function ToolSection({
  tool,
  isOpen,
  onOpenChange,
  status,
  addToolResult,
  onQuerySelect,
  borderless = false,
  isFirst = false,
  isLast = false
}: ToolSectionProps) {
  // Special handling for ask_question tool
  if (tool.type === 'tool-askQuestion') {
    // When waiting for user input
    if (
      (tool.state === 'input-streaming' || tool.state === 'input-available') &&
      addToolResult
    ) {
      return (
        <QuestionConfirmation
          toolInvocation={tool as ToolPart<'askQuestion'>}
          onConfirm={(toolCallId, approved, response) => {
            addToolResult({
              toolCallId,
              result: approved
                ? response
                : {
                    declined: true,
                    skipped: response?.skipped,
                    message: 'User declined this question'
                  }
            })
          }}
        />
      )
    }

    // When result is available, display the result
    if (tool.state === 'output-available') {
      return (
        <QuestionConfirmation
          toolInvocation={tool as ToolPart<'askQuestion'>}
          isCompleted={true}
          onConfirm={() => {}} // Not used in result display mode
        />
      )
    }
  }

  switch (tool.type) {
    case 'tool-search':
      return (
        <SearchSection
          tool={tool as ToolPart<'search'>}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          status={status}
          borderless={borderless}
          isFirst={isFirst}
          isLast={isLast}
        />
      )
    case 'tool-fetch':
      return (
        <FetchSection
          tool={tool as ToolPart<'fetch'>}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          status={status}
          borderless={borderless}
          isFirst={isFirst}
          isLast={isLast}
        />
      )
    case 'tool-todoWrite':
      return (
        <ToolTodoDisplay
          tool="todoWrite"
          state={tool.state}
          input={tool.input}
          output={tool.output}
          errorText={tool.errorText}
          toolCallId={tool.toolCallId}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          borderless={borderless}
          isFirst={isFirst}
          isLast={isLast}
        />
      )
    case 'tool-displayPlan':
    case 'tool-displayTable':
    case 'tool-displayCitations':
    case 'tool-displayLinkPreview':
    case 'tool-displayOptionList': {
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
      if (
        tool.state === 'input-streaming' ||
        tool.state === 'input-available'
      ) {
        return <div className="my-2 h-24 animate-pulse rounded-lg bg-muted" />
      }
      return null
    }
    default:
      return null
  }
}
