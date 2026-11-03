// A3/C17 function test: the real rate in the business-capital user cost (bYB) before and after the day-365 switch,
// and the switch itself in the business-capital step (E$g), patched vs original.
// Minified names in comments are those of build 26296134; the code and strings use the current build's names.
// Usage: node mods/geoplanetical-balance/tests/a3-c17.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const fns = text => {
  const a = text.indexOf('function __geobalRealRates('), s = a >= 0 ? a : text.indexOf('function BTB(');
  const b = text.indexOf(':0}', text.indexOf('function BTB(')) + 3;
  if (s < 0 || b - s > 800) throw new Error('user-cost rate function (BTB) not found');
  return new Function(`${text.slice(s, b)};return {bYB: BTB, rates: typeof __geobalRealRates === 'function' ? __geobalRealRates : null, c0of: typeof __geobalC0 === 'function' ? __geobalC0 : null};`)();
};
const { bYB: p, rates, c0of } = fns(patched), { bYB: v } = fns(original);
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const close = (a, b) => Math.abs(a - b) < 1e-12;
// Weight on the sovereign yield: 0.3, rising to 0.8 as the yield goes from 1 to 5 points above the policy rate.
const wOf = c => 0.3 + 0.5 * Math.max(0, Math.min(1, (c.bondRate - c.policyRate - 1) / 4));
const corp = c => (1 - wOf(c)) * Math.max(0.25, c.policyRate + 2.4) + wOf(c) * c.bondRate;
const corp1 = c => 0.7 * Math.max(0.25, c.policyRate + 2.4) + 0.3 * c.bondRate;

// Before the switch (no geobalUserCost0): exactly the original, for every input.
for (const policyRate of [-0.5, 0, 2, 5, 15, null, undefined]) for (const bondRate of [0, 3, 8, 30]) for (const inflExp of [0, 2, 10]) {
  const c = { policyRate, bondRate, inflExp };
  check(p(c) === v(c), `before the switch: as original (policy ${policyRate}, bond ${bondRate}, infl ${inflExp})`);
}
for (const c of [{}, null, { bondRate: 5 }]) check(p(c) === v(c), `missing data: as original (${JSON.stringify(c)})`);

// The switch, as E$g does it: store s1 = original rate, c0 = corporate real rate.
const sw = c => { const R = rates(c); return { ...c, geobalUserCost0: { s1: Math.max(0, R.s), c0: R.c, v: 2 } }; };
for (const base of [{ policyRate: 3, bondRate: 4, inflExp: 2 }, { policyRate: 0.5, bondRate: 1, inflExp: 3 }, { policyRate: 8, bondRate: 12, inflExp: 6 }]) {
  const c = sw(base);
  check(close(p(c), v(base)), `continuous at the switch (${JSON.stringify(base)}): ${v(base)}`);
  // After: s1 + (corporate now - c0), floored at 0.
  for (const [dp, db, di] of [[1, 0, 0], [0, 26, 0], [-1, 0, 0], [0, 0, 1], [2, 1, -1], [-5, -3, 4]]) {
    const now = { ...c, policyRate: base.policyRate + dp, bondRate: base.bondRate + db, inflExp: base.inflExp + di };
    const want = Math.max(0, c.geobalUserCost0.s1 + (corp(now) - now.inflExp) / 100 - (corp(base) - base.inflExp) / 100);
    check(close(p(now), want) && p(now) >= 0, `after the switch, policy ${dp >= 0 ? '+' : ''}${dp} bond ${db >= 0 ? '+' : ''}${db} infl ${di >= 0 ? '+' : ''}${di}: ${want.toFixed(5)}`);
  }
}
{
  const base = { policyRate: 3, bondRate: 4, inflExp: 2 }, c = sw(base);
  check(close(p({ ...c, bondRate: 30 }) - p(c), (0.2 * 5.4 + 0.8 * 30 - (0.7 * 5.4 + 0.3 * 4)) / 100), 'a default (+26 on the yield, spread 1 -> 27) raises the rate by 20.1 points (original: 26; mod 0.1.0: 7.8)');
  check(close(wOf({ policyRate: 3, bondRate: 4 }), 0.3) && close(wOf({ policyRate: 3, bondRate: 6 }), 0.55) && close(wOf({ policyRate: 3, bondRate: 9 }), 0.8) && close(wOf({ policyRate: 3, bondRate: 40 }), 0.8) && close(wOf({ policyRate: 10, bondRate: 4 }), 0.3), 'weight: 0.3 up to a 1-point spread, 0.8 from 5 points, linear between');
  check(close(p({ ...c, policyRate: 4 }) - p(c), 0.007), 'a policy rise of 1 point raises it by 0.7');
  check(p({ ...c, bondRate: NaN }) === v({ ...base, bondRate: NaN }), 'after the switch, a missing yield falls back to the original');
}

