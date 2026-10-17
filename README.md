# Aklang VS Code extension


Syntax highlighting for [Ak](https://github.com/notyourbusinessss/AI-codinglanguage-) (`.aklang`, and the old `.ak`): comments, strings, numbers, `:symbols`, `true false nil`, the special forms (`? wh for let sw try use ..`), function definitions and the builtins.

## Commands
With an `.aklang` file open (it is saved first, since Ak runs files from disk):

| command | what it does |
|---|---|
| **Ak: Run File** (play button in the editor title, `Ctrl+F5`) | `ak file.aklang` in an "Ak" terminal |
| **Ak: Check File** | `ak check file.aklang` (parse and resolve only) |
| **Ak: Test File** | `ak test file.aklang` (a `*.test.aklang` file passes when it exits 0) |

If `ak` is not on your PATH, set `aklang.path` to the full path, for example `/home/max/.local/bin/ak`.

Tests: `node test/extension.test.js` (no VS Code needed).

## Install
In a folder with this extension:
```
npm install -g @vscode/vsce        # once
vsce package                       # writes aklang-0.2.0.vsix
code --install-extension aklang-0.2.0.vsix
```
From WSL, run `code --install-extension` in the WSL terminal so it installs into the WSL side. Or copy this folder to `~/.vscode-server/extensions/aklang-0.2.0` and reload the window.
