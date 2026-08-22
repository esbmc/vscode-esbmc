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

/**
 * The ESBMC command to run, already quoted for a shell.
 *
 * One resolver for the whole extension: reporting a version from one binary
 * while verifying with another is worse than not reporting one at all. A
 * user's own ESBMC wins over the one this extension installed.
 *
 * @returns undefined when ESBMC cannot be found anywhere.
 */
export async function resolveEsbmcCommand (platform: string = process.platform): Promise<string | undefined> {
  try {
    await executeShellCommand('esbmc --version')
    return 'esbmc'
  } catch {
    // Not on PATH; fall through to the locations we manage.
  }
  for (const candidate of [installedBinary(platform), legacyBinary(platform)]) {
    if (candidate !== undefined && fs.existsSync(candidate)) {
      return quoteShellArg(candidate)
    }
  }
  return undefined
}
