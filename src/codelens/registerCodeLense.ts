import { languages, Disposable, DocumentSelector } from 'vscode'
import { EsbmcCodeLensProvider } from './codeLensProvider'

const selector: DocumentSelector = [
  { language: 'c', scheme: 'file' },
  { language: 'cpp', scheme: 'file' },
  { language: 'sol', scheme: 'file' }
]

export function registerCodeLens (): Disposable[] {
  return [
    languages.registerCodeLensProvider(selector, new EsbmcCodeLensProvider())
  ]
}
