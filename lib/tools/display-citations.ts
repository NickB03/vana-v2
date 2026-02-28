import { tool } from 'ai'
import { z } from 'zod'

const CitationSchema = z.object({
  id: z.string().min(1).describe('Unique citation identifier'),
  href: z.string().url().describe('Source URL'),
  title: z.string().describe('Source title'),
  snippet: z.string().optional().describe('Brief excerpt from the source'),
  domain: z.string().optional().describe('Source domain name'),
  favicon: z.string().url().optional().describe('Favicon URL'),
  author: z.string().optional().describe('Author name'),
  publishedAt: z
    .string()
    .datetime()
    .optional()
    .describe('Publication date in ISO format'),
  type: z
    .enum(['webpage', 'document', 'article', 'api', 'code', 'other'])
    .optional()
    .describe('Type of source')
})

const DisplayCitationsSchema = z.object({
  citations: z
    .array(CitationSchema)
    .min(1)
    .describe('Array of citation objects to display')
})

export const displayCitationsTool = tool({
  description:
    'Display a rich list of source citations with metadata. Use when presenting multiple references or sources in a visually organized format.',
  inputSchema: DisplayCitationsSchema,
  execute: async params => params
})
