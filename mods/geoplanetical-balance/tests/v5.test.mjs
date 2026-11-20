// V5 function test: the migration distance kernel (TAr) is 0.1 + 0.9/(1 + km/1000), 2 for a land neighbour, 0.55 with
// no position, and the destination weight in GAr uses it without a square root. TAr, DAr and GAr come from both
// bundles; the centroid lookup, the income term (nUt) and the diaspora table are stubbed.
// Usage: node mods/geoplanetical-balance/tests/v5.test.mjs (from the repo root)
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
const ro = (e, t = 0) => (Number.isFinite(Number(e)) ? Number(e) : t);
const load = (text) => new Function('ro', 'GHt', 'nUt', `const NR=1e-9,gAr=6,bAr=6371;${fnSrc(text, 'DAr')}${fnSrc(text, 'TAr')}${fnSrc(text, 'GAr')};return {TAr,DAr,GAr};`)(
  ro, (e, c) => c.pos || null, () => 1);
const P = load(patched), O = load(original);
// Points on the equator: 1 degree of longitude = 111.19 km.
const at = (km) => [km / 111.19492664455873, 0];
const world = { world: { adjacency: { A: ['N'] } } };
const A = { key: 'A', pos: at(0) };
const dest = (key, km) => ({ key, pos: km == null ? null : at(km) });
const k = (km) => 0.1 + 0.9 / (1 + km / 1000);
for (const km of [500, 1400, 3000, 7000, 12000]) {
  const w = P.TAr(world, A, dest('X', km));
  check(Math.abs(w - k(km)) < 1e-6, `kernel at ${km} km`, w.toFixed(3));
}
check(P.TAr(world, A, dest('N', 300)) === 2 && O.TAr(world, A, dest('N', 300)) === 9, 'neighbour 2 (game 9)');
check(P.TAr(world, A, dest('X', null)) === 0.55 && P.TAr(world, A, { key: 'Y' }) === 0.55 && O.TAr(world, A, dest('X', null)) === 1, 'no position: 0.55 (game 1)');
const ratio = (T) => T(world, A, dest('X', 1400)) / T(world, A, dest('X', 7000));
check(Math.sqrt(ratio(O.TAr)) < 1.4, 'original weight ratio 1,400 vs 7,000 km under 1.4 (rooted)', Math.sqrt(ratio(O.TAr)).toFixed(2));
check(ratio(P.TAr) > 2.1 && ratio(P.TAr) < 2.4, 'patched ratio about 2.2', ratio(P.TAr).toFixed(2));
// GAr: one origin, two equal destinations at 1,400 and 7,000 km, room for everyone.
const countries = [{ key: 'A', pos: at(0), pop: 100, _pullW: 0 }, { key: 'B', pos: at(1400), pop: 100, _pullW: 50 }, { key: 'C', pos: at(7000), pop: 100, _pullW: 50 }];
const run = (G) => { const rows = G({ world: { adjacency: {} } }, countries, new Map([['A', 1]]), () => 10, new Map(), new Map());
  const by = Object.fromEntries(rows.map((r) => [r.destinationKey, r.amountM])); return by; };
const pf = run(P.GAr), of = run(O.GAr);
check(Math.abs((pf.B + pf.C) - 1) < 1e-9 && Math.abs((of.B + of.C) - 1) < 1e-9, 'all emigrants placed in both', `${(pf.B + pf.C).toFixed(6)}`);
check(Math.abs(pf.B / pf.C - ratio(P.TAr)) < 1e-6, 'patched split follows the unrooted kernel', (pf.B / pf.C).toFixed(3));
check(Math.abs(of.B / of.C - Math.sqrt(ratio(O.TAr))) < 1e-6, 'original split follows the rooted kernel', (of.B / of.C).toFixed(3));
console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
