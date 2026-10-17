// Run with: node test/check.test.js
const assert = require('assert');
const { byteColToOffset, parseCheckOutput, errorSpan, parseVersion, atLeast, MIN_AK } = require('../check');

// output copied from `ak check` (Ak 0.6.0)
assert.deepStrictEqual(parseCheckOutput("error: s1.aklang:1:5: dangling operator '+' (infix operators must not have spaces around them)\n  (p 1+)\n      ^\n"),
  { file: 's1.aklang', line: 1, col: 5, message: "dangling operator '+' (infix operators must not have spaces around them)" });
assert.deepStrictEqual(parseCheckOutput('error: <stdin>:3:4: undefined: qq\n'), { file: '<stdin>', line: 3, col: 4, message: 'undefined: qq' });
assert.deepStrictEqual(parseCheckOutput('error: ./sub dir/x.aklang:2:4: f takes 2 arguments, got 1\n  (p (f 1))\n     ^\n'),
  { file: './sub dir/x.aklang', line: 2, col: 4, message: 'f takes 2 arguments, got 1' });
assert.deepStrictEqual(parseCheckOutput('error: use: file not found: nope.aklang\n'), { message: 'use: file not found: nope.aklang' });
assert.strictEqual(parseCheckOutput(''), null);
assert.strictEqual(parseCheckOutput('ok\n'), null);

// columns are UTF-8 bytes: `(p "é" zz)`, zz is at byte column 9 but UTF-16 offset 7
const line = '(p "é" zz)';
assert.strictEqual(byteColToOffset(line, 9), 7);
assert.deepStrictEqual(errorSpan(line, 9), [7, 9]);
assert.deepStrictEqual(errorSpan('(p qq)', 4), [3, 5]);               // an identifier
assert.deepStrictEqual(errorSpan("(p 1+)", 5), [4, 5]);               // an operator: one character
assert.deepStrictEqual(errorSpan('', 1), [0, 0]);                     // empty line
assert.deepStrictEqual(errorSpan('(p x)', 99), [4, 5]);              // a column past the end is clamped

assert.deepStrictEqual(parseVersion('ak 0.6.0\n'), [0, 6, 0]);
assert.strictEqual(parseVersion('hello'), null);
assert.ok(atLeast([0, 6, 0], MIN_AK) && atLeast([0, 10, 1], MIN_AK) && atLeast([1, 0, 0], MIN_AK));
assert.ok(!atLeast([0, 5, 0], MIN_AK) && !atLeast([0, 5, 9], MIN_AK));
console.log('ok');
