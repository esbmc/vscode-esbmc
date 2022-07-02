import * as vscode from 'vscode';
import { ConfigurationParser } from '../../parsers/configParser';

const SUPPORTED_EXTENSIONS = new Set(['c', 'cpp', 'sol', 'jimple']);

export async function run(configurationParser:ConfigurationParser):Promise<void> {
    const activeTextEditor = vscode.window.activeTextEditor;
    if( activeTextEditor !== undefined ) {
        const currentlyOpenTabfilePath = activeTextEditor.document.fileName;
        const fileExt = getFileExtension(currentlyOpenTabfilePath);
        if(fileExt === undefined) {
            vscode.window.showErrorMessage("ESBMC: Cannot determine file type, not checking");
            return;
        }
        if( SUPPORTED_EXTENSIONS.has(fileExt!) ) {
            const flags = configurationParser.parse();
            console.log(flags);
            const cmd = `esbmc ${currentlyOpenTabfilePath} ${flags}`;
            const terminal = vscode.window.createTerminal("ESBMC");
            terminal.show();
            terminal.sendText(cmd);
        } else {
            vscode.window.showErrorMessage(`ESBMC: Currently no support for .${fileExt}, not checking`);
        }
    } else {
        vscode.window.showErrorMessage("ESBMC: No file open, not checking");
    }
}

function getFileExtension(file:string): string | undefined {
    const fileExt = file.split('.').pop();
    // If there is no file extension this holds
    if (fileExt == file)
        return undefined;
    return fileExt;
}