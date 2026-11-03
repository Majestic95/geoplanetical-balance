// C6 function test: sector transfer value (RGg), patched vs original, with stubbed aggregate and multiple.
// Minified names in comments are those of build 26296134; the code and strings use the current build's names.
// Usage: node mods/geoplanetical-balance/tests/c6.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const rgg = (text, agg, multiple) => {
  const a = text.indexOf('function Rxg('), b = text.indexOf('}}', a) + 2;
  if (a < 0 || b - a > 400) throw new Error('RGg not found');
  const Tt = (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d), round = x => Math.round(x * 1e6) / 1e6;
  return new Function('mI', 'kt', 'l7B', 'AA', `${text.slice(a, b)};return Rxg;`)(() => agg, Tt, () => multiple, round);
};
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const value = (text, profit, capital, m = 8) => rgg(text, { operatingProfitBnY: profit, productiveCapitalBn: capital }, m)(null, '756', 'tech', 3).valueBn;
// The cliff: original value jumps from 35 (profit 0) to 0.08 (profit 0.01); patched never drops below the floor.
check(value(original, 0, 100) === 35 && value(original, 0.01, 100) < 1, 'original has the cliff (control)');
for (const profit of [-5, 0, 0.01, 1, 4.375, 10, 50]) for (const capital of [0, 100, 1000]) for (const m of [4, 8, 15]) {
  const want = Math.round(Math.max(Math.max(0, profit) * m, 0.35 * capital) * 1e6) / 1e6;
  const got = value(patched, profit, capital, m), orig = value(original, profit, capital, m);
  check(got === want, `profit ${profit} capital ${capital} x${m}: ${want} (got ${got})`);
  check(got >= orig, `profit ${profit} capital ${capital} x${m}: never below the original price`);
  if (profit * m >= 0.35 * capital && profit > 0) check(got === orig, `profit ${profit} capital ${capital} x${m}: profitable sector priced as before`);
}
check(value(patched, NaN, 100) === 35 && value(patched, 1, NaN) === 8, 'non-finite inputs fall back as before');
const r = rgg(patched, { operatingProfitBnY: 2, productiveCapitalBn: 10 }, 6)(null, '756', 'tech', 3);
check(r.surplusBnY === 2 && r.multiple === 6, 'surplus and multiple unchanged');
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
