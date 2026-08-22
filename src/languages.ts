export interface SupportedLanguage {
  /** VS Code language identifier, which is not always the file extension. */
  id: string
  extensions: string[]
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { id: 'c', extensions: ['c'] },
  { id: 'cpp', extensions: ['cpp'] },
  { id: 'python', extensions: ['py'] },
  { id: 'solidity', extensions: ['sol'] }
]

/** Accepted by ESBMC but with no VS Code language of their own. */
const EXTRA_EXTENSIONS = ['jimple']

export const SUPPORTED_EXTENSIONS = new Set([
  ...SUPPORTED_LANGUAGES.flatMap(language => language.extensions),
  ...EXTRA_EXTENSIONS
])
