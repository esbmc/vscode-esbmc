import * as vscode from 'vscode'
import { TraceStep, describeStep } from '../parsers/witnessParser'

class TraceItem extends vscode.TreeItem {
  public constructor (step: TraceStep, index: number | undefined) {
    super(describeStep(step), vscode.TreeItemCollapsibleState.None)
    this.description = step.line === undefined ? undefined : `line ${step.line}`
    this.tooltip = [step.enterFunction, step.file].filter(Boolean).join(' — ')
    this.id = index === undefined ? undefined : String(index)
    if (step.file !== undefined && step.line !== undefined) {
      const position = new vscode.Position(Math.max(0, step.line - 1), 0)
      this.command = {
        command: 'vscode.open',
        title: 'Go to this step',
        arguments: [vscode.Uri.file(step.file), { selection: new vscode.Range(position, position) }]
      }
    }
  }
}

/**
 * Lists the counterexample as steps you can click through, which is the
 * difference between being told a property failed and seeing why.
 */
export class TraceView implements vscode.TreeDataProvider<TraceStep> {
  private readonly changed = new vscode.EventEmitter<undefined>()
  public readonly onDidChangeTreeData = this.changed.event
  private steps: TraceStep[] = []
  // A trace of a few thousand steps is ordinary, and looking each one up by
  // scanning would make rendering quadratic.
  private indices = new Map<TraceStep, number>()

  public show (steps: TraceStep[]): void {
    this.steps = steps
    this.indices = new Map(steps.map((step, index) => [step, index]))
    this.changed.fire(undefined)
    // The view's `when` clause hides it until a run produces a trace.
    vscode.commands.executeCommand('setContext', 'esbmc.hasTrace', steps.length > 0)
  }

  public clear (): void {
    this.show([])
  }

  public getTreeItem (step: TraceStep): vscode.TreeItem {
    return new TraceItem(step, this.indices.get(step))
  }

  public getChildren (step?: TraceStep): TraceStep[] {
    return step === undefined ? this.steps : []
  }

  public dispose (): void {
    this.changed.dispose()
  }
}
