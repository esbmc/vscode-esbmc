import * as path from 'path'
import { VerifyResult } from '../verify'
import { describeText } from '../report'
import { languageOf } from '../languages'

export type AiTask = 'explain' | 'fix'

export interface PromptInput {
  file: string
  /** The bytes ESBMC read, not what an editor is showing. */
  source: string
  result: VerifyResult
  task: AiTask
  /** Asked instead of the standard sections, when the user worded it themselves. */
  question?: string
}

export interface PromptLimits {
  sourceChars: number
  transcriptChars: number
}

/**
 * Small enough for the 4k context an out-of-the-box Ollama model runs with,
 * which is the tightest backend. A model with room to spare is unharmed by
 * being asked a shorter question.
 */
export const DEFAULT_LIMITS: PromptLimits = { sourceChars: 24000, transcriptChars: 8000 }

/** The language a model should answer in, so a Python file is not rewritten as C. */
export function fenceLanguage (file: string): string {
  return languageOf(file) ?? 'text'
}

/** Keeps the start, which is where a program's structure is. */
export function clipHead (text: string, maxChars: number): string {
  return text.length <= maxChars
    ? text
    : `${text.slice(0, maxChars)}\n… ${text.length - maxChars} characters omitted`
}

/** Keeps the end, which is where ESBMC puts its verdict. */
export function clipTail (text: string, maxChars: number): string {
  return text.length <= maxChars
    ? text
    : `… ${text.length - maxChars} characters omitted\n${text.slice(text.length - maxChars)}`
}

const TASKS: Record<AiTask, string> = {
  explain: 'Explain the counterexample and how to fix it.',
  fix: 'Repair the program so ESBMC proves the property.'
}

/**
 * The question put to a language model about a verification result.
 *
 * Both the source and the transcript are clipped: an ESBMC transcript of a
 * loop-heavy program runs to megabytes, which no backend accepts and Ollama
 * does not refuse — it stalls.
 */
export function buildPrompt (input: PromptInput, limits: PromptLimits = DEFAULT_LIMITS): string {
  const language = fenceLanguage(input.file)
  const ask = input.question !== undefined && input.question.trim() !== ''
    ? `Answer this question about the program and its verification: ${input.question.trim()}`
    : `${TASKS[input.task]} Answer with these sections, in order:

1) Issue found — the violated property, and the execution that reaches it.
2) Fixed code — the corrected program in full, in a \`\`\`${language} block, keeping the original logic wherever it is already correct.
3) Why the fix works — the root cause, and why ESBMC can no longer reach the violation.`
  return `You are an expert in formal verification with ESBMC, a bounded model checker.

${ask}

The program is written in ${language}. Answer about that language and no other.
A counterexample is an execution ESBMC proved reachable, not a guess: do not dispute it.

Program (${path.basename(input.file)}):
\`\`\`${language}
${clipHead(input.source, limits.sourceChars)}
\`\`\`

What ESBMC found:
${describeText(input.file, input.result)}

ESBMC output:
\`\`\`text
${clipTail(input.result.transcript, limits.transcriptChars)}
\`\`\`
`
}
