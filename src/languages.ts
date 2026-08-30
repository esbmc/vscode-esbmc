export interface SupportedLanguage {
  /** VS Code language identifier, which is not always the file extension. */
  id: string
  /**
   * Every extension VS Code maps to this id that ESBMC can verify. The
   * extension activates for the id, so anything missing here gets a CodeLens
   * and then a refusal from run().
   */
  extensions: string[]
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { id: 'c', extensions: ['c', 'i'] },
  { id: 'cpp', extensions: ['cpp', 'cc', 'cxx'] },
  { id: 'python', extensions: ['py'] },
  // Contributed by this extension: VS Code ships no solidity language, so
  // without it onLanguage:solidity never fires and .sol files have no id.
  { id: 'solidity', extensions: ['sol'] }
]

/**
 * Extensions VS Code maps to a language above that ESBMC cannot verify.
 *
 * ESBMC chooses its frontend by extension and rejects each of these with
 * "failed to figure out type of file", so refusing them in the editor is the
 * accurate answer rather than a gap. Verified against ESBMC 8.4.0.
 */
export const UNVERIFIABLE_EXTENSIONS = [
  'h', 'hpp', 'hh', 'hxx', 'h++', 'c++', 'ii',
  'pyi', 'pyw', 'rpy', 'cpy', 'gyp', 'gypi', 'ipy'
]

/** Accepted by ESBMC but with no VS Code language of their own. */
const EXTRA_EXTENSIONS = ['jimple']

export const SUPPORTED_EXTENSIONS = new Set([
  ...SUPPORTED_LANGUAGES.flatMap(language => language.extensions),
  ...EXTRA_EXTENSIONS
])
