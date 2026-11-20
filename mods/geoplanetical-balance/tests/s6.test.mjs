// S6 function test: when a cohort enters the adult skill stock (PFt, from generation0), each school level's skill yield
// (uFt via SFt) is scaled by the level's learning index relative to day 0, bounded 0.5 to 1.5; the monthly youth
// rebuild (YCr) and day-0 learning give the game's values.
// uFt and SFt come from both bundles; the policy-yield helper zCr is stubbed.
// Usage: node mods/geoplanetical-balance/tests/s6.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } else console.log(`ok ${what}${detail ? ` (${detail})` : ''}`); };
const fnSrc = (text, name) => {
  const s = text.indexOf(`function ${name}(`);
  if (s < 0 || text.indexOf(`function ${name}(`, s + 1) >= 0) throw new Error(`${name}: not found once`);
  let depth = 0, i = text.indexOf('){', s) + 1;
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(s, i + 1);
};
const K3 = (e, t, a = 1) => (t > 1e-12 ? e / t : a);
const ao = (e, t, a) => Math.max(t, Math.min(a, e));
const load = (text) => new Function('K3', 'ao', `const zCr=(t)=>t.__yield;${fnSrc(text, 'uFt')}${fnSrc(text, 'SFt')};return {uFt,SFt};`)(K3, ao);
const P = load(patched), O = load(original);
const level = (learn, opts = {}) => ({ eligibleM: 10, completionsLastMonthM: opts.comp ?? 0.1, learningIndex: learn,
  baseline: { eligibleM: 10, completionsM: 0.1, learningIndex: 0.6 } });
// Day-0 neutral.
check(P.uFt(level(0.6), 0.7, true) === O.uFt(level(0.6), 0.7), 'day-0 learning: same yield as the game', String(P.uFt(level(0.6), 0.7, true)));
// Negative control: the game ignores learning.
check(O.uFt(level(0.3), 0.7) === O.uFt(level(0.9), 0.7), 'original: learning does not change the yield');
// Scaling and bounds.
check(Math.abs(P.uFt(level(0.72), 0.7, true) - 0.7 * 1.2) < 1e-12, 'learning +20% -> yield x1.2');
check(Math.abs(P.uFt(level(0.48), 0.7, true) - 0.7 * 0.8) < 1e-12, 'learning -20% -> yield x0.8');
check(Math.abs(P.uFt(level(0.01), 0.7, true) - 0.7 * 0.5) < 1e-12, 'floor x0.5');
check(Math.abs(P.uFt(level(5), 0.7, true) - 0.7 * 1.5) < 1e-12, 'cap x1.5');
check(Math.abs(P.uFt(level(0.72, { comp: 0.2 }), 0.7, true) - 0.7 * 2 * 1.2) < 1e-12, 'completion and learning multiply');
check(P.uFt(level(0.72, { comp: 0 }), 0.7, true) === 0, 'no completions -> 0');
// Bad inputs fall back to the game's value.
for (const bad of [undefined, NaN, null]) check(P.uFt(level(bad), 0.7, true) === O.uFt(level(bad), 0.7), `learning ${String(bad)} -> game's yield`);
const noBase = { eligibleM: 10, completionsLastMonthM: 0.1, learningIndex: 0.7, baseline: { eligibleM: 0, completionsM: 0, learningIndex: 0 } };
check(P.uFt(noBase, 0.7, true) === 0.7, 'no baseline: yield unchanged');
// Through SFt: the young cohort's skill mix.
const edu = (ls, lh) => ({ __yield: { mid: 0.8, high: 0.4 }, levels: { secondary: level(ls), higher: level(lh) } });
const g0 = [0.2, 0.5, 0.3];
const base = P.SFt(g0, edu(0.6, 0.6), true), oBase = O.SFt(g0, edu(0.6, 0.6));
check(base.every((x, i) => Math.abs(x - oBase[i]) < 1e-12), 'SFt day-0 mix identical', base.map((x) => x.toFixed(3)).join('/'));
const good = P.SFt(g0, edu(0.72, 0.72), true), bad = P.SFt(g0, edu(0.45, 0.45), true);
check(good[0] < base[0] && good[2] > base[2], 'better learning: fewer low-skill, more high-skill', good.map((x) => x.toFixed(3)).join('/'));
check(bad[0] > base[0] && bad[2] < base[2], 'worse learning: more low-skill, fewer high-skill', bad.map((x) => x.toFixed(3)).join('/'));
for (const mix of [good, bad, P.SFt(g0, edu(9, 9), true)]) check(mix.every((x) => x >= 0) && Math.abs(mix[0] + mix[1] + mix[2] - 1) < 1e-12, 'mix stays a valid share vector', mix.map((x) => x.toFixed(3)).join('/'));
// Only the cohort-entry flow (PFt, generation0) is weighted; the monthly youth rebuild (YCr) is not.
check(P.uFt(level(0.9), 0.7) === O.uFt(level(0.9), 0.7), 'unflagged call (youth rebuild): game value');
{ const a = P.SFt(g0, edu(0.72, 0.72)), b = O.SFt(g0, edu(0.72, 0.72)); check(a.every((x, i) => x === b[i]), 'SFt without the flag: game mix'); }
check(fnSrc(patched, 'PFt').includes('SFt(e.skills.generation0,e,!0)'), 'PFt weights the cohort entering the adult stock');
check(!fnSrc(patched, 'YCr').includes(',!0)'), 'YCr does not');
console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
