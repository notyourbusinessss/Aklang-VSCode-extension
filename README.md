# Aklang VS Code extension


Syntax highlighting for [Ak](https://github.com/notyourbusinessss/AI-codinglanguage-) (`.aklang`, and the old `.ak`): comments, strings, numbers, `:symbols`, `true false nil`, the special forms (`? wh for let sw try use ..`), function definitions and the builtins.

## Install
In a folder with this extension:
```
npm install -g @vscode/vsce        # once
vsce package                       # writes aklang-0.1.0.vsix
code --install-extension aklang-0.1.0.vsix
```
From WSL, run `code --install-extension` in the WSL terminal so it installs into the WSL side. Or copy this folder to `~/.vscode-server/extensions/aklang-0.1.0` and reload the window.
