// Ak commands (run, check, test in a terminal) and error squiggles from `ak check`.
const vscode = require('vscode');
const path = require('path');
const cp = require('child_process');
const { parseCheckOutput, errorSpan, MIN_AK, parseVersion, atLeast } = require('./check');

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

const akPath = () => vscode.workspace.getConfiguration('aklang').get('path') || 'ak';

// Run `ak check -` on the text of the buffer (so unsaved edits are checked), from the file's folder so `(use "x.aklang")` resolves.
function runCheck(ak, text, cwd) {
  return new Promise(resolve => {
    const child = cp.spawn(ak, ['check', '-'], { cwd, timeout: 10000 });
    let out = '';
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => out += d);
    child.on('error', err => resolve({ missing: err.code === 'ENOENT', out }));
    child.on('close', () => resolve({ out }));
    child.stdin.on('error', () => {});
    child.stdin.end(text);
  });
}

// `ak --version`, once per executable: the squiggles need `ak check -`, which is in Ak 0.6.0 and newer.
// The answer is kept for 30 seconds, so updating Ak is noticed without reloading the window.
const versions = new Map();
function akVersion(ak) {
  const hit = versions.get(ak);
  if (hit && Date.now() - hit.at < 30000) return hit.promise;
  const promise = new Promise(resolve => {
    cp.execFile(ak, ['--version'], { timeout: 10000 }, (err, stdout) => resolve(err ? { missing: err.code === 'ENOENT' } : { version: parseVersion(stdout) }));
  });
  versions.set(ak, { at: Date.now(), promise });
  return promise;
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
    let term = vscode.window.terminals.find(t => t.name === 'Ak');
    if (!term) term = vscode.window.createTerminal({ name: 'Ak' });
    term.show(true);
    term.sendText(commandLine(akPath(), sub, editor.document.fileName));
  };
  for (const sub of ['run', 'check', 'test'])
    context.subscriptions.push(vscode.commands.registerCommand('aklang.' + sub, () => send(sub)));

  // ---- error squiggles
  const diagnostics = vscode.languages.createDiagnosticCollection('aklang');
  context.subscriptions.push(diagnostics);
  const timers = new Map();     // uri string -> debounce timer
  let warnedMissing = false, warnedOld = false;

  const check = async doc => {
    if (doc.languageId !== 'aklang' || doc.uri.scheme !== 'file') return;
    const version = doc.version;
    const ak = akPath();
    const info = await akVersion(ak);
    if (info.version && !atLeast(info.version, MIN_AK)) {
      diagnostics.delete(doc.uri);
      if (!warnedOld) {
        warnedOld = true;
        vscode.window.showWarningMessage('Ak: error squiggles need Ak ' + MIN_AK.join('.') + ' or newer, this is ' + info.version.join('.') + '. Update Ak, or set aklang.diagnostics to off.');
      }
      return;
    }
    const { missing, out } = info.missing ? { missing: true } : await runCheck(ak, doc.getText(), path.dirname(doc.fileName));
    if (doc.version !== version) return;                       // edited meanwhile: a newer check is on its way
    if (missing) {
      diagnostics.delete(doc.uri);
      if (!warnedMissing) {
        warnedMissing = true;
        vscode.window.showWarningMessage('Ak: cannot run "' + akPath() + '". Set aklang.path to the full path of the ak executable, or set aklang.diagnostics to off.');
      }
      return;
    }
    const err = parseCheckOutput(out);
    if (!err) { diagnostics.set(doc.uri, []); return; }
    let range, message = err.message;
    const here = err.line !== undefined && (err.file === '<stdin>' || path.basename(err.file) === path.basename(doc.fileName));
    if (here && err.line - 1 < doc.lineCount) {
      const line = doc.lineAt(err.line - 1).text;
      const [a, b] = errorSpan(line, err.col);
      range = new vscode.Range(err.line - 1, a, err.line - 1, b);
    } else {                                                   // no position, or the error is in an included file
      if (err.file) message = err.file + ':' + err.line + ':' + err.col + ': ' + message;
      range = doc.lineAt(0).range;
    }
    const d = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
    d.source = 'ak check';
    diagnostics.set(doc.uri, [d]);
  };

  const mode = () => vscode.workspace.getConfiguration('aklang').get('diagnostics') || 'onType';
  const schedule = (doc, delay) => {
    const key = doc.uri.toString();
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => { timers.delete(key); check(doc); }, delay));
  };
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => { if (mode() !== 'off') schedule(doc, 0); }),
    vscode.workspace.onDidChangeTextDocument(e => { if (mode() === 'onType') schedule(e.document, 400); }),
    vscode.workspace.onDidSaveTextDocument(doc => { if (mode() !== 'off') schedule(doc, 0); }),
    vscode.workspace.onDidCloseTextDocument(doc => {
      clearTimeout(timers.get(doc.uri.toString()));
      diagnostics.delete(doc.uri);
    }),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('aklang')) return;
      if (mode() === 'off') diagnostics.clear();
      else for (const doc of vscode.workspace.textDocuments) schedule(doc, 0);
    }),
  );
  if (mode() !== 'off') for (const doc of vscode.workspace.textDocuments) schedule(doc, 0);
  return { check };        // for the tests
}

function deactivate() {}

module.exports = { activate, deactivate, quote, commandLine };
