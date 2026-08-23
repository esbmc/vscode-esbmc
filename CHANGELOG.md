# Change Log

All notable changes to the "vscode-esbmc" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added

- An MCP server exposing a `verify` tool, so agents in Claude Code, Cursor,
  Copilot agent mode and Cline can run ESBMC and read the counterexample
  without going through the editor. Verification itself moved into a module
  free of any VS Code import, which the editor commands and the server share.

- Violated properties are reported as diagnostics: squiggles on the failing
  line and entries in the Problems panel, read from ESBMC SARIF output rather
  than scraped from the log.
- `esbmc.editor.verifyOnSave` verifies a file each time it is saved, and
  `esbmc.editor.timeout` kills a run that takes too long.
- The verdict is shown in the status bar; clicking it opens the output.
- An **ESBMC Counterexample** view lists the steps that reach a violation, each
  navigating to its line and showing the variable values at that point, read
  from ESBMC's GraphML witness.
- `ESBMC: Show current flags` reports the command line the current settings
  produce, and offers to copy it.
- A tag-triggered workflow that runs the test matrix, packages the extension
  and publishes it to the VS Code Marketplace and Open VSX, then attaches the
  VSIX to the release. Needs `VSCE_PAT` and `OVSX_PAT` repository secrets.
- Pull requests now package the extension as well as testing it, and check
  that the walkthrough assets are still included.

### Changed

- Pushing to a pull request now supersedes its previous CI run instead of
  queueing beside it. Publishing deliberately does not: a second tag must not
  cancel a release that may already have reached one registry and not the other.

- Dropped `glob` from the test runner, which walks its own directory in a
  dozen lines. Its callback API was removed in v9 and each major since raises
  the Node floor. A test now guards the walk, because a discovery bug makes the
  whole suite pass while running nothing.
- Bumped mocha, `@types/node` and `@types/object-hash`, pinning `diff` to a
  version without an advisory so `npm audit` stays at zero.

- `node-fetch` and `flatten-anything` are gone. Both became ESM-only in their
  next major and cannot be `require`d from this extension, which compiles to
  CommonJS, so Dependabot could only ever offer updates that break the build.
  Two HTTP calls now go through Node's own `http`/`https`, and the settings
  flattener is fifteen lines pinned by tests recorded from the old dependency.

- The README is now a description of what the extension does rather than a
  build-from-source walkthrough, with the build, test and release instructions
  moved to `CONTRIBUTING.md`. It no longer walks the reader through a test log
  that was never in the repository.

- The installer downloads the asset for the running platform and unpacks it
  into the extension's storage directory instead of hard-coding the Linux
  archive and writing to `$HOME/bin`. Windows uses PowerShell to unpack, since
  it has no `unzip`, and the whole `bin/` directory is kept because
  `esbmc.exe` needs the `libz3.dll` shipped beside it.
- One resolver now decides which ESBMC runs, so the reported version and the
  verified binary can no longer disagree. A user's own ESBMC on `PATH` wins
  over one the extension installed.
- Verification output goes to an `ESBMC` output channel instead of a terminal.
- Python and Solidity files now activate the extension and get the function
  CodeLens. The CodeLens named them `py` and `sol`, which are file extensions
  rather than VS Code language identifiers, so it never appeared for them.
- Marketplace metadata: `repository`, `bugs`, `homepage`, `keywords`, and
  categories widened from `Other` to Testing, Linters and Programming
  Languages. The publisher is now `esbmc` rather than a personal account.
- A `.vscodeignore` keeps sources, tests and repository plumbing out of the
  VSIX, which drops it from 492 to 406 files.

### Fixed

- Choosing a value that happened to equal the manifest default was silently
  dropped instead of sent to ESBMC, whose own defaults differ: `boolector`
  became bitwuzla, and `i386-linux` became the host architecture on macOS and
  Windows. Explicit choices are now always passed.

- Choosing a solver had no effect if a custom solver path was also set: the
  guard meant to restrict that path to `custom` was written `x || true`, so it
  was always true and the chosen solver flag was dropped. Selecting `custom`
  also emitted only `--smtlib-solver-prog`, which names the binary without
  selecting it, so ESBMC quietly used its own default; and selecting `custom`
  with no path emitted `--custom`, which is not an ESBMC flag.

- Settings set in a workspace or folder `settings.json` were silently ignored:
  the flag parser read only the user scope, so a per-project unwind bound or
  solver choice did nothing. All three scopes are now read, narrowest winning.
- The `esbmc.frontEnd.includeAfter` description linked `#esbmc.includePath#`,
  which is not a setting id, so it rendered as raw text instead of a link.

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
