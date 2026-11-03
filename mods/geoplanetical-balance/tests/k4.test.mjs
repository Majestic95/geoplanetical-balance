// K4 function test: the adviser's candidate scoring (IoB) and verdict (F_g) from the patched and the original bundle,
// with the game's own helpers (sC, NE, _0, the objective weights G_g) and stubbed goods, prices and conditions.
// Usage: node mods/geoplanetical-balance/tests/k4.test.mjs
import { readFileSync } from 'node:fs';
import { parseExpressionAt } from 'acorn';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
// A top-level function's source, by name (parsed, so the end is exact).
const fnSrc = (text, name) => {
  const at = text.indexOf(`function ${name}(`);
  if (at < 0 || text.indexOf(`function ${name}(`, at + 1) >= 0) throw new Error(`${name} not found once`);
  const node = parseExpressionAt(text, at, { ecmaVersion: 'latest' });
  return text.slice(at, node.end);
};
const OBJECTIVES = ['import_substitution', 'exports', 'jobs', 'strategic_security'];
const fn = text => {
  const helpers = text.slice(text.indexOf('lC=(A,B=0)=>'), text.indexOf(',jIB=Object.freeze('));
  if (!/^lC=.*,iE=.*,Gt=1e-9$/.test(helpers)) throw new Error('helpers not found');
  // One good per test, index 0: steel, an intermediate, traded good at a base price of 1; every condition neutral.
  const stubs = {
    qd: id => (id === 'steel' ? { id, sector: 'metals', tier: 'intermediate' } : null), lQ: () => 0, AQ: () => 1,
    ag: () => 1, rl: () => true, Pj: () => ({ operatingMarginPct: 10 }), UEC: () => ({ labor: { unemploymentPct: 6 } }),
    dg: { attributes: { metals: { laborInt: 'mid' } } }, ZI: new Map([['steel', { baselineRouteId: 'steel-route' }]]),
  };
  const body = `let ${helpers};${fnSrc(text, 'GEC')};return {IoB:${fnSrc(text, 'xIB')},F_g:${fnSrc(text, 'FEC')}}`;
  return new Function(...Object.keys(stubs), body)(...Object.values(stubs));
};
const P = fn(patched), V = fn(original);

// A country's market for steel: production, delivered consumption, unmet demand, imports, exports, capacity.
const country = ({ prod = 100, cons = 90, unmet, imp = 0, exp = 10, cap = 110, price = 1 }) =>
  ({ we: { prod: [prod], cons: [cons], ...(unmet === undefined ? {} : { unmet: [unmet] }), imp: [imp], exp: [exp], cap: [cap], price: [price] } });
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const strip = r => { if (!r) return r; const { unmet, signals, ...rest } = r; const { shortage, ...s } = signals; return { ...rest, signals: s }; };
// Deep equality, key order ignored (the patch adds keys in the middle of objects).
const canon = x => (x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canon(x[k])])) : x);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

// 1. No unmet demand (absent, zero, or not finite): every objective's score, signals and verdict are as before.
const markets = [
  { prod: 100, cons: 90, imp: 0, exp: 10 }, { prod: 0, cons: 50, imp: 50, exp: 0 }, { prod: 100, cons: 0, imp: 0, exp: 100 },
  { prod: 0, cons: 0, imp: 0, exp: 0, cap: 0 }, { prod: 80, cons: 100, imp: 30, exp: 10 }, { prod: 1e6, cons: 1e-12, imp: 0, exp: 1e6 },
];
for (const m of markets) for (const unmet of [undefined, 0, NaN, -5]) for (const obj of OBJECTIVES) for (const pr of [false, true]) {
  const c = country({ ...m, unmet });
  const a = P.IoB({}, c, 'steel', obj, pr), b = V.IoB({}, c, 'steel', obj, pr);
  check(same(strip(a), b) && a.signals.shortage === 0 && a.unmet === 0, `no unmet ${JSON.stringify(m)} unmet=${unmet} ${obj}: xIB unchanged`);
  for (const ok of [false, true]) check(same(P.F_g(a, obj, ok), V.F_g(b, obj, ok)), `no unmet ${JSON.stringify(m)} ${obj}: FEC unchanged`);
}
check(P.IoB({}, country({}), 'iron', 'jobs') === null && V.IoB({}, country({}), 'iron', 'jobs') === null && P.IoB({}, {}, 'steel') === null, 'unknown good or no market: null, as before');
check(same(P.F_g(null, 'jobs'), V.F_g(null, 'jobs')), 'no candidate: same verdict');

