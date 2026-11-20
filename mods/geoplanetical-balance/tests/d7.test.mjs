// D7 function test: the sovereign required yield (qC) adds 0.12 points per point of primary deficit from zero, not
// only above 6% of GDP. qC is taken from the bundles; the rating premium, default test and the policy-rate constants
// it reads are stubbed (the test compares patched against original on the same stubs, so only the deficit term moves).
// Usage: node mods/geoplanetical-balance/tests/d7.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };
// The yield function is the one holding the savings-glut term; find its name rather than hard-coding it.
const yieldName = (text) => {
  const g = text.indexOf('_glut||0)*1.5;return Math.max(0,Number.isFinite(');
  if (g < 0) throw new Error('yield function not found');
  const f = text.lastIndexOf('function ', g);
  return /function ([\w$]+)\(/.exec(text.slice(f, f + 40))[1];
};
const fnSrc = (text, name) => {
  const s = text.indexOf(`function ${name}(`);
  if (s < 0 || text.indexOf(`function ${name}(`, s + 1) >= 0) throw new Error(`${name}: not found once`);
  let depth = 0, i = text.indexOf('){', s) + 1;
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(s, i + 1);
};
const name = yieldName(original);
check(name === yieldName(patched), 'same yield function in both bundles', name);
const body = (text) => fnSrc(text, name);
const load = (text) => {
  const src = body(text);
  const skip = new Set(['let', 'return', 'if', 'Number', 'Math', 'function', 'null', name, 'e', 't', 'a', 'r', 'o', 'n', 'i', 's']);
  const ids = [...new Set([...src.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)/g)].map((m) => m[1]))].filter((x) => !skip.has(x));
  const stubs = ids.map((n) => {
    if (src.includes(`${n}(e,t)`)) return () => false;              // default test (QP)
    if (src.includes(`${n}(t.rating)`)) return (r) => (r || 0) * 0.3; // rating premium
    return 0.5;                                                       // numeric constants (pass-through, adoption, base spread)
  });
  return new Function(...ids, `${src};return ${name};`)(...stubs);
};
const P = load(patched), O = load(original);
check(original.includes('Math.max(0,o-n-6)*.12'), 'original: premium only above 6% of GDP');
const sov = (deficit, interestPctGdp = 2, extra = {}) => ({ inflExp: 2, policyRate: 3, deficitNow: deficit, debt: interestPctGdp * 100,
  debtAvgRate: 1, gdpNom: 100, gdp: 100, rating: 5, ...extra });
const world = {};
const delta = (L, d, i) => L(world, sov(d, i)) - L(world, sov(-50, i)); // premium relative to a large surplus (zero term)
const near = (a, b) => Math.abs(a - b) < 1e-9;

// Primary deficit = deficit - interest (interest 2% of GDP here).
check(near(delta(O, 7, 2), 0), 'negative control: original adds nothing for a 5% primary deficit', String(delta(O, 7, 2)));
check(near(delta(P, 7, 2), 0.6), 'patched: 5% primary deficit adds 0.60 points', String(delta(P, 7, 2)));
check(near(delta(P, 5, 2), 0.36), 'patched: 3% primary deficit adds 0.36 points', String(delta(P, 5, 2)));
check(near(delta(O, 10, 2), 0.24) && near(delta(P, 10, 2), 0.96), '8% primary deficit: 0.24 before, 0.96 now',
  `${delta(O, 10, 2)} / ${delta(P, 10, 2)}`);
check(near(delta(P, 2, 2), 0) && near(delta(P, -3, 2), 0), 'balanced primary budget or surplus: nothing, no discount');
check(near(P(world, sov(-20)), O(world, sov(-20))), 'a surplus gives the same yield as the original');
// Continuity: no step anywhere between 0 and 20% of GDP.
let maxStep = 0; for (let d = 0; d <= 20; d += 0.01) maxStep = Math.max(maxStep, Math.abs(delta(P, d + 2.01, 2) - delta(P, d + 2, 2)));
check(maxStep < 0.0013, 'premium is continuous in the deficit', String(maxStep));
// Extreme inputs.
check(Number.isFinite(P(world, sov(1e6))) && P(world, sov(1e6)) > 0, 'huge deficit gives a finite yield');
check(P(world, sov(NaN)) >= 0, 'NaN deficit stays non-negative (original guard)');
check(P(world, { inflExp: 2, deficit0: -8, debt: 0, gdpNom: 100 }) - O(world, { inflExp: 2, deficit0: -8, debt: 0, gdpNom: 100 }) > 0.7,
  'deficit0 fallback is read the same way (8% primary deficit from the seed)');

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
