// S4 function test: school funding for learning (VCr) is divided by the price level since day 0 (jn) and by the
// programme's pupils over day 0; funding for places ($Cr) only by the price level. VCr, $Cr, RFt and the patch's
// helper come from both bundles; the spend reads (jCr, UCr, Die) and the price index are stubbed.
// Usage: node mods/geoplanetical-balance/tests/s4.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } else console.log(`ok ${what}${detail ? ` (${detail})` : ''}`); };
const fnSrc = (text, name) => {
  const s = text.indexOf(`function ${name}(`);
  if (s < 0 || text.indexOf(`function ${name}(`, s + 1) >= 0) throw new Error(`${name}: not found once`);
  let depth = 0, i = text.indexOf('){', s) + 1;
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(s, i + 1);
};
const ao = (e, t, a) => Math.max(t, Math.min(a, e)), Oa = (e, t = 0) => (Number.isFinite(e) ? e : t), K3 = (e, t, a = 1) => (t > 1e-12 ? e / t : a);
const stubs = { jCr: (e) => (e.noEnvelope ? 0 : 10), UCr: (e, r) => 10 * e.nominal[r], Die: (e, r) => e.lever?.[r] ?? 0 };
const load = (text) => new Function('ao', 'Oa', 'K3', 'jn', 'jCr', 'UCr', 'Die', 'Lz', 'KFt', 'xFt', 'Bie', 'Tie', 'fFt', 'Ti',
  `${text.includes('function __geobalEduDeflator(') ? fnSrc(text, '__geobalEduDeflator') : ''}${fnSrc(text, 'RFt')}${fnSrc(text, 'VCr')}${fnSrc(text, '$Cr')}${fnSrc(text, 'K9e')}${fnSrc(text, 'OFt')};return {VCr,$Cr,K9e,OFt};`)(
  ao, Oa, K3, (e) => e.cpi, (e) => stubs.jCr(e), (e, r) => stubs.UCr(e, r), (e, r) => stubs.Die(e, r), () => 1,
  () => ({ facilities: 1, means: 1 }), () => 1, () => ({ capacity: 1 }), () => 1, 1, ['foundation', 'secondary', 'higher']);
