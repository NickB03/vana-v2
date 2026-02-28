import { tool } from 'ai'
import { z } from 'zod'

const OptionSchema = z.object({
  id: z.string().min(1).describe('Unique option identifier'),
  label: z.string().min(1).describe('Display label for the option'),
  description: z.string().optional().describe('Additional context for the option')
})

const DisplayOptionListSchema = z.object({
  id: z
    .string()
    .min(1)
    .describe('Unique identifier for this option list'),
  options: z
    .array(OptionSchema)
    .min(1)
    .describe('Available options to choose from'),
  selectionMode: z
    .enum(['single', 'multi'])
    .optional()
    .describe('Whether user can select one or multiple options'),
  minSelections: z
    .number()
    .min(0)
    .optional()
    .describe('Minimum required selections'),
  maxSelections: z
    .number()
    .min(1)
    .optional()
    .describe('Maximum allowed selections')
})

export const displayOptionListTool = tool({
  description:
    'Display an interactive option list for the user to select from. Use when presenting choices that require user input, such as preferences, configuration options, or decision points.',
  inputSchema: DisplayOptionListSchema,
  execute: async params => params
})
