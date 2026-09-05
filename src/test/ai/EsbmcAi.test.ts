import * as assert from 'assert'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { EsbmcAiFailedError, EsbmcAiNotFoundError, esbmcAiArgs, parseFixResult, runEsbmcAi } from '../../ai/esbmcAi'

const RESULT = '{"successful": true, "attempts": 2, "repaired_source": "int main() { return 0; }"}'

/** Stands in for the real esbmc-ai, which needs a model and an API key. */
function stubEsbmcAi (dir: string, body: string): string {
  const script = path.join(dir, 'esbmc-ai')
  fs.writeFileSync(script, `#!/bin/sh\n${body}\n`, { mode: 0o755 })
  return script
}

describe('esbmcAiArgs', () => {
  const base = { binary: 'esbmc-ai', file: '/src/a.c', jsonPath: '/tmp/r.json' }

  // --json is what makes it serialise the result at all; --json-path is what
  // puts that JSON somewhere its banner and log stream cannot reach.
  it('asks for a repair and a machine-readable result', () => {
    assert.deepStrictEqual(
      esbmcAiArgs(base),
      ['fix-code', '/src/a.c', '--json', '--json-path', '/tmp/r.json']
    )
  })

  it('omits the optional flags rather than passing them empty', () => {
    const args = esbmcAiArgs({ ...base, model: '', configFile: '' })
    assert.ok(!args.includes('--ai-model'))
    assert.ok(!args.includes('--config-file'))
  })

  it('passes a model and a config file when they are set', () => {
    const args = esbmcAiArgs({ ...base, model: 'anthropic/claude', configFile: '/home/me/esbmc-ai.toml' })
    assert.deepStrictEqual(args.slice(-4), ['--ai-model', 'anthropic/claude', '--config-file', '/home/me/esbmc-ai.toml'])
  })

  // These reach a program directly rather than through a shell, so a path
  // with a space or a substitution stays one argument, unmangled.
  it('keeps an awkward path as a single argument', () => {
    assert.strictEqual(esbmcAiArgs({ ...base, file: '/src/$(rm -rf ~) a.c' })[1], '/src/$(rm -rf ~) a.c')
  })
})

describe('parseFixResult', () => {
  it('reads the result out of a noisy stdout', () => {
    const parsed = parseFixResult(`ESBMC-AI v0.1\n{"event": "starting", "level": "info"}\n${RESULT}\n`)
    assert.strictEqual(parsed.successful, true)
    assert.strictEqual(parsed.attempts, 2)
    assert.match(String(parsed.repairedSource), /int main/)
  })

  it('reports a failed repair as a result, not an error', () => {
    const parsed = parseFixResult('{"successful": false, "attempts": 5, "repaired_source": null}')
    assert.strictEqual(parsed.successful, false)
    assert.strictEqual(parsed.repairedSource, undefined)
  })

  it('refuses to guess when there is no result', () => {
    assert.throws(() => parseFixResult('Traceback (most recent call last)'), EsbmcAiFailedError)
  })

  // A future esbmc-ai that renames its fields should say so, rather than
  // read as a repair that produced nothing.
  it('names the fields it expected when the shape has moved on', () => {
    assert.throws(
      () => parseFixResult('{"successful": true, "outcome": "repaired"}'),
      (error: Error) => error instanceof EsbmcAiFailedError && /attempts/.test(error.message)
    )
  })

  it('ignores the structlog lines around the result', () => {
    assert.strictEqual(parseFixResult('{"event": "done"}\n{"successful": false, "attempts": 1}').attempts, 1)
  })
})

describe('runEsbmcAi', function () {
  this.timeout(20000)

  let dir: string

  // The stub is a shell script, which Windows cannot spawn directly. What it
  // stands in for is esbmc-ai's argument and output contract, covered above
  // on every platform.
  before(function () {
    if (process.platform === 'win32') {
      this.skip()
    }
  })

  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'esbmc-ai-test-')) })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  it('reads the result esbmc-ai wrote to its json path', async () => {
    // $5 is the value of --json-path: fix-code $1, the file $2, --json $3.
    const binary = stubEsbmcAi(dir, `echo "banner"\ncat > "$5" <<'EOF'\n${RESULT}\nEOF`)
    const repair = await runEsbmcAi({ binary, file: '/src/a.c', timeoutSeconds: 10 })
    assert.strictEqual(repair.successful, true)
    assert.strictEqual(repair.attempts, 2)
  })

  it('falls back to stdout when nothing was written', async () => {
    const binary = stubEsbmcAi(dir, `echo "banner"\necho '${RESULT}'`)
    assert.strictEqual((await runEsbmcAi({ binary, file: '/src/a.c', timeoutSeconds: 10 })).successful, true)
  })

  // Killed mid-write, --json-path holds half a document while stdout already
  // carried the whole result. Reading the file used to throw a raw
  // SyntaxError past the fallback that would have succeeded.
  it('falls back to stdout when the json path was left truncated', async () => {
    const binary = stubEsbmcAi(dir, `printf '{"successful": tr' > "$5"\necho '${RESULT}'`)
    const repair = await runEsbmcAi({ binary, file: '/src/a.c', timeoutSeconds: 10 })
    assert.strictEqual(repair.successful, true)
    assert.strictEqual(repair.attempts, 2)
  })

  // A file that parses but has lost the fields is an upstream change, which
  // stdout will not repair; say so rather than falling through silently.
  it('reports a moved-on json shape rather than falling back', async () => {
    const binary = stubEsbmcAi(dir, `printf '{"successful": true}' > "$5"\necho '${RESULT}'`)
    await assert.rejects(
      runEsbmcAi({ binary, file: '/src/a.c', timeoutSeconds: 10 }),
      (error: Error) => error instanceof EsbmcAiFailedError && /attempts/.test(error.message)
    )
  })

  it('names the missing executable rather than reporting a failed repair', async () => {
    await assert.rejects(
      runEsbmcAi({ binary: path.join(dir, 'absent'), file: '/src/a.c', timeoutSeconds: 10 }),
      EsbmcAiNotFoundError
    )
  })

  it('surfaces why esbmc-ai gave up', async () => {
    const binary = stubEsbmcAi(dir, 'echo "ESBMCAI_CONFIG_FILE is not set" >&2\nexit 1')
    await assert.rejects(
      runEsbmcAi({ binary, file: '/src/a.c', timeoutSeconds: 10 }),
      (error: Error) => error instanceof EsbmcAiFailedError && /ESBMCAI_CONFIG_FILE/.test(error.message)
    )
  })

  it('reports being killed as a timeout, naming the setting', async () => {
    const binary = stubEsbmcAi(dir, 'sleep 30')
    await assert.rejects(
      runEsbmcAi({ binary, file: '/src/a.c', timeoutSeconds: 1 }),
      (error: Error) => error instanceof EsbmcAiFailedError && /esbmc\.ai\.timeout/.test(error.message)
    )
  })
})
