export function parseConcurrencyChecking(values: {[key: string]: any}): string[] {
    var flags: string[] = [];
    for (let [key, value] of Object.entries(values)) {
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

export function parseTrace(values: {[key: string]: Object}): string[] {
    var flags: string[] = [];
    // Currently options only has 1 setting: options, but it is an object so we will just directly 
    // unwrap it then parse it similarly.
    var options_values = values['options'];
    for (let [key, value] of Object.entries(options_values)) {
        // Map each changed configuration and check value before adding flags
        switch(key) { 
            case `quiet`: {
                if(value)
                    flags.push(`--quiet`);
                break; 
            } 
            case `compact`: { 
                if(value)
                    flags.push(`--compact-trace`) 
                break; 
            } 
            case `ssa`: { 
                if(value)
                    flags.push(`--ssa-trace`) 
                break; 
            }
            case `symex`: { 
                if(value)
                    flags.push(`--symex-trace`) 
                break; 
            }
            case `symex-ssa`: { 
                if(value)
                    flags.push(`--symex-ssa-trace`) 
                break; 
            }
            case `goto-value-set`: {
                if(value)
                    flags.push(`--show-goto-value-sets`) 
                break; 
            }
            case `show-symex-value-set`: { 
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

export function parseKInduction(values: {[key: string]: Object}): string[] {
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
                if(value)
                    flags.push(`--k-induction`) 
                break; 
            }
            case `parallelise`: { 
                // TODO: Figure out a good way for mutual exclusion
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