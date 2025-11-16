# ESBMC for Visual Studio Code

This README explains how to go from the extension source code to a working ESBMC integration inside Visual Studio Code on **Linux**, incorporating the lessons learned from the test log in `Teste_ESBMC.txt`.

---

## 1. Overview

The ESBMC VS Code extension allows you to:

- Run ESBMC on the **current C/C++ file** directly from the editor.
- Install (download + unpack) the **latest ESBMC** binary on Linux using a dedicated command.
- See ESBMC results in the integrated VS Code terminal.

This document assumes you are using a Debian/Ubuntu-based distribution and the **bash** shell.

---

## 2. Requirements

Before building and using the extension, make sure you have:

- **Linux** (tested on Ubuntu-based systems).
- **Visual Studio Code** installed.
- **curl** and **git** (for downloads and version control).
- **unzip** installed on your system (required for automatic ESBMC installation).
- **Node.js (LTS)** and **npm**, installed via **nvm (Node Version Manager)**.
- **vsce** (VS Code Extension Manager) to package the extension as a `.vsix`.

---

## 3. Step 1 – Prepare the development environment

### 3.1 Install essential tools

Open a terminal and run:

```bash
sudo apt update
sudo apt install curl git unzip -y
```

### 3.2 Install Node.js LTS using nvm
#### 3.2.1. **Install `nvm`:**

   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
   ```

#### 3.2.2. **Load `nvm` into the current shell:**
  
   ```bash
   source ~/.bashrc
   ```

#### 3.2.3. **Install Node.js LTS:**

   ```bash
   nvm install --lts
   ```

#### 3.2.4. **Verify `node` and `npm`:**

   ```bash
   node -v
   npm -v
   ```

You should see version numbers for Node.js and npm without errors.

---

## 4. Step 2 – Obtain the extension source code

Download or clone the ESBMC VS Code extension repository and move into the project folder. For example:

```bash
git clone https://github.com/esbmc/vscode-esbmc.git
cd vscode-esbmc
```

The exact directory name may vary; just ensure you are in the folder that contains `package.json`.

---

## 5. Step 3 – Install project dependencies

Install the required npm packages with:

```bash
npm install
```

Notes based on the test:

- This step **worked correctly**.
- npm may show warnings or a message similar to:

  ```text
  11 vulnerabilities (1 low, 5 moderate, 4 high, 1 critical)
  ```

  In this case, you may optionally run:

  ```bash
  npm audit
  npm audit fix
  ```

  The extension can still be built and used even if some vulnerabilities remain.

---

## 6. Step 4 – Compile the TypeScript code

Compile the extension (TypeScript → JavaScript) with:

```bash
npm run compile
```

### 6.1 Handling “Permission denied” for `tsc`

If you see a `Permission denied` error when running `npm run compile`, fix the permissions for the TypeScript compiler and re-run the command:

```bash
chmod +x ./node_modules/.bin/tsc
npm run compile
```

After a successful compilation, a directory named `out` will be created in the project folder.

---

## 7. Step 5 – Package the extension as a `.vsix`

### 7.1 Install `vsce` globally

Use npm to install `vsce`:

```bash
npm install -g @vscode/vsce
```

### 7.2 Create the `.vsix` package

From the root of the project (where `package.json` is located), run:

```bash
vsce package
```

Typical behavior:

- `vsce` may ask or warn about:
  - `README.md` contents,
  - missing `LICENSE`,
  - missing `repository` field.
- You can confirm the prompts with `y` to continue.

At the end, you should see a file such as:

```text
vscode-esbmc-0.0.1.vsix
```

(or another versioned name) generated in the current directory.

---

## 8. Step 6 – Install the `.vsix` in Visual Studio Code

1. Open **Visual Studio Code**.
2. Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> to open the **Command Palette**.
3. Run **“Extensions: Install from VSIX…”**.
4. Navigate to the `.vsix` file you created (e.g. `vscode-esbmc-0.0.1.vsix`) and select it.
5. After installation, click **“Reload”** (or similar) when prompted, to restart VS Code and activate the extension.

After reloading, the ESBMC extension will be available for all your projects.

---

## 9. Step 7 – Install ESBMC via the extension

With the extension installed and active:

1. Open the **Command Palette** (<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>).
2. Look for and run:

   ```text
   ESBMC: Install the latest version
   ```

The extension will automatically download and install the latest ESBMC binary suitable for your Linux environment.

---

## 10. Step 8 – Using the extension

### 10.1 Verify a C/C++ file

According to `Teste_ESBMC.txt`, this workflow was successfully tested:

1. Open a C or C++ source file in VS Code.
2. Open the **Command Palette** (<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>).
3. Run:

   ```text
   ESBMC: Verify file
   ```

VS Code opens a terminal showing:

- the ESBMC command line,
- verification progress,
- and the final result.

## 12. Summary

By following the steps in this README, you can:

1. Prepare your Linux environment (curl, git, nvm, Node.js, npm).
2. Install dependencies and compile the ESBMC VS Code extension (`npm install`, `npm run compile`).
3. Package the extension as a `.vsix` file with `vsce package`.
4. Install the `.vsix` into Visual Studio Code.
5. Use the extension to install ESBMC and verify C/C++ programs, either at the file level or per function.



