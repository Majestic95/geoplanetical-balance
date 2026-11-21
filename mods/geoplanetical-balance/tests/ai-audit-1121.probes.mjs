// Prevalence probes for the AI audit batch of 2026-11-21 (build 26734764): how often each new rule engages in a booted
// world. Run at a chosen day, e.g. 30 (AX27 day-0 shift) or 365 (a year's prevalence):
//   node --max-old-space-size=6000 headless/prototype/probe-edits.mjs mods/geoplanetical-balance/tests/ai-audit-1121.probes.mjs --days 365
// Each `code` runs in the modded bundle's scope (session host Ogr.sim). Read-only: nothing in the world is changed.
// Test tooling only; never shipped.

const emit = String.raw`const __emit = (k, v) => { const t = JSON.stringify(v); for (let i = 0; i < t.length; i += 280) check(true, k + '#' + i, t.slice(i, i + 280)); };`;
const ai = String.raw`const S = Ogr.sim, pk = S.playerKey; const AI = [...S.countries.values()].filter(c => c.key !== pk && c.brain && !S.playerControlsGovernment(c));`;

export const probes = [
  {
    // AX27: the bilateral aid each AI donor would send this month to a country it sanctions or fights (game ranking,
    // top 2, 25% of the aid line / 12, split by score), against what it sends to the others. The patched ranking
    // must hold none of them.
    id: 'ax27-aid-moved',
    edits: ['ax27-bilateral-aid-excludes-enemies#1'],
    code: emit + ai + String.raw`
let movedBn = 0, totalBn = 0, pairs = [], leak = 0;
for (const d of AI) {
  const n = Vc(d, Number(d.spend?.aide) || 0) / 12 * Jr.aid.aiBilateralShare; if (!(n > 1e-9)) continue;
  const all = VMo(S, d, null).filter(r => BQ(S, d, r.target)).map(r => ({ ...r, score: r.gapBnMo * (.4 + YMo(S, d, r.target)) })).filter(r => r.score > 0).sort(zMo).slice(0, Jr.aid.aiBilateralTargets);
  const s = all.reduce((a, r) => a + r.score, 0); totalBn += n;
  for (const r of all) if (__geobalAidBarred(S, d.key, r.target.key)) { movedBn += n * r.score / s; pairs.push([d.name, r.target.name]); }
  for (const r of $Mo(S, d, null)) if (__geobalAidBarred(S, d.key, r.target.key)) leak++;
}
check(leak === 0, 'AX27: the patched ranking holds no sanctioned or enemy recipient', leak);
__emit('ax27', { day: S.day, donors: AI.length, bilateralBudgetBnMonthBeforeCaps: +totalBn.toFixed(4), movedBnMonth: +movedBn.toFixed(4), pairs: pairs.slice(0, 20), nPairs: pairs.length });
return null;`,
  },
  {
    // AX23 day-0 size: countries in an active crisis at boot, and whether the crisis opponent is now their primary
    // threat (P1t, patched). AX32 day-0 size: movements with a fiscal demand and their strength.
    id: 'ax23-ax32-day0',
    edits: [],
    code: emit + ai + String.raw`
const inCrisis = AI.filter(c => __geobalCrisisFoes(S, c.key).length);
const rows = inCrisis.map(c => { const t = P1t(S, c); const foes = __geobalCrisisFoes(S, c.key); return [c.name, foes.join('|'), __geobalCrisisRungMax(S, c.key), t.primary?.key, t.primary ? +t.primary.hostility.toFixed(2) : null, foes.includes(String(t.primary?.key))]; });
let mv = 0, fiscalMv = 0, weak = 0; const weakList = [];
for (const c of AI) for (const m of c.domestic?.movements || []) { mv++; const fiscal = (m.claim?.objectives || []).some(g => g.metricId === 'fiscal_spend' || g.metricId === 'fiscal_rate'); if (!fiscal) continue; fiscalMv++; const st = Math.max(Number(m.mobilization01) || 0, Number(m.regimeThreat01) || 0); if (st < .45) { weak++; weakList.push([c.name, +st.toFixed(2)]); } }
__emit('ax23', { day: S.day, crises: [...(S.securityCrises?.crises?.values?.() || [])].filter(x => x?.status === 'active').length, countriesInCrisis: inCrisis.length, primaryIsCrisisFoe: rows.filter(r => r[5]).length, rows: rows.slice(0, 14) });
__emit('ax32', { movements: mv, withFiscalDemand: fiscalMv, weakFiscal: weak, weakList: weakList.slice(0, 14) });
return null;`,
  },
  {
    id: 'ai-1121-prevalence',
    edits: [],
    code: emit + ai + String.raw`
const r1 = x => Math.round(x * 10) / 10;
const acc = AI.filter(c => _f(c) >= .5), losing = acc.filter(c => Number(c.approval) < 45);
const shock = AI.filter(c => __geobalFiscalShock(c));
const market = AI.map(c => [c.name, __geobalMarketTerm(c)]).filter(x => x[1] > 0);
const crime = AI.filter(c => c.securityJustice).map(c => { const o = IE(c); return [c.name, +__geobalCrimeRatio(c.securityJustice).toFixed(2), +o.pressures.police.toFixed(2)]; });
const roles = ['health', 'education', 'internalSecurity', 'justiceCorrections', 'administration', 'socialServices', 'diplomacy'];
const staff = Object.fromEntries(roles.map(k => [k, AI.filter(c => c.employment?.public?.[k]?.targetSource === 'ai').length]));
const firstYear = Object.fromEntries(roles.map(k => [k, AI.filter(c => { const j = c.employment?.public?.[k]; return j?.targetSource === 'ai' && Number(j.targetChangedDay) < 365; }).length]));
let barred = 0; for (const d of AI) for (const r of VMo(S, d, null)) if (__geobalAidBarred(S, d.key, r.target.key)) barred++;
const wars = [...(S.conflicts?.values?.() || [])].filter(w => n_(w)).length;
__emit('summary', { day: S.day, ai: AI.length, accountable: acc.length, losing: losing.length, losingList: losing.map(c => [c.name, r1(c.approval), r1(Oh(S, c))]).slice(0, 12),
  fiscalShockNow: shock.length, marketTermOn: market.length, marketTop: market.sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => [x[0], +x[1].toFixed(2)]),
  crimeAboveBacklog: crime.filter(x => x[1] > x[2] && x[1] > 1.1).length, crimeTop: crime.sort((a, b) => b[1] - a[1]).slice(0, 6),
  staffChangedByAi: staff, staffChangedInYear1: firstYear, barredAidCandidates: barred, activeConflicts: wars });
return null;`,
  },
];
