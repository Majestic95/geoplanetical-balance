// EN11 function test: the AI power-plant builder (LCo, holding `.startPowerProject(t,a,c)`) scales the capacity it
// orders by one minus the country's fiscal pressure (Zn(t).pressure), rounded down to whole units (part-units only below 1, the game's H3t gate), unless the AI
// energy tick flags a firm shortfall (planned firm supply below demand), which is never scaled. LCo and the patch's
// helper are taken from the bundles; the site finder, grid capacity, quote, unit maths and the project starters are
// stubbed, and Zn is stubbed to return the test's pressure.
// Usage: node mods/geoplanetical-balance/tests/en11.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };
const enclosing = (text, needle) => {
  const a = text.indexOf(needle);
  if (a < 0 || text.indexOf(needle, a + 1) >= 0) throw new Error(`${needle}: not found once`);
  const s = text.lastIndexOf('function ', a);
  let depth = 0, i = text.indexOf('){', s) + 1;
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(s, i + 1);
};
const fnSrc = (text, name) => enclosing(text, `function ${name}(`);
const lco = (text) => enclosing(text, '.startPowerProject(t,a,c)');
const nameOf = (src) => /function ([\w$]+)\(/.exec(src)[1];
// Free names LCo calls: site finder, grid capacity, max-buildable, unit table, unit picker, gap-to-units.
const load = (text) => {
  const src = lco(text), name = nameOf(src);
  const helper = text.includes('function __geobalEN11(') ? fnSrc(text, '__geobalEN11') : '';
  const calls = [...src.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\(/g)].map((m) => m[1]).filter((x) => x !== name && !['function', 'if', 'return', '__geobalEN11'].includes(x));
  const unitTable = /\/([\w$]+)\[a\]\.unitGW/.exec(src)[1];
  const [site, grid, maxB, pick, toUnits] = [...new Set(calls)];
  return (state) => new Function(site, grid, maxB, pick, toUnits, unitTable, 'Zn', `${helper}${src};return ${name};`)(
    () => ({ id: 'prov' }),
    () => ({ availableGW: null, yieldFactor: 1 }),
    () => ({ maxUnits: null, reason: null }),
    (s, units) => units,
    () => state.units,
    { gas: { unitGW: 1 } },
    () => ({ pressure: state.pressure }),
  );
};
const P = load(patched), O = load(original);
// The game's unit gate (H3t, read by the plant quote TC and the expansion finder Cka): a whole number of units, or a
// single part-unit below 1. The project starter below accepts only what the gate accepts, as txe does through TC.
const H3t = new Function(`${fnSrc(original, 'H3t')};return H3t;`)();
check(H3t(2) && H3t(0.6) && !H3t(2.7) && !H3t(1.4), 'game gate: whole units or a part-unit below 1');
const order = (L, units, pressure, short = false) => {
  const state = { units, pressure }; let ordered = null;
  const sim = { findPlantExpansionTarget: () => null, startPowerProject: (t, a, c) => { if (!H3t(c)) return false; ordered = c; return true; } };
  L(state)(sim, { key: 'X', energy: {} }, 'gas', 10, {}, short);
  return ordered;
};
const near = (a, b) => a != null && b != null && Math.abs(a - b) < 1e-12;
check(order(O, 4, 0.5) === 4, 'negative control: original orders the full 4 units at pressure 0.5', String(order(O, 4, 0.5)));
check(order(P, 3, 0.1) === 2, '3 units at pressure 0.1: 2.7 rounds down to 2 and passes the gate', String(order(P, 3, 0.1)));
check(order(P, 2, 0.3) === 1, '2 units at pressure 0.3: 1.4 -> 1', String(order(P, 2, 0.3)));
check(near(order(P, 1, 0.4), 0.6), '1 unit at pressure 0.4: a 0.6 part-unit, accepted by the gate', String(order(P, 1, 0.4)));
check(order(P, 4, 0.5) === 2 && order(P, 10, 0.75) === 2 && order(P, 5, 0.3) === 3, 'whole units floored: 4@0.5 -> 2, 10@0.75 -> 2, 5@0.3 -> 3',
  `${order(P, 4, 0.5)} ${order(P, 10, 0.75)} ${order(P, 5, 0.3)}`);
check(near(order(P, 3, 0.7), 0.9), 'scaled below one unit: a part-unit', String(order(P, 3, 0.7)));
for (const [u, p] of [[3, 0.1], [7, 0.33], [2, 0.49], [9, 0.05], [1, 0.9], [6, 0.99]]) {
  const r = order(P, u, p);
  check(r !== null && H3t(r) && r <= u * (1 - p) + 1e-12, `gate passes and never above the scaled amount (${u} units, pressure ${p})`, String(r));
}
check(order(P, 4, 1) === null, 'pressure 1 without a shortage: nothing this month');
for (const p of [0.3, 0.9, 1]) check(order(P, 4, p, true) === 4 && order(O, 4, p, true) === 4, `firm shortfall: never scaled (pressure ${p})`);
check(order(P, 4, 0) === 4 && order(P, 4, undefined) === 4 && order(P, 4, NaN) === 4 && order(P, 4, -1) === 4, 'no pressure (0, missing, NaN, negative): unchanged');
check(near(order(P, 0.6, 0.5), 0.3), 'a part-unit order is scaled the same way');
check(order(P, 4, 7) === null, 'pressure above 1 treated as 1');
check(order(P, 0, 0.2) === null && order(O, 0, 0.2) === null, 'nothing needed: nothing ordered in both');
check(order(P, 1e6, 0.5) === 5e5, 'huge order scales');
check(patched.includes('l&&LCo(e,r,l,i.gapToTargetTWh,n,i.plannedFirmTWh<i.demandTWh)'), 'the AI energy tick passes the firm-shortfall flag');

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
