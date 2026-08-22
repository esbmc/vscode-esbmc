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
