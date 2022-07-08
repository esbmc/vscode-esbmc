import { flatten } from 'flatten-anything'

import { Config } from "../@types/vscode.configuration";

export function parseFrontEnd(values: Config): string[] {
    const propertyCheckingConfig : Config = flatten(values)
    var flags: string[] = [];
    for (let [key, value] of Object.entries(propertyCheckingConfig)) {
        // Map each changed configuration and check value before adding flags
        switch(key) { 
            case "includePath": {
                // If includeAfter isn't in values dont wish to add
                // system include path so use default --include 
                if(!('includeAfter' in values))
                    flags.push(`--include ${value}`);
                break;
            }
            case "includeAfter": {
                // If includeAfter is in values and it is true
                // we want to add system include path after
                if('includePath' in values && value)
                    flags.push(`--idirafter ${values["includePath"]}`);
                break;
            }
            case "defineMacros": {
                flags.push(`--define ${value}`);
                break;
            }
            case "ProgramLoopClaimVcs": {
                if(value !== `none`) {
                    flags.push(`--${value}`);
                } 
                break;
            }
            case "claimRemoval": {
                if(value)
                    flags.push(`--all-claims`)
                break;
            }
            case "wordLength": {
                flags.push(`--${value}`);
                break;
            }
            case "architecture": {
                flags.push(`--${value}`);
                break;
            }
            case "endianness": {
                if(value !== `auto`)
                    flags.push(`--${value}`);
                break;
            }
            case "printingOptions": {
                if(value !== `verify`)
                    flags.push(`--${value}`);
                break;
            }
            case "resultOnly": {
                if(value)
                    flags.push(`--result-only`);
                break;
            }
            default: { 
               break; 
            } 
         }
    }
    return flags;
}

export function parseConcurrencyChecking(config: Config): string[] {
    var flags: string[] = [];
    const flatConfig : Config = flatten(config);
    for (let [key, value] of Object.entries(flatConfig)) {
        // Map each changed configuration and check value before adding flags
        switch(key) { 
            case `checkAllInterleavings`: {
                if(value)
                    flags.push(`--all-runs`);
                break; 
            } 
            case `gotoMerging`: { 
                if(!value)
                    flags.push(`--no-goto-merge`) 
                break; 
            } 
            case `partialOrderReduction`: { 
                if(!value)
                    flags.push(`--no-por`) 
                break; 
            }
            case `stateHashing`: { 
                if(value)
                    flags.push(`--state-hashing`) 
                break; 
            }
            case `contextBound`: { 
                flags.push(`--context-bound ${value}`) 
                break; 
            }
            default: { 
               break; 
            } 
         }
    }
    return flags;
}

export function parseTrace(config: Config): string[] {
    var flags: string[] = [];
    const flatConfig : Config = flatten(config);
    for (let [key, value] of Object.entries(flatConfig)) {
        // Map each changed configuration and check value before adding flags
        switch(key) { 
            case `options.quiet`: {
                if(value)
                    flags.push(`--quiet`);
                break; 
            } 
            case `options.compact`: { 
                if(value)
                    flags.push(`--compact-trace`) 
                break; 
            } 
            case `options.ssa`: { 
                if(value)
                    flags.push(`--ssa-trace`) 
                break; 
            }
            case `options.symex`: { 
                if(value)
                    flags.push(`--symex-trace`) 
                break; 
            }
            case `options.symex-ssa`: { 
                if(value)
                    flags.push(`--symex-ssa-trace`) 
                break; 
            }
            case `options.goto-value-set`: {
                if(value)
                    flags.push(`--show-goto-value-sets`) 
                break; 
            }
            case `options.show-symex-value-set`: { 
                if(value)
                    flags.push(`--show-symex-value-set`) 
                break; 
            }
            default: { 
               break; 
            } 
         }
    }
    return flags;
}

export function parseKInduction(values: Config): string[] {
    var flags: string[] = [];
    for (let [key, value] of Object.entries(values)) {
        // Map each changed configuration and check value before adding flags
        switch(key) { 
            case `checkBaseCase`: {
                if(value)
                    flags.push(`--base-case`);
                break; 
            } 
            case `checkForwardCondition`: { 
                if(value)
                    flags.push(`--forward-condition`) 
                break; 
            } 
            case `checkInductiveStep`: { 
                if(value)
                    flags.push(`--inductive-step`) 
                break; 
            }
            case `prove`: {
                // parallelise value cannot be set if we want to just want to 
                // perform non-parallel k-induction
                if(value && !('parallelise' in values) && values['prove'])
                    flags.push(`--k-induction`) 
                break; 
            }
            case `parallelise`: {
                if(value && 'prove' in values && values['prove'])
                    flags.push(`--k-induction-parallel`) 
                break; 
            }
            case `kIncrement`: {
                if(value > 0) {
                    flags.push(`--k-step ${value}`)
                } 
                if (value == -1) {
                    flags.push(`--unlimited-k-steps`) 
                }
                break; 
            }
            case `iterationMax`: { 
                flags.push(`--max-k-step ${value}`) 
                break;
            }
            case `bidirectional`: { 
                if(value)
                    flags.push(`--show-symex-value-set`) 
                break; 
            }
            default: { 
               break; 
            } 
         }
    }
    return flags;
}

export function parsePropertyChecking(values: Config): string[] {
    const propertyCheckingConfig : Config = flatten(values)
    var flags: string[] = [];
    for (let [key, value] of Object.entries(propertyCheckingConfig)) {
        // Map each changed configuration and check value before adding flags
        console.log(value)
        switch(key) { 
            case "properties.assertions": {
                if(!value)
                    flags.push(`--no-assertions`);
                break;
            }
            case "properties.arrayBounds": {
                if(!value)
                    flags.push(`--no-bounds-check`);
                break;
            }
            case "properties.divisionByZero": {
                if(!value)
                    flags.push(`--no-div-by-zero-check`);
                break;
            }
            case "properties.pointer": {
                if(!value)
                    flags.push(`--no-pointer-check`);
                break;
            }
            case "properties.pointerAlignment": {
                if(!value)
                    flags.push(`--no-align-check`);
                break;
            }
            case "properties.pointerRelations": {
                if(value)
                    flags.push(`--no-pointer-relation-check`);
                break;
            }
            case "properties.nan": {
                if(value)
                    flags.push(`--nan-check `);
                break;
            }
            case "properties.memoryLeak": {
                if(value)
                    flags.push(`--memory-leak-check`);
                break;
            }
            case "properties.overflowAndUnderflow": {
                if(value)
                    flags.push(`--overflow-check`);
                break;
            }
            case "properties.structFields": {
                if(value)
                    flags.push(`--struct-fields-check`);
                break;
            }
            case "properties.deadlock": {
                if(value)
                    flags.push(`--deadlock-check`);
                break;
            }
            case "properties.dataRace": {
                if(value)
                    flags.push(`--data-races-check`);
                break;
            }
            case "properties.lockOrder": {
                if(value)
                    flags.push(`--lock-order-check`);
                break;
            }
            case "properties.atomicity": {
                if(value)
                    flags.push(`--atomicity-check`);
                break;
            }
            case "properties.forceMallocSuccess": {
                if(value)
                    flags.push(`--force-malloc-success`);
                break;
            }
            case "checkStackLimit": {
                if(value > 0)
                    flags.push(`--stack-limit ${value}`);
                break;
            }
            case "checkErrorLabel": {
                flags.push(`--error-label ${value}`);
                break;
            }
            default: { 
               break; 
            } 
         }
    }
    return flags;
}



