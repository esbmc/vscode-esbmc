import * as vscode from 'vscode'
import fetch from 'node-fetch'

export async function callOllama (prompt: string): Promise<string> {
  const cfg = vscode.workspace.getConfiguration('esbmc.ai')
  const host = cfg.get<string>('host', 'http://localhost:11434')
  const model = cfg.get<string>('model', 'llama3.1:8b')

  const res = await fetch(`${host}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false })
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)

  const data = await res.json()
  return data.response ?? 'No AI response received'
}
