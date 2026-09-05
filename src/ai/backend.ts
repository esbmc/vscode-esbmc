import * as vscode from 'vscode'
import { AiTask, buildPrompt, fenceLanguage } from './prompt'
import { EsbmcAiFailedError, EsbmcAiNotFoundError, runEsbmcAi } from './esbmcAi'
import { VerifyResult } from '../verify'
import { callOllama } from './ollamaClient'

export type BackendId = 'chat' | 'ollama' | 'esbmc-ai'

export interface AiRequest {
  file: string
  /** The bytes ESBMC read, not what an editor is showing. */
  source: string
  result: VerifyResult
  task: AiTask
  /** What the user actually asked, when they asked in their own words. */
  question?: string
  /** The model the user picked, when the request came from a chat view. */
  model?: vscode.LanguageModelChat
  token?: vscode.CancellationToken
}

/** The chosen backend cannot answer, and no other one is tried in its place. */
export class AiUnavailableError extends Error {}

const LABELS: Record<BackendId, string> = {
  chat: 'the VS Code chat model',
  ollama: 'Ollama',
  'esbmc-ai': 'ESBMC-AI'
}

export function backendLabel (id: BackendId): string {
  return LABELS[id]
}

export function configuredBackend (): BackendId {
  const configured = vscode.workspace.getConfiguration('esbmc.ai').get<string>('backend', 'chat')
  return configured in LABELS ? configured as BackendId : 'chat'
}

export function aiEnabled (): boolean {
  return vscode.workspace.getConfiguration('esbmc.ai').get<boolean>('enabled', true)
}

function aiTimeoutSeconds (): number {
  const configured = vscode.workspace.getConfiguration('esbmc.ai').get<number>('timeout', 600)
  return Number.isFinite(configured) ? Math.max(0, configured) : 600
}

/**
 * Turns a language model refusal into an answer the user can act on.
 *
 * Consent is asked for at sendRequest, not when the model is picked, so a
 * declined request is the common path here rather than an edge case.
 */
function languageModelMessage (error: vscode.LanguageModelError): string {
  switch (error.code) {
    case 'NoPermissions':
      return 'Access to the language model was declined. Run the command again and choose Allow, or set esbmc.ai.backend to "ollama" to keep everything local.'
    case 'Blocked':
      return 'The language model declined to answer. The counterexample itself is in the ESBMC output channel.'
    case 'NotFound':
      return 'No usable language model. Pick another model in the chat model picker, or set esbmc.ai.backend to "ollama" or "esbmc-ai".'
    default:
      return `The language model failed: ${error.message}`
  }
}

async function * respondWithChatModel (request: AiRequest): AsyncIterable<string> {
  // Inside a chat request the user already picked a model; outside one there
  // is no picker, so the first model VS Code offers is the only candidate.
  const model = request.model ?? (await vscode.lm.selectChatModels())[0]
  if (model === undefined) {
    throw new AiUnavailableError(
      'No chat model is available. Install a chat provider such as GitHub Copilot, or set esbmc.ai.backend to "ollama" or "esbmc-ai".'
    )
  }

  const messages = [vscode.LanguageModelChatMessage.User(buildPrompt(request))]
  try {
    const response = await model.sendRequest(
      messages,
      { justification: 'Explain an ESBMC counterexample' },
      request.token
    )
    yield * response.text
  } catch (error) {
    if (error instanceof vscode.LanguageModelError) {
      throw new AiUnavailableError(languageModelMessage(error))
    }
    throw error
  }
}

async function * respondWithOllama (request: AiRequest): AsyncIterable<string> {
  try {
    yield await callOllama(buildPrompt(request), aiTimeoutSeconds() * 1000)
  } catch (error) {
    throw new AiUnavailableError(
      `Ollama did not answer (${String(error)}). Start it with "ollama serve", or change esbmc.ai.backend.`
    )
  }
}

let killAiInFlight: (() => void) | undefined

/** Kills an AI backend that is still running when the extension shuts down. */
export function disposeAiState (): void {
  killAiInFlight?.()
  killAiInFlight = undefined
}

async function * respondWithEsbmcAi (request: AiRequest): AsyncIterable<string> {
  const config = vscode.workspace.getConfiguration('esbmc.ai')
  if (request.task === 'explain') {
    yield 'ESBMC-AI repairs a program rather than explaining one, so this is its repair.\n\n'
  }

  let repair
  let cancellation: vscode.Disposable | undefined
  try {
    repair = await runEsbmcAi({
      binary: config.get<string>('esbmcAi.path', 'esbmc-ai'),
      file: request.file,
      model: config.get<string>('esbmcAi.model', ''),
      configFile: config.get<string>('esbmcAi.configFile', ''),
      timeoutSeconds: aiTimeoutSeconds(),
      onStart: kill => {
        killAiInFlight = kill
        cancellation = request.token?.onCancellationRequested(kill)
      }
    })
  } catch (error) {
    if (error instanceof EsbmcAiNotFoundError) {
      throw new AiUnavailableError(
        'ESBMC-AI is not installed. Install it with "pip install esbmc-ai", or set esbmc.ai.esbmcAi.path to where it lives.'
      )
    }
    throw error instanceof EsbmcAiFailedError ? new AiUnavailableError(error.message) : error
  } finally {
    cancellation?.dispose()
    killAiInFlight = undefined
  }

  if (!repair.successful || repair.repairedSource === undefined) {
    yield `ESBMC-AI could not repair the program after ${repair.attempts} attempt(s).`
    return
  }
  yield `ESBMC-AI repaired the program in ${repair.attempts} attempt(s) and re-verified the result:\n\n`
  yield `\`\`\`${fenceLanguage(request.file)}\n${repair.repairedSource}\n\`\`\`\n`
}

/**
 * Answers a verification result with the configured backend.
 *
 * One backend never stands in for another: sending a program to a hosted
 * model because a local one is down is not a fallback the user asked for.
 *
 * @throws AiUnavailableError when the chosen backend cannot answer, carrying
 * the message to show and the setting that changes it.
 */
export function respond (request: AiRequest, backend: BackendId = configuredBackend()): AsyncIterable<string> {
  switch (backend) {
    case 'chat':
      return respondWithChatModel(request)
    case 'ollama':
      return respondWithOllama(request)
    case 'esbmc-ai':
      return respondWithEsbmcAi(request)
  }
}
