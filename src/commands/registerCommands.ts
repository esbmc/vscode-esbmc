import { commands, Disposable, ExtensionContext } from 'vscode'
import { run, showOutput } from './run'
import { install, update } from './installation'
import { openExample } from './openExample'
import { showFlags } from './showFlags'

export function registerCommands (context: ExtensionContext): Disposable[] {
  return [
    commands.registerCommand('vscode-esbmc.verify.file', async () => run()),
    commands.registerCommand('vscode-esbmc.verify.function', async (overrides, commentFlags) => run(overrides, commentFlags)),
    commands.registerCommand('vscode-esbmc.install', async () => install(context)),
    commands.registerCommand('vscode-esbmc.update', async () => update(context)),
    commands.registerCommand('vscode-esbmc.showOutput', () => showOutput()),
    commands.registerCommand('vscode-esbmc.openExample', async () => openExample(context)),
    commands.registerCommand('vscode-esbmc.showFlags', async () => showFlags())
  ]
}
