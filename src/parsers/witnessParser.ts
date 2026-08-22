export interface TraceStep {
  file?: string
  line?: number
  /** Set on the step that enters a function, not on every step inside it. */
  enterFunction?: string
  /** Variable values ESBMC pinned at this step, e.g. `x == 11`. */
  assumptions: string[]
  thread?: number
}

const ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&amp;': '&'
}

function decode (value: string): string {
  return value.replace(/&(?:lt|gt|quot|apos|amp);/g, entity => ENTITIES[entity])
}

function dataOf (block: string): Array<[string, string]> {
  const entries: Array<[string, string]> = []
  for (const [, key, value] of block.matchAll(/<data key="([^"]+)">([\s\S]*?)<\/data>/g)) {
    entries.push([key, decode(value).trim()])
  }
  return entries
}

/**
 * Reads the counterexample out of an ESBMC GraphML violation witness.
 *
 * The witness is machine-generated with a flat, known shape — a `graph` of
 * `data` elements followed by `edge` elements in execution order — so it is
 * read directly rather than through a general XML parser. The end-to-end test
 * against real ESBMC output is what pins that assumption.
 *
 * Only the SARIF report says which property failed; this says how execution
 * reached it.
 */
export function parseGraphmlWitness (xml: string): TraceStep[] {
  const programFile = /<data key="programfile">([\s\S]*?)<\/data>/.exec(xml)
  const file = programFile === null ? undefined : decode(programFile[1]).trim()

  const steps: TraceStep[] = []
  for (const [block] of xml.matchAll(/<edge\b[\s\S]*?<\/edge>/g)) {
    const step: TraceStep = { assumptions: [], file }
    for (const [key, value] of dataOf(block)) {
      switch (key) {
        case 'startline': {
          const line = Number(value)
          if (Number.isInteger(line) && line > 0) { step.line = line }
          break
        }
        case 'enterFunction':
          step.enterFunction = value
          break
        case 'assumption':
          // ESBMC writes one statement per assumption, terminated by ';'.
          for (const assumption of value.split(';')) {
            if (assumption.trim() !== '') { step.assumptions.push(assumption.trim()) }
          }
          break
        case 'threadId': {
          const thread = Number(value)
          if (Number.isInteger(thread)) { step.thread = thread }
          break
        }
      }
    }
    steps.push(step)
  }
  return steps
}

/** One line describing a step, for a tree label. */
export function describeStep (step: TraceStep): string {
  if (step.assumptions.length > 0) {
    return step.assumptions.join(', ')
  }
  if (step.enterFunction !== undefined) {
    return `enter ${step.enterFunction}`
  }
  return step.line === undefined ? 'step' : `line ${step.line}`
}
