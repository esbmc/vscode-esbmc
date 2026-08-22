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
    const cmd = extractCommand('C:\\tmp\\e.zip', 'C:\\store', 'win32')
    assert.match(cmd, /^powershell /)
    assert.match(cmd, /Expand-Archive/)
    assert.ok(cmd.includes("'C:\\tmp\\e.zip'"), cmd)
    assert.ok(cmd.includes("'C:\\store'"), cmd)
  })

  it('doubles a quote inside a PowerShell literal', () => {
    const cmd = extractCommand("/tmp/it's.zip", '/store', 'win32')
    assert.ok(cmd.includes("'/tmp/it''s.zip'"), cmd)
  })

  it('uses unzip elsewhere', () => {
    for (const platform of ['linux', 'darwin']) {
      const cmd = extractCommand('/tmp/e.zip', '/store', platform)
      assert.match(cmd, /^unzip -o /)
      assert.match(cmd, /-d /)
    }
  })

  // A download path is attacker-influenced only via the asset name, but the
  // destination comes from the extension's own storage path, which can contain
  // anything the user's account name does.
  it('quotes paths so a shell cannot reinterpret them', () => {
    const cmd = extractCommand('/tmp/$(touch pwned).zip', '/store dir', 'linux')
    assert.ok(!cmd.includes('$(touch pwned).zip"'), cmd)
    assert.ok(cmd.includes("'/tmp/$(touch pwned).zip'"), cmd)
    assert.ok(cmd.includes("'/store dir'"), cmd)
  })
})
