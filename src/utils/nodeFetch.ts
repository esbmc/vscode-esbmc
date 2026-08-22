/* eslint-disable no-new-func */

type NodeFetch = typeof import('node-fetch')

// node-fetch 3 is `"type": "module"`. Under `"module": "commonjs"` tsc rewrites
// `import()` into `require()`, which throws ERR_REQUIRE_ESM on such a package;
// building the import inside Function() keeps it out of reach of that rewrite.
const importNodeFetch = new Function('return import("node-fetch")') as () => Promise<NodeFetch>

let pending: Promise<NodeFetch> | undefined

export function loadNodeFetch (): Promise<NodeFetch> {
  if (pending === undefined) {
    pending = importNodeFetch()
  }
  return pending
}
