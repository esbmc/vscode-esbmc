import * as vscode from 'vscode'
import { CONFIG_PARSER } from './run'
import { esbmcOutput } from '../utils/output'
import { describeFlags } from '../parsers/flagReport'

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
  // run() also takes per-run overrides this command cannot know about, so say
  // what the report does and does not cover rather than implying it is final.
  channel.appendLine(
    'Settings only. Verifying a single function through its CodeLens adds ' +
    '--function for that function, and an @esbmc-verify comment above a ' +
    'function replaces these flags with its own.'
  )
  channel.show(true)

  if (flags === '') {
    return
  }
  const copy = await vscode.window.showInformationMessage(`ESBMC flags: ${flags}`, 'Copy')
  if (copy === 'Copy') {
    await vscode.env.clipboard.writeText(flags)
  }
}
