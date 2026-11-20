// P8 measurement: in one booted modded world, every country's projected party shares from the party-choice model
// (Pke, as the game's periodic poll update WWa calls it through eut) with the patched loss weight and with the game's
// original weight (the same function with the original expression put back), same inputs. Counts the countries where
// the ruling parties' combined share falls, where they lose first place, and where they fall below half.
// Run: node --max-old-space-size=6000 headless/prototype/probe-edits.mjs mods/geoplanetical-balance/tests/p8-measure.probes.mjs
//      --seed 12345 --days 30
// Code uses 26734764 names. Test tooling only; never shipped.
export const probes = [{
  id: 'p8-measure', edits: ['p8-election-loss-aversion#1'],
  code: String.raw`
const e = Ogr.sim;
const src = Pke.toString(), NEW = 'Math.min(1+h*.02,1/(1+Math.pow(-h/30,2.4)))', OLD = '1/(1+Math.pow(-h/30,2.4))';
check(src.includes(NEW), 'patched Pke found');
const PkeOrig = eval('(' + src.replace(NEW, OLD) + ')');
const rows = [];
for (const t of e.countries.values()) {
  if (!t.pops || !t.pol?.parties?.length) continue;
  const n = N0(e, t, 'head_of_gov'), ch = n ? TO(1 + (n.traits.charisma - .5) * .3 + (n.traits.notoriety || 0) * .12, .5, 1.7) : 1;
  const blocs = e._voterBlocs(t), ruling = PXr(t.pol);
  if (!blocs?.length || !ruling?.length) continue;
  const opts = { sigma: t.pol.sigma || .8, salience: t.pol.salience, ruling, charisma: ch, growthGainPct: lme(e, t) };
  const a = Pke(t.pol.parties, blocs, opts), b = PkeOrig(t.pol.parties, blocs, opts);
  const tot = (u) => Object.values(u).reduce((s, x) => s + x, 0) || 1;
  const rs = (u) => ruling.reduce((s, id) => s + (u[id] || 0), 0) / tot(u);
  const top = (u) => Object.entries(u).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0][0];
  const w = blocs.reduce((s, x) => s + (x.share || 0), 0) || 1;
  const unhappy = blocs.filter(x => (x.sat ?? 52) < 52).reduce((s, x) => s + (x.share || 0), 0) / w;
  rows.push({ k: t.key, mod: rs(a), base: rs(b), topMod: ruling.includes(top(a)), topBase: ruling.includes(top(b)), unhappy });
}
const d = rows.map(r => r.mod - r.base);
const fell = rows.filter(r => r.mod < r.base - 1e-9);
const lostFirst = rows.filter(r => r.topBase && !r.topMod), lostHalf = rows.filter(r => r.base >= .5 && r.mod < .5);
check(rows.length > 50, 'most countries have a projection', String(rows.length));
check(d.every(x => x <= 1e-9), 'P8 never raises a ruling share');
const pct = (x) => Math.round(x * 1000) / 10;
return { day: e.day, countries: rows.length, fell: fell.length, meanDropPts: pct(-d.reduce((s, x) => s + x, 0) / (rows.length || 1)),
  maxDropPts: pct(-Math.min(0, ...d)), lostFirst: lostFirst.map(r => r.k + ':' + pct(r.base) + '->' + pct(r.mod)),
  lostHalf: lostHalf.map(r => r.k + ':' + pct(r.base) + '->' + pct(r.mod)),
  biggest: rows.sort((x, y) => (x.mod - x.base) - (y.mod - y.base)).slice(0, 8).map(r => r.k + ':' + pct(r.base) + '->' + pct(r.mod) + ' unhappy ' + pct(r.unhappy)) };
`,
}];
