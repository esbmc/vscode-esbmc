import * as path from 'path'
import * as Mocha from 'mocha'
import { glob } from 'glob'

export async function run (): Promise<void> {
  const mocha = new Mocha({
    ui: 'bdd',
    timeout: 10000,
    color: true
  })

  const testsRoot = path.resolve(__dirname, '..')
  const files = await glob('**/*.test.js', { cwd: testsRoot })
  // A discovery bug would otherwise report a green run that executed nothing.
  if (files.length === 0) {
    throw new Error(`No test files found under ${testsRoot}`)
  }
  files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)))

  await new Promise<void>((resolve, reject) => {
    mocha.run(failures => {
      if (failures > 0) {
        reject(new Error(`${failures} tests failed.`))
      } else {
        resolve()
      }
    })
  })
}