// 2. The player's case: a net exporter whose own buyers go short (exports 30, imports 5, 40 of 130 demanded unmet).
const short = country({ prod: 120, cons: 90, unmet: 40, imp: 5, exp: 35 });
const a = P.IoB({}, short, 'steel', 'import_substitution'), b = V.IoB({}, short, 'steel', 'import_substitution');
const need = (130 - 120) / 130, wNeed = 0.24;
check(Math.abs(a.signals.domesticNeed - need) < 1e-12 && b.signals.domesticNeed === 0, `domestic need counts unmet demand: ${a.signals.domesticNeed.toFixed(4)} (was ${b.signals.domesticNeed})`);
check(Math.abs(a.signals.shortage - 40 / 130) < 1e-12 && a.unmet === 40 && a.consumption === 90, 'shortage share 40/130, consumption stays delivered');
check(a.signals.importDependence === b.signals.importDependence, 'import dependence unchanged (imports over delivered consumption)');
check(Math.abs(a.score - b.score - need * wNeed) < 1e-12, `score rises by need x the objective's weight: ${b.score.toFixed(4)} -> ${a.score.toFixed(4)}`);
const va = P.F_g(a, 'import_substitution', true), vb = V.F_g(b, 'import_substitution', true);
check(vb.issueId === 'already_net_exporter' && vb.verdictId === 'objective_mismatch', `original verdict: ${vb.verdictId}/${vb.issueId}`);
check(va.issueId === null && va.verdictId === 'recommended' && va.objectiveFitId === 'good' && va.netExporter === true, `patched verdict: ${va.verdictId}/${va.issueId} (still a net exporter)`);
// Other objectives' verdicts do not use the shortage.
for (const obj of ['exports', 'jobs', 'strategic_security']) {
  const x = P.IoB({}, short, 'steel', obj), y = V.IoB({}, short, 'steel', obj);
  check(same(P.F_g(x, obj, true), V.F_g(y, obj, true)), `${obj}: verdict unchanged with a shortage`);
}

// 3. The 2% threshold (fill rate 98%, the game's shortage-warning level): low imports, no exports, demand 100.
const at = unmet => P.F_g(P.IoB({}, country({ prod: 99, cons: 100 - unmet, unmet, imp: 1, exp: 0 }), 'steel', 'import_substitution'), 'import_substitution', true);
check(at(2).issueId === 'imports_already_low', 'unmet 2% of demand: imports_already_low, as before');
check(at(2.5).issueId === null && at(2.5).verdictId === 'recommended', 'unmet 2.5% of demand: no longer a poor fit');
// imports_limited (8-20% imports) is lifted too; capacity warnings stay.
const lim = P.F_g(P.IoB({}, country({ prod: 85, cons: 100, unmet: 10, imp: 15, exp: 0, cap: 200 }), 'steel', 'import_substitution'), 'import_substitution', true);
check(lim.issueId === 'capacity_idle' && lim.objectiveFitId === 'good' && lim.verdictId === 'caution', `imports limited with a shortage: fit good, idle-capacity warning kept (${lim.verdictId}/${lim.issueId})`);

// 4. Extremes: everything unmet, huge and tiny numbers stay finite and in range.
for (const [p, c, u] of [[0, 0, 50], [0, 0, 1e-15], [1e9, 1e-9, 1e9], [1e-9, 1e9, 1e12], [5, 0, Infinity]]) {
  for (const obj of OBJECTIVES) {
    const r = P.IoB({}, country({ prod: p, cons: c, unmet: u, imp: 0, exp: 0 }), 'steel', obj);
    const s = r.signals;
    check(Number.isFinite(r.score) && s.domesticNeed >= 0 && s.domesticNeed <= 1 && s.shortage >= 0 && s.shortage <= 1,
      `extreme prod ${p} cons ${c} unmet ${u} ${obj}: finite score ${r.score}, need ${s.domesticNeed}, shortage ${s.shortage}`);
  }
}
// Sorting is deterministic: candidates ranked by score then good id, same input same order (no new ordering inputs).
check(same(P.IoB({}, short, 'steel', 'jobs'), P.IoB({}, short, 'steel', 'jobs')), 'same input, same result');

console.log(failures ? `K4: ${failures} of ${checks} checks FAILED` : `K4: all ${checks} checks pass`);
process.exit(failures ? 1 : 0);
