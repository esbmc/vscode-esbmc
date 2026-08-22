import * as assert from 'assert'
import { loadNodeFetch } from '../../utils/nodeFetch'

// node-fetch 3 is `"type": "module"`, so a plain `require()` of it throws
// ERR_REQUIRE_ESM. These assertions fail if the dynamic import ever gets
// compiled down to one.
describe('loadNodeFetch', () => {
  it('loads the ESM-only node-fetch package', async () => {
    const { default: fetch, Request } = await loadNodeFetch()
    assert.strictEqual(typeof fetch, 'function')
    assert.strictEqual(typeof Request, 'function')
  })

  it('imports the module once and reuses it', async () => {
    assert.strictEqual(await loadNodeFetch(), await loadNodeFetch())
  })
})
