// D1/D2 function test: the rating score (hCA) with the within-country adjustment, and the day-365 reference taken by
// the rating tick (A9A), patched vs original, with stubs for the game's feature builder (RZA) and regression (c1Q).
// Minified names in comments are those of build 26296134; the code and strings use the current build's names.
// Usage: node mods/geoplanetical-balance/tests/d1-d2.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const W = { growth: 0.0595, inflation: -0.0015, debt: 0.0135 };
const nw = (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d), pCA = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
// Features straight from the country stub; regression = 8 + weights x features (no clamp needed in range).
const RZA = (A, B) => ({ growth: B.growth, inflation: B.inflation, debt: B.debtRatio });
// c1Q from the bundle, with the regression terms stubbed: intercept 8, the three weights, no shock terms.
const c1Qof = text => { const i = text.indexOf('function UsQ('); return new Function('ae', 'LK', 'fsQ', 'HsQ', 'qsQ', 'sDA', `${text.slice(i, text.indexOf('}', text.indexOf('return sDA(', i)) + 1)};return UsQ;`)(nw, { intercept: 8, weights: W }, () => 0, () => 0, ['growth', 'inflation', 'debt'], pCA); };
const Xf = B => nw(B.debtRatio);
// Currency class (x_A): from the stub's ccyClass, default "reserve" (debt threshold 90 for "reserve" and "union";
// "control", "peg", "none": 60).
const xA = (A, B) => B.ccyClass ?? 'reserve';
// W7 (rated D: defaulted with restructured debt outstanding) from the bundle, with ERA (the restructured debt still
// owed) read from a stub sovereign's `owed`. A world without finance data counts every defaulted country as D.
const W7of = text => { const i = text.indexOf('function P5('); return new Function('xVA', `${text.slice(i, text.indexOf('}', i) + 1)};return P5;`)((F, key) => F.sovereigns[key].owed); };
const load = text => {
  const s = text.indexOf('function __geobalRatingRef(') >= 0 ? text.indexOf('function __geobalRatingRef(') : text.indexOf('function PDA(');
  const e = text.indexOf('}', text.indexOf('function PDA(')) + 1;
  const hCA = new Function('ae', 'kG', 'LK', 'DrB', 'PrB', 'UsQ', 'sDA', 'yX', 'P5', `${text.slice(s, e)};return PDA;`)(nw, Xf, { weights: W }, RZA, xA, c1Qof(text), pCA, 19, W7of(text));
  const a = text.indexOf('function PkA(A){'), b = text.indexOf('let Q=PDA(A,B);', a);
  const head = text.slice(a + 'function PkA(A){'.length, b).replace('for(let B of A.countries.values()){', '');
  const refFns = text.indexOf('function __geobalRatingRef(') >= 0 ? new Function('ae', 'kG', `${text.slice(text.indexOf('function __geobalRatingRef('), text.indexOf('function __geobalRatingAdj('))};return [__geobalRatingRef, __geobalRefDebt, __geobalDebtT];`)(nw, Xf) : [null, null, null];
  const tick = new Function('__geobalRatingRef', '__geobalRefDebt', '__geobalDebtT', 'ae', 'kG', 'DrB', 'PrB', 'P5', 'A', 'B', `${head}`).bind(null, ...refFns, nw, Xf, RZA, xA, W7of(text));
  return { hCA, tick };
};
const P = load(patched), V = load(original);
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const close = (a, b) => Math.abs(a - b) < 1e-9;
const country = (o = {}) => ({ growth: 2, inflation: 2, debtRatio: 60, ...o });

// No reference (first year, or a save without one): as the original for any state.
for (const c of [country(), country({ growth: -5 }), country({ inflation: 30 }), country({ debtRatio: 200 }), country({ defaulted: true })])
  check(P.hCA({}, c) === V.hCA({}, c), `no reference: as original (${JSON.stringify(c)})`);
