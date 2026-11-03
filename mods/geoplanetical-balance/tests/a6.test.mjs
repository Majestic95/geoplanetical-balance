// A6 function test: the smoothed tier value from the patched bundle. Usage: node mods/geoplanetical-balance/tests/a6.test.mjs
// Minified names in comments are those of build 26296134; the code and strings use the current build's names.
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const text = buildAll(pinnedBuild(), loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const a = text.indexOf('function __geobalStep('), b = text.indexOf('function D6(A){', a);
const { tier, step } = new Function(`${text.slice(a, b)};return { tier: __geobalTierValue, step: __geobalStep };`)();
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
// Build 26311815 moved the property tax to a household wealth tax (no GDP-per-head tier), so it is no longer here.
const FIELDS = { labor: [.45, .45, .5, .55], laborFormal: [.1, .18, .28, .4], conso: [.22, .26, .3, .36], profits: [.13, .13, .13, .11],
  finTurn: [.08, .08, .08, .18], energy: [.05, .05, .05, .035], carbon: [.011, .011, .011, .006], accUnit: [.008, .008, .008, .014] };
const G = [0.3, 0.6, 1, 2.9, 3, 3.1, 5, 9.99, 10, 12, 24.9, 25, 40, 80, 150];
for (const [name, v] of Object.entries(FIELDS)) {
  for (const g of G) check(tier({ gdpCap: g, demo: { gdpCap0: Math.max(g, 0.6) } }, ...v) === step(g, ...v), `${name}: exact at day 0 for gdpCap ${g}`);
  check(tier({ gdpCap: 12 }, ...v) === step(12, ...v), `${name}: no demo data keeps the original step`);
  for (const g0 of [2, 8, 20, 30]) {
    for (const edge of [3, 10, 25]) {
      const lo = tier({ gdpCap: edge * 0.9999, demo: { gdpCap0: g0 } }, ...v), hi = tier({ gdpCap: edge * 1.0001, demo: { gdpCap0: g0 } }, ...v);
      check(Math.abs(hi - lo) < 1e-3 * Math.max(...v.map(Math.abs)), `${name}: no jump crossing ${edge}k (start ${g0}k): ${lo.toFixed(5)} -> ${hi.toFixed(5)}`);
    }
    const inc = v.every((x, i) => i === 0 || x >= v[i - 1]), dec = v.every((x, i) => i === 0 || x <= v[i - 1]);
    let prev = null, ok = true;
    for (let g = 0.5; g <= 120; g *= 1.07) {
      const t = tier({ gdpCap: g, demo: { gdpCap0: g0 } }, ...v);
      if (prev !== null && ((inc && t < prev - 1e-12) || (dec && t > prev + 1e-12))) ok = false;
      prev = t;
    }
    check(ok, `${name}: monotone along growth from ${g0}k, like its tiers`);
  }
}
// The patched tax-base function itself (No) against the original: equal at day 0 (gdpCap = gdpCap0) for every field,
// with the game's helpers stubbed (Bi clamp, VAg carbon factor, D9B gambling base).
{
  const original = readFileSync(bundlePath(pinnedBuild(), 'simulation-worker.bundle.js'), 'utf8');
  const no = src => {
    const s = src.indexOf('function __geobalStep(') >= 0 ? src.indexOf('function __geobalStep(') : src.indexOf('function D6(A){');
    const e = src.indexOf('}}', src.indexOf('function D6(A){')) + 2;
    return new Function('cu', 'a0g', 'VfB', `${src.slice(s, e)};return D6;`)((x, lo, hi) => Math.max(lo, Math.min(hi, x)), () => 1.3, () => 0.002);
  };
  const p = no(text), v = no(original);
  for (const g of [0.4, 0.7, 2, 3, 6, 10, 18, 25, 60]) {
    const c = { gdpCap: g, demo: { gdpCap0: Math.max(g, 0.6) }, gdp: 100, _gap: 1.5, _tot: 0.4 };
    check(JSON.stringify(p(c)) === JSON.stringify(v(c)), `e6 at day 0 (gdpCap ${g}): every field as the original`);
  }
  const moved = { gdpCap: 10.5, demo: { gdpCap0: 9.5 }, gdp: 100 }, a = p(moved), b = v(moved);
  check(a.labor < b.labor && a.labor > p({ ...moved, gdpCap: 9.5 }).labor, 'e6 crossing 10k from 9.5k: labour share between the old tiers, not the jump');
}
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
