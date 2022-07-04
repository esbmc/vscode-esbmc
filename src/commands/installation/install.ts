import * as vscode from 'vscode';
import { getApi, FileDownloader } from "@microsoft/vscode-file-downloader-api";
import { getLatestVersion } from './getLatestVersion';


export async function install(context: vscode.ExtensionContext) {
    const fileDownloader: FileDownloader = await getApi();
    var downloadingStatusIcon = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    downloadingStatusIcon.text = `$(loading~spin) Installing ESBMC `;
    downloadingStatusIcon.show();
    const file: vscode.Uri = await fileDownloader.downloadFile(
        vscode.Uri.parse('https://github.com/esbmc/esbmc/releases/latest/download/ESBMC-Linux.sh'),
        'ESBMC-Linux.sh',
        context
    );
    if(file === undefined) {
        vscode.window.showErrorMessage("Could not download ESBMC");
    }
    
    const filePath = file.fsPath;
    const makeExecCommand = `chmod +x ${filePath}`;
    const setupInstallLocationCommand = `mkdir $HOME/bin/esbmc-folder`;
    const installCommand = `${filePath} --skip-license --prefix=$HOME/bin/esbmc-folder`;
    // TODO Ask if possibility to add a --just-binary flag to speed this process and make it safer
    const moveCommand = `mv $HOME/bin/esbmc-folder/bin/esbmc $HOME/bin`;
    const cleanupCommand = `rm -rf $HOME/bin/esbmc-folder`;
    const terminal = vscode.window.createTerminal("ESBMC");
    terminal.sendText(makeExecCommand);
    terminal.sendText(setupInstallLocationCommand);
    terminal.sendText(installCommand);
    terminal.sendText(moveCommand);
    terminal.sendText(cleanupCommand);
    terminal.dispose()
    downloadingStatusIcon.hide();
    const version = getLatestVersion();
    vscode.window.showInformationMessage(`Installed ESBMC ${version}`);
}