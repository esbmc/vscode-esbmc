# Change Log

All notable changes to the "vscode-esbmc" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added

- Violated properties are reported as diagnostics: squiggles on the failing
  line and entries in the Problems panel, read from ESBMC SARIF output rather
  than scraped from the log.
- `esbmc.editor.verifyOnSave` verifies a file each time it is saved, and
  `esbmc.editor.timeout` kills a run that takes too long.
- The verdict is shown in the status bar; clicking it opens the output.

### Changed

- Verification output goes to an `ESBMC` output channel instead of a terminal.
- Python and Solidity files now activate the extension and get the function
  CodeLens. The CodeLens named them `py` and `sol`, which are file extensions
  rather than VS Code language identifiers, so it never appeared for them.

### Fixed

- File paths are shell-quoted, so a name containing `$(...)` no longer runs as
  a command. This was reachable by saving a file with `verifyOnSave` enabled.

## [0.1.0]

### Added

- Verify the active file with ESBMC, with settings for the front end, BMC, solver, property checking, k-induction and concurrency.
- Install and update ESBMC from the latest GitHub release.
- Explain counterexamples with a local Ollama model.
- Run ESBMC on a single function through a CodeLens.
- Dependabot updates for npm and GitHub Actions.

### Removed

- `parseEsbmcOutput`, which was never called and whose claim format no longer
  matched ESBMC's output. Issues #17 and #18 will replace it with a parser
  driven by ESBMC's machine-readable output.

### Security

- Resolved all 13 npm advisories. `serialize-javascript` is pinned to `^7.1.0`
  through an `overrides` entry because every mocha release depends on `^6.0.2`
  and `npm audit fix` proposes a mocha downgrade rather than a fix. Drop the
  pin once mocha's own range moves to `^7`. Dependabot does not maintain
  `overrides`, so this one needs a human.
