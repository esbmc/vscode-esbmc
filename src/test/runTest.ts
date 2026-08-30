import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { runTests } from '@vscode/test-electron'

async function main () {
  // Workspace-scoped settings cannot be written unless a folder is open, and
  // ConfigurationTarget.Workspace writes .vscode/settings.json into it, so the
  // folder has to be a throwaway rather than the checkout.
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-esbmc-tests-'))
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../')

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index')

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [workspace, '--disable-extensions']
    })
  } catch (err) {
    console.error('Failed to run tests')
    process.exit(1)
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true })
  }
}

main()
