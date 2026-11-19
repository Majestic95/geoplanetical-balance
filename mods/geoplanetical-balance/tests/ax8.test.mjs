// AX8 function test: the AI occupation-policy chooser (PTo) picks displacement only when the occupier is among the most
// unconstrained regimes (C1 <= .15), faces no sanctions coalition of any cause (participants' GDP < 5 % of world GDP), has a leader with brutality
// >= .75, and occupies a population in open hostility (population-weighted mean hostility >= .75); otherwise it runs the
// game's cost comparison unchanged. PTo and the new gate are sliced from the balance mod built with and without this
// patch and run with the game's own C1, mi, A8, OS and gl and real-shaped sanctions regimes; nC (world GDP), Zt, YF and p1r
// are stubbed.
// Usage: node mods/geoplanetical-balance/tests/ax8.test.mjs (from the repo root)
import { workspaceBuild, buildAll, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const ID = 'ax8-harsh-expulsion';
const [MOD] = loadMods(MODS_DIR, { only: ['geoplanetical-balance'] });
if (!MOD.patches.some(x => x.id === ID)) throw new Error(`${ID} is not in the balance mod`);
const SIMB = m => buildAll(workspaceBuild(), [m]).get('simulation-worker.bundle.js').text;
const patched = SIMB(MOD), withoutFix = SIMB({ ...MOD, patches: MOD.patches.filter(x => x.id !== ID) });
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

const slice = (text, from, to) => {
  const a = text.indexOf(from); if (a < 0 || text.indexOf(from, a + 1) >= 0) throw new Error(`${from}: not found once`);
  const b = text.indexOf(to, a + from.length); if (b < 0) throw new Error(`${to}: end not found`);
  return text.slice(a, b);
};
const decl = (text, head) => { // a one-line var or arrow declaration "name=..." up to the next top-level ',' or ';'
  const a = text.indexOf(head); if (a < 0) throw new Error(`${head} missing`);
  let i = a + head.length, d = 0;
  for (; i < text.length; i++) { const c = text[i]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) { if (!d) break; d--; } else if ((c === ',' || c === ';') && !d) break; }
  return text.slice(a, i);
};
const load = text => {
  const c1 = slice(text, 'function C1(e){', 'function ');
  const gate = text.includes('function __geobalSanctionShare(') ? slice(text, 'function __geobalSanctionShare(', 'function PTo(') : '';
  const pto = slice(text, 'function PTo(e,t,a){', 'function m1r(');
  const src = `let ${decl(text, 'mi=e=>')},${decl(text, 'A8=(e,t,a)=>')},${decl(text, 'OS=(e,t,a=.5)=>')};` +
    `const gl={brutality:.28},Uz=["administration","repression","displacement"];` +
    `const Cn=(x,a,b)=>Math.max(a,Math.min(b,x)),bke=s=>1/Object.values(s).reduce((q,v)=>q+v*v,0),wXr=()=>null;` +
    `${c1}${gate}${pto};return PTo;`;
  return new Function('nC', 'Zt', 'YF', 'p1r', src);
};
// The game's cost comparison stub: administration cheapest, as in every real case.
const costs = { administration: 1, repression: 2, displacement: 3 };
const P = load(patched), O = load(withoutFix);
// sanctions: list of [causeId, share of world GDP held by its participants, status]; world GDP is 100.
const run = (impl, { sanctions = [], brutality = 0.9, regime = {}, h = 0.9, occupier = 'X' } = {}) => {
  const country = { pol: { regime: { electoralIntegrity: 0.05, powerConcentration: 0.95, termLimited: false, ...regime }, chambers: [{ composition: { P: 300 } }] } };
  const countries = new Map([['X', country]]), regimes = [];
  sanctions.forEach(([causeId, share, statusId], k) => { countries.set(`S${k}`, { gdp: share * 100 }); regimes.push({ causeId, targetKey: 'X', statusId, participants: [{ countryKey: `S${k}` }] }); });
  const e = { countries, sanctions: regimes, world: { provByKey: new Map([['p1', { __pop: 2 }], ['p2', { __pop: 1 }]]) } };
  const t = { occupationCivil: { p1: { occupierKey: occupier, h }, p2: { occupierKey: occupier, h } } };
  const pto = impl(() => 100, () => ({ traits: { brutality } }), () => 'administration', (E, T, A, r) => ({ costK: costs[r] }));
  return pto(e, t, 'X');
};
check(run(O) === 'administration', 'original: the harshest case still picks administration');
check(run(P) === 'displacement', 'patched: one-party state, brutal leader, no sanctions, hostile population -> displacement');
for (const cause of ['war_aggression', 'un_resolution', 'atrocities', 'manual_coalition'])
  check(run(P, { sanctions: [[cause, 0.05]] }) === 'administration', `patched: a ${cause} sanctions coalition (5 % of world GDP) blocks it`);
check(run(P, { sanctions: [['war_aggression', 0.03], ['un_resolution', 0.03]] }) === 'administration', 'patched: two smaller coalitions add up past 5 %');
check(run(P, { sanctions: [['war_aggression', 0.049]] }) === 'displacement', 'patched: below 5 % sanctions share it still applies');
check(run(P, { sanctions: [['war_aggression', 0.2, 'ended']] }) === 'displacement', 'patched: an ended sanctions regime does not count');
check(run(P, { brutality: 0.74 }) === 'administration', 'patched: leader brutality 0.74 -> game comparison');
check(run(P, { h: 0.74 }) === 'administration', 'patched: hostility 0.74 -> game comparison');
check(run(P, { regime: { electoralIntegrity: 0.35, powerConcentration: 0.75 } }) === 'administration', 'patched: dominant-party regime (C1 about .3) -> game comparison');
check(run(P, { regime: { electoralIntegrity: 0.1, powerConcentration: 0.9 } }) === 'displacement', 'patched: military junta template (C1 about .145) -> displacement');
check(run(P, { occupier: 'Y' }) === 'administration', 'patched: no provinces held by this occupier -> game comparison');
for (const opt of [{}, { sanctions: [['war_aggression', 0.2]] }, { h: 0.3 }]) check(run(P, { ...opt, brutality: 0.1 }) === run(O, { ...opt, brutality: 0.1 }), `outside the gate the patched chooser equals the original (${JSON.stringify(opt)})`);
console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
