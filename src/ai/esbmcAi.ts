import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { runProcess } from '../utils/commands'

export interface EsbmcAiOptions {
  /** The executable, from `esbmc.ai.esbmcAi.path`. */
  binary: string
  file: string
  /** Where ESBMC-AI is asked to write its JSON result. */
  jsonPath: string
  /** `--ai-model`; omitted when empty, since ESBMC-AI rejects an empty one. */
  model?: string
  /** `--config-file`; omitted when empty, leaving ESBMCAI_CONFIG_FILE to decide. */
  configFile?: string
}

export interface FixResult {
  successful: boolean
  attempts: number
  repairedSource?: string
}

export class EsbmcAiNotFoundError extends Error {
  public constructor (binary: string) {
    super(`${binary} not found`)
  }
}

/** ESBMC-AI exited without a result its caller can act on. */
export class EsbmcAiFailedError extends Error {}

export function esbmcAiArgs (options: EsbmcAiOptions): string[] {
  // --json makes it serialise the result at all; --json-path also writes it to
  // a file, which is what is read back. Its stdout carries a banner and a
  // structlog stream around the same JSON.
  const args = ['fix-code', options.file, '--json', '--json-path', options.jsonPath]
  if (options.model !== undefined && options.model !== '') {
    args.push('--ai-model', options.model)
  }
  if (options.configFile !== undefined && options.configFile !== '') {
    args.push('--config-file', options.configFile)
  }
  return args
}

function toFixResult (parsed: Record<string, unknown>): FixResult {
  if (typeof parsed.successful !== 'boolean' || typeof parsed.attempts !== 'number') {
    throw new EsbmcAiFailedError(
      'ESBMC-AI returned JSON without the expected "successful" and "attempts" fields'
    )
  }
  return {
    successful: parsed.successful,
    attempts: parsed.attempts,
    repairedSource: typeof parsed.repaired_source === 'string' ? parsed.repaired_source : undefined
  }
}

/**
 * Reads the result out of ESBMC-AI's stdout.
 *
 * The fallback for an installation whose `--json-path` wrote nothing. ESBMC-AI
 * re-serialises the result without indentation before printing it, so it is
 * the last single line that parses; structlog emits JSON lines of its own
 * ahead of it, and the repaired program is printed unquoted before that.
 */
export function parseFixResult (stdout: string): FixResult {
  const lines = stdout.split('\n')
  for (let index = lines.length - 1; index >= 0; index--) {
    let parsed: unknown
    try {
      parsed = JSON.parse(lines[index])
    } catch {
      continue
    }
    if (typeof parsed === 'object' && parsed !== null && 'successful' in parsed) {
      return toFixResult(parsed as Record<string, unknown>)
    }
  }
  throw new EsbmcAiFailedError('ESBMC-AI printed no JSON result')
}

/**
 * The result ESBMC-AI wrote to `--json-path`, or undefined to fall back to
 * stdout. A run killed mid-write leaves the file truncated, and stdout may
 * still carry the whole result.
 *
 * @throws EsbmcAiFailedError when the file parses but no longer has the
 * fields a repair is read from, which stdout would not fix.
 */
function readJsonResult (jsonPath: string): FixResult | undefined {
  if (!fs.existsSync(jsonPath)) {
    return undefined
  }
  try {
    return toFixResult(JSON.parse(fs.readFileSync(jsonPath, 'utf8')))
  } catch (error) {
    if (error instanceof EsbmcAiFailedError) {
      throw error
    }
    return undefined
  }
}

/** The end of a failed run, which is where the reason for it is. */
function tail (text: string, lines = 10): string {
  return text.trimEnd().split('\n').slice(-lines).join('\n')
}

/**
 * Runs ESBMC-AI over one file and reports the repair it reached.
 *
 * Deliberately free of any VS Code import, so the argument construction and
 * the result parsing can be exercised without the editor.
 *
 * @throws EsbmcAiNotFoundError when the executable is not installed.
 * @throws EsbmcAiFailedError when it produced no result to report.
 */
export async function runEsbmcAi (
  options: Omit<EsbmcAiOptions, 'jsonPath'> & {
    timeoutSeconds: number
    onStart?: (kill: () => void) => void
  }
): Promise<FixResult> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'esbmc-ai-'))
  const jsonPath = path.join(dir, 'result.json')
  try {
    const run = await runProcess(options.binary, esbmcAiArgs({ ...options, jsonPath }), {
      timeoutMs: options.timeoutSeconds * 1000,
      onStart: options.onStart
    })

    if (run.timedOut) {
      throw new EsbmcAiFailedError(
        `ESBMC-AI was killed after ${options.timeoutSeconds}s (esbmc.ai.timeout)`
      )
    }
    // runProcess reports a failure to spawn as a null exit code with the error
    // appended to stderr, rather than rejecting.
    if (run.code === null && /ENOENT/.test(run.stderr)) {
      throw new EsbmcAiNotFoundError(options.binary)
    }
    const written = readJsonResult(jsonPath)
    if (written !== undefined) {
      return written
    }
    try {
      return parseFixResult(run.stdout)
    } catch {
      throw new EsbmcAiFailedError(
        `ESBMC-AI exited with no result (code ${String(run.code)}):\n${tail(run.stderr + run.stdout)}`
      )
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
