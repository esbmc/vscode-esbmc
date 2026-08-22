import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..', '..', '..')
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))

const settings = manifest.contributes.configuration.flatMap(
  (group: any) => Object.entries<any>(group.properties)
)
const ids = new Set(settings.map(([id]: [string, any]) => id))

/** Links appear in the setting description and in each enum value description. */
function descriptions (setting: any): string[] {
  return [setting.markdownDescription, ...(setting.markdownEnumDescriptions ?? [])]
    .filter((text: unknown): text is string => typeof text === 'string')
}

// `#some.setting#` renders as a link to that setting, but only if it names a
// real one; otherwise VS Code shows the raw text with the hashes.
describe('settings links', () => {
  it('has settings to check', () => {
    assert.ok(ids.size > 0)
  })

  it('only links settings that exist', () => {
    for (const [id, setting] of settings) {
      for (const [, target] of descriptions(setting).join('\n').matchAll(/`#([\w.]+)#`/g)) {
        assert.ok(ids.has(target), `${id} links #${target}#, which is not a setting`)
      }
    }
  })

  it('links by full id, not a bare section name', () => {
    for (const [id, setting] of settings) {
      for (const [, target] of descriptions(setting).join('\n').matchAll(/`#([\w.]+)#`/g)) {
        assert.ok(
          target.split('.').length >= 3,
          `${id} links #${target}#, which is missing its configuration section`
        )
      }
    }
  })
})
