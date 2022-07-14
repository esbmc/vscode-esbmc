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
      value = value || []
      value.forEach(function (element: any) {
        // Functions have kind 11
        if (element.kind === 11) {
          const lineStart = element.location.range._start._line
          const charStart = element.location.range._start._character
          const lineEnd = element.location.range._end._line
          const charEnd = element.location.range._end._character
          const pos = new Range(lineStart, charStart, lineEnd, charEnd)
          const functionName = element.name.split('(')[0]
          const c: Command = {
            command: 'vscode-esbmc.verify.function',
            title: 'ESBMC: Verify function',
            arguments: [{ bmc: { mainFunction: functionName } }]
          }
          result = result.concat(new CodeLens(pos, c))
        }
      })
    }, function (reason) {
      console.error(reason)
    })

    await a
    return result
  }
}
