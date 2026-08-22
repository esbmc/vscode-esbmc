import * as path from 'path'

const ASSETS: Record<string, string> = {
  linux: 'esbmc-linux.zip',
  darwin: 'esbmc-macos.zip',
  win32: 'esbmc-windows.zip'
}

export function isSupportedPlatform (platform: string): boolean {
  return platform in ASSETS
}

/** The release asset ESBMC publishes for a platform. */
export function assetForPlatform (platform: string): string {
  const asset = ASSETS[platform]
  if (asset === undefined) {
    throw Error(`ESBMC publishes no build for ${platform}`)
  }
  return asset
}

export function binaryName (platform: string): string {
  return platform === 'win32' ? 'esbmc.exe' : 'esbmc'
}

/**
 * Where the binary ends up inside the install directory.
 *
 * The archives keep it in `bin/`, alongside `libz3.dll` on Windows, so the
 * whole directory is kept rather than the binary lifted out of it.
 */
export function binaryPath (installDir: string, platform: string): string {
  return path.join(installDir, 'bin', binaryName(platform))
}

export interface Command {
  file: string
  args: string[]
}

/**
 * Unpacks a zip, since Windows has no `unzip`.
 *
 * Returned as a program and its arguments rather than a command line: run
 * through a shell, `cmd.exe` would substitute `%VAR%` in a storage path
 * before PowerShell ever saw it. PowerShell single-quoted strings still
 * escape a quote by doubling it, since -Command takes one script.
 */
export function extractCommand (zip: string, destination: string, platform: string): Command {
  if (platform === 'win32') {
    const literal = (value: string) => `'${value.replace(/'/g, "''")}'`
    return {
      file: 'powershell',
      args: [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -Force -LiteralPath ${literal(zip)} -DestinationPath ${literal(destination)}`
      ]
    }
  }
  return { file: 'unzip', args: ['-o', zip, '-d', destination] }
}
