import { EsbmcFinding } from './parsers/sarifParser'
import { TraceStep } from './parsers/witnessParser'
import { Verdict } from './parsers/verdict'
import { VerifyResult } from './verify'

/** Beyond this a counterexample buries the verdict in a chat reply. */
const MARKDOWN_TRACE_STEPS = 25

/**
 * One sentence saying what a run means, shared by every report.
 *
 * Deliberately free of any VS Code import: an MCP client, the chat
 * participant and the output channel all read it, and only some of them run
 * inside VS Code.
 */
export function verdictHeadline (file: string, verdict: Verdict): string {
  switch (verdict.kind) {
    case 'success':
      return `VERIFICATION SUCCESSFUL: ESBMC proved every checked property of ${file}.`
    case 'violations':
      return `VERIFICATION FAILED: ${verdict.count} property/properties violated in ${file}.`
    case 'failed-without-findings':
      return `VERIFICATION FAILED in ${file}, but ESBMC reported no property to place.`
    case 'timeout':
      return `TIMEOUT: ESBMC was killed after ${verdict.seconds}s on ${file}.`
    case 'unknown':
      return `NO VERDICT: ESBMC did not reach a conclusion on ${file}.`
  }
}

/**
 * A trace step as one line of a report, empty when it says nothing.
 *
 * Not `describeStep` from the witness parser: that labels a node in the
 * counterexample tree, where the line number is already a separate column and
 * every node needs some text. Here the location is part of the line, and a
 * step with neither a value nor a function entry is dropped rather than
 * padded out to `step`.
 */
function locateStep (step: TraceStep): string {
  const where = step.line === undefined ? '' : `${step.file ?? ''}:${step.line} `
  const what = step.assumptions.length > 0
    ? step.assumptions.join(', ')
    : step.enterFunction === undefined ? '' : `enter ${step.enterFunction}`
  return `${where}${what}`.trimEnd()
}

/** What an agent gets back, kept stable and independent of ESBMC's log format. */
export function describeText (file: string, result: VerifyResult): string {
  const lines: string[] = [verdictHeadline(file, result.verdict)]

  for (const finding of result.findings) {
    const cwes = finding.cwes.length > 0 ? ` [${finding.cwes.join(', ')}]` : ''
    lines.push(`  ${finding.file}:${finding.line} ${finding.message}${cwes}`)
  }

  if (result.trace.length > 0) {
    lines.push('', 'Counterexample:')
    for (const step of result.trace) {
      const described = locateStep(step)
      if (described !== '') {
        lines.push(`  ${described}`)
      }
    }
  }

  return lines.join('\n')
}

function escapeMarkdown (text: string): string {
  return text.replace(/[\\`*_[\]<>]/g, '\\$&')
}

/**
 * A value as inline code, fenced by a longer run of backticks than it
 * contains. A counterexample carries string literals, and a backtick in one
 * would otherwise close the span and leak the rest as prose (CommonMark 6.1).
 */
function inlineCode (value: string): string {
  const runs = value.match(/`+/g) ?? []
  const fence = '`'.repeat(Math.max(0, ...runs.map(run => run.length)) + 1)
  const pad = value.startsWith('`') || value.endsWith('`') ? ' ' : ''
  return `${fence}${pad}${value}${pad}${fence}`
}

function findingMarkdown (finding: EsbmcFinding): string {
  const cwes = finding.cwes.length > 0 ? ` _${finding.cwes.join(', ')}_` : ''
  return `- ${inlineCode(`${finding.file}:${finding.line}`)} ${escapeMarkdown(finding.message)}${cwes}`
}

/** The same report as {@link describeText}, for a surface that renders Markdown. */
export function describeMarkdown (
  file: string,
  result: VerifyResult,
  maxTraceSteps: number = MARKDOWN_TRACE_STEPS
): string {
  const lines: string[] = [`**${escapeMarkdown(verdictHeadline(file, result.verdict))}**`]

  if (result.findings.length > 0) {
    lines.push('', ...result.findings.map(findingMarkdown))
  }

  const steps = result.trace.map(locateStep).filter(step => step !== '')
  if (steps.length > 0) {
    lines.push('', 'Counterexample:', '')
    lines.push(...steps.slice(0, maxTraceSteps).map(step => `- ${inlineCode(step)}`))
    if (steps.length > maxTraceSteps) {
      lines.push(`- … ${steps.length - maxTraceSteps} more steps, in the **ESBMC Counterexample** view`)
    }
  }

  return lines.join('\n')
}
