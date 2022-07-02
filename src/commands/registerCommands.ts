import { commands, Disposable } from 'vscode';
import { run } from "./run/run";
import { ConfigurationParser } from '../parsers/configParser';

// eslint-disable-next-line require-jsdoc
export function registerCommands(): Disposable[] {
    var configurationParser = new ConfigurationParser();
    return [
        commands.registerCommand("vscode-esbmc.runESBMC", async () => run(configurationParser))
    ];
}