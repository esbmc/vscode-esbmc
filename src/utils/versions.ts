import { Request, default as fetch } from 'node-fetch'
import { runShellCommand } from './commands'
import { resolveEsbmcCommand } from './esbmcPath'

export async function getLatestVersion () {
  const request = new Request('https://github.com/esbmc/esbmc/releases/latest')
  const response = await fetch(request)
  const redirUrl = response.url
  return redirUrl.split('/').pop()?.replace('v', '')
}

export async function getInstalledVersion (): Promise<string | undefined> {
  const esbmc = await resolveEsbmcCommand()
  if (esbmc === undefined) {
    return undefined
  }
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
