// T2 function test: the current-account drift term P from the patched and the original bundle, over CA paths.
// Minified names in comments are those of build 26296134; the code and strings use the current build's names.
// Usage: node mods/geoplanetical-balance/tests/t2.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const term = text => {
  const i = text.indexOf('function PuQ('), a = text.indexOf('P=tP(', i) + 2, b = text.indexOf(',v=I.regime', a);
  return new Function('tP', '_d', 'A', 'I', `return ${text.slice(a, b)}`).bind(null, (x, lo, hi) => Math.max(lo, Math.min(hi, x)), (A, a) => a.anchorKey);
};
const t = term(patched), tv = term(original);
// The baseline lives on the sovereign of the currency's anchor country; A is the world with that sovereign.
const world = () => ({ finance: { sovereigns: { X: {} } } });
const p = (cur, A = cur.__A || (cur.__A = world())) => t(A, { anchorKey: 'X', code: 'C', ...cur, __A: undefined });
const v = cur => tv({}, cur);
const stored = cur => cur.__A?.finance.sovereigns.X.geobalCaPct0?.C;
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const close = (x, y) => Math.abs(x - y) < 1e-12;
for (const ca0 of [8, -4, 0, 30, -30]) {
  const cur = { caPct: ca0 };
  check(close(p(cur), 0) && stored(cur) === ca0, `first pricing at CA ${ca0}%: no drift, baseline stored on the sovereign`);
  check(close(v({ caPct: ca0 }), Math.max(-12, Math.min(12, ca0)) * 0.45), `vanilla drifts on the level ${ca0}%`);
  for (const d of [-3, 0, 2, 20]) {
    cur.caPct = ca0 + d;
    check(close(p(cur), Math.max(-12, Math.min(12, d)) * 0.45) && stored(cur) === ca0, `CA ${ca0}% -> ${ca0 + d}%: drift on the change only`);
  }
}
{ const cur = {}; check(close(p(cur), 0) && stored(cur) === 0, 'missing caPct: treated as 0, baseline 0'); }
{ const A = { finance: { sovereigns: { X: { geobalCaPct0: { C: 2 } } } } }; check(close(t(A, { anchorKey: 'X', code: 'C', caPct: 5 }), 3 * 0.45) && A.finance.sovereigns.X.geobalCaPct0.C === 2, 'existing baseline (after reload) is kept'); }
{ const A = { finance: { sovereigns: {} } }, cur = { anchorKey: 'none', code: 'D', caPct: 4 }; check(close(t(A, cur), 0) && cur.geobalCaPct0 === 4, 'no sovereign record: falls back to the currency (transient)'); }
{ const A = { finance: { sovereigns: { X: { geobalCaPct0: { C: 1 } } } } }; t(A, { anchorKey: 'X', code: 'E', caPct: 7 }); check(A.finance.sovereigns.X.geobalCaPct0.E === 7 && A.finance.sovereigns.X.geobalCaPct0.C === 1, 'two currencies on one sovereign keep separate baselines'); }
{
  // Union leader change: the baseline stored on X's sovereign is still used when Y becomes the anchor.
  const A = { finance: { sovereigns: { X: {}, Y: {} } } };
  t(A, { anchorKey: 'X', code: 'U', caPct: 8 });
  check(close(t(A, { anchorKey: 'Y', code: 'U', caPct: 10 }), 2 * 0.45) && A.finance.sovereigns.Y.geobalCaPct0?.U === undefined, 'anchor changes to another member: baseline kept, not re-captured');
}
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
