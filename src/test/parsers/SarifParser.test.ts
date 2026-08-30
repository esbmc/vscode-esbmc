import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import { parseSarif, resolveFindingPaths } from '../../parsers/sarifParser'

const FIXTURES = path.resolve(__dirname, '..', '..', '..', 'src', 'test', 'fixtures')

// Stands in for the file under verification. Only the results that carry no
// location of their own are placed here.
const SUBJECT = '/src/subject.c'

// A real report from `esbmc fails.c --sarif-output`, with only the absolute
// source path made portable.
const violation = fs.readFileSync(path.join(FIXTURES, 'violation.sarif'), 'utf8')

// A real report from `esbmc b.py --sarif-output` on ESBMC 8.5.0, verbatim: the
// Python uncaught-exception properties carry no location at all.
const pythonUnlocated = fs.readFileSync(path.join(FIXTURES, 'python-unlocated.sarif'), 'utf8')

function sarif (results: unknown[]): string {
  return JSON.stringify({ version: '2.1.0', runs: [{ results }] })
}

describe('parseSarif', () => {
  it('reads a real ESBMC violation report', () => {
    const findings = parseSarif(violation, SUBJECT)
    assert.strictEqual(findings.length, 1)
    assert.deepStrictEqual(findings[0], {
      file: '/src/fails.c',
      line: 5,
      column: undefined,
      message: "array bounds violated: array `values' upper bound",
      ruleId: 'array-bounds-violated',
      severity: 'error',
      cwes: ['CWE-121', 'CWE-125', 'CWE-129', 'CWE-131', 'CWE-193', 'CWE-787']
    })
  })

  // ESBMC writes no report at all when everything holds, but an empty one has
  // the same meaning: nothing was violated.
  it('returns nothing for a report with no results', () => {
    assert.deepStrictEqual(parseSarif(sarif([]), SUBJECT), [])
    assert.deepStrictEqual(parseSarif(JSON.stringify({ version: '2.1.0', runs: [] }), SUBJECT), [])
  })

  it('reports every violated property', () => {
    const results = [1, 2].map(line => ({
      level: 'error',
      message: { text: `failure ${line}` },
      locations: [{ physicalLocation: { artifactLocation: { uri: '/a.c' }, region: { startLine: line } } }]
    }))
    assert.deepStrictEqual(parseSarif(sarif(results), SUBJECT).map(f => f.line), [1, 2])
  })

  it('keeps the column when ESBMC gives one', () => {
    const [finding] = parseSarif(sarif([{
      level: 'warning',
      message: { text: 'x' },
      locations: [{ physicalLocation: { artifactLocation: { uri: '/a.c' }, region: { startLine: 7, startColumn: 9 } } }]
    }]), SUBJECT)
    assert.strictEqual(finding.line, 7)
    assert.strictEqual(finding.column, 9)
    assert.strictEqual(finding.severity, 'warning')
  })

  it('defaults a missing line to the top of the file', () => {
    const [finding] = parseSarif(sarif([{
      message: { text: 'x' },
      locations: [{ physicalLocation: { artifactLocation: { uri: '/a.c' } } }]
    }]), SUBJECT)
    assert.strictEqual(finding.line, 1)
  })

  it('treats an unknown or missing level as an error', () => {
    for (const level of [undefined, 'none', 'nonsense']) {
      const [finding] = parseSarif(sarif([{
        level,
        message: { text: 'x' },
        locations: [{ physicalLocation: { artifactLocation: { uri: '/a.c' }, region: { startLine: 1 } } }]
      }]), SUBJECT)
      assert.strictEqual(finding.severity, level === 'none' ? 'note' : 'error', `level ${String(level)}`)
    }
  })

  it('collects CWE taxa and ignores taxonomies that are not CWE', () => {
    const [finding] = parseSarif(sarif([{
      message: { text: 'x' },
      locations: [{ physicalLocation: { artifactLocation: { uri: '/a.c' }, region: { startLine: 1 } } }],
      taxa: [
        { id: '787', toolComponent: { name: 'CWE' } },
        { id: 'RULE-1', toolComponent: { name: 'MISRA' } },
        { id: '125' }
      ]
    }]), SUBJECT)
    assert.deepStrictEqual(finding.cwes, ['CWE-787'])
  })

  it('strips a file:// prefix from the location', () => {
    const [finding] = parseSarif(sarif([{
      message: { text: 'x' },
      locations: [{ physicalLocation: { artifactLocation: { uri: 'file:///a.c' }, region: { startLine: 1 } } }]
    }]), SUBJECT)
    assert.strictEqual(finding.file, '/a.c')
  })

  // A result with no message names no property, and one with no locations at
  // all never reaches the fallback, so neither can become a diagnostic.
  it('drops results with no message, and results with no locations', () => {
    assert.deepStrictEqual(parseSarif(sarif([
      { message: { text: 'no locations' } },
      { locations: [{ physicalLocation: { artifactLocation: { uri: '/a.c' } } }] }
    ]), SUBJECT), [])
  })

  // ESBMC 8.5.0 synthesizes the Python uncaught-exception properties at the
  // entry epilogue, which carries no location, so they arrive unplaceable.
  it('places an unlocated result on the file being verified', () => {
    const [finding] = parseSarif(pythonUnlocated, '/src/b.py')
    assert.strictEqual(finding.file, '/src/b.py')
    assert.strictEqual(finding.line, 1)
    assert.strictEqual(finding.message, 'uncaught exception: IndexError')
  })

  it('places a result whose location has no artifact at all', () => {
    const [finding] = parseSarif(sarif([{
      message: { text: 'x' },
      locations: [{ physicalLocation: { region: { startLine: 3 } } }]
    }]), SUBJECT)
    assert.strictEqual(finding.file, SUBJECT)
    assert.strictEqual(finding.line, 3)
  })

  // The subject is a fallback, never an override: a located result keeps the
  // file ESBMC named, which for an included header is not the file verified.
  it('prefers the location ESBMC gave over the subject', () => {
    const [finding] = parseSarif(sarif([{
      message: { text: 'x' },
      locations: [{ physicalLocation: { artifactLocation: { uri: 'inc/hdr.h' }, region: { startLine: 7 } } }]
    }]), SUBJECT)
    assert.strictEqual(finding.file, 'inc/hdr.h')
    assert.strictEqual(finding.line, 7)
  })

  // Nothing legitimate passes an empty subject, but a finding on '' resolves
  // to the directory ESBMC ran in, which is worse than dropping it.
  it('drops an unlocated result when the subject is empty', () => {
    assert.deepStrictEqual(parseSarif(pythonUnlocated, ''), [])
  })

  it('rejects a report that is not JSON', () => {
    assert.throws(() => parseSarif('not json', SUBJECT), SyntaxError)
  })
})

describe('resolveFindingPaths', () => {
  it('leaves an absolute path alone', () => {
    const [finding] = resolveFindingPaths([{ file: '/abs/a.c', line: 1, message: 'x', severity: 'error', cwes: [] }], '/base')
    assert.strictEqual(finding.file, '/abs/a.c')
  })

  // ESBMC names an included header the way it was reached, which can be
  // relative; VS Code would otherwise place the diagnostic on /inc/hdr.h.
  it('resolves a relative header against the directory ESBMC ran in', () => {
    const [finding] = resolveFindingPaths([{ file: 'inc/hdr.h', line: 1, message: 'x', severity: 'error', cwes: [] }], '/base')
    assert.strictEqual(finding.file, path.resolve('/base', 'inc/hdr.h'))
  })

  it('keeps every other field', () => {
    const original = { file: 'a.c', line: 4, message: 'x', severity: 'warning' as const, cwes: ['CWE-1'], ruleId: 'r' }
    const [finding] = resolveFindingPaths([original], '/base')
    assert.deepStrictEqual({ ...finding, file: original.file }, original)
  })
})
