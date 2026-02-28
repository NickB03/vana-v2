import { tool } from 'ai'
import { z } from 'zod'

const DisplayLinkPreviewSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this link preview'),
  href: z.string().url().describe('URL to preview'),
  title: z.string().optional().describe('Link title'),
  description: z.string().optional().describe('Brief description of the link'),
  image: z.string().url().optional().describe('Preview image URL'),
  domain: z.string().optional().describe('Source domain name'),
  favicon: z.string().url().optional().describe('Favicon URL')
})

export const displayLinkPreviewTool = tool({
  description:
    'Display a rich link preview card with title, description, and image. Use when presenting a single important link with visual context, such as a recommended article, documentation page, or resource.',
  inputSchema: DisplayLinkPreviewSchema,
  execute: async params => params
})
