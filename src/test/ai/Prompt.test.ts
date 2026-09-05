import * as assert from 'assert'
import { buildPrompt, clipHead, clipTail, fenceLanguage } from '../../ai/prompt'
import { VerifyResult } from '../../verify'

function result (overrides: Partial<VerifyResult> = {}): VerifyResult {
  return {
    verdict: { kind: 'violations', count: 1 },
    findings: [{ file: 'a.c', line: 5, message: 'array bounds violated', severity: 'error', cwes: [] }],
    trace: [],
    transcript: 'VERIFICATION FAILED',
    command: 'esbmc a.c',
    ...overrides
  }
}

describe('fenceLanguage', () => {
  // The prompt used to hardcode C, which invited a model to answer a Python
  // or Solidity file with a C rewrite.
  it('names the language of every file ESBMC verifies', () => {
    assert.strictEqual(fenceLanguage('/src/a.c'), 'c')
    assert.strictEqual(fenceLanguage('/src/a.cpp'), 'cpp')
    assert.strictEqual(fenceLanguage('/src/a.py'), 'python')
    assert.strictEqual(fenceLanguage('/src/a.sol'), 'solidity')
  })

  it('claims nothing about a file it does not know', () => {
    assert.strictEqual(fenceLanguage('/src/a.jimple'), 'text')
  })
})

describe('clipping', () => {
  it('leaves text that already fits alone', () => {
    assert.strictEqual(clipHead('abc', 10), 'abc')
    assert.strictEqual(clipTail('abc', 10), 'abc')
  })

  it('keeps the start of a program and the end of a transcript', () => {
    assert.match(clipHead('abcdef', 3), /^abc\n/)
    assert.match(clipTail('abcdef', 3), /def$/)
  })

  it('says how much it dropped', () => {
    assert.match(clipHead('abcdef', 3), /3 characters omitted/)
    assert.match(clipTail('abcdef', 3), /3 characters omitted/)
  })
})

describe('buildPrompt', () => {
  const input = { file: '/src/a.py', source: 'x = 1', result: result(), task: 'explain' as const }

  it('asks about the language the file is actually in', () => {
    const prompt = buildPrompt(input)
    assert.match(prompt, /```python/)
    assert.doesNotMatch(prompt, /```c\n/)
  })

  it('carries the program, the verdict and the transcript', () => {
    const prompt = buildPrompt(input)
    assert.ok(prompt.includes('x = 1'))
    assert.ok(prompt.includes('array bounds violated'))
    assert.ok(prompt.includes('VERIFICATION FAILED'))
  })

  it('asks to repair rather than explain when that is the task', () => {
    assert.notStrictEqual(buildPrompt({ ...input, task: 'fix' }), buildPrompt(input))
  })

  it('puts the user their own question when they asked one', () => {
    const prompt = buildPrompt({ ...input, question: 'is the loop bound wrong?' })
    assert.ok(prompt.includes('is the loop bound wrong?'))
    assert.doesNotMatch(prompt, /1\) Issue found/)
  })

  // An ESBMC transcript of a loop-heavy program runs to megabytes. Ollama
  // does not refuse an oversized prompt, it stalls on one.
  it('clips a program and a transcript that would not fit', () => {
    const prompt = buildPrompt(
      { ...input, source: 'a'.repeat(5000), result: result({ transcript: 'b'.repeat(5000) }) },
      { sourceChars: 100, transcriptChars: 100 }
    )
    assert.ok(prompt.length < 2000, `prompt is ${prompt.length} characters`)
    assert.match(prompt, /4900 characters omitted/)
  })
})
