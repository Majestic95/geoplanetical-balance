// G1/G9 function test: the administration collection ratio (PjA, outcomes.collectionRatio) and the admin spending
// line (gwA) from the patched and the original bundle, with stubbed country and administration state.
// Usage: node mods/geoplanetical-balance/tests/g1-g9.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const QC = (A, B, Q) => Math.max(B, Math.min(Q, A)), Wg = (A, B = 0) => Number.isFinite(A) ? A : B;
const qE = (A, B, Q = 1) => B > 1e-12 ? A / B : Q;
const slice = (text, startText, endText) => {
  const i = text.indexOf(startText), j = text.indexOf(endText, i);
  if (i < 0 || j < 0 || j - i > 4000) throw new Error(`not found: ${startText}`);
  return text.slice(i, j + endText.length);
};
const fn = text => {
  const pja = slice(text, 'function F$A(', 'foreign.baseline.delayMonths*1.45+.25}}');
  const gwa = slice(text, 'function oDA(', '+RfB(A)}');
  const PjA = new Function('tC', 'rC', 'AE', `return (${pja})`)(QC, Wg, qE);
  const gwA = new Function('prA', 'fC', 'UE', 'CP', 'RfB', `return (${gwa})`)(
    A => QC(Wg(A.administration?.outcomes?.collectionRatio, 1), 0.55, 1.25), (A, x) => x, (A, x) => x, QC, () => 0);
  return { PjA, gwA };
};
const P = fn(patched), V = fn(original);
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const close = (a, b) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));

// One administration state: every queue at its day-0 delay unless overridden; fiscal queue set by the arguments.
const admin = ({ d0 = 0.6, d = d0, processed = 100, inflow = 100, integ = 0.7, integ0 = 0.7, ge = 0.5 } = {}) => {
  const q = (delay, base) => ({ processed: 50, inflow: 50, delayMonths: delay, baseline: { delayMonths: base } });
  return {
    seed: { institutions: { governmentEffectiveness: ge }, internetUse: 0.6 },
    baselineFactors: { integrity: integ0, reach: 1 },
    queues: { civil: q(1, 1), social: q(1, 1), foreign: q(1, 1), fiscal: { processed, inflow, delayMonths: d, baseline: { delayMonths: d0 } } },
    _integ: integ,
  };
};
const factors = B => ({ org: { integrity: B._integ, reach: 1 }, socialPolicy: { coverage: 1, accuracy: 1 }, foreignPolicy: { coverage: 1, focus: 1 } });
const ratio = (f, opts) => { const B = admin(opts); f.PjA({ revGDP: 30 }, B, factors(B)); return B.outcomes; };

for (const d0 of [0.2, 0.6, 1.5, 3.6]) {
  const p = ratio(P, { d0 }), v = ratio(V, { d0 });
  check(p.collectionRatio === 1 && v.collectionRatio === 1, `day 0 (delay = day-0 delay ${d0}): ratio exactly 1 in both`);
  check(JSON.stringify(p) === JSON.stringify(v), `day 0 (d0 ${d0}): every outcome identical`);
  for (const d of [d0 * 1.2, d0 * 2, d0 + 3, 120]) {
    check(ratio(P, { d0, d }).collectionRatio === ratio(V, { d0, d }).collectionRatio, `delay ${d} above day-0 ${d0}: unchanged`);
  }
  const zero = ratio(P, { d0, d: 0 }).collectionRatio, zeroV = ratio(V, { d0, d: 0 }).collectionRatio;
  check(close(zero, Math.pow(1.05, 0.18)), `empty backlog (d0 ${d0}): bonus capped at 1.05^.18 (${zero.toFixed(4)})`);
  check(zeroV > 1.1, `empty backlog (d0 ${d0}): original bonus above 1.1 (${zeroV.toFixed(3)})`);
  // A delay a little below day 0 whose term stays under 1.05 is untouched.
  const dSmall = (d0 + 0.25) / 1.03 - 0.25;
  check(ratio(P, { d0, d: dSmall }).collectionRatio === ratio(V, { d0, d: dSmall }).collectionRatio, `delay term 1.03 (d0 ${d0}): unchanged`);
  // Catching up a backlog (processed above inflow) keeps its temporary extra.
  const p2 = ratio(P, { d0, d: d0, processed: 130 }).collectionRatio, v2 = ratio(V, { d0, d: d0, processed: 130 }).collectionRatio;
  check(p2 === v2 && close(p2, Math.pow(1.3, 0.55)), `draining backlog at day-0 delay (d0 ${d0}): catch-up term unchanged`);
  check(close(ratio(P, { d0, d: 0, processed: 130 }).collectionRatio, Math.min(1.25, Math.pow(1.3, 0.55) * Math.pow(1.05, 0.18))), `draining to empty (d0 ${d0}): catch-up term times the capped delay term`);
}
check(ratio(P, { integ: 0.35 }).collectionRatio === ratio(V, { integ: 0.35 }).collectionRatio, 'integrity below day 0: unchanged');
check(ratio(P, { d: 0, processed: 50, inflow: 100 }).collectionRatio < 1, 'capacity short with an empty backlog: still below 1');

// G9: admin spending line.
const country = (cr, pop = 10, pop0 = 10) => ({ adminGDP0: 6, pop, _adminPop0: pop0, administration: { outcomes: { collectionRatio: cr } } });
for (const cr of [0.55, 0.8, 0.99, 1]) for (const [pop, pop0] of [[10, 10], [12, 10], [8, 10]]) {
  check(P.gwA(country(cr, pop, pop0)) === V.gwA(country(cr, pop, pop0)), `collection ${cr} (pop ${pop}/${pop0}): admin line unchanged`);
}
for (const cr of [1.01, 1.1, 1.25, 2]) for (const [pop, pop0] of [[10, 10], [12, 10], [8, 10]]) {
  const p = P.gwA(country(cr, pop, pop0));
  check(p === P.gwA(country(1, pop, pop0)), `collection ${cr} (pop ${pop}/${pop0}): admin line as at 1`);
  check(V.gwA(country(cr, pop, pop0)) <= p, `collection ${cr} (pop ${pop}/${pop0}): the original cut the line`);
}
check(close(P.gwA(country(1)), 6) && close(V.gwA({ adminGDP0: 6 }), 6), 'day 0: the line equals adminGDP0');

console.log(failures ? `${failures} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
