import * as assert from 'assert'
import { classifyVerdict, statusText, RunOutcome } from '../../parsers/verdict'
import { EsbmcFinding } from '../../parsers/sarifParser'

function finding (): EsbmcFinding {
  return { file: '/a.c', line: 1, message: 'x', severity: 'error', cwes: [] }
}

function outcome (overrides: Partial<RunOutcome> = {}): RunOutcome {
  return { transcript: '', findings: [], timedOut: false, timeoutSeconds: 60, ...overrides }
}

describe('classifyVerdict', () => {
  it('reports a timeout ahead of anything else in the transcript', () => {
    const verdict = classifyVerdict(outcome({
      timedOut: true,
      timeoutSeconds: 5,
      transcript: 'VERIFICATION SUCCESSFUL',
      findings: [finding()]
    }))
    assert.deepStrictEqual(verdict, { kind: 'timeout', seconds: 5 })
  })

  it('reports the number of violated properties', () => {
    assert.deepStrictEqual(
      classifyVerdict(outcome({ findings: [finding(), finding()], transcript: 'VERIFICATION FAILED' })),
      { kind: 'violations', count: 2 }
    )
  })

  it('reports success when nothing was violated', () => {
    assert.deepStrictEqual(
      classifyVerdict(outcome({ transcript: 'VERIFICATION SUCCESSFUL' })),
      { kind: 'success' }
    )
  })

  // ESBMC writes no SARIF report under --multi-property, so a run can fail
  // with nothing to place against a line.
  it('reports a failure that produced no findings', () => {
    assert.deepStrictEqual(
      classifyVerdict(outcome({ transcript: 'VERIFICATION FAILED' })),
      { kind: 'failed-without-findings' }
    )
  })

  it('reports no verdict when ESBMC never reached one', () => {
    assert.deepStrictEqual(
      classifyVerdict(outcome({ transcript: 'error: no such file' })),
      { kind: 'unknown' }
    )
  })
})

describe('statusText', () => {
  it('agrees with the number of properties', () => {
    assert.match(statusText({ kind: 'violations', count: 1 }), /1 property violated/)
    assert.match(statusText({ kind: 'violations', count: 3 }), /3 properties violated/)
  })

  it('names the timeout that fired', () => {
    assert.match(statusText({ kind: 'timeout', seconds: 30 }), /timed out after 30s/)
  })

  it('gives every verdict its own text', () => {
    const texts = [
      statusText({ kind: 'success' }),
      statusText({ kind: 'failed-without-findings' }),
      statusText({ kind: 'unknown' }),
      statusText({ kind: 'violations', count: 1 }),
      statusText({ kind: 'timeout', seconds: 1 })
    ]
    assert.strictEqual(new Set(texts).size, texts.length)
    for (const text of texts) {
      assert.match(text, /^\$\([a-z~-]+\) ESBMC: /)
    }
  })
})
