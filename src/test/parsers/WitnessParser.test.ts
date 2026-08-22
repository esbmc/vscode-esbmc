import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import { parseGraphmlWitness, describeStep, TraceStep } from '../../parsers/witnessParser'

const FIXTURE = path.resolve(__dirname, '..', '..', '..', 'src', 'test', 'fixtures', 'violation.graphml')

// A real witness from `esbmc nondet.c --witness-output-graphml`, with only the
// absolute source path made portable.
const witness = fs.readFileSync(FIXTURE, 'utf8')

function graphml (edges: string, programFile = '/src/a.c'): string {
  return `<graphml><graph>
    <data key="programfile">${programFile}</data>
    ${edges}
  </graph></graphml>`
}

function edge (data: string): string {
  return `<edge id="E" source="N0" target="N1">${data}</edge>`
}

describe('parseGraphmlWitness', () => {
  it('reads a real ESBMC violation witness', () => {
    const steps = parseGraphmlWitness(witness)
    assert.strictEqual(steps.length, 4)
    assert.deepStrictEqual(steps.map(s => s.line), [undefined, 4, 5, 7])
    assert.deepStrictEqual(steps.map(s => s.assumptions), [[], ['x == 11'], ['y == -8'], []])
    assert.strictEqual(steps[0].enterFunction, 'main')
    assert.ok(steps.every(s => s.file === '/src/nondet.c'))
    // The entry edge carries createThread rather than threadId.
    assert.deepStrictEqual(steps.map(s => s.thread), [undefined, 0, 0, 0])
  })

  it('keeps the steps in execution order', () => {
    const steps = parseGraphmlWitness(graphml(
      [3, 1, 2].map(line => edge(`<data key="startline">${line}</data>`)).join('')
    ))
    assert.deepStrictEqual(steps.map(s => s.line), [3, 1, 2])
  })

  it('splits several assumptions on one edge', () => {
    const [step] = parseGraphmlWitness(graphml(
      edge('<data key="assumption">x == 1; y == 2;</data>')
    ))
    assert.deepStrictEqual(step.assumptions, ['x == 1', 'y == 2'])
  })

  it('decodes XML entities in an assumption', () => {
    const [step] = parseGraphmlWitness(graphml(
      edge('<data key="assumption">x &lt; 5 &amp;&amp; y &gt; 1;</data>')
    ))
    assert.deepStrictEqual(step.assumptions, ['x < 5 && y > 1'])
  })

  it('ignores a line number that is not one', () => {
    const [step] = parseGraphmlWitness(graphml(edge('<data key="startline">nonsense</data>')))
    assert.strictEqual(step.line, undefined)
  })

  it('returns nothing for a witness with no edges', () => {
    assert.deepStrictEqual(parseGraphmlWitness(graphml('')), [])
    assert.deepStrictEqual(parseGraphmlWitness('not xml at all'), [])
  })

  it('leaves the file undefined when the witness names none', () => {
    const [step] = parseGraphmlWitness('<graphml>' + edge('<data key="startline">1</data>') + '</graphml>')
    assert.strictEqual(step.file, undefined)
    assert.strictEqual(step.line, 1)
  })
})

describe('describeStep', () => {
  function step (overrides: Partial<TraceStep> = {}): TraceStep {
    return { assumptions: [], ...overrides }
  }

  it('prefers the variable values, which are the point of the trace', () => {
    assert.strictEqual(
      describeStep(step({ assumptions: ['x == 11', 'y == -8'], line: 4, enterFunction: 'main' })),
      'x == 11, y == -8'
    )
  })

  it('names the function when a step enters one', () => {
    assert.strictEqual(describeStep(step({ enterFunction: 'main' })), 'enter main')
  })

  it('falls back to the line, then to nothing useful', () => {
    assert.strictEqual(describeStep(step({ line: 7 })), 'line 7')
    assert.strictEqual(describeStep(step()), 'step')
  })
})
