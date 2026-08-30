import * as assert from 'assert'
import * as path from 'path'
import { testFiles } from './index'

const TEST_ROOT = path.resolve(__dirname, '..')

// A discovery bug makes the whole suite pass vacuously, which is worse than a
// failing suite because nothing looks wrong.
describe('test discovery', () => {
  it('finds the compiled test files', () => {
    const found = testFiles(TEST_ROOT)
    assert.ok(found.length > 10, `only ${found.length} test files found under ${TEST_ROOT}`)
    assert.ok(found.every(file => file.endsWith('.test.js')), 'a non-test file was collected')
  })

  // Every test lives in a subdirectory, so a walk that does not recurse finds
  // nothing at all.
  it('descends into subdirectories', () => {
    const found = testFiles(TEST_ROOT).map(file => path.relative(TEST_ROOT, file))
    assert.ok(
      found.some(file => file.includes(path.sep)),
      'no nested test file found, so the walk is not recursing'
    )
  })

  it('finds this file', () => {
    assert.ok(
      testFiles(TEST_ROOT).includes(path.join(__dirname, 'Discovery.test.js')),
      'discovery does not find the file asserting on it'
    )
  })
})
