import * as assert from 'assert'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { parseSarif } from '../../parsers/sarifParser'
import { runShellCommand } from '../../utils/commands'

const FAILS = `int main(void)
{
  int values[4];
  for (int i = 0; i <= 4; i++)
    values[i] = i;
  return 0;
}
`

const SOLIDITY_FAILS = `// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.5.0;

contract Simple {
    function f() public pure {
        uint8 x = 1;
        assert(x == 2);
    }
}
`

const PASSES = `int main(void)
{
  int values[4];
  for (int i = 0; i < 4; i++)
    values[i] = i;
  return values[0];
}
`

async function esbmcAvailable (): Promise<boolean> {
  return (await runShellCommand('esbmc --version')).code === 0
}

// Proves the SARIF contract against the real tool rather than a fixture.
// Skipped where ESBMC is not installed, which includes CI.
describe('SARIF pipeline against real ESBMC', function () {
  this.timeout(120000)

  let dir: string

  before(async function () {
    if (!await esbmcAvailable()) {
      this.skip()
    }
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'esbmc-sarif-'))
  })

  after(() => {
    if (dir !== undefined) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  async function verify (source: string, name: string) {
    const file = path.join(dir, `${name}.c`)
    const report = path.join(dir, `${name}.sarif`)
    fs.writeFileSync(file, source)
    const result = await runShellCommand(`esbmc "${file}" --sarif-output "${report}"`)
    // ESBMC prints its verdict on stderr, not stdout.
    return { file, report, transcript: result.stdout + result.stderr }
  }

  it('turns a violation into a finding on the right line', async () => {
    const { file, report, transcript } = await verify(FAILS, 'fails')
    assert.match(transcript, /VERIFICATION FAILED/)
    const findings = parseSarif(fs.readFileSync(report, 'utf8'))
    assert.strictEqual(findings.length, 1)
    assert.strictEqual(findings[0].file, file)
    assert.strictEqual(findings[0].line, 5, 'the out-of-bounds write is on line 5')
    assert.strictEqual(findings[0].severity, 'error')
    assert.match(findings[0].message, /array bounds/)
    assert.ok(findings[0].cwes.length > 0, 'ESBMC reports CWEs for this property')
  })

  // ESBMC writes no report when nothing is violated, which is why run() treats
  // a missing report as "no findings" rather than an error.
  it('writes no report when every property holds', async () => {
    const { report, transcript } = await verify(PASSES, 'passes')
    assert.match(transcript, /VERIFICATION SUCCESSFUL/)
    assert.strictEqual(fs.existsSync(report), false)
  })

  // run() has a "failed, see output" verdict solely because of this: with
  // --multi-property ESBMC reports every violation but writes no SARIF at all.
  it('writes no report under --multi-property, even on failure', async () => {
    const file = path.join(dir, 'multi.c')
    const report = path.join(dir, 'multi.sarif')
    fs.writeFileSync(file, FAILS)
    const result = await runShellCommand(`esbmc "${file}" --multi-property --sarif-output "${report}"`)
    assert.match(result.stdout + result.stderr, /VERIFICATION FAILED/)
    assert.strictEqual(fs.existsSync(report), false)
  })

  // Issue #12: the same SARIF pipeline has to work for the non-C languages,
  // since diagnostics are what makes them usable in the editor.
  it('produces a finding for a Python program', async () => {
    const file = path.join(dir, 'fails.py')
    const report = path.join(dir, 'fails-py.sarif')
    fs.writeFileSync(file, 'values = [0, 1, 2, 3]\nassert values[0] == 1\n')
    const result = await runShellCommand(`esbmc "${file}" --sarif-output "${report}"`)
    assert.match(result.stdout + result.stderr, /VERIFICATION FAILED/)
    const findings = parseSarif(fs.readFileSync(report, 'utf8'))
    assert.ok(findings.length > 0, 'no findings for the Python program')
    assert.strictEqual(findings[0].file, file)
    assert.strictEqual(findings[0].line, 2)
  })

  // Solidity needs solc to reach an AST, and ESBMC's Solidity model spins in
  // an address loop until the unwind is bounded. Both are why this is the one
  // language the extension supports that cannot be checked unconditionally.
  it('produces a finding for a Solidity contract', async function () {
    const file = path.join(dir, 'fails.sol')
    const report = path.join(dir, 'fails-sol.sarif')
    fs.writeFileSync(file, SOLIDITY_FAILS)
    const result = await runShellCommand(
      `esbmc "${file}" --unwind 2 --no-unwinding-assertions --sarif-output "${report}"`)
    const transcript = result.stdout + result.stderr
    if (/solc not found/.test(transcript)) {
      return this.skip()
    }
    assert.match(transcript, /VERIFICATION FAILED/)
    const findings = parseSarif(fs.readFileSync(report, 'utf8'))
    assert.ok(findings.length > 0, 'no findings for the Solidity contract')
    assert.strictEqual(findings[0].file, file)
    assert.strictEqual(findings[0].line, 7, 'the failing assertion is on line 7')
  })
})