// E$g: the switch runs on a settled step from day 365, once, and only when the record is missing.
const step = text => {
  const i = text.indexOf('B&&(eTB(r,g),rTB(r,g),kuA(r)'), e = text.indexOf('(__geobalRealRates(r)));', i);
  const j = e >= 0 && e - i < 600 ? e + '(__geobalRealRates(r)))'.length : text.indexOf(';', i);
  return new Function('eTB', 'rTB', 'kuA', '__geobalRealRates', '__geobalC0', 'B', 'r', 'g', `${text.slice(i, j)};return r;`).bind(null, () => {}, () => {}, () => {}, rates, c0of);
};
const sp = step(patched);
const cty = () => ({ policyRate: 3, bondRate: 4, inflExp: 2 });
check(sp(true, cty(), 364).geobalUserCost0 === undefined, 'day 364: no switch');
check(sp(false, cty(), 400).geobalUserCost0 === undefined, 'unsettled step: no switch');
{ const r = sp(true, cty(), 365); check(close(r.geobalUserCost0.s1, 0.02) && close(r.geobalUserCost0.c0, (0.7 * 5.4 + 1.2 - 2) / 100) && r.geobalUserCost0.v === 2, 'day 365: s1, c0 and v 2 stored'); }
{ const r = cty(); r.geobalUserCost0 = { s1: 1, c0: 2, v: 2 }; sp(true, r, 900); check(r.geobalUserCost0.s1 === 1 && r.geobalUserCost0.c0 === 2, 'stored once: later steps keep it'); }
// A baseline from mod 0.1.0 (no v, c0 from the fixed 0.3 weight) is carried over continuously: before and after the
// migration step the rate equals 0.1.0's formula at that moment, then moves with the new weight.
for (const now of [{ policyRate: 3, bondRate: 4, inflExp: 2 }, { policyRate: 3, bondRate: 12, inflExp: 2 }, { policyRate: 1, bondRate: 30, inflExp: 8 }]) {
  const old = { s1: 0.02, c0: 0.025 };
  const want = Math.max(0, old.s1 + (corp1(now) - now.inflExp) / 100 - old.c0);
  const r = { ...now, geobalUserCost0: { ...old } };
  check(close(p(r), want), `old baseline before migration (bond ${now.bondRate}): equals the 0.1.0 rate ${want.toFixed(5)}`);
  sp(true, r, 900);
  check(r.geobalUserCost0.v === 2 && close(p(r), want), `old baseline migrated once (bond ${now.bondRate}): v 2, same rate`);
  const after = { ...r, bondRate: now.bondRate + 2 };
  check(close(p(after) - p(r), (corp(after) - corp(now)) / 100) || p(after) === 0, `after migration the rate moves with the new weight (bond ${now.bondRate} -> ${now.bondRate + 2})`);
}
check(sp(true, { bondRate: 4 }, 400).geobalUserCost0 === undefined, 'no rates: nothing stored');

console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
