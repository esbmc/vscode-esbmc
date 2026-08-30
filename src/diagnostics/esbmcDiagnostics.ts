import * as vscode from 'vscode'
import { EsbmcFinding, FindingSeverity } from '../parsers/sarifParser'

const SEVERITIES: Record<FindingSeverity, vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  note: vscode.DiagnosticSeverity.Information
}

/**
 * SARIF counts lines and columns from 1, VS Code from 0.
 *
 * ESBMC reports a line but no column, and an empty range at column 0 renders
 * as no squiggle at all on an indented line, because VS Code only widens an
 * empty range when a word sits at that position. So the range spans the line's
 * text, from its first non-whitespace character to its end.
 *
 * @param lineText The source line, when it is available to measure.
 */
export function toDiagnostic (finding: EsbmcFinding, lineText?: string): vscode.Diagnostic {
  const line = Math.max(0, finding.line - 1)
  const indent = lineText === undefined ? 0 : lineText.length - lineText.trimStart().length
  const start = finding.column !== undefined ? Math.max(0, finding.column - 1) : indent
  const end = lineText === undefined ? Number.MAX_SAFE_INTEGER : Math.max(start, lineText.trimEnd().length)

  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(line, start, line, end),
    finding.cwes.length > 0 ? `${finding.message} (${finding.cwes.join(', ')})` : finding.message,
    SEVERITIES[finding.severity]
  )
  diagnostic.source = 'ESBMC'
  if (finding.ruleId !== undefined) {
    diagnostic.code = finding.ruleId
  }
  return diagnostic
}

function lineTextOf (file: string, line: number): string | undefined {
  const document = vscode.workspace.textDocuments.find(open => open.fileName === file)
  if (document === undefined || line < 1 || line > document.lineCount) {
    return undefined
  }
  return document.lineAt(line - 1).text
}

export class EsbmcDiagnostics {
  private readonly collection: vscode.DiagnosticCollection

  public constructor () {
    this.collection = vscode.languages.createDiagnosticCollection('esbmc')
  }

  public report (findings: EsbmcFinding[]): void {
    const byFile = new Map<string, vscode.Diagnostic[]>()
    for (const finding of findings) {
      const diagnostics = byFile.get(finding.file) ?? []
      diagnostics.push(toDiagnostic(finding, lineTextOf(finding.file, finding.line)))
      byFile.set(finding.file, diagnostics)
    }
    for (const [file, diagnostics] of byFile) {
      this.collection.set(vscode.Uri.file(file), diagnostics)
    }
  }

  /**
   * A run's findings are the whole truth for that run, and a violation can be
   * reported against an included header rather than the file being verified,
   * so everything is cleared rather than just the entry file.
   */
  public clear (): void {
    this.collection.clear()
  }

  public dispose (): void {
    this.collection.dispose()
  }
}
