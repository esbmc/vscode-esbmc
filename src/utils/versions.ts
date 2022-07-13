import { Request, default as fetch } from 'node-fetch'
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

export async function getLatestVersion () {
  const request = new Request('https://github.com/esbmc/esbmc/releases/latest')
  const response = await fetch(request)
  const redirUrl = response.url
  return redirUrl.split('/').pop()?.replace('v', '')
}

export async function getInstalledVersion (): Promise<string | undefined> {
  let out
  try {
    out = await executeShellCommand('esbmc --version')
  } catch (error) {
    return undefined
  }
  // Extract version number if binary is present
  const regex = /ESBMC version (\d+\.)?(\d+\.)?(\*|\d+)/g
  const version = out.match(regex)?.[0].replace('ESBMC version ', '')
  return version
}
