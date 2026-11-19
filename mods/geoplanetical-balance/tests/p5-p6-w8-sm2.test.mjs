// P5/W6, P6, W8 and SM2 function test: code cut from the patched and the original bundle, run with stubs.
// Usage: node mods/geoplanetical-balance/tests/p5-p6-w8-sm2.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const between = (text, from, to, max = 4000) => {
  const i = text.indexOf(from), j = text.indexOf(to, i);
  if (i < 0 || j < 0 || j - i > max) throw new Error(`${from} not found`);
  return text.slice(i, j + to.length);
};
const clamp = (A, B, Q) => Math.max(B, Math.min(Q, A));
const qg = (A, B = 0) => Number.isFinite(A) ? A : B;

// P6: the election input (goA, as A1 left it) and the appeal multiplier.
const goA = text => new Function('K5t', 'Rr', `${between(text, 'function lme(e,t){', ':0)}')}; return lme;`)((A, B) => B.gap, qg);
const P = goA(patched);
const land = (o = {}) => ({ gap: 1, _growthGap0: 1, approval: 50, geobalApprovalRef365: 50, ...o });
check(P({ day: 100 }, land({ approval: 10 })) === 0, 'P6: first year: approval does not count');
check(P({ day: 400 }, land()) === 0, 'P6: approval at its reference: nothing added');
check(near(P({ day: 400 }, land({ approval: 30 })), -1), 'P6: 20 points down: -1');
check(near(P({ day: 400 }, land({ approval: 70 })), 1), 'P6: 20 points up: +1');
check(near(P({ day: 400 }, land({ approval: 0 })), -2) && near(P({ day: 400 }, land({ approval: 100 })), 2), 'P6: held at +/-2');
check(P({ day: 400 }, land({ geobalApprovalRef365: undefined, approval: 10 })) === 0, 'P6: no reference yet: nothing added');
check(near(P({ day: 400 }, land({ gap: -1, _growthGap0: 1, approval: 30 })), -3), 'P6: adds to the growth term');
// Scale, through the multiplier A1 left in kPA.
{
  const m = patched.match(/c=\(__gbG=>__gbG>=0\?1\+__gbG\*MXr:Math\.max\(\.5,1\+__gbG\*MXr\*1\.5\)\)/);
  check(!!m, 'P6: A1\'s multiplier is still there');
  const mult = g => (g >= 0 ? 1 + g * 0.08 : Math.max(0.5, 1 + g * 0.08 * 1.5));
  check(near(mult(-1), 0.88) && near(mult(1), 1.08), 'P6: 20 points down costs about 12% of appeal, up gains 8%');
  const callers = (patched.match(/(?<![\w$.])lme\(e,t\)/g) || []).length;
  check(callers === 4, 'P6: the definition and the three election readers', String(callers));
}
// The reference is set once, a year in, in the anchor step.
{
  const set = new Function('e', 't', 'Rr', 'r', 'HOe', between(patched, '(e.day|0)>=365&&t.geobalApprovalRef365==null', 't._apprAnchor=Rr(t.approval)-r,t._apprModel=HOe)', 300));
  const b = { approval: 44, _apprAnchor: 1 };
  set({ day: 300 }, b, qg, 0, 2); check(b.geobalApprovalRef365 === undefined, 'P6: not set in the first year');
  set({ day: 365 }, b, qg, 0, 2); check(b.geobalApprovalRef365 === 44, 'P6: set at a year');
  b.approval = 10; set({ day: 900 }, b, qg, 0, 2); check(b.geobalApprovalRef365 === 44, 'P6: not moved afterwards');
  const fresh = { approval: 44 }; set({ day: 0 }, fresh, qg, 5, 2); check(fresh._apprAnchor === 39, 'P6: the anchor step still works');
}

