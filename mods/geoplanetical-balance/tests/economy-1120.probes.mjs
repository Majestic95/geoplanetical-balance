// Probes for the 2026-11-20 economy batch: edits a normal headless run never reaches (IO8: the player leaves a
// coalition they lead; N13: a sender's leverage lapses) and the day-0 record EN10 reads. Run by
// headless/prototype/probe-edits.mjs in one booted world (day 0, seed 12345, player 756):
//   node --max-old-space-size=6000 headless/prototype/probe-edits.mjs mods/geoplanetical-balance/tests/economy-1120.probes.mjs
// Each `code` is an async function body evaluated in the simulation bundle's scope (26734764 names; Ogr.sim = the
// world). Every probe builds its precondition from real world objects through the game's own sanction command (Oc) and
// the game's own monthly step (oLe), touches only the countries it picks, and restores the one field it changes. After
// each sanctions change the probe runs the game's save validator (j1e, as the load path dYo calls it) on a JSON copy of
// the live sanctions, so the changed state must load. Negative control: each probe fails on behaviour with its patch
// removed from mod.json. Test tooling only; never shipped.

// Picks AI countries with diplomacy powers, in key order, excluding the player and the given keys; save validator.
const PICK = String.raw`
const e = Ogr.sim;
const ai = (skip = []) => [...e.countries.values()].filter(c => c.key !== e.playerKey && !skip.includes(c.key) && He(c, 'diplomacy') && k1(e, c.key))
  .sort((a, b) => K(a.key, b.key));
const loads = () => { try { j1e(JSON.parse(JSON.stringify(e.sanctions)), new Set(e.countries.keys()), { identityKeys: [...e.countries.keys()], currentDay: e.day }); return null; } catch (x) { return String(x.message || x); } };
`;

