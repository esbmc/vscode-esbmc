import { commands, Disposable, ExtensionContext } from 'vscode'
import { run, runFromCommand } from './run'
import { install, update } from './installation'

export function registerCommands (context: ExtensionContext): Disposable[] {
  return [
    commands.registerCommand('vscode-esbmc.verify.file', async () => run()),
    commands.registerCommand('vscode-esbmc.verify.function', async () => runFromCommand()),
    commands.registerCommand('vscode-esbmc.verify.function.codelens', async (overrides, commentFlags) => run(overrides, commentFlags)),
    commands.registerCommand('vscode-esbmc.install', async () => install(context)),
    commands.registerCommand('vscode-esbmc.update', async () => update(context))
  ]
}
