import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import { ChatDeps, handleChatRequest, pickTarget } from '../../chat/handler'
import type { AiRequest } from '../../ai/backend'
import { VerifyResult } from '../../verify'

function result (overrides: Partial<VerifyResult> = {}): VerifyResult {
  return {
    verdict: { kind: 'violations', count: 1 },
    findings: [{ file: '/src/a.c', line: 5, message: 'array bounds violated', severity: 'error', cwes: [] }],
    trace: [],
    transcript: 'VERIFICATION FAILED',
    command: 'esbmc a.c',
    ...overrides
  }
}

/** Collects what a reply would have shown, in the order it was streamed. */
class FakeStream {
  public readonly markdowns: string[] = []
  public readonly progressed: string[] = []

  public markdown (value: string): void { this.markdowns.push(String(value)) }
  public progress (value: string): void { this.progressed.push(value) }
  public text (): string { return this.markdowns.join('') }
}

const RUNNING = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) }

function deps (overrides: Partial<ChatDeps> = {}): ChatDeps {
  return {
    referenced: [],
    active: { file: '/src/a.c', isDirty: false },
    verify: async () => result(),
    readSource: () => 'int main() { return 0; }',
    respond: async function * () { yield 'because x is 11' },
    backendLabel: 'the VS Code chat model',
    ...overrides
  }
}

async function ask (request: { command?: string, prompt?: string }, chatDeps: ChatDeps): Promise<FakeStream> {
  const stream = new FakeStream()
  await handleChatRequest(
    { command: request.command, prompt: request.prompt ?? '' } as any,
    stream as any,
    RUNNING as any,
    chatDeps
  )
  return stream
}

describe('pickTarget', () => {
  it('prefers a file the user attached over the one they are looking at', () => {
    const active = { file: '/src/open.c', isDirty: false }
    assert.strictEqual(pickTarget(['/src/attached.c'], active)?.file, '/src/attached.c')
  })

  it('ignores an attachment ESBMC cannot verify', () => {
    const active = { file: '/src/open.c', isDirty: false }
    assert.strictEqual(pickTarget(['/notes.md'], active)?.file, '/src/open.c')
  })

  it('has nothing to say with no file anywhere', () => {
    assert.strictEqual(pickTarget([], undefined), undefined)
  })
})

