import { Request, default as fetch } from 'node-fetch'
import { runShellCommand } from './commands'
import { resolveEsbmcCommand } from './esbmcPath'

export async function getLatestVersion () {
  const request = new Request('https://github.com/esbmc/esbmc/releases/latest')
  const response = await fetch(request)
  const redirUrl = response.url
  return redirUrl.split('/').pop()?.replace('v', '')
}

/**
 * Asks one particular ESBMC for its version.
 *
 * @param esbmc the command, already quoted for a shell. Naming the binary
 * matters right after an install: the resolver would answer with whatever is
 * on PATH rather than what was just unpacked.
 */
export async function readVersion (esbmc: string): Promise<string | undefined> {
  // ESBMC prints its banner on stderr, and exits non-zero on some platforms
  // when given only --version, so both streams are kept.
  const result = await runShellCommand(`${esbmc} --version`)
  const regex = /ESBMC version (\d+\.)?(\d+\.)?(\*|\d+)/g
  const match = (result.stdout + result.stderr).match(regex)?.[0]
  if (!match) {
    return undefined
  }
  return match.replace('ESBMC version ', '')
}

export async function getInstalledVersion (): Promise<string | undefined> {
  const esbmc = await resolveEsbmcCommand()
  return esbmc === undefined ? undefined : readVersion(esbmc)
}
