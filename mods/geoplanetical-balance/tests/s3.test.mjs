// S3 function test: the education law factor (G2A, with its law reader $uB) from the patched and the original bundle,
// over the compulsory_schooling and free_public_education laws. Usage: node mods/geoplanetical-balance/tests/s3.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const Dw = (A, B, Q) => Math.max(B, Math.min(Q, A));
const slice = (text, startText, endText) => {
  const i = text.indexOf(startText), j = text.indexOf(endText, i);
  if (i < 0 || j < 0 || j - i > 1500) throw new Error(`not found: ${startText}`);
  return text.slice(i, j + endText.length);
};
const fn = text => {
  const law = slice(text, 'function plB(', 'accessFloor:e}}');
  const g2a = slice(text, 'function N4A(', ',.65,1.35)}');
  return new Function('wg', 'n1', 'Pe', `${law};return (${g2a})`)((A, B) => A?.laws?.[B], (A, B) => A?.laws0?.[B], Dw);
};
const P = fn(patched), V = fn(original);
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const close = (a, b, tol = 1e-12) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const FREE = ['none', 'primary', 'lower_secondary', 'secondary', 'tertiary_partial', 'tertiary_full'];
const LEVELS = ['foundation', 'secondary', 'higher'];
const country = (now, then = now) => ({
  laws: { compulsory_schooling: { startAge: now.start ?? 6, endAge: now.end ?? 16 }, free_public_education: now.free ?? 'secondary' },
  laws0: { compulsory_schooling: { startAge: then.start ?? 6, endAge: then.end ?? 16 }, free_public_education: then.free ?? 'secondary' },
});

for (const free of FREE) for (const end of [10, 14, 16, 18, 20]) for (const start of [3, 6, 8]) for (const lv of LEVELS) {
  const c = country({ free, end, start });
  check(P(c, lv) === 1 && V(c, lv) === 1, `laws at day 0 (${free}, ${start}-${end}, ${lv}): factor 1`);
}
check(P({}, 'secondary') === 1 && V({}, 'secondary') === 1, 'no laws at all (game defaults): factor 1');

const sec = (end, free = 'secondary', end0 = 16, free0 = 'secondary') => [P(country({ end, free }, { end: end0, free: free0 }), 'secondary'), V(country({ end, free }, { end: end0, free: free0 }), 'secondary')];
let [p, v] = sec(18);
check(v === 1 && close(p, Math.sqrt(0.89 / 0.71)), `leaving age 16 -> 18 under free secondary: original 1, now ${p.toFixed(4)}`);
[p, v] = sec(17);
check(v === 1 && close(p, Math.sqrt(0.8 / 0.71)) && p > 1.05 && p < 1.07, `16 -> 17: about +6% (${p.toFixed(4)})`);
[p, v] = sec(14);
check(v === 1 && close(p, Math.sqrt(0.53 / 0.71)), `16 -> 14: about -14% (${p.toFixed(4)})`);
[p, v] = sec(16, 'primary');
check(close(v, 0.71 / 0.96) && p === 0.65, `free secondary removed (to primary): original ${v.toFixed(3)}, now the 0.65 floor`);
[p, v] = sec(18, 'primary', 16, 'primary');
check(close(v, 0.89 / 0.71) && close(p, Math.sqrt(0.89 / 0.71)), `free primary only, 16 -> 18: original ${v.toFixed(3)} (compulsion dominated), now ${p.toFixed(3)}`);
[p, v] = sec(14, 'primary', 16, 'primary');
check(close(v, 0.53 / 0.71) && close(p, Math.sqrt(0.53 / 0.71)), `free primary only, 16 -> 14: original ${v.toFixed(3)}, now ${p.toFixed(3)}`);
[p, v] = sec(16, 'lower_secondary', 10, 'lower_secondary');
check(v === 1 && p === 1.35, `short compulsion (10) and free lower secondary, 10 -> 16: original 1, now the 1.35 ceiling`);
[p, v] = sec(16, 'tertiary_full');
check(p === v && p === 1, 'free level raised above secondary: no secondary change, as before');
[p, v] = sec(16, 'secondary', 16, 'none');
check(p === v && p === 1.35, 'free secondary introduced where none: the 1.35 ceiling, as before');

// Higher education has no compulsion term: only the free level moves it, as in the original.
for (const free of FREE) for (const free0 of FREE) for (const end of [10, 16, 20]) {
  const c = country({ free, end }, { free: free0, end: 16 });
  check(close(P(c, 'higher'), V(c, 'higher')), `higher, free ${free0} -> ${free}, leaving age ${end}: unchanged`);
}
// Foundation: compulsion adds a little through the length of compulsory schooling.
const f = P(country({ end: 18 }, { end: 16 }), 'foundation');
check(close(f, Math.sqrt(0.988 / 0.96)) && close(V(country({ end: 18 }, { end: 16 }), 'foundation'), 0.988 / 0.96), `foundation, leaving age 16 -> 18: a small rise, the square root of the original's (${f.toFixed(4)})`);
// Every combination stays inside the game clamp and is finite.
for (const lv of LEVELS) for (const free of FREE) for (const free0 of FREE) for (const end of [10, 14, 16, 20]) for (const end0 of [10, 16, 20]) {
  const x = P(country({ free, end }, { free: free0, end: end0 }), lv);
  check(Number.isFinite(x) && x >= 0.65 && x <= 1.35, `${lv} ${free0}/${end0} -> ${free}/${end}: inside [0.65, 1.35]`);
}
// A longer compulsory schooling never lowers access.
for (const lv of LEVELS) for (const free of FREE) for (let end = 10; end < 20; end++) {
  check(P(country({ free, end: end + 1 }, { free, end: 16 }), lv) >= P(country({ free, end }, { free, end: 16 }), lv) - 1e-15, `${lv}, ${free}: leaving age ${end} -> ${end + 1} never lowers access`);
}

console.log(failures ? `${failures} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
