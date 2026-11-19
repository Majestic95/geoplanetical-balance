// L21 function test: the emergent coronavirus family's severity ranges (epidemiology catalogue, emergence families)
// in the patched and the original bundle; every other family and trait unchanged.
// Usage: node mods/geoplanetical-balance/tests/l21.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
// Each emergent family's traits text, by family id.
const families = text => {
  const i = text.indexOf('coronavirus:{weight:'), j = text.indexOf('filovirus:{weight:', i);
  if (i < 0 || j < 0) throw new Error('emergence families not found');
  const end = text.indexOf('}}},', text.indexOf('traits:{', j));
  const out = {};
  for (const m of text.slice(i, end + 3).matchAll(/(coronavirus|influenza|henipavirus|filovirus):\{weight:[^]*?traits:\{([^]*?vaccine:\{[^}]*\})\}/g)) out[m[1]] = m[2];
  return out;
};
const P = families(patched), V = families(original);
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const arr = (t, key) => JSON.parse(t.match(new RegExp(`${key}:(\\[\\[[^\\]]*\\](?:,\\[[^\\]]*\\])*\\])`))[1].replace(/(^|[[,])\./g, '$10.'));
const strip = t => t.replace(/severeShare:\[\[[^]*?\]\],fatality:\[\[[^]*?\]\]/, '');

check(['coronavirus', 'influenza', 'henipavirus', 'filovirus'].every(k => P[k] && V[k]), 'setup: four families found in both bundles');
for (const k of ['influenza', 'henipavirus', 'filovirus']) check(P[k] === V[k], `${k}: traits unchanged`);
check(strip(P.coronavirus) === strip(V.coronavirus), 'coronavirus: every trait other than severity unchanged');
const ifr = t => arr(t, 'severeShare').map((s, b) => [s[0] * arr(t, 'fatality')[b][0], s[1] * arr(t, 'fatality')[b][1]]);
const [pc, pa, ps] = ifr(P.coronavirus), [vc, va, vs] = ifr(V.coronavirus);
check(pc[0] === vc[0] && pc[1] === vc[1], `children unchanged (IFR ${pc[0]}-${pc[1]})`);
check(vs[1] < 0.008 && va[1] < 4e-4, `original: over-65s at most ${(vs[1] * 100).toFixed(2)}%, adults at most ${(va[1] * 100).toFixed(3)}%`);
check(ps[0] >= 0.02 && ps[1] <= 0.045, `over-65s now ${(ps[0] * 100).toFixed(1)}-${(ps[1] * 100).toFixed(1)}% (2020 virus about 3-4%)`);
check(pa[0] >= 3e-4 && pa[1] <= 2e-3, `adults now ${(pa[0] * 100).toFixed(2)}-${(pa[1] * 100).toFixed(2)}% (2020 virus about 0.1%)`);
for (const key of ['severeShare', 'fatality']) for (const [lo, hi] of arr(P.coronavirus, key)) check(lo > 0 && lo <= hi && hi < 1, `${key} range ${lo}-${hi} valid`);

console.log(failures ? `${failures} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
