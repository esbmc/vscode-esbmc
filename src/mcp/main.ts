import { createServer } from './server'

// Entry point for agents: `node <extension>/out/mcp/main.js` over stdio.
createServer().listen(process.stdin, process.stdout)
