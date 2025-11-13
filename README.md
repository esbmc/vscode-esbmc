# ESBMC for Visual Studio Code

This Visual Studio Code extension integrates the **ESBMC model checker** into the editor, allowing users to install, update, and execute ESBMC seamlessly within VS Code.

ESBMC (Efficient SMT-Based Model Checker) is a state-of-the-art bounded model checker for C, C++, Python, and Solidity programs.

---

## Features

- **Automatic installation** of the latest ESBMC release  
- **Version detection** using local or system-installed binaries  
- **Fallback support** for `$HOME/bin/esbmc` and PATH resolution  
- Basic ESBMC **execution** and **output visualization** inside VS Code  
- Linux-native support for development and verification workflows  

---

## Installation

The extension can install ESBMC automatically on Linux systems.  
You only need:

- Internet connection  
- `unzip` installed on your system  
  ```bash
  sudo apt install unzip
