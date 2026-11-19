// P20 function test: the player's snap presidential election (xGa) is refused within 365 days of the mandate's start
// or 180 days of the scheduled election, as P3 does for the legislature; allowed in between. The start is the office's
// own mandate record when it was filled during play (so a term extension cannot shorten the guard), else the scheduled
// day minus one term with P16's raw month arithmetic (pre-game mandates, leap years as the calendar has them); an
// unscheduled contest (nextDay null) gets no term-end guard. xGa, the game's calendar (J1, fr, i7), Bhe and P16's
// __geobalMonthsRaw are sliced from the balance mod built without and with this patch; st, Ve, H and the rest are stubbed.
// Usage: node mods/geoplanetical-balance/tests/p20.test.mjs (from the repo root)
import { workspaceBuild, buildAll, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

// The balance mod built with and without this patch (approved from the proposals 2026-11-18).
const ID = 'p20-snap-presidential-guards';
const [MOD] = loadMods(MODS_DIR, { only: ['geoplanetical-balance'] });
if (!MOD.patches.some(x => x.id === ID)) throw new Error(`${ID} is not in the balance mod`);
const SIMB = m => buildAll(workspaceBuild(), [m]).get('simulation-worker.bundle.js').text;
const patched = SIMB(MOD), withoutFix = SIMB({ ...MOD, patches: MOD.patches.filter(x => x.id !== ID) });
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

const fn = (text, name, need = true) => {
  const s = text.indexOf(`function ${name}(`);
  if (s < 0) { if (need) throw new Error(`${name}: not found`); return ''; }
  if (text.indexOf(`function ${name}(`, s + 1) >= 0) throw new Error(`${name}: not found once`);
  let depth = 0, q = null;
  for (let i = text.indexOf('){', s) + 1; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(s, i + 1);
  }
  throw new Error(`${name}: unbalanced`);
};
for (const t of ['var o1=Date.UTC(2026,0,1),', 'Cj=864e5', 'kj=e=>Math.max(0,Math.trunc(Number(e)||0));'])
  if (!patched.includes(t)) throw new Error(`calendar constant changed: ${t}`);
// i7 turns a timestamp into a day number, floored at day 0; it is sliced as the game has it.
const PRELUDE = 'const o1=Date.UTC(2026,0,1),Cj=864e5,kj=e=>Math.max(0,Math.trunc(Number(e)||0));';
const load = text => new Function('st', 'Ve', 'xee', 'EGa', 'H', 'gF', 'yw', 'VD', 'IWo', '_Wo',
  `${PRELUDE}${fn(text, 'J1')}${fn(text, 'i7')}${fn(text, 'fr')}${fn(text, 'Bhe')}${fn(text, '__geobalMonthsRaw', false)}${fn(text, 'xGa')};return {xGa, fr};`);
const dayOf = (y, m, d) => (Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 864e5;
const run = (text, { day, nextDay, termYears = 5, startedDay = 0, frozen = false }) => {
  const events = [];
  const api = load(text)(c => c.pol.state, (c, organ) => organ, () => frozen, () => events.push('frozen'),
    (A, id, p) => events.push([id, p.reason ?? null]), x => x, (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
    (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d), 365, 180);
  const contest = { id: 'pres', type: 'office', termYears, nextDay, targetOrganId: 'president' };
  const A = { day, player: { key: 'X', approval: 60, pol: { state: { contests: { pres: contest }, offices: { president: { mandate: { startedDay } } } } } },
    _onPresidential: () => ({ ok: true }) };
  const out = api.xGa(A, 'pres');
  return { out, events, approval: A.player.approval, reason: events[0]?.[1] ?? null };
};
const fr = load(patched)(...Array(10).fill(() => {})).fr;

// 1. A mandate filled during play (office record): elected day 400, 5-year term.
{
  const next = fr(400, 60);
  for (const [day, expect, reason] of [[700, false, 'recent_mandate'], [764, false, 'recent_mandate'], [765, true, null], [1500, true, null], [next - 179, false, 'term_ending'], [next - 180, true, null]]) {
    const p = run(patched, { day, nextDay: next, startedDay: 400 });
    check(p.out === expect && p.reason === reason, `in-play mandate, day ${day}: ${expect ? 'allowed' : reason}`, JSON.stringify(p.events));
    if (!expect) check(p.approval === 60, `day ${day}: no approval cost on refusal`);
    check(run(withoutFix, { day, nextDay: next, startedDay: 400 }).out === true, `day ${day}: without the fix allowed`);
  }
}
// 2. Term extension: elected day 400 on a 4-year term, the term becomes 6 years, the earlier scheduled vote is kept.
{
  const next = fr(400, 48);
  const p = run(patched, { day: 610, nextDay: next, termYears: 6, startedDay: 400 });
  check(p.out === false && p.reason === 'recent_mandate', 'term extension: 210 days after the election still refused (office record)', JSON.stringify(p.events));
  const q = run(patched, { day: 610, nextDay: next, termYears: 6, startedDay: 0 });
  check(q.out === true, 'documented limitation: a seeded mandate with an extended term is read from the term length', JSON.stringify(q.events));
}
// 3. Mandates seeded at game start (startedDay 0): the start is the scheduled day minus one term, not floored at day 0.
{
  check(run(patched, { day: 0, nextDay: 1000 }).out === true && run(patched, { day: 100, nextDay: 1000 }).out === true, 'elected about 800 days before the game: allowed at once');
  check(run(patched, { day: 100, nextDay: fr(0, 60) }).reason === 'recent_mandate', 'a 5-year mandate that began on day 0: refused at day 100');
  // Review case: a 6-year mandate due 1 April 2031 began on 1 April 2025; 31 March 2026 is 364 days later.
  const next = dayOf(2031, 4, 1);
  const a = run(patched, { day: dayOf(2026, 3, 31), nextDay: next, termYears: 6 });
  const b = run(patched, { day: dayOf(2026, 4, 1), nextDay: next, termYears: 6 });
  check(a.out === false && a.reason === 'recent_mandate', 'leap years: 31 March 2026 (364 days) refused', JSON.stringify(a.events));
  check(b.out === true, 'leap years: 1 April 2026 (365 days) allowed', JSON.stringify(b.events));
  check(run(patched, { day: 830, nextDay: 1000 }).reason === 'term_ending', 'pre-game mandate, 170 days before its election: term_ending');
}
// 4. Unscheduled contest and the freeze.
{
  const n = run(patched, { day: 500, nextDay: null });
  check(n.out === true, 'nextDay null: no term-end guard (the old code read it as day 0 and refused)', JSON.stringify(n.events));
  check(run(patched, { day: 500, nextDay: null, startedDay: 300 }).reason === 'recent_mandate', 'nextDay null but filled 200 days ago: recent_mandate');
  check(run(patched, { day: 500, nextDay: undefined }).out === true, 'nextDay missing: no guard');
  const f = run(patched, { day: 1000, nextDay: 1800, frozen: true });
  check(f.out === false && f.events[0] === 'frozen', 'post-reform freeze still checked first');
}

console.log(failures ? `${failures} of ${checks} checks FAILED` : `${checks}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
