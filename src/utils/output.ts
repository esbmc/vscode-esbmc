import * as vscode from 'vscode'

let CHANNEL: vscode.OutputChannel | undefined

/** The one ESBMC output channel, shared by verification and the flag report. */
export function esbmcOutput (): vscode.OutputChannel {
  CHANNEL = CHANNEL ?? vscode.window.createOutputChannel('ESBMC')
  return CHANNEL
}

export function disposeOutput (): void {
  CHANNEL?.dispose()
  CHANNEL = undefined
}
