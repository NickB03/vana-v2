'use client'

import type { ReactNode } from 'react'

import { CitationList } from './citation/citation-list'
import { safeParseSerializableCitation } from './citation/schema'
import { DataTable } from './data-table/data-table'
import { safeParseSerializableDataTable } from './data-table/schema'
import { LinkPreview } from './link-preview/link-preview'
import { safeParseSerializableLinkPreview } from './link-preview/schema'
import { OptionList } from './option-list/option-list'
import { safeParseSerializableOptionList } from './option-list/schema'
import { Plan } from './plan/plan'
import { safeParseSerializablePlan } from './plan/schema'

type ToolUIEntry = {
  name: string
  tryRender: (output: unknown) => ReactNode | null
}

const entries: ToolUIEntry[] = [
  {
    name: 'displayPlan',
    tryRender: output => {
      const parsed = safeParseSerializablePlan(output)
      if (!parsed) return null
      return <Plan {...parsed} />
    }
  },
  {
    name: 'displayTable',
    tryRender: output => {
      const parsed = safeParseSerializableDataTable(output)
      if (!parsed) return null
      return <DataTable {...parsed} />
    }
  },
  {
    name: 'displayCitations',
    tryRender: output => {
      // Output can be an array of citations or an object with a citations array
      const items = Array.isArray(output)
        ? output
        : typeof output === 'object' && output !== null && 'citations' in output
          ? (output as { citations: unknown[] }).citations
          : null
      if (!items || !Array.isArray(items)) return null

      const parsed = items
        .map(item => safeParseSerializableCitation(item))
        .filter(Boolean)
      if (parsed.length === 0) return null

      return (
        <CitationList
          id={`citations-${parsed[0]!.id}`}
          citations={parsed as NonNullable<(typeof parsed)[number]>[]}
          variant="default"
        />
      )
    }
  },
  {
    name: 'displayLinkPreview',
    tryRender: output => {
      const parsed = safeParseSerializableLinkPreview(output)
      if (!parsed) return null
      return <LinkPreview {...parsed} />
    }
  },
  {
    name: 'displayOptionList',
    tryRender: output => {
      const parsed = safeParseSerializableOptionList(output)
      if (!parsed) return null
      return <OptionList {...parsed} />
    }
  }
]

/**
 * Try to render tool output using a named Tool UI component.
 * Falls back to trying all registered schemas if no name match.
 */
export function tryRenderToolUIByName(
  toolName: string,
  output: unknown
): ReactNode | null {
  // Try named match first
  const named = entries.find(e => e.name === toolName)
  if (named) {
    const result = named.tryRender(output)
    if (result) return result
  }

  // Fall back to trying all schemas
  return tryRenderToolUI(output)
}

/**
 * Try to render tool output by testing against all registered schemas.
 * Returns the first successful match or null.
 */
export function tryRenderToolUI(output: unknown): ReactNode | null {
  for (const entry of entries) {
    const result = entry.tryRender(output)
    if (result) return result
  }
  return null
}

/**
 * Check if a tool name has a registered UI component.
 */
export function isRegisteredToolUI(toolName: string): boolean {
  return entries.some(e => e.name === toolName)
}
