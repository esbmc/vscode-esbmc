import { Readable, Writable } from 'stream'

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: number | string
  method: string
  params?: any
}

export interface ToolDefinition {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface ToolResult {
  content: Array<{ type: 'text', text: string }>
  isError?: boolean
}

export interface ServerInfo {
  name: string
  version: string
}

const PROTOCOL_VERSION = '2024-11-05'
const METHOD_NOT_FOUND = -32601
const INTERNAL_ERROR = -32603

/**
 * The MCP stdio surface, which is JSON-RPC 2.0 over newline-delimited JSON.
 *
 * Written directly rather than with @modelcontextprotocol/sdk: the SDK pulls
 * an HTTP framework and a JWT library for transports a stdio server never
 * uses, which took the packaged extension from 111 files to 4096. Only three
 * methods are needed, and the tests drive them over a real pipe.
 */
interface RegisteredTool {
  definition: ToolDefinition
  call: (args: any) => Promise<ToolResult>
}

export class McpStdioServer {
  private readonly tools: Map<string, RegisteredTool> = new Map()
  private readonly info: ServerInfo

  public constructor (info: ServerInfo) {
    this.info = info
  }

  public tool (definition: ToolDefinition, call: (args: any) => Promise<ToolResult>): void {
    this.tools.set(definition.name, { definition, call })
  }

  /** @returns the reply, or undefined for a notification. */
  public async handle (request: JsonRpcRequest): Promise<object | undefined> {
    const reply = (result: object): object => ({ jsonrpc: '2.0', id: request.id, result })
    const fail = (code: number, message: string): object =>
      ({ jsonrpc: '2.0', id: request.id, error: { code, message } })

    switch (request.method) {
      case 'initialize':
        return reply({
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: this.info
        })
      case 'notifications/initialized':
        return undefined
      case 'ping':
        return reply({})
      case 'tools/list':
        return reply({ tools: [...this.tools.values()].map(entry => entry.definition) })
      case 'tools/call': {
        const tool = this.tools.get(request.params?.name)
        if (tool === undefined) {
          return fail(METHOD_NOT_FOUND, `Unknown tool: ${String(request.params?.name)}`)
        }
        try {
          return reply(await tool.call(request.params?.arguments ?? {}))
        } catch (error) {
          return fail(INTERNAL_ERROR, String(error))
        }
      }
      default:
        // A notification we do not implement needs no reply at all.
        return request.id === undefined ? undefined : fail(METHOD_NOT_FOUND, `Unknown method: ${request.method}`)
    }
  }

  /** Reads newline-delimited requests until the input closes. */
  public listen (input: Readable, output: Writable): void {
    let buffer = ''
    input.setEncoding('utf8')
    input.on('data', chunk => {
      buffer += chunk
      let newline = buffer.indexOf('\n')
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        newline = buffer.indexOf('\n')
        if (line === '') {
          continue
        }
        this.respond(line, output).catch(() => {})
      }
    })
  }

  private async respond (line: string, output: Writable): Promise<void> {
    let request: JsonRpcRequest
    try {
      request = JSON.parse(line)
    } catch {
      // A malformed line has no id to answer against, so it is dropped.
      return
    }
    const reply = await this.handle(request)
    if (reply !== undefined) {
      output.write(JSON.stringify(reply) + '\n')
    }
  }
}
