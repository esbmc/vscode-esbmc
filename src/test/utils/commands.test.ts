import * as assert from 'assert'
import { executeShellCommand, runShellCommand } from '../../utils/commands'

describe('executeShellCommand', () => {
  it('resolves with the command stdout', async () => {
    const out = await executeShellCommand('node --version')
    assert.match(out, /^v\d+\.\d+\.\d+/)
  })

  it('resolves stdout verbatim, trailing newline included', async () => {
    const out = await executeShellCommand('node -e "console.log(42)"')
    assert.strictEqual(out.replace(/\r/g, ''), '42\n')
  })

  it('rejects with the error message when the command fails', async () => {
    await assert.rejects(
      executeShellCommand('node -e "process.exit(3)"'),
      (reason: unknown) => {
        assert.strictEqual(typeof reason, 'string', 'rejection value should be the error message')
        assert.match(reason as string, /Command failed/)
        return true
      }
    )
  })

  it('rejects when the command does not exist', async () => {
    await assert.rejects(executeShellCommand('esbmc-no-such-executable'))
  })
})

describe('runShellCommand', function () {
  this.timeout(60000)

  it('captures stdout and the exit code of a successful command', async () => {
    const result = await runShellCommand('node -e "console.log(1)"')
    assert.strictEqual(result.stdout.trim(), '1')
    assert.strictEqual(result.code, 0)
    assert.strictEqual(result.timedOut, false)
  })

  // ESBMC exits non-zero when it finds a violation, which is a result rather
  // than an error, so a failing command must resolve instead of rejecting.
  it('resolves rather than rejects when the command exits non-zero', async () => {
    const result = await runShellCommand('node -e "console.error(7); process.exit(3)"')
    assert.strictEqual(result.code, 3)
    assert.match(result.stderr, /7/)
    assert.strictEqual(result.timedOut, false)
  })

  it('kills a command that outlives the timeout', async () => {
    const started = Date.now()
    const result = await runShellCommand('node -e "setTimeout(() => {}, 60000)"', { timeoutMs: 500 })
    assert.strictEqual(result.timedOut, true)
    assert.ok(Date.now() - started < 30000, 'the timeout did not kill the command')
  })

  it('waits for a slow command when the timeout is zero', async () => {
    const result = await runShellCommand('node -e "setTimeout(() => console.log(9), 300)"', { timeoutMs: 0 })
    assert.strictEqual(result.timedOut, false)
    assert.match(result.stdout, /9/)
  })

  // Decoding each chunk separately mangles a multi-byte character that
  // straddles a chunk boundary, which ESBMC output hits on long traces.
  it('decodes multi-byte output split across chunks', async () => {
    const result = await runShellCommand(
      // The leading byte makes every following 2-byte character straddle an
      // odd offset, so one lands across a 64KB chunk boundary.
      'node -e "process.stdout.write(String.fromCodePoint(0x78) + String.fromCodePoint(0x00e9).repeat(200000))"'
    )
    assert.strictEqual(result.stdout.length, 200001)
    assert.strictEqual(result.stdout.includes(String.fromCodePoint(0xfffd)), false, 'replacement characters appeared')
  })
})
