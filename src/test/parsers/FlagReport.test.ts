import * as assert from 'assert'
import { describeFlags } from '../../parsers/flagReport'

describe('describeFlags', () => {
  // Every setting at its default emits no flags at all, which reads as a bug
  // unless the report says so.
  it('says so when there are no flags', () => {
    assert.match(describeFlags(''), /none/)
    assert.match(describeFlags(''), /default/)
  })

  it('reports the flags verbatim', () => {
    assert.strictEqual(describeFlags('--unwind 5 --z3'), 'ESBMC flags: --unwind 5 --z3')
  })

  it('does not claim there are none when there are', () => {
    assert.doesNotMatch(describeFlags('--z3'), /none/)
  })
})
