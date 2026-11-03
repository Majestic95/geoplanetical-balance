// E10 function test: the sector power-cost adjustment (CpB, powerCostUnit) from the patched and the original bundle,
// with the game's own price breakdown (eLB) and stubbed goods. Usage: node mods/geoplanetical-balance/tests/e10.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const clamp = (A, B, Q) => Math.max(B, Math.min(Q, A));
// Goods: two on the transmission tariff (industry, tech), two not (agriculture, services).
const XB = [{ id: 'steel' }, { id: 'chips' }, { id: 'bread' }, { id: 'it' }];
const Kw = ['industry', 'tech', 'agriculture', 'services'];
const mB = [100, 200, 10, 50];
const TRANSMISSION = new Set(['industry', 'tech']);
const I2G = 0.6;
let electrified = 0; // WvB's electrified power use per unit (0 except in its own check)
const slice = (text, startText, endText) => {
  const i = text.indexOf(startText), j = text.indexOf(endText, i);
  if (i < 0 || j < 0 || j - i > 3000) throw new Error(`not found: ${startText}`);
  return text.slice(i, j + endText.length);
};
const fn = text => {
  const eLBsrc = slice(text, 'function MzB(', 'transmissionRatio:o}}');
  const eLB = new Function('IPg', `return (${eLBsrc})`)(I2G);
  const at = text.indexOf('Q.powerCostUnit[w]=B?0:vg(');
  const start = text.lastIndexOf('function ', at);
  // Since 26368058 the game adds electrified industry's power use at the current generation cost (WvB) after the clamp;
  // the function ends after that term (`/1e3}}`), which E10 also changes.
  const wvb = text.indexOf('+XMB(A,mB[w].id)*', at);
  if (wvb < 0 || wvb - at > 400) throw new Error('XMB term not found after powerCostUnit');
  const src = text.slice(start, text.indexOf('/1e3}}', wvb) + '/1e3}}'.length);
  if (!src.startsWith('function iNB(')) throw new Error('iNB not found');
  const CpB = new Function('VRA', 'nA', 'We', 'mB', 'NB', 'vg', 'Pg', 'MzB', 'cuA', 'XMB', `return (${src})`)(
    () => {}, XB.length, Kw, XB, mB, clamp, clamp, eLB, s => TRANSMISSION.has(String(s)), () => electrified);
  return { CpB, eLB };
};
const P = fn(patched), V = fn(original);
const country = ({ genCost = 60, cost0 = 50, s = 0, s0 = 0, noS0 = false, contract = 140, retail = 150, nrj = 20 } = {}) => ({
  key: 'X', elecSubsidy: s, ...(noS0 ? {} : { _elecSubsidy0: s0 }), taxes: { nrj },
  we: { plannedProd: [10, 5, 20, 8] },
  energy: { genCost, _servedCost0: cost0, retail, retailSpot: retail, retailContract: contract,
    demandByGoodTWh: { steel: 2, chips: 0.5 }, demandBySectorTWh: { industry: 3, tech: 1, agriculture: 0.4, services: 2 } },
});
const run = (f, c, genesis = false) => { f.CpB(c, genesis); return Array.from(c.we.powerCostUnit); };
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const close = (a, b) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));
const same = (a, b) => a.length === b.length && a.every((x, i) => Object.is(x, b[i]));

// TWh per unit of output for each good, read from the original with a generation-cost change of exactly 1 $/MWh.
const n = run(V, country({ genCost: 51, cost0: 50 })).map(x => x * 1e3);
check(n.every(x => x > 0) && n.every((x, i) => x * 1e-3 < mB[i] * 1.5), 'setup: every good uses power, unclamped at +1 $/MWh');

check(same(run(P, country({ s: 0.7, s0: 0 }), true), run(V, country({ s: 0.7, s0: 0 }), true)) &&
  run(P, country({ s: 0.7 }), true).every(x => x === 0), 'genesis pass: all zero, as before');
for (const s of [0, 0.3, 1]) for (const genCost of [20, 50, 60, 400]) {
  check(same(run(P, country({ s, s0: s, genCost })), run(V, country({ s, s0: s, genCost }))), `rate at its day-0 value ${s}, genCost ${genCost}: bit-identical`);
}
check(same(run(P, country({ s: 0.8, noS0: true })), run(V, country({ s: 0.8, noS0: true }))), 'no recorded day-0 rate: unchanged');
check(same(run(P, country({ s: 0.5, s0: 0, contract: 0, retail: 0 })), run(V, country({ s: 0.5, s0: 0, contract: 0, retail: 0 }))), 'zero contract price: unchanged');
const noEnergy = { key: 'Y', elecSubsidy: 1, _elecSubsidy0: 0, we: { powerCostUnit: new Float64Array([7, 7, 7, 7]) } };
check(P.CpB(noEnergy) === undefined && Array.from(noEnergy.we.powerCostUnit).every(x => x === 7), 'no energy data: untouched');

