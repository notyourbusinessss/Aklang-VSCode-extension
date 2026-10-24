// Run with: node test/grammar.test.js   (checks the TextMate patterns with plain regexes)
const assert = require('assert'), g = require('../syntaxes/aklang.tmLanguage.json');
const rx = (name, flags = '') => new RegExp(g.repository[name].match.replace(/\(\?<=\\\(\)/, '(?<=\\()'), flags);
const builtin = rx('builtin'), useAs = rx('use-as');
const hit = (re, s) => { const m = re.exec(s); return m && m[0].trim(); };
// builtins added since Ak 0.6: sockets, coroutines, parallel workers
for (const b of ['tcpl', 'tcpc', 'tcpa', 'tcpp', 'fdr', 'fdw', 'fdwait', 'fdline', 'fdreadn', 'fdc', 'dns', 'rdns', 'peer', 'sockname', 'shutw', 'shutr', 'sockopt', 'udp', 'udpl', 'udpto', 'udpfrom', 'udpfrom2', 'unixl', 'unixc', 'co', 'resume', 'yield', 'drain', 'par', 'shared', 'cores'])
  assert.strictEqual(hit(builtin, `(${b} x)`), b, b);
assert.strictEqual(hit(builtin, '(tcpcx 1)'), null, 'whole words only');
assert.strictEqual(hit(builtin, 'a.dns'), null, 'not after a dot');
assert.strictEqual(hit(useAs, '(use "lib/http.aklang" as h)'), 'as');
assert.strictEqual(hit(useAs, '(use "lib/http.aklang")'), null);
assert.strictEqual(hit(useAs, '(p "x" assert)'), null);
// every built-in listed once
const names = g.repository.builtin.match.match(/\(\?<!\[[^)]*\)\(([^)]*)\)/)[1].split('|');
assert.strictEqual(new Set(names).size, names.length, 'duplicate builtin');
console.log('ok');
