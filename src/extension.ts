/* eslint-disable require-jsdoc */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import { registerCodeLens } from './codelens/registerCodeLense'
import { registerCommands } from './commands/registerCommands'
import { verifyWithAI } from './commands/aiExplain'
import { disposeRunState, isSupported, run } from './commands/run'

// Autosave can fire every second or so, and a verification run is far from
// free, so saves are coalesced rather than queued.
const SAVE_DEBOUNCE_MS = 500

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate (context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "vscode-esbmc" is now active!')
  // Register Commands
  context.subscriptions.push(...registerCommands(context))
  context.subscriptions.push(...registerCodeLens())
  const aiCommand = vscode.commands.registerCommand('vscode-esbmc.verify.file.withAI', verifyWithAI)
  context.subscriptions.push(aiCommand)

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
    }
  })
}

// this method is called when your extension is deactivated
export function deactivate () {}
