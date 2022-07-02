import { workspace } from "vscode";
import { sha1 } from "object-hash";

import { parseConcurrencyChecking, parseTrace, parseKInduction } from './sectionParsers';


export class ConfigurationParser {

    private _root: string = 'esbmc';
    private _section_parsers = {
        'bmc': undefined, 
        'concurrencyChecking': parseConcurrencyChecking, 
        'frontEnd': undefined, 
        'kinduction': parseKInduction, 
        'propertyChecking': undefined, 
        'solver': undefined, 
        'trace': parseTrace
    };
    private cached_hash: string;
    private cached_flags: string;
    public constructor() {
        this.cached_hash = "";
        this.cached_flags = "";
    }

    public parse() {
        let workspace_config = workspace.getConfiguration(this._root);
        const hash = sha1(workspace_config);
        console.log(this.cached_flags);
        // Check to see if incoming object hasn't changed and avoid redundant parsing
        if (hash === this.cached_hash) {
            return this.cached_flags;
        }
        this.cached_hash = hash;
        var flags: string[] = [];
        // Parse each section
        for (let [section, parser] of Object.entries(this._section_parsers)) {
            let section_config = workspace_config.inspect<{[key: string]: Object}>(section);
            // TODO: This is a bit hacky, need a better way really
            let section_changed_values = section_config?.['globalValue'];
            // If sections configurations are all default we will have 
            // undefined section values and should skip
            if (section_changed_values === undefined) {
                continue; 
            }
            if(parser !== undefined) {
                flags.push(...parser(section_changed_values));
            } 
        }
        this.cached_flags = flags.join(" ");
        return this.cached_flags;
    }
} 