# ESBMC for Visual Studio Code

[![Run tests](https://github.com/esbmc/vscode-esbmc/actions/workflows/on-pr-master.yml/badge.svg)](https://github.com/esbmc/vscode-esbmc/actions/workflows/on-pr-master.yml)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/esbmc.vscode-esbmc)](https://marketplace.visualstudio.com/items?itemName=esbmc.vscode-esbmc)
[![Open VSX](https://img.shields.io/open-vsx/v/esbmc/vscode-esbmc)](https://open-vsx.org/extension/esbmc/vscode-esbmc)

Find bugs in C, C++, Python and Solidity without leaving the editor, using
[ESBMC](http://esbmc.org/) — a bounded model checker that proves properties
rather than sampling inputs. A failure comes with a counterexample; a success
means no execution violates the property, not merely that none was found.

## Install

1. Install this extension from the
   [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=esbmc.vscode-esbmc)
   or [Open VSX](https://open-vsx.org/extension/esbmc/vscode-esbmc).
2. Run **ESBMC: Install latest version** from the Command Palette
   (<kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>).

The extension downloads the release build for your platform and unpacks it into
its own storage directory, so nothing is written to `$HOME/bin` and no `PATH`
change is needed. An ESBMC already on your `PATH` is used in preference.

New to it? **Help → Welcome → Get started with ESBMC** walks through installing
ESBMC, opening a bundled example and reading the counterexample it produces.

## How it works

Verification runs ESBMC over the open file, with flags built from your
settings, and reports the result three ways:

- **Problems panel and squiggles** — each violated property is placed on the
  line that violates it, read from ESBMC's SARIF report rather than scraped
  from its log.
- **Status bar** — the verdict, and how many properties failed. Click it to
  open the full output.
- **ESBMC Counterexample view** — the steps that reach the violation, each
  navigating to its line and showing the variable values ESBMC pinned there.
  It appears in the Explorer once a run produces a trace.
- **ESBMC output channel** — the command line that ran, and everything ESBMC
  printed.

Run **ESBMC: Show current flags** to see the command line your settings produce
before running anything.

## Commands

| Command | What it does |
| --- | --- |
| `ESBMC: Verify file` | Verify the active file |
| `ESBMC: Show current flags` | Show the flags the current settings produce |
| `ESBMC: Show output` | Open the ESBMC output channel |
| `ESBMC: Install latest version` | Download and install ESBMC |
| `ESBMC: Update to latest version` | Update an existing install |
| `ESBMC: Open example program` | Open the bundled example |
| `ESBMC: Verify file with Local AI` | Verify, then explain the counterexample with a local model |

A CodeLens above each function verifies that function on its own.

## Settings

Two settings control the editor integration:

| Setting | Default | Meaning |
| --- | --- | --- |
| `esbmc.editor.verifyOnSave` | `false` | Verify a supported file every time it is saved |
| `esbmc.editor.timeout` | `60` | Kill a run after this many seconds; `0` waits indefinitely |

Everything else maps to an ESBMC flag, grouped under **Front End**, **BMC**,
**Solver**, **Property Checking**, **k-Induction**, **Concurrency Checking**
and **AI Integration** in the Settings UI. Each value documents the flag it
produces. Only settings that differ from their default emit anything, which is
why **ESBMC: Show current flags** exists.

## Remote development

The extension declares `extensionKind: ["workspace"]`, so with **Remote-SSH**,
**WSL** or **Dev Containers** it runs where the code is rather than on the
local UI host. ESBMC is installed and executed on the remote machine — the
supported route if you want a Linux ESBMC from a Windows or macOS desktop.

## Local AI explanations (optional)

**ESBMC: Verify file with Local AI** runs ESBMC and then asks a local model to
explain the counterexample and suggest a fix. It is fully offline, through
[Ollama](https://ollama.ai/), and entirely optional.

1. Install Ollama and start it:

   ```bash
   curl https://ollama.ai/install.sh | sh
   ollama serve
   ```

   `Error: listen tcp 127.0.0.1:11434: bind: address already in use` means it
   is already running; check with `systemctl status ollama`.

2. Pull the default model:

   ```bash
   ollama pull llama3.1:8b
   ```

3. Confirm it answers:

   ```bash
   curl http://localhost:11434/api/tags
   ```

Host and model are configurable under **AI Integration** (`esbmc.ai.host`,
`esbmc.ai.model`).

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `ESBMC: not found` | ESBMC is not installed | Run **ESBMC: Install latest version** |
| Verification reports no verdict | ESBMC failed before checking anything | Open the ESBMC output channel |
| `[ERROR] Could not contact local AI` | Ollama is not running | Run `ollama serve` |
| AI output is very slow | Model too large for the machine | Try a smaller model in `esbmc.ai.model` |

## Contributing

Build instructions, the test suite and the release process are in
[CONTRIBUTING.md](CONTRIBUTING.md). Issues and pull requests are welcome at
[github.com/esbmc/vscode-esbmc](https://github.com/esbmc/vscode-esbmc).

## License

This repository does not yet declare a license. ESBMC itself is distributed
under its own terms; see [esbmc/esbmc](https://github.com/esbmc/esbmc).
