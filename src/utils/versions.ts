import { Request, default as fetch } from 'node-fetch'
import { executeShellCommand } from './commands'

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
