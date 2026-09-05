/* eslint-disable require-jsdoc */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import { registerCodeLens } from './codelens/registerCodeLense'
import { registerCommands } from './commands/registerCommands'
import { explainWithAi } from './commands/aiExplain'
import { registerChatParticipant } from './chat/participant'
import { disposeAiState } from './ai/backend'
import { disposeRunState, isSupported, run } from './commands/run'
import { setStorageRoot } from './utils/esbmcPath'

// Autosave can fire every second or so, and a verification run is far from
// free, so saves are coalesced rather than queued.
const SAVE_DEBOUNCE_MS = 500

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate (context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "vscode-esbmc" is now active!')
  setStorageRoot(context.globalStorageUri.fsPath)
  // Register Commands
  context.subscriptions.push(...registerCommands(context))
  context.subscriptions.push(...registerCodeLens())
  context.subscriptions.push(vscode.commands.registerCommand('vscode-esbmc.verify.file.withAI', explainWithAi))
  context.subscriptions.push(registerChatParticipant(context))

  let saveTimer: ReturnType<typeof setTimeout> | undefined
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(document => {
    const enabled = vscode.workspace.getConfiguration('esbmc.editor').get<boolean>('verifyOnSave', false)
    if (!enabled || !isSupported(document)) {
      return
    }
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      run(undefined, undefined, document).catch(error => {
        vscode.window.showErrorMessage(`ESBMC: ${String(error)}`)
      })
    }, SAVE_DEBOUNCE_MS)
  }))

  context.subscriptions.push({
    dispose: () => {
      clearTimeout(saveTimer)
      disposeRunState()
      disposeAiState()
    }
  })
}

// this method is called when your extension is deactivated
export function deactivate () {}