const expected = (c, s, s0) => {
  const p = P.eLB(c), d = clamp(s, 0, 1) - clamp(s0, 0, 1);
  return n.map((ni, e) => clamp(ni * (c.energy.genCost - c.energy._servedCost0 - p.contract * (TRANSMISSION.has(Kw[e]) ? p.transmissionRatio : 1) * d) / 1e3, -mB[e] * 0.2, mB[e] * 1.5));
};
for (const [s, s0, genCost] of [[0.3, 0, 60], [1, 0, 60], [0.5, 0.2, 50], [0.1, 0.4, 60], [0, 1, 80], [1.5, 0, 60], [NaN, 0.3, 60]]) {
  const c = country({ s, s0, genCost });
  const got = run(P, country({ s, s0, genCost })), want = expected(c, Number(s) || 0, s0);
  check(got.every((x, i) => close(x, want[i])), `rate ${s} vs day-0 ${s0}, genCost ${genCost}: cost change less contract x tariff ratio x rate change`);
}
const p0 = P.eLB(country());
check(p0.transmissionRatio > 0 && p0.transmissionRatio < 1, 'setup: transmission tariff below the full tariff');
const up = run(P, country({ s: 0.4, s0: 0 })), base = run(V, country({ s: 0.4, s0: 0 }));
check(up.every((x, i) => x < base[i]), 'a subsidy above the day-0 rate lowers every sector cost');
const ind = (base[0] - up[0]) / n[0], svc = (base[3] - up[3]) / n[3];
check(close(ind / svc, p0.transmissionRatio), 'transmission-connected sectors get the transmission share of the support, as billed');
const down = run(P, country({ s: 0, s0: 0.4 })), base2 = run(V, country({ s: 0, s0: 0.4 }));
check(down.every((x, i) => x > base2[i]), 'cutting the subsidy below the day-0 rate raises sector costs');
const flat = run(P, country({ s: 0.5, s0: 0, genCost: 50 }));
check(run(V, country({ s: 0.5, s0: 0, genCost: 50 })).every(x => x === 0) && flat.every(x => x < 0), 'generation cost unchanged: the vanilla adjustment is 0, the patched one reflects the subsidy');
const big = run(P, country({ s: 1, s0: 0, genCost: 50, contract: 1e6, retail: 1e6 }));
check(big.every((x, i) => close(x, -mB[i] * 0.2)), 'a huge subsidy stays inside the game floor (-20% of the base price)');
electrified = 0.5;
{
  // Vanilla prices electrified use at the generation cost; E10 takes the same support change off that price (never
  // below zero), outside the clamp.
  const c = { s: 0.4, s0: 0, genCost: 60 };
  const support = e => p0.contract * (TRANSMISSION.has(Kw[e]) ? p0.transmissionRatio : 1) * 0.4;
  const pe = run(P, country(c)), ve = run(V, country(c));
  check(ve.every((x, i) => close(x, base[i] + 0.5 * 60 / 1e3)), 'vanilla: electrified power use (XMB) added at the generation cost, after the clamp');
  check(pe.every((x, i) => close(x, up[i] + 0.5 * Math.max(0, 60 - support(i)) / 1e3)), 'electrified power use priced at generation cost less the support change, after the clamp');
  check(pe.every((x, i) => x < ve[i]), 'a subsidy above the day-0 rate lowers electrified power cost too');
  for (const s of [0, 0.3]) check(same(run(P, country({ s, s0: s, genCost: 75 })), run(V, country({ s, s0: s, genCost: 75 }))), `electrified, rate at its day-0 value ${s}: bit-identical`);
  const hugeE = run(P, country({ s: 1, s0: 0, genCost: 50, contract: 1e6, retail: 1e6 }));
  check(hugeE.every((x, i) => close(x, -mB[i] * 0.2)), 'a huge subsidy: electrified price floored at zero, the rest at the game floor');
  const cut = run(P, country({ s: 0, s0: 0.4, genCost: 60 })), cutV = run(V, country({ s: 0, s0: 0.4, genCost: 60 }));
  check(cut.every((x, i) => x > cutV[i]), 'cutting the subsidy below the day-0 rate raises electrified power cost too');
}
electrified = 0;
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
