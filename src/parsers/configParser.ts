import { workspace } from 'vscode'
import { sha1 } from 'object-hash'
import { flatten } from 'flatten-anything'

import { Configuration } from '../@types/vscode.configuration'

export const SECTIONS = [
  'bmc',
  'concurrencyChecking',
  'frontEnd',
  'kinduction',
  'propertyChecking',
  'solver',
  'trace'
]

export class ConfigurationParser {
  private _root: string = 'esbmc'
  private _sections = [
    'bmc',
    'concurrencyChecking',
    'frontEnd',
    'kinduction',
    'propertyChecking',
    'solver',
    'trace'
  ]

  private cached_hash: string
  private cached_flags: string
  private flags: string[]
  private flatSectionConfig: Configuration

  public constructor () {
    this.cached_hash = ''
    this.cached_flags = ''
    this.flags = []
    this.flatSectionConfig = {}
  }

  /**
     * Parses ESBMC settings
     * @returns flags used to run ESBMC
     */
  public parse (): string {
    const workspaceConfig = workspace.getConfiguration(this._root)
    const hash = sha1(workspaceConfig)
    // Check to see if incoming object hasn't changed and avoid redundant parsing
    if (hash === this.cached_hash) {
      return this.cached_flags
    }
    this.flags = []
    // Parse each section
    for (const section of this._sections) {
      const sectionConfig = workspaceConfig.inspect<Configuration>(section)
      const sectionChangedValues = sectionConfig?.globalValue
      // If sections configurations are all default we will have
      // undefined section values and should skip
      if (sectionChangedValues === undefined) {
        continue
      }
      this.parseSection(sectionChangedValues, section)
    }
    // Store cached values if parsing completes
    this.cached_hash = hash
    this.cached_flags = this.flags.join(' ')
    return this.cached_flags
  }

  /**
     * Parses ESBMC settings subsections
     *
     * @param config extensions sections configuration
     * @param section extensions section to parse
     */
  private parseSection (config: Configuration, section: string): void {
    // Store flattened section config to use in dependent flags
    this.flatSectionConfig = flatten(config)
    for (const [key, value] of Object.entries(this.flatSectionConfig)) {
      switch (section) {
        case 'propertyChecking': {
          this.parsePropertyChecking(key, value)
          break
        }
        case 'kinduction': {
          this.parseKInduction(key, value)
          break
        }
        case 'trace' :{
          this.parseTrace(key, value)
          break
        }
        case 'concurrencyChecking': {
          this.parseConcurrencyChecking(key, value)
          break
        }
        case 'frontEnd': {
          this.parseFrontEnd(key, value)
          break
        }
        case 'bmc': {
          this.parseBMC(key, value)
          break
        }
        case 'solver': {
          this.parseSolver(key, value)
          break
        }
      }
    }
  }

  /**
     * Adds string like ESBMC flag to the set of flags
     *
     * @param value the value of the setting
     * @param defaultValue the default value of the setting
     * @param flag the flag to be added under the condition
     * @param [errorMessage] optional error message to shows
     */
  private addFlag (condition: boolean, flag: string, errorMessage?: string): void {
    if (!condition) {
      if (errorMessage !== undefined) {
        throw Error(errorMessage)
      }
    } else {
      this.flags.push(flag)
    }
  }

  /**
     * Adds numeric like ESBMC flag to the set of flags
     *
     * @param value the value of the setting
     * @param defaultValue the default value of the setting
     * @param flag the flag to be added under the condition
     * @param [errorMessage] optional error message to show to show if present
     */
  private addNumericFlag (value: number, defaultValue: number, flag: string, errorMessage?: string): void {
    if (value === defaultValue) { return }
    const condition = value > 0 && Number.isInteger(value)
    if (errorMessage === undefined) { this.addFlag(condition, flag) } else { this.addFlag(condition, flag, errorMessage) }
  }

  /**
     * Adds boolean like ESBMC flag to the set of flags
     *
     * @param value the value of the setting
     * @param defaultValue the default value of the setting
     * @param flag the flag to be added under the condition
     * @param [errorMessage] optional error message to show to show if present
     */
  private addBooleanFlag (value: boolean, defaultValue: boolean, flag: string, errorMessage?: string): void {
    const condition = value === defaultValue
    if (condition) { return }
    if (errorMessage === undefined) { this.addFlag(true, flag) } else { this.addFlag(true, flag, errorMessage) }
  }

  /**
     * Adds string like ESBMC flag to the set of flags
     *
     * @param value the value of the setting
     * @param defaultValue the default value of the setting
     * @param flag the flag to be added under the condition
     * @param [errorMessage] optional error message to show to show if present
     */
  private addStringFlag (value: string, defaultValue: string, flag: string, errorMessage?: string): void {
    const condition = value === defaultValue
    // Only add flag if the value is not the default one
    if (!condition) {
      if (errorMessage === undefined) { this.addFlag(true, flag) } else { this.addFlag(true, flag, errorMessage) }
    }
  }

