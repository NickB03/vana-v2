import { tool } from 'ai'
import { z } from 'zod'

const PlanTodoSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this step'),
  label: z.string().min(1).describe('Short description of the step'),
  status: z
    .enum(['pending', 'in_progress', 'completed', 'cancelled'])
    .describe('Current status of the step'),
  description: z
    .string()
    .optional()
    .describe('Detailed description (shown on expand)')
})

const DisplayPlanSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this plan'),
  title: z.string().min(1).describe('Plan title'),
  description: z.string().optional().describe('Brief plan description'),
  todos: z
    .array(PlanTodoSchema)
    .min(1)
    .describe('Steps in the plan with their statuses')
})

export const displayPlanTool = tool({
  description:
    'Display a visual step-by-step guide or how-to checklist for the user to follow. Use ONLY for instructional content like tutorials, guides, or learning paths — NOT for research planning or task tracking. Each step has a status indicator.',
  inputSchema: DisplayPlanSchema,
  execute: async params => params
})
