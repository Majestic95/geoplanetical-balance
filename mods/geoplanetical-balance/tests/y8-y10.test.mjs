// Y8, Y9 and Y10 function test. Y8 runs Jb over the game's own status table and relation profiles, comparing the day-0
// member list with the original. Y9 runs y0B and the input building in GhQ and N2C. Y10 runs km's petition branch.
// Usage: node mods/geoplanetical-balance/tests/y8-y10.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const between = (text, from, to, max = 4000) => {
  const i = text.indexOf(from), j = text.indexOf(to, i);
  if (i < 0 || j < 0 || j - i > max) throw new Error(`${from} not found`);
  return text.slice(i, j + to.length);
};
const objectAt = (text, start) => {
  const open = text.indexOf('{', start); let d = 0, q = null;
  for (let k = open; k < text.length; k++) {
    const c = text[k];
    if (q) { if (c === String.fromCharCode(92)) k++; else if (c === q) q = null; }
    else if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '{') d++;
    else if (c === '}' && --d === 0) return text.slice(open, k + 1);
  }
  throw new Error('object not closed');
};

// Y8: the game's own table and profile kinds.
const table = new Function(`return ${objectAt(original, original.indexOf('SOV:', original.indexOf('bkt={')))}`)();
const profiles = between(original, 'fA=Object.freeze({self_governing_territory:', '});function wkt(', 3000);
const stateKinds = new Set([...profiles.matchAll(/(\w+):J5\("\w+"(?:,\{[^}]*\})?,\{actorKind:"sovereign_state"\}\)/g)].map(m => m[1]));
check(stateKinds.has('protected_state') && stateKinds.has('puppet_state') && stateKinds.size === 2, 'Y8: only protected and puppet states are state kinds', [...stateKinds].join());
const record = key => { const p = table[key]?.relationProfile; return p && profiles.includes(`${p}:J5(`) ? { actorKind: stateKinds.has(p) ? 'sovereign_state' : 'domestic_polity' } : null; };
const jb = text => {
  const src = between(text, 'function kF(e){', '}function YLa(');
  return new Function('hA', `${src.slice(0, -'function YLa('.length)}; return kF;`)(k => table[k] || { status: 'sovereign', sovereign: null });
};
const P8 = jb(patched), V8 = jb(original);
const dayZero = Object.keys(table).map(key => ({ key, constitutional: record(key) }));
const diffs = dayZero.filter(c => P8(c) !== V8(c)).map(c => c.key);
check(dayZero.length > 50 && diffs.length === 0, `Y8: day-0 member list unchanged over ${dayZero.length} listed rows`, diffs.join());
const withProfile = dayZero.filter(c => ['dependency', 'disputed'].includes(table[c.key].status) && table[c.key].relationProfile);
check(withProfile.length > 20 && withProfile.every(c => c.constitutional?.actorKind === 'domestic_polity'), `Y8: all ${withProfile.length} territories with a profile start as domestic polities`);
check(P8({ key: '304', constitutional: null }) === true && V8({ key: '304', constitutional: null }) === false, 'Y8: Greenland after independence is a member (the original never)');
check(P8({ key: '304', constitutional: record('304') }) === false, 'Y8: Greenland before independence is not');
check(P8({ key: 'n:N. Cyprus', constitutional: null }) === true, 'Y8: a disputed territory after independence is a member');
check(P8({ key: '304', constitutional: { actorKind: 'sovereign_state' } }) === true, 'Y8: a state-kind record counts');
check(P8({ key: 'n:Indian Ocean Ter.', constitutional: null }) === false, 'Y8: a dependency with no profile stays out');
check(P8({ key: '158', constitutional: null }) === false && P8({ key: '275', constitutional: null }) === false, 'Y8: recognized and observer rows stay out');
check(P8({ key: '260', constitutional: null }) === false, 'Y8: uninhabited rows stay out');
check(P8({ key: '840', constitutional: null }) === true && P8({ key: 'r:new', constitutional: null }) === true, 'Y8: sovereign and born countries as before');
check(P8(null) === false, 'Y8: no country: false');

