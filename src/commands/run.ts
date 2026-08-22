import * as vscode from 'vscode'
import * as path from 'path'
import { ConfigurationParser } from '../parsers/configParser'
import { Configuration } from '../@types/vscode.configuration'
import { statusText } from '../parsers/verdict'
import { EsbmcDiagnostics } from '../diagnostics/esbmcDiagnostics'
import { TraceView } from '../diagnostics/traceView'
import { SUPPORTED_EXTENSIONS } from '../languages'
import { EsbmcNotFoundError, VerifyResult, verifyFile } from '../verify'
import { disposeOutput, esbmcOutput as output } from '../utils/output'

const CONFIG_PARSER: ConfigurationParser = new ConfigurationParser()

let STATUS: vscode.StatusBarItem | undefined
let DIAGNOSTICS: EsbmcDiagnostics | undefined
let TRACE: TraceView | undefined
let disposed = false

// Only the newest run may touch the shared channel, status bar and
// diagnostics: a save-triggered run can otherwise overwrite a manual one.
let runToken = 0
let killInFlight: (() => void) | undefined

function status (): vscode.StatusBarItem {
  if (STATUS === undefined) {
    STATUS = vscode.window.createStatusBarItem('esbmc.verdict', vscode.StatusBarAlignment.Left, 0)
    STATUS.name = 'ESBMC'
    STATUS.tooltip = 'Show the ESBMC output'
    STATUS.command = 'vscode-esbmc.showOutput'
  }
  return STATUS
}

function trace (): TraceView {
  if (TRACE === undefined) {
    TRACE = new TraceView()
    vscode.window.registerTreeDataProvider('esbmc.trace', TRACE)
  }
  return TRACE
}

function diagnostics (): EsbmcDiagnostics {
  DIAGNOSTICS = DIAGNOSTICS ?? new EsbmcDiagnostics()
  return DIAGNOSTICS
}

export function showOutput (): void {
  output().show(true)
}

export function disposeRunState (): void {
  disposed = true
  killInFlight?.()
  disposeOutput()
  STATUS?.dispose()
  DIAGNOSTICS?.dispose()
  TRACE?.dispose()
  STATUS = undefined
  DIAGNOSTICS = undefined
  TRACE = undefined
}

function showStatus (text: string): void {
  const item = status()
  item.text = text
  item.show()
}

export async function run (overides?: Configuration, commentFlags?: string, document?: vscode.TextDocument): Promise<void> {
  overides = overides ?? {}
  const target = document ?? vscode.window.activeTextEditor?.document
  if (target === undefined) {
    vscode.window.showErrorMessage('ESBMC: No file open, not checking')
    return
  }

  const filePath = target.fileName
  const fileExt = getFileExtension(filePath)
  if (fileExt === undefined) {
    vscode.window.showErrorMessage('ESBMC: Cannot determine file type, not checking')
    return
  }
  if (!SUPPORTED_EXTENSIONS.has(fileExt)) {
    vscode.window.showErrorMessage(`ESBMC: Currently no support for .${fileExt}, not checking`)
    return
  }

  let flags: string
  if (commentFlags !== undefined) {
    flags = commentFlags
  } else {
    try {
      flags = CONFIG_PARSER.parse(overides)
    } catch (error) {
      vscode.window.showErrorMessage(`ESBMC: ${error}`)
      return
    }
  }

  const configured = vscode.workspace.getConfiguration('esbmc.editor').get<number>('timeout', 60)
  const timeoutSeconds = Number.isFinite(configured) ? Math.max(0, configured) : 60

  // Supersede any run still going: its output would interleave with this one.
  const token = ++runToken
  killInFlight?.()
  if (disposed) { return }

  diagnostics().clear()
  trace().clear()
  showStatus('$(loading~spin) ESBMC: verifying')
  const channel = output()
  channel.clear()
  channel.show(true)

  let result: VerifyResult
  try {
    result = await verifyFile(filePath, {
      flags,
      timeoutSeconds,
      onStart: kill => { killInFlight = kill }
    })
  } catch (error) {
    if (token !== runToken || disposed) { return }
    showStatus('$(question) ESBMC: no verdict')
    vscode.window.showErrorMessage(error instanceof EsbmcNotFoundError
      ? 'ESBMC: not found, try running "ESBMC: Install latest version"'
      : `ESBMC: ${String(error)}`)
    return
  }
  if (token !== runToken || disposed) { return }
  killInFlight = undefined

  channel.appendLine(result.command)
  channel.append(result.transcript)
  diagnostics().report(result.findings)
  trace().show(result.trace)
  showStatus(statusText(result.verdict))
  if (result.verdict.kind === 'timeout') {
    channel.appendLine(`\nESBMC: killed after ${timeoutSeconds}s (esbmc.editor.timeout)`)
  }
}

/**
 * Takes a path and extracts the file extension.
 * @param file Full path to the file.
 */
function getFileExtension (file: string): string | undefined {
  const fileExt = path.extname(file).slice(1).toLowerCase()
  return fileExt === '' ? undefined : fileExt
}

export function isSupported (document: vscode.TextDocument): boolean {
  const fileExt = getFileExtension(document.fileName)
  return fileExt !== undefined && SUPPORTED_EXTENSIONS.has(fileExt)
}
