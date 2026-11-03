// Modded vs unmodded gap analysis from probe-<variant>.jsonl files.
import { readFileSync } from 'node:fs';
const [,, modded = 'd', base = 'base'] = process.argv;
const rd = v => readFileSync(`probe-${v}.jsonl`, 'utf8').trim().split('\n').map(JSON.parse);
const B = rd(base), M = rd(modded); const n = Math.min(B.length, M.length);
const sum = (row, f) => Object.values(row.byCountry).reduce((s, e) => s + (Number(e[f]) || 0), 0);
console.log(`months compared: ${n - 1}`);
console.log('month  worldPlug base   modded   extra   extra%  | hhDeposits gap%  finInc gap%  worldGDP gap%');
const extraPct = [];
for (let i = 1; i < n; i++) {
  const pb = sum(B[i], 'plugBn'), pm = sum(M[i], 'plugBn');
  const g = f => (sum(M[i], f) / sum(B[i], f) - 1) * 100;
  extraPct.push((pm / pb - 1) * 100);
  console.log(String(i).padStart(5), pb.toFixed(0).padStart(15), pm.toFixed(0).padStart(8), (pm - pb).toFixed(0).padStart(7), ((pm / pb - 1) * 100).toFixed(2).padStart(7), ' |', g('hhDepositsBn').toFixed(3).padStart(15), g('finIncBnY').toFixed(3).padStart(12), g('gdp').toFixed(3).padStart(14));
}
// Per-country compounding check: relative gap per metric, compare growth of the gap across thirds of the run.
const metrics = ['gdp', 'hhDepositsBn', 'finIncBnY', 'inflation', 'unemployment', 'approval'];
const flags = [];
const nonFinite = [];
for (const k of Object.keys(B[0].byCountry)) for (const f of metrics) {
  const gap = []; for (let i = 1; i < n; i++) { const b = B[i].byCountry[k]?.[f], m = M[i].byCountry[k]?.[f]; if (!Number.isFinite(b) || !Number.isFinite(m)) { if (Number.isFinite(b) !== Number.isFinite(m)) nonFinite.push({ k, f, month: i, base: b ?? null, modded: m ?? null }); gap.length = 0; break; } gap.push(['inflation', 'unemployment', 'approval'].includes(f) ? m - b : (Math.abs(b) > 1e-9 ? (m / b - 1) * 100 : 0)); }
  if (gap.length < 9) continue;
  const t = Math.floor(gap.length / 3), a = Math.abs(gap[t - 1]), b2 = Math.abs(gap[2 * t - 1]), c = Math.abs(gap[gap.length - 1]);
  const accel = (c - b2) - (b2 - a);
  flags.push({ k, f, end: gap[gap.length - 1], a, b2, c, accel, growing: c > b2 && b2 > a });
}
if (nonFinite.length) {
  console.log(`\n!!! ${nonFinite.length} series became non-finite or missing on one side only (a broken value, not a gap):`);
  for (const x of nonFinite.slice(0, 20)) console.log(`  ${x.k.padEnd(5)} ${x.f.padEnd(13)} month ${x.month}: base ${x.base} modded ${x.modded}`);
  process.exitCode = 1;
}
const big = flags.filter(x => x.growing && x.accel > 0).sort((x, y) => Math.abs(y.end) - Math.abs(x.end));
console.log(`\naccelerating gaps (|gap| rising each third and speeding up): ${big.length} of ${flags.length} country-metric series`);
for (const x of big.slice(0, 15)) console.log(`  ${x.k.padEnd(5)} ${x.f.padEnd(13)} gap at 1/3: ${x.a.toFixed(3)}  2/3: ${x.b2.toFixed(3)}  end: ${x.c.toFixed(3)}  (${['inflation','unemployment','approval'].includes(x.f) ? 'points' : '%'})`);
const largest = flags.sort((x, y) => Math.abs(y.end) - Math.abs(x.end)).slice(0, 10);
console.log('\nlargest end gaps:'); for (const x of largest) console.log(`  ${x.k.padEnd(5)} ${x.f.padEnd(13)} ${x.end.toFixed(3)}`);
