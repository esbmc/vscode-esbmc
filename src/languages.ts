import * as path from 'path'

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

/**
 * Whether ESBMC can verify this path, judged the way ESBMC judges it.
 *
 * Takes a path rather than a document because a chat request often carries
 * only a file reference, with nothing open in an editor.
 */
export function isSupportedFile (file: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extensionOf(file))
}

const LANGUAGE_BY_EXTENSION = new Map(
  SUPPORTED_LANGUAGES.flatMap(language => language.extensions.map(ext => [ext, language.id] as const))
)

function extensionOf (file: string): string {
  return path.extname(file).slice(1).toLowerCase()
}

/**
 * The language a file is written in, or undefined for one ESBMC accepts
 * without VS Code naming it. Derived from {@link SUPPORTED_LANGUAGES} so a
 * new language cannot be verifiable but described to a model as some other.
 */
export function languageOf (file: string): string | undefined {
  return LANGUAGE_BY_EXTENSION.get(extensionOf(file))
}
