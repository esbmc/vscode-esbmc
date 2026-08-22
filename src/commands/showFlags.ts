import * as vscode from 'vscode'
import { ConfigurationParser } from '../parsers/configParser'
import { esbmcOutput } from '../utils/output'
import { describeFlags } from '../parsers/flagReport'

const CONFIG_PARSER = new ConfigurationParser()

/**
 * Shows the ESBMC command line the current settings produce.
 *
 * Settings map to flags one indirection away, and only non-default settings
 * emit anything, so the only reliable way to know what will run is to ask.
 */
export async function showFlags (): Promise<void> {
  let flags: string
  try {
    flags = CONFIG_PARSER.parse()
  } catch (error) {
    vscode.window.showErrorMessage(`ESBMC: ${String(error)}`)
    return
  }

  const channel = esbmcOutput()
  channel.appendLine(describeFlags(flags))
  channel.show(true)

  if (flags === '') {
    return
  }
  const copy = await vscode.window.showInformationMessage(`ESBMC flags: ${flags}`, 'Copy')
  if (copy === 'Copy') {
    await vscode.env.clipboard.writeText(flags)
  }
}