  /**
     * Adds ESBMC flags of generic types to the set of flagsby routing to
     * appropriate functions
     *
     * @see {addNumericFlag}
     * @see {addBooleanFlag}
     * @see {ddStringFlag}
     *
     * @param value the value of the setting
     * @param defaultValue the default value of the setting
     * @param flag the flag to be added under the condition
     * @param [errorMessage] optional error message to show to show if present
     */
  private addGenericFlag (value: any, defaultValue: any, flag: string, errorMessage?: string): void {
    switch (typeof value) {
      case 'string': {
        errorMessage === undefined
          ? this.addStringFlag(value, defaultValue as string, flag)
          : this.addStringFlag(value, defaultValue as string, flag, errorMessage)
        break
      }
      case 'number': {
        errorMessage === undefined
          ? this.addNumericFlag(value, defaultValue as number, flag)
          : this.addNumericFlag(value, defaultValue as number, flag, errorMessage)
        break
      }
      case 'boolean': {
        errorMessage === undefined
          ? this.addBooleanFlag(value, defaultValue as boolean, flag)
          : this.addBooleanFlag(value, defaultValue as boolean, flag, errorMessage)
        break
      }
    }
  }

  /**
     * Adds dependent ESBMC flag to the set of flags
     *
     * - The prerequisite variables govern the addition of the primary flag
     * - The dependent variables govern the addition of the secondary flag
     *   as well as the prerequisite
     *
     * @param prereqKey the ID for the prerequisite setting
     * @param prereqValue the value of the prerequisite setting
     * @param prereqDefaultValue the default value of the prerequisite setting
     * @param primaryFlag the associated flag for the prerequisite setting
     * @param dependentKey the ID for the dependent setting
     * @param dependentValue the value of the dependent setting
     * @param dependentDefaultValue the default value of the dependent setting
     * @param secondaryFlag the associated flag for the prerequisite setting
     * @param [prereqCondition] optional prerequisite conditions for adding flags
     * @param [dependentCondition] optional dependent conditions for adding flags
     */
  private addDependentFlags (
    prereqKey: string, prereqValue: any,
    prereqDefaultValue: any, primaryFlag: string,
    dependentKey: string, dependentValue: any,
    dependentDefaultValue: any, secondaryFlag: string,
    prereqCondition: boolean = true, dependentCondition: boolean = true): void {
    // Dependent flag is added if the dependentKey is not in the section config
    if (prereqKey in this.flatSectionConfig && !(dependentKey in this.flatSectionConfig) && prereqCondition) {
      this.addGenericFlag(prereqValue, prereqDefaultValue, primaryFlag)
    }
    if (prereqKey in this.flatSectionConfig && dependentKey in this.flatSectionConfig && prereqCondition && dependentCondition) {
      this.addGenericFlag(dependentValue, dependentDefaultValue, secondaryFlag)
    }
  }

  private addMutexFlags (conditions: boolean[], _flags: string[], errorMessage?: string): void {
    if (conditions.filter(c => c === true).length > 1) {
      return
    }
    const holdingConditionIndex = conditions.indexOf(true)
    let condition: boolean
    let flag: string
    if (holdingConditionIndex === -1) {
      condition = false
      flag = ''
    } else {
      condition = true
      flag = _flags[holdingConditionIndex]
    }
    this.addFlag(condition, flag, errorMessage)
  }

  private parsePropertyChecking (key: string, value: any): void {
    switch (key) {
      case 'properties.assertions': {
        this.addBooleanFlag(value, true, '--no-assertions')
        break
      }
      case 'properties.arrayBounds': {
        this.addBooleanFlag(value, true, '--no-bounds-check')
        break
      }
      case 'properties.divisionByZero': {
        this.addBooleanFlag(value, true, '--no-div-by-zero-check')
        break
      }
      case 'properties.pointer': {
        this.addBooleanFlag(value, true, '--no-pointer-check')
        break
      }
      case 'properties.pointerAlignment': {
        this.addBooleanFlag(value, true, '--no-align-check')
        break
      }
      case 'properties.pointerRelations': {
        this.addBooleanFlag(value, true, '--no-pointer-relation-check')
        break
      }
      case 'properties.nan': {
        this.addBooleanFlag(value, false, '--nan-check')
        break
      }
      case 'properties.memoryLeak': {
        this.addBooleanFlag(value, false, '--memory-leak-check')
        break
      }
      case 'properties.overflowAndUnderflow': {
        this.addBooleanFlag(value, false, '--overflow-check')
        break
      }
      case 'properties.structFields': {
        this.addBooleanFlag(value, false, '--struct-fields-check')
        break
      }
      case 'properties.deadlock': {
        this.addBooleanFlag(value, false, '--deadlock-check')
        break
      }
      case 'properties.dataRace': {
        this.addBooleanFlag(value, false, '--data-races-check')
        break
      }
      case 'properties.lockOrder': {
        this.addBooleanFlag(value, false, '--lock-order-check')
        break
      }
      case 'properties.atomicity': {
        this.addBooleanFlag(value, false, '--atomicity-check')
        break
      }
      case 'properties.forceMallocSuccess': {
        this.addBooleanFlag(value, true, '--force-malloc-success')
        break
      }
      case 'checkStackLimit': {
        this.addNumericFlag(
          value, -1, `--stack-limit ${value}`,
          'Invalid value for checkStackLimit, it must be a positive integer or -1'
        )
        break
      }
      case 'checkErrorLabel': {
        this.addStringFlag(value, '', `--error-label ${value}`)
        break
      }
      default: {
        break
      }
    }
  }

