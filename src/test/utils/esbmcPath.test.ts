import * as assert from 'assert'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { installedBinary, legacyBinary, resolveEsbmc, setStorageRoot } from '../../utils/esbmcPath'

function restoreEnv (key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}

/** A script that answers `--version`, so PATH lookup finds something runnable. */
function writeFakeEsbmc (file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, '#!/bin/sh\necho "ESBMC version 1.2.3"\n')
  fs.chmodSync(file, 0o755)
}

// The resolver decides which binary both verification and the version report
// use, so its order is the difference between reporting one ESBMC and running
// another. sh-only, matching the fake binaries it plants.
describe('resolveEsbmc', function () {
  this.timeout(30000)

  let home: string
  let storage: string
  let onPath: string
  let originalHome: string | undefined
  let originalPath: string | undefined

  before(function () {
    if (process.platform === 'win32') {
      this.skip()
    }
  })

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-esbmc-home-'))
    storage = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-esbmc-store-'))
    onPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-esbmc-path-'))
    originalHome = process.env.HOME
    originalPath = process.env.PATH
    process.env.HOME = home
    // Keep a real ESBMC on the developer's PATH out of the way.
    process.env.PATH = onPath
    setStorageRoot(storage)
  })

  afterEach(() => {
    restoreEnv('HOME', originalHome)
    restoreEnv('PATH', originalPath)
    for (const dir of [home, storage, onPath]) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reports nothing when ESBMC is nowhere', async () => {
    assert.strictEqual(await resolveEsbmc('linux'), undefined)
  })

  it('prefers the ESBMC on PATH, which is the user\'s own', async () => {
    writeFakeEsbmc(path.join(onPath, 'esbmc'))
    writeFakeEsbmc(installedBinary('linux') as string)
    writeFakeEsbmc(legacyBinary('linux'))

    assert.deepStrictEqual(await resolveEsbmc('linux'), { command: 'esbmc', source: 'path' })
  })

  it('falls back to the install it manages', async () => {
    const installed = installedBinary('linux') as string
    writeFakeEsbmc(installed)
    writeFakeEsbmc(legacyBinary('linux'))

    const resolved = await resolveEsbmc('linux')
    assert.strictEqual(resolved?.source, 'installed')
    assert.ok(resolved?.command.includes(installed), resolved?.command)
  })

  it('falls back to a pre-installer install last', async () => {
    const legacy = legacyBinary('linux')
    writeFakeEsbmc(legacy)

    const resolved = await resolveEsbmc('linux')
    assert.strictEqual(resolved?.source, 'legacy')
    assert.ok(resolved?.command.includes(legacy), resolved?.command)
  })

  it('quotes the path it reports, which the storage path can need', async () => {
    setStorageRoot(path.join(storage, 'a dir'))
    writeFakeEsbmc(installedBinary('linux') as string)

    const resolved = await resolveEsbmc('linux')
    assert.match(resolved?.command ?? '', /^'.*'$/)
  })
})
