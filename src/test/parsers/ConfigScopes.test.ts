import * as assert from 'assert'
import { mergeConfigScopes } from '../../parsers/configScopes'

describe('mergeConfigScopes', () => {
  it('returns nothing when no scope sets anything', () => {
    assert.deepStrictEqual(mergeConfigScopes(undefined, undefined, undefined), {})
  })

  // The bug this fixes: only the user scope was read, so a per-project
  // settings.json was silently inert.
  it('includes a value set only in the workspace', () => {
    assert.deepStrictEqual(
      mergeConfigScopes({ unwind: 5 }, { mainFunction: 'go' }, undefined),
      { unwind: 5, mainFunction: 'go' }
    )
  })

  it('lets the narrower scope win', () => {
    assert.deepStrictEqual(mergeConfigScopes({ unwind: 5 }, { unwind: 10 }, undefined), { unwind: 10 })
    assert.deepStrictEqual(mergeConfigScopes({ unwind: 5 }, { unwind: 10 }, { unwind: 20 }), { unwind: 20 })
  })

  // A workspace setting one property must not discard a user setting on
  // another, which a wholesale replace would do.
  it('merges nested groups key by key', () => {
    assert.deepStrictEqual(
      mergeConfigScopes({ properties: { nan: true } }, { properties: { memoryLeak: true } }, undefined),
      { properties: { nan: true, memoryLeak: true } }
    )
  })

  it('lets the narrower scope win inside a nested group', () => {
    assert.deepStrictEqual(
      mergeConfigScopes({ properties: { nan: true } }, { properties: { nan: false } }, undefined),
      { properties: { nan: false } }
    )
  })

  it('replaces rather than merges when a scope changes the type', () => {
    assert.deepStrictEqual(mergeConfigScopes({ a: { b: 1 } }, { a: 5 }, undefined), { a: 5 })
    assert.deepStrictEqual(mergeConfigScopes({ a: 5 }, { a: { b: 1 } }, undefined), { a: { b: 1 } })
  })

  it('ignores a scope that is not an object', () => {
    assert.deepStrictEqual(mergeConfigScopes({ unwind: 5 }, undefined, undefined), { unwind: 5 })
  })
})
