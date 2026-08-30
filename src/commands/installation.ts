import * as vscode from 'vscode'
import * as fs from 'fs'
import { getApi, FileDownloader } from '@microsoft/vscode-file-downloader-api'
import { getInstalledVersion, getLatestVersion, readVersion } from '../utils/versions'
import { quoteShellArg, runProcess } from '../utils/commands'
import { assetForPlatform, binaryPath, extractCommand, isSupportedPlatform } from '../utils/platform'
import { installDir, resolveEsbmc } from '../utils/esbmcPath'
import { compare } from 'compare-versions'

// Only want one of this running at a time
let LOCK = false

async function withLock (work: () => Promise<void>): Promise<void> {
  if (LOCK) {
    return
  }
  LOCK = true
  try {
    await work()
  } finally {
    LOCK = false
  }
}

export async function install (context: vscode.ExtensionContext): Promise<void> {
  await withLock(async () => {
    const installedVersion = await getInstalledVersion()
    if (installedVersion !== undefined) {
      vscode.window.showInformationMessage(
        `ESBMC ${installedVersion} already installed, try esbmc.update to get the latest version`)
      return
    }
    const version = await downloadAndInstall(context)
    if (version !== undefined) {
      vscode.window.showInformationMessage(`Installed ESBMC ${version}`)
    }
  })
}

export async function update (context: vscode.ExtensionContext): Promise<void> {
  await withLock(async () => {
    const esbmc = await resolveEsbmc()
    if (esbmc === undefined) {
      vscode.window.showInformationMessage('ESBMC is not installed try running esbmc.install')
      return
    }
    // Installing into storage would change nothing while PATH still wins, so
    // the update would be offered again on every invocation.
    if (esbmc.source === 'path') {
      vscode.window.showInformationMessage(
        'ESBMC on your PATH is the one that runs, and this extension does not manage it. ' +
        'Update it where you installed it, or take it off PATH to use esbmc.install.')
      return
    }
    const installedVersion = await readVersion(esbmc.command)
    const latestVersion = await getLatestVersion()
    if (installedVersion === undefined) {
      vscode.window.showInformationMessage('ESBMC is not installed try running esbmc.install')
      return
    }
    if (latestVersion === undefined) {
      vscode.window.showInformationMessage('ESBMC could not fetch latest version')
      return
    }
    if (!compare(latestVersion, installedVersion, '>')) {
      vscode.window.showInformationMessage('ESBMC is up-to-date')
      return
    }
    const version = await downloadAndInstall(context)
    if (version !== undefined) {
      vscode.window.showInformationMessage(`Updated ESBMC to ${version}`)
    }
  })
}

/**
 * Downloads the build for this platform and unpacks it into the extension's
 * own storage. The whole `bin/` directory is kept: on Windows `esbmc.exe`
 * needs the `libz3.dll` shipped beside it.
 *
 * @returns the installed version, or undefined if anything went wrong.
 */
async function downloadAndInstall (context: vscode.ExtensionContext): Promise<string | undefined> {
  if (!isSupportedPlatform(process.platform)) {
    vscode.window.showErrorMessage(
      `ESBMC: no build is published for ${process.platform}. Use Remote-SSH, WSL or a Dev Container.`)
    return undefined
  }

  const target = installDir()
  if (target === undefined) {
    vscode.window.showErrorMessage('ESBMC: the extension is not activated, cannot install')
    return undefined
  }

  const asset = assetForPlatform(process.platform)
  const statusIcon = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0)
  statusIcon.text = '$(loading~spin) Installing ESBMC '
  statusIcon.show()
  try {
    const fileDownloader: FileDownloader = await getApi()
    const archive = await fileDownloader.downloadFile(
      vscode.Uri.parse(`https://github.com/esbmc/esbmc/releases/latest/download/${asset}`),
      asset,
      context
    )
    if (archive === undefined) {
      vscode.window.showErrorMessage('Could not download ESBMC')
      return undefined
    }

    // Unpacked beside the install rather than over it: a failed extraction
    // must not be what is left where a working ESBMC used to be.
    const staging = `${target}.incoming`
    fs.rmSync(staging, { recursive: true, force: true })
    fs.mkdirSync(staging, { recursive: true })
    try {
      const unpack = extractCommand(archive.fsPath, staging, process.platform)
      const extract = await runProcess(unpack.file, unpack.args)
      if (extract.code !== 0) {
        vscode.window.showErrorMessage(`Could not unpack ESBMC: ${extract.stderr.trim()}`)
        return undefined
      }

      const binary = binaryPath(staging, process.platform)
      if (!fs.existsSync(binary)) {
        vscode.window.showErrorMessage(`Could not find esbmc in ${asset}`)
        return undefined
      }
      if (process.platform !== 'win32') {
        await runProcess('chmod', ['+x', binary])
      }

      // The binary just unpacked, not whatever the resolver would pick: an
      // ESBMC on PATH would answer for it and hide a broken download.
      const installed = await readVersion(quoteShellArg(binary))
      if (installed === undefined) {
        vscode.window.showErrorMessage('ESBMC was unpacked but does not run, see the ESBMC output')
        return undefined
      }

      fs.rmSync(target, { recursive: true, force: true })
      fs.renameSync(staging, target)
      return installed
    } finally {
      fs.rmSync(staging, { recursive: true, force: true })
    }
  } finally {
    statusIcon.dispose()
  }
}
