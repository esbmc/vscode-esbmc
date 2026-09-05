import * as assert from 'assert'
import { describeMarkdown, describeText, verdictHeadline } from '../../report'
import { VerifyResult } from '../../verify'

function result (overrides: Partial<VerifyResult> = {}): VerifyResult {
  return {
    verdict: { kind: 'success' },
    findings: [],
    trace: [],
    transcript: '',
    command: 'esbmc a.c',
    ...overrides
  }
}

// An MCP client reads this wording, so it is part of the tool's contract and
// changing it changes what an agent is told.
describe('verdictHeadline', () => {
  it('names the verdict of every kind of run', () => {
    assert.match(verdictHeadline('a.c', { kind: 'success' }), /^VERIFICATION SUCCESSFUL: /)
    assert.match(verdictHeadline('a.c', { kind: 'violations', count: 2 }), /^VERIFICATION FAILED: 2 /)
    assert.match(verdictHeadline('a.c', { kind: 'failed-without-findings' }), /^VERIFICATION FAILED in /)
    assert.match(verdictHeadline('a.c', { kind: 'timeout', seconds: 5 }), /^TIMEOUT: /)
    assert.match(verdictHeadline('a.c', { kind: 'unknown' }), /^NO VERDICT: /)
  })

  it('names the file it is talking about', () => {
    assert.match(verdictHeadline('/src/a.c', { kind: 'success' }), /\/src\/a\.c/)
  })
})

describe('describeText', () => {
  it('states plainly what a successful result means', () => {
    assert.match(describeText('a.c', result()), /VERIFICATION SUCCESSFUL/)
  })

  it('lists each violated property with its location', () => {
    const text = describeText('a.c', result({
      verdict: { kind: 'violations', count: 1 },
      findings: [{ file: '/src/a.c', line: 5, message: 'array bounds violated', severity: 'error', cwes: ['CWE-787'] }]
    }))
    assert.match(text, /VERIFICATION FAILED: 1 property/)
    assert.match(text, /\/src\/a\.c:5 array bounds violated \[CWE-787\]/)
  })

  it('includes the counterexample values', () => {
    const text = describeText('a.c', result({
      verdict: { kind: 'violations', count: 1 },
      trace: [{ file: '/src/a.c', line: 4, assumptions: ['x == 11'] }]
    }))
    assert.match(text, /Counterexample:/)
    assert.match(text, /\/src\/a\.c:4 x == 11/)
  })

  it('distinguishes a timeout from a failure', () => {
    assert.match(describeText('a.c', result({ verdict: { kind: 'timeout', seconds: 5 } })), /TIMEOUT/)
    assert.doesNotMatch(describeText('a.c', result({ verdict: { kind: 'timeout', seconds: 5 } })), /FAILED/)
  })
})

describe('describeMarkdown', () => {
  const violation = result({
    verdict: { kind: 'violations', count: 1 },
    findings: [{ file: '/src/a.c', line: 5, message: 'array bounds violated', severity: 'error', cwes: ['CWE-787'] }],
    trace: [{ file: '/src/a.c', line: 4, assumptions: ['x == 11'] }]
  })

  it('carries the same headline as the text report', () => {
    assert.ok(describeMarkdown('a.c', violation).includes(verdictHeadline('a.c', violation.verdict)))
  })

  it('renders one bullet per finding, with its CWEs', () => {
    const text = describeMarkdown('a.c', violation)
    assert.match(text, /^- `\/src\/a\.c:5` array bounds violated _CWE-787_$/m)
  })

  it('renders the counterexample as a list', () => {
    assert.match(describeMarkdown('a.c', violation), /^- `\/src\/a\.c:4 x == 11`$/m)
  })

  // ESBMC quotes the expression it checked, so a message routinely carries
  // `*`, `_` and `[`, which would otherwise reformat the reply around it.
  // A counterexample carries string literals, and a backtick in one used to
  // close the code span and leak the rest of the step as prose.
  it('keeps a trace step with a backtick inside its code span', () => {
    const markdown = describeMarkdown('/src/a.c', result({
      trace: [{ file: 'a.c', line: 3, assumptions: ['s == "a`b"'], enterFunction: undefined }]
    }))
    const step = markdown.split('\n').find(line => line.includes('a`b'))
    assert.ok(step !== undefined, markdown)
    assert.match(step, /^- (`{2,})[^`]* .*a`b.*\1$/)
  })

  it('escapes markdown in a finding message', () => {
    const text = describeMarkdown('a.c', result({
      verdict: { kind: 'violations', count: 1 },
      findings: [{ file: 'a.c', line: 1, message: 'dereference failure: *p_[0] < n', severity: 'error', cwes: [] }]
    }))
    assert.ok(text.includes('\\*p\\_\\[0\\]'), text)
  })

  it('truncates a long counterexample and says how much it dropped', () => {
    const trace = Array.from({ length: 30 }, (_, index) => ({ file: 'a.c', line: index, assumptions: [`x == ${index}`] }))
    const text = describeMarkdown('a.c', result({ trace }), 25)
    assert.ok(text.includes('x == 24'))
    assert.ok(!text.includes('x == 25'))
    assert.match(text, /… 5 more steps/)
  })

  it('renders no empty list when there is nothing to list', () => {
    const text = describeMarkdown('a.c', result({ verdict: { kind: 'failed-without-findings' } }))
    assert.doesNotMatch(text, /^-/m)
    assert.doesNotMatch(text, /Counterexample/)
  })
})
