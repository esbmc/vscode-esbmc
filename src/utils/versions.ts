import { runShellCommand } from './commands'
import { resolveRedirect } from './http'
import { resolveEsbmcCommand } from './esbmcPath'

// The latest release redirects to its own tag, so the tag is the version.
export async function getLatestVersion (): Promise<string | undefined> {
  try {
    const landed = await resolveRedirect('https://github.com/esbmc/esbmc/releases/latest')
    return landed.split('/').pop()?.replace('v', '')
  } catch {
    // Unreachable host or an unresolved redirect. Callers report this as
    // "could not fetch latest version"; a url read as a version would reach
    // compare() and throw there instead.
    return undefined
  }
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
