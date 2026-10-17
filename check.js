// Pure helpers for `ak check` output (no VS Code needed, so they can be tested directly).

// ak reports columns as 1-based UTF-8 byte offsets; VS Code wants UTF-16 offsets into the line.
function byteColToOffset(line, col) {
  const bytes = Buffer.from(line, 'utf8').subarray(0, Math.max(0, col - 1));
  return bytes.toString('utf8').length;
}

// `ak check` stops at the first error and prints `error: file:line:col: message`, then the source line and a caret.
// Returns { file, line, col, message } (line and col are 1-based, undefined when there is no position) or null when the output has no error.
function parseCheckOutput(output) {
  const text = String(output);
  const pos = /^error: (.+?):(\d+):(\d+): (.*)$/m.exec(text);
  if (pos) return { file: pos[1], line: +pos[2], col: +pos[3], message: pos[4] };
  const plain = /^error: (.*)$/m.exec(text);
  return plain ? { message: plain[1] } : null;
}

// The part of the line to underline: the identifier or number at the column, else one character, else the whole (short) line.
function errorSpan(line, col) {
  const start = Math.min(byteColToOffset(line, col), line.length);
  const m = /^[A-Za-z0-9_?!.]+/.exec(line.slice(start));
  const len = m ? m[0].length : Math.min(1, line.length - start);
  return len > 0 ? [start, start + len] : [Math.max(0, line.length - 1), line.length];
}

// `ak check -` (read the program from stdin) and `ak test` first shipped in Ak 0.6.0.
const MIN_AK = [0, 6, 0];

// "ak 0.6.0" -> [0, 6, 0]; null when the text is not a version line.
function parseVersion(text) {
  const m = /\bak (\d+)\.(\d+)\.(\d+)/.exec(String(text));
  return m ? [+m[1], +m[2], +m[3]] : null;
}

function atLeast(v, min) {
  for (let i = 0; i < 3; i++) if (v[i] !== min[i]) return v[i] > min[i];
  return true;
}

module.exports = { byteColToOffset, parseCheckOutput, errorSpan, MIN_AK, parseVersion, atLeast };
