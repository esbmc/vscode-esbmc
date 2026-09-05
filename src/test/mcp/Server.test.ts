import * as assert from 'assert'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'

const MAIN = path.resolve(__dirname, '..', '..', 'mcp', 'main.js')

/** Speaks just enough JSON-RPC over stdio to act as an MCP client. */
class StdioClient {
  private readonly child: ChildProcessWithoutNullStreams
  private buffer = ''
  private readonly pending: Map<number, (message: any) => void> = new Map()

  public constructor () {
    this.child = spawn(process.execPath, [MAIN], { stdio: 'pipe' })
    this.child.stdout.setEncoding('utf8')
    this.child.stdout.on('data', chunk => {
      this.buffer += chunk
      let newline = this.buffer.indexOf('\n')
      while (newline !== -1) {
        const line = this.buffer.slice(0, newline).trim()
        this.buffer = this.buffer.slice(newline + 1)
        if (line !== '') {
          const message = JSON.parse(line)
          this.pending.get(message.id)?.(message)
          this.pending.delete(message.id)
        }
        newline = this.buffer.indexOf('\n')
      }
    })
  }

  public async send (id: number, method: string, params: unknown = {}): Promise<any> {
    return new Promise(resolve => {
      this.pending.set(id, resolve)
      this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    })
  }

  public notify (method: string, params: unknown = {}): void {
    this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n')
  }

  public close (): void {
    this.child.kill()
  }
}

describe('MCP server over stdio', function () {
  this.timeout(120000)

  let client: StdioClient

  before(async () => {
    client = new StdioClient()
    await client.send(1, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '0' }
    })
    client.notify('notifications/initialized')
  })

  after(() => client?.close())

  it('introduces itself as esbmc', async () => {
    const fresh = new StdioClient()
    const reply = await fresh.send(1, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '0' }
    })
    fresh.close()
    assert.strictEqual(reply.result.serverInfo.name, 'esbmc')
  })

  it('advertises the verify tool and what it takes', async () => {
    const reply = await client.send(2, 'tools/list')
    const tool = reply.result.tools.find((t: any) => t.name === 'verify')
    assert.ok(tool, `verify not advertised in ${JSON.stringify(reply.result.tools)}`)
    assert.deepStrictEqual(Object.keys(tool.inputSchema.properties).sort(), ['file', 'flags', 'timeoutSeconds'])
    assert.deepStrictEqual(tool.inputSchema.required, ['file'])
  })

  it('reports a violation with its location', async function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'esbmc-mcp-'))
    const file = path.join(dir, 'fails.c')
    fs.writeFileSync(file, 'int main(void)\n{\n  int v[4];\n  for (int i = 0; i <= 4; i++)\n    v[i] = i;\n  return 0;\n}\n')
    try {
      const reply = await client.send(3, 'tools/call', { name: 'verify', arguments: { file } })
      const text: string = reply.result.content[0].text
      if (/not installed/.test(text)) {
        return this.skip()
      }
      assert.match(text, /VERIFICATION FAILED/)
      assert.match(text, /array bounds/)
      assert.match(text, new RegExp(`${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:5`))
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  // flags arrives verbatim from agent input and the command reaches a shell, so
  // an unquoted token would run as a command of its own. Each payload has to
  // stand alone: ESBMC's own flags follow it on the command line, and a bare
  // `; touch MARKER` would collect them as arguments and fail before creating
  // anything, hiding the very injection this pins down.
  it('runs no command hidden in the flags an agent passes', async function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'esbmc-mcp-'))
    const file = path.join(dir, 'ok.c')
    fs.writeFileSync(file, 'int main(void) { return 0; }\n')
    try {
      let id = 5
      for (const shape of ['$(touch MARKER)', '`touch MARKER`', '; touch MARKER #']) {
        const marker = path.join(dir, `pwned-${id}`)
        const reply = await client.send(id++, 'tools/call', {
          name: 'verify',
          arguments: { file, flags: shape.replace('MARKER', marker) }
        })
        if (/not installed/.test(reply.result.content[0].text)) {
          return this.skip()
        }
        assert.ok(!fs.existsSync(marker), `${shape} ran`)
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reports its version from the manifest rather than a literal', async () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'package.json'), 'utf8')
    )
    const fresh = new StdioClient()
    const reply = await fresh.send(1, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '0' }
    })
    fresh.close()
    assert.strictEqual(reply.result.serverInfo.version, manifest.version)
  })

  it('reports a missing file as a tool error rather than crashing', async () => {
    const reply = await client.send(4, 'tools/call', {
      name: 'verify',
      arguments: { file: '/nonexistent/nope.c' }
    })
    assert.ok(reply.result.isError === true || /not installed|Could not verify|FAILED|NO VERDICT/.test(reply.result.content[0].text))
  })
})
