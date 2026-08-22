import * as fs from 'fs'
import * as path from 'path'
import * as Mocha from 'mocha'

/**
 * Finds the compiled test files.
 *
 * Done here rather than with glob, whose callback API was removed in v9 and
 * whose newer majors keep raising the Node floor, for one directory walk.
 */
export function testFiles (dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return testFiles(full)
    }
    return entry.name.endsWith('.test.js') ? [full] : []
  })
}

export async function run (): Promise<void> {
  const mocha = new Mocha({
    ui: 'bdd',
    timeout: 10000,
    color: true
  })

  const testsRoot = path.resolve(__dirname, '..')
  const files = testFiles(testsRoot).sort()
  // Discovery.test.ts cannot catch a broken walk: it is itself never loaded.
  if (files.length === 0) {
    throw new Error(`No test files found under ${testsRoot}.`)
  }
  for (const file of files) {
    mocha.addFile(file)
  }

  const failures = await new Promise<number>(resolve => mocha.run(resolve))
  if (failures > 0) {
    throw new Error(`${failures} tests failed.`)
  }
}
