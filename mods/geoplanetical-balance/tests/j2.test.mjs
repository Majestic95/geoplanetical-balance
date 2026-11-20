// J2 function test: police, court and prison capacity (Uot) count the operating (non-payroll) budget at no less than
// 25% of day 0, so a zero operating budget leaves capacity at staffing x 0.25^exponent instead of zero; at day-0
// budgets nothing changes. Uot is taken from both bundles; staffing, facilities and helper reads are stubbed.
// Usage: node mods/geoplanetical-balance/tests/j2.test.mjs (from the repo root)
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
const Ja = (e, t, a) => Math.max(t, Math.min(a, e)), j3 = (e, t, a = 1) => (t > 1e-9 ? e / t : a), Wa = (e, t = 0) => (Number.isFinite(e) ? e : t);
const load = (text) => new Function('Ja', 'j3', 'Wa', 'PN', 'Ns', 'Got', 'CI', 'ysa', `${fnSrc(text, 'Uot')};return Uot;`)(
  Ja, j3, Wa, () => 0, (e, r) => e.staff[r], () => 1, () => ({ ordinaryPolicingRelative: 1 }), () => ({ policeStation: 1, courthouse: 1, prison: 1 }));
const P = load(patched), O = load(original);
const seed = { seed: { spendPoliceGDP: 1, spendJusticeGDP: 0.5 } };
const country = (opexP, opexJ, staffP = 1, staffJ = 1) => ({ spend: { pol: 1, justice: 0.5 }, staff: { internalSecurity: staffP, justiceCorrections: staffJ },
  employment: { public: { internalSecurity: { nonPayroll0Bn: 2, nonPayrollBn: 2 * opexP }, justiceCorrections: { nonPayroll0Bn: 1, nonPayrollBn: opexJ } } } });
const near = (a, b) => Math.abs(a - b) < 1e-12;
// Day 0 and normal budgets identical.
for (const [p, j] of [[1, 1], [0.6, 1.4], [2, 0.3], [3, 3]]) {
  const a = P(country(p, j), seed), b = O(country(p, j), seed);
  check(near(a.police, b.police) && near(a.justice, b.justice) && near(a.corrections, b.corrections), `operations ${p}/${j}: same as the game`, a.police.toFixed(4));
}
// Negative control and floor.
const o0 = O(country(0, 0), seed), p0 = P(country(0, 0), seed);
check(o0.police === 0 && o0.justice === 0 && o0.corrections === 0, 'original: zero operating budget -> zero capacity');
check(near(p0.police, 0.25 ** 0.25) && near(p0.justice, 0.25 ** 0.23) && near(p0.corrections, 0.25 ** 0.32), 'patched: floor 0.25 of operations',
  `${p0.police.toFixed(3)}/${p0.justice.toFixed(3)}/${p0.corrections.toFixed(3)}`);
check(near(P(country(0.1, 0.1), seed).police, p0.police), 'below the floor counts as the floor');
check(near(P(country(0.25, 0.25), seed).police, O(country(0.25, 0.25), seed).police), 'at the floor: unchanged');
// No staff still means no capacity.
const ns = P(country(0, 0, 0, 0), seed);
check(ns.police === 0 && ns.justice === 0 && ns.corrections === 0, 'no staff: still zero');
// Missing day-0 non-payroll: falls back to the spending ratio, also floored.
const nb = country(1, 1); nb.employment.public.internalSecurity.nonPayroll0Bn = 0; nb.spend.pol = 0;
check(near(P(nb, seed).policeOperations, 0.25) && O(nb, seed).policeOperations === 0, 'fallback path floored too');
check(P(country(5, 5), seed).policeOperations === 2.2, 'cap 2.2 unchanged');
console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
