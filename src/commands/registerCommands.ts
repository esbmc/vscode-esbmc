import { commands, Disposable, ExtensionContext } from 'vscode'
import { run } from './run/run'
import { install } from './installation/install'
import { ConfigurationParser } from '../parsers/configParser'

// eslint-disable-next-line require-jsdoc
export function registerCommands (context: ExtensionContext): Disposable[] {
  return [
    commands.registerCommand('vscode-esbmc.runESBMC', async () => run(new ConfigurationParser())),
    commands.registerCommand('vscode-esbmc.installESBMC', async () => install(context))
  ]
}
