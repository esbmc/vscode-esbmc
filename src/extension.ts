/* eslint-disable require-jsdoc */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import { registerCodeLens } from './codelens/registerCodeLense'
import { registerCommands } from './commands/registerCommands'
import { verifyWithAI } from './commands/aiExplain'

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate (context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "vscode-esbmc" is now active!')
  // Register Commands
  context.subscriptions.push(...registerCommands(context))
  context.subscriptions.push(...registerCodeLens())
  const aiCommand = vscode.commands.registerCommand('vscode-esbmc.verify.file.withAI', verifyWithAI)
  context.subscriptions.push(aiCommand)
}

// this method is called when your extension is deactivated
export function deactivate () {}
