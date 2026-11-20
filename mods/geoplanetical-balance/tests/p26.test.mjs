// P26 function test: the named-people death rate (Kso) follows a life table by age, sex and country income, and the
// monthly people step (iMa) passes the person's sex and the country's GDP per head to it. Kso is taken from both
// bundles and run with the game's own clamp; the call site is checked in the patched text.
// Usage: node mods/geoplanetical-balance/tests/p26.test.mjs (from the repo root)
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
const Xo = (e, t, a) => Math.max(t, Math.min(a, e));
const load = (text) => new Function('Xo', `${fnSrc(text, 'Kso')};return Kso;`)(Xo);
const P = load(patched), O = load(original);
const pct = (x) => (x * 100).toFixed(2) + '%';

// Negative control: the game's own curve is far below a life table at 80 and the same for women.
check(O(80, 0.7, 0) < 0.04, 'original: a man of 80 dies at under 4% a year', pct(O(80, 0.7, 0)));
check(O(80, 0.7, 0, 'f', 2) === O(80, 0.7, 0, 'm', 50), 'original: no sex or income difference');

// Patched curve against a high-income male life table (health 0.7 = factor 1, rich country).
const table = [[40, 0.0015, 0.0035], [60, 0.008, 0.013], [70, 0.019, 0.028], [80, 0.048, 0.065], [90, 0.12, 0.17]];
for (const [age, lo, hi] of table) { const q = P(age, 0.7, 0, 'm', 50); check(q >= lo && q <= hi, `man of ${age} in a rich country`, pct(q)); }
check(P(80, 0.7, 0, 'm', 50) > O(80, 0.7, 0) * 1.4, 'patched: more deaths at 80 than the game');
// Sex and income.
check(Math.abs(P(80, 0.7, 0, 'f', 50) / P(80, 0.7, 0, 'm', 50) - 0.65) < 1e-9, 'women 0.65 x men');
check(P(70, 0.7, 0, 'm', 30) === P(70, 0.7, 0, 'm', 80), 'no income factor at or above 30k a head');
check(Math.abs(P(70, 0.7, 0, 'm', 2) / P(70, 0.7, 0, 'm', 50) - 1.5) < 1e-9, '1.5 x at 2k a head');
check(Math.abs(P(70, 0.7, 0, 'm', 0.3) / P(70, 0.7, 0, 'm', 50) - 1.5) < 1e-9, 'capped at 1.5 x below 2k a head');
const mid = P(70, 0.7, 0, 'm', 8) / P(70, 0.7, 0, 'm', 50);
check(mid > 1.2 && mid < 1.35, 'about 1.24 x at 8k a head', mid.toFixed(3));
// Missing or bad inputs keep the base (no NaN).
for (const bad of [undefined, null, NaN, -5, 0, 'x']) { const q = P(70, 0.7, 0, undefined, bad); check(q === P(70, 0.7, 0, 'm', 50), `income ${String(bad)} gives the base rate`); }
// Extremes: the clamp and the additive office risk still apply.
check(P(120, 0, 0.05, 'm', 1) === 0.92, 'clamp 92% at extreme age');
check(Math.abs(P(50, 0.7, 0.02, 'm', 50) - P(50, 0.7, 0, 'm', 50) - 0.02) < 1e-12, 'war risk still additive');
check(P(16, 1, 0, 'f', 50) > 0 && P(16, 1, 0, 'f', 50) < 0.001, 'young adults near zero');
check([...Array(90).keys()].every((i) => P(i + 16, 0.7, 0, 'm', 50) < P(i + 17, 0.7, 0, 'm', 50) || P(i + 17, 0.7, 0, 'm', 50) === 0.92), 'rises with age');
// Call site.
const step = fnSrc(patched, 'iMa');
check(step.includes('Kso(l,s.traits.health,p,s.g,c?.gdpCap)'), 'iMa passes sex and GDP per head');
check(!fnSrc(original, 'iMa').includes('s.g,c?.gdpCap'), 'original iMa does not');
console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