const P = load(patched), O = load(original);
const lv = (n, b) => ({ enrolledM: n, baseline: { enrolledM: b } });
const edu = (f = 1, s = 1, h = 1) => ({ levels: { foundation: lv(5 * f, 5), secondary: lv(3 * s, 3), higher: lv(2 * h, 2) } });
// c(): a country whose budget reference was last rebased at price level `cpi` (the state after a yearly rebase).
const c = (cpi, edu0 = 1, sup = 1) => ({ cpi, geobalRefPrice: cpi, budgetGdpReferenceBn: 100, nominal: { edu: edu0, sup } });
const near = (a, b) => Math.abs(a - b) < 1e-12;
// Day 0.
for (const lvl of ['foundation', 'secondary', 'higher']) check(near(P.VCr(c(1), edu(), lvl), O.VCr(c(1), edu(), lvl)) && near(P.$Cr(c(1), edu(), lvl), O.$Cr(c(1), edu(), lvl)), `day 0 ${lvl}: unchanged`);
for (const m of [0.5, 1.3, 2]) check(near(P.VCr(c(1, m), edu(), 'secondary'), O.VCr(c(1, m), edu(), 'secondary')), `real budget x${m} at day-0 prices and pupils: unchanged`);
// Inflation: 10 years at 5% -> nominal and prices both x1.63.
const inf = 1.05 ** 10;
check(near(O.VCr(c(inf, inf), edu(), 'secondary'), inf), 'original: inflation alone raises learning funding', inf.toFixed(3));
check(near(P.VCr(c(inf, inf), edu(), 'secondary'), 1), 'patched: inflation alone leaves learning funding at 1');
{ const pp = P.$Cr(c(inf, inf, inf), edu(), 'higher'), oo = O.$Cr(c(inf, inf, inf), edu(), 'higher'); check(near(pp, 1) && near(oo, inf), 'places: inflation alone no longer funds places', pp + ' vs ' + oo); }
check(near(P.VCr(c(inf, inf * 1.2), edu(), 'foundation'), 1.2), 'real +20% still counts');
// Pupils: a 25% bigger school cohort with spend scaled up by 25% -> per-pupil funding unchanged.
check(near(O.VCr(c(1, 1.25), edu(1.25, 1.25), 'secondary'), 1.25), 'original: bigger cohort raises learning funding');
check(near(P.VCr(c(1, 1.25), edu(1.25, 1.25), 'secondary'), 1), 'patched: per pupil, unchanged');
check(near(P.$Cr(c(1, 1.25), edu(1.25, 1.25), 'secondary'), 1.25), 'places still follow total real funding');
check(near(P.VCr(c(1, 1), edu(1, 1, 0.5), 'higher'), 2), 'universities use higher-education pupils only');
check(near(P.VCr(c(1, 1), edu(1, 1, 0.5), 'secondary'), 1), 'schools ignore university pupils');
// Bounds and bad inputs.
check(P.VCr(c(1, 1), edu(0.01, 0.01), 'secondary') === 2.5, 'pupil collapse: ratio floored at 0.2, cap 2.5');
check(P.VCr(c(100, 1), edu(), 'secondary') === 0.2, 'hyperinflation without budget: learning floor 0.2');
for (const bad of [0, NaN, undefined, -1]) check(near(P.VCr(c(bad, 1.3), edu(), 'secondary'), 1.3), `price index ${String(bad)}: treated as 1`);
// Before the first yearly rebase the reference is day-0 GDP (no prices in it): no price division even if prices rose.
check(near(P.VCr({ cpi: 1.1, nominal: { edu: 1, sup: 1 } }, edu(), 'secondary'), 1), 'year 1 (no rebase yet): no price division');
// The price used is the one stored at the last rebase, not today's.
check(near(P.VCr({ cpi: 1.3, geobalRefPrice: 1.1, budgetGdpReferenceBn: 100, nominal: { edu: 1.1, sup: 1 } }, edu(), 'secondary'), 1), 'price at the last rebase, not the current one');
// A save from before this patch, already rebased, has no stored price: current price as the fallback.
check(near(P.VCr({ cpi: 1.2, budgetGdpReferenceBn: 100, nominal: { edu: 1.2, sup: 1 } }, edu(), 'secondary'), 1), 'old save: current price level as fallback');
// The yearly rebase (eEa) stores the price level with the new reference.
{ const E = new Function('jn', `${fnSrc(patched, 'eEa')};return eEa;`)((x) => x.cpi), EO = new Function('jn', `${fnSrc(original, 'eEa')};return eEa;`)((x) => x.cpi);
  const w = { countries: new Map([['A', { gdpNom: 120, cpi: 1.07 }], ['B', { gdpNom: 0, cpi: 1.5 }]]) }; const n = E(w);
  check(n === 1 && w.countries.get('A').budgetGdpReferenceBn === 120 && w.countries.get('A').geobalRefPrice === 1.07 && w.countries.get('B').geobalRefPrice === undefined, 'rebase stores the price level with the reference');
  const wo = { countries: new Map([['A', { gdpNom: 120, cpi: 1.07 }]]) }; EO(wo); check(wo.countries.get('A').geobalRefPrice === undefined, 'original rebase stores no price'); }
const noBase = edu(); noBase.levels.higher.baseline.enrolledM = 0;
check(near(P.VCr(c(1, 1, 1.3), noBase, 'higher'), 1.3), 'no day-0 pupils: no per-pupil scaling');
// Fallback branch (no day-0 envelope): the spending lever over its day-0 value, never inflated: no deflator.
{ const fb = { ...c(inf, 9, 9), noEnvelope: true, lever: { edu: 1.3, sup: 1.3 } }, t = { ...edu(1.25, 1.25), means0: { edu: 1, sup: 1 } };
  check(near(P.VCr(fb, t, 'secondary'), O.VCr(fb, t, 'secondary')) && near(P.VCr(fb, t, 'secondary'), 1.3), 'fallback branch: lever ratio unchanged (no price or pupil division)', String(P.VCr(fb, t, 'secondary')));
  check(near(P.$Cr(fb, t, 'higher'), O.$Cr(fb, t, 'higher')), 'fallback branch: places unchanged'); }
// Pupils at zero with a day-0 baseline take the 0.2 floor (no jump to 1).
check(near(P.VCr(c(1, 0.3), edu(0, 0), 'secondary'), 1.5) && near(P.VCr(c(1, 0.3), edu(1e-9, 1e-9), 'secondary'), 1.5), 'zero pupils: divisor 0.2, continuous with near-zero pupils');
// One pupil count per month: K9e computes learning funding before any level updates; OFt uses it.
{ const cc = c(1, 1.2), t = edu(), m = P.K9e(cc, t);
  check(near(m.secondary.__gbV, 1.2) && near(m.foundation.__gbV, 1.2), 'K9e carries the learning funding of each level');
  t.levels.foundation.enrolledM *= 1.5;
  check(near(P.OFt(cc, t, 'secondary', m).means, 1.2), 'secondary reads the same pupils as foundation in that month');
  check(near(P.OFt(cc, t, 'secondary').means, 1.2 / ((7.5 + 3) / 8)), 'without a snapshot (views): current pupils');
  check(near(O.OFt(cc, t, 'secondary', O.K9e(cc, t)).means, 1.2), 'original OFt: funding ratio'); }
console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
