// Sums the per-edit counters a test run wrote with GEOBAL_COVERAGE=<folder> (headless/prototype/modded.mjs and
// bootstrap.mjs) and prints the coverage report. Test tooling only.
// Usage: node headless/coverage-merge.mjs <folder> [<folder> ...]   (folders built from the same mod version)
// Use a fresh folder per run: hit files left from an earlier run in the same folder would be summed in.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { coverageReport } from './coverage.mjs';

const dirs = process.argv.slice(2);
if (!dirs.length) { console.error('usage: coverage-merge.mjs <folder> [...]'); process.exit(2); }
const points = JSON.parse(readFileSync(join(dirs[0], 'points.json'), 'utf8'));
const hits = new Array(points.length).fill(0);
let files = 0;
for (const d of dirs) {
  const pf = statSync(join(d, 'points.json')).mtimeMs;
  const p = JSON.parse(readFileSync(join(d, 'points.json'), 'utf8'));
  if (p.length !== points.length || p.some((x, i) => x.id !== points[i].id)) { console.error(`${d}: different edit list`); process.exit(2); }
  for (const f of readdirSync(d).filter(f => /^hits-.*\.json$/.test(f))) {
    if (statSync(join(d, f)).mtimeMs < pf) { console.error(`${d}/${f}: older than points.json (left from an earlier run)`); process.exit(2); }
    const h = JSON.parse(readFileSync(join(d, f), 'utf8'));
    h.forEach((n, i) => { hits[i] += n; });
    files++;
  }
}
console.log(`${files} counter file(s) from ${dirs.length} folder(s)`);
console.log(coverageReport(points, hits));
for (const [i, p] of points.entries()) if (hits[i]) console.log(`ran ${p.id} x${hits[i]}`);
