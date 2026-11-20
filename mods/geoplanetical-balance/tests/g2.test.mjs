// G2 function test: the administration queue step drains 3% a month of the fiscal backlog above its day-0 level
// (scaled with population), so a steady inflow-capacity gap settles instead of growing without limit; the other
// queues are unchanged. The queue loop (`for(let s of yce){...}`) is taken from the bundles and run with stubbed
// inflows (a), capacity multipliers (r), population scale (o) and the month's population ratio (i).
// Usage: node mods/geoplanetical-balance/tests/g2.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };
const loop = (text) => {
  const a = text.indexOf('t.populationScale=o;for(let s of yce){');
  if (a < 0) throw new Error('queue loop not found');
  const s = a + 't.populationScale=o;'.length;
  let depth = 0, i = text.indexOf('{', s);
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return new Function('yce', 't', 'a', 'r', 'o', 'i', `${text.slice(s, i + 1)};return t;`).bind(null, ['civil', 'fiscal', 'social', 'foreign']);
};
const P = loop(patched), O = loop(original);
const queue = (inflow, delay) => ({ inflow, backlog: inflow * delay, processed: inflow, capacity: inflow, delayMonths: delay,
  baseline: { inflow, backlog: inflow * delay, delayMonths: delay } });
const admin = () => ({ queues: { civil: queue(10, 1), fiscal: queue(10, 1), social: queue(10, 1), foreign: queue(10, 1) } });
// Run `months` months: inflow grows by `inflowGrowth` a month relative to capacity (fixed staff), population fixed.
const run = (L, months, inflowGrowth, pop = 1) => {
  const t = admin();
  for (let m = 1; m <= months; m++) {
    const g = Math.pow(1 + inflowGrowth, m);
    L(t, { civil: 10 * g, fiscal: 10 * g, social: 10 * g, foreign: 10 * g }, { civil: 1, fiscal: 1, social: 1, foreign: 1 }, pop, 1);
  }
  return t;
};

// 1. Growing workload with fixed staff (inflow +2%/yr relative to capacity), 10 years.
const g = Math.pow(1.02, 1 / 12) - 1;
const O10 = run(O, 120, g), P10 = run(P, 120, g);
check(O10.queues.fiscal.delayMonths > 1 + 10, 'negative control: original fiscal backlog grows by well over 10 months', String(O10.queues.fiscal.delayMonths));
check(P10.queues.fiscal.delayMonths < O10.queues.fiscal.delayMonths * 0.6, 'patched fiscal delay much lower after 10 years',
  `${P10.queues.fiscal.delayMonths.toFixed(2)} vs ${O10.queues.fiscal.delayMonths.toFixed(2)}`);
check(P10.queues.civil.delayMonths === O10.queues.civil.delayMonths && P10.queues.social.backlog === O10.queues.social.backlog &&
  P10.queues.foreign.backlog === O10.queues.foreign.backlog, 'civil, social and foreign queues unchanged');

// 2. A constant gap settles: excess converges to gap / 0.03.
const steady = (L, months) => { const t = admin(); for (let m = 0; m < months; m++) L(t, { civil: 10, fiscal: 11, social: 10, foreign: 10 }, { civil: 1, fiscal: 1, social: 1, foreign: 1 }, 1, 1); return t; };
const S600 = steady(P, 600), S1200 = steady(P, 1200), SO = steady(O, 600);
const excess = (t) => t.queues.fiscal.backlog - t.queues.fiscal.baseline.backlog;
check(Math.abs(excess(S1200) - excess(S600)) < 1e-3 && Math.abs(excess(S1200) - 1 / 0.03 * (1 - 0.03)) < 0.5,
  'a constant gap of 1 file a month settles near 32 files of excess', `${excess(S600)} / ${excess(S1200)}`);
check(excess(SO) > 590, 'original: same gap piles up linearly', String(excess(SO)));

// 3. No excess, no change: day-0 state and a shrinking backlog are untouched.
const flat = (L) => { const t = admin(); L(t, { civil: 10, fiscal: 10, social: 10, foreign: 10 }, { civil: 1, fiscal: 1, social: 1, foreign: 1 }, 1, 1); return t; };
check(JSON.stringify(flat(P)) === JSON.stringify(flat(O)), 'day-0 balance: identical');
const shrink = (L) => { const t = admin(); for (let m = 0; m < 24; m++) L(t, { civil: 10, fiscal: 9, social: 10, foreign: 10 }, { civil: 1, fiscal: 1, social: 1, foreign: 1 }, 1, 1); return t; };
check(JSON.stringify(shrink(P)) === JSON.stringify(shrink(O)), 'backlog below day-0 level: identical');

// 4. Population scaling: the day-0 reference grows with population (o), so a bigger country is not drained to its old size.
const popT = admin(); popT.queues.fiscal.backlog = 15;
P(popT, { civil: 15, fiscal: 15, social: 15, foreign: 10 }, { civil: 1, fiscal: 1, social: 1, foreign: 1 }, 1.5, 1);
check(Math.abs(popT.queues.fiscal.backlog - 15) < 1e-9, 'population 1.5x and backlog 1.5x day 0: no write-off', String(popT.queues.fiscal.backlog));

// 5. Extreme inputs: never negative, never NaN; bad baseline or scale leaves the original rule.
const ext = admin(); ext.queues.fiscal.backlog = 1e12;
P(ext, { civil: 0, fiscal: 0, social: 0, foreign: 0 }, { civil: 0, fiscal: 0, social: 0, foreign: 0 }, 1, 1);
check(ext.queues.fiscal.backlog >= 0 && Number.isFinite(ext.queues.fiscal.backlog) && ext.queues.fiscal.backlog < 1e12, 'huge backlog drains, stays finite');
for (const [name, mut, o] of [['NaN baseline', (t) => { t.queues.fiscal.baseline.backlog = NaN; }, 1], ['missing baseline', (t) => { delete t.queues.fiscal.baseline; t.queues.fiscal.baseline = { inflow: 10 }; }, 1], ['NaN scale', () => {}, NaN]]) {
  const a = admin(), b = admin(); mut(a); mut(b); a.queues.fiscal.backlog = b.queues.fiscal.backlog = 50;
  try {
    P(a, { civil: 10, fiscal: 10, social: 10, foreign: 10 }, { civil: 1, fiscal: 1, social: 1, foreign: 1 }, o, 1);
    O(b, { civil: 10, fiscal: 10, social: 10, foreign: 10 }, { civil: 1, fiscal: 1, social: 1, foreign: 1 }, o, 1);
    check(Object.is(a.queues.fiscal.backlog, b.queues.fiscal.backlog), `${name}: original rule`, `${a.queues.fiscal.backlog} vs ${b.queues.fiscal.backlog}`);
  } catch (e) { check(false, `${name}: threw`, e.message); }
}

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
