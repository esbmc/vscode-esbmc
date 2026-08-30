import * as assert from 'assert'
import * as vscode from 'vscode'
import { Configuration } from '../../@types/vscode.configuration'
import { ConfigurationParser } from '../../parsers/configParser'
import { SECTIONS } from '../../parsers/sections'

const SETTINGS_ROOT = 'esbmc'

async function clear (target: vscode.ConfigurationTarget) {
  const config = vscode.workspace.getConfiguration(SETTINGS_ROOT)
  for (const section of SECTIONS) {
    const inspected = config.inspect<Configuration>(section)
    const scope = target === vscode.ConfigurationTarget.Workspace
      ? inspected?.workspaceValue
      : inspected?.globalValue
    for (const key of Object.keys(scope ?? {})) {
      await config.update(`${section}.${key}`, undefined, target)
    }
  }
}

// mergeConfigScopes is unit tested on hand-built scope objects, which says
// nothing about whether inspect() ever reports a workspace value. This drives
// the parser against settings VS Code actually stored.
describe('ConfigurationParser across settings scopes', function () {
  this.timeout(30000)

  const folder = vscode.workspace.workspaceFolders?.[0]

  before(function () {
    if (folder === undefined) {
      // Workspace settings cannot be written without a folder open, and the
      // point of the test is that they are read.
      this.skip()
    }
  })

  beforeEach(async () => {
    await clear(vscode.ConfigurationTarget.Workspace)
    await clear(vscode.ConfigurationTarget.Global)
  })

  after(async () => {
    await clear(vscode.ConfigurationTarget.Workspace)
    await clear(vscode.ConfigurationTarget.Global)
  })

  it('emits a flag set only in the workspace', async () => {
    const config = vscode.workspace.getConfiguration(SETTINGS_ROOT)
    await config.update('bmc.unwind', 7, vscode.ConfigurationTarget.Workspace)

    const flags = new ConfigurationParser().parse(undefined, folder?.uri)
    assert.strictEqual(flags, '--unwind 7')
  })

  it('lets a workspace setting win over the same user setting', async () => {
    const config = vscode.workspace.getConfiguration(SETTINGS_ROOT)
    await config.update('bmc.unwind', 3, vscode.ConfigurationTarget.Global)
    await config.update('bmc.unwind', 9, vscode.ConfigurationTarget.Workspace)

    const flags = new ConfigurationParser().parse(undefined, folder?.uri)
    assert.strictEqual(flags, '--unwind 9')
  })

  it('keeps a user setting the workspace does not touch', async () => {
    const config = vscode.workspace.getConfiguration(SETTINGS_ROOT)
    await config.update('bmc.unwind', 4, vscode.ConfigurationTarget.Global)
    await config.update('bmc.mainFunction', 'go', vscode.ConfigurationTarget.Workspace)

    const flags = new ConfigurationParser().parse(undefined, folder?.uri)
    assert.ok(flags.includes('--unwind 4'), `user setting lost: ${flags}`)
    assert.ok(flags.includes('--function go'), `workspace setting lost: ${flags}`)
  })
})
