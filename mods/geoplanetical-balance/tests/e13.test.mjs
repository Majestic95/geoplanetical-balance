// E13 function test: the carbon base multiplier s$Q from the patched and the original bundle.
// Minified names in comments are those of build 26296134; the code and strings use the current build's names.
// Usage: node mods/geoplanetical-balance/tests/e13.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const fn = text => {
  const c = text.indexOf('TfB='), i = text.indexOf('function a0g(', c);
  const n7B = Number(text.slice(c + 4, text.indexOf(';', c)));
  const src = text.slice(i, text.indexOf('}', text.indexOf('return 1-TfB', i)) + 1);
  return new Function('TfB', 'cu', `return (${src})`)(n7B, (A, B, Q) => Math.max(B, Math.min(Q, A)));
};
const p = fn(patched), v = fn(original);
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const close = (a, b) => Math.abs(a - b) < 1e-12;
const c = (co2Mt, base) => ({ energy: { co2Mt }, _powerCo20: base });
for (const r of [0, 0.25, 0.5, 1, 2, 4, 6]) {
  const want = Math.min(4, r);
  check(close(p(c(100 * r, 100)), want), `patched base = ratio ${r} (clamped at 4)`);
  check(close(v(c(100 * r, 100)), 0.65 + 0.35 * want), `vanilla base = 0.65 + 0.35 x ratio ${r}`);
}
check(close(p(c(100, 100)), v(c(100, 100))) && close(p(c(100, 100)), 1), 'day 0 (ratio 1): unchanged, 1');
for (const bad of [null, {}, { energy: { co2Mt: 5 } }, c(5, 0), c(5, -1)]) check(p(bad) === 1, `missing data keeps 1: ${JSON.stringify(bad)}`);
// The mod's reference geobalCo2I0 (power CO2 per unit of GDP at the reference) first: multiplier = intensity ratio.
const ci = (co2Mt, gdp, I0, extra = {}) => ({ energy: { co2Mt }, gdp, geobalCo2I0: I0, ...extra });
for (const r of [0, 0.5, 1, 3, 6]) check(close(p(ci(80 * r, 1000, 0.08)), Math.min(4, r)), `intensity ${r}x the reference: base ${Math.min(4, r)}`);
check(close(p(ci(160, 2000, 0.08)), 1), 'growth with unchanged intensity (CO2 and GDP both doubled): base 1, so revenue grows only with GDP');
check(close(p(ci(8, 100, 0.08)), 1) && close(p(ci(800, 10000, 0.08)), 1), 'territory change (secession to 10%, or a 10x merger) at the same intensity: base unchanged');
check(close(p(ci(40, 1000, 0.08, { _powerCo20: 40 })), 0.5), 'the intensity reference is used before the game reference _powerCo20 (taking control does not reset the base)');
check(close(p({ energy: { co2Mt: 50 }, gdp: 1000, _powerCo20: 100 }), 0.5), 'no intensity reference yet (between load and the reference pass): the game absolute reference');
check(v(ci(40, 1000, 0.08)) === 1, 'vanilla: a country without _powerCo20 keeps 1 (control)');
for (const bad of [ci(5, 100, 0), ci(5, 100, null), ci(5, 100, -1), ci(5, 0, 0.08), ci(5, null, 0.08), ci(NaN, 100, 0.08)]) check(p(bad) === 1, `bad data keeps 1: ${JSON.stringify(bad)}`);
// __geobalCo2Refs stores geobalCo2I0 once per country, inside the simulation only: emQ at game start (not on restore)
// and the month-end finance phase; never on load (a reloaded game stays identical to a continuous one).
{
  check(patched.includes('function ijQ(A,B,Q={}){S_B(A,B,Q.playerControl||{});Q.restore||__geobalCo2Refs(A);let g=A.player;'), 'the reference pass runs in ijQ, skipped on restore');
  check(patched.includes('fA("tickSovereignBondMarketsWorld",()=>(__geobalCo2Refs(A),C_B(A)))'), 'the reference pass runs in the month-end finance phase');
  check(patched.includes('function YYA(A,B){return B?(XIC(B),') && !patched.includes('return __geobalCo2Refs(A),B?'), 'the load and control-switch path (YYA) takes no reference');
  const i = patched.indexOf('function __geobalCo2Refs('), loop = new Function(`${patched.slice(i, patched.indexOf('function YYA(', i))};return __geobalCo2Refs;`)();
  const countries = new Map([['1', { energy: { co2Mt: 12 }, gdp: 400 }], ['2', { energy: { co2Mt: 7 }, gdp: 100, geobalCo2I0: 0.5 }], ['3', { gdp: 50 }], ['4', { energy: { co2Mt: NaN }, gdp: 10 }], ['5', { energy: { co2Mt: 9 }, gdp: 0 }], ['6', { energy: { co2Mt: 0 }, gdp: 30 }]]);
  loop({ countries }); loop(null); loop({});
  check(close(countries.get('1').geobalCo2I0, 0.03), 'reference = current power CO2 / GDP');
  check(countries.get('2').geobalCo2I0 === 0.5, 'an existing reference is kept (taken once)');
  check(countries.get('3').geobalCo2I0 === undefined && countries.get('4').geobalCo2I0 === undefined && countries.get('5').geobalCo2I0 === undefined, 'no energy data or no GDP: nothing stored');
  check(countries.get('6').geobalCo2I0 === 0 && p(ci(9, 30, 0)) === 1, 'zero emissions stored; base stays 1 (no division by 0)');
  check(original.indexOf('geobalCo2I0') < 0, 'original bundle has no geobalCo2I0 (control)');
}
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
