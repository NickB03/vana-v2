import { tool } from 'ai'
import { z } from 'zod'

const FormatSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text') }),
  z.object({
    kind: z.literal('number'),
    decimals: z.number().optional(),
    unit: z.string().optional(),
    compact: z.boolean().optional()
  }),
  z.object({
    kind: z.literal('currency'),
    currency: z.string(),
    decimals: z.number().optional()
  }),
  z.object({
    kind: z.literal('percent'),
    decimals: z.number().optional(),
    basis: z.enum(['fraction', 'unit']).optional()
  }),
  z.object({
    kind: z.literal('date'),
    dateFormat: z.enum(['short', 'long', 'relative']).optional()
  }),
  z.object({
    kind: z.literal('delta'),
    decimals: z.number().optional(),
    upIsPositive: z.boolean().optional()
  }),
  z.object({
    kind: z.literal('boolean'),
    labels: z.object({ true: z.string(), false: z.string() }).optional()
  }),
  z.object({
    kind: z.literal('link'),
    hrefKey: z.string().optional(),
    external: z.boolean().optional()
  }),
  z.object({
    kind: z.literal('badge'),
    colorMap: z
      .record(
        z.string(),
        z.enum(['success', 'warning', 'danger', 'info', 'neutral'])
      )
      .optional()
  })
])

const ColumnSchema = z.object({
  key: z.string().describe('Key in row data to display'),
  label: z.string().describe('Column header label'),
  sortable: z.boolean().optional().describe('Whether column is sortable'),
  align: z.enum(['left', 'right', 'center']).optional(),
  format: FormatSchema.optional().describe('Value formatting configuration')
})

const DisplayTableSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this table'),
  columns: z
    .array(ColumnSchema)
    .min(1)
    .describe('Column definitions with keys and labels'),
  data: z
    .array(
      z.record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean(), z.null()])
      )
    )
    .describe('Row data as array of objects'),
  defaultSort: z
    .object({
      by: z.string().optional(),
      direction: z.enum(['asc', 'desc']).optional()
    })
    .optional()
    .describe('Default sort configuration')
})

export const displayTableTool = tool({
  description:
    'Display data in a rich, sortable table with formatted columns. Use when presenting structured/tabular data like comparisons, statistics, prices, or lists with multiple attributes.',
  inputSchema: DisplayTableSchema,
  execute: async params => params
})
