import {
  CodeLensProvider,
  TextDocument,
  CodeLens,
  Range,
  Command,
  commands, Uri
} from 'vscode'

export class EsbmcCodeLensProvider implements CodeLensProvider {
  async provideCodeLenses (document: TextDocument): Promise<CodeLens[]> {
    const uri = Uri.file(document.uri.path.toString())
    let result: any[] = []
    const a = commands.executeCommand('vscode.executeDocumentSymbolProvider', uri)
    a.then(function (value: any | undefined) {
      result = parseDocSymbolsForCodeLens(value, document)
    }, function (reason) {
      console.error(reason)
    })

    await a
    return result
  }
}

function parseDocSymbolsForCodeLens (value: any | undefined, document: TextDocument): any[] {
  value = value || []
  let result: CodeLens[] = []
  let previousFunctionLineEnd = 0
  value.forEach(function (element: any) {
    // Functions have kind 11
    if (element.kind === 11) {
      const lineStart = element.location.range._start._line
      const charStart = element.location.range._start._character
      const lineEnd = element.location.range._end._line
      const charEnd = element.location.range._end._character
      const functionPosition = new Range(lineStart, charStart, lineEnd, charEnd)
      const functionName = element.name.split('(')[0]
      const commentFlags = checkForEsbmcCommentFlags(document, lineStart, previousFunctionLineEnd)
      const flagArguments = commentFlags === undefined
        ? [{ bmc: { mainFunction: functionName } }]
        : [{ bmc: { mainFunction: functionName } }, `${commentFlags} --function ${functionName}`]
      const command: Command = {
        command: 'vscode-esbmc.verify.function.codelens',
        title: 'ESBMC: Verify function',
        arguments: flagArguments
      }
      result = result.concat(new CodeLens(functionPosition, command))
      // Update previous ending line
      previousFunctionLineEnd = lineEnd
    }
  })
  return result
}

function checkForEsbmcCommentFlags (document: TextDocument, functionLineStart: number, previousFunctionLineEnd: number) {
  const esbmcCommentTag = '@esbmc-verify'
  const comment = getFunctionComment(document, functionLineStart, previousFunctionLineEnd)
  // No comment so ignore
  if (comment === null) {
    return undefined
  }
  // Check comment for @esbmc-verify tag
  const lines = comment.split('\n')
  const match = lines.find(element => {
    if (element.includes(esbmcCommentTag)) {
      return true
    }
    return false
  })
  // If we find a matching comment flag, we return the written flags
  if (match !== undefined) {
    let flags = match.substring(match.indexOf(esbmcCommentTag) + esbmcCommentTag.length)
    if (!(flags.trim() === '')) {
      flags = flags.replace(/--function (\w*)/g, '')
      return flags
    }
  }
}

/**
 * Gets function comments from a document between two
 * @param document
 * @param functionLineStart
 * @param previousFunctionLineEnd
 */
function getFunctionComment (document: TextDocument, functionLineStart: number, previousFunctionLineEnd: number): string | null {
  const commentRange = new Range(previousFunctionLineEnd, 0, functionLineStart, 0)
  const text = document.getText(commentRange)
  const regex = /(\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*+\/)|(\/\/.*)/g
  const matches = text.match(regex)
  if (matches === null) {
    return null
  }
  return matches[0]
}
