import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { quoteShellArg, runShellCommand, splitShellArgs } from './utils/commands'
import { resolveEsbmcCommand } from './utils/esbmcPath'
import { EsbmcFinding, parseSarif, resolveFindingPaths } from './parsers/sarifParser'
import { TraceStep, parseGraphmlWitness, resolveTracePaths } from './parsers/witnessParser'
import { Verdict, classifyVerdict } from './parsers/verdict'

export interface VerifyOptions {
  /** Extra ESBMC flags, already joined as a command line. */
  flags?: string
  /** Kill the run after this long; 0 waits indefinitely. */
  timeoutSeconds?: number
  /** Receives a kill function as soon as ESBMC starts. */
  onStart?: (kill: () => void) => void
}

export interface VerifyResult {
  verdict: Verdict
  findings: EsbmcFinding[]
  trace: TraceStep[]
  /** Both ESBMC streams joined; its verdict goes to stderr. */
  transcript: string
  command: string
}

export class EsbmcNotFoundError extends Error {
  public constructor () {
    super('ESBMC not found')
  }
}

function readIfPresent<T> (file: string, parse: (text: string) => T, fallback: T): T {
  if (!fs.existsSync(file)) {
    return fallback
  }
  try {
    return parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

/**
 * Runs ESBMC over one file and reports what it found.
 *
 * Deliberately free of any VS Code import: the editor commands and the MCP
 * server are both callers, and only one of them runs inside VS Code.
 *
 * @throws EsbmcNotFoundError when ESBMC is not installed anywhere.
 */
export async function verifyFile (file: string, options: VerifyOptions = {}): Promise<VerifyResult> {
  const esbmc = await resolveEsbmcCommand()
  if (esbmc === undefined) {
    throw new EsbmcNotFoundError()
  }

  const timeoutSeconds = Number.isFinite(options.timeoutSeconds)
    ? Math.max(0, options.timeoutSeconds as number)
    : 60
  const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esbmc-'))
  const report = path.join(reportDir, 'result.sarif')
  const witness = path.join(reportDir, 'witness.graphml')

  try {
    // Flags reach here from agent input through the MCP verify tool, and the
    // command is handed to a shell, so every token is quoted as a literal.
    const flags = splitShellArgs(options.flags ?? '').map(flag => quoteShellArg(flag))
    const command = [
      esbmc,
      quoteShellArg(file),
      ...flags,
      '--sarif-output',
      quoteShellArg(report),
      '--witness-output-graphml',
      quoteShellArg(witness)
    ].join(' ')

    const run = await runShellCommand(command, {
      timeoutMs: timeoutSeconds * 1000,
      onStart: options.onStart
    })

    const findings = run.timedOut
      ? []
      : resolveFindingPaths(readIfPresent(report, parseSarif, []), path.dirname(file))
    // Same concern as the findings above: ESBMC emits paths relative to where
    // it ran, so an unresolved trace step points at a file that does not exist
    // — for the editor's trace view and for an agent reading it over MCP.
    const trace = run.timedOut
      ? []
      : resolveTracePaths(readIfPresent(witness, parseGraphmlWitness, []), path.dirname(file))
    const transcript = run.stdout + run.stderr

    return {
      verdict: classifyVerdict({ transcript, findings, timedOut: run.timedOut, timeoutSeconds }),
      findings,
      trace,
      transcript,
      command
    }
  } finally {
    fs.rmSync(reportDir, { recursive: true, force: true })
  }
}
