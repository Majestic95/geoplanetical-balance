// Q14 measurement: AI arms-industry lines started by day N (the game's own per-country start counter
// _milIndustrySequence, summed over AI countries) and the projects on hand by status, plus how many of today's AI
// wartime needs for a line would pass the game's start gate (public cost <= 25% of available public money, or within
// the public limit on the automatic path). Run once with the balance mod as built and once with Q14 left out of
// mod.json (baseline), same seed and days:
// Run: node --max-old-space-size=6000 headless/prototype/probe-edits.mjs mods/geoplanetical-balance/tests/q14-measure.probes.mjs
//      --seed 12345 --days 150
// Code uses 26734764 names. Test tooling only; never shipped.
export const probes = [{
  id: 'q14-measure', edits: [],
  code: String.raw`
const e = Ogr.sim;
let started = 0, countries = 0; const status = {}, byGood = {}, starters = {};
for (const o of e.countries.values()) {
  if (o.key === e.playerKey) continue;
  const n = Math.max(0, Math.trunc(o._milIndustrySequence || 0));
  if (n > 0) { countries++; starters[o.key] = n; }
  started += n;
  for (const p of o._milIndustryProjects || []) { status[p.status] = (status[p.status] || 0) + 1; byGood[p.goodId] = (byGood[p.goodId] || 0) + 1; }
}
let needs = 0, pass = 0, autoPass = 0;
for (const o of e.countries.values()) {
  if (!o.we || o.key === e.playerKey) continue;
  for (const i of P9) {
    if (OK[i] == null) continue;
    const c = dh(o, i), p = Math.max(0, xJr(e, o, i) - c);
    if (!(p > 0)) continue;
    const q = QM(e, o, i, { capacityAdd: p });
    if (!q.available) continue;
    needs++;
    if (q.publicCostBn <= q.availablePublicBn * .25) pass++;
    else if (q.publicCostBn <= S9(o).publicLimitBn) autoPass++;
  }
}
return { day: e.day, aiLinesStarted: started, aiCountriesStarting: countries, starters, status, byGood, needsToday: needs, gatePass: pass, autoPass };
`,
}];
