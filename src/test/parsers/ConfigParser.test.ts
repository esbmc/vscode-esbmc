import * as assert from 'assert';
import * as vscode from 'vscode';
import { Configuration } from '../../@types/vscode.configuration';
import { ConfigurationParser, SECTIONS } from '../../parsers/configParser';

const SETTINGS_ROOT = `esbmc`;

const POSITIVE_INTEGER_VALUE = 3;
const NEGATIVE_INTEGER_VALUE = -99;
const NON_INTEGER_VALUE = 1.1;

const VALID_PATH = "some/valid/path/";
const VALID_MACRO = "#define max(a,b) (a < b) ? b : a";
const VALID_FUNCTION_NAME = "notMain";

async function resetSettings() {
    let config = vscode.workspace.getConfiguration(SETTINGS_ROOT);
    // Parse each settings and remove any non-default values
    await Promise.all(SECTIONS.map(async (section) => {
        let settingsConfig = config.inspect<Configuration>(section);
        let settingsChangedValues = settingsConfig?.['globalValue'];
        // If settings configurations are all default we will have 
        // undefined settings values and should skip
        if (settingsChangedValues === undefined) {
            return; 
        }
        // Using async/await in for loops doesnt really work in TS
        // so instead push all promises to an array and then await all 
        // below.
        const flattenedKeys = Object.keys(settingsChangedValues);
        await Promise.all(flattenedKeys.map(async (setting) => {
            await config.update(`${section}.${setting}`, undefined, true);
        }));
    }));
}

async function configureSettings(settings: string[], values: any[]) {
    let config = vscode.workspace.getConfiguration(SETTINGS_ROOT);
    await Promise.all(settings.map(async (setting, index) => {
        const value = values[index];
        await config.update(setting, value, true);
      }));
}

async function assertCorrectFlagParse(settings: string[], values: any[], expected: string) {
    await configureSettings(settings, values);
    let configParser: ConfigurationParser = new ConfigurationParser();
    let flags: string = configParser.parse();
    assert.equal(flags, expected, `Flags do not match. Expected: ${expected}, Got: ${flags}`);
}

async function assertIncorrectFlagParseThrows(settings: string[], values: any[]) {
    await configureSettings(settings, values);
    configureSettings(settings, values);
    let configParser: ConfigurationParser = new ConfigurationParser();
    assert.throws(() => configParser.parse(), Error);
}

