import { describe, expect, it } from 'vitest'

import { codeExecutionTool } from '../code'

describe('codeExecutionTool', () => {
  it('has the correct description and schema', () => {
    expect(codeExecutionTool.description).toContain('Execute')
    expect(codeExecutionTool.inputSchema).toBeDefined()
  })

  it('executes simple JavaScript and returns output', async () => {
    const result = codeExecutionTool.execute!(
      {
        code: 'const x = 2 + 2; x',
        language: 'javascript'
      },
      { toolCallId: 'test-1', messages: [] }
    )

    const chunks: any[] = []
    for await (const chunk of result as AsyncIterable<any>) {
      chunks.push(chunk)
    }

    const final = chunks[chunks.length - 1]
    expect(final.state).toBe('complete')
    expect(final.output).toContain('4')
    expect(final.error).toBeUndefined()
  })

  it('captures console.log output', async () => {
    const result = codeExecutionTool.execute!(
      {
        code: 'console.log("hello"); console.log("world")',
        language: 'javascript'
      },
      { toolCallId: 'test-2', messages: [] }
    )

    const chunks: any[] = []
    for await (const chunk of result as AsyncIterable<any>) {
      chunks.push(chunk)
    }

    const final = chunks[chunks.length - 1]
    expect(final.state).toBe('complete')
    expect(final.logs).toContain('hello')
    expect(final.logs).toContain('world')
  })

  it('returns error for invalid code', async () => {
    const result = codeExecutionTool.execute!(
      {
        code: 'throw new Error("boom")',
        language: 'javascript'
      },
      { toolCallId: 'test-3', messages: [] }
    )

    const chunks: any[] = []
    for await (const chunk of result as AsyncIterable<any>) {
      chunks.push(chunk)
    }

    const final = chunks[chunks.length - 1]
    expect(final.state).toBe('complete')
    expect(final.error).toContain('boom')
  })

  it('passes through HTML without server execution', async () => {
    const html = '<div><h1>Hello</h1></div>'
    const result = codeExecutionTool.execute!(
      { code: html, language: 'html' },
      { toolCallId: 'test-html-1', messages: [] }
    )

    const chunks: any[] = []
    for await (const chunk of result as AsyncIterable<any>) {
      chunks.push(chunk)
    }

    expect(chunks[0].state).toBe('running')
    const final = chunks[chunks.length - 1]
    expect(final.state).toBe('complete')
    expect(final.output).toBe(html)
    expect(final.executionTime).toBe(0)
    expect(final.error).toBeUndefined()
  })

  it('passes through HTML with script tags without executing them', async () => {
    const html =
      '<html><body><script>document.write("hi")</script></body></html>'
    const result = codeExecutionTool.execute!(
      { code: html, language: 'html' },
      { toolCallId: 'test-html-2', messages: [] }
    )

    const chunks: any[] = []
    for await (const chunk of result as AsyncIterable<any>) {
      chunks.push(chunk)
    }

    const final = chunks[chunks.length - 1]
    expect(final.state).toBe('complete')
    expect(final.output).toBe(html)
    expect(final.error).toBeUndefined()
  })

  it('times out on infinite loops', { timeout: 10000 }, async () => {
    const result = codeExecutionTool.execute!(
      {
        code: 'while(true) {}',
        language: 'javascript'
      },
      { toolCallId: 'test-4', messages: [] }
    )

    const chunks: any[] = []
    for await (const chunk of result as AsyncIterable<any>) {
      chunks.push(chunk)
    }

    const final = chunks[chunks.length - 1]
    expect(final.state).toBe('complete')
    expect(final.error).toBeDefined()
    expect(final.error).toMatch(/timed?\s*out|execution time/i)
  })
})
