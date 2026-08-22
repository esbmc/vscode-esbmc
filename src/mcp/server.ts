import * as fs from 'fs'
import * as path from 'path'
import { McpStdioServer } from './protocol'
import { EsbmcNotFoundError, VerifyResult, verifyFile } from '../verify'

// out/mcp/server.js -> the extension root. The server runs outside VS Code, so
// there is no extension context to read the manifest from.
const MANIFEST = path.join(__dirname, '..', '..', 'package.json')

export function serverVersion (): string {
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).version
}

/** What an agent gets back, kept stable and independent of ESBMC's log format. */
export function describeResult (file: string, result: VerifyResult): string {
  const lines: string[] = []
  switch (result.verdict.kind) {
    case 'success':
      lines.push(`VERIFICATION SUCCESSFUL: ESBMC proved every checked property of ${file}.`)
      break
    case 'violations':
      lines.push(`VERIFICATION FAILED: ${result.verdict.count} property/properties violated in ${file}.`)
      break
    case 'failed-without-findings':
      lines.push(`VERIFICATION FAILED in ${file}, but ESBMC reported no property to place.`)
      break
    case 'timeout':
      lines.push(`TIMEOUT: ESBMC was killed after ${result.verdict.seconds}s on ${file}.`)
      break
    case 'unknown':
      lines.push(`NO VERDICT: ESBMC did not reach a conclusion on ${file}.`)
      break
  }

  for (const finding of result.findings) {
    const cwes = finding.cwes.length > 0 ? ` [${finding.cwes.join(', ')}]` : ''
    lines.push(`  ${finding.file}:${finding.line} ${finding.message}${cwes}`)
  }

  if (result.trace.length > 0) {
    lines.push('', 'Counterexample:')
    for (const step of result.trace) {
      const where = step.line === undefined ? '' : `${step.file ?? ''}:${step.line} `
      const what = step.assumptions.length > 0
        ? step.assumptions.join(', ')
        : step.enterFunction === undefined ? '' : `enter ${step.enterFunction}`
      if (where !== '' || what !== '') {
        lines.push(`  ${where}${what}`.trimEnd())
      }
    }
  }

  return lines.join('\n')
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
        return { content: [{ type: 'text' as const, text: describeResult(file, result) }] }
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
