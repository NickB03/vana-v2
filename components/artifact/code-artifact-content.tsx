'use client'

import { useState } from 'react'

import { Check, Code2, Copy, Eye, Globe, Terminal } from 'lucide-react'

import type { ToolPart } from '@/lib/types/ai'
import { cn } from '@/lib/utils'

export function CodeArtifactContent({ tool }: { tool: ToolPart<'runCode'> }) {
  const [copied, setCopied] = useState(false)
  const output = tool.state === 'output-available' ? tool.output : undefined
  const isComplete = output?.state === 'complete'
  const code = output?.code || tool.input?.code || ''
  const language = output?.language || tool.input?.language || 'javascript'
  const isHtml = language === 'html'
  const [view, setView] = useState<'preview' | 'code'>(
    isHtml ? 'preview' : 'code'
  )

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          {isHtml && <Globe className="h-3.5 w-3.5" />}
          {isHtml ? 'HTML Preview' : 'Code Execution'}
        </h3>
        {isHtml ? (
          <div className="flex items-center gap-0.5 rounded-md border p-0.5">
            <button
              onClick={() => setView('preview')}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
                view === 'preview'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
            <button
              onClick={() => setView('code')}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
                view === 'code'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Code2 className="h-3 w-3" />
              Code
            </button>
          </div>
        ) : (
          isComplete &&
          !!output?.executionTime && (
            <span className="text-xs text-muted-foreground">
              {output.executionTime}ms
            </span>
          )
        )}
      </div>

      {/* HTML Preview */}
      {isHtml && view === 'preview' && (
        <div className="rounded-lg border overflow-hidden">
          <iframe
            srcDoc={code}
            sandbox="allow-scripts"
            className="w-full h-[400px] bg-white"
            title="HTML Preview"
          />
        </div>
      )}

      {/* Code */}
      {(!isHtml || view === 'code') && (
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
      )}

      {/* Output (JS only) */}
      {!isHtml &&
        isComplete &&
        (output?.logs || output?.output || output?.error) && (
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
