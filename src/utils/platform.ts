import * as path from 'path'
import { quoteShellArg } from './commands'

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

/**
 * A command that unpacks a zip, since Windows has no `unzip`. PowerShell
 * single-quoted strings escape a quote by doubling it.
 */
export function extractCommand (zip: string, destination: string, platform: string): string {
  if (platform === 'win32') {
    const literal = (value: string) => `'${value.replace(/'/g, "''")}'`
    return 'powershell -NoProfile -NonInteractive -Command ' +
      `"Expand-Archive -Force -LiteralPath ${literal(zip)} -DestinationPath ${literal(destination)}"`
  }
  return `unzip -o ${quoteShellArg(zip)} -d ${quoteShellArg(destination)}`
}
