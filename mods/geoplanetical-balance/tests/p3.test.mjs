// P3 function test: slices the snap legislative election (aS) out of the patched and the original bundle and runs it
// with the game's own calendar (Fg, Z6, Ts, mb), term length (o5), dissolve-power lookup (uE), the AI's guard
// constants (y1C, K1C, b1C) and the AI's mandate reader (T1C), plus stubs for the election itself. Checks the player's
// mandate, term-end and caretaker guards at their day boundaries, that other causes and the original's own refusals are
// unchanged, and that T1C clamps pre-game elections to day 0 (why the patch reads the contest's real dates). The
// caretaker rule counts time in caretaker status from the monthly watch; the watch the patch keeps for the player's
// country is checked against the AI's own (YJQ) over the same sequence of states.
// Minified names are those of build 26318758. Usage: node mods/geoplanetical-balance/tests/p3.test.mjs
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
for (const t of ['var YE=Date.UTC(2026,0,1),', 'var cz=864e5,', 'iz=A=>Math.max(0,Math.trunc(Number(A)||0));function f0(']) {
  if (!original.includes(t)) throw new Error(`calendar constant changed: ${t}`);
}
// The game's calendar and constants, from the bundle (identical in both texts).
const game = text => 'const YE=Date.UTC(2026,0,1),cz=864e5,iz=A=>Math.max(0,Math.trunc(Number(A)||0));' +
  `${slice(text, 'function f0(', 'function sg(')}${slice(text, 'function sg(', 'function ')}` +
  `${slice(text, 'function AM(', 'function ')}${slice(text, 'function N6(', 'function ')}` +
  `${slice(text, 'var j8C=', 'function W8C(')}${slice(text, 'function V8C(', 'function Z8C(')}`;
const stubsDecl = 'const {gB:eB,yw:Xe,IS:pW,RIQ:m7Q,D1:m1,al:Ck,uJ:gb,z:N,W7:K5,tS:LW}=stubs;';
const load = text => new Function('stubs', `${stubsDecl}${game(text)}${slice(text, 'function JW(', 'function Y7Q(')}` +
  'return {snap:JW,Fg:sg,T1C:V8C,o5:AM};')(stubs);

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

// 1. T1C (the AI's reader) clamps pre-game elections to day 0: an election 18 months before the start reads as day 0.
{
  const next = Fg(0, 42); // last election July 2024, next one July 2029
  const B = world({ nextDay: next }).B;
  check(T1C(B, B.pol.chambers[0]) === 0, 'V8C reads a pre-game election as day 0 (clamp)', `${T1C(B, B.pol.chambers[0])}`);
  check(Fg(0, 60) - next > 500, 'the patch reads its real age (over 500 days at day 0)', `${Fg(0, 60) - next}`);
}

// 2. Day 0, mandate 18 months old, next election 3.5 years away: allowed (the AI's clamped reading would refuse).
{
  const w = world({ nextDay: Fg(0, 42) });
  check(run(P, w) === true && w.B.approval === 47 && last().type === 'politics.snap_legislative_called', 'old mandate: snap election called, -3 approval');
  // Right after: the chamber was elected today, so a second call is refused (recent_mandate), approval unchanged.
  check(run(P, w) === false && w.B.approval === 47, 'second call the same day refused, approval unchanged');
  check(last()?.type === 'politics.snap_election_rejected' && last().payload.reason === 'recent_mandate' && last().payload.targetOrganId === 'chamber:lower', 'refusal notice with reason recent_mandate', JSON.stringify(last()));
  const o = world({ nextDay: Fg(0, 42) });
  check(run(O, o) === true && run(O, o) === true && run(O, o) === true && o.B.approval === 41, 'original: three snap elections in one day (the exploit)');
}

// 3. Mandate boundary: refused at 364 days since the last election, allowed at 365 (next election far away).
for (const day of [400, 1000]) {
  const w364 = world({ day, nextDay: nextFor(day, 364) });
  check(run(P, w364) === false && last().payload.reason === 'recent_mandate', `day ${day}: 364 days after the election refused`);
  const w365 = world({ day, nextDay: nextFor(day, 365) });
  check(run(P, w365) === true, `day ${day}: 365 days after the election allowed`);
  check(run(O, world({ day, nextDay: nextFor(day, 364) })) === true, `day ${day}: original allows at 364`);
}

// 4. Term end: refused 179 days before the scheduled election, allowed at 180 (mandate old).
for (const day of [0, 700]) {
  check(run(P, world({ day, nextDay: day + 179 })) === false && last().payload.reason === 'term_ending', `day ${day}: 179 days before the election refused (term_ending)`);
  check(run(P, world({ day, nextDay: day + 180 })) === true, `day ${day}: 180 days before allowed`);
  check(run(P, world({ day, nextDay: day })) === false && last().payload.reason === 'term_ending', `day ${day}: election due today refused`);
}

