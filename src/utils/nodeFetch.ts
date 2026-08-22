/* eslint-disable no-new-func */

type NodeFetch = typeof import('node-fetch')

// node-fetch 3 is `"type": "module"`. Under `"module": "commonjs"` tsc rewrites
// `import()` into `require()`, which throws ERR_REQUIRE_ESM on such a package;
// building the import inside Function() keeps it out of reach of that rewrite.
// The same opacity hides the dependency from a bundler, so node-fetch must stay
// an unbundled runtime dependency for as long as this indirection exists.
const importNodeFetch = new Function('return import("node-fetch")') as () => Promise<NodeFetch>

let pending: Promise<NodeFetch> | undefined

export function loadNodeFetch (): Promise<NodeFetch> {
  if (pending === undefined) {
    // A cached rejection would disable fetch for the rest of the session.
    pending = importNodeFetch().catch((error) => {
      pending = undefined
      throw error
    })
  }
  return pending
}
