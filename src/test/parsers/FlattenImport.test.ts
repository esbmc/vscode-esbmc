import * as assert from 'assert'

// flatten-anything 4 is `"type": "module"`. This fails with ERR_REQUIRE_ESM if
// tsconfig ever goes back to `"module": "commonjs"`, which downlevels the
// `import()` in ConfigurationParser.parse into a `require()`.
describe('flatten-anything', () => {
  it('loads as an ESM-only dependency from the CommonJS build', async () => {
    const { flatten } = await import('flatten-anything')
    assert.deepStrictEqual(flatten({ properties: { arrayBounds: false } }), { 'properties.arrayBounds': false })
  })
})
