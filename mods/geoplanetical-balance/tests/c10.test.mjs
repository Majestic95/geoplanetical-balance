// C10 function test: tax collection efficiency (or) with stubbed inputs, patched vs original.
// Minified names in comments are those of build 26296134; the code and strings use the current build's names.
// Usage: node mods/geoplanetical-balance/tests/c10.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const or = text => {
  const i = text.indexOf('function Nn(');
  const src = text.slice(i, text.indexOf('Yx(a,.15,.99)}', i) + 'Yx(a,.15,.99)}'.length);
  // Since 1.1.5 Nn has no corruption or cabinet term: its helpers are the tax burden (VB), the administration's
  // collection ratio (hce) and the clamp (Yx).
  return new Function('VB', 'hce', 'Yx', `return (${src})`)(B => B.burden, () => 1, (x, lo, hi) => Math.max(lo, Math.min(hi, x)));
};
const p = or(patched), v = or(original);
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const close = (a, b) => Math.abs(a - b) < 1e-12;
const country = { key: 'X', eff: 0.8, stab: 60, stab0: 60, burden: 30, base: { burden: 30 }, inflation: 0 };
const world = (share, share0) => ({ shadowMarket: { byCountry: { X: { shareGDP: share, shareGDP0: share0 } } } });
check(close(p(world(0.05, 0.05), country), v(world(0.05, 0.05), country)), 'day 0 (share = day-0 share): unchanged');
for (const [s, s0] of [[0.08, 0.05], [0.03, 0.05], [0.0225, 0.05], [0.08, 0.02]]) {
  check(close(p(world(s, s0), country), Math.max(0.15, Math.min(0.99, v(world(s, s0), country) * (1 - (s - s0))))), `share ${s} vs day-0 ${s0}: efficiency x ${(1 - (s - s0)).toFixed(4)}`);
}
check(p(world(0.08, 0.05), country) < v(world(0.08, 0.05), country), 'a larger shadow economy lowers collection');
check(close(p({}, country), v({}, country)) && close(p({ shadowMarket: { byCountry: {} } }, country), v({}, country)), 'no shadow-market data: unchanged');
check(close(p(world(0.9, 0), { ...country, eff: 0.2 }), 0.15), 'still clamped at the game floor 0.15');
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
