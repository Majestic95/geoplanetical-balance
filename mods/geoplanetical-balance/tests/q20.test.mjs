// Q20 function test: the closing collapse statement of the front-by-front war step (i8o) and the patch's helpers are
// taken from both bundles and run with stubbed wars. AI wars collapse side B at support 0 as before; in a player war
// (side A the player) the enemy collapses only after its support has stayed at 0 for 60 days in a row, counted from
// the day it reached 0 (stored per war in the player's sovereign record, cleared when support rises above 0).
// The player's own collapse is unchanged. Negative control: the original never collapses the player's enemy.
// Usage: node mods/geoplanetical-balance/tests/q20.test.mjs (from the repo root)
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
// The statement runs from the player's-collapse test to the end of i8o (the brace after U8t(..."B",()=>{})).
const tail = (text) => {
  const head = 't.support.p<=0?U8t(e,t,a,r,"A",()=>ds(e,t,"front_collapsed",{notif:"bad"})):';
  const s = text.indexOf(head);
  if (s < 0 || text.indexOf(head, s + 1) >= 0) throw new Error('collapse statement not found once');
  return text.slice(s, text.indexOf('()=>{})}', text.indexOf('U8t(e,t,a,r,"B"', s)) + 7);
};
const helpers = (text) => text.includes('function __geobalEnemyCollapse(') ? fnSrc(text, '__geobalWarKey') + fnSrc(text, '__geobalEnemyCollapse') : '';
const load = (text) => new Function('e', 't', 'a', 'r', 'U8t', 'ds', `${helpers(text)}${tail(text)};`);
const P = load(patched), O = load(original);
check(tail(patched) !== tail(original) && !!helpers(patched), 'patch applied');

// One world: the player A at war with B (war w1); the sovereign record persists between steps.
const world = ({ player = true, sovereign = true } = {}) => {
  const war = { id: 'w1', status: 'active', sideAKey: 'A', sideBKey: 'B', startDay: 0, support: { p: 50, e: 0 } };
  const e = { day: 0, playerKey: 'A', playerControlsGovernment: (c) => player && c.key === 'A', wars: new Map([['B', war]]),
    finance: { sovereigns: sovereign ? { A: {} } : {} } };
  const step = (fn, day, se, sp = 50) => {
    e.day = day; war.support.e = se; war.support.p = sp;
    const calls = [];
    fn(e, war, { key: 'A' }, { key: 'B' }, (_e, _t, _a, _r, side) => { calls.push(side); return true; }, () => null);
    return calls.join(',');
  };
  return { e, war, step, rec: () => e.finance.sovereigns.A?.geobalEnemyZero };
};

// Negative control: the original never collapses the player's enemy.
{ const w = world(); check(w.step(O, 0, 0) === '' && w.step(O, 1000, 0) === '', 'original: player enemy at 0 never collapses'); }
{ const w = world({ player: false }); check(w.step(O, 0, 0) === 'B', 'original: AI war collapses B at 0'); }
// AI war unchanged and writes nothing.
{ const w = world({ player: false });
  check(w.step(P, 0, 0) === 'B' && w.step(P, 1, 0.1) === '', 'AI war: B collapses at 0 at once, not above 0');
  check(w.rec() === undefined, 'AI war: no record written'); }
// Player war: 60 days in a row at 0.
{ const w = world();
  check(w.step(P, 100, 0) === '' && w.rec()?.['w1@0'] === 100, 'first day at 0: recorded, no collapse', JSON.stringify(w.rec()));
  check(w.step(P, 159, 0) === '', '59 days at 0: no collapse');
  check(w.step(P, 160, 0) === 'B', '60 days at 0: the enemy collapses');
  check(w.rec()?.['w1@0'] === 100, 'record not moved by later days at 0'); }
// The interrupted spell: 0 on day 0, 75 on day 30, 0 again on day 90: collapse only 60 days after day 90.
{ const w = world();
  w.step(P, 0, 0);
  check(w.step(P, 30, 75) === '' && !Object.hasOwn(w.rec(), 'w1@0'), 'support above 0 clears the record', JSON.stringify(w.rec()));
  check(w.step(P, 90, 0) === '' && w.rec()['w1@0'] === 90, 'back at 0: counted from the new day', JSON.stringify(w.rec()));
  check(w.step(P, 149, 0) === '', '59 days into the second spell: no collapse');
  check(w.step(P, 150, 0) === 'B', '60 days into the second spell: collapse'); }
// A tiny positive support counts as above 0.
{ const w = world(); w.step(P, 0, 0); w.step(P, 30, 1e-9); check(w.step(P, 60, 0) === '' && w.rec()['w1@0'] === 60, 'support 1e-9 restarts the count'); }
// The player's own collapse takes precedence; the record is not touched by that step.
{ const w = world(); w.step(P, 0, 0); check(w.step(P, 500, 0, 0) === 'A' && w.rec()['w1@0'] === 0, 'player front collapse first (unchanged)'); }
// No sovereign record: no collapse, nothing thrown.
{ const w = world({ sovereign: false }); check(w.step(P, 0, 0) === '' && w.step(P, 1000, 0) === '', 'no sovereign record: no collapse'); }
// Records of ended wars are pruned when a new one is written; a junk value is replaced.
{ const w = world(); w.e.finance.sovereigns.A.geobalEnemyZero = { old: 5, 'w1@0': 'x' };
  w.step(P, 10, 0);
  check(JSON.stringify(w.rec()) === '{"w1@0":10}', 'ended war pruned, junk value replaced', JSON.stringify(w.rec())); }
{ const w = world(); w.e.finance.sovereigns.A.geobalEnemyZero = [3];
  w.step(P, 10, 0);
  check(JSON.stringify(w.rec()) === '{"w1@0":10}', 'a non-object record is replaced', JSON.stringify(w.rec())); }
// A later war with the same id (the game reuses player:<enemy>) and a new start day does not inherit an old record.
{ const w = world(); w.e.finance.sovereigns.A.geobalEnemyZero = { 'w1@0': 0 }; w.war.startDay = 400;
  check(w.step(P, 400, 0) === '' && w.rec()['w1@400'] === 400 && !('w1@0' in w.rec()), 'same id, new start day: fresh count, old record pruned', JSON.stringify(w.rec()));
  check(w.step(P, 459, 0) === '' && w.step(P, 460, 0) === 'B', 'same id, new start day: collapse 60 days after its own zero'); }
// Two player wars at zero support with different start days: writing one war's record keeps the other's (both active).
{ const w = world();
  const war2 = { id: 'w2', status: 'active', sideAKey: 'A', sideBKey: 'C', startDay: 50, support: { p: 50, e: 0 } };
  w.e.wars.set('C', war2);
  const step2 = (day) => { w.e.day = day; const calls = []; P(w.e, war2, { key: 'A' }, { key: 'C' }, (_e, _t, _a, _r, side) => { calls.push(side); return true; }, () => null); return calls.join(','); };
  w.step(P, 10, 0);
  check(step2(60) === '' && w.rec()['w1@0'] === 10 && w.rec()['w2@50'] === 60, 'second war recorded, first war record kept', JSON.stringify(w.rec()));
  check(w.step(P, 70, 0) === 'B' && step2(119) === '' && step2(120) === 'B', 'each war collapses 60 days after its own zero', JSON.stringify(w.rec())); }
// A war with no id is keyed by its sides and start day.
{ const w = world(); delete w.war.id; w.step(P, 7, 0); check(w.rec()?.['A>B@0'] === 7, 'war without id keyed by sides and start day', JSON.stringify(w.rec())); }

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
