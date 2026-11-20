// HP11 function test: the monthly public-staff step (Uzt) returns the wage value of the month's cuts (leavers x annual
// wage, civil roles only), and __geobalSeverance pays months of it as a treasury expense (6/4/3/2 months by the
// trade-union law), retrying as a partial payment when the full one fails. Uzt and the helper are taken from the
// patched bundle; the wage, labour-force, envelope and staffing helpers are stubbed, and Zzt moves halfway each month.
// Usage: node mods/geoplanetical-balance/tests/hp11.test.mjs (from the repo root)
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
const Ec = (e, t, a) => Math.max(t, Math.min(a, e));
const Bs = (x, d = 0) => (Number.isFinite(+x) ? +x : d);
const roles = [{ id: 'education' }, { id: 'health' }];
const loadUzt = (text) => new Function('cNt', 'au', 'I_', 'Nl', 'Vve', 'Bs', '$zt', 'Zzt', 'sY', 'e_', 'Ec', 'dz', `${fnSrc(text, 'Uzt')};return Uzt;`)(
  () => {}, roles, () => {}, roles, (e, f) => e.employment.public[f.id].envelope0Bn, Bs, () => 1,
  (e, f, y, i, s) => i + (s - i) * 0.5, () => 1, () => {}, Ec, () => 0);
const P = loadUzt(patched), O = loadUzt(original);
const country = (cut) => ({ employment: { laborForceM: 100, privateEmployedM: 80, militaryM: 0, public: {
  education: { headcountM: 2, targetHeadcountM: 2 - cut, wageAnnualK: 40, envelope0Bn: 80, nonPayroll0Bn: 0 },
  health: { headcountM: 1, targetHeadcountM: 1 + cut, wageAnnualK: 60, envelope0Bn: 60, nonPayroll0Bn: 0 } } } });
check(O(country(0.4)) === undefined, 'original Uzt returns nothing (no severance)');
const c1 = country(0.4); const sev = P(c1);
// Education cut halfway: 0.2 M leave x 40k = 8 bn of annual wages; health grows: nothing.
check(Math.abs(sev - 8) < 1e-9, 'cut of 0.2 M at 40k a year -> 8 bn of annual wages', String(sev));
check(Math.abs(c1.employment.public.education.headcountM - 1.8) < 1e-12, 'headcount path unchanged by the patch');
const o1 = country(0.4); O(o1);
check(JSON.stringify(o1) === JSON.stringify(c1), 'patched Uzt leaves the same state as the original');
check(P(country(0)) === 0, 'no cut -> 0');
{ const h = country(-0.5); h.employment.public.health.targetHeadcountM = 1.5; check(P(h) === 0, 'hiring only -> 0'); }
{ const b = country(-0.5); check(Math.abs(P(b) - 0.25 * 60) < 1e-9, 'health cut of 0.25 M at 60k -> 15 bn (other role hiring)'); }
check(P({}) === undefined, 'no employment -> undefined (helper ignores it)');
// Severance helper.
const calls = [];
const loadSev = (okFull) => new Function('EB', 'od', `${fnSrc(patched, '__geobalSeverance')};return __geobalSeverance;`)(
  (c) => ({ freedom: c.unions }), (e, c, x, o) => { calls.push({ x, o }); return { ok: okFull || o.allowPartial === true }; });
const world = { finance: {} };
const pay = loadSev(true);
for (const [unions, months] of [['free', 6], ['licensed', 4], ['official', 3], ['banned', 2], ['other', 6], [undefined, 6]]) {
  calls.length = 0; pay(world, { unions }, 8);
  check(calls.length === 1 && Math.abs(calls[0].x - 8 * months / 12) < 1e-12 && calls[0].o.purposeId === 'public_severance',
    `unions ${unions}: ${months} months`, calls[0] ? calls[0].x.toFixed(3) : 'no call');
}
for (const bad of [0, -3, NaN, undefined, null, Infinity, 1e-9]) { calls.length = 0; pay(world, { unions: 'free' }, bad); check(calls.length === 0, `amount ${String(bad)}: no payment`); }
calls.length = 0; pay(null, { unions: 'free' }, 8); check(calls.length === 0, 'no world finance: no payment');
calls.length = 0; loadSev(false)(world, { unions: 'free' }, 8);
check(calls.length === 2 && calls[1].o.allowPartial === true && calls[1].x === calls[0].x, 'failed full payment retried as partial');
// Call site.
check(patched.includes('__geobalSeverance(e,i,Uzt(i,r,!e.playerControlsGovernment(i),g,v?.publicSeparationsM||null))'), 'FTo pays the severance Uzt returns');
console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