describe('handleChatRequest', () => {
  it('offers its commands when there is no file in scope', async () => {
    const stream = await ask({}, deps({ active: undefined }))
    assert.match(stream.text(), /\/verify/)
  })

  it('refuses a file ESBMC cannot verify, and says what it can', async () => {
    const stream = await ask({}, deps({ active: { file: '/src/notes.md', isDirty: false } }))
    assert.match(stream.text(), /C, C\+\+, Python, Solidity and Jimple/)
  })

  // ESBMC reads the file from disk, so an explanation of an unsaved buffer
  // would describe code the user is not looking at.
  it('warns that unsaved changes were not verified', async () => {
    const stream = await ask({}, deps({ active: { file: '/src/a.c', isDirty: true } }))
    assert.match(stream.text(), /unsaved changes/)
  })

  it('reports the verdict and stops there for /verify', async () => {
    let asked = false
    const stream = await ask({ command: 'verify' }, deps({
      respond: async function * () { asked = true }
    }))
    assert.match(stream.text(), /VERIFICATION FAILED/)
    assert.strictEqual(asked, false, '/verify called a model')
  })

  it('explains the counterexample when asked to', async () => {
    const stream = await ask({ command: 'explain' }, deps())
    assert.match(stream.text(), /because x is 11/)
  })

  it('asks for a repair rather than an explanation for /fix', async () => {
    let task: string | undefined
    await ask({ command: 'fix' }, deps({
      respond: async function * (request: AiRequest) { task = request.task }
    }))
    assert.strictEqual(task, 'fix')
  })

  it('passes the user their own words through', async () => {
    let question: string | undefined
    await ask({ prompt: 'is the loop bound wrong?' }, deps({
      respond: async function * (request: AiRequest) { question = request.question }
    }))
    assert.strictEqual(question, 'is the loop bound wrong?')
  })

  // The model is shown what ESBMC read, not what an editor is holding.
  it('sends the source from disk', async () => {
    let source: string | undefined
    await ask({ command: 'explain' }, deps({
      readSource: () => 'from disk',
      respond: async function * (request: AiRequest) { source = request.source }
    }))
    assert.strictEqual(source, 'from disk')
  })

  it('calls no model when there is nothing to explain', async () => {
    let asked = false
    const stream = await ask({ command: 'explain' }, deps({
      verify: async () => result({ verdict: { kind: 'success' }, findings: [] }),
      respond: async function * () { asked = true }
    }))
    assert.strictEqual(asked, false)
    assert.match(stream.text(), /no counterexample to explain/)
  })

  it('says where to look when ESBMC never ran', async () => {
    const stream = await ask({}, deps({ verify: async () => undefined }))
    assert.match(stream.text(), /output channel/)
  })

  // Words typed after a slash command used to be dropped, so the model was
  // asked the standard question instead of the one on screen.
  it('passes the user their own words through alongside a command', async () => {
    let question: string | undefined
    await ask({ command: 'explain', prompt: 'is the loop bound wrong?' }, deps({
      respond: async function * (request: AiRequest) { question = request.question }
    }))
    assert.strictEqual(question, 'is the loop bound wrong?')
  })

  it('asks no question of its own when the user typed only a command', async () => {
    let question: string | undefined = 'unset'
    await ask({ command: 'explain' }, deps({
      respond: async function * (request: AiRequest) { question = request.question }
    }))
    assert.strictEqual(question, undefined)
  })

  // A stale #file: reference makes openTextDocument reject, which used to
  // escape the participant and leave the request with no reply at all.
  it('answers even when verification throws', async () => {
    const stream = await ask({ command: 'explain' }, deps({
      verify: async () => { throw new Error('cannot open file') }
    }))
    assert.match(stream.text(), /ESBMC could not verify/)
    assert.match(stream.text(), /cannot open file/)
  })

  // An unavailable backend still leaves the verdict on screen, which is the
  // half of the answer that needed no model.
  it('keeps the verdict when the backend cannot answer', async () => {
    const stream = await ask({ command: 'explain' }, deps({
      respond: async function * () { throw new Error('No chat model is available.') }
    }))
    assert.match(stream.text(), /VERIFICATION FAILED/)
    assert.match(stream.text(), /No chat model is available/)
  })
})

describe('every slash command the manifest advertises', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'package.json'), 'utf8')
  )
  const advertised: string[] = manifest.contributes.chatParticipants[0].commands
    .map((command: { name: string }) => command.name)

  it('is handled distinctly, not just contributed', async () => {
    assert.ok(advertised.length > 0)
    for (const command of advertised) {
      const asked: AiRequest[] = []
      await ask({ command }, deps({
        respond: async function * (request: AiRequest) { asked.push(request) }
      }))
      if (command === 'verify') {
        assert.strictEqual(asked.length, 0, '/verify asked a model')
        continue
      }
      assert.strictEqual(asked.length, 1, `/${command} asked no model`)
      assert.strictEqual(asked[0].task, command === 'fix' ? 'fix' : 'explain', `/${command} chose the wrong task`)
    }
  })
})

// The handler imports vscode for types only, which is what lets these tests
// run at all. A value import would compile to a require the module cannot
// satisfy outside the editor, and this whole file with it.
describe('chat handler packaging', () => {
  it('needs no VS Code at run time', () => {
    const compiled = fs.readFileSync(path.resolve(__dirname, '..', '..', 'chat', 'handler.js'), 'utf8')
    assert.doesNotMatch(compiled, /require\("vscode"\)/)
  })
})
