// Run with: node test/extension.test.js   (no VS Code needed: the vscode module is stubbed)
const Module = require('module'), assert = require('assert'), cp = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const sent = [], cmds = {};
const doc = { languageId: 'aklang', isUntitled: false, isDirty: false, fileName: "/tmp/it's a dir/my prog.aklang", save: async () => {} };
const term = { name: 'Ak', show() {}, sendText: s => sent.push(s) };
const stub = {
  commands: { registerCommand: (id, f) => { cmds[id] = f; return { dispose() {} }; } },
  window: { activeTextEditor: { document: doc }, terminals: [term], createTerminal: () => term, showWarningMessage: m => sent.push('WARN ' + m) },
  languages: { createDiagnosticCollection: () => ({ set() {}, delete() {}, clear() {}, dispose() {} }) },
  workspace: {
    textDocuments: [], getConfiguration: () => ({ get: k => k === 'diagnostics' ? 'off' : 'ak' }),
    onDidOpenTextDocument: () => ({}), onDidChangeTextDocument: () => ({}), onDidSaveTextDocument: () => ({}), onDidCloseTextDocument: () => ({}), onDidChangeConfiguration: () => ({}),
  },
};
const load = Module._load;
Module._load = (r, ...a) => r === 'vscode' ? stub : load(r, ...a);
const ext = require('../extension.js');
Module._load = load;

// quoting: run the produced line through a real shell
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ak it's-"));
const f = path.join(dir, 'my prog.aklang');
for (const [sub, want] of [['run', ''], ['check', 'check'], ['test', 'test']]) {
  const line = ext.commandLine('echo', sub, f);
  const out = cp.execSync(line, { shell: '/bin/bash' }).toString().trim();
  assert.strictEqual(out, (want ? want + ' ' : '') + f, sub);
}
assert.throws(() => ext.commandLine('ak', 'nope', f));

// the three commands are registered and send one line to the "Ak" terminal
const ctx = { subscriptions: [] };
ext.activate(ctx);
assert.deepStrictEqual(Object.keys(cmds).sort(), ['aklang.check', 'aklang.run', 'aklang.test']);
(async () => {
  await cmds['aklang.run']();
  await cmds['aklang.check']();
  assert.strictEqual(sent.length, 2);
  assert.ok(sent[0].startsWith("'ak' '/tmp/it'\\''s a dir/my prog.aklang'"), sent[0]);
  assert.ok(sent[1].startsWith("'ak' check "), sent[1]);
  // manifest agrees with the code
  const pkg = require('../package.json');
  assert.deepStrictEqual(pkg.contributes.commands.map(c => c.command).sort(), Object.keys(cmds).sort());
  assert.strictEqual(pkg.main, './extension.js');
  console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