describe('ConfigurationParser Test Suite', () => {
    beforeEach("Reseting default esbmc settings", async function () {
        await resetSettings();
     });

    it(`Checking default settings outputs empty flags`, async function () {
        await assertCorrectFlagParse([], [], '');
    });

    describe('Property Checking', () => {
        const valid_tests = [
            {
                settings: ["propertyChecking.properties"], 
                values: [{arrayBounds: false}], 
                expected: `--no-bounds-check`
            },
            {
                settings: ["propertyChecking.properties"], 
                values: [{pointer: false}], 
                expected: `--no-pointer-check`
            },
            {
                settings: ["propertyChecking.properties"], 
                values: [{pointerAlignment: false}], 
                expected: `--no-align-check`
            },
            {
                settings: ["propertyChecking.properties"], 
                values: [{pointerRelations: false}], 
                expected: `--no-pointer-relation-check`
            },
            {
                settings: ["propertyChecking.properties"], 
                values: [{nan: true}], 
                expected: `--nan-check`
            },
            {
                settings: ["propertyChecking.properties"], 
                values: [{memoryLeak: true}], 
                expected: `--memory-leak-check`
            },
            {
                settings: ["propertyChecking.properties"], 
                values: [{divisionByZero: false}], 
                expected: `--no-div-by-zero-check`
            },
            {
                settings: ["propertyChecking.properties"], 
                values: [{overflowAndUnderflow: true}], 
                expected: `--overflow-check`
            },
            {
                settings: ["propertyChecking.properties"], 
                values: [{assertions: false}], 
                expected: `--no-assertions`
            },
            {
                settings: ["propertyChecking.properties"], 
                values: [{structFields: true}], 
                expected: `--struct-fields-check`
            },
            {
                settings: ["propertyChecking.properties"], 
                values: [{deadlock: true}], 
                expected: `--deadlock-check`
            },
            {
                settings: ["propertyChecking.properties"], 
                values: [{dataRace: true}], 
                expected: `--data-races-check`
            },
            {
                settings: ["propertyChecking.properties"], 
                values: [{lockOrder: true}], 
                expected: `--lock-order-check`
            },
            {
                settings: ["propertyChecking.properties"], 
                values: [{atomicity: true}], 
                expected: `--atomicity-check`
            },
            {
                settings: ["propertyChecking.properties"], 
                values: [{forceMallocSuccess: false}], 
                expected: `--force-malloc-success`
            },
            {
                settings: ["propertyChecking.checkStackLimit"], 
                values: [POSITIVE_INTEGER_VALUE], 
                expected: `--stack-limit ${POSITIVE_INTEGER_VALUE}`
            },
            {
                settings: ["propertyChecking.checkErrorLabel"], 
                values: [POSITIVE_INTEGER_VALUE], 
                expected: `--error-label ${POSITIVE_INTEGER_VALUE}`
            }
        ];

        // Check all settings producing a valid flag
        valid_tests.forEach(({settings, values, expected}) => {
            it(`Checking settings ${JSON.stringify(settings)} with respective valid values ${JSON.stringify(values)}`, async function () {
                await assertCorrectFlagParse(settings, values, expected);
            });
        });

        const invalid_tests = [
            {
                settings: ["propertyChecking.checkStackLimit"], 
                values: [NON_INTEGER_VALUE]
            },
            {
                settings: ["propertyChecking.checkStackLimit"], 
                values: [NEGATIVE_INTEGER_VALUE]
            }
          ];
        
        invalid_tests.forEach(({settings, values}) => {
            it(`Checking settings ${JSON.stringify(settings)} with respective invalid values ${JSON.stringify(values)} throws exception`, async function () {
                await assertIncorrectFlagParseThrows(settings, values);
            });
        });
    });

    describe('k-Induction', () => {
        const valid_tests = [
            {
                settings: ["kinduction.checkBaseCase"], 
                values: [true], 
                expected: `--base-case`
            },
            {
                settings: ["kinduction.checkForwardCondition"], 
                values: [true], 
                expected: `--forward-condition`
            },
            {
                settings: ["kinduction.checkInductiveStep"], 
                values: [true], 
                expected: `--inductive-step`
            },
            {
                settings: ["kinduction.prove"], 
                values: [true], 
                expected: `--k-induction`
            },
            {
                settings: ["kinduction.prove", "kinduction.parallelise"], 
                values: [true, true], 
                expected: `--k-induction-parallel`
            },
            {
                settings: ["kinduction.kIncrement"], 
                values: [POSITIVE_INTEGER_VALUE], 
                expected: `--k-step ${POSITIVE_INTEGER_VALUE}`
            },
            {
                settings: ["kinduction.iterationMax"], 
                values: [POSITIVE_INTEGER_VALUE], 
                expected: `--max-k-step ${POSITIVE_INTEGER_VALUE}`
            },
            {
                settings: ["kinduction.iterationMax"], 
                values: [-1], 
                expected: `--unlimited-k-steps`
            },
            {
                settings: ["kinduction.bidirectional"], 
                values: [true], 
                expected: `--show-symex-value-set`
            }            
        ];

        // Check all settings producing a valid flag
        valid_tests.forEach(({settings, values, expected}) => {
            it(`Checking settings ${JSON.stringify(settings)} with respective valid values ${JSON.stringify(values)}`, async function () {
                await assertCorrectFlagParse(settings, values, expected);
            });
        });

        const invalid_tests = [
            {
                settings: ["kinduction.kIncrement"],
                 values: [NON_INTEGER_VALUE]
            },
            {
                settings: ["kinduction.iterationMax"],
                 values: [NEGATIVE_INTEGER_VALUE]
            },
            {
                settings: ["kinduction.kIncrement"],
                 values: [NEGATIVE_INTEGER_VALUE]
            }
          ];


        invalid_tests.forEach(({settings, values}) => {
            it(`Checking settings ${JSON.stringify(settings)} with respective invalid values ${JSON.stringify(values)} throws exception`, async function () {
                await assertIncorrectFlagParseThrows(settings, values);
            });
        });
    });


    describe('Trace', () => {
        const valid_tests = [
            {
                settings: ["trace.options"], 
                values: [{"quiet": true}], 
                expected: `--quiet`
            },
            {
                settings: ["trace.options"], 
                values: [{"compact": true}], 
                expected: `--compact-trace`
            },
            {
                settings: ["trace.options"], 
                values: [{"ssa": true}], 
                expected: `--ssa-trace`
            },
            {
                settings: ["trace.options"], 
                values: [{"symex": true}], 
                expected: `--symex-trace`
            },
            {
                settings: ["trace.options"], 
                values: [{"symex-ssa": true}], 
                expected: `--symex-ssa-trace`
            },
            {
                settings: ["trace.options"], 
                values: [{"goto-value-set": true}], 
                expected: `--show-goto-value-sets`
            },
            {
                settings: ["trace.options"], 
                values: [{"symex-value-set": true}], 
                expected: `--show-symex-value-set`
            }             
        ];

        // Check all settings producing a valid flag
        valid_tests.forEach(({settings, values, expected}) => {
            it(`Checking settings ${JSON.stringify(settings)} with respective valid values ${JSON.stringify(values)}`, async function () {
                await assertCorrectFlagParse(settings, values, expected);
            });
        });
    });

    describe('Concurrency Checking', () => {
        const valid_tests = [
            {
                settings: ["concurrencyChecking.checkAllInterleavings"], 
                values: [true], 
                expected: `--all-runs`
            },
            {
                settings: ["concurrencyChecking.gotoMerging"], 
                values: [false], 
                expected: `--no-goto-merge`
            },
            {
                settings: ["concurrencyChecking.partialOrderReduction"], 
                values: [false], 
                expected: `--no-por`
            },
            {
                settings: ["concurrencyChecking.stateHashing"], 
                values: [true], 
                expected: `--state-hashing`
            },
            {
                settings: ["concurrencyChecking.contextBound"], 
                values: [POSITIVE_INTEGER_VALUE], 
                expected: `--contextBound ${POSITIVE_INTEGER_VALUE}`
            }
                
        ];

        // Check all settings producing a valid flag
        valid_tests.forEach(({settings, values, expected}) => {
            it(`Checking settings ${JSON.stringify(settings)} with respective valid values ${JSON.stringify(values)}`, async function () {
                await assertCorrectFlagParse(settings, values, expected);
            });
        });

        const invalid_tests = [
            {
                settings: ["concurrencyChecking.contextBound"],
                 values: [NON_INTEGER_VALUE]
            },
            {
                settings: ["concurrencyChecking.contextBound"],
                 values: [NEGATIVE_INTEGER_VALUE]
            }
          ];


        invalid_tests.forEach(({settings, values}) => {
            it(`Checking settings ${JSON.stringify(settings)} with respective invalid values ${JSON.stringify(values)} throws exception`, async function () {
                await assertIncorrectFlagParseThrows(settings, values);
            });
        });
    });

    describe('Front End', () => {
        const valid_tests = [
            {
                settings: ["frontEnd.includePath"], 
                values: [VALID_PATH], 
                expected: `--include ${VALID_PATH}`
            },
            {
                settings: ["frontEnd.includePath", "frontEnd.includeAfter"], 
                values: [VALID_PATH, true], 
                expected: `--idirafter ${VALID_PATH}`
            },
            {
                settings: ["frontEnd.defineMacros"], 
                values: [VALID_MACRO], 
                expected: `--define ${VALID_MACRO}`
            },
            {
                settings: ["frontEnd.programLoopClaimVcs"], 
                values: [`preprocess`], 
                expected: `--preprocess`
            },
            {
                settings: ["frontEnd.programLoopClaimVcs"], 
                values: [`no-inlining`], 
                expected: `--no-inlining`
            },
            {
                settings: ["frontEnd.programLoopClaimVcs"], 
                values: [`full-inlining`], 
                expected: `--full-inlining`
            },
            {
                settings: ["frontEnd.programLoopClaimVcs"], 
                values: [`show-loops`], 
                expected: `--show-loops`
            },
            {
                settings: ["frontEnd.programLoopClaimVcs"], 
                values: [`show-claims`], 
                expected: `--show-claims`
            },
            {
                settings: ["frontEnd.programLoopClaimVcs"], 
                values: [`show-vcc`], 
                expected: `--show-vcc`
            },
            {
                settings: ["frontEnd.programLoopClaimVcs"], 
                values: [`document-subgoals`], 
                expected: `--document-subgoals`
            },
            {
                settings: ["frontEnd.claimRemoval"], 
                values: [true], 
                expected: `--all-claims`
            },
            {
                settings: ["frontEnd.wordLength"], 
                values: [16], 
                expected: `--16`
            },
            {
                settings: ["frontEnd.wordLength"], 
                values: [32], 
                expected: `--32`
            },
            {
                settings: ["frontEnd.architecture"],
                values: ['i386-macos'], 
                expected: `--i386-macos`
            },
            {
                settings: ["frontEnd.architecture"],
                values: ['ppc-macos'], 
                expected: `--ppc-macos`
            },
            {
                settings: ["frontEnd.architecture"],
                values: ['i386-win32'], 
                expected: `--i386-win32`
            },
            {
                settings: ["frontEnd.endianness"],
                values: ['little-endian'], 
                expected: `--little-endian`
            },
            {
                settings: ["frontEnd.endianness"],
                values: ['big-endian'], 
                expected: `--big-endian`
            },
            {
                settings: ["frontEnd.printingOptions"],
                values: ['symbol-table-only'], 
                expected: `--symbol-table-only`
            },
            {
                settings: ["frontEnd.printingOptions"],
                values: ['symbol-table-too'], 
                expected: `--symbol-table-too`
            },
            {
                settings: ["frontEnd.printingOptions"],
                values: ['parse-tree-only'], 
                expected: `--parse-tree-only`
            },
            {
                settings: ["frontEnd.printingOptions"],
                values: ['parse-tree-too'], 
                expected: `--parse-tree-too`
            },
            {
                settings: ["frontEnd.printingOptions"],
                values: ['goto-functions-only'], 
                expected: `--goto-functions-only`
            },
            {
                settings: ["frontEnd.printingOptions"],
                values: ['goto-functions-too'], 
                expected: `--goto-functions-too`
            },
            {
                settings: ["frontEnd.printingOptions"],
                values: ['program-only'], 
                expected: `--program-only`
            },
            {
                settings: ["frontEnd.printingOptions"],
                values: ['program-too'], 
                expected: `--program-too`
            },
            {
                settings: ["frontEnd.printingOptions"],
                values: ['ssa-symbol-table'], 
                expected: `--ssa-symbol-table`
            },
            {
                settings: ["frontEnd.printingOptions"],
                values: ['ssa-guards'], 
                expected: `--ssa-guards`
            },
            {
                settings: ["frontEnd.printingOptions"],
                values: ['ssa-sliced'], 
                expected: `--ssa-sliced`
            },
            {
                settings: ["frontEnd.printingOptions"],
                values: ['ssa-no-location'], 
                expected: `--ssa-no-location`
            },
            {
                settings: ["frontEnd.printingOptions"],
                values: ['smt-formula-only'], 
                expected: `--smt-formula-only`
            },
            {
                settings: ["frontEnd.printingOptions"],
                values: ['smt-formula-too'], 
                expected: `--smt-formula-too`
            },
            {
                settings: ["frontEnd.printingOptions"],
                values: ['smt-model'], 
                expected: `--smt-model`
            },
            {
                settings: ["frontEnd.resultOnly"],
                values: [true], 
                expected: `--result-only`
            }
                      
        ];

        // Check all settings producing a valid flag
        valid_tests.forEach(({settings, values, expected}) => {
            it(`Checking settings ${JSON.stringify(settings)} with respective valid values ${JSON.stringify(values)}`, async function () {
                await assertCorrectFlagParse(settings, values, expected);
            });
        });
    });

    describe('BMC', () => {
        const valid_tests = [
            {
                settings: ["bmc.mainFunction"], 
                values: [VALID_FUNCTION_NAME], 
                expected: `--function ${VALID_FUNCTION_NAME}`
            },
            {
                settings: ["bmc.claim"], 
                values: [POSITIVE_INTEGER_VALUE], 
                expected: `--claim ${POSITIVE_INTEGER_VALUE}`
            },
            {
                settings: ["bmc.instruction"], 
                values: [POSITIVE_INTEGER_VALUE], 
                expected: `--instruction ${POSITIVE_INTEGER_VALUE}`
            },
            {
                settings: ["bmc.unwind"], 
                values: [POSITIVE_INTEGER_VALUE], 
                expected: `--unwind ${POSITIVE_INTEGER_VALUE}`
            },
            {
                settings: ["bmc.unwindSet"], 
                values: [POSITIVE_INTEGER_VALUE], 
                expected: `--unwindset ${POSITIVE_INTEGER_VALUE}`
            },
            {
                settings: ["bmc.unwindingAssertions"], 
                values: [false], 
                expected: `--no-unwinding-assertions`
            },
            {
                settings: ["bmc.partialUnwinding"], 
                values: [true], 
                expected: `--partial-loops`
            },
            {
                settings: ["bmc.sliceEquations"], 
                values: [false], 
                expected: `--no-slice`
            },
            {
                settings: ["bmc.initializeNondetVariables"], 
                values: [true], 
                expected: `--initialize-nondet-variables`
            },
            {
                settings: ["bmc.gotoUnwinding"], 
                values: [true], 
                expected: `--goto-unwind`
            },
            {
                settings: ["bmc.sliceAssumes"], 
                values: [true], 
                expected: `--slice-assumes`
            },
            {
                settings: ["bmc.incrementalBmc"], 
                values: [true], 
                expected: `--incremental-bmc`
            },
            {
                settings: ["bmc.falsification"], 
                values: [true], 
                expected: `--falsification`
            },
            {
                settings: ["bmc.termination"], 
                values: [true], 
                expected: `--termination`
            }
                
        ];

        // Check all settings producing a valid flag
        valid_tests.forEach(({settings, values, expected}) => {
            it(`Checking settings ${JSON.stringify(settings)} with respective valid values ${JSON.stringify(values)}`, async function () {
                await assertCorrectFlagParse(settings, values, expected);
            });
        });

        const invalid_tests = [
            {
                settings: ["bmc.claim"],
                 values: [NON_INTEGER_VALUE]
            },
            {
                settings: ["bmc.claim"],
                 values: [NEGATIVE_INTEGER_VALUE]
            },
            {
                settings: ["bmc.instruction"],
                 values: [NON_INTEGER_VALUE]
            },
            {
                settings: ["bmc.instruction"],
                 values: [NEGATIVE_INTEGER_VALUE]
            },
            {
                settings: ["bmc.unwind"],
                 values: [NON_INTEGER_VALUE]
            },
            {
                settings: ["bmc.unwind"],
                 values: [NEGATIVE_INTEGER_VALUE]
            },
            {
                settings: ["bmc.unwindSet"],
                 values: [NON_INTEGER_VALUE]
            },
            {
                settings: ["bmc.unwindSet"],
                 values: [NEGATIVE_INTEGER_VALUE]
            }
        ];


        invalid_tests.forEach(({settings, values}) => {
            it(`Checking settings ${JSON.stringify(settings)} with respective invalid values ${JSON.stringify(values)} throws exception`, async function () {
                await assertIncorrectFlagParseThrows(settings, values);
            });
        });
    });

    describe('Solver', () => {
        const valid_tests = [
            {
                settings: ["solver.smtSolver"], 
                values: ["z3"], 
                expected: `--z3`
            },
            {
                settings: ["solver.smtSolver"], 
                values: ["mathsat"], 
                expected: `--mathsat`
            },
            {
                settings: ["solver.smtSolver"], 
                values: ["cvc"], 
                expected: `--cvc`
            },
            {
                settings: ["solver.smtSolver"], 
                values: ["yices"], 
                expected: `--yices`
            },
            {
                settings: ["solver.smtSolver"], 
                values: ["bitwuzla"], 
                expected: `--bitwuzla`
            },
            {
                settings: ["solver.smtSolver", "solver.customSmtSolverPath"], 
                values: ["custom", VALID_PATH], 
                expected: `--smtlib-solver-prog ${VALID_PATH}`
            },
            {
                settings: ["solver.smtLibFormat"], 
                values: [true], 
                expected: `--smtlib`
            },
            {
                settings: ["solver.vccOutput"], 
                values: [VALID_PATH], 
                expected: `--output ${VALID_PATH}`
            },
            {
                settings: ["solver.arithmetic"], 
                values: ["bv"], 
                expected: `--bv`
            },
            {
                settings: ["solver.arithmetic"], 
                values: ["ir"], 
                expected: `--ir`
            },
            {
                settings: ["solver.floatingPointEncoding"], 
                values: ["floatbv"], 
                expected: `--floatbv`
            },
            {
                settings: ["solver.floatingPointEncoding"], 
                values: ["fixedbv"], 
                expected: `--fixedbv`
            },
            {
                settings: ["solver.floatingPointEncoding"], 
                values: ["fp2bv"], 
                expected: `--fp2bv`
            },
            {
                settings: ["solver.tupleEncoding"], 
                values: ["node-flattener"], 
                expected: `--tuple-node-flattener`
            },
            {
                settings: ["solver.tupleEncoding"], 
                values: ["sym-flattener"], 
                expected: `--tuple-sym-flattener`
            },
            {
                settings: ["solver.arrayEncoding"], 
                values: ["flattener"], 
                expected: `--array-flattener`
            },
            {
                settings: ["solver.returnValueOptimisation"], 
                values: [false], 
                expected: `--no-return-value-opt`
            },
            {
                settings: ["solver.incrementalSmt"], 
                values: [true], 
                expected: `--smt-during-symex`
            },
            {
                settings: ["solver.checkThreadGuard"], 
                values: [true], 
                expected: `--smt-thread-guard`
            },
            {
                settings: ["solver.checkSymexGuard"], 
                values: [true], 
                expected: `--smt-symex-guard`
            },
            {
                settings: ["solver.checkSymexAsserts"], 
                values: [true], 
                expected: `--smt-symex-assert`
            }
                
        ];

        // Check all settings producing a valid flag
        valid_tests.forEach(({settings, values, expected}) => {
            it(`Checking settings ${JSON.stringify(settings)} with respective valid values ${JSON.stringify(values)}`, async function () {
                await assertCorrectFlagParse(settings, values, expected);
            });
        });
    });
});