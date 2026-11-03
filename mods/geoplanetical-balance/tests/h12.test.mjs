// H12 function test: the fertility target's income term r = k(tfr0) x ln(gdpCap / gdpCap0), patched vs original.
// Minified names in comments are those of build 26296134; the code and strings use the current build's names.
// Usage: node mods/geoplanetical-balance/tests/h12.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
// The income term's slope k: a number in the original, a function of tfr0 (day-0 fertility) in the patch.
const slopeOf = text => {
  const i = text.indexOf('function qXA('), a = text.indexOf(',r=', i) + 3, b = text.indexOf('*kXA(A)', a);
  return new Function('g', `return ${text.slice(a, b)}`);
};
const rz = text => {
  const i = text.indexOf('function kXA(');
  return new Function(`return (${text.slice(i, text.indexOf('}', i) + 1)})`)();
};
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const kP = slopeOf(patched), kV = slopeOf(original);
for (const tfr0 of [1.1, 1.6, 2, 2.25, 2.5, 3, 4.5, 7, undefined]) {
  const want = -(0.1 + 0.8 * Math.max(0, Math.min(1, (Number(tfr0) || 0) - 2)));
  check(Math.abs(kP({ tfr0 }) - want) < 1e-12, `tfr0 ${tfr0}: slope ${want.toFixed(3)}`);
  check(kV({ tfr0 }) === -1.05, `vanilla slope -1.05 at tfr0 ${tfr0}`);
}
check(kP({ tfr0: 4 }) === -0.9 && Math.abs(kP({ tfr0: 1.5 }) + 0.1) < 1e-12, 'transition countries -0.9, low-fertility countries -0.1');
const r = rz(patched);
for (const ratio of [0.5, 1, 1.344, 2, 5]) for (const tfr0 of [1.5, 2.5, 4]) {
  const A = { gdpCap: 10 * ratio, demo: { gdpCap0: 10 } };
  const want = kP({ tfr0 }) * Math.log(ratio);
  check(Math.abs(kP({ tfr0 }) * r(A) - want) < 1e-12, `income x${ratio}, tfr0 ${tfr0}: target term ${want.toFixed(3)} (vanilla ${(-1.05 * Math.log(ratio)).toFixed(3)})`);
}
check(r({ gdpCap: 10, demo: { gdpCap0: 10 } }) === 0, 'day 0 (ratio 1): term 0, unchanged');
check(rz(patched).toString() === rz(original).toString(), 'rzA itself is unchanged');
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
