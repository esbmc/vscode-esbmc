import * as assert from 'assert'
import * as vscode from 'vscode'
import { toDiagnostic } from '../../diagnostics/esbmcDiagnostics'
import { EsbmcFinding } from '../../parsers/sarifParser'

function finding (overrides: Partial<EsbmcFinding> = {}): EsbmcFinding {
  return {
    file: '/a.c',
    line: 13,
    message: 'array bounds violated',
    severity: 'error',
    cwes: [],
    ...overrides
  }
}

describe('toDiagnostic', () => {
  // SARIF counts lines and columns from 1, VS Code from 0.
  it('converts the location to a zero-based range', () => {
    const diagnostic = toDiagnostic(finding({ line: 13, column: 5 }))
    assert.strictEqual(diagnostic.range.start.line, 12)
    assert.strictEqual(diagnostic.range.start.character, 4)
  })

  it('starts at the beginning of the line when ESBMC gives no column', () => {
    assert.strictEqual(toDiagnostic(finding()).range.start.character, 0)
  })

  it('never produces a negative position', () => {
    const diagnostic = toDiagnostic(finding({ line: 0, column: 0 }))
    assert.strictEqual(diagnostic.range.start.line, 0)
    assert.strictEqual(diagnostic.range.start.character, 0)
  })

  // The reason lineText exists: an empty range at column 0 renders as no
  // squiggle at all on an indented line, so the range has to span the code.
  it('spans the code on the line when the source is available', () => {
    const diagnostic = toDiagnostic(finding(), '    values[i] = i;')
    assert.strictEqual(diagnostic.range.start.character, 4, 'starts at the first non-whitespace character')
    assert.strictEqual(diagnostic.range.end.character, 18, 'ends at the last')
  })

  it('stops at the end of the code, not the end of the trailing whitespace', () => {
    const diagnostic = toDiagnostic(finding(), '  x = 1;   ')
    assert.strictEqual(diagnostic.range.start.character, 2)
    assert.strictEqual(diagnostic.range.end.character, 8)
  })

  // ESBMC gives no column, but a comment-flag override or another producer can.
  it('keeps a reported column as the start, and never ends before it', () => {
    const withColumn = toDiagnostic(finding({ column: 7 }), '    values[i] = i;')
    assert.strictEqual(withColumn.range.start.character, 6)

    const pastTheEnd = toDiagnostic(finding({ column: 40 }), '  x = 1;')
    assert.ok(
      pastTheEnd.range.end.character >= pastTheEnd.range.start.character,
      'the range ends before it starts'
    )
  })

  it('spans a blank line without inverting the range', () => {
    const diagnostic = toDiagnostic(finding(), '    ')
    assert.strictEqual(diagnostic.range.start.character, 4)
    assert.strictEqual(diagnostic.range.end.character, 4)
  })

  // Without the source, the range runs to the end of whatever is there.
  it('runs to the end of the line when the source is not available', () => {
    assert.strictEqual(toDiagnostic(finding()).range.end.character, Number.MAX_SAFE_INTEGER)
  })

  it('maps severities onto the VS Code scale', () => {
    assert.strictEqual(toDiagnostic(finding({ severity: 'error' })).severity, vscode.DiagnosticSeverity.Error)
    assert.strictEqual(toDiagnostic(finding({ severity: 'warning' })).severity, vscode.DiagnosticSeverity.Warning)
    assert.strictEqual(toDiagnostic(finding({ severity: 'note' })).severity, vscode.DiagnosticSeverity.Information)
  })

  it('attributes the diagnostic to ESBMC and its property', () => {
    const diagnostic = toDiagnostic(finding({ ruleId: 'array-bounds-violated' }))
    assert.strictEqual(diagnostic.source, 'ESBMC')
    assert.strictEqual(diagnostic.code, 'array-bounds-violated')
  })

  it('appends the CWEs to the message when ESBMC reports any', () => {
    assert.strictEqual(
      toDiagnostic(finding({ cwes: ['CWE-125', 'CWE-787'] })).message,
      'array bounds violated (CWE-125, CWE-787)'
    )
    assert.strictEqual(toDiagnostic(finding()).message, 'array bounds violated')
  })
})
