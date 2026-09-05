import * as fs from 'fs'
import * as vscode from 'vscode'
import { AiUnavailableError, aiEnabled, backendLabel, configuredBackend, respond } from '../ai/backend'
import { esbmcOutput as output } from '../utils/output'
import { run } from './run'

/**
 * Verifies the active file and asks the configured backend about the result.
 *
 * The chat participant is the richer surface for this, but it only exists
 * where a chat provider does; this command is the one that works everywhere.
 */
export async function explainWithAi (): Promise<void> {
  const editor = vscode.window.activeTextEditor
  if (editor === undefined) {
    vscode.window.showErrorMessage('ESBMC: No file open, not checking')
    return
  }

  const result = await run(undefined, undefined, editor.document)
  if (result === undefined) {
    return
  }

  const channel = output()
  if (!aiEnabled()) {
    channel.appendLine('\nESBMC: AI explanation is off (esbmc.ai.enabled)')
    return
  }
  if (result.verdict.kind === 'success') {
    channel.appendLine('\nESBMC: verification succeeded, so there is no counterexample to explain')
    return
  }

  const backend = configuredBackend()
  channel.appendLine(`\nESBMC: asking ${backendLabel(backend)}\n`)
  try {
    const file = editor.document.fileName
    const answer = respond({
      file,
      // What ESBMC read, which is the file on disk rather than the buffer.
      source: fs.readFileSync(file, 'utf8'),
      result,
      task: 'explain'
    }, backend)
    for await (const chunk of answer) {
      channel.append(chunk)
    }
    channel.appendLine('')
  } catch (error) {
    const message = error instanceof AiUnavailableError ? error.message : `ESBMC: ${String(error)}`
    channel.appendLine(`\n${message}`)
    vscode.window.showErrorMessage(message)
  }
}
