// P4 function test: the approval formula's minority-government term (cme's c) is now 12 x (0.5 - share), where the
// share adds support parties' seats to the coalition's (jb's pct), capped at 0.5: no cliff at 50%, none once
// coalition + support hold half, at most 6 with no seats. The patch's helper is taken from the patched bundle with the
// game's xn, s9e and Cd stubbed; the term expressions are taken from both bundles. Negative control: the original
// term costs 5 points just below a majority and ignores support parties.
// Usage: node mods/geoplanetical-balance/tests/p4.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };
const fnSrc = (text, name) => {
  const s = text.indexOf(`function ${name}(`);
  if (s < 0 || text.indexOf(`function ${name}(`, s + 1) >= 0) throw new Error(`${name}: not found once`);
  let depth = 0, i = text.indexOf('){', s) + 1;
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(s, i + 1);
};
// The term's expression, from `c=` to the `,u=0;` that follows it in cme.
const termExpr = (text) => {
  const s = text.indexOf('c=l&&!l.hasMajority?');
  if (s < 0 || text.indexOf('c=l&&!l.hasMajority?', s + 1) >= 0) throw new Error('term not found once');
  return text.slice(s + 2, text.indexOf(',u=0;', s));
};
const Cd = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const helper = patched.includes('function __geobalMinorityTerm(') ? fnSrc(patched, '__geobalMinorityTerm') : '';
const mk = (text) => new Function('xn', 's9e', 'Cd', `${helper};return (t,l)=>${termExpr(text)};`)(
  (c) => c.gov,
  (c, organ) => c.chambers[organ],
  Cd,
);
const P = mk(patched), O = mk(original);
check(!!helper && termExpr(patched) === 'l&&!l.hasMajority?__geobalMinorityTerm(t,l):0', 'patch applied');

// A country with a 100-seat confidence chamber; coalition C1, support S1, opposition X.
const country = (coal, sup) => ({
  gov: { confidenceOrganIds: ['chamber:lower'], coalitionPartyIds: ['C1'], supportPartyIds: sup == null ? [] : ['S1'] },
  chambers: { 'chamber:lower': { composition: { C1: coal, S1: sup ?? 0, X: 100 - coal - (sup ?? 0) } } },
});
const jb = (coal) => ({ held: coal, total: 100, pct: coal / 100, hasMajority: coal > 50 });
const term = (fn, coal, sup) => fn(country(coal, sup), jb(coal));
const near = (a, b) => Math.abs(a - b) < 1e-9;

// Negative control: the original's cliff and its blindness to support parties.
check(near(term(O, 49.9), -(5 + 0.001 * 12)), 'original: 49.9% costs about 5', String(term(O, 49.9)));
check(near(term(O, 40, 20), term(O, 40)), 'original: support parties ignored');
// Patched.
check(term(P, 51) === 0 && term(O, 51) === 0, 'a majority pays nothing');
check(near(term(P, 49.9), -0.012), 'patched: 49.9% costs 0.012 (no cliff)', String(term(P, 49.9)));
check(near(term(P, 45), -0.6), 'patched: 45% costs 0.6', String(term(P, 45)));
check(near(term(P, 40, 15), 0), 'patched: 40% + 15% support reaches half: no penalty', String(term(P, 40, 15)));
check(near(term(P, 40, 5), -0.6), 'patched: 40% + 5% support counts as 45%', String(term(P, 40, 5)));
check(near(term(P, 0), -6), 'patched: no seats pays the most, 6 (P15 kept)', String(term(P, 0)));
check(term(P, 0) <= term(P, 10) && term(P, 10) <= term(P, 30), 'patched: penalty shrinks as seats grow');
for (const s of [0.5, 10, 30, 49.9]) check(term(P, s) >= term(O, s), `patched: never harsher than the game above 0 seats (${s}%)`);
// A support party also listed as coalition is counted once.
const dup = country(40, 5); dup.gov.supportPartyIds = ['S1', 'C1'];
check(near(P(dup, jb(40)), -0.6), 'a coalition party in the support list is not counted twice', String(P(dup, jb(40))));
// Edge inputs.
check(near(P({ gov: null, chambers: {} }, { pct: 0.3, total: 0, hasMajority: false }), -2.4), 'no government record: coalition share only');
check(Number.isFinite(P(country(30, 5), { pct: NaN, total: 100, hasMajority: false })), 'bad pct: finite');
let mono = true, prev = -Infinity, maxStep = 0;
for (let s = 0; s <= 50; s += 0.5) { const v = term(P, s); if (v < prev - 1e-12) mono = false; if (prev > -Infinity) maxStep = Math.max(maxStep, Math.abs(v - prev)); prev = v; }
check(mono, 'patched: rising from 0 to 50% seats');
// Continuous: a half-point of seats moves the term by at most 12 x 0.005 = 0.06, also across 50% (49.5 -> 50 -> 51).
check(maxStep <= 0.06 + 1e-9, 'patched: no step larger than 0.06 per half-point of seats', String(maxStep));
check(Math.abs(term(P, 50.5) - term(P, 49.5)) <= 0.06 + 1e-9, 'patched: no jump at the majority line', `${term(P, 49.5)} -> ${term(P, 50.5)}`);
check(Math.abs(term(O, 50.5) - term(O, 49.5)) > 5, 'original: a jump of more than 5 at the majority line');

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
