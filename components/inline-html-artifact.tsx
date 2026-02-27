'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Check, Globe, Play, XCircle } from 'lucide-react'

import type { ToolPart } from '@/lib/types/ai'

import { useArtifact } from '@/components/artifact/artifact-context'

interface InlineHtmlArtifactProps {
  tool: ToolPart<'runCode'>
}

export function InlineHtmlArtifact({ tool }: InlineHtmlArtifactProps) {
  const { open } = useArtifact()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeHeight, setIframeHeight] = useState(400)

  const output = tool.state === 'output-available' ? tool.output : undefined
  const isRunning = !output || output.state === 'running'
  const isComplete = output?.state === 'complete'
  const hasError = isComplete && !!output?.error

  const rawCode = output?.code || tool.input?.code || ''

  // Inject a resize script into the HTML so the iframe reports its content height
  const code = rawCode
    ? rawCode.replace(
        '</body>',
        `<script>
function __reportHeight() {
  var h = document.documentElement.scrollHeight;
  window.parent.postMessage({ type: '__iframe_resize', height: h }, '*');
}
window.addEventListener('load', __reportHeight);
new MutationObserver(__reportHeight).observe(document.body, { childList: true, subtree: true, attributes: true });
setTimeout(__reportHeight, 100);
setTimeout(__reportHeight, 500);
</script></body>`
      )
    : rawCode

  const handleMessage = useCallback((e: MessageEvent) => {
    if (
      e.data?.type === '__iframe_resize' &&
      typeof e.data.height === 'number' &&
      e.source === iframeRef.current?.contentWindow
    ) {
      setIframeHeight(Math.max(100, Math.min(e.data.height, 2000)))
    }
  }, [])

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  return (
    <div className="my-2 rounded-lg border bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground truncate">
            HTML Preview
          </span>
          {isRunning ? (
            <span className="flex items-center gap-1 text-xs text-amber-500">
              <Play className="h-3 w-3 animate-pulse" />
              Rendering...
            </span>
          ) : hasError ? (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <XCircle className="h-3 w-3" />
              Error
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <Check className="h-3 w-3" />
              Preview
            </span>
          )}
        </div>

        {/* Inspect button */}
        <button
          onClick={() => open(tool)}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
          aria-label="Open in inspector"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>

      {/* Content */}
      {isRunning ? (
        <div className="flex items-center justify-center gap-2 h-[400px] text-xs text-muted-foreground">
          <Globe className="h-4 w-4 animate-pulse" />
          Rendering...
        </div>
      ) : hasError ? (
        <div className="p-4 text-sm text-destructive">
          <pre className="whitespace-pre-wrap font-mono text-xs">
            {output?.error}
          </pre>
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          srcDoc={code}
          sandbox="allow-scripts"
          className="w-full bg-white"
          style={{ height: `${iframeHeight}px` }}
          title="HTML Preview"
        />
      )}
    </div>
  )
}
