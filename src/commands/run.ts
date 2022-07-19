import * as vscode from 'vscode'
import { ConfigurationParser } from '../parsers/configParser'
import { Configuration } from '../@types/vscode.configuration'
import path = require('path')

const SUPPORTED_EXTENSIONS = new Set(['.c', '.cpp', '.sol', '.jimple'])
const CONFIG_PARSER: ConfigurationParser = new ConfigurationParser()

/**
 * Takes a path and extracts the file extension.
 */
export async function run (overides?: Configuration, commentFlags?: string):Promise<void> {
  // Set overides to empty object if undefined
  overides = overides || {}
  const activeTextEditor = vscode.window.activeTextEditor
  if (activeTextEditor !== undefined) {
    const currentlyOpenTabfilePath = activeTextEditor.document.fileName
    const fileExt = path.extname(currentlyOpenTabfilePath)
    if (fileExt === undefined) {
      vscode.window.showErrorMessage('ESBMC: Cannot determine file type, not checking')
      return
    }
    if (SUPPORTED_EXTENSIONS.has(fileExt!)) {
      let flags: string
      // If comment flags have been passed, use them instead of parsing
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
      const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath
      if (workspacePath === undefined) { vscode.window.showErrorMessage('ESBMC: Could not find worspace path') }
      const mainFunction = overides?.bmc?.mainFunction === undefined
        ? vscode.workspace.getConfiguration('esbmc.bmc').mainFunction
        : overides?.bmc?.mainFunction
      const { witnessPath, logPath } = await constructOutputDirs(currentlyOpenTabfilePath, workspacePath, mainFunction)
      const runCommand = `esbmc ${currentlyOpenTabfilePath} ${flags} --witness-output ${witnessPath} --file-output ${logPath}`
      const outputCommand = `cat ${logPath}`
      const terminal = vscode.window.createTerminal('ESBMC')
      terminal.show()
      terminal.sendText(runCommand)
      terminal.sendText(outputCommand)
    } else {
      vscode.window.showErrorMessage(`ESBMC: Currently no support for ${fileExt}, not checking`)
    }
  } else {
    vscode.window.showErrorMessage('ESBMC: No file open, not checking')
  }
}

export async function runFromCommand () {
  const func = await vscode.window.showInputBox({
    title: 'Program',
    prompt: 'Enter function in open file to verify',
    placeHolder: 'main'
  })
  if (func === undefined) { return }
  const activeTextEditor = vscode.window.activeTextEditor
  const uri = activeTextEditor?.document?.uri
  // Get run commands from codelens as they hold the extra flags too
  const codelenses: vscode.CodeLens[] = await vscode.commands.executeCommand<vscode.CodeLens[]>('vscode.executeCodeLensProvider', uri)
  const commands = codelenses.filter((codelens) => {
    return codelens.command?.arguments?.[0]?.bmc?.mainFunction === func
  }).map((codelens) => {
    return codelens?.command
  })
  if (commands.length !== 1) {
    vscode.window.showErrorMessage(`ESBMC: Multiple definitions of ${func}, not checking`)
  } else if (commands[0] === undefined) {
    vscode.window.showErrorMessage(`ESBMC: Internal error, no command for ${func}`)
  } else {
    const command: vscode.Command = commands[0]
    await vscode.commands.executeCommand(
      command.command,
      command.arguments?.[0],
      command.arguments?.[1]
    )
  }
}

/**
 * Constructs the output paths for the witness and log files
 *
 * If you verify a file with the entrypoint on <mainFunction> with the format:
 *     <relativeDirectory>/<filename>.<extension>
 * It will construct the following files
 *     .esbmc/<relativeDirectory>/<filename>/<mainFunction>.graphml
 *     .esbmc/<relativeDirectory>/<filename>/<mainFunction>.log
 *
 * @param currentlyOpenTabfilePath current open file
 * @param workspacePath open workspace directory
 * @param mainFunction function to verify
 * @returns A promise containing both output paths
 */
async function constructOutputDirs (
  currentlyOpenTabfilePath: string,
  workspacePath: string | undefined,
  mainFunction: any): Promise<{
    witnessPath: string;
    logPath: string;
  }> {
  const relativePath: string = vscode.workspace.asRelativePath(currentlyOpenTabfilePath)
  const relativeDirName: string = relativePath.substring(0, relativePath.lastIndexOf('.'))
  // Construct the directory for file if not already present
  const esbmcDirUri: vscode.Uri = vscode.Uri.parse(`${workspacePath}/.esbmc/${relativeDirName}/`)
  await vscode.workspace.fs.createDirectory(esbmcDirUri)
  const witnessPath = `.esbmc/${relativeDirName}/${mainFunction}.graphml`
  const logPath = `.esbmc/${relativeDirName}/${mainFunction}.log`
  return { witnessPath, logPath }
}
