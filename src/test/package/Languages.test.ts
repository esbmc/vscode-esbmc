import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import { SUPPORTED_LANGUAGES, SUPPORTED_EXTENSIONS } from '../../languages'

const ROOT = path.resolve(__dirname, '..', '..', '..')
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const activationEvents: string[] = manifest.activationEvents

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

  it('accepts the file extension of every supported language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      for (const extension of language.extensions) {
        assert.ok(SUPPORTED_EXTENSIONS.has(extension), `.${extension} is not accepted`)
      }
    }
  })
})
