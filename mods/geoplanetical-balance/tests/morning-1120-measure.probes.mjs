// Measurement (no pass/fail on the numbers) for J1, EN3 and EN5 after a run of days, to compare against the mod
// without them from the same seed (run the same file on master's worktree):
//   node --max-old-space-size=6000 headless/prototype/probe-edits.mjs mods/geoplanetical-balance/tests/morning-1120-measure.probes.mjs --days 365
// Crime: latent crime per 100k against each country's day-0 seed, and police capacity. Extraction: AI projects open,
// world oil and gas output, unmet demand and price. Test tooling only; never shipped.

export const probes = [
  {
    id: 'morning-1120-measure',
    edits: [],
    code: String.raw`
const e = Ogr.sim;
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] : null; };
const crime = [], police = [], viol = [];
for (const c of [...e.countries.values()].sort((a, b) => K(a.key, b.key))) {
  const t = MG(c); if (!t?.seed) continue;
  const s0 = vg.reduce((a, f) => a + t.seed.latentAnnualPer100k[f], 0);
  crime.push({ key: c.key, r: t.crime.latentAnnualPer100k / s0 });
  viol.push(t.crime.families.violent.latentAnnualPer100k / t.seed.latentAnnualPer100k.violent);
  police.push(Uot(c, t).police);
}
const rs = crime.map(x => x.r);
const ext = {}; for (const p of e.extractProjects || []) { const k = p.resource; ext[k] = (ext[k] || 0) + 1; }
const world = {};
for (const s of ['oil', 'gas']) {
  const i = Jt(s); let prod = 0, unmet = 0;
  for (const c of e.countries.values()) { prod += Dd(c.we?.prod?.[i]); unmet += Dd(c.we?.unmet?.[i]); }
  world[s] = { prod, unmet, price: mo(e, s) };
}
check(rs.length > 150, 'measured crime in every country with a justice state', rs.length);
// The runner prints only the first 600 characters of the detail, so energy goes first and numbers are rounded.
const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);
for (const s of Object.keys(world)) for (const k of Object.keys(world[s])) world[s][k] = r3(world[s][k]);
return {
  day: e.day, world, extractionProjects: ext,
  crime: { p10: r3(q(rs, 0.1)), med: r3(q(rs, 0.5)), p90: r3(q(rs, 0.9)), max: r3(q(rs, 1)), over10: rs.filter(r => r > 1.1).length, under10: rs.filter(r => r < 0.9).length,
    top: crime.sort((a, b) => b.r - a.r).slice(0, 3).map(x => x.key + ':' + r3(x.r)).join(' ') },
  violent: { med: r3(q(viol, 0.5)), p90: r3(q(viol, 0.9)), max: r3(q(viol, 1)) },
  police: { p10: r3(q(police, 0.1)), med: r3(q(police, 0.5)), min: r3(q(police, 0)), below08: police.filter(p => p < 0.8).length },
};
`,
  },
];
