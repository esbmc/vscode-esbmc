import * as vscode from 'vscode'
import * as os from 'os'
import * as path from 'path'
import { executeShellCommand, quoteShellArg, runShellCommand } from '../utils/commands'
import { callOllama } from '../ai/ollamaClient'
import { editorTimeoutSeconds } from './run'

export async function verifyWithAI (): Promise<void> {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    vscode.window.showErrorMessage('No active file.')
    return
  }

  const filePath = editor.document.fileName
  const code = editor.document.getText()
  if (!code.trim()) {
    vscode.window.showErrorMessage('File is empty.')
    return
  }

  const channel = vscode.window.createOutputChannel('ESBMC + AI')
  channel.clear()
  channel.show(true)

  // Try ESBMC, fallback to $HOME/bin
  let esbmcCmd = 'esbmc'
  let cmd: string
  try {
    try {
      await executeShellCommand('esbmc --version')
    } catch {
      esbmcCmd = quoteShellArg(path.join(os.homedir(), 'bin', 'esbmc'))
    }
    cmd = `${esbmcCmd} ${quoteShellArg(filePath)}`
  } catch (error) {
    channel.appendLine(`ESBMC: ${String(error)}`)
    vscode.window.showErrorMessage(`ESBMC: ${String(error)}`)
    return
  }

  // ESBMC prints its verdict on stderr and exits non-zero on a violation, so
  // both streams are kept and a non-zero exit is a result, not an error.
  // Bounded by the same setting a normal run uses: without it a
  // non-terminating program leaves this waiting forever.
  const timeoutSeconds = editorTimeoutSeconds()
  const result = await runShellCommand(cmd, { timeoutMs: timeoutSeconds * 1000 })
  if (result.timedOut) {
    channel.appendLine(`\n[INFO] ESBMC was killed after ${timeoutSeconds}s (esbmc.editor.timeout)\n`)
    return
  }
  const esbmcOutput = result.stdout + result.stderr

  channel.appendLine('=== ESBMC Output ===\n')
  channel.appendLine(esbmcOutput.trim())

  // Only call AI if ESBMC found a violation
  const normalizedOutput = esbmcOutput.toUpperCase()
  if (!normalizedOutput.includes('VERIFICATION FAILED')) {
    channel.appendLine('\n[INFO] ESBMC verification successful (no failing properties). Skipping AI analysis.\n')
    return
  }

  const cfg = vscode.workspace.getConfiguration('esbmc.ai')
  const enabled = cfg.get<boolean>('enabled', true)

  if (!enabled) {
    channel.appendLine('\n[AI disabled: esbmc.ai.enabled = false]')
    return
  }

  const prompt = `
You are an expert in formal verification using ESBMC.

Analyze the code and its verification report, and provide a concise explanation following exactly this structure:

1) Issue Found:
- Identify the vulnerability or formal verification failure.
- Mention the violated property if applicable.

2) Fixed Code:
- Provide a corrected version of the full C code.
- Use a \`\`\`c fenced code block.
- Keep the original logic whenever possible.

3) Why This Fix Works:
- Brief technical explanation describing the root cause.
- Show how the fix prevents the issue found by ESBMC.

If ESBMC reports no violations, explicitly state that the program is safe and do not propose any code changes.

--------------------------
C Source Code:
\`\`\`c
${code}
\`\`\`

ESBMC Report:
\`\`\`text
${esbmcOutput}
\`\`\`

Respond in English only.
`.trim()

  channel.appendLine('\n=== AI Analysis (processing...) ===\n')
  let aiResponse: string
  try {
    aiResponse = await callOllama(prompt)
    channel.appendLine('\n=== AI Analysis (completed) ===\n')
    channel.appendLine(aiResponse.trim())
  } catch (err: any) {
    channel.appendLine('\n[ERROR] Could not contact local AI.')
    channel.appendLine(`\n[ERROR DETAILS]\n${err}\n`)
    vscode.window.showErrorMessage('Local AI unavailable. Ensure Ollama is installed and running (ollama serve).')
  }
}
