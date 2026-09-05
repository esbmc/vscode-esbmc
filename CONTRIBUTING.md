# Contributing

Issues and pull requests are welcome at
[github.com/esbmc/vscode-esbmc](https://github.com/esbmc/vscode-esbmc).

## Building from source

You need Node.js 22 (the version CI uses) and npm.

```bash
git clone https://github.com/esbmc/vscode-esbmc.git
cd vscode-esbmc
npm ci
npm run compile
```

Press <kbd>F5</kbd> in VS Code to launch an Extension Development Host with the
extension loaded.

## Tests

```bash
npm test
```

This downloads a VS Code build and runs the suite inside it, so it needs a
display; on a headless Linux machine use `xvfb-run -a npm test`.

The manifest checks need neither VS Code nor a display, so they can be run on
their own while iterating:

```bash
npm run compile && npm run test:package
```

Much of the rest of the suite also avoids importing `vscode` — deliberately,
so it stays runnable outside the harness. `npm run test:headless` runs all of
it, everything but the three files that do need the editor:

```bash
npm run compile && npm run test:headless
```

Tests that shell out to ESBMC skip themselves when it is not installed, so a
machine without it still gets a green run, just a smaller one.

`npm run pretest` compiles and lints, and is what CI gates on.

## Packaging

```bash
npx @vscode/vsce package
```

`.vscodeignore` keeps sources and tests out of the VSIX. `examples/` and
`walkthroughs/` must stay in it — the Welcome walkthrough reads them from the
installed extension directory, and a CI check asserts they are still there.

## Releasing

Publishing is automated. Tag a commit whose `package.json` version matches the
tag and push it:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

The `Publish` workflow runs the tests on macOS, Linux and Windows, packages the
extension, publishes it to the VS Code Marketplace and Open VSX, and attaches
the VSIX to the GitHub release. It refuses to publish if the tag and the
`package.json` version disagree.

It needs a registered `esbmc` publisher on both registries, an `OVSX_PAT`
repository secret for Open VSX, and two for the Marketplace —
`AZURE_CLIENT_ID` and `AZURE_TENANT_ID` — belonging to an app registration
whose federated credential trusts this repository and whose service principal
is an `esbmc` Marketplace publisher. The
Marketplace side authenticates with Entra ID rather than a personal access
token because Azure DevOps retires global PATs on 2026-12-01.

## Conventions

- ESLint enforces [standard](https://standardjs.com/) style; `npm run lint`
  must pass, and it covers the tests as well as `src/`.
- Settings that map to ESBMC flags live in `package.json` under
  `contributes.configuration`, and `src/parsers/configParser.ts` turns them
  into a command line. A manifest test requires every enum value to carry a
  `markdownEnumDescriptions` entry.
- Keep anything that does not need the VS Code API free of `vscode` imports.
  That boundary is what lets most of the suite run without the Electron
  harness, and it is easy to lose by accident.
