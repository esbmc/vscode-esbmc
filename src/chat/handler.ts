import type * as vscode from 'vscode'
import type { AiRequest } from '../ai/backend'
import type { AiTask } from '../ai/prompt'
import type { VerifyResult } from '../verify'
import { describeMarkdown } from '../report'
import { isSupportedFile } from '../languages'

/** A file a chat request is about, and whether an editor is holding changes to it. */
export interface ChatTarget {
  file: string
  isDirty: boolean
}

export interface ChatDeps {
  /** Paths attached to the request, e.g. through `#file:`, in the order given. */
  referenced: string[]
  /** The file the user is looking at, if any. */
  active?: ChatTarget
  /** Verifies through the same path the palette command uses, so the flags match. */
  verify: (file: string) => Promise<VerifyResult | undefined>
  /** The bytes ESBMC read. An editor may be holding different ones. */
  readSource: (file: string) => string
  respond: (request: AiRequest) => AsyncIterable<string>
  /** What the configured backend is called, for the progress line. */
  backendLabel: string
}

const HELP = [
  'Open a C, C++, Python, Solidity or Jimple file, or attach one to the question, and I will verify it.',
  '',
  '- `/verify` — run ESBMC and report the verdict',
  '- `/explain` — explain the counterexample',
  '- `/fix` — propose a program that verifies'
].join('\n')

function message (error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The file a request is about.
 *
 * An attachment wins over the active editor: someone who took the trouble to
 * point at a file meant that one, even while looking at another.
 */
export function pickTarget (referenced: string[], active?: ChatTarget): ChatTarget | undefined {
  const attached = referenced.find(isSupportedFile)
  if (attached !== undefined) {
    return { file: attached, isDirty: false }
  }
  return active
}

/**
 * Answers one `@esbmc` request.
 *
 * Imports `vscode` for types only, so the branching here can be exercised
 * without the editor; everything it needs in value position arrives through
 * {@link ChatDeps}.
 */
export async function handleChatRequest (
  request: Pick<vscode.ChatRequest, 'command' | 'prompt'>,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  deps: ChatDeps
): Promise<void> {
  const target = pickTarget(deps.referenced, deps.active)
  if (target === undefined) {
    stream.markdown(HELP)
    return
  }
  if (!isSupportedFile(target.file)) {
    stream.markdown(`ESBMC cannot verify \`${target.file}\`. It handles C, C++, Python, Solidity and Jimple.\n\n${HELP}`)
    return
  }
  // ESBMC reads the file from disk, so an unsaved buffer is verified stale.
  // Saying so matters more here than in the editor: the explanation that
  // follows would otherwise describe code the user is not looking at.
  if (target.isDirty) {
    stream.markdown(`\`${target.file}\` has unsaved changes. ESBMC reads the file from disk, so this is the saved version.\n\n`)
  }

  stream.progress(`Verifying ${target.file} with ESBMC`)
  let result: VerifyResult | undefined
  try {
    result = await deps.verify(target.file)
  } catch (error) {
    stream.markdown(`ESBMC could not verify \`${target.file}\`: ${message(error)}`)
    return
  }
  if (result === undefined) {
    stream.markdown('ESBMC did not produce a result. The **ESBMC** output channel has the details.')
    return
  }
  stream.markdown(describeMarkdown(target.file, result))

  if (request.command === 'verify' || token.isCancellationRequested) {
    return
  }
  if (result.verdict.kind === 'success') {
    stream.markdown('\n\nThere is no counterexample to explain.')
    return
  }

  const task: AiTask = request.command === 'fix' ? 'fix' : 'explain'
  stream.progress(`Asking ${deps.backendLabel}`)
  stream.markdown('\n\n')
  try {
    const answer = deps.respond({
      file: target.file,
      source: deps.readSource(target.file),
      result,
      task,
      question: request.prompt.trim() === '' ? undefined : request.prompt,
      token
    })
    for await (const chunk of answer) {
      stream.markdown(chunk)
    }
  } catch (error) {
    // An AiUnavailableError carries the sentence to show; anything else is
    // unexpected, and its message is still better than silence.
    stream.markdown(`ESBMC: ${message(error)}`)
  }
}
