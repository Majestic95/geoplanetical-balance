// J1 function test: each crime family's latent target is scaled by police capacity against day 0 (violent ^-0.5,
// property ^-0.25, criminal economy ^-0.15, within 0.6-1.5) and the prison population against day 0 (violent and
// property ^-0.1, within 0.85-1.15). The helper comes from the patched bundle; the crime step's call is checked in both
// bundles. Behaviour in the real crime step and day-0 neutrality in every country: tests/morning-1120.probes.mjs.
// Usage: node mods/geoplanetical-balance/tests/j1.test.mjs (from the repo root)
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
const near = (a, b) => Math.abs(a - b) < 1e-12;
const CALL = '*__geobalDeterrence(pa,n.police,t,o);';
check(!original.includes('__geobalDeterrence'), 'original crime step has no deterrence term (negative control)');
check(fnSrc(patched, 'nLr').includes(`Ja(1.04-.04*p,.9,1.06)${CALL}`), 'patched crime step multiplies the latent target by the term');
const D = new Function(`${fnSrc(patched, '__geobalDeterrence')};return __geobalDeterrence;`)();
const seed = { convictedPer100k: 80, pretrialPer100k: 20 };
const st = (conv = 80, pre = 20) => ({ prisons: { convictedPer100k: conv, pretrialPer100k: pre } });
for (const f of ['violent', 'property', 'criminalEconomy']) check(near(D(f, 1, st(), seed), 1), `${f}: day-0 ratios give exactly 1`);
check(near(D('violent', 0.5, st(), seed), 0.5 ** -0.5) && near(D('property', 0.5, st(), seed), 0.5 ** -0.25) && near(D('criminalEconomy', 0.5, st(), seed), 0.5 ** -0.15),
  'half the police capacity: violent x1.41, property x1.19, criminal economy x1.11');
check(near(D('violent', 2, st(), seed), 2 ** -0.5), 'double capacity: violent x0.71');
check(D('violent', 0.01, st(), seed) === 1.5 && D('violent', 10, st(), seed) === 0.6, 'police term clamped to 0.6-1.5');
check(near(D('violent', 1, st(160, 40), seed), 2 ** -0.1) && near(D('property', 1, st(40, 10), seed), 0.5 ** -0.1), 'prison ratio x2 / x0.5: ^-0.1');
check(near(D('criminalEconomy', 1, st(160, 40), seed), 1), 'criminal economy: no prison term');
check(D('violent', 1, st(0, 0), seed) === 1.15 && D('violent', 1, st(8000, 0), seed) === 0.85, 'prison term clamped to 0.85-1.15');
check(D('violent', NaN, st(), seed) === 1 && D('violent', 1, st(), {}) === 1, 'missing capacity or prison seed: neutral');
console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
