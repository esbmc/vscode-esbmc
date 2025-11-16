import * as vscode from 'vscode'
import { getApi, FileDownloader } from '@microsoft/vscode-file-downloader-api'
import { getInstalledVersion, getLatestVersion } from '../utils/versions'
import { executeShellCommand } from '../utils/commands'
import { compare } from 'compare-versions'

// Only want one of this running at a time
let LOCK = false

export async function install (context: vscode.ExtensionContext) {
  if (LOCK) {
    return
  }
  LOCK = true
  let installedVersion = await getInstalledVersion()
  if (installedVersion === undefined) {
    const { file, downloadingStatusIcon }: { file: vscode.Uri; downloadingStatusIcon: vscode.StatusBarItem } = await downloadEsbmc(context)
    if (file === undefined) {
      vscode.window.showErrorMessage('Could not download ESBMC')
      LOCK = false
      return
    }
    const filePath = file.fsPath
    const installed = await installFile(filePath)
    if (!installed) { return }
    downloadingStatusIcon.hide()
    // Check that it has effectively installed
    installedVersion = await getInstalledVersion()
    if (installedVersion !== undefined) {
      vscode.window.showInformationMessage(`Installed ESBMC ${installedVersion}`)
    } else {
      vscode.window.showInformationMessage('Could not install ESBMC, see terminal for output')
    }
  } else {
    vscode.window.showInformationMessage(`ESBMC ${installedVersion} already installed, try esbmc.update to get the latest version`)
  }
  LOCK = false
}

export async function update (context: vscode.ExtensionContext) {
  if (LOCK) {
    return
  }
  LOCK = true
  const installedVersion = await getInstalledVersion()
  const latestVersion = await getLatestVersion()
  if (installedVersion === undefined) {
    vscode.window.showInformationMessage('ESBMC is not installed try running esbmc.install')
    LOCK = false
    return
  }
  if (latestVersion === undefined) {
    vscode.window.showInformationMessage('ESBMC could not fetch latest version')
    LOCK = false
    return
  }
  if (compare(latestVersion, installedVersion, '>')) {
    const { file, downloadingStatusIcon }: { file: vscode.Uri; downloadingStatusIcon: vscode.StatusBarItem } = await downloadEsbmc(context)
    if (file === undefined) {
      vscode.window.showErrorMessage('Could not download ESBMC')
      LOCK = false
      return
    }
    const filePath = file.fsPath
    const installed = await installFile(filePath)
    if (!installed) { return }
    downloadingStatusIcon.hide()
    const deleteOldCommand = 'rm $HOME/bin/esbmc.old'
    const reinstateOldCommand = 'mv $HOME/bin/esbmc.old $HOME/bin/esbmc'
    // Check that it has effectively installed
    const installedVersion = await getInstalledVersion()
    if (installedVersion !== undefined) {
      await executeShellCommand(deleteOldCommand)
      vscode.window.showInformationMessage(`Updated ESBMC to ${installedVersion}`)
    } else {
      await executeShellCommand(reinstateOldCommand)
      vscode.window.showInformationMessage('Could not update ESBMC, see terminal for output')
    }
  } else {
    vscode.window.showInformationMessage('ESBMC is up-to-date')
  }
  LOCK = false
}
async function downloadEsbmc (context: vscode.ExtensionContext) {
  const fileDownloader: FileDownloader = await getApi()
  const downloadingStatusIcon = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0)
  downloadingStatusIcon.text = '$(loading~spin) Installing ESBMC '
  downloadingStatusIcon.show()
  const file: vscode.Uri = await fileDownloader.downloadFile(
    vscode.Uri.parse('https://github.com/esbmc/esbmc/releases/latest/download/ESBMC-Linux.zip'),
    'ESBMC-Linux.zip',
    context
  )
  return { file, downloadingStatusIcon }
}

async function installFile (filePath: string) {
  let out
  const setupBinDirCommand = 'mkdir -p "$HOME/bin"'
  const renameOldCommand = 'if [ -f "$HOME/bin/esbmc" ]; then mv "$HOME/bin/esbmc" "$HOME/bin/esbmc.old"; fi'
  const setupInstallLocationCommand = 'rm -rf "$HOME/bin/esbmc-folder" && mkdir -p "$HOME/bin/esbmc-folder"'
  const unzipCommand = `unzip -o "${filePath}" -d "$HOME/bin/esbmc-folder"`
  const moveCommand = 'mv "$HOME/bin/esbmc-folder/bin/esbmc" "$HOME/bin/esbmc"'
  const chmodCommand = 'chmod +x "$HOME/bin/esbmc"'
  const cleanupCommand = `rm -rf "$HOME/bin/esbmc-folder" "${filePath}"`

  try {
    out = await executeShellCommand(setupBinDirCommand)
    out = await executeShellCommand(renameOldCommand)
    out = await executeShellCommand(setupInstallLocationCommand)
    out = await executeShellCommand(unzipCommand)
    out = await executeShellCommand(moveCommand)
    out = await executeShellCommand(chmodCommand)
    out = await executeShellCommand(cleanupCommand)
  } catch (error) {
    vscode.window.showInformationMessage(`Could not update ESBMC\n ${out}`)
    return false
  }
  return true
}