// Y9: y0B.
const sw = (A, B, Q) => Math.max(B, Math.min(Q, A)), J1 = (A, B = 0) => Number.isFinite(Number(A)) ? Number(A) : B;
const y0B = text => new Function('qs', 'v0', 'cIa', `${between(text, 'function Mpt(e,t,a=0,r={}){', 'war:l&&t.atWar0===!1?.06:0}}')}; return Mpt;`)(sw, J1, 1);
const P9 = y0B(patched), V9 = y0B(original);
const q = { identity: 0.5, repression: 0, betrayals: 0, refusalGrievance: 0, atWar0: false };
const us = { unemployment: 12, atWar: false, domestic: { baseline: { unemployment: 4, civilLiberties: 0.9 } } };
const pr = { unemployment: 8, domestic: { baseline: { unemployment: 8, civilLiberties: 0.8 } } };
const eco = e => Math.min(1, e / 8) * 0.75 * 0.18;
const a = P9(us, q, 0, { civilLiberties: 0.8, economyActor: pr });
check(a.economy === 0 && a.liberties === 0, 'Y9: a sovereign\'s recession and laws do not anger a territory at its own baseline', JSON.stringify(a));
const b = P9(us, q, 0, { civilLiberties: 0.5, economyActor: { ...pr, unemployment: 12 } });
check(Math.abs(b.economy - eco(4)) < 1e-12 && Math.abs(b.liberties - sw(0.3 / 0.6, 0, 1) * 0.15) < 1e-12, 'Y9: the territory\'s own unemployment and liberties do', JSON.stringify(b));
check(V9(us, q, 0, { civilLiberties: 0.9 }).economy > 0, 'Y9 original: the sovereign\'s unemployment angers the territory (the bug)');
check(JSON.stringify(P9(us, q, 0, { civilLiberties: 0.7 })) === JSON.stringify(V9(us, q, 0, { civilLiberties: 0.7 })), 'Y9: with no polity, the same as the original');
check(P9({ ...us, atWar: true }, q, 0, { civilLiberties: 0.8, economyActor: pr }).war === 0.06, 'Y9: war still comes from the sovereign');
{
  const lc = P9(us, q, 0, { civilLiberties: 0.5, economyActor: pr, localSatisfactionChange: -0.1 }), lo = V9(us, q, 0, { civilLiberties: 0.9, localSatisfactionChange: -0.1 });
  check(lc.economy === 0 && lo.economy === 0 && lc.living_conditions === lo.living_conditions && Math.abs(lc.liberties - sw(0.3 / 0.6, 0, 1) * 0.15) < 1e-12, 'Y9 on 1.1.5: with satisfaction data for the territory the game drops the economy cause; liberties still read the territory', JSON.stringify(lc));
}
const bare = P9(us, q, 0, { civilLiberties: 0.8, economyActor: { unemployment: 20 } });
check(bare.economy === 0 && bare.liberties === 0, 'Y9: a polity with no baseline adds nothing', JSON.stringify(bare));
// The inputs in the tick and in the panel.
check(/pIa\(\(__geobalP=>Mpt\(o,t,r,\{civilLiberties:Yb\(__geobalP,"civil_liberties"\),economyActor:__geobalP,\.\.\.kpt\(e,t\)\}\)\)\(t\.polityKey&&e\.countries\.get\(t\.polityKey\)\|\|o\)\)/.test(patched), 'Y9: the panel passes the polity, falling back to the sovereign');
{
  const expr = patched.match(/s=(\(__geobalP=>\(\{civilLiberties:Yb\(__geobalP,"civil_liberties"\),economyActor:__geobalP,\.\.\.kpt\(e,o\)\}\)\)\(o\.polityKey&&e\.countries\.get\(o\.polityKey\)\|\|n\))/)[1];
  const f = new Function('Yb', 'kpt', 'e', 'o', 'n', `return ${expr}`).bind(null);
  const kpt = (A, Q) => ({ localSatisfactionChange: Q.polityKey === 'P' ? -0.1 : null });
  const x7 = c => c.lib, sov = { key: 'S', lib: 0.9 }, pol = { key: 'P', lib: 0.4 }, A = { countries: new Map([['P', pol]]) };
  check(f(x7, kpt, A, { polityKey: 'P' }, sov).economyActor === pol && f(x7, kpt, A, { polityKey: 'P' }, sov).civilLiberties === 0.4, 'Y9: a question with a living polity reads it');
  check(f(x7, kpt, A, { polityKey: 'gone' }, sov).economyActor === sov && f(x7, kpt, A, { polityKey: null }, sov).civilLiberties === 0.9, 'Y9: no polity, or a dead one: the sovereign');
  check(f(x7, kpt, A, { polityKey: 'P' }, sov).localSatisfactionChange === -0.1, 'Y9: the living-conditions input of the game (kpt, 1.1.5) still passes through');
}

// Y10: km's petition branch, with the rest stubbed.
const km = text => {
  const src = between(text, 'function BD(e,t,a,r,o={}){', 'supportAfter:Gm(p,i)}}', 3500);
  const HV = q => ['fiscal', 'justice'].find(c => q.devolved[c] == null) || null;
  return new Function('Tk', 'iIa', 'eq', '_pt', 'LJ', 'yIa', 'Gm', 'Lw', 'eKe', 'unr', 'He', 'LRo', 'TLe', 'nPt', 'WJ', 'jf', `${src}; return BD;`)(
    (A, id) => A.q, ['respond_petition', 'promise'], [], 30, HV, () => ({}), () => 0.5, x => ({ ...x }), () => {}, () => 'S', () => true, () => ({}), () => 1, () => [], () => true, x => x);
};
const P10 = km(patched), V10 = km(original);
const sim10 = (kindId, devolved) => ({ day: 10, countries: new Map([['S', {}]]), q: { id: 'q', sovereignKeys: ['S'], devolved, petition: { kindId, sovereignKey: 'S' }, promises: [], lastVerbDay: {} } });
const all = { fiscal: 1, justice: 1 };
const reply = (f, s, decisionId) => f(s, 'S', 'q', 'respond_petition', { decisionId });
check(reply(P10, sim10('referendum', all), 'counter').reasonId === 'nothing_to_promise', 'Y10 patched: nothing left to offer: counter refused');
check(reply(V10, sim10('referendum', all), 'counter').ok === true, 'Y10 original: counter accepted with nothing to offer (the bug)');
check(reply(P10, sim10('referendum', { fiscal: 1 }), 'counter').ok === true, 'Y10: a power left to offer: counter allowed');
check(reply(P10, sim10('referendum', all), 'accept').ok === true && reply(P10, sim10('referendum', all), 'refuse').ok === true, 'Y10: accept and refuse stay open, so the AI always has a choice');
check(reply(P10, sim10('autonomy', all), 'counter').ok === true, 'Y10: other petition kinds unchanged');
check(reply(P10, sim10('referendum', all), 'other').reasonId === 'decision', 'Y10: a bad decision is still refused first');
const app = readFileSync(bundlePath(build, 'simulation-worker.bundle.js').replace('simulation-worker', 'app'), 'utf8');
check(app.includes('regional.reason.nothing_to_promise'), 'Y10: the player has text for this reason');
check(/let p=BD\(e,t\.key,a\.id,u,d\);if\(!p\.ok\)continue;/.test(patched), 'Y10: the AI skips a refused choice');

console.log(failures ? `${failures} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
