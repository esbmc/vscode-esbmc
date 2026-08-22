import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import { execFile } from 'child_process'
import { EXAMPLE_PATH } from '../../commands/examplePath'

const ROOT = path.resolve(__dirname, '..', '..', '..')

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))

interface Step {
  id: string
  title: string
  description: string
  media: { markdown?: string }
  completionEvents?: string[]
}

const walkthroughs: Array<{ id: string, title: string, steps: Step[] }> = manifest.contributes.walkthroughs
const steps = walkthroughs.flatMap(walkthrough => walkthrough.steps)
const contributedCommands: string[] = manifest.contributes.commands.map((c: any) => c.command)
const activationEvents: string[] = manifest.activationEvents

const EXAMPLE = path.join(ROOT, ...EXAMPLE_PATH)

function exampleSource (): string {
  return fs.readFileSync(EXAMPLE, 'utf8')
}

function media (id: string): string {
  const step = steps.find(s => s.id === id)
  assert.ok(step?.media.markdown, `no markdown media for step ${id}`)
  return fs.readFileSync(path.join(ROOT, step.media.markdown as string), 'utf8')
}

describe('welcome walkthrough', () => {
  it('contributes steps', () => {
    assert.ok(walkthroughs.length > 0, 'no walkthroughs contributed')
    assert.ok(steps.length > 0, 'walkthrough has no steps')
  })

  it('points every step at a bundled markdown file', () => {
    for (const step of steps) {
      const markdown = step.media.markdown
      assert.ok(markdown, `${step.id} has no markdown media`)
      const file = path.join(ROOT, markdown)
      assert.ok(fs.existsSync(file), `${step.id} references missing media ${markdown}`)
      assert.ok(fs.readFileSync(file, 'utf8').trim(), `${step.id} references empty media ${markdown}`)
    }
  })

  // A command: link or completion event naming a command the extension does not
  // contribute leaves a step that can never be run or never completes.
  it('only links commands the extension contributes', () => {
    for (const step of steps) {
      for (const [, command] of step.description.matchAll(/\(command:([\w.-]+)\)/g)) {
        assert.ok(contributedCommands.includes(command), `${step.id} links unknown command ${command}`)
      }
      for (const event of step.completionEvents ?? []) {
        if (event.startsWith('onCommand:')) {
          const command = event.slice('onCommand:'.length)
          assert.ok(contributedCommands.includes(command), `${step.id} completes on unknown command ${command}`)
        }
      }
    }
  })

  // engines.vscode is ^1.68, which predates generated activation events, so a
  // linked command with no onCommand entry silently does nothing on a cold start.
  it('can activate the extension for every command it links', () => {
    for (const step of steps) {
      for (const [, command] of step.description.matchAll(/\(command:([\w.-]+)\)/g)) {
        assert.ok(
          activationEvents.includes(`onCommand:${command}`),
          `${step.id} links ${command}, which has no onCommand activation event`
        )
      }
    }
  })

  it('gives every step a unique id and a title', () => {
    const ids = steps.map(step => step.id)
    assert.strictEqual(new Set(ids).size, ids.length, `duplicate step ids in ${ids.join(', ')}`)
    for (const step of steps) {
      assert.ok(step.title?.trim(), `${step.id} has no title`)
    }
  })

  it('bundles the example program the walkthrough opens', () => {
    assert.ok(fs.existsSync(EXAMPLE), `${EXAMPLE_PATH.join('/')} is missing`)
    assert.match(exampleSource(), /int main\s*\(/)
  })

  it('quotes the example verbatim', () => {
    const quoted = /```c\n([\s\S]*?)```/.exec(media('openExample'))
    assert.ok(quoted, 'open-example.md quotes no C code')
    assert.ok(exampleSource().includes(quoted[1].trim()), 'open-example.md has drifted from the example')
  })

  it('cites the line the example actually writes out of bounds', () => {
    const cited = /line (\d+)/.exec(media('counterexample'))
    assert.ok(cited, 'counterexample.md cites no line')
    const line = exampleSource().split('\n')[Number(cited[1]) - 1]
    assert.match(line, /values\[i\]/, `counterexample.md cites line ${cited[1]}, which is "${line.trim()}"`)
  })
})

// The walkthrough promises a counterexample in one click, so the bundled
// example has to actually fail. Skipped where ESBMC is not installed.
describe('bundled example', function () {
  this.timeout(120000)

  it('fails verification under ESBMC', async function () {
    const output = await new Promise<string>(resolve => {
      execFile('esbmc', [EXAMPLE], (error: any, stdout, stderr) => {
        resolve(error?.code === 'ENOENT' ? '' : stdout + stderr)
      })
    })
    if (output === '') {
      this.skip()
    }
    assert.match(output, /VERIFICATION FAILED/)
    assert.match(output, /array bounds violated/)
  })
})
