import * as assert from 'assert'
import * as path from 'path'
import {
  assetForPlatform,
  binaryName,
  binaryPath,
  extractCommand,
  isSupportedPlatform
} from '../../utils/platform'

// Asset names verified against the esbmc/esbmc releases API: every release
// publishes esbmc-linux.zip, esbmc-macos.zip and esbmc-windows.zip.
describe('assetForPlatform', () => {
  it('maps each platform to the asset ESBMC publishes', () => {
    assert.strictEqual(assetForPlatform('linux'), 'esbmc-linux.zip')
    assert.strictEqual(assetForPlatform('darwin'), 'esbmc-macos.zip')
    assert.strictEqual(assetForPlatform('win32'), 'esbmc-windows.zip')
  })

  it('refuses a platform with no published build', () => {
    assert.strictEqual(isSupportedPlatform('freebsd'), false)
    assert.throws(() => assetForPlatform('freebsd'), /freebsd/)
  })

  it('accepts the three platforms ESBMC builds for', () => {
    for (const platform of ['linux', 'darwin', 'win32']) {
      assert.ok(isSupportedPlatform(platform), platform)
    }
  })
})

describe('binaryPath', () => {
  it('names the Windows executable with its extension', () => {
    assert.strictEqual(binaryName('win32'), 'esbmc.exe')
    assert.strictEqual(binaryName('linux'), 'esbmc')
    assert.strictEqual(binaryName('darwin'), 'esbmc')
  })

  // The archives ship bin/esbmc alongside bin/libz3.dll on Windows, so the
  // binary has to stay inside bin/ rather than be lifted out of it.
  it('keeps the binary inside the archive bin directory', () => {
    assert.strictEqual(binaryPath('/store/esbmc', 'linux'), path.join('/store/esbmc', 'bin', 'esbmc'))
    assert.strictEqual(binaryPath('/store/esbmc', 'win32'), path.join('/store/esbmc', 'bin', 'esbmc.exe'))
  })
})

describe('extractCommand', () => {
  it('uses PowerShell on Windows, which has no unzip', () => {
    const { file, args } = extractCommand('C:\\tmp\\e.zip', 'C:\\store', 'win32')
    assert.strictEqual(file, 'powershell')
    const script = args[args.length - 1]
    assert.match(script, /^Expand-Archive /)
    assert.ok(script.includes("'C:\\tmp\\e.zip'"), script)
    assert.ok(script.includes("'C:\\store'"), script)
  })

  it('doubles a quote inside a PowerShell literal', () => {
    const { args } = extractCommand("/tmp/it's.zip", '/store', 'win32')
    assert.ok(args[args.length - 1].includes("'/tmp/it''s.zip'"), args.join(' '))
  })

  it('uses unzip elsewhere', () => {
    for (const platform of ['linux', 'darwin']) {
      const { file, args } = extractCommand('/tmp/e.zip', '/store', platform)
      assert.strictEqual(file, 'unzip')
      assert.deepStrictEqual(args, ['-o', '/tmp/e.zip', '-d', '/store'])
    }
  })

  // The destination comes from the extension's own storage path, which can
  // contain anything the user's account name does. Nothing quotes a `%` out of
  // cmd.exe's reach, so no shell is used and each path stays one argument.
  it('hands paths over as arguments rather than as a command line', () => {
    const { args } = extractCommand('/tmp/$(touch pwned).zip', '/store %USERNAME% dir', 'linux')
    assert.ok(args.includes('/tmp/$(touch pwned).zip'), args.join(' '))
    assert.ok(args.includes('/store %USERNAME% dir'), args.join(' '))
  })

  it('leaves a percent in a Windows path untouched', () => {
    const { args } = extractCommand('C:\\tmp\\e.zip', 'C:\\store\\100%%\\esbmc', 'win32')
    assert.ok(args[args.length - 1].includes("'C:\\store\\100%%\\esbmc'"), args.join(' '))
  })
})
