'use client'

import type { ToolPart } from '@/lib/types/ai'

import { CodeArtifactContent } from '@/components/artifact/code-artifact-content'
import { SearchArtifactContent } from '@/components/artifact/search-artifact-content'

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
