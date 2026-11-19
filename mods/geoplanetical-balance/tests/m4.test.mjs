// M4 function test: the daily macro step (huQ, anchor part, with the credibility score RqA) and the restore action
// (pcQ), patched vs original, run day by day on one country whose other credibility terms are held fixed or moved
// deterministically. Checks that the patched step is bit-identical to the original when the government never takes
// control, closes the same-day take-and-restore exploit, and returns the ceiling over 1,095 days; plus the ceiling
// factor at extreme inputs. Since 26403824 the anchor follows RqA as an absolute target (0.05..1, no day-0 baseline),
// so costs are measured against the original's never-controlled path, not against anchor0.
// huQ's non-credibility inputs (potential, gap, deflator, dollar share) and the inflation target (klB) are stubbed; the
// credibility code and the game's own helpers (hG, CcQ, RX, F1B) come from the bundles. Minified names: 26403824.
// Usage: node mods/geoplanetical-balance/tests/m4.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const slice = (text, from, to, what) => {
  const a = text.indexOf(from), b = text.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error(`${what} not found`);
  return text.slice(a, b);
};
const consts = text => {
  const m = /var Hft=([\d.]+),r1o=([\d.]+);/.exec(text), k = /,xpo=Math\.log\(([\d.]+)\);function cDe\(/.exec(text);
  if (!m || !k) throw new Error('Hft/r1o/xpo not found');
  return `const Hft=${m[1]},r1o=${m[2]},xpo=Math.log(${k[1]});`;
};
const STUBS = 'const ZC=(A,B,Q)=>Math.max(B,Math.min(Q,A)),ryt=()=>1,Opo=()=>0,_ge=()=>1,jn=()=>1,Dpo=()=>1,nyt=()=>.1,QKt=()=>{},Hze=()=>2;';
const load = (text, restoreFrom) => new Function('H', STUBS + consts(text) +
  slice(text, 'function $x(', 'var zft=', '$x..RX') + slice(text, 'function cDe(', 'function mO(', 'cDe, F1B') +
  slice(text, 'function XOa(', 'function eDa(', 'XOa') + slice(text, restoreFrom, 'function DEa(', 'm7a') +
  'return { step: XOa, score: cDe, restore: OEa, factor: typeof __geobalCbFactor === "function" ? __geobalCbFactor : null };')(() => {});
const P = load(patched, 'function __geobalCbFactor('), O = load(original, 'function OEa(');
if (!P.factor) throw new Error('M4 helper not found in the patched bundle');

let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const close = (a, b, tol = 1e-12) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

// One country, run for `days` daily steps. script(day, B, act) may take control (act.take()) or restore
// (act.restore(), the player's action) before that day's step; terms(day, B) moves the other credibility inputs.
const run = (M, { days = 2190, script = () => {}, terms = () => {}, anchor0 = 0.9 } = {}) => {
  const B = { key: 'X', pop: 1, gdpVol: 1, ccy: { perUnit0: 1, perUnit: 1 }, inflExp: 2, inflation: 2, policyRate: 4,
    deficitNow: 2, anchor: anchor0, anchor0, cbAuto: true };
  const A = { day: 0, player: B };
  const act = { take: () => { B.cbAuto = false; }, restore: () => M.restore(A) };
  const path = [];
  for (let d = 0; d <= days; d++) {
    A.day = d;
    script(d, B, act);
    terms(d, B);
    M.step(A, B, { worldDefl: 1 });
    path.push(B.anchor);
  }
  return { path, B };
};
const same = (a, b) => a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
const never = run(O);
const rel = (r, d) => r.path[d] / never.path[d];  // anchor relative to the original, never controlled

// 1. No take-over ever: bit-identical to the original, with fixed or moving terms, a monetization freeze, a
//    government-controlled bank for the whole run, and a low anchor0.
const movers = {
  'fixed terms': () => {},
  'inflation and deficit cycles': (d, B) => { B.inflExp = 2 + 9 * Math.sin(d / 60) ** 2; B.ccy.inflExp = B.inflExp; B.deficitNow = 1 + 10 * Math.abs(Math.sin(d / 200)); B.policyRate = 1 + 8 * Math.abs(Math.cos(d / 90)); },
  'monetization freeze and print memory': (d, B) => { if (d === 400) { B._lastMonetize = d; B.printMemoryLog = 0.3; } },
};
for (const [name, terms] of Object.entries(movers)) {
  for (const anchor0 of [0.9, 0.45]) {
    check(same(run(P, { terms, anchor0 }).path, run(O, { terms, anchor0 }).path), `never controlled, ${name}, anchor0 ${anchor0}: identical to the original`);
    const ctl = { script: (d, B, a) => d === 1 && a.take(), terms, anchor0 };
    check(same(run(P, ctl).path, run(O, ctl).path), `controlled from day 1 to the end, ${name}, anchor0 ${anchor0}: identical`);
  }
}
// The score itself: identical to the original whenever the bank is independent and no control day is recorded, and
// under control (0.55 in both). anchor0 seeding (F1B) goes through the same score.
{
  const B = { ccy: {}, inflExp: 7, policyRate: 9, deficitNow: 6, cbAuto: true };
  check(Object.is(P.score({ day: 9 }, B), O.score({ day: 9 }, B)), 'score, independent bank: identical');
  const C = { ...B, cbAuto: false }, D = { ...B, cbAuto: false };
  check(Object.is(P.score({ day: 9 }, C), O.score({ day: 9 }, D)) && C.geobalCbControlDay === 9, 'score under control: identical, control day recorded');
}
// Before 26403824 control taken before the first daily step went into the day-0 baseline (_orth0) and then cost
// nothing; the game now uses an absolute target, so it costs in the original too and the patch matches it.
{
  const before = { script: (d, B, a) => d === 0 && a.take() };
  const oB = run(O, before), pB = run(P, before);
  check(rel(oB, 1095) < 0.7, `original: control taken before the first step now costs (${rel(oB, 1095).toFixed(3)})`);
  check(same(oB.path, pB.path), 'patched: identical to the original there');
  const oT0 = run(O, { script: (d, B, a) => { if (d === 0) { a.take(); a.restore(); } } });
  const pT0 = run(P, { script: (d, B, a) => { if (d === 0) { a.take(); a.restore(); } } });
  check(same(oT0.path, never.path) && Math.min(...pT0.path.map((x, i) => x / never.path[i])) < 0.85, 'a same-day toggle before the first step: free in the original, costs patched');
}

// 2. The exploit: take control and restore on the same day, before the daily step.
const toggleOnce = { script: (d, B, a) => { if (d === 10) { a.take(); a.restore(); } } };
const oT = run(O, toggleOnce), pT = run(P, toggleOnce);
check(same(oT.path, never.path), 'original: a same-day take-and-restore leaves no trace (the exploit)');
const relPath = r => r.path.map((x, i) => x / never.path[i]);
const pTr = relPath(pT), minAt = pTr.reduce((m, x, i) => (x < pTr[m] ? i : m), 0);
const forever = run(O, { script: (d, B, a) => d === 10 && a.take() });
check(pT.B.geobalCbControlDay === 10, 'patched: the restore records the control day');
check(pTr[minAt] < 0.85 && pTr[minAt] > rel(forever, 365) && minAt > 300 && minAt < 1000,
  `patched: one same-day toggle costs about a year of control (low ${pTr[minAt].toFixed(3)} on day ${minAt}; a year of control ${rel(forever, 365).toFixed(3)})`);
check(rel(pT, 2190) > 0.9, `patched: recovers over the following years (${rel(pT, 2190).toFixed(3)} on day 2190)`);

// 3. Toggling every 30 days costs as much as staying in control; in the original it is free.
const toggleMonthly = { script: (d, B, a) => { if (d > 0 && d % 30 === 0) { a.take(); a.restore(); } } };
const forever30 = run(O, { script: (d, B, a) => d === 30 && a.take() });
const pM = run(P, toggleMonthly), oM = run(O, toggleMonthly);
check(same(oM.path, never.path), 'original: monthly same-day toggles are free');
check(Math.abs(rel(pM, 1095) - rel(forever30, 1095)) < 0.02 && Math.abs(rel(pM, 2190) - rel(forever30, 2190)) < 0.02,
  `patched: monthly toggles cost as much as permanent control (${rel(pM, 2190).toFixed(3)} vs ${rel(forever30, 2190).toFixed(3)})`);

// 4. A year of control from day 1, then independence restored on day 366.
const year = { script: (d, B, a) => { if (d === 1) a.take(); if (d === 366) a.restore(); } };
const oY = run(O, year), pY = run(P, year);
check(same(oY.path.slice(0, 366), pY.path.slice(0, 366)), 'a year of control: identical while under control');
check(rel(oY, 365) < 0.75, `a year of control lowers the anchor in both (${rel(oY, 365).toFixed(3)})`);
check(pY.B.geobalCbControlDay === 366, 'restore on day 366 recorded');
check(rel(pY, 366 + 730) < rel(oY, 366 + 730) - 0.05, `2 years after restoring: ${rel(pY, 1096).toFixed(3)} vs original ${rel(oY, 1096).toFixed(3)}`);
check(rel(pY, 2190) > rel(pY, 1095) && rel(pY, 2190) < rel(oY, 2190), `still recovering on day 2190: ${rel(pY, 2190).toFixed(3)} vs original ${rel(oY, 2190).toFixed(3)}`);
// The daily step records control while it lasts.
{
  const r = run(P, { days: 40, script: (d, B, a) => d === 5 && a.take() });
  check(r.B.geobalCbControlDay === 40 && r.B.cbAuto === false, 'the daily step records each day under control');
}

// 5. The restore action itself: same results and events as the original; writes only when it restores.
{
  const ev = [];
  const Pz = new Function('H', slice(patched, 'function __geobalCbFactor(', 'function DEa(', 'm7a') + 'return OEa;')((A, id) => ev.push(id));
  const Oz = new Function('H', slice(original, 'function OEa(', 'function DEa(', 'm7a') + 'return OEa;')((A, id) => ev.push(id));
  const a = { day: 77, player: { key: 'X', cbAuto: true } }, b = { day: 77, player: { key: 'X', cbAuto: true } };
  check(Pz(a) === false && Oz(b) === false && !('geobalCbControlDay' in a.player), 'restore when already independent: false, nothing written');
  a.player.cbAuto = false; b.player.cbAuto = false;
  check(Pz(a) === true && Oz(b) === true && a.player.cbAuto === true && a.player.geobalCbControlDay === 77, 'restore: true, independence back, day recorded');
  check(ev.join() === 'finance.cb_independence_restored,finance.cb_independence_restored', 'same event as the original');
  const c = { player: { key: 'X', cbAuto: false } };
  Pz(c);
  check(c.player.geobalCbControlDay === 0, 'missing day counts as day 0');
}

// 6. The ceiling factor at extreme inputs.
{
  const f = (c, day, extra = {}) => P.factor({ day }, { geobalCbControlDay: c, ...extra });
  check(P.factor({ day: 50 }, {}) === 1 && P.factor({}, {}) === 1 && P.factor({ day: 5 }, null) === 1, 'never controlled: 1');
  for (const bad of [null, '5', NaN, Infinity, -Infinity, {}, true]) check(f(bad, 100) === 1, `control day ${String(bad)}: ignored (1)`);
  check(f(101, 100) === 1, 'a control day in the future is ignored');
  check(close(f(100, 100), 0.55) && close(f(100, 100 + 1095 / 2), 0.775) && f(100, 1195) === 1 && f(100, 1e6) === 1, 'straight line from 0.55 to 1 over 1,095 days');
  check(close(f(-50, 0), 0.55 + 0.45 * 50 / 1095), 'negative days work as plain numbers');
  check(f(100, 100, { _dollarized: true }) === 1 && f(100, 100, { ccy: { dollarized: true } }) === 1, 'dollarized: 1, as in the original');
  let monotone = true;
  for (let d = 100, prev = 0; d < 1300; d++) { const v = f(100, d); if (v < prev) monotone = false; prev = v; }
  check(monotone, 'the factor never falls as days pass');
}

console.log(`anchor / never-controlled anchor: one same-day toggle low ${pTr[minAt].toFixed(3)} on day ${minAt}, day 2190 ` +
  `${rel(pT, 2190).toFixed(3)} (original 1); monthly toggles day 2190 ${rel(pM, 2190).toFixed(3)} vs permanent control ` +
  `${rel(forever30, 2190).toFixed(3)}; year of control: day 365 ${rel(pY, 365).toFixed(3)}, 2 years after restoring ` +
  `${rel(pY, 1096).toFixed(3)} (original ${rel(oY, 1096).toFixed(3)}), day 2190 ${rel(pY, 2190).toFixed(3)} (original ${rel(oY, 2190).toFixed(3)})`);
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
