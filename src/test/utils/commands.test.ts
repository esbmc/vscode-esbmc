import * as assert from 'assert'
import { executeShellCommand } from '../../utils/commands'

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