export const probes = [
  {
    id: 'io8-coalition-survives-leader',
    edits: ['io8-coalition-survives-leader#1'],
    code: PICK + String.raw`
const player = e.countries.get(e.playerKey);
const [T, A, B] = ai();
const opts = { causeId: 'manual_coalition', objectiveId: 'punitive', sourceTypeId: 'coalition', sourceId: 'geobal-probe-io8', initiatorKey: e.playerKey, deferRecompute: true };
const ok = [player, A, B].map(c => Oc(e, c.key, T.key, ['trade_arms'], { ...opts }));
const r = (e.sanctions || []).find(s => s.sourceId === 'geobal-probe-io8');
check(ok.every(Boolean) && r && r.participants.length === 3 && r.sourceTypeId === 'coalition' && r.initiatorKey === e.playerKey,
  'coalition of the player and two AI members created through Oc', { ok, participants: r?.participants.map(p => p.countryKey) });
R1(e, e.playerKey, T.key, { regimeId: r.id });
Zg(e);
check(r.statusId === 'active' && r.participants.map(p => p.countryKey).sort().join() === [A.key, B.key].sort().join(),
  'after the leader leaves, the regime stays active with the two remaining members', { status: r.statusId, participants: r.participants.map(p => p.countryKey) });
const bad = loads();
check(bad === null, 'the save validator accepts a coalition whose leader left', bad);
R1(e, A.key, T.key, { regimeId: r.id }); R1(e, B.key, T.key, { regimeId: r.id });
check(r.statusId === 'ended', 'cleanup: the regime ends when its last member leaves', r.statusId);
return { target: T.key, members: [A.key, B.key], regime: r.id };
`,
  },
  {
    id: 'n13-leverage-lapse',
    edits: ['n13-sanction-leverage-recheck#1', 'n13-sanction-leverage-recheck#2'],
    code: PICK + String.raw`
// Day-0 data for the open decision on seeded regimes: seeded tools that would fail the game's leverage test.
const W = SQ(e), seeded = {};
let seededTotal = 0, seededFail = 0, recorded = 0, presets = 0;
for (const s of e.sanctions || []) if (s.preset && (s.statusId || 'active') === 'active') {
  presets++; if (s.__geobalSeed) recorded++;
  for (const p of s.participants || []) {
    const c = e.countries.get(p.countryKey); if (!c) continue;
    for (const i of p.instrumentIds || []) { seededTotal++; if (!F1e(e, c, i, W)) { seededFail++; seeded[i] = (seeded[i] || 0) + 1; } }
  }
}
check(presets > 0 && recorded === presets, 'every seeded regime carries the setup record of its seeded tools', { presets, recorded });
// (1) A new regime: an equity ban from a qualifying AI sender against a fresh AI target, then the sender's economic weight
// falls below the bar and the game's monthly AI sanctions step runs.
const cand = ai().filter(c => F1e(e, c, 'fin_equityban', null));
const A = cand[0], T = ai([A?.key]).find(c => !(e.sanctions || []).some(s => s.targetKey === c.key && s.participants?.some(p => p.countryKey === A?.key)));
check(!!A && !!T, 'found an equity-ban sender and a fresh target', { A: A?.key, T: T?.key });
const made = Oc(e, A.key, T.key, ['fin_equityban', 'trade_arms'], { causeId: 'manual', sourceId: 'geobal-probe-n13', deferRecompute: true });
const r = (e.sanctions || []).find(s => s.sourceId === 'geobal-probe-n13');
const part = r?.participants.find(p => p.countryKey === A.key);
check(made && part && part.instrumentIds.join() === 'fin_equityban,trade_arms', 'sanction with an equity ban created through Oc', part?.instrumentIds);
// (2) A seeded regime: the same sender adds an equity ban to a seeded regime it is not in (joining through Oc's own
// match on cause and source), so the added tool must be re-checked while the seeded tools stay.
const P = (e.sanctions || []).find(s => s.preset && (s.statusId || 'active') === 'active' && s.__geobalSeed && s.targetKey !== A.key && !s.participants.some(p => p.countryKey === A.key)
  && e.sanctions.find(x => Peo(x, s.targetKey, { causeId: s.causeId, sourceTypeId: s.sourceTypeId, sourceId: s.sourceId })) === s);
const joined = P ? Oc(e, A.key, P.targetKey, ['fin_equityban'], { causeId: P.causeId, objectiveId: P.objectiveId, sourceTypeId: P.sourceTypeId, sourceId: P.sourceId, deferRecompute: true }) : false;
const seededBefore = P ? P.participants.filter(p => p.countryKey !== A.key).map(p => p.countryKey + ':' + p.instrumentIds.join('+')).join() : null;
check(!!joined && !!P?.participants.some(p => p.countryKey === A.key), 'sender joined a seeded regime with an equity ban', { regime: P?.id, joined });
const had = Object.hasOwn(A, 'gdpVol'), gv = A.gdpVol;
A.gdpVol = 0.001 * SQ(e);
try { oLe(e); } finally { if (had) A.gdpVol = gv; else delete A.gdpVol; }
check(part.instrumentIds.join() === 'trade_arms' && r.statusId === 'active', 'monthly step: lapsed equity ban dropped from the new regime, arms embargo kept', part.instrumentIds);
check(!!P && !P.participants.some(p => p.countryKey === A.key), 'monthly step: the tool added to the seeded regime lapsed (the sender, with no tool left, left it)', P?.participants.map(p => p.countryKey));
const seededAfter = P ? P.participants.filter(p => p.countryKey !== A.key).map(p => p.countryKey + ':' + p.instrumentIds.join('+')).join() : null;
check(!!P && seededAfter === seededBefore, 'the seeded participants and tools are untouched', { before: seededBefore, after: seededAfter });
const bad = loads();
check(bad === null, 'the save validator accepts the state after the lapse', bad);
R1(e, A.key, T.key, { regimeId: r.id });
if (P && P.participants.some(p => p.countryKey === A.key)) R1(e, A.key, P.targetKey, { regimeId: P.id });
check(r.statusId === 'ended', 'cleanup: probe regime ended');
return { sender: A.key, target: T.key, seededRegime: P?.id, presets, seededTotal, seededFail, seededFailByInstrument: seeded };
`,
  },
  {
    id: 'en10-settled-margin-recorded',
    edits: [],
    code: String.raw`
const e = Ogr.sim;
let n = 0, rec = 0, same = 0, neg = 0;
const sample = {};
for (const c of e.countries.values()) {
  const b = c.energy?.serviceDeliveryBaseline; if (!b) continue; n++;
  const m0 = b.__geobalMarginPct0; if (!Number.isFinite(m0)) continue; rec++;
  if (Math.abs(m0 - Number(c.energy.marginPct)) < 1e-9) same++;
  if (m0 < 0) neg++;
  if (['120', '004', '710', '566'].includes(c.key)) sample[c.key] = { settled: m0, configured: c.energy.initialMarginPct, gate: npt(c) };
}
check(n > 100 && rec === n, 'every country with a service baseline records its settled day-0 margin', { n, rec });
check(same === rec, 'at day 0 the record equals the live margin', { same, rec });
return { n, rec, negativeSettled: neg, sample };
`,
  },
];
