// M10 function test: the game's own expectations step and drivers, cut from the patched and the original bundle.
// Usage: node --max-old-space-size=4000 mods/geoplanetical-balance/tests/m10.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const between = (text, from, to, max = 3000) => {
  const i = text.indexOf(from), j = text.indexOf(to, i);
  if (i < 0 || j < 0 || j - i > max) throw new Error(`${from} not found`);
  return text.slice(i, j + to.length);
};

const rQ = (A, B = 0) => (Number.isFinite(Number(A)) ? Number(A) : B);
const G7 = A => Math.log1p(Math.max(-99, rQ(A)) / 100);
const lM = (A, B, Q) => Math.max(B, Math.min(Q, A));
const DRIVERS = ['expectations', 'demand', 'policy', 'money', 'flight', 'currency'];
let pressure = 0; // A negative policy driver, so core inflation can really fall below expectations.
// The game's own step. Its helpers are stubbed, and constants that only reach the money, trend and neutral-rate lines are placeholders: this test asserts expectations, not those.
// 26734764: expectations chase realised inflation (Qj, percent) fast only while it is above the target (Hze).
const step = text => new Function('bb', 'Ft', 'gb', 'hb', 'd7', 'pbr', 'LKt', 'Pbr', 'wc', 'qKt', 'Gze', 'vbr', 'Wze', 'hbr', 'tm', 'Qj', 'gbr', 'XKt', 'N6e', 'Hze',
  `${between(text, 'function JKt(e,t,a={}){', 't.implicitTargetPct=Math.max(N6e,S)}return t}')}; return JKt;`)(
  () => {}, rQ, G7, lM, DRIVERS, ['expectations', 'demand', 'policy', 'currency'], 0.25,
  (A, B) => ({ expectations: G7(rQ(B.inflExp, 2)), demand: 0, policy: pressure, money: 0, flight: 0, currency: 0 }),
  1.5, 8, 600, 2, 0.5, 2.5, () => 2, B => Math.expm1(G7(B.moneyCoreInflation)) * 100, 1, () => false, 2, () => 2);
const ccy = (inflExp, core = inflExp) => ({ inflExp, moneyCoreInflation: core, moneyLog: 0, moneyTrendLog: 0, monetaryImpulseLog: 0, flightImpulseLog: 0, moneyLogMonth: {}, neutralRealRatePct: 1.5, perUnit: 1, genesisPrintingLogRate: 0, implicitTargetPct: 2 });
const run = (text, c, days = 30, anchor = 0.02) => step(text)({}, c, { days, anchor });

const P = c => run(patched, c), V = c => run(original, c);
check(V(ccy(-91, -91)).inflExp < -5, 'M10 original: expectations stay near -91 (the bug)', String(V(ccy(-91, -91)).inflExp));
check(P(ccy(-91, -91)).inflExp === -5, 'M10 patched: expectations stop at -5');
{
  pressure = -0.5;
  const a = run(patched, ccy(-5), 30, 0).inflExp, o = run(original, ccy(-5), 30, 0).inflExp;
  check(o < -5, 'M10 original: from -5 under falling prices, expectations cross below', String(o));
  check(a === -5, 'M10 patched: from -5 under falling prices, expectations stop exactly at the floor', String(a));
  const f = run(patched, ccy(-3), 3650, 0).inflExp;
  check(f === -5, 'M10 patched: from -3 over ten years in one step, they fall to the floor and no further', String(f));
  const g = run(patched, ccy(2), 5, 0).inflExp;
  check(g < 2 && g > -5 && g === run(original, ccy(2), 5, 0).inflExp, 'M10 patched: from 2 over a few days they fall as in the game, above the floor', String(g));
  pressure = 0;
}
check(Math.abs(P(ccy(50, 50)).inflExp - V(ccy(50, 50)).inflExp) < 1e-12, 'M10: high inflation unchanged');
check(Math.abs(P(ccy(2, 2)).inflExp - V(ccy(2, 2)).inflExp) < 1e-12, 'M10: normal inflation unchanged');
check(Math.abs(P(ccy(-4, -4)).inflExp - V(ccy(-4, -4)).inflExp) < 1e-12, 'M10: mild deflation above the floor unchanged');
check(P(ccy(5000, 5000)).inflExp === V(ccy(5000, 5000)).inflExp, 'M10: hyperinflation unchanged');
check(Number.isFinite(P(ccy(NaN, 2)).inflExp), 'M10: a bad value still repairs to a finite number');
check(!P(ccy(-91)).reformRequired, 'M10: the floor does not by itself ask for a currency reform');

// Twenty years at the floor: the price level falls by no more than the floor's expectations allow here, and the path stays finite.
{
  const c = ccy(-91, -91);
  for (let i = 0; i < 240; i++) { run(patched, c, 30); c.moneyCoreInflation = -5; }
  check(c.inflExp >= -5 && c.inflExp < 0 && Number.isFinite(c.moneyLog), 'M10: stable and finite after twenty years', `expected ${c.inflExp.toFixed(3)}, moneyLog ${c.moneyLog.toFixed(2)}`);
  const v = ccy(-91, -91);
  for (let i = 0; i < 240; i++) { run(original, v, 30); v.moneyCoreInflation = v.inflExp; }
  check(v.moneyLog < c.moneyLog, 'M10: the original falls much further over the same years', `${v.moneyLog.toFixed(2)} against ${c.moneyLog.toFixed(2)}`);
}
// The loop itself, in the game's own drivers: with the policy rate on its floor, how hard do they push prices down?
{
  const g6g = new Function('Uze', 'Ft', 'gb', 'hb', 'wc', 'GKt', 'mbr', 'WKt', `${between(patched, 'function Pbr(e,t,a={}){', 'currency:WKt*i*P}}')}; return Pbr;`)(
    () => [], rQ, G7, lM, 1.5, 0.35, 0.25, 0.5);
  const drive = inflExp => g6g({}, { inflExp, neutralRealRatePct: 1.5, policyRate: -3, perUnit: 1, perUnitLast: 1, moneyCoreInflation: inflExp }, { days: 1 });
  const floor = drive(-5), deep = drive(-91);
  check(Math.abs(floor.policy) < 0.01 && Math.abs(floor.expectations) < 0.06, 'M10: at the floor the drivers are small', `policy ${floor.policy.toFixed(4)}, expectations ${floor.expectations.toFixed(4)}`);
  check(deep.policy < -1 && deep.expectations < -2, 'M10: at -91 they are huge, the slide the floor cuts', `policy ${deep.policy.toFixed(3)}, expectations ${deep.expectations.toFixed(3)}`);
  const high = g6g({}, { inflExp: -5, neutralRealRatePct: 1.5, policyRate: 40, perUnit: 1, perUnitLast: 1, moneyCoreInflation: -5 }, { days: 1 });
  check(high.policy > -0.2, 'M10: even at a policy rate of 40 the push stays bounded', high.policy.toFixed(4));
}
// The real constants this test stubs: fail if a port changes them.
for (const [name, want] of [['Gze', '600'], ['Wze', '.5'], ['hbr', '2.5'], ['gbr', '1'], ['LKt', '.25']]) {
  check(new RegExp(`[,\\s]${name.replace('$', '\\$')}=${want.replace('.', '\\.')}[,;]`).test(patched), `constant ${name} is ${want}`);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
