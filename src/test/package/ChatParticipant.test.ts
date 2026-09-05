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

/** [major, minor] of a range like `^1.95.0`, which is how VS Code is versioned. */
function version (range: string): [number, number] {
  const [, major, minor] = /(\d+)\.(\d+)/.exec(range) ?? []
  return [Number(major), Number(minor)]
}

function compare (a: string, b: string): number {
  const [aMajor, aMinor] = version(a)
  const [bMajor, bMinor] = version(b)
  return aMajor - bMajor !== 0 ? aMajor - bMajor : aMinor - bMinor
}

describe('chat participant', () => {
  const participants: Array<Record<string, any>> = manifest.contributes.chatParticipants

  it('is contributed', () => {
    assert.strictEqual(participants?.length, 1)
  })

  it('is named, described and registered', () => {
    const [participant] = participants
    assert.ok(participant.name?.trim(), 'no name to type after @')
    assert.ok(participant.fullName?.trim(), 'no full name')
    assert.ok(participant.description?.trim(), 'no description')
    assert.ok(
      source.includes(`'${String(participant.id)}'`),
      `${String(participant.id)} is contributed but never passed to createChatParticipant`
    )
  })

  // Without this the participant is contributed but the extension is never
  // started, so @esbmc answers nothing on a cold window. Chat participants
  // are not among the contributions VS Code activates on its own.
  it('activates the extension', () => {
    assert.ok(manifest.activationEvents.includes(`onChatParticipant:${String(participants[0].id)}`))
  })

  // That each one is *handled*, and handled distinctly, is asserted against
  // the handler itself in src/test/chat/Handler.test.ts; a grep of src/ for
  // the name cannot fail, since all three occur elsewhere.
  it('describes every slash command it advertises', () => {
    for (const command of participants[0].commands) {
      assert.ok(command.name?.trim(), 'a command with no name')
      assert.ok(command.description?.trim(), `${String(command.name)} has no description`)
    }
  })
})

describe('chat API compatibility', () => {
  // ChatRequest.model, which is how @esbmc answers with the model the user
  // picked, arrived in 1.95. Anything older has no chat participants at all.
  it('requires a VS Code that has the chat API', () => {
    assert.ok(compare(manifest.engines.vscode, '1.95.0') >= 0, manifest.engines.vscode)
  })

  // vsce refuses to package an extension whose typings promise more API than
  // its engine range can deliver.
  it('is typed against no more API than it requires', () => {
    assert.ok(
      compare(manifest.devDependencies['@types/vscode'], manifest.engines.vscode) <= 0,
      `@types/vscode ${String(manifest.devDependencies['@types/vscode'])} is ahead of engines.vscode ${String(manifest.engines.vscode)}`
    )
  })
})
