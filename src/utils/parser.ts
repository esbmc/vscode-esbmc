export interface ParsedEsbmcResult {
  success: boolean
  claimsTotal: number
  claimsFailed: number
  claims: Array<{
    claim: string
    status: string
    file?: string
    line?: number
    description?: string
  }>
}

export function parseEsbmcOutput (output: string): ParsedEsbmcResult {
  const lines = output.split('\n')

  const result: ParsedEsbmcResult = {
    success: output.includes('VERIFICATION SUCCESSFUL'),
    claimsTotal: 0,
    claimsFailed: 0,
    claims: []
  }

  const claimRegex = /\[.*?\] (.*?): (FAIL|SUCCESS)/i
  const locationRegex = /file (.*) line (\d+)/i

  for (const line of lines) {
    const claimMatch = line.match(claimRegex)
    if (claimMatch) {
      const claim = claimMatch[1]
      const status = claimMatch[2]
      const locationMatch = line.match(locationRegex)

      result.claims.push({
        claim: claim.trim(),
        status: status.toUpperCase(),
        file: locationMatch?.[1],
        line: locationMatch ? parseInt(locationMatch[2]) : undefined,
        description: line.trim()
      })

      result.claimsTotal++
      if (status.toUpperCase() === 'FAIL') result.claimsFailed++
    }
  }

  return result
}
