# Aklang VS Code extension


Syntax highlighting for [Ak](https://github.com/notyourbusinessss/AI-codinglanguage-) (`.aklang`, and the old `.ak`): comments, strings, numbers, `:symbols`, `true false nil`, the special forms (`? wh for let sw try use ..`), function definitions and the builtins.

## Which Ak it works with
Tested with Ak **0.6.0** (the current release) and, for the parts that need only older features, Ak 0.5.0.

| feature | needs Ak |
|---|---|
| syntax highlighting | any |
| Run File, Check File | any (`ak file`, `ak check file`) |
| Test File | 0.6.0 (`ak test` first shipped there) |
| error squiggles | 0.6.0 (they use `ak check -`, which reads the program from stdin) |

On an older Ak the squiggles turn themselves off after one warning, and Ak's own error shows in the terminal for Test File. Check what you have with `ak --version`.

## Commands
With an `.aklang` file open (it is saved first, since Ak runs files from disk):

| command | what it does |
|---|---|
| **Ak: Run File** (play button in the editor title, `Ctrl+F5`) | `ak file.aklang` in an "Ak" terminal |
| **Ak: Check File** | `ak check file.aklang` (parse and resolve only) |
| **Ak: Test File** | `ak test file.aklang` (a `*.test.aklang` file passes when it exits 0) |

If `ak` is not on your PATH, set `aklang.path` to the full path, for example `/home/max/.local/bin/ak`.

## Error squiggles
The extension runs `ak check -` on the text of the open file, so unsaved edits are checked too, and underlines the first error (`ak check` stops at the first one). It runs a moment after you stop typing, on open, and on save. Setting `aklang.diagnostics`: `onType` (default), `onSave` or `off`. An error inside a `(use ..)`d file is shown on the first line of your file with its location in the message.

Tests: `npm test` (no VS Code needed; the checks run against a fake `ak`). To run the squiggle test against a real one: `AK=/path/to/ak node test/diagnostics.test.js`.

## Install
In a folder with this extension:
```
npm install -g @vscode/vsce        # once
vsce package                       # writes aklang-0.3.0.vsix
code --install-extension aklang-0.3.0.vsix
```
From WSL, run `code --install-extension` in the WSL terminal so it installs into the WSL side. Or copy this folder to `~/.vscode-server/extensions/aklang-0.3.0` and reload the window.
