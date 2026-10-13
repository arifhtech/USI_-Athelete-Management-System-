// Finds htm template text that htm will mis-parse: a bare "<" followed by space/digit/"=" (e.g. "Red < 50", "< 3 days").
// Usage (from usi-ams/): node tools/lint-html.js [files...]
const fs = require('fs');
const BS = String.fromCharCode(92);
const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync('src/modules').map((f) => 'src/modules/' + f).concat(['src/ui.js', 'src/shell.js']);
let bad = 0;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const isTagged = (pos) => /html\s*$/.test(s.slice(Math.max(0, pos - 6), pos));
  const report = (chunk, chunkStart) => {
    const re = /<(?=[\s\d=])/g; let m;
    while ((m = re.exec(chunk))) {
      const pos = chunkStart + m.index;
      const line = s.slice(0, pos).split('\n').length;
      console.log(f + ':' + line + ': ' + JSON.stringify(chunk.slice(Math.max(0, m.index - 30), m.index + 20)));
      bad++;
    }
  };
  function skipString(j, q) { j++; while (j < s.length && s[j] !== q) { if (s[j] === BS) j++; j++; } return j + 1; }
  function skipExpr(j) { // j is just after "${"
    let d = 1;
    while (j < s.length && d) {
      const c = s[j];
      if (c === '`') { j = scan(j, isTagged(j)); continue; }
      if (c === "'" || c === '"') { j = skipString(j, c); continue; }
      if (c === '{') d++; else if (c === '}') d--;
      j++;
    }
    return j;
  }
  function scan(start, tagged) { // s[start] === '`'
    let j = start + 1, chunk = '', chunkStart = j;
    while (j < s.length) {
      const c = s[j];
      if (c === BS) { chunk += s.slice(j, j + 2); j += 2; continue; }
      if (c === '`') { if (tagged) report(chunk, chunkStart); return j + 1; }
      if (c === '$' && s[j + 1] === '{') { if (tagged) report(chunk, chunkStart); j = skipExpr(j + 2); chunk = ''; chunkStart = j; continue; }
      chunk += c; j++;
    }
    return j;
  }
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '/') { const n = s.indexOf('\n', i); if (n < 0) break; i = n; continue; }
    if (c === '/' && s[i + 1] === '*') { i = s.indexOf('*/', i) + 2; continue; }
    if (c === "'" || c === '"') { i = skipString(i, c); continue; }
    if (c === '`') { i = scan(i, isTagged(i)); continue; }
    i++;
  }
}
console.log(bad ? bad + ' suspicious "<" in htm text' : 'lint-html: OK');
process.exit(bad ? 1 : 0);
