import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import { parseSarif, resolveFindingPaths } from '../../parsers/sarifParser'

const FIXTURE = path.resolve(__dirname, '..', '..', '..', 'src', 'test', 'fixtures', 'violation.sarif')

// A real report from `esbmc fails.c --sarif-output`, with only the absolute
// source path made portable.
const violation = fs.readFileSync(FIXTURE, 'utf8')

function sarif (results: unknown[]): string {
  return JSON.stringify({ version: '2.1.0', runs: [{ results }] })
}

describe('parseSarif', () => {
  it('reads a real ESBMC violation report', () => {
    const findings = parseSarif(violation)
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
    assert.deepStrictEqual(parseSarif(sarif([])), [])
    assert.deepStrictEqual(parseSarif(JSON.stringify({ version: '2.1.0', runs: [] })), [])
  })

  it('reports every violated property', () => {
    const results = [1, 2].map(line => ({
      level: 'error',
      message: { text: `failure ${line}` },
      locations: [{ physicalLocation: { artifactLocation: { uri: '/a.c' }, region: { startLine: line } } }]
    }))
    assert.deepStrictEqual(parseSarif(sarif(results)).map(f => f.line), [1, 2])
  })

  it('keeps the column when ESBMC gives one', () => {
    const [finding] = parseSarif(sarif([{
      level: 'warning',
      message: { text: 'x' },
      locations: [{ physicalLocation: { artifactLocation: { uri: '/a.c' }, region: { startLine: 7, startColumn: 9 } } }]
    }]))
    assert.strictEqual(finding.line, 7)
    assert.strictEqual(finding.column, 9)
    assert.strictEqual(finding.severity, 'warning')
  })

  it('defaults a missing line to the top of the file', () => {
    const [finding] = parseSarif(sarif([{
      message: { text: 'x' },
      locations: [{ physicalLocation: { artifactLocation: { uri: '/a.c' } } }]
    }]))
    assert.strictEqual(finding.line, 1)
  })

  it('treats an unknown or missing level as an error', () => {
    for (const level of [undefined, 'none', 'nonsense']) {
      const [finding] = parseSarif(sarif([{
        level,
        message: { text: 'x' },
        locations: [{ physicalLocation: { artifactLocation: { uri: '/a.c' }, region: { startLine: 1 } } }]
      }]))
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
    }]))
    assert.deepStrictEqual(finding.cwes, ['CWE-787'])
  })

  it('strips a file:// prefix from the location', () => {
    const [finding] = parseSarif(sarif([{
      message: { text: 'x' },
      locations: [{ physicalLocation: { artifactLocation: { uri: 'file:///a.c' }, region: { startLine: 1 } } }]
    }]))
    assert.strictEqual(finding.file, '/a.c')
  })

  // A result we cannot place in a file would become a diagnostic with nowhere
  // to go, so it is dropped rather than pinned to the wrong line.
  it('drops results with no usable location or message', () => {
    assert.deepStrictEqual(parseSarif(sarif([
      { message: { text: 'no locations' } },
      { message: { text: 'no uri' }, locations: [{ physicalLocation: { region: { startLine: 1 } } }] },
      { locations: [{ physicalLocation: { artifactLocation: { uri: '/a.c' } } }] }
    ])), [])
  })

  it('rejects a report that is not JSON', () => {
    assert.throws(() => parseSarif('not json'), SyntaxError)
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