// P5/W6: the war terms.
const Ng = text => new Function('eh', 'Oo', 'Cd', `${between(text, 'function $2o(e,t){', 'exhaustion:a?r/a:0' + (text === patched ? ',weight:__geobalW,rally:__geobalR}}' : '}}'))}; return $2o;`)(A => A.wars, (C, B) => ['principal', 'cobelligerent'].includes(C.participants?.[B]?.role), clamp); // yC, as JA filters roles
const NP = Ng(patched), NV = Ng(original);
const war = o => ({ status: 'active', aggressorKey: 'a', startDay: 100, mode: 'x', coalitions: { A: { exhaustion: 20 }, B: { exhaustion: 40 } }, participants: { a: { side: 'A', role: 'principal' }, d: { side: 'B', role: 'principal' }, s: { side: 'B', role: 'support' }, h: { side: 'A', role: 'cobelligerent' }, j: { side: 'B', role: 'cobelligerent' } }, ...o });
check(/function Oo\(e,t\)\{return We\(e,"A"\)\.includes\(t\)\|\|We\(e,"B"\)\.includes\(t\)\}/.test(patched) && /\["principal","cobelligerent"\]/.test(patched), 'P5: the stand-in for xo follows the game\'s own filter');
const read = (key, day = 100, wars = [war({})]) => NP({ wars, day }, key);
check(near(read('a').weight, 1) && read('a').rally === 0, 'P5: the aggressor pays in full, no rally');
check(near(read('d').weight, 0.7) && near(read('d').rally, 6), 'P5: the attacked side pays 70% and rallies by 6');
check(read('s').count === 0 && read('s').weight === 0 && read('s').rally === 0, 'P5: a support role is not counted as at war, as before');
check(near(read('h').weight, 0.7) && read('h').rally === 0, 'P5: an ally of the aggressor pays 70%, no rally');
check(near(read('j').weight, 0.7) && read('j').rally === 0, 'P5: an ally of the attacked pays 70%, no rally');
check(near(read('d', 190).rally, 3), 'P5: the rally halves in 90 days');
check(read('d', 100 + 3650).rally < 0.01, 'P5: and fades');
check(read('d', 100, [war({ startDay: 0, preT0DurationDays: 1407 })]).rally === 0, 'P5: a war under way at the start gives no rally');
check(near(read('d', 0, [war({ startDay: 0, preT0DurationDays: 0 })]).rally, 6), 'P5: a war in play with no days before the start does');
check(near(read('d', 0, [war({ startDay: 0 })]).rally, 6), 'P5: a war declared in play on day 0 does');
check(near(read('d', 90, [war({ startDay: undefined })]).rally, 3), 'P5: no start day counts from day 0');
check(/preT0DurationDays:1407/.test(patched), 'P5: the seeded war still records its days before the start');
check(patched.includes('!(Number(o.preT0DurationDays)>0)'), 'P5: the rally reads that saved field');
check(read('d', 100, [war({ aggressorKey: undefined })]).rally === 0 && near(read('d', 100, [war({ aggressorKey: undefined })]).weight, 0.7), 'P5: no aggressor recorded: 70%, no rally');
check(near(read('d', 100, [war({}), war({ startDay: 10 })]).weight, 1.4), 'P5: two wars add');
check(near(read('d', 100, [war({}), war({ startDay: 10 })]).rally, 6), 'P5: rally is the strongest, not the sum');
check(read('x').count === 0 && read('x').weight === 0 && read('x').rally === 0, 'P5: at peace: nothing');
check(read('d').count === NV({ wars: [war({})], day: 100 }, 'd').count && read('d').exhaustion === NV({ wars: [war({})], day: 100 }, 'd').exhaustion, 'P5: count and exhaustion as the original');
{
  const term = (name, text) => new Function('o', `return ${between(text, `"war",-o.`, name === 'a' ? ',ki.security,"military","war",o),u' : ',ki.security,"military","war",o),p', 300).slice(6, -',ki.security,"military","war",o),m'.length)}`);
  const ap = term('a', patched), apV = term('a', original), st = term('s', patched.slice(patched.indexOf('function ume('))), stV = term('s', original.slice(original.indexOf('function ume(')));
  const d = read('d');
  check(near(ap(d), -0.7 * 7 - 40 * 0.1 + 6), 'P5: approval term for the attacked', ap(d).toFixed(2));
  check(near(apV({ count: 1, exhaustion: 40 }), -7 - 4), 'P5 original: the same -7 for everyone');
  check(near(st(d), -0.7 * 5 - 40 * 0.08 + 3), 'P5: stability term for the attacked', st(d).toFixed(2));
  check(near(stV({ count: 1, exhaustion: 40 }), -5 - 3.2), 'P5 original: the same -5 for everyone');
  check(near(ap(read('a')), apV({ count: 1, exhaustion: 20 })), 'P5: the aggressor pays what the original charged');
  check(ap(read('x')) === 0, 'P5: at peace: nothing');
}

