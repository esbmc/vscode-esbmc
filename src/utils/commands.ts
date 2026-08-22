import * as cp from 'child_process'

/**
 * Executes a shell command and gets output, should only be used
 * over integrated terminal API iff output is needed from the
 * command call
 *
 * @param cmd Command to execute
 * @returns The resolved output or error message
 */
export async function executeShellCommand (cmd: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    cp.exec(cmd, (err, out) => {
      if (err) {
        return reject(err.message)
      }
      return resolve(out)
    })
  })
}

/** Legal in a Windows path, and not expressible as one cmd.exe argument. */
const UNQUOTABLE_ON_WINDOWS = /["%]/

/**
 * Quotes a value so a shell treats it as one literal argument.
 *
 * Double quotes are not enough on POSIX: `$(...)` and backticks still expand
 * inside them, so a file named `$(rm -rf ~)x.c` would run its own command.
 *
 * `cmd.exe` has no command substitution, but it does expand `%VAR%` inside
 * double quotes, and a command line offers no escape for either `%` or `"`.
 * Both are legal in a Windows path, so such a value is refused: quoting it
 * anyway would run ESBMC against a different file than the one asked for.
 *
 * @throws when a Windows path cannot be expressed as one cmd.exe argument.
 */
export function quoteShellArg (value: string): string {
  if (process.platform === 'win32') {
    const unquotable = UNQUOTABLE_ON_WINDOWS.exec(value)
    if (unquotable !== null) {
      throw Error(`cmd.exe cannot be passed a path containing ${unquotable[0]}: ${value}`)
    }
    return `"${value}"`
  }
  return `'${value.replace(/'/g, "'\\''")}'`
}

export interface CommandResult {
  stdout: string
  stderr: string
  code: number | null
  timedOut: boolean
}

export interface RunOptions {
  /** Kill the command after this long; 0 waits indefinitely. */
  timeoutMs?: number
  /** Receives a kill function as soon as the command starts. */
  onStart?: (kill: () => void) => void
}

function killTree (pid: number | undefined): void {
  if (pid === undefined) { return }
  try {
    if (process.platform === 'win32') {
      cp.exec(`taskkill /pid ${pid} /T /F`)
    } else {
      process.kill(-pid, 'SIGKILL')
    }
  } catch {
    // The command finished on its own between the kill being asked for and
    // this call.
  }
}

/**
 * Runs a shell command to completion, capturing its output instead of
 * rejecting on a non-zero exit. ESBMC exits non-zero when it finds a
 * violation, which is a result rather than an error.
 */
export async function runShellCommand (cmd: string, options: RunOptions = {}): Promise<CommandResult> {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(0, options.timeoutMs as number) : 0
  return new Promise<CommandResult>(resolve => {
    // Detached so the shell leads its own process group: killing the shell
    // alone leaves the command running and its pipes open, so the run never
    // finishes.
    const detached = process.platform !== 'win32'
    const child = cp.spawn(cmd, { shell: true, detached })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false

    // Decode per stream, not per chunk: a multi-byte character split across a
    // chunk boundary would otherwise be mangled.
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')

    const timer = timeoutMs > 0
      ? setTimeout(() => {
        // Defensive: clearTimeout normally wins, but a callback already queued
        // when the command exits would otherwise signal a recycled pid.
        if (settled) { return }
        timedOut = true
        killTree(child.pid)
      }, timeoutMs)
      : undefined

    options.onStart?.(() => killTree(child.pid))

    child.stdout?.on('data', chunk => { stdout += chunk })
    child.stderr?.on('data', chunk => { stderr += chunk })
    child.on('error', error => {
      settled = true
      clearTimeout(timer)
      resolve({ stdout, stderr: stderr + String(error), code: null, timedOut })
    })
    child.on('close', code => {
      settled = true
      clearTimeout(timer)
      resolve({ stdout, stderr, code, timedOut })
    })
  })
}
