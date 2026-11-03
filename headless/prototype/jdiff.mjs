import { readFileSync } from 'node:fs';
const [,, a, b, limit = '40'] = process.argv;
const A = JSON.parse(readFileSync(a, 'utf8')), B = JSON.parse(readFileSync(b, 'utf8'));
const diffs = []; const byTop = new Map(); let total = 0;
const norm = p => p.replace(/\.[^.]*\d[^.]*(?=\.|$)/g, '.*');
function walk(x, y, path) {
  if (x === y) return;
  const tx = Array.isArray(x) ? 'arr' : typeof x, ty = Array.isArray(y) ? 'arr' : typeof y;
  if (tx !== ty || tx !== 'object' && tx !== 'arr' || x === null || y === null) {
    if (typeof x === 'number' && typeof y === 'number' && Number.isNaN(x) && Number.isNaN(y)) return;
    total++; const k = norm(path); byTop.set(k, (byTop.get(k) || 0) + 1);
    if (diffs.length < Number(limit)) diffs.push(`${path}: ${JSON.stringify(x)?.slice(0, 80)} -> ${JSON.stringify(y)?.slice(0, 80)}`);
    return;
  }
  const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
  for (const k of keys) walk(x[k], y[k], `${path}.${k}`);
}
walk(A, B, '$');
console.log('total differing leaves', total);
console.log([...byTop].sort((p, q) => q[1] - p[1]).slice(0, 25).map(([k, n]) => `${n}\t${k}`).join('\n'));
console.log('--- examples'); console.log(diffs.join('\n'));
