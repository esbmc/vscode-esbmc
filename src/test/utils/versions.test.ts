import * as assert from 'assert'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { getInstalledVersion } from '../../utils/versions'

function restoreEnv (key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}

// getInstalledVersion shells out to `$HOME/bin/esbmc`, so a fake HOME lets us
// drive it without a real ESBMC install. The command is sh-only, matching the
// Linux-only installer (see issue #16).
describe('getInstalledVersion', function () {
  let home: string
  let originalHome: string | undefined
  let originalPath: string | undefined

  before(function () {
    if (process.platform === 'win32') {
      this.skip()
    }
  })

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-esbmc-'))
    originalHome = process.env.HOME
    originalPath = process.env.PATH
    process.env.HOME = home
    // Keep a real esbmc on the developer's PATH from satisfying the fallback.
    process.env.PATH = path.join(home, 'empty-path')
  })

  afterEach(() => {
    restoreEnv('HOME', originalHome)
    restoreEnv('PATH', originalPath)
    fs.rmSync(home, { recursive: true, force: true })
  })

  function fakeEsbmc (dir: string, output: string) {
    fs.mkdirSync(dir, { recursive: true })
    const script = path.join(dir, 'esbmc')
    fs.writeFileSync(script, `#!/bin/sh\nprintf '%s\\n' ${JSON.stringify(output)}\n`)
    fs.chmodSync(script, 0o755)
    return script
  }

  it('reads the version out of the ESBMC banner', async () => {
    fakeEsbmc(path.join(home, 'bin'), 'ESBMC version 7.6.1 64-bit x86_64 linux')
    assert.strictEqual(await getInstalledVersion(), '7.6.1')
  })

  it('accepts a two-component version', async () => {
    fakeEsbmc(path.join(home, 'bin'), 'ESBMC version 7.6')
    assert.strictEqual(await getInstalledVersion(), '7.6')
  })

  it('falls back to esbmc on PATH when $HOME/bin/esbmc is absent', async () => {
    const dir = path.join(home, 'pathbin')
    fakeEsbmc(dir, 'ESBMC version 7.9.0')
    process.env.PATH = dir
    assert.strictEqual(await getInstalledVersion(), '7.9.0')
  })

  it('prefers $HOME/bin/esbmc over the one on PATH', async () => {
    const dir = path.join(home, 'pathbin')
    fakeEsbmc(dir, 'ESBMC version 7.9.0')
    fakeEsbmc(path.join(home, 'bin'), 'ESBMC version 7.6.1')
    process.env.PATH = dir
    assert.strictEqual(await getInstalledVersion(), '7.6.1')
  })

  it('returns undefined when ESBMC is not installed', async () => {
    assert.strictEqual(await getInstalledVersion(), undefined)
  })

  it('returns undefined when the banner has no version', async () => {
    fakeEsbmc(path.join(home, 'bin'), 'command not found')
    assert.strictEqual(await getInstalledVersion(), undefined)
  })
})
