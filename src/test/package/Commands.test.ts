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

describe('package.json commands', () => {
  const commands: Array<{ command: string, title: string }> = manifest.contributes.commands

  it('are declared in the manifest', () => {
    assert.ok(commands.length > 0, 'no commands to check')
  })

  // A command contributed but never registered shows up for the user in the
  // command palette and fails with "command not found" when invoked.
  it('are each registered by the extension', () => {
    for (const { command } of commands) {
      assert.ok(
        source.includes(`'${command}'`),
        `${command} is contributed but never passed to registerCommand`
      )
    }
  })

  it('are each titled and namespaced', () => {
    for (const { command, title } of commands) {
      assert.ok(command.startsWith('vscode-esbmc.'), `${command} is not namespaced`)
      assert.ok(title?.trim(), `${command} has no title`)
    }
  })
})
