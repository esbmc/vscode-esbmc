import * as assert from 'assert'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { quoteShellArg, runShellCommand } from '../../utils/commands'

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

// The POSIX suite above skips on Windows, which left the branch that rewrites
// its input as the only one with no coverage at all. These run everywhere by
// driving the win32 branch directly.
describe('quoteShellArg on Windows', () => {
  const original = process.platform

  function asWin32 (run: () => void) {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    try {
      run()
    } finally {
      Object.defineProperty(process, 'platform', { value: original, configurable: true })
    }
  }

  it('wraps a path in double quotes', () => {
    asWin32(() => {
      assert.strictEqual(quoteShellArg('C:\\Program Files\\a.c'), '"C:\\Program Files\\a.c"')
    })
  })

  it('leaves a path alone but for the quotes', () => {
    asWin32(() => {
      for (const value of ['a.c', 'C:\\x\\y.c', 'with space.c', 'a&b.c', 'semi;colon.c', '$(id).c']) {
        assert.strictEqual(quoteShellArg(value), `"${value}"`)
      }
    })
  })

  // cmd.exe expands %VAR% inside double quotes and offers no escape for it, so
  // quoting a path containing one would name a different file.
  it('refuses a path cmd.exe would rewrite rather than corrupting it', () => {
    asWin32(() => {
      assert.throws(() => quoteShellArg('C:\\100%\\a.c'), /cannot be passed a path containing %/)
      assert.throws(() => quoteShellArg('C:\\%USERNAME%\\a.c'), /%/)
      assert.throws(() => quoteShellArg('C:\\a"b\\c.c'), /cannot be passed a path containing "/)
    })
  })

  it('names the path it refused', () => {
    asWin32(() => {
      assert.throws(() => quoteShellArg('C:\\100%\\a.c'), /C:\\100%\\a\.c/)
    })
  })
})
