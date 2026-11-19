// NP1 function test: runs the real snap legislative election (Oee, with the game's cooldown xfo and P3's guards) from
// the patched and the original bundle, on the P3 test's harness (the game's own calendar and constants, stubs for the
// election itself). Checks that the player's snap election is exempt from the 1.1.3 dissolution cooldown once the same
// caretaker government has lasted 60 days on P3's watch (the AI's deadlock rule), and not before; that the refusal
// notice gives the day the exemption opens; that formed governments, other causes and AI countries keep the cooldown;
// and that the no-confidence notice no longer claims an election the cooldown refuses.
// Usage: node mods/geoplanetical-balance/tests/np1.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const slice = (text, from, to) => {
  const a = text.indexOf(from), b = text.indexOf(to, a + 1);
  if (a < 0 || b < 0 || b - a > 20000) throw new Error(`cannot slice ${from} .. ${to}`);
  return text.slice(a, b);
};
for (const t of ['var o1=Date.UTC(2026,0,1),', 'var Cj=864e5,', 'kj=e=>Math.max(0,Math.trunc(Number(e)||0));function J1(']) {
  if (!original.includes(t)) throw new Error(`calendar constant changed: ${t}`);
}
// The game's calendar and constants, from the bundle (identical in both texts).
const game = text => 'const o1=Date.UTC(2026,0,1),Cj=864e5,kj=e=>Math.max(0,Math.trunc(Number(e)||0));' +
  `${slice(text, 'function J1(', 'function fr(')}${slice(text, 'function fr(', 'function ')}` +
  `${slice(text, 'function hI(', 'function ')}${slice(text, 'function p1(', 'function ')}` +
  `${slice(text, 'var wWo=', 'function kWo(')}${text.includes('function __geobalMonthsRaw(') ? slice(text, 'function __geobalMonthsRaw(', 'function AWo(') : ''}${slice(text, 'function AWo(', 'function RWo(')}`;
const stubsDecl = 'const {gB:st,yw:xn,IS:xee,RIQ:EGa,D1:I0,al:rk,uJ:vO,z:H,W7:yw,tS:gF}=stubs;';
const load = text => new Function('stubs', `${stubsDecl}${game(text)}${slice(text, 'function KGa(', 'function Oee(')}${slice(text, 'function Oee(', 'function xGa(')}` +
  'return {snap:Oee,Fg:fr,T1C:AWo,o5:hI};')(stubs);

const events = [];
let frozen = false;
const stubs = {
  gB: B => B?.pol?.institutionState || null,
  yw: B => B?.pol?.institutionState?.government || null,
  IS: () => frozen,
  RIQ: (A, B, kind) => events.push({ type: 'politics.snap_election_rejected', payload: { reason: 'reform_freeze', kind } }),
  D1: () => false,
  al: () => {},
  uJ: () => ({ shares: {} }),
  z: (A, type, payload) => events.push({ type, payload }),
  W7: (A, B, Q) => Math.max(B, Math.min(Q, A)),
  tS: (s = 'info') => ({ category: 'politique', severity: s }),
};
const P = load(patched), O = load(original);
const { Fg, T1C } = P;

let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

// A player country with a 5-year chamber "lower" and the dissolve power; the chamber's contest has nextDay.
const world = ({ day = 0, nextDay, status = 'formed', termYears = 5, chamber = {}, contest = true, player = true, watch } = {}) => {
  const ch = { id: 'lower', termYears, composition: { A: 200, B: 150 }, seats: 350, ...chamber };
  const contests = contest ? { 'election:chamber:lower': { type: 'chamber', targetOrganId: 'chamber:lower', nextDay } } : {};
  const B = { key: '826', approval: 50, pol: { chambers: [ch], constitution: { powers: [{ power: 'dissolve', holder: 'head_of_state', target: 'chamber:lower', cooldownDays: 365 }] },
    institutionState: { contests, government: { id: 'g1', status } } } };
  if (watch !== undefined) B.geobalCaretakerWatch = watch;
  const A = {
    day, playerKey: player ? '826' : 'XXX', player: B,
    _pendingReformCandidate: () => null,
    _preflightLegislativeElection: () => ({ ok: true, composition: { A: 180, B: 170 } }),
    _applyPendingReform: () => true,
    _electChamber: () => {},
    _electoralMap: () => ({}),
    // The game schedules the next election one term after the snap vote (nextElectionDay t).
    _onLegislative: (Bc, r, e, t) => {
      const c = Bc.pol.institutionState.contests['election:chamber:lower'];
      if (c) c.nextDay = t;
      return { ok: true };
    },
  };
  return { A, B };
};
const run = (impl, w, cause) => { events.length = 0; return impl.snap(w.A, w.B, cause ? { cause } : undefined); };
const last = () => events[events.length - 1];
// nextDay for a chamber elected `ageDays` before `day`: one 60-month term after that election, the way the game
// schedules it (Fg). Elections before day 0 cannot be built with Fg (it floors at day 0), so they are given directly.
const nextFor = (day, ageDays) => Fg(day - ageDays, 60);

