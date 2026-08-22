import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..', '..', '..')

function read (file: string): string {
  return fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n')
}

const manifest = JSON.parse(read('package.json'))
const readme = read('README.md')
const contributing = read('CONTRIBUTING.md')
const scripts = Object.keys(manifest.scripts)

const titles: string[] = manifest.contributes.commands.map((c: any) => c.title)
const editorSettings = Object.keys(
  manifest.contributes.configuration.find((g: any) => g.id === 'editor').properties
)

function commandsTable (): string {
  const table = /## Commands\n([\s\S]*?)\n## /.exec(readme)
  assert.ok(table, 'README has no Commands section')
  return table[1]
}

describe('README', () => {
  // The README is the Marketplace listing, so a command it describes that does
  // not exist is a broken promise to someone who has not installed anything yet.
  it('documents every contributed command', () => {
    for (const title of titles) {
      assert.ok(commandsTable().includes(`\`${title}\``), `the README command table omits "${title}"`)
    }
  })

  // Scoped to the commands table: error messages elsewhere in the README are
  // also prefixed "ESBMC: " without being commands.
  it('lists no command the extension does not contribute', () => {
    for (const [, title] of commandsTable().matchAll(/`(ESBMC: [^`]+)`/g)) {
      assert.ok(titles.includes(title), `README lists "${title}", which is not contributed`)
    }
  })

  it('documents the editor settings', () => {
    for (const setting of editorSettings) {
      assert.ok(readme.includes(`\`${setting}\``), `README does not document ${setting}`)
    }
  })

  it('points at a contributing guide that exists', () => {
    assert.match(readme, /CONTRIBUTING\.md/)
    assert.ok(fs.existsSync(path.join(ROOT, 'CONTRIBUTING.md')), 'CONTRIBUTING.md is missing')
  })

  // The old README walked through a test log that was never in the repository.
  it('references no file that is not in the repository', () => {
    for (const [, file] of readme.matchAll(/`([\w./-]+\.(?:txt|md))`/g)) {
      assert.ok(fs.existsSync(path.join(ROOT, file)), `README references missing file ${file}`)
    }
  })
})

// Same drift the README checks guard against: a renamed script leaves the
// documented command line silently wrong.
describe('CONTRIBUTING', () => {
  it('invokes only scripts package.json defines', () => {
    for (const doc of [contributing, readme]) {
      const referenced = [
        ...doc.matchAll(/\bnpm run ([\w:-]+)/g),
        ...doc.matchAll(/\bnpm (test)\b/g)
      ]
      for (const [, script] of referenced) {
        assert.ok(scripts.includes(script), `the docs run "${script}", which package.json does not define`)
      }
    }
  })

  it('references no file that is not in the repository', () => {
    for (const [, file] of contributing.matchAll(/`([\w./-]+\.(?:txt|md))`/g)) {
      assert.ok(fs.existsSync(path.join(ROOT, file)), `CONTRIBUTING references missing file ${file}`)
    }
  })
})
