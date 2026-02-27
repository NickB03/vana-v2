'use client'

import { useState } from 'react'

import { Check, Code2, Copy, Play, Terminal, XCircle } from 'lucide-react'

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
