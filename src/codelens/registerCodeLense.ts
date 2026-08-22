import { languages, Disposable, DocumentSelector } from 'vscode'
import { EsbmcCodeLensProvider } from './codeLensProvider'
import { SUPPORTED_LANGUAGES } from '../languages'

const selector: DocumentSelector = SUPPORTED_LANGUAGES.map(
  language => ({ language: language.id, scheme: 'file' })
)

export function registerCodeLens (): Disposable[] {
  return [
    languages.registerCodeLensProvider(selector, new EsbmcCodeLensProvider())
  ]
}
