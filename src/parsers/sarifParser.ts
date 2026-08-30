import * as path from 'path'

export type FindingSeverity = 'error' | 'warning' | 'note'

export interface EsbmcFinding {
  file: string
  line: number
  column?: number
  message: string
  ruleId?: string
  severity: FindingSeverity
  cwes: string[]
}

const SEVERITIES: Record<string, FindingSeverity> = {
  error: 'error',
  warning: 'warning',
  note: 'note',
  none: 'note'
}

function findingFrom (result: any, location: any, subject?: string): EsbmcFinding | undefined {
  const physical = location?.physicalLocation
  const uri = physical?.artifactLocation?.uri
  const file = typeof uri === 'string' && uri !== '' ? uri : subject
  if (file === undefined) {
    return undefined
  }
  const message = result?.message?.text
  if (typeof message !== 'string' || message === '') {
    return undefined
  }
  return {
    file: file.replace(/^file:\/\//, ''),
    line: physical?.region?.startLine ?? 1,
    column: physical?.region?.startColumn,
    message,
    ruleId: typeof result?.ruleId === 'string' ? result.ruleId : undefined,
    severity: SEVERITIES[result?.level] ?? 'error',
    cwes: (result?.taxa ?? [])
      .filter((taxon: any) => taxon?.toolComponent?.name === 'CWE' && taxon?.id !== undefined)
      .map((taxon: any) => `CWE-${String(taxon.id)}`)
  }
}

/**
 * Turns an ESBMC SARIF 2.1.0 report into the violated properties it records.
 *
 * ESBMC emits one result per violated property, so a report with no results
 * means the run proved every property it checked.
 *
 * @param subject the file being verified, used to place a result ESBMC left
 * unlocated. Its Python frontend synthesizes the uncaught-exception properties
 * at the entry epilogue, which carries no source location, so they arrive with
 * an empty URI and no region; dropping them leaves a failing run with nothing
 * to show. Observed on ESBMC 8.5.0. Omit to drop such results instead.
 * @throws SyntaxError if the report is not valid JSON.
 */
export function parseSarif (report: string, subject?: string): EsbmcFinding[] {
  const sarif = JSON.parse(report)
  const findings: EsbmcFinding[] = []
  for (const run of sarif?.runs ?? []) {
    for (const result of run?.results ?? []) {
      // A result with no locations cannot be shown against source.
      for (const location of result?.locations ?? []) {
        const finding = findingFrom(result, location, subject)
        if (finding !== undefined) {
          findings.push(finding)
        }
      }
    }
  }
  return findings
}

/**
 * ESBMC echoes back the path shape it was given, so a finding against an
 * included header can be relative to where ESBMC ran. A relative path would
 * otherwise become a diagnostic on a file that does not exist.
 */
export function resolveFindingPaths (findings: EsbmcFinding[], base: string): EsbmcFinding[] {
  return findings.map(finding => ({
    ...finding,
    file: path.isAbsolute(finding.file) ? finding.file : path.resolve(base, finding.file)
  }))
}
