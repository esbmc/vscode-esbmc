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

  // Without the query the badge falls back to the most recent run across all
  // branches whenever master has none, which reports a branch nobody merged.
  it('reports master on the build badge', () => {
    assert.match(readme, /badge\.svg\?branch=master&event=push/)
  })

  // Both listings 404 until the first publish, so a link to either is a broken
  // promise on the front page.
  it('links to no registry listing that does not exist yet', () => {
    assert.doesNotMatch(readme, /marketplace\.visualstudio\.com\/items/)
    assert.doesNotMatch(readme, /open-vsx\.org\/extension/)
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

// The README is the Marketplace listing, and the Marketplace serves its
// relative images by rewriting them to raw GitHub URLs. A moved or renamed
// screenshot therefore breaks the listing rather than anything in the build.
describe('README screenshots', () => {
  const images = [...readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(([, src]) => src)
  // Badges are absolute URLs and would otherwise satisfy this on their own.
  const screenshots = images.filter(src => !/^https?:/.test(src))

  it('shows at least one screenshot', () => {
    assert.ok(screenshots.length > 0, 'the listing has no screenshot of its own')
  })

  it('references only images that exist', () => {
    for (const src of images) {
      if (/^https?:/.test(src)) continue
      assert.ok(fs.existsSync(path.join(ROOT, src)), `README references missing image ${src}`)
    }
  })

  // vsce rejects SVG from hosts outside its trusted list. Badges are absolute
  // URLs it validates against that list at package time; the images the
  // repository carries are never trusted, so those are the ones to check.
  it('carries no SVG of its own', () => {
    for (const src of images) {
      if (/^https?:/.test(src)) continue
      assert.ok(!/\.svg(\?|$)/i.test(src), `${src} is an SVG, which vsce rejects from the repository`)
    }
  })

  it('gives every screenshot alt text', () => {
    for (const [, alt, src] of readme.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
      assert.ok(alt.trim().length > 0, `the image ${src} has no alt text`)
    }
  })
})