  private parseKInduction (key: string, value: any): void {
    switch (key) {
      case 'checkBaseCase': {
        this.addBooleanFlag(value, false, '--base-case')
        break
      }
      case 'checkForwardCondition': {
        this.addBooleanFlag(value, false, '--forward-condition')
        break
      }
      case 'checkInductiveStep': {
        this.addBooleanFlag(value, false, '--inductive-step')
        break
      }
      case 'prove': {
        const dependentKey = 'parallelise'
        const dependentDefaultValue = false
        const dependentValue = dependentKey in this.flatSectionConfig
          ? this.flatSectionConfig[dependentKey]
          : dependentDefaultValue
        this.addDependentFlags(
          'prove', value, false, '--k-induction',
          dependentKey, dependentValue, dependentDefaultValue, '--k-induction-parallel')
        break
      }
      case 'kIncrement': {
        this.addNumericFlag(
          value,
          1,
                    `--k-step ${value}`,
                    'Invalid value for kIncrement, it must be a positive integer'
        )
        break
      }
      case 'iterationMax': {
        console.log([value > 0, value === -1])
        this.addMutexFlags(
          [value > 0, value === -1],
          [`--max-k-step ${value}`, '--unlimited-k-steps'],
          'Invalid value for iterationMax, it must be a positive integer or -1.'
        )
        break
      }
      case 'bidirectional': {
        this.addBooleanFlag(value, false, '--show-symex-value-set')
        break
      }
      default: {
        break
      }
    }
  }

  private parseTrace (key: string, value:any): void {
    switch (key) {
      case 'options.quiet': {
        this.addBooleanFlag(value, false, '--quiet')
        break
      }
      case 'options.compact': {
        this.addBooleanFlag(value, false, '--compact-trace')
        break
      }
      case 'options.ssa': {
        this.addBooleanFlag(value, false, '--ssa-trace')
        break
      }
      case 'options.symex': {
        this.addBooleanFlag(value, false, '--symex-trace')
        break
      }
      case 'options.symex-ssa': {
        this.addBooleanFlag(value, false, '--symex-ssa-trace')
        break
      }
      case 'options.goto-value-set': {
        this.addBooleanFlag(value, false, '--show-goto-value-sets')
        break
      }
      case 'options.symex-value-set': {
        this.addBooleanFlag(value, false, '--show-symex-value-set')
        break
      }
      default: {
        break
      }
    }
  }

  private parseConcurrencyChecking (key: string, value:any): void {
    switch (key) {
      case 'checkAllInterleavings': {
        this.addBooleanFlag(value, false, '--all-runs')
        break
      }
      case 'gotoMerging': {
        this.addBooleanFlag(value, true, '--no-goto-merge')
        break
      }
      case 'partialOrderReduction': {
        this.addBooleanFlag(value, true, '--no-por')
        break
      }
      case 'stateHashing': {
        this.addBooleanFlag(value, false, '--state-hashing')
        break
      }
      case 'contextBound': {
        this.addNumericFlag(
          value,
          -1,
                    `--contextBound ${value}`,
                    'Invalid value for contextBound, it must be a positive integer or -1'
        )
        break
      }
      default: {
        break
      }
    }
  }

