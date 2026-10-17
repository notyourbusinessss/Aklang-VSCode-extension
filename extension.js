// Ak commands: run, check and test the current file in a terminal.
const vscode = require('vscode');

// Quote one argument for a POSIX shell (the terminal is bash or zsh in WSL and on Linux/macOS).
const quote = s => "'" + String(s).replace(/'/g, "'\\''") + "'";

// The shell line for `ak <sub> <path>`: `run` is plain `ak file`, `check` and `test` add the subcommand.
function commandLine(ak, sub, file) {
  const base = quote(ak);
  if (sub === 'run') return `${base} ${quote(file)}`;
  if (sub === 'check') return `${base} check ${quote(file)}`;
  if (sub === 'test') return `${base} test ${quote(file)}`;
  throw new Error('unknown Ak command: ' + sub);
}

function activate(context) {
  const send = async sub => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'aklang') {
      vscode.window.showWarningMessage('Open an Ak (.aklang) file first.');
      return;
    }
    if (editor.document.isUntitled) {
      vscode.window.showWarningMessage('Save the file first, Ak runs files from disk.');
      return;
    }
    if (editor.document.isDirty) await editor.document.save();
    const ak = vscode.workspace.getConfiguration('aklang').get('path') || 'ak';
    let term = vscode.window.terminals.find(t => t.name === 'Ak');
    if (!term) term = vscode.window.createTerminal({ name: 'Ak' });
    term.show(true);
    term.sendText(commandLine(ak, sub, editor.document.fileName));
  };
  for (const sub of ['run', 'check', 'test'])
    context.subscriptions.push(vscode.commands.registerCommand('aklang.' + sub, () => send(sub)));
}

function deactivate() {}

module.exports = { activate, deactivate, quote, commandLine };