// W8: the pace and the target, through the patched lines and the game's own war helpers (stubbed for membership).
const w8 = new Function('eh', 'Oo', 'n_', `${between(patched, 'function __geobalW8(A,B){', 'pace:.18*e}}')}; return __geobalW8;`)(A => A.wars || [], (C, k) => C.members.includes(k), C => C.status === 'active');
const line = text => between(text, 'm=p.budgetGdpPct+u-p.desireGdpPct', 'c.competence*.06', 300);
const pace = (text, h) => (D, A, comp = 0.5, budget = 3) => new Function('p', 'u', 'l', 'c', 'e', '__geobalW8', `let ${line(text)};return{I:m,n:f}`)({ budgetGdpPct: budget, desireGdpPct: 0 }, 0, D, { competence: comp }, A, h);
const WP = pace(patched, w8), WV = pace(original, null);
const prov = (pop, occ) => ({ __pop: pop, __occupier: occ });
const at = (provs, fighting = true) => ({ key: 'K', activeHostilities: fighting, atWar: fighting, provs });
const warOf = (startDay, o = {}) => ({ status: 'active', members: ['K'], startDay, ...o });
const sim8 = (day, wars) => ({ day, wars });
check(near(WP({ key: 'K', atWar: true, activeHostilities: false, provs: [prov(10)] }, sim8(100, [warOf(100)])).I, 3), 'W8: at war but in a ceasefire: no rise');
check(/a\.atWar=[\w$]+\(e,t\),a\.activeHostilities=[\w$]+\(e,t\)/.test(patched), 'W8: the game still keeps the flag');
check(WP(at([prov(10)], false), sim8(100, [])).I === 3 && near(WP(at([prov(10)], false), sim8(100, [])).n, 0.1), 'W8: at peace: unchanged');
check(near(WV(at([prov(10)]), sim8(100, [warOf(100)])).n, 0.1), 'W8 original: the same slow pace at war (the bug)');
check(near(WP(at([prov(10)]), sim8(100, [warOf(100)])).n, 0.28), 'W8: a new war: about three times the rate');
check(near(WP(at([prov(10)]), sim8(100, [warOf(100)])).I, 5), 'W8: a new war with nobody occupied: 2 points higher');
check(near(WP(at([prov(9), prov(1, 'u')]), sim8(100, [warOf(100)])).I, 3 + 8), 'W8: a tenth occupied: 8 points higher');
check(near(WP(at([prov(0, 'u'), prov(1, 'u')]), sim8(100, [warOf(100)])).I, 3 + 15), 'W8: held at 15');
check(near(WP(at([prov(10, 'K')]), sim8(100, [warOf(100)])).I, 5), 'W8: its own occupier mark does not count');
check(near(WP(at([prov(10)]), sim8(100 + 1095, [warOf(100)])).I, 4) && near(WP(at([prov(10)]), sim8(100 + 1095, [warOf(100)])).n, 0.19), 'W8: three years on: target and pace extras halve');
check(near(WP(at([prov(0, 'u'), prov(1, 'u')]), sim8(100 + 3285, [warOf(100)])).I, 3 + 15 / 8), 'W8: nine years on: an eighth');
check(near(WP(at([prov(10)]), sim8(1095, [warOf(0, { preT0DurationDays: 1095 })])).I, 3 + 2 * 0.25), 'W8: years of war before the start count');
check(near(WP(at([prov(10)]), sim8(2000, [warOf(0), warOf(2000)])).I, 5), 'W8: a new war brings the effort back');
check(near(WP(at([prov(10)]), sim8(2000, [])).I, 5), 'W8: no war record at all: treated as new, no throw');
check(near(WP(at([prov(10)]), sim8(1095, [warOf(0), warOf(1000, { status: 'suspended' })])).I, 4), 'W8: a younger war in ceasefire does not bring the effort back');
check(near(WP(at([prov(10)]), sim8(2190, [warOf(0, { status: 'suspended' })])).I, 5), 'W8: a war only in ceasefire is not counted, so no age applies if the flag is still up');
check(near(WP(at([prov(10)]), sim8(1095, [warOf(0), warOf(1000, { members: ['z'] })])).I, 4), 'W8: another country\'s younger war does not count');
check(near(WP(at([]), sim8(100, [])).I, 5) && near(WP({ key: 'K', activeHostilities: true }, sim8(100, [])).I, 5), 'W8: no provinces: no throw');
check(/function eh\(e,t\)\{/.test(patched) && /function Oo\(e,t\)\{/.test(patched) && /function n_\(e\)\{/.test(patched), 'W8: the war helpers still exist');
check(/function Ub\(e,t,a=null\)/.test(patched) && /g=Ub\(Yd\.mil,/.test(patched), 'W8: the line\'s own limits still apply');

// SM2.
const SM = new Function(`${between(patched, 'function __geobalSM2(A,B){', 'w/B.geobalContestRef365))}')}; return __geobalSM2;`)();
const actor = (host, cells, status = 'active') => ({ hostKey: host, status, strategy: { territorialEscalation: Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, { economicActivityIndex: v }])) } });
const sim = (actors, day = 400) => ({ day, nonStateActors: new Map(actors.map((x, i) => [`a${i}`, x])) });
const land2 = (o = {}) => ({ key: 'K', provs: [{ __provKey: 'p1', __pop: 1 }, { __provKey: 'p2', __pop: 3 }], ...o });
{
  const b = land2();
  check(SM(sim([actor('K', { p1: 0.6 })], 100), b) === 1 && b.geobalContestRef365 === undefined, 'SM2: first year: no effect and no reference');
  check(near(SM(sim([actor('K', { p1: 0.6 })]), b), 1) && near(b.geobalContestRef365, 0.9), 'SM2: at a year: the existing conflict is the reference, so its output stays');
  check(near(SM(sim([actor('K', { p1: 0.6, p2: 0.8 })]), b), (1 - 0.1 - 0.15) / 0.9), 'SM2: a worsening conflict lowers output by population');
  check(near(SM(sim([]), b), 1), 'SM2: conflict ended: back to 1, never above');
  const c = land2();
  check(near(SM(sim([]), c), 1) && c.geobalContestRef365 === 1, 'SM2: a quiet country: 1');
  check(near(SM(sim([actor('K', { p2: 0.55 })]), c), 1 - 3 * 0.45 / 4), 'SM2: three quarters of the people in a province at the floor');
  const d = land2({ geobalContestRef365: 1 });
  check(near(SM(sim([actor('K', { p1: 0.9 }), actor('K', { p1: 0.6 })]), d), 1 - 0.4 / 4), 'SM2: two groups in a province: the lower activity');
  check(near(SM(sim([actor('K', { p1: 0.6 }, 'dissolved')]), d), 1 - 0.4 / 4), 'SM2: a dissolved group\'s record counts until it recovers, so output does not jump back');
  check(near(SM(sim([actor('z', { p1: 0.6 })]), d), 1), 'SM2: another country\'s group does not count');
  check(near(SM(sim([actor('K', { elsewhere: 0.6 })]), d), 1), 'SM2: a province no longer held does not count');
  check(near(SM(sim([actor('K', { p1: NaN })]), d), 1), 'SM2: a bad value does not count');
  check(SM(sim([actor('K', { p1: 0.6 })]), { key: 'K', provs: [] }) === 1 && SM(sim([]), { key: 'K' }) === 1, 'SM2: no provinces: 1');
  const e = land2({ geobalContestRef365: 1 }), order1 = SM(sim([actor('K', { p1: 0.7, p2: 0.8 })]), e), order2 = SM(sim([actor('K', { p2: 0.8, p1: 0.7 })]), e);
  check(order1 === order2, 'SM2: the result does not depend on record order');
  const f = { key: 'K', provs: [{ __provKey: 'p1', __pop: 1 }], geobalContestRef365: 0.1 };
  check(SM(sim([actor('K', { p1: 0.55 })]), f) === 1, 'SM2: a reference below today cannot raise output');
}
check(/let __geobalC=__geobalSM2\(e,l\);/.test(patched) && /provinceSupplyFactor\[ZCo\.get\(p\.id\)\.index\]=m\*__geobalC\}/.test(patched), 'SM2: it reaches the supply factor for every good');
check(/province:Br\(r\.provinceSupplyFactor\?\.\[a\]/.test(patched), 'SM2: the supply model still reads that factor');
check(!original.includes('__geobalSM2'), 'SM2 original: nothing reads the activity index');

console.log(failures ? `${failures} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
