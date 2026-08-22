import { EsbmcFinding } from './sarifParser'

export type Verdict =
  | { kind: 'timeout', seconds: number }
  | { kind: 'violations', count: number }
  | { kind: 'success' }
  | { kind: 'failed-without-findings' }
  | { kind: 'unknown' }

export interface RunOutcome {
  transcript: string
  findings: EsbmcFinding[]
  timedOut: boolean
  timeoutSeconds: number
}

/**
 * Decides what a run means.
 *
 * ESBMC prints its verdict on stderr, so `transcript` has to be both streams
 * joined. A run can also fail with nothing to place: `--sarif-output` writes no
 * report under `--multi-property`, so findings can be empty even on failure.
 */
export function classifyVerdict (outcome: RunOutcome): Verdict {
  if (outcome.timedOut) {
    return { kind: 'timeout', seconds: outcome.timeoutSeconds }
  }
  if (outcome.findings.length > 0) {
    return { kind: 'violations', count: outcome.findings.length }
  }
  if (outcome.transcript.includes('VERIFICATION SUCCESSFUL')) {
    return { kind: 'success' }
  }
  if (outcome.transcript.includes('VERIFICATION FAILED')) {
    return { kind: 'failed-without-findings' }
  }
  return { kind: 'unknown' }
}

export function statusText (verdict: Verdict): string {
  switch (verdict.kind) {
    case 'timeout':
      return `$(clock) ESBMC: timed out after ${verdict.seconds}s`
    case 'violations':
      return `$(error) ESBMC: ${verdict.count} propert${verdict.count === 1 ? 'y' : 'ies'} violated`
    case 'success':
      return '$(check) ESBMC: verified'
    case 'failed-without-findings':
      return '$(error) ESBMC: failed, see output'
    case 'unknown':
      return '$(question) ESBMC: no verdict'
  }
}
