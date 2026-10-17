// Run with: node test/diagnostics.test.js   (the vscode module is stubbed; `ak` is a fake script unless AK=/path/to/ak is set)
const Module = require('module'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akdiag-'));
const fake = path.join(dir, 'ak');
fs.writeFileSync(fake, `#!/bin/sh
if [ "$1" = "--version" ]; then cat "$(dirname "$0")/version"; exit 0; fi
[ "$1 $2" = "check -" ] || { echo "error: cannot read $1"; exit 1; }
src=$(cat)
case "$src" in
  *qq*) echo "error: <stdin>:2:4: undefined: qq"; echo "  (p qq)"; echo "     ^"; exit 1 ;;
  *'"é" zz'*) echo "error: <stdin>:1:9: undefined: zz"; exit 1 ;;
  *nofile*) echo "error: use: file not found: nope.aklang"; exit 1 ;;
  *use*) echo "error: other.aklang:7:1: undefined: foo"; exit 1 ;;
esac
exit 0
`, { mode: 0o755 });
fs.writeFileSync(path.join(dir, 'version'), 'ak 0.6.0\n');
const AK = process.env.AK || fake;

const settings = { path: AK, diagnostics: 'onSave' };
const events = {}, messages = [], collections = [];
class Range { constructor(a, b, c, d) { this.start = { line: a, character: b }; this.end = { line: c, character: d }; } }
class Diagnostic { constructor(range, message, severity) { Object.assign(this, { range, message, severity }); } }
const mkdoc = (text, name = 'prog.aklang') => ({
  languageId: 'aklang', version: 1, fileName: path.join(dir, name), uri: { scheme: 'file', toString: () => 'file://' + path.join(dir, name) },
  getText: () => text, get lineCount() { return text.split('\n').length; },
  lineAt: n => { const t = text.split('\n')[n]; return { text: t, range: new Range(n, 0, n, t.length) }; },
});
const stub = {
  Range, Diagnostic, DiagnosticSeverity: { Error: 0 },
  commands: { registerCommand: () => ({ dispose() {} }) },
  window: { showWarningMessage: m => messages.push(m), terminals: [], createTerminal() {} },
  languages: { createDiagnosticCollection: () => { const m = new Map(), c = { set: (u, d) => m.set(u.toString(), d), delete: u => m.delete(u.toString()), clear: () => m.clear(), dispose() {}, m }; collections.push(c); return c; } },
  workspace: {
    textDocuments: [],
    getConfiguration: () => ({ get: k => settings[k] }),
    onDidOpenTextDocument: f => (events.open = f), onDidChangeTextDocument: f => (events.change = f), onDidSaveTextDocument: f => (events.save = f),
    onDidCloseTextDocument: f => (events.close = f), onDidChangeConfiguration: f => (events.config = f),
  },
};
const load = Module._load;
Module._load = (r, ...a) => r === 'vscode' ? stub : load(r, ...a);
const ext = require('../extension.js');
Module._load = load;

(async () => {
  const api = ext.activate({ subscriptions: [] });
  const diags = doc => collections[0].m.get(doc.uri.toString());
  const run = async text => { const d = mkdoc(text); await api.check(d); return [d, diags(d)]; };

  if (process.env.AK) {                                                // against a real ak: the same outputs `ak check` really prints
    const ver = require('child_process').execFileSync(AK, ['--version']).toString().trim();
    if (!/ak 0\.([6-9]|\d\d)\./.test(ver)) {                              // older than 0.6.0: no squiggles, one warning
      const [od, odiags] = await run('(p qq)\n');
      assert.strictEqual(odiags, undefined);
      assert.ok(messages.length === 1 && messages[0].includes(ver.replace('ak ', '')), messages[0]);
      console.log('ok (real ' + ver + ': warned, no squiggles)');
      return;
    }
    let [, r] = await run('(p 1)\n(p qq)\n');
    assert.deepStrictEqual([r[0].message, r[0].range.start.line, r[0].range.start.character, r[0].range.end.character], ['undefined: qq', 1, 3, 5]);
    [, r] = await run('(p "é" zz)');
    assert.deepStrictEqual([r[0].range.start.character, r[0].range.end.character], [7, 9]);
    [, r] = await run('(p 1+)');
    assert.ok(r[0].message.startsWith("dangling operator '+'"), r[0].message);
    [, r] = await run('(use "nope.aklang")');
    assert.strictEqual(r[0].message, 'use: file not found: nope.aklang');
    [, r] = await run('(p 1)\n');
    assert.deepStrictEqual(r, []);
    console.log('ok (real ' + ver + ')');
    return;
  }

  let [d, ds] = await run('(p 1)\n(p qq)\n');
  assert.strictEqual(ds.length, 1);
  assert.strictEqual(ds[0].message, 'undefined: qq');
  assert.deepStrictEqual([ds[0].range.start.line, ds[0].range.start.character, ds[0].range.end.character], [1, 3, 5]);
  assert.strictEqual(ds[0].source, 'ak check');

  [d, ds] = await run('(p "é" zz)');                                   // byte column 9 is character 7
  assert.deepStrictEqual([ds[0].range.start.line, ds[0].range.start.character, ds[0].range.end.character], [0, 7, 9]);

  [d, ds] = await run('(use "other.aklang")');                         // error inside an included file: shown on line 1 with its location
  assert.strictEqual(ds[0].message, 'other.aklang:7:1: undefined: foo');
  assert.strictEqual(ds[0].range.start.line, 0);

  [d, ds] = await run('(use "nofile")\nnofile');                       // no position
  assert.strictEqual(ds[0].message, 'use: file not found: nope.aklang');

  [d, ds] = await run('(p 1)\n');                                      // clean file: no diagnostics
  assert.deepStrictEqual(ds, []);

  // a result for an older version of the buffer is dropped
  const stale = mkdoc('(p qq)\n', 'stale.aklang'); const p = api.check(stale); stale.version = 2; await p;
  assert.strictEqual(diags(stale), undefined);

  // too old an Ak: no squiggles, one warning that names both versions
  fs.writeFileSync(path.join(dir, 'version'), 'ak 0.5.0\n');
  await new Promise(r => setTimeout(r, 0));
  {
    const old = mkdoc('(p qq)\n', 'old.aklang');
    // the version answer is cached for 30 s, so use a second fake executable
    const fake2 = path.join(dir, 'ak2'); fs.copyFileSync(fake, fake2); fs.chmodSync(fake2, 0o755);
    fs.mkdirSync(path.join(dir, 'v2')); fs.copyFileSync(fake, path.join(dir, 'v2', 'ak')); fs.chmodSync(path.join(dir, 'v2', 'ak'), 0o755);
    fs.writeFileSync(path.join(dir, 'v2', 'version'), 'ak 0.5.0\n');
    settings.path = path.join(dir, 'v2', 'ak');
    await api.check(old);
    assert.strictEqual(diags(old), undefined);
    assert.strictEqual(messages.length, 1);
    assert.ok(/needs Ak 0\.6\.0 or newer, this is 0\.5\.0/.test(messages[0]) || /Ak 0\.6\.0 or newer, this is 0\.5\.0/.test(messages[0]), messages[0]);
  }

  // ak not installed: no squiggles, one warning about aklang.path
  settings.path = path.join(dir, 'no-such-ak');
  messages.length = 0;
  const gone = mkdoc('(p qq)\n', 'gone.aklang');
  await api.check(gone); await api.check(gone);
  assert.strictEqual(diags(gone), undefined);
  assert.strictEqual(messages.length, 1);
  assert.ok(messages[0].includes('aklang.path'), messages[0]);

  // the manifest has the setting the code reads
  const pkg = require('../package.json');
  assert.deepStrictEqual(pkg.contributes.configuration.properties['aklang.diagnostics'].enum, ['onType', 'onSave', 'off']);
  console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
