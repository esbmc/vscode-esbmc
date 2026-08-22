import * as assert from 'assert'
import * as http from 'http'
import { postJson, request, resolveRedirect } from '../../utils/http'

describe('http', function () {
  this.timeout(30000)

  let server: http.Server
  let origin: string
  let received: Array<{ method?: string, url?: string, body: string, contentType?: string }>

  before(async () => {
    received = []
    server = http.createServer((req, res) => {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        received.push({
          method: req.method,
          url: req.url,
          body,
          contentType: req.headers['content-type']
        })
        if (req.url === '/hop1') {
          res.writeHead(302, { Location: '/hop2' })
          return res.end()
        }
        if (req.url === '/hop2') {
          res.writeHead(301, { Location: `${origin}/final` })
          return res.end()
        }
        if (req.url === '/loop') {
          res.writeHead(302, { Location: '/loop' })
          return res.end()
        }
        if (req.url === '/boom') {
          res.writeHead(500)
          return res.end('no')
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ response: 'ok' }))
      })
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as { port: number }
    origin = `http://127.0.0.1:${address.port}`
  })

  after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()))
  })

  it('reads a response body and status', async () => {
    const response = await request(`${origin}/final`)
    assert.strictEqual(response.status, 200)
    assert.deepStrictEqual(JSON.parse(response.body), { response: 'ok' })
  })

  it('reports a non-2xx status rather than throwing', async () => {
    const response = await request(`${origin}/boom`)
    assert.strictEqual(response.status, 500)
    assert.strictEqual(response.body, 'no')
  })

  it('posts JSON with the right content type and length', async () => {
    await postJson(`${origin}/final`, { model: 'm', prompt: 'p' })
    const last = received[received.length - 1]
    assert.strictEqual(last.method, 'POST')
    assert.strictEqual(last.contentType, 'application/json')
    assert.deepStrictEqual(JSON.parse(last.body), { model: 'm', prompt: 'p' })
  })

  // getLatestVersion reads the version out of where /releases/latest lands.
  it('follows redirects, relative and absolute, to where they land', async () => {
    assert.strictEqual(await resolveRedirect(`${origin}/hop1`), `${origin}/final`)
  })

  it('returns the url unchanged when nothing redirects', async () => {
    assert.strictEqual(await resolveRedirect(`${origin}/final`), `${origin}/final`)
  })

  it('gives up on a redirect loop rather than hanging', async () => {
    assert.strictEqual(await resolveRedirect(`${origin}/loop`, 3), `${origin}/loop`)
  })

  it('rejects when the host cannot be reached', async () => {
    await assert.rejects(request('http://127.0.0.1:1/nowhere'))
  })
})
