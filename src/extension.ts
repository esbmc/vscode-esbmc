/* eslint-disable require-jsdoc */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { registerCommands } from './commands/registerCommands';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "vscode-esbmc" is now active!');
  // Register Commands
  context.subscriptions.push(...registerCommands());
}

// this method is called when your extension is deactivated
export function deactivate() {}