// 5. Caretaker government: judged on time in caretaker status (the watch), 60 days, whatever the mandate or term (the
// AI's deadlock rule in j1C). The election's age does not matter.
{
  const day = 500;
  const watch = since => ({ governmentId: 'g1', sinceDay: since });
  // The review case: the government fell 100 days after its election; it became caretaker today (the watch just saw it).
  check(run(P, world({ day, status: 'caretaker', nextDay: nextFor(day, 100), watch: watch(day) })) === false && last().payload.reason === 'formation_pending', 'fresh collapse 100 days after the election refused (formation_pending, 0 caretaker days)');
  check(run(P, world({ day, status: 'caretaker', nextDay: nextFor(day, 100) })) === false && last().payload.reason === 'formation_pending', 'caretaker not yet seen by a monthly review: 0 days, refused');
  check(run(P, world({ day, status: 'caretaker', nextDay: nextFor(day, 900), watch: watch(day - 59) })) === false && last().payload.reason === 'formation_pending', 'old mandate, 59 caretaker days: refused');
  check(run(P, world({ day, status: 'caretaker', nextDay: nextFor(day, 100), watch: watch(day - 60) })) === true, '60 caretaker days: allowed despite a 100-day-old mandate');
  check(run(P, world({ day, status: 'caretaker', nextDay: day + 10, watch: watch(day - 70) })) === true, '70 caretaker days near the term end: allowed');
  check(run(P, world({ day, status: 'caretaker', nextDay: nextFor(day, 900), watch: { governmentId: 'g0', sinceDay: day - 300 } })) === false && last().payload.reason === 'formation_pending', 'watch of an earlier government ignored (0 days)');
  check(run(P, world({ day, status: 'caretaker', contest: false, watch: watch(day - 10) })) === false && last().payload.reason === 'formation_pending', 'caretaker check applies without a chamber contest (as _8C)');
  check(run(P, world({ day, status: 'caretaker', nextDay: nextFor(day, 100), watch: { governmentId: 'g1', sinceDay: 'x' } })) === false, 'malformed watch day counts as today (rm), refused');
  // A formed government ignores any stale watch: the mandate rule decides.
  check(run(P, world({ day, nextDay: nextFor(day, 900), watch: watch(day - 300) })) === true, 'formed government, old mandate: allowed');
  check(run(P, world({ day, nextDay: nextFor(day, 100), watch: watch(day - 300) })) === false && last().payload.reason === 'recent_mandate', 'formed government, stale watch, 100-day mandate: recent_mandate');
  check(run(O, world({ day, status: 'caretaker', nextDay: nextFor(day, 100), watch: watch(day) })) === true, 'original: fresh caretaker dissolves at once');
  // A successful player dissolution clears the watch (as YJQ after an AI dissolution): a hung result that leaves the same
  // government caretaker cannot be dissolved again on the old clock. A refused call keeps it; AI causes never touch it.
  {
    const w = world({ day, status: 'caretaker', nextDay: nextFor(day, 100), watch: watch(day - 60) });
    check(P.snap(w.A, w.B) === true && !('geobalCaretakerWatch' in w.B), 'allowed dissolution clears the watch');
    w.A.day = day + 1;
    check(P.snap(w.A, w.B) === false && last().payload.reason === 'formation_pending', 'still caretaker the next day: refused (0 days until the next review)');
    const r = world({ day, status: 'caretaker', nextDay: nextFor(day, 100), watch: watch(day - 10) });
    P.snap(r.A, r.B);
    check(r.B.geobalCaretakerWatch?.sinceDay === day - 10, 'refused dissolution keeps the watch');
    for (const cause of ['deadlock', 'no_confidence']) {
      const ai = world({ day, status: 'caretaker', nextDay: nextFor(day, 100), watch: watch(day - 10) });
      check(P.snap(ai.A, ai.B, { cause }) === true && ai.B.geobalCaretakerWatch?.sinceDay === day - 10, `cause ${cause}: dissolves as in the original, watch untouched`);
    }
  }
}