// The tick takes the reference from day 365, once, never for a defaulted country.
{
  const c = country(); P.tick({ day: 364 }, c); check(c.geobalRatingRef === undefined, 'day 364: no reference');
  P.tick({ day: 365 }, c); check(JSON.stringify(c.geobalRatingRef) === JSON.stringify({ growth: 2, inflation: 2, debt: 60, T: 90 }), 'day 365: reference stored (growth, inflation, debt ratio, threshold)');
  c.growth = 9; P.tick({ day: 500 }, c); check(c.geobalRatingRef.growth === 2, 'reference taken once');
  const d = country({ defaulted: true }); P.tick({ day: 400 }, d); check(d.geobalRatingRef === undefined, 'defaulted: no reference');
  const repaid = { finance: { sovereigns: { R: { owed: 0 } } } }, r = country({ key: 'R', defaulted: true });
  P.tick({ day: 400, ...repaid }, r); check(r.geobalRatingRef?.growth === 2, 'defaulted, restructured debt repaid (no longer D): reference taken');
  const o = country({ key: 'R', defaulted: true }); P.tick({ day: 400, finance: { sovereigns: { R: { owed: 5 } } } }, o); check(o.geobalRatingRef === undefined, 'defaulted, restructured debt still owed: no reference');
  const e = country({ debtRatio: 130 }); P.tick({ day: 365 }, e); check(e.geobalRatingRef.debt === 130, 'debt ratio stored (130%)');
  const v = country(); V.tick({ day: 365 }, v); check(v.geobalRatingRef === undefined, 'original tick stores nothing (control)');
}
// At the reference: unchanged. After: within-country weights replace the cross-country growth and inflation effects.
{
  const ref = country({ debtRatio: 120 }); P.tick({ day: 365 }, ref);
  check(close(P.hCA({}, ref), V.hCA({}, ref)), 'at the reference: the score equals the original');
  const at = o => { const c = { ...ref, ...o }; return P.hCA({}, c) - V.hCA({}, c); };
  // Growth 5 points below the reference: original improves by 0.0595 x 5; patched worsens by 0.15 x 5.
  check(close(P.hCA({}, { ...ref, growth: -3 }) - P.hCA({}, ref), 0.75), 'recession of 5 points: +0.75 notch (worse)');
  check(close(V.hCA({}, { ...ref, growth: -3 }) - V.hCA({}, ref), -0.2975), 'original: the same recession improves the rating (control)');
  check(close(P.hCA({}, { ...ref, growth: 6 }) - P.hCA({}, ref), -0.6), 'boom of 4 points: -0.6 notch (better)');
  check(close(P.hCA({}, { ...ref, inflation: 22 }) - P.hCA({}, ref), 2.2), 'inflation 2 -> 22: +0.05 x 20 + 0.1 x 12 above 10 = +2.2 notches');
  check(close(P.hCA({}, { ...ref, inflation: 8 }) - P.hCA({}, ref), 0.3), 'inflation 2 -> 8: +0.3 notch (below 10, no extra)');
  check(close(P.hCA({}, { ...ref, inflation: 12 }) - P.hCA({}, ref), 0.7), 'inflation 2 -> 12: +0.5 + 0.1 x 2 = +0.7 notch');
  // Debt: the original slope stays, plus 0.05 per point above 90 beyond the reference excess.
  check(close(P.hCA({}, { ...ref, debtRatio: 140 }) - P.hCA({}, ref), 20 * (0.0135 + 0.05)), 'debt 120% -> 140%: +1.27 notch (original slope + 1 per 20 points)');
  check(close(P.hCA({}, { ...ref, debtRatio: 100 }) - P.hCA({}, ref), -20 * (0.0135 + 0.05)), 'debt 120% -> 100%: improves the same way');
  check(close(at({ debtRatio: 80 }), -0.05 * 30), 'debt below 90: excess counts as 0 (120% ref -> 80%: -1.5 notch vs original)');
  check(P.hCA({}, { ...ref, defaulted: true }) === 19, 'defaulted: 19 as before');
  { const A = { finance: { sovereigns: { R: { owed: 0 } } } }, c = { ...ref, key: 'R', defaulted: true };
    check(V.hCA(A, c) !== 19 && close(P.hCA(A, c), V.hCA(A, c)), 'defaulted with restructured debt repaid: rated like the original, not D'); }
  check(P.hCA({}, { ...ref, growth: -200, inflation: 900, debtRatio: 9000 }) === 18 && P.hCA({}, { ...ref, growth: 300 }) >= 0, 'clamped to 0..18 like the original');
  check(close(P.hCA({}, { ...ref, geobalRatingRef: 'broken' }), V.hCA({}, ref)), 'a malformed reference counts as none');
}
// Debt threshold by currency class: 90 for reserve issuers and union members, 60 for everyone else.
{
  for (const [cls, T] of [['reserve', 90], ['union', 90], ['control', 60], ['peg', 60], ['none', 60]]) {
    const ref = country({ debtRatio: 80, ccyClass: cls }); P.tick({ day: 365 }, ref);
    check(close(P.hCA({}, ref), V.hCA({}, ref)), `${cls}: at the reference the score equals the original`);
    const want = 20 * 0.0135 + 0.05 * (Math.max(0, 100 - T) - Math.max(0, 80 - T));
    check(close(P.hCA({}, { ...ref, debtRatio: 100 }) - P.hCA({}, ref), want), `${cls}: debt 80% -> 100% costs ${want.toFixed(2)} notch (threshold ${T})`);
  }
  // A reference saved by mod 0.1.0 (debtExcess only) is completed on the first tick with the reference debt that
  // reproduces 0.1.0's debt term exactly (0.05 x (max(0, debt - 90) - excess)); before that tick the score uses the
  // same rule, so loading such a save moves nothing. Afterwards the new threshold drives changes.
  for (const [cls, debtRatio, debtExcess] of [['reserve', 130, 0], ['reserve', 80, 0], ['reserve', 140, 30], ['reserve', 70, 30],
    ['control', 130, 0], ['control', 80, 0], ['control', 50, 0], ['control', 140, 30], ['control', 70, 30], ['union', 95, 10]]) {
    const old = country({ debtRatio, ccyClass: cls, geobalRatingRef: { growth: 2, inflation: 2, debtExcess } });
    const v010 = V.hCA({}, old) + 0.05 * (Math.max(0, debtRatio - 90) - debtExcess);
    check(close(P.hCA({}, old), v010), `old reference (${cls}, debt ${debtRatio}, excess ${debtExcess}) before the tick: equals mod 0.1.0's score`);
    P.tick({ day: 500 }, old);
    check(Number.isFinite(old.geobalRatingRef.debt) && old.geobalRatingRef.T === (cls === 'control' ? 60 : 90) && close(P.hCA({}, old), v010), `old reference (${cls}, debt ${debtRatio}, excess ${debtExcess}) completed on the tick (debt ref ${old.geobalRatingRef.debt}): still 0.1.0's score`);
    const T = cls === 'control' ? 60 : 90, more = { ...old, debtRatio: debtRatio + 10 };
    check(close(P.hCA({}, more) - P.hCA({}, old), 10 * 0.0135 + 0.05 * (Math.max(0, debtRatio + 10 - T) - Math.max(0, debtRatio - T))), `then 10 more points of debt move it with threshold ${T}`);
  }
  // The threshold is fixed at the reference: a later currency-class flip does not move the rating.
  for (const [from, to] of [['reserve', 'control'], ['control', 'reserve']]) {
    const ref = country({ debtRatio: 70, ccyClass: from }); P.tick({ day: 365 }, ref);
    const now = { ...ref, debtRatio: 100 };
    check(close(P.hCA({}, { ...now, ccyClass: to }) - V.hCA({}, { ...now, ccyClass: to }), P.hCA({}, now) - V.hCA({}, now)), `class flip ${from} -> ${to} after the reference: same adjustment (threshold kept at ${ref.geobalRatingRef.T})`);
  }
  const keep = country({ debtRatio: 70, geobalRatingRef: { growth: 2, inflation: 2, debt: 95 } });
  P.tick({ day: 500 }, keep); check(keep.geobalRatingRef.debt === 95, 'a complete reference is never rewritten');
}
// P7: the debt-170 cliff is gone; rating 18 and debt 400 still trigger.
{
  const p7 = text => { const i = text.indexOf('function Qi('); return new Function('kG', `${text.slice(i, text.indexOf('}', i) + 1)};return Qi;`)(Xf); };
  const pp = p7(patched), pv = p7(original);
  check(pv({ debtRatio: 180, rating: 16 }) === true && pp({ debtRatio: 180, rating: 16 }) === false, 'debt 180%, rating 16: no longer a crisis by the debt cliff (original: yes)');
  for (const [debtRatio, rating] of [[50, 18], [50, 19], [410, 0], [180, 18], [120, 10]]) check(pp({ debtRatio, rating }) === pv({ debtRatio, rating }), `P7 as original at debt ${debtRatio}, rating ${rating}`);
}
// The adjustment is applied inside the regression's clamp: a country whose raw score is above 19 gets no spurious
// improvement from cancelling growth weight the clamp had already cut (a review finding).
{
  const ref = country({ growth: 2, debtRatio: 9000 }); P.tick({ day: 365 }, ref);
  const raw = 8 + W.growth * 12 + W.inflation * 2 + W.debt * 9000 - 0.15 * 10 + 0.05 * 0 + 0.05 * 0 - W.growth * 10;
  check(raw > 19 && P.hCA({}, { ...ref, growth: 12 }) === 18, `raw score far above 19 after a 10-point boom: still 18 (raw ${raw.toFixed(1)})`);
}
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
