import * as http from 'http'
import * as https from 'https'

export interface HttpResponse {
  status: number
  body: string
  /** Set when the response is a redirect. */
  location?: string
}

const DEFAULT_TIMEOUT_MS = 30000

function clientFor (url: string): typeof http | typeof https {
  return new URL(url).protocol === 'http:' ? http : https
}

/**
 * A minimal HTTP client over Node's own modules.
 *
 * node-fetch became ESM-only at v3 and cannot be required from this extension,
 * which compiles to CommonJS, and the global fetch is not available in the
 * Node that older VS Code builds ship. Two requests do not justify either
 * constraint.
 */
export async function request (
  url: string,
  options: {
    method?: string
    body?: string
    headers?: Record<string, string>
    timeoutMs?: number
  } = {}
): Promise<HttpResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  return new Promise<HttpResponse>((resolve, reject) => {
    const headers = { ...options.headers }
    if (options.body !== undefined) {
      // Node would otherwise send the body chunked, which Ollama accepts but
      // some servers reject outright. No test covers this, because chunked
      // works against a Node test server either way.
      headers['Content-Length'] = String(Buffer.byteLength(options.body))
    }
    const call = clientFor(url).request(url, { method: options.method ?? 'GET', headers }, response => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { body += chunk })
      response.on('end', () => resolve({
        status: response.statusCode ?? 0,
        body,
        location: response.headers.location
      }))
    })
    // Without this an unresponsive host holds the install spinner open with no
    // way for the user to cancel it.
    call.setTimeout(timeoutMs, () => {
      call.destroy(new Error(`No response from ${url} after ${timeoutMs}ms`))
    })
    call.on('error', reject)
    if (options.body !== undefined) {
      call.write(options.body)
    }
    call.end()
  })
}

/**
 * Follows redirects and reports where they land, which is how the latest
 * release version is discovered.
 *
 * @throws when the redirects outlast `maxHops`, since the last url reached is
 * still a redirect and callers would read a version out of it.
 */
export async function resolveRedirect (url: string, maxHops = 5): Promise<string> {
  let current = url
  for (let hop = 0; hop < maxHops; hop++) {
    const response = await request(current, { method: 'HEAD' })
    if (response.status < 300 || response.status >= 400 || response.location === undefined) {
      return current
    }
    current = new URL(response.location, current).toString()
  }
  throw new Error(`${url} still redirects after ${maxHops} hops`)
}

export async function postJson (url: string, payload: unknown): Promise<HttpResponse> {
  return request(url, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  })
}
