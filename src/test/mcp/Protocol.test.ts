import * as assert from 'assert'
import { McpStdioServer } from '../../mcp/protocol'

function server (): McpStdioServer {
  const mcp = new McpStdioServer({ name: 'esbmc', version: '0.1.0' })
  mcp.tool(
    { name: 'echo', title: 'Echo', description: 'echoes', inputSchema: { type: 'object' } },
    async (args: any) => ({ content: [{ type: 'text' as const, text: String(args.text) }] })
  )
  return mcp
}

describe('McpStdioServer', () => {
  it('answers initialize with its capabilities and identity', async () => {
    const reply: any = await server().handle({ jsonrpc: '2.0', id: 1, method: 'initialize' })
    assert.strictEqual(reply.id, 1)
    assert.strictEqual(reply.result.serverInfo.name, 'esbmc')
    assert.deepStrictEqual(reply.result.capabilities, { tools: {} })
    assert.match(reply.result.protocolVersion, /^\d{4}-\d{2}-\d{2}$/)
  })

  // A notification has no id, so answering one would be a protocol violation.
  it('says nothing to a notification', async () => {
    assert.strictEqual(await server().handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), undefined)
    assert.strictEqual(await server().handle({ jsonrpc: '2.0', method: 'notifications/unknown' }), undefined)
  })

  it('lists registered tools', async () => {
    const reply: any = await server().handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
    assert.deepStrictEqual(reply.result.tools.map((t: any) => t.name), ['echo'])
  })

  it('calls a tool with its arguments', async () => {
    const reply: any = await server().handle({
      jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'echo', arguments: { text: 'hi' } }
    })
    assert.deepStrictEqual(reply.result.content, [{ type: 'text', text: 'hi' }])
  })

  it('reports an unknown tool as an error, not a crash', async () => {
    const reply: any = await server().handle({
      jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'nope' }
    })
    assert.strictEqual(reply.error.code, -32601)
  })

  it('turns a throwing tool into an internal error', async () => {
    const mcp = new McpStdioServer({ name: 'esbmc', version: '0.1.0' })
    mcp.tool({ name: 'bad', title: 'Bad', description: '', inputSchema: {} }, async () => { throw Error('boom') })
    const reply: any = await mcp.handle({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'bad' } })
    assert.strictEqual(reply.error.code, -32603)
    assert.match(reply.error.message, /boom/)
  })

  it('rejects an unknown request but not an unknown notification', async () => {
    const reply: any = await server().handle({ jsonrpc: '2.0', id: 6, method: 'nope' })
    assert.strictEqual(reply.error.code, -32601)
  })

  it('answers ping', async () => {
    const reply: any = await server().handle({ jsonrpc: '2.0', id: 7, method: 'ping' })
    assert.deepStrictEqual(reply.result, {})
  })
})
