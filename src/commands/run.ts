import * as vscode from 'vscode'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { ConfigurationParser } from '../parsers/configParser'
import { Configuration } from '../@types/vscode.configuration'
import { executeShellCommand, quoteShellArg, runShellCommand } from '../utils/commands'
import { parseSarif, resolveFindingPaths, EsbmcFinding } from '../parsers/sarifParser'
import { classifyVerdict, statusText } from '../parsers/verdict'
import { EsbmcDiagnostics } from '../diagnostics/esbmcDiagnostics'
import { SUPPORTED_EXTENSIONS } from '../languages'

const CONFIG_PARSER: ConfigurationParser = new ConfigurationParser()

let OUTPUT: vscode.OutputChannel | undefined
let STATUS: vscode.StatusBarItem | undefined
let DIAGNOSTICS: EsbmcDiagnostics | undefined
let disposed = false

// Only the newest run may touch the shared channel, status bar and
// diagnostics: a save-triggered run can otherwise overwrite a manual one.
let runToken = 0
let killInFlight: (() => void) | undefined

function output (): vscode.OutputChannel {
  OUTPUT = OUTPUT ?? vscode.window.createOutputChannel('ESBMC')
  return OUTPUT
}

function status (): vscode.StatusBarItem {
  if (STATUS === undefined) {
    STATUS = vscode.window.createStatusBarItem('esbmc.verdict', vscode.StatusBarAlignment.Left, 0)
    STATUS.name = 'ESBMC'
    STATUS.tooltip = 'Show the ESBMC output'
    STATUS.command = 'vscode-esbmc.showOutput'
  }
  return STATUS
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
  OUTPUT?.dispose()
  STATUS?.dispose()
  DIAGNOSTICS?.dispose()
  OUTPUT = undefined
  STATUS = undefined
  DIAGNOSTICS = undefined
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

  const esbmcCmd = await resolveEsbmcCommand()
  const configured = vscode.workspace.getConfiguration('esbmc.editor').get<number>('timeout', 60)
  const timeoutSeconds = Number.isFinite(configured) ? Math.max(0, configured) : 60

  // Supersede any run still going: its output would interleave with this one.
  const token = ++runToken
  killInFlight?.()
  if (disposed) { return }

  diagnostics().clear()
  showStatus('$(loading~spin) ESBMC: verifying')
  const channel = output()
  channel.clear()
  channel.show(true)

  const workingDir = path.dirname(filePath)
  const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esbmc-'))
  const report = path.join(reportDir, 'result.sarif')
  try {
    const cmd = `${esbmcCmd} ${quoteShellArg(filePath)} ${flags} --sarif-output ${quoteShellArg(report)}`
    channel.appendLine(cmd)

    const result = await runShellCommand(cmd, {
      timeoutMs: timeoutSeconds * 1000,
      onStart: kill => { killInFlight = kill }
    })
    if (token !== runToken || disposed) { return }
    killInFlight = undefined

    channel.append(result.stdout)
    channel.append(result.stderr)

    const findings = result.timedOut ? [] : resolveFindingPaths(readFindings(report, channel), workingDir)
    diagnostics().report(findings)

    // ESBMC prints its verdict on stderr and only its version banner on stdout.
    showStatus(statusText(classifyVerdict({
      transcript: result.stdout + result.stderr,
      findings,
      timedOut: result.timedOut,
      timeoutSeconds
    })))
    if (result.timedOut) {
      channel.appendLine(`\nESBMC: killed after ${timeoutSeconds}s (esbmc.editor.timeout)`)
    }
  } finally {
    fs.rmSync(reportDir, { recursive: true, force: true })
  }
}

/**
 * ESBMC is preferred from PATH, falling back to where the install command puts
 * it. Deliberately not cached: the install command can add it mid-session.
 */
async function resolveEsbmcCommand (): Promise<string> {
  try {
    await executeShellCommand('esbmc --version')
    return 'esbmc'
  } catch {
    return quoteShellArg(path.join(os.homedir(), 'bin', 'esbmc'))
  }
}

function readFindings (report: string, channel: vscode.OutputChannel): EsbmcFinding[] {
  if (!fs.existsSync(report)) {
    return []
  }
  try {
    return parseSarif(fs.readFileSync(report, 'utf8'))
  } catch (error) {
    channel.appendLine(`\nESBMC: could not read the SARIF report (${String(error)})`)
    return []
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
