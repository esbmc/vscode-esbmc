import * as fs from 'fs'
import * as vscode from 'vscode'
import { ChatTarget, handleChatRequest } from './handler'
import { backendLabel, configuredBackend, respond } from '../ai/backend'
import { run } from '../commands/run'

const PARTICIPANT_ID = 'esbmc.chat'

/** The file paths a request points at, in the order the user attached them. */
function referencedFiles (request: vscode.ChatRequest): string[] {
  return request.references.flatMap(reference => {
    const value = reference.value
    if (value instanceof vscode.Uri) {
      return value.scheme === 'file' ? [value.fsPath] : []
    }
    if (value instanceof vscode.Location) {
      return value.uri.scheme === 'file' ? [value.uri.fsPath] : []
    }
    return []
  })
}

function activeTarget (): ChatTarget | undefined {
  const document = vscode.window.activeTextEditor?.document
  // An untitled buffer has no path on disk for ESBMC to read, and its
  // fileName is a label rather than a file.
  if (document === undefined || document.uri.scheme !== 'file') {
    return undefined
  }
  return { file: document.fileName, isDirty: document.isDirty }
}

export function registerChatParticipant (context: vscode.ExtensionContext): vscode.Disposable {
  const participant = vscode.chat.createChatParticipant(
    PARTICIPANT_ID,
    async (request, _context, stream, token) => await handleChatRequest(request, stream, token, {
      referenced: referencedFiles(request),
      active: activeTarget(),
      // Through run() rather than verifyFile(), so a chat verdict is the one
      // the configured flags produce and the squiggles and counterexample
      // view follow along. reveal: false leaves the chat view in front.
      verify: async file => await run(undefined, undefined, await vscode.workspace.openTextDocument(file), { reveal: false }),
      readSource: file => fs.readFileSync(file, 'utf8'),
      respond: aiRequest => respond({ ...aiRequest, model: request.model }),
      backendLabel: backendLabel(configuredBackend())
    })
  )
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'images', 'icon.png')
  return participant
}
