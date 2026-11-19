// Probe for NP1 (patch np1-caretaker-deadlock), which a normal headless run never reaches: the player's caretaker
// government inside the 1.1.3 dissolution cooldown. Run by headless/prototype/probe-edits.mjs in one booted world
// (day 0, seed 12345, player 756); `code` is an async function body evaluated in the simulation bundle's scope (game
// functions by their 26734764 names, Ogr.sim = the world). The probe puts the player's government in caretaker status,
// sets the last dissolution 100 days ago (cooldown open until day +265) and P3's caretaker watch, then calls the
// player's snap legislative election (Oee, cause "player", the callSnapElection path). Negative control: with NP1
// removed the 60-day call is refused by the cooldown. Test tooling only; never shipped.

export const probes = [
  {
    id: 'np1-caretaker-60-days',
    edits: ['np1-caretaker-deadlock#1', 'np1-caretaker-deadlock#2'],
    code: String.raw`
const e = Ogr.sim, t = e.countries.get(e.playerKey);
if (!t?.pol || !st(t)?.government) return { skipped: 'no player government' };
const inst = st(t), gov = inst.government, day = VD(e.day);
const power = p1(t, 'dissolve');
check(!!power?.target?.startsWith('chamber:') && Number(power.cooldownDays) > 0, 'player constitution has the dissolve power with a cooldown', JSON.stringify(power));
inst.government = { ...gov, status: 'caretaker' };
check(xn(t)?.status === 'caretaker', 'player government set to caretaker', xn(t)?.status);
t.pol._lastDissolutionDay = day - 100;
const until = KGa(t);
check(until === day - 100 + Number(power.cooldownDays), 'cooldown open (KGa)', String(until));
// 59 caretaker days: refused by the cooldown (P3's guard would also refuse), and nothing dissolved.
t.geobalCaretakerWatch = { governmentId: String(gov.id), sinceDay: day - 59 };
const lastBefore = t.pol._lastDissolutionDay;
const r59 = Oee(e, t);
check(r59 === false && t.pol._lastDissolutionDay === lastBefore, '59 caretaker days: snap election refused', String(r59));
// The helper exists only with NP1; the decisive checks below use the game's own Oee and xfo.
const opens = typeof __geobalCaretakerOpens === 'function' ? __geobalCaretakerOpens(e, t) : null;
check(opens === day + 1, 'exemption opens tomorrow', String(opens));
// 60 caretaker days: the cooldown is waived for the player (the AI's deadlock rule) and P3's guard passes.
t.geobalCaretakerWatch = { governmentId: String(gov.id), sinceDay: day - 60 };
check(xfo(e, t, 'player') === false && xfo(e, t, 'no_confidence') === true, 'xfo: player exempt, no_confidence not');
const r60 = Oee(e, t);
check(r60 === true && t.pol._lastDissolutionDay === day, '60 caretaker days: snap election called', JSON.stringify({ r60, last: t.pol._lastDissolutionDay }));
return { day, until, r59, r60 };
`,
  },
];
