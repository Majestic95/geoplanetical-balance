// T4 function test: private capital inflows (oxA) by rating, patched vs original; the genesis step (EYQ) stores the
// final day-0 rating; oxA itself only reads it.
// Minified names in comments are those of build 26296134; the code and strings use the current build's names.
// Usage: node mods/geoplanetical-balance/tests/t4.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const oxA = text => {
  const i = text.indexOf('function WVA('), j = text.indexOf('function meA(', i);
  const pr = (A, B = 0) => (Number.isFinite(Number(A)) ? Number(A) : B);
  const Ni = A => !!A && !A.defaulted && pr(A.rating) < 17;
  return new Function('qr', 'o3', `return (${text.slice(i, j)})`)(pr, Ni);
};
const p = oxA(patched), v = oxA(original);
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const close = (a, b) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const L = x => 1 / (1 + Math.exp((x - 16.5) / 1.5));
const country = (rating, pct, extra = {}) => ({ rating, gdpNom: 100, externalFinancing0: { privateFinancingPct: pct, geobalRating0: rating }, ...extra });
{
  // EYQ: the stored rating is assigned after the final day-0 rating, inside the same per-country step.
  const i = patched.indexOf('function ZNQ('), body = patched.slice(i, patched.indexOf('}', patched.indexOf('B.debtRatioObserved0', i)));
  const set = body.indexOf('B.rating=Math.max(0,Math.min(19,Math.round(B.ratingScore)))'), store = body.indexOf('B.externalFinancing0&&(B.externalFinancing0.geobalRating0=B.rating)');
  check(i >= 0 && set >= 0 && store > set && body.indexOf('luQ(A,B)') >= 0 && body.indexOf('luQ(A,B)') < set, 'the genesis step stores the rating after the preceding genesis call and after the final day-0 rating is set');
}
{
  const c = { rating: 12, gdpNom: 100, externalFinancing0: { privateFinancingPct: 5 } };
  check(close(p(c), 5) && !('geobalRating0' in c.externalFinancing0), 'no stored rating (save made without the mod): factor 1, and oxA writes nothing');
}
for (const r0 of [0, 8, 14, 16]) {
  const c = country(r0, 5);
  check(close(p(c), 5), `day-0 rating ${r0}: inflows unchanged (5)`);
  for (const r of [r0 + 1, r0 + 3, 17, 18, 19]) {
    if (r < r0) continue;
    c.rating = r;
    const want = 5 * Math.min(1.5, L(r) / L(r0));
    check(close(p(c), want) && want <= 5 + 1e-9, `rating ${r0} -> ${r}: inflows ${want.toFixed(3)} (original ${v(country(r, 5)).toFixed(3)})`);
  }
}
{ const c = country(14, 5); c.rating = 10; check(p(c) > 5 && p(c) <= 7.5, 'upgrade raises inflows, capped at 1.5x'); }
{ const c = country(16, 5); c.rating = 17; check(p(c) > 0 && v(country(17, 5)) === 0, 'no cliff at 17: some inflows remain (original: zero)'); }
for (const r0 of [17, 18, 19]) for (const r of [r0, 16, 12]) {
  const c = country(r0, 5); c.rating = r;
  check(p(c) === v(country(r, 5)), `day-0 rating ${r0} (no market access at day 0), now ${r}: as original`);
}
check(p(country(17, 5, { defaulted: true })) === v(country(17, 5, { defaulted: true })), 'defaulted: as original');
for (const r of [0, 10, 17, 19]) check(p(country(r, -3)) === v(country(r, -3)), `net outflows (rating ${r}): as original`);
{ const c = { rating: 12, gdpNom: 100 }; check(p(c) === v(c), 'no externalFinancing0: as original (0)'); }
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
