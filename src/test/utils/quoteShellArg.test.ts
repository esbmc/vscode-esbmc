import * as assert from 'assert'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { quoteShellArg, runShellCommand, splitShellArgs } from '../../utils/commands'

// Quoting must follow the platform it is asked about, not the one the tests
// run on: extractCommand builds a Linux unzip command on any host.
describe('quoteShellArg across platforms', () => {
  it('uses POSIX quoting when asked for a POSIX platform', () => {
    for (const platform of ['linux', 'darwin']) {
      assert.strictEqual(quoteShellArg('/a b.c', platform), "'/a b.c'")
      assert.strictEqual(quoteShellArg('$(id)', platform), "'$(id)'")
    }
  })

  it('uses Windows quoting when asked for win32', () => {
    assert.strictEqual(quoteShellArg('C:\\a b.c', 'win32'), '"C:\\a b.c"')
  })

  it('escapes an embedded single quote for POSIX', () => {
    assert.strictEqual(quoteShellArg("it's", 'linux'), "'it'\\''s'")
  })
})

// Double quotes do not stop command substitution on POSIX, so a file name is
// an injection vector wherever it reaches a shell. verifyOnSave makes that
// reachable by saving a file in a hostile checkout.
describe('quoteShellArg', function () {
  this.timeout(60000)

  let dir: string

  before(function () {
    if (process.platform === 'win32') {
      this.skip()
    }
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'esbmc-quote-'))
  })

  after(() => {
    if (dir !== undefined) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('stops command substitution in a file name', async () => {
    const marker = path.join(dir, 'pwned')
    const hostile = path.join(dir, `$(touch ${marker})x.c`)
    await runShellCommand(`echo ${quoteShellArg(hostile)}`)
    assert.strictEqual(fs.existsSync(marker), false, 'the substituted command ran')
  })

  it('stops backtick substitution in a file name', async () => {
    const marker = path.join(dir, 'pwned-backtick')
    const hostile = path.join(dir, '`touch ' + marker + '`x.c')
    await runShellCommand(`echo ${quoteShellArg(hostile)}`)
    assert.strictEqual(fs.existsSync(marker), false, 'the substituted command ran')
  })

  it('passes the value through unchanged', async () => {
    for (const value of ['plain.c', 'with space.c', "it's.c", 'semi;colon.c', '$HOME.c', 'a&b|c.c']) {
      const result = await runShellCommand(`printf %s ${quoteShellArg(value)}`)
      assert.strictEqual(result.stdout, value)
    }
  })

  it('leaves a command substitution intact as literal text', async () => {
    const result = await runShellCommand(`printf %s ${quoteShellArg('$(echo hi)')}`)
    assert.strictEqual(result.stdout, '$(echo hi)')
  })
})

// ESBMC flags arrive as one string, from settings or from MCP agent input, and
// are re-quoted token by token before reaching a shell.
describe('splitShellArgs', () => {
  it('splits on whitespace', () => {
    assert.deepStrictEqual(splitShellArgs('--unwind 10 --overflow-check'), ['--unwind', '10', '--overflow-check'])
  })

  it('reports nothing for an empty or blank string', () => {
    assert.deepStrictEqual(splitShellArgs(''), [])
    assert.deepStrictEqual(splitShellArgs('   \t '), [])
  })

  it('keeps a quoted value together and drops the quotes', () => {
    assert.deepStrictEqual(splitShellArgs('--claim "two words"'), ['--claim', 'two words'])
    assert.deepStrictEqual(splitShellArgs("--claim 'two words'"), ['--claim', 'two words'])
  })

  it('keeps an empty quoted argument', () => {
    assert.deepStrictEqual(splitShellArgs('--claim ""'), ['--claim', ''])
  })

  it('leaves a Windows path alone', () => {
    assert.deepStrictEqual(splitShellArgs('--include C:\\a\\b'), ['--include', 'C:\\a\\b'])
  })

  it('holds a separator inside its token instead of ending the command', () => {
    assert.deepStrictEqual(splitShellArgs('--unwind 1; rm -rf x'), ['--unwind', '1;', 'rm', '-rf', 'x'])
  })
})

// The composition is what makes hostile flags safe: split groups the tokens,
// quoting neutralises what is inside each one.
describe('splitShellArgs with quoteShellArg', function () {
  this.timeout(60000)

  let dir: string

  before(function () {
    if (process.platform === 'win32') {
      this.skip()
    }
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'esbmc-split-'))
  })

  after(() => {
    if (dir !== undefined) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('runs no command smuggled in through a flag string', async () => {
    for (const shape of ['; touch MARKER', '&& touch MARKER', '$(touch MARKER)', '`touch MARKER`']) {
      const marker = path.join(dir, `pwned-${shape.replace(/\W/g, '')}`)
      const flags = splitShellArgs(shape.replace('MARKER', marker))
        .map(flag => quoteShellArg(flag))
        .join(' ')
      await runShellCommand(`printf %s ${flags}`)
      assert.strictEqual(fs.existsSync(marker), false, `${shape} ran`)
    }
  })
})