const D = 400;
const cw = (opts, lastDiss = D - 100) => { const w = world({ day: D, nextDay: nextFor(D, 900), ...opts }); w.B.pol._lastDissolutionDay = lastDiss; return w; };
const watch = since => ({ governmentId: 'g1', sinceDay: since });
// Caretaker for 60 days on P3's watch, inside the cooldown (last dissolution 100 days ago, cooldown to day D+265).
{
  const p = cw({ status: 'caretaker', watch: watch(D - 60) }), o = cw({ status: 'caretaker', watch: watch(D - 60) });
  check(run(O, o) === false && last().payload.reason === 'dissolution_cooldown' && last().payload.untilDay === D + 265, 'original: cooldown refuses the caretaker player until the year ends', JSON.stringify(last()));
  check(run(P, p) === true && last().type === 'politics.snap_legislative_called', 'patched: 60 caretaker days, election called despite the cooldown', JSON.stringify(last()));
}
{
  const p = cw({ status: 'caretaker', watch: watch(D - 59) });
  check(run(P, p) === false && last().payload.reason === 'dissolution_cooldown' && last().payload.untilDay === D + 1, 'patched: 59 caretaker days refused; notice gives tomorrow', JSON.stringify(last()));
  const n = cw({ status: 'caretaker' });
  check(run(P, n) === false && last().payload.untilDay === D + 60, 'patched: caretaker not yet seen by a review, notice gives today + 60', JSON.stringify(last()));
  const g0 = cw({ status: 'caretaker', watch: { governmentId: 'g0', sinceDay: D - 300 } });
  check(run(P, g0) === false && last().payload.untilDay === D + 60, 'patched: watch of an earlier government ignored', JSON.stringify(last()));
  const f = cw({ status: 'formed', watch: watch(D - 300) });
  check(run(P, f) === false && last().payload.reason === 'dissolution_cooldown' && last().payload.untilDay === D + 265, 'patched: formed government keeps the cooldown and its date', JSON.stringify(last()));
}
{
  const nc = cw({ status: 'caretaker', watch: watch(D - 60) });
  check(run(P, nc, 'no_confidence') === false, 'patched: cause no_confidence still refused by the cooldown');
  const ai = cw({ status: 'caretaker', watch: watch(D - 60), player: false });
  check(run(P, ai) === false, 'patched: not the player country, cooldown applies');
  const dl = cw({ status: 'caretaker', player: false });
  check(run(P, dl, 'deadlock') === run(O, cw({ status: 'caretaker', player: false }), 'deadlock'), 'patched: AI deadlock dissolution unchanged');
  const over = cw({ status: 'caretaker', watch: watch(D - 60) }, D - 400);
  check(run(P, over) === true && run(O, cw({ status: 'caretaker', watch: watch(D - 60) }, D - 400)) === true, 'cooldown over: allowed in both');
  const fresh = cw({ status: 'caretaker', watch: watch(D - 10) }, D - 400);
  check(run(P, fresh) === false && last().payload.reason === 'formation_pending', "P3's caretaker guard still refuses the first 60 days");
}
// The no-confidence notice: electionCalled is false when the cooldown would refuse the election.
{
  const a = patched.indexOf('electionCalled:g&&!xfo(e,t,"no_confidence")'), anchor = patched.indexOf('`${a.id}:caretaker`');
  check(a > anchor && a - anchor < 1500, 'patched notice expression sits in the no-confidence step');
  const expr = patched.slice(a + 'electionCalled:'.length, patched.indexOf(',governingPartyId:', a));
  const f = new Function('xfo', `return (e,t,g)=>(${expr})`);
  check(f(() => true)({}, {}, true) === false && f(() => false)({}, {}, true) === true && f(() => false)({}, {}, false) === false, 'electionCalled = intent and not refused by the cooldown');
  check(original.includes('electionCalled:g,governingPartyId:'), 'original reports the intent only');
}
console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
