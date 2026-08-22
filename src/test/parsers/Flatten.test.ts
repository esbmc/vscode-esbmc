import * as assert from 'assert'
import { flatten } from '../../parsers/flatten'

// Behaviour recorded from flatten-anything@3, the dependency this replaces.
const CASES: Array<[Record<string, unknown>, Record<string, unknown>]> = [
  [{ properties: { assertions: false, nan: true } }, { 'properties.assertions': false, 'properties.nan': true }],
  [{ options: { quiet: true, 'symex-ssa': false } }, { 'options.quiet': true, 'options.symex-ssa': false }],
  [{ unwind: 5, mainFunction: 'main' }, { unwind: 5, mainFunction: 'main' }],
  [{ a: { b: { c: 1 } } }, { 'a.b.c': 1 }],
  [{ empty: {} }, { empty: {} }],
  [{ arr: [1, 2], nested: { arr: [3] } }, { arr: [1, 2], 'nested.arr': [3] }],
  [{}, {}],
  [{ nullish: null }, { nullish: null }]
]

describe('flatten', () => {
  it('matches the dependency it replaces', () => {
    for (const [input, expected] of CASES) {
      assert.deepStrictEqual(flatten(input), expected, JSON.stringify(input))
    }
  })

  it('does not mutate its argument', () => {
    const input = { properties: { assertions: false } }
    flatten(input)
    assert.deepStrictEqual(input, { properties: { assertions: false } })
  })

  // The settings this flattens are one level deep, but the parser looks keys up
  // by dotted name, so the separator has to stay a dot.
  it('joins keys with a dot', () => {
    assert.deepStrictEqual(Object.keys(flatten({ a: { b: 1 } })), ['a.b'])
  })
})
