import { commands, Disposable } from 'vscode';
import { run } from "./run/run";

// eslint-disable-next-line require-jsdoc
export function registerCommands(): Disposable[] {
    return [
        commands.registerCommand("vscode-esbmc.runESBMC", async () => run())
    ];
}