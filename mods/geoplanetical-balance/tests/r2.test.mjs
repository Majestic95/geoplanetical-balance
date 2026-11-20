// R2 function test: a good's technology supply and labour factors (mce: stacked node effects now over the day-0 product)
// are clamped at 3 instead of 50; the floor (0.25) and the day-0 value (1) are unchanged. mce and the clamp constant are
// taken from both bundles; the node stacking (K1a), the research state and the goods list are stubbed.
// Usage: node mods/geoplanetical-balance/tests/r2.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };
const fnSrc = (text, name) => {
  const s = text.indexOf(`function ${name}(`);
  if (s < 0 || text.indexOf(`function ${name}(`, s + 1) >= 0) throw new Error(`${name}: not found once`);
  let depth = 0, i = text.indexOf('){', s) + 1;
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(s, i + 1);
};
const clampDecl = (text) => { const m = /(\w+)=Object\.freeze\(\{min:\.25,max:([\d.]+)\}\)/.exec(text); if (!m) throw new Error('clamp missing'); return m; };
const load = (text, products) => {
  const [decl, name] = clampDecl(text);
  return new Function('qa', 'K1a', 'WUr', 'H$', 't_e', 'Cm', `const ${decl};${fnSrc(text, 'mce')};return mce;`)(
    () => true,
    (e, t, base) => (base ? { supply: {}, labor: {} } : products),
    'baseline',
    [{ id: 'health' }, { id: 'grain' }],
    (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
    (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d),
  );
};
check(clampDecl(original)[2] === '50', 'original clamp max is 50 (negative control)', clampDecl(original)[2]);
check(clampDecl(patched)[2] === '3', 'patched clamp max is 3', clampDecl(patched)[2]);
const run = (text, p) => load(text, p)({}, {});
const big = { supply: { health: 33.3, grain: 1.08 }, labor: { health: 19.4 } };
const o = run(original, big), p = run(patched, big);
check(o.supply.health === 33.3 && o.labor.health === 19.4, 'original lets a good reach 33x (negative control)', JSON.stringify(o));
check(p.supply.health === 3 && p.labor.health === 3, 'patched caps supply and labour factors at 3', JSON.stringify(p));
check(p.supply.grain === 1.08, 'patched leaves a small gain unchanged', String(p.supply.grain));
const day0 = run(patched, { supply: {}, labor: {} });
check(day0.supply.health === 1 && day0.labor.grain === 1, 'day 0 (no deployment) stays 1', JSON.stringify(day0));
const low = run(patched, { supply: { health: 0.1 }, labor: {} });
check(low.supply.health === 0.25, 'floor 0.25 unchanged', String(low.supply.health));
check(run(patched, { supply: { health: 1e9 }, labor: {} }).supply.health === 3, 'extreme stacking still 3');
console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
