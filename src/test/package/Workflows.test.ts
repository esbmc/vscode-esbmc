import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const WORKFLOWS = path.resolve(__dirname, '..', '..', '..', '.github', 'workflows')

function read (file: string): string {
  return fs.readFileSync(path.join(WORKFLOWS, file), 'utf8').replace(/\r\n/g, '\n')
}

describe('test workflow', () => {
  const yaml = read('on-pr-master.yml')

  it('runs on a push to master', () => {
    assert.match(yaml, /push:\n\s+branches:\n\s+- master/)
  })

  // A master run cancelled by the next push leaves that commit untested, and
  // the README badge then reports "failing" for a run nobody failed.
  it('never cancels a run on master', () => {
    const cancel = /cancel-in-progress:\s*(.*)/.exec(yaml)
    assert.ok(cancel, 'no cancel-in-progress setting')
    assert.notStrictEqual(cancel[1].trim(), 'true', 'a push to master cancels the previous run')
    assert.match(cancel[1], /refs\/heads\/master/)
  })
})
