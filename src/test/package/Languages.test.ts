import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import { SUPPORTED_LANGUAGES, SUPPORTED_EXTENSIONS, UNVERIFIABLE_EXTENSIONS } from '../../languages'

const ROOT = path.resolve(__dirname, '..', '..', '..')
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const activationEvents: string[] = manifest.activationEvents
const contributedLanguages: any[] = manifest.contributes.languages ?? []

// Which extensions VS Code opens under each id we activate for: the built-in
// c, cpp and python contributions, and the solidity language contributed by
// this extension. An id activates the extension for every file below, so this
// is the set run() is answerable for.
const VS_CODE_EXTENSIONS: Record<string, string[]> = {
  c: ['c', 'i', 'h'],
  cpp: ['cpp', 'cc', 'cxx', 'c++', 'hpp', 'hh', 'hxx', 'h++', 'ii'],
  python: ['py', 'pyi', 'pyw', 'rpy', 'cpy', 'gyp', 'gypi', 'ipy'],
  solidity: ['sol']
}

describe('supported languages', () => {
  it('lists the languages ESBMC verifies', () => {
    assert.deepStrictEqual(
      SUPPORTED_LANGUAGES.map(language => language.id).sort(),
      ['c', 'cpp', 'python', 'solidity']
    )
  })

  // Without an onLanguage event the extension never starts for that language,
  // so its CodeLens never appears and its commands are not registered.
  it('activates the extension for every supported language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      assert.ok(
        activationEvents.includes(`onLanguage:${language.id}`),
        `${language.id} has no onLanguage activation event`
      )
    }
  })

  // The VS Code language identifier is not the file extension: Python is
  // "python", not "py", and Solidity is "solidity", not "sol".
  it('does not confuse a language identifier with a file extension', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      if (language.id === 'c' || language.id === 'cpp') {
        continue
      }
      assert.ok(
        !language.extensions.includes(language.id),
        `${language.id} looks like a file extension rather than a language id`
      )
    }
  })

  it('verifies every language it activates for', () => {
    const activated = activationEvents
      .filter(event => event.startsWith('onLanguage:'))
      .map(event => event.slice('onLanguage:'.length))
    for (const id of activated) {
      assert.ok(
        SUPPORTED_LANGUAGES.some(language => language.id === id),
        `the extension activates for ${id} but cannot verify it`
      )
    }
  })

  // VS Code contributes no solidity language, so without this the activation
  // event never fires and a .sol file has no language id to match on.
  it('contributes the solidity language nothing else provides', () => {
    const solidity = contributedLanguages.find(language => language.id === 'solidity')
    assert.ok(solidity, 'the manifest contributes no solidity language')
    assert.deepStrictEqual(solidity.extensions, ['.sol'])
  })

  // The gap this closes: activating for an id covers every file VS Code opens
  // under it, and run() then refuses the ones not listed here.
  it('claims only extensions VS Code maps to that language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const known = VS_CODE_EXTENSIONS[language.id]
      assert.ok(known, `no VS Code mapping recorded for ${language.id}`)
      for (const extension of language.extensions) {
        assert.ok(known.includes(extension), `VS Code does not open .${extension} as ${language.id}`)
      }
    }
  })

  it('accounts for every extension its languages cover', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      for (const extension of VS_CODE_EXTENSIONS[language.id]) {
        assert.ok(
          SUPPORTED_EXTENSIONS.has(extension) || UNVERIFIABLE_EXTENSIONS.includes(extension),
          `.${extension} opens as ${language.id} but is neither verified nor listed as unverifiable`
        )
      }
    }
  })

  it('accepts no extension it also calls unverifiable', () => {
    for (const extension of UNVERIFIABLE_EXTENSIONS) {
      assert.ok(!SUPPORTED_EXTENSIONS.has(extension), `.${extension} is both accepted and unverifiable`)
    }
  })

  it('accepts the file extension of every supported language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      for (const extension of language.extensions) {
        assert.ok(SUPPORTED_EXTENSIONS.has(extension), `.${extension} is not accepted`)
      }
    }
  })
})
