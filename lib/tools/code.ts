import { tool } from 'ai'
import vm from 'node:vm'
import { z } from 'zod'

const TIMEOUT_MS = 5000

export const codeExecutionTool = tool({
  description:
    'Execute JavaScript code or render HTML visualizations. Use JavaScript for calculations, data transformations, and algorithms. Use HTML for interactive visualizations, charts (with CDN libraries like Chart.js, D3, Plotly), calculators, and mini-apps that benefit from visual rendering.',
  inputSchema: z.object({
    code: z.string().describe('The code to execute or render'),
    language: z
      .enum(['javascript', 'html'])
      .default('javascript')
      .describe(
        'Programming language: javascript for computation, html for visual output'
      )
  }),
  async *execute({ code, language }) {
    yield {
      state: 'running' as const,
      code,
      language
    }

    // HTML pass-through: no server-side execution needed
    if (language === 'html') {
      yield {
        state: 'complete' as const,
        code,
        language,
        output: code,
        logs: '',
        error: undefined,
        executionTime: 0
      }
      return
    }

    const logs: string[] = []
    let output: string | undefined
    let error: string | undefined
    const startTime = Date.now()

    try {
      // Create a sandbox with captured console
      const sandbox = {
        console: {
          log: (...args: any[]) =>
            logs.push(args.map(a => stringify(a)).join(' ')),
          error: (...args: any[]) =>
            logs.push(`[error] ${args.map(a => stringify(a)).join(' ')}`),
          warn: (...args: any[]) =>
            logs.push(`[warn] ${args.map(a => stringify(a)).join(' ')}`)
        },
        JSON,
        Math,
        Date,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Map,
        Set,
        Promise,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        encodeURIComponent,
        decodeURIComponent,
        setTimeout: undefined,
        setInterval: undefined,
        fetch: undefined,
        require: undefined,
        process: undefined
      }

      const context = vm.createContext(sandbox)
      const script = new vm.Script(code)
      const result = script.runInContext(context, { timeout: TIMEOUT_MS })

      if (result !== undefined) {
        output = stringify(result)
      }
    } catch (err: any) {
      if (
        err?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' ||
        err?.message?.includes('timed out')
      ) {
        error = `Execution timed out after ${TIMEOUT_MS}ms`
      } else {
        error = err?.message || String(err)
      }
    }

    const executionTime = Date.now() - startTime

    yield {
      state: 'complete' as const,
      code,
      language,
      output,
      logs: logs.join('\n'),
      error,
      executionTime
    }
  }
})

function stringify(value: any): string {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
