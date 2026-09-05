import * as vscode from 'vscode'
import { postJson } from '../utils/http'

/**
 * @param timeoutMs how long to wait for a reply. Ollama is asked with
 * `stream: false`, so it sends nothing until the whole answer is generated
 * and this covers the generation rather than an idle socket.
 */
export async function callOllama (prompt: string, timeoutMs?: number): Promise<string> {
  const cfg = vscode.workspace.getConfiguration('esbmc.ai')
  const host = cfg.get<string>('host', 'http://localhost:11434')
  const model = cfg.get<string>('model', 'llama3.1:8b')

  const res = await postJson(`${host}/api/generate`, { model, prompt, stream: false }, timeoutMs)

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status}`)
  }

  const data = JSON.parse(res.body)
  return data.response ?? 'No AI response received'
}
