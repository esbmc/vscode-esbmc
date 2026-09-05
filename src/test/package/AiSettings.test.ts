import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..', '..', '..')

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const backendSource = fs.readFileSync(path.join(ROOT, 'src', 'ai', 'backend.ts'), 'utf8')

const ai: Record<string, any> = manifest.contributes.configuration
  .find((group: any) => group.id === 'ai').properties

describe('AI settings', () => {
  // A value offered in the Settings UI that the dispatcher does not know
  // leaves the user with a setting that silently does nothing.
  it('offer only backends the extension implements', () => {
    for (const backend of ai['esbmc.ai.backend'].enum) {
      assert.ok(
        backendSource.includes(`'${String(backend)}'`),
        `esbmc.ai.backend offers ${String(backend)}, which src/ai/backend.ts does not handle`
      )
    }
  })

  it('default to a backend that needs no second install', () => {
    assert.strictEqual(ai['esbmc.ai.backend'].default, 'chat')
  })

  // `#setting#` renders as a link only in markdownDescription; in a plain
  // description the user sees the raw hashes.
  it('describe themselves in markdown wherever they link another setting', () => {
    for (const [id, setting] of Object.entries(ai)) {
      if (typeof setting.description === 'string') {
        assert.doesNotMatch(setting.description, /`#[\w.]+#`/, `${id} links a setting from a plain description`)
      }
    }
  })

  // An esbmc-ai repair loop re-verifies its own patch, so it outlives a
  // single ESBMC run by a wide margin.
  it('bound an AI backend separately from one ESBMC run', () => {
    assert.ok(ai['esbmc.ai.timeout'].default > manifest.contributes.configuration
      .find((group: any) => group.id === 'editor').properties['esbmc.editor.timeout'].default)
  })
})
