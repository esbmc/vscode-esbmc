import { commands, Disposable, ExtensionContext } from 'vscode'
import { run } from './run'
import { install, update } from './installation'
import { ConfigurationParser } from '../parsers/configParser'

// eslint-disable-next-line require-jsdoc
export function registerCommands (context: ExtensionContext): Disposable[] {
  return [
    commands.registerCommand('vscode-esbmc.verify', async () => run(new ConfigurationParser())),
    commands.registerCommand('vscode-esbmc.install', async () => install(context)),
    commands.registerCommand('vscode-esbmc.update', async () => update(context))
  ]
}
