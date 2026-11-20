// Probes for the 2026-11-20 morning batch (J1, EN5, N13 notice) in one booted world (day 0, seed 12345, player 756):
//   node --max-old-space-size=6000 headless/prototype/probe-edits.mjs mods/geoplanetical-balance/tests/morning-1120.probes.mjs
// Each `code` runs in the simulation bundle's scope (26734764 names; Ogr.sim = the world). Probes restore the fields and budgets
// they change; the N13 probe leaves the test regimes it creates (the booted world is discarded). Negative control: each probe fails with its patch removed from mod.json (the helper it calls is missing, or
// the measured difference is zero). Test tooling only; never shipped.

export const probes = [
  {
    id: 'j1-day0-neutral-and-police-cut',
    edits: ['j1-crime-responds-to-policing#1', 'j1-crime-responds-to-policing#2'],
    code: String.raw`
const e = Ogr.sim;
const cs = [...e.countries.values()].sort((a, b) => K(a.key, b.key));
let n = 0, maxDev = 0, worst = null, prisonOff = 0, policeOff = 0;
for (const c of cs) {
  const t = MG(c); if (!t?.seed) continue; n++;
  const u = Uot(c, t);
  if (Math.abs(u.police - 1) > 1e-9) policeOff++;
  const pr = (t.prisons.convictedPer100k + t.prisons.pretrialPer100k) / (t.seed.convictedPer100k + t.seed.pretrialPer100k);
  if (Math.abs(pr - 1) > 1e-9) prisonOff++;
  for (const f of vg) { const d = Math.abs(__geobalDeterrence(f, u.police, t, t.seed) - 1); if (d > maxDev) { maxDev = d; worst = { key: c.key, f, police: u.police, prison: pr }; } }
}
check(n > 150 && maxDev < 1e-9, 'day 0: the deterrence factor is exactly 1 in every country', { countries: n, maxDev, worst, policeOff, prisonOff });
// One monthly crime step with and without a zero police operating budget, from the same state.
const c = cs.find(x => MG(x)?.seed && x.employment?.public?.internalSecurity?.nonPayroll0Bn > 1e-6 && x.key !== e.playerKey);
const t = MG(c), snap = JSON.stringify(t), ips = c.employment.public.internalSecurity, np = ips.nonPayrollBn;
const restore = () => { const s = JSON.parse(snap); for (const k of Object.keys(s)) t[k] = s[k]; };
const v0 = t.crime.families.violent.latentAnnualPer100k, p0 = t.crime.families.property.latentAnnualPer100k;
nLr(c, t); const dvBase = t.crime.families.violent.latentAnnualPer100k - v0, dpBase = t.crime.families.property.latentAnnualPer100k - p0; restore();
ips.nonPayrollBn = 0;
let police = null;
try { police = Uot(c, t).police; nLr(c, t); } finally { ips.nonPayrollBn = np; }
const dvCut = t.crime.families.violent.latentAnnualPer100k - v0, dpCut = t.crime.families.property.latentAnnualPer100k - p0; restore();
const expV = 0.055 * v0 * (Math.pow(police, -0.5) - 1), expP = 0.055 * p0 * (Math.pow(police, -0.25) - 1);
check(police > 0.6 && police < 0.8, 'zero police operations leave capacity near 0.71 (J2 floor)', police);
check(Math.abs((dvCut - dvBase) - expV) < 0.02 * Math.abs(expV) + 1e-6 && expV > 0, 'violent crime target rises by capacity^-0.5 in one monthly step', { country: c.key, v0, dvBase, dvCut, expV });
check(Math.abs((dpCut - dpBase) - expP) < 0.02 * Math.abs(expP) + 1e-6 && expP > 0, 'property crime target rises by capacity^-0.25', { p0, dpBase, dpCut, expP });
return { country: c.key, police, violentRise: dvCut - dvBase, propertyRise: dpCut - dpBase };
`,
  },
  {
    id: 'en5-day0-need-and-depleted-field',
    edits: ['en5-ai-sustaining-wells#1', 'en5-ai-sustaining-wells#2', 'en5-ai-sustaining-wells#3', 'en5-ai-sustaining-wells#4'],
    code: String.raw`
const e = Ogr.sim;
const ai = [...e.countries.values()].filter(c => c.key !== e.playerKey && c.provs).sort((a, b) => K(a.key, b.key));
const rows = []; let bad = 0;
for (const c of ai) for (const s of ['oil', 'gas']) {
  const v = __geobalWellDecline(e, c, s), prod = Dd(c.we?.prod?.[Jt(s)]);
  if (!Number.isFinite(v) || v < 0) bad++;
  if (v > 0) rows.push({ key: c.key, s, need: v, prod, share: prod > 0 ? v / prod : null });
}
rows.sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
check(bad === 0, 'day 0: the sustaining need is finite and non-negative everywhere (no project field is ramping at the start; later a ramping field makes it negative by design)', bad);
check(__geobalWellDecline(e, ai[0], 'coal') === 0 && __geobalWellDecline(e, ai[0], 'lithium') === 0, 'mines keep the game rule (no well term)');
// A field past 40% depletion: its owner's need rises by about a year of the depletion curve's fall.
let F = null, owner = null;
for (const c of ai.filter(x => x.provs?.some(pv => pv.__rw?.oil?.[0] >= Wbt))) { for (const id of c._fields || []) { const f = e.fields.get(id); if (f && f.owner === c.key && f.resource === 'oil' && Xr(f) > 0 && f.reserveInitial > 0 && ple(f) === 1) { F = f; owner = c; break; } } if (F) break; }
check(!!F, 'found an AI oil field still above 60% of its reserve', F?.id);
const before = __geobalWellDecline(e, owner, 'oil'), keep = { left: F.reserveLeft, flow: F.flow };
F.reserveLeft = 0.3 * F.reserveInitial; F.flow = F.capacityFlow * ple(F);
let after = 0, picks = null, seen = [];
const realW = __geobalWellDecline;
try {
  after = __geobalWellDecline(e, owner, 'oil');
  // Spy on the planner's call so the probe fails if qMo stops passing the value to GMo.
  __geobalWellDecline = (w, c, s) => { const v = realW(w, c, s); seen.push({ c: c.key, s, v }); return v; };
  picks = qMo(e, owner).map(p => ({ s: p.spec.resource, need: p.domesticNeed, score: p.score }));
} finally { __geobalWellDecline = realW; F.reserveLeft = keep.left; F.flow = keep.flow; }
check(after > before, 'a depleted field raises its owner sustaining need', { owner: owner.key, before, after });
const oilCall = seen.find(x => x.c === owner.key && x.s === 'oil');
check(!!oilCall && oilCall.v === after, 'the AI planner (qMo) computes the term for the owner oil and passes it on', { oilCall, calls: seen.length });
const g = dar(e).goods.get('oil'), raw = GMo(owner, g, 0);
check(GMo(owner, g, 1e6) > raw, 'GMo adds the term to the domestic need', { raw, withTerm: GMo(owner, g, 1e6) });
// Payback charge: the cost over the discounted years of output the real profile gives.
const crf = __geobalCapitalRecovery(0.05, Bx.conventional), crfShale = __geobalCapitalRecovery(0.05, Bx.shale);
check(Math.abs(crf - 0.083) < 0.001 && Math.abs(crfShale - 0.235) < 0.001, 'payback charge on the real profiles: conventional 8.3%, shale 23.5% at 5%', { crf, crfShale });
return { needCountries: rows.length, top: rows.slice(0, 8), owner: owner.key, before, after, picks: picks?.slice(0, 4) };
`,
  },
  {
    id: 'n13-lapse-notices',
    edits: ['n13-sanction-leverage-recheck#2'],
    code: String.raw`
const e = Ogr.sim;
const ai = (skip = []) => [...e.countries.values()].filter(c => c.key !== e.playerKey && !skip.includes(c.key) && He(c, 'diplomacy') && k1(e, c.key)).sort((a, b) => K(a.key, b.key));
const P = e.countries.get(e.playerKey), W = SQ(e);
const notes = (type, from) => e.journal.filter(j => j.id > from && j.type === type && j.payload?.reason === 'leverage_lapsed');
// (1) An AI country sanctions the player with an equity ban only; its economic weight falls; the monthly step runs.
const A = ai().find(c => F1e(e, c, 'fin_equityban', null) && !(e.sanctions || []).some(s => s.targetKey === e.playerKey && s.participants?.some(p => p.countryKey === c.key)));
const ok1 = Oc(e, A.key, e.playerKey, ['fin_equityban'], { causeId: 'manual', sourceId: 'geobal-probe-n13n-a', deferRecompute: true });
check(ok1, 'AI equity ban on the player created through Oc', A.key);
let mark = e._eventSeq; const hadA = Object.hasOwn(A, 'gdpVol'), gA = A.gdpVol; A.gdpVol = 0.001 * W;
try { oLe(e); } finally { if (hadA) A.gdpVol = gA; else delete A.gdpVol; }
const eased = notes('diplomacy.sanction_eased', mark).filter(j => j.payload.senderKey === A.key);
check(eased.length === 1, 'player as target: one "lifts its sanctions" message with reason leverage_lapsed', eased.map(j => j.payload));
// (2) The player imposes an equity ban (weight raised to qualify), then loses the weight.
const T = ai([A.key]).find(c => !(e.sanctions || []).some(s => s.targetKey === c.key && s.participants?.some(p => p.countryKey === e.playerKey)));
const hadP = Object.hasOwn(P, 'gdpVol'), gP = P.gdpVol;
let ok2 = false, lifted = [];
try {
  P.gdpVol = 0.05 * W;
  ok2 = Oc(e, e.playerKey, T.key, ['fin_equityban'], { causeId: 'manual', sourceId: 'geobal-probe-n13n-b', deferRecompute: true });
  P.gdpVol = 0.001 * W; mark = e._eventSeq; oLe(e);
  lifted = notes('diplomacy.sanction_lifted', mark).filter(j => j.payload.targetKey === T.key);
} finally { if (hadP) P.gdpVol = gP; else delete P.gdpVol; }
check(ok2, 'player equity ban created through Oc', T.key);
check(lifted.length === 1, 'player as sender: one "you withdrew from the regime" message with reason leverage_lapsed', lifted.map(j => j.payload));
const r = (e.sanctions || []).find(s => s.sourceId === 'geobal-probe-n13n-b');
check(r && !r.participants.some(p => p.countryKey === e.playerKey), 'the player left that regime', r?.statusId);
return { sender: A.key, target: T.key };
`,
  },
];
