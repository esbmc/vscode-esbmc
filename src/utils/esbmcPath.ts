import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { executeShellCommand, quoteShellArg } from './commands'
import { binaryName, binaryPath } from './platform'

let storageRoot: string | undefined

/** Called once at activation, since only the extension context knows this. */
export function setStorageRoot (root: string): void {
  storageRoot = root
}

export function installDir (): string | undefined {
  return storageRoot === undefined ? undefined : path.join(storageRoot, 'esbmc')
}

/** Where the auto-installer puts ESBMC, if the extension has been activated. */
export function installedBinary (platform: string = process.platform): string | undefined {
  const dir = installDir()
  return dir === undefined ? undefined : binaryPath(dir, platform)
}

/** Where releases before the cross-platform installer put it. */
export function legacyBinary (platform: string = process.platform): string {
  return path.join(os.homedir(), 'bin', binaryName(platform))
}

/** Where the ESBMC that will run came from. Only `installed` is ours to replace. */
export type EsbmcSource = 'path' | 'installed' | 'legacy'

export interface ResolvedEsbmc {
  /** Already quoted for a shell. */
  command: string
  source: EsbmcSource
}

/**
 * The ESBMC that will run, and where it came from.
 *
 * One resolver for the whole extension: reporting a version from one binary
 * while verifying with another is worse than not reporting one at all. A
 * user's own ESBMC wins over the one this extension installed.
 *
 * @returns undefined when ESBMC cannot be found anywhere.
 */
export async function resolveEsbmc (platform: string = process.platform): Promise<ResolvedEsbmc | undefined> {
  try {
    await executeShellCommand('esbmc --version')
    return { command: 'esbmc', source: 'path' }
  } catch {
    // Not on PATH; fall through to the locations we manage.
  }
  const candidates: Array<[string | undefined, EsbmcSource]> = [
    [installedBinary(platform), 'installed'],
    [legacyBinary(platform), 'legacy']
  ]
  for (const [candidate, source] of candidates) {
    if (candidate !== undefined && fs.existsSync(candidate)) {
      return { command: quoteShellArg(candidate), source }
    }
  }
  return undefined
}

/** @returns undefined when ESBMC cannot be found anywhere. */
export async function resolveEsbmcCommand (platform: string = process.platform): Promise<string | undefined> {
  return (await resolveEsbmc(platform))?.command
}
