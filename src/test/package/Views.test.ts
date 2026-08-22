import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..', '..', '..')
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))

function sourceFiles (dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === 'test' ? [] : sourceFiles(full)
    }
    return entry.name.endsWith('.ts') ? [full] : []
  })
}

const source = sourceFiles(path.join(ROOT, 'src'))
  .map(file => fs.readFileSync(file, 'utf8'))
  .join('\n')

const views: Array<{ id: string, name: string, when?: string }> =
  Object.values(manifest.contributes.views ?? {}).flat() as any
const commands: string[] = manifest.contributes.commands.map((c: any) => c.command)

describe('contributed views', () => {
  it('contributes the counterexample view', () => {
    assert.ok(views.some(view => view.id === 'esbmc.trace'), 'esbmc.trace is not contributed')
  })

  it('registers a provider for every contributed view', () => {
    for (const view of views) {
      assert.ok(
        source.includes(`'${view.id}'`),
        `${view.id} is contributed but no provider registers it`
      )
    }
  })

  // A `when` clause naming a context key nothing sets leaves a view that never
  // appears, and nothing else would catch it.
  it('sets every context key its views gate on', () => {
    for (const view of views) {
      for (const [, key] of (view.when ?? '').matchAll(/([\w.]+)/g)) {
        if (!key.startsWith('esbmc.')) {
          continue
        }
        assert.ok(
          source.includes(`'${key}'`),
          `${view.id} is gated on ${key}, which no code sets`
        )
      }
    }
  })

  it('offers only real commands in its welcome content', () => {
    for (const welcome of manifest.contributes.viewsWelcome ?? []) {
      assert.ok(views.some(view => view.id === welcome.view), `welcome for unknown view ${welcome.view}`)
      for (const [, command] of String(welcome.contents).matchAll(/\(command:([\w.-]+)\)/g)) {
        assert.ok(commands.includes(command), `welcome links unknown command ${command}`)
      }
    }
  })
})