// 5b. The monthly watch for the player's country matches the AI's (YJQ) record over the same states, and the agenda
// loop still skips the player's country while running AI countries.
{
  const loopText = slice(patched, 'for(let i of B)!E.has(i.key)||(', '(a||={fiscal:');
  const watchExpr = loopText.slice('for(let i of B)!E.has(i.key)||'.length, loopText.lastIndexOf('||A.playerControlsGovernment(i)||'));
  const tick = new Function('Xe', 'vm', `return (A,i)=>${watchExpr};`)(stubs.yw, v => (Number.isFinite(Number(v)) ? Number(v) : 0));
  const yjq = new Function('Xe', 'vm', '_8C', `${slice(original, 'function SSQ(', 'function ')}return SSQ;`)(
    stubs.yw, (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d), () => ({ dissolve: false }));
  const country = () => ({ key: 'P', brain: {}, pol: { institutionState: { government: { id: 'g1', status: 'installed' } } } });
  const mine = country(), ai = country();
  const steps = [[7, 'installed', 'g1'], [14, 'caretaker', 'g1'], [21, 'caretaker', 'g1'], [28, 'caretaker', 'g2'], [35, 'installed', 'g2'], [42, 'caretaker', 'g2'], [49, 'caretaker', 'g2']];
  let same = true;
  for (const [day, status, gid] of steps) {
    for (const c of [mine, ai]) c.pol.institutionState.government = { id: gid, status };
    tick({ day, playerControlsGovernment: () => true }, mine);
    yjq({ day, playerKey: 'X' }, ai);
    const a = JSON.stringify(mine.geobalCaretakerWatch ?? null), b = JSON.stringify(ai.brain.memory.caretakerWatch ?? null);
    if (a !== b) { same = false; console.log(`  day ${day}: player ${a} vs AI ${b}`); }
  }
  check(same, 'player watch equals the AI watch at every monthly review (start, keep, new government, clear)');
  check(JSON.stringify(mine.geobalCaretakerWatch) === JSON.stringify({ governmentId: 'g2', sinceDay: 42 }), 'watch after the sequence', JSON.stringify(mine.geobalCaretakerWatch));
  const aiCountry = country();
  aiCountry.pol.institutionState.government.status = 'caretaker';
  check(!tick({ day: 3, playerControlsGovernment: () => false }, aiCountry) && !('geobalCaretakerWatch' in aiCountry), 'AI country: no player watch, falls through to its agenda');
  check(patched.includes('(Xe(i)):0)||A.playerControlsGovernment(i)||(a||={fiscal:'), 'loop still skips the player country after the watch');
}

// 6. Other causes are untouched: no-confidence, deadlock and opportunity dissolve as before with a fresh mandate.
for (const cause of ['no_confidence', 'deadlock', 'opportunity']) {
  const w = world({ day: 400, nextDay: nextFor(400, 10) });
  check(run(P, w, cause) === true && last().payload.cause === cause, `cause ${cause}: not guarded`);
}

// 7. No contest or no scheduled day: as the original (no guard).
check(run(P, world({ contest: false })) === true, 'no chamber contest: allowed as before');
for (const bad of [undefined, null, NaN, 'x']) check(run(P, world({ nextDay: bad })) === true, `contest nextDay ${String(bad)}: allowed as before`);

// 8. The original's own refusals are unchanged: no dissolve power, reform freeze (before the new guards).
{
  const w = world({ nextDay: Fg(0, 42) });
  w.B.pol.constitution.powers = [];
  check(run(P, w) === false && events.length === 0, 'no dissolve power: refused silently as before');
  frozen = true;
  const f = world({ day: 400, nextDay: nextFor(400, 10) });
  check(run(P, f) === false && last().payload.reason === 'reform_freeze' && events.length === 1, 'reform freeze: the original refusal comes first');
  frozen = false;
}
// A refusal for a country that is not the player's sends no notice (as the game's other refusals in aS).
check(run(P, world({ player: false, day: 400, nextDay: nextFor(400, 10) })) === false && events.length === 0, 'non-player country: refused without a notice');

// 9. Partial renewal: the term is the renewal cycle (o5), so the last renewal is one cycle before the next.
{
  const chamber = { renew: 'partial', renewCycle: 3, termYears: 6 };
  const day = 900;
  check(P.o5({ ...chamber }) === 36, 'partial renewal cycle is 36 months');
  check(run(P, world({ day, chamber, nextDay: Fg(day - 300, 36) })) === false && last().payload.reason === 'recent_mandate', 'partial renewal 300 days ago refused');
  check(run(P, world({ day, chamber, nextDay: Fg(day - 400, 36) })) === true, 'partial renewal 400 days ago allowed');
}

// 10. Same inputs, same result, original and patched agree when no guard applies.
{
  const a = world({ nextDay: Fg(0, 42) }), b = world({ nextDay: Fg(0, 42) });
  run(P, a); const ea = JSON.stringify(events);
  run(O, b); const eb = JSON.stringify(events);
  check(JSON.stringify(a.B) === JSON.stringify(b.B) && ea === eb, 'allowed call: same state and events as the original');
}

console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
