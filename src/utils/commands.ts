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
