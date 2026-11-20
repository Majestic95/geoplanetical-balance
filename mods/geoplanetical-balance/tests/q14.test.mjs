// Q14 function test: the arms-industry quote (QM) prices a new line at one year of its added output (was 30%) and
// sets its lead time: an expansion of an existing line 12 months for ammunition and explosives, 24 for most goods, 36
// for ships (was 6, 18, 36); a first line (no capacity) 24, 36 and 48 months (was 6 for every good), also in the
// procurement scheduler's first-line wait (p5a). The cost and lead-time
// expressions are cut from both bundles and run with the game's rounding stubbed. Negative control: the original
// quotes 30% and a 6-month first line.
// Usage: node mods/geoplanetical-balance/tests/q14.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };
const cut = (text, from, to) => {
  const i = text.indexOf(from);
  if (i < 0 || text.indexOf(from, i + 1) >= 0) throw new Error(`${from} not found once`);
  const j = text.indexOf(to, i);
  if (j < 0 || j - i > 600) throw new Error(`${to} not near ${from}`);
  return text.slice(i, j);
};
const PCT = Number((/,Pct=(\d+);/.exec(original) || [])[1]);
// g (cost) and v (months) from `g=ae(` to `,b=e.finance`; m (validity amount) from `m=n?` to `,f=`.
const fnSrc = (text, name) => {
  const s = text.indexOf(`function ${name}(`);
  if (s < 0 || text.indexOf(`function ${name}(`, s + 1) >= 0) throw new Error(`${name}: not found once`);
  let depth = 0, i = text.indexOf('){', s) + 1;
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(s, i + 1);
};
const helper = (text) => (text.includes('function __geobalFirstLineMonths(') ? fnSrc(text, '__geobalFirstLineMonths') : '');
const quote = (text) => new Function('h', 's', 'a', 'p', 'n', 'o', 'ae', 'Pct',
  `${helper(text)};let g,v,m;${cut(text, 'g=ae(Math.max(0,h*', ',b=e.finance')};${cut(text, 'm=n?p*o.base*', ',f=Number.isFinite(m)')};return {g,v,m};`);
const stubAe = (x) => Math.ceil(x * 100) / 100;
const run = (text, { h = 10, s = 0, a = 'ammunition', p = 2 } = {}) => quote(text)(h, s, a, p, true, { base: 5 }, stubAe, PCT);
check(PCT === 6, 'the game\'s first-line constant is 6 months', String(PCT));
check(cut(patched, 'g=ae(Math.max(0,h*', ',b=e.finance') !== cut(original, 'g=ae(Math.max(0,h*', ',b=e.finance'), 'patch applied');

// Negative control.
check(run(original).g === 3 && run(original).v === 6, 'original: 30% and a 6-month first line', JSON.stringify(run(original)));
check(run(original, { s: 1, a: 'naval_military' }).v === 36, 'original: ship expansion 36');
// Cost: one year of added output (h = added capacity x base), m kept consistent.
for (const h of [0, 1e-6, 10, 1e4]) check(run(patched, { h }).g === stubAe(h), `patched: cost = 1 x annual output (${h})`, String(run(patched, { h }).g));
check(run(patched, { p: 2 }).m === 10 && run(original, { p: 2 }).m === 3, 'patched: validity amount at 1 x as the cost');
check(run(patched, { h: -5 }).g === 0, 'patched: negative output costs nothing');
// Months.
const months = (s, a) => run(patched, { s, a }).v;
check(months(1, 'ammunition') === 12 && months(1, 'explosives') === 12, 'expansion: ammunition and explosives 12');
check(months(1, 'naval_military') === 36, 'expansion: ships 36 (unchanged)');
check(months(1, 'land_weapons') === 24 && months(1, 'missile_systems') === 24, 'expansion: most goods 24');
check(months(0, 'ammunition') === 24 && months(0, 'explosives') === 24, 'first line: ammunition and explosives 24');
check(months(0, 'naval_military') === 48, 'first line: ships 48');
check(months(0, 'land_weapons') === 36 && months(0, 'military_aircraft') === 36, 'first line: most goods 36');
for (const a of ['ammunition', 'naval_military', 'land_weapons']) {
  check(months(0, a) >= months(1, a), `first line never quicker than an expansion (${a})`);
  check(months(1, a) >= run(original, { s: 1, a }).v && months(0, a) > run(original, { s: 0, a }).v, `never quicker than the game (${a})`);
}

// The procurement scheduler's wait for a producer with no capacity (p5a, read by eL for contract months) follows the
// first-line months; with capacity it is 0, and a line being built gives its months left (unchanged).
const sched = (text) => new Function('dh', 'Pct', `${helper(text)}${fnSrc(text, 'p5a')};return p5a;`)((c, g) => c.cap?.[g] || 0, PCT);
const SP = sched(patched), SO = sched(original);
check(SO({}, 'ammunition') === 6 && SO({}, 'naval_military') === 6, 'original: the scheduler waits 6 months for any first line');
for (const g of ['ammunition', 'explosives', 'naval_military', 'land_weapons', 'military_aircraft'])
  check(SP({}, g) === run(patched, { s: 0, a: g }).v, `scheduler first-line wait = factory first-line months (${g})`, String(SP({}, g)));
check(SP({ cap: { ammunition: 1 } }, 'ammunition') === 0, 'scheduler: existing capacity waits 0');
check(SP({ _milIndustryProjects: [{ goodId: 'land_weapons', status: 'building', monthsLeft: 7.2 }] }, 'land_weapons') === 8, 'scheduler: a line being built gives its months left');

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
