import { Request, default as fetch } from 'node-fetch'
import { executeShellCommand } from './commands'

export async function getLatestVersion () {
  const request = new Request('https://github.com/esbmc/esbmc/releases/latest')
  const response = await fetch(request)
  const redirUrl = response.url
  return redirUrl.split('/').pop()?.replace('v', '')
}

export async function getInstalledVersion(): Promise<string | undefined> {
  let out: string | undefined = undefined;
  try {
    out = await executeShellCommand('$HOME/bin/esbmc --version 2>&1');
  } catch { /* ignore */ }
  if (!out) {
    try {
      out = await executeShellCommand('esbmc --version 2>&1');
    } catch {
      return undefined;
    }
  }
  const regex = /ESBMC version (\d+\.)?(\d+\.)?(\*|\d+)/g;
  const match = out.match(regex)?.[0];
  if (!match) return undefined;
  return match.replace('ESBMC version ', '');
}