  private parseFrontEnd (key: string, value:any): void {
    switch (key) {
      case 'includePath': {
        const dependentKey = 'includeAfter'
        const dependentDefaultValue = false
        const dependentValue = dependentKey in this.flatSectionConfig
          ? this.flatSectionConfig[dependentKey]
          : dependentDefaultValue
        this.addDependentFlags(
          'includePath', value, '', `--include ${value}`,
          dependentKey, dependentValue, dependentDefaultValue, `--idirafter ${value}`)
        break
      }
      case 'defineMacros': {
        this.addStringFlag(value, '', `--define ${value}`)
        break
      }
      case 'programLoopClaimVcs': {
        this.addStringFlag(value, 'none', `--${value}`)
        break
      }
      case 'claimRemoval': {
        this.addBooleanFlag(value, false, '--all-claims')
        break
      }
      case 'wordLength': {
        this.addNumericFlag(value, 64, `--${value}`)
        break
      }
      case 'architecture': {
        this.addStringFlag(value, 'i386-linux', `--${value}`)
        break
      }
      case 'endianness': {
        this.addStringFlag(value, 'auto', `--${value}`)
        break
      }
      case 'printingOptions': {
        this.addStringFlag(value, 'verify', `--${value}`)
        break
      }
      case 'resultOnly': {
        this.addBooleanFlag(value, false, '--result-only')
        break
      }
      default: {
        break
      }
    }
  }

  private parseBMC (key: string, value:any): void {
    switch (key) {
      case 'mainFunction': {
        this.addStringFlag(value, '', `--function ${value}`)
        break
      }
      case 'claim': {
        this.addNumericFlag(
          value,
          -1,
                    `--claim ${value}`,
                    'Invalid value for contextBound, it must be a positive integer or -1'
        )
        break
      }
      case 'instruction': {
        this.addNumericFlag(
          value,
          -1,
                    `--instruction ${value}`,
                    'Invalid value for instruction, it must be a positive integer or -1'
        )
        break
      }
      case 'unwind': {
        this.addNumericFlag(
          value,
          -1,
                    `--unwind ${value}`,
                    'Invalid value for unwind, it must be a positive integer or -1'
        )
        break
      }
      case 'unwindSet': {
        this.addNumericFlag(
          value,
          -1,
                    `--unwindset ${value}`,
                    'Invalid value for unwindSet, it must be a positive integer or -1'
        )
        break
      }
      case 'unwindingAssertions': {
        this.addBooleanFlag(value, true, '--no-unwinding-assertions')
        break
      }
      case 'partialUnwinding': {
        this.addBooleanFlag(value, false, '--partial-loops')
        break
      }
      case 'sliceEquations': {
        this.addBooleanFlag(value, true, '--no-slice')
        break
      }
      case 'initializeNondetVariables': {
        this.addBooleanFlag(value, false, '--initialize-nondet-variables')
        break
      }
      case 'gotoUnwinding': {
        this.addBooleanFlag(value, false, '--goto-unwind')
        break
      }
      case 'sliceAssumes': {
        this.addBooleanFlag(value, false, '--slice-assumes')
        break
      }
      case 'incrementalBmc': {
        this.addBooleanFlag(value, false, '--incremental-bmc')
        break
      }
      case 'falsification': {
        this.addBooleanFlag(value, false, '--falsification')
        break
      }
      case 'termination': {
        this.addBooleanFlag(value, false, '--termination')
        break
      }
      default: {
        break
      }
    }
  }

  private parseSolver (key: string, value:any): void {
    switch (key) {
      case 'smtSolver': {
        const dependentKey = 'customSmtSolverPath'
        const dependentDefaultValue = ''
        const dependentValue = dependentKey in this.flatSectionConfig
          ? this.flatSectionConfig[dependentKey]
          : dependentDefaultValue
        this.addDependentFlags(
          'smtSolver',
          value,
          'boolector',
                    `--${value}`,
                    dependentKey,
                    dependentValue,
                    dependentDefaultValue,
                    `--smtlib-solver-prog 
                    ${dependentValue}`,
                    value === 'custom'
        )
        break
      }
      case 'smtLibFormat': {
        this.addBooleanFlag(value, false, '--smtlib')
        break
      }
      case 'vccOutput': {
        this.addStringFlag(value, '', `--output ${value}`)
        break
      }
      case 'arithmetic': {
        this.addStringFlag(value, 'auto', `--${value}`)
        break
      }
      case 'floatingPointEncoding': {
        this.addStringFlag(value, 'auto', `--${value}`)
        break
      }
      case 'tupleEncoding': {
        this.addStringFlag(value, 'auto', `--tuple-${value}`)
        break
      }
      case 'arrayEncoding': {
        this.addStringFlag(value, 'auto', `--array-${value}`)
        break
      }
      case 'returnValueOptimisation': {
        this.addBooleanFlag(value, true, '--no-return-value-opt')
        break
      }
      case 'incrementalSmt': {
        this.addBooleanFlag(value, false, '--smt-during-symex')
        break
      }
      case 'checkThreadGuard': {
        this.addBooleanFlag(value, false, '--smt-thread-guard')
        break
      }
      case 'checkSymexGuard': {
        this.addBooleanFlag(value, false, '--smt-symex-guard')
        break
      }
      case 'checkSymexAsserts': {
        this.addBooleanFlag(value, false, '--smt-symex-assert')
        break
      }
      default: {
        break
      }
    }
  }
}
