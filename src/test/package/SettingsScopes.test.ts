import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import { SECTIONS } from '../../parsers/sections'

const ROOT = path.resolve(__dirname, '..', '..', '..')
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))

const settings: Array<[string, any]> = manifest.contributes.configuration.flatMap(
  (group: any) => Object.entries<any>(group.properties)
)

function section (id: string): string {
  return id.split('.')[1]
}

// A `window`-scoped setting never yields a workspaceFolderValue from inspect(),
// whatever resource is passed, so merging the folder scope in the parser would
// be reading a value VS Code cannot produce.
describe('settings scopes', () => {
  it('has the sections the parser reads', () => {
    const covered = new Set(settings.map(([id]) => section(id)))
    for (const parsed of SECTIONS) {
      assert.ok(covered.has(parsed), `no setting contributed for section ${parsed}`)
    }
  })

  it('declares every parsed setting at resource scope', () => {
    for (const [id, setting] of settings) {
      if (!SECTIONS.includes(section(id))) {
        continue
      }
      assert.strictEqual(setting.scope, 'resource', `${id} is not folder-settable`)
    }
  })
})
