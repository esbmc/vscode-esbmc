import * as fs from 'fs'
import * as path from 'path'
import { McpStdioServer } from './protocol'
import { EsbmcNotFoundError, verifyFile } from '../verify'
import { describeText } from '../report'

// out/mcp/server.js -> the extension root. The server runs outside VS Code, so
// there is no extension context to read the manifest from.
const MANIFEST = path.join(__dirname, '..', '..', 'package.json')

export function serverVersion (): string {
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).version
}

export function createServer (): McpStdioServer {
  const server = new McpStdioServer({ name: 'esbmc', version: serverVersion() })

  server.tool(
    {
      name: 'verify',
      title: 'Verify with ESBMC',
      description:
        'Run ESBMC, a bounded model checker, over a C, C++, Python or Solidity file. ' +
        'Reports each violated property with its location, and a counterexample trace ' +
        'with the variable values that reach it. A successful result means no execution ' +
        'violates the checked properties, not merely that none was found.',
      inputSchema: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'Absolute path to the file to verify' },
          flags: { type: 'string', description: 'Extra ESBMC flags, for example --unwind 10 --overflow-check' },
          timeoutSeconds: { type: 'number', description: 'Kill the run after this long, 0 waits indefinitely' }
        },
        required: ['file']
      }
    },
    async ({ file, flags, timeoutSeconds }) => {
      if (typeof file !== 'string' || file === '') {
        return { isError: true, content: [{ type: 'text' as const, text: 'verify needs a file path' }] }
      }
      try {
        const result = await verifyFile(file, { flags, timeoutSeconds })
        return { content: [{ type: 'text' as const, text: describeText(file, result) }] }
      } catch (error) {
        const message = error instanceof EsbmcNotFoundError
          ? 'ESBMC is not installed. Install it from https://github.com/esbmc/esbmc/releases or through the VS Code extension.'
          : `Could not verify ${file}: ${String(error)}`
        return { isError: true, content: [{ type: 'text' as const, text: message }] }
      }
    }
  )

  return server
}
