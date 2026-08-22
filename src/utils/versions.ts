import { runShellCommand } from './commands'
import { resolveRedirect } from './http'
import { resolveEsbmcCommand } from './esbmcPath'

// The latest release redirects to its own tag, so the tag is the version.
export async function getLatestVersion (): Promise<string | undefined> {
  const landed = await resolveRedirect('https://github.com/esbmc/esbmc/releases/latest')
  return landed.split('/').pop()?.replace('v', '')
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
