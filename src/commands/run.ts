import * as vscode from 'vscode'
import { ConfigurationParser } from '../parsers/configParser'
import { Configuration } from '../@types/vscode.configuration'
import { executeShellCommand } from '../utils/commands'

const SUPPORTED_EXTENSIONS = new Set(['c', 'cpp', 'sol', 'jimple', 'py'])
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
    const fileExt = getFileExtension(currentlyOpenTabfilePath)
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
      let esbmcCmd = 'esbmc'
      try {
        await executeShellCommand('esbmc --version')
      } catch {
        esbmcCmd = '$HOME/bin/esbmc'
      }
      const cmd = `${esbmcCmd} ${currentlyOpenTabfilePath} ${flags}`
      const terminal = vscode.window.createTerminal('ESBMC')
      terminal.show()
      terminal.sendText(cmd)
    } else {
      vscode.window.showErrorMessage(`ESBMC: Currently no support for .${fileExt}, not checking`)
    }
  } else {
    vscode.window.showErrorMessage('ESBMC: No file open, not checking')
  }
}

/**
 * Takes a path and extracts the file extension.
 * @param file Full path to the file.
 */
function getFileExtension (file:string): string | undefined {
  const fileExt = file.split('.').pop()
  // If there is no file extension this holds
  if (fileExt === file) { return undefined }
  return fileExt
}
