// A1 function test: checks the approval coefficients, the signed election input (ewA) and the ruling-party
// multiplier D in the party-choice model, extracted from the patched and the original bundle.
// Minified names in comments are those of build 26296134; the code and strings use the current build's names.
// Usage: node mods/geoplanetical-balance/tests/a1.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;

let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const close = (a, b) => Math.abs(a - b) <= 1e-12;

// 1. Coefficients: +1.5 per point above world growth, -3 x min(Tb, 1.2) below (Tb = grievance factor n, 0.4-1.8).
check(patched.includes('RTg=1.5,XTg=3') && !patched.includes('RTg=5.4,XTg=1.8'), 'approval growth coefficients are 1.5 / 3');
check(original.includes('RTg=5.4,XTg=1.8'), 'original coefficients are 5.4 / 1.8 (test reads the right build)');
const growthTerm = text => {
  const a = text.indexOf('I+=se(g,"growth",') + 'I+=se(g,"growth",'.length, b = text.indexOf(',ne.economy,"economy")', a);
  return new Function('c', 'n', 'RTg', 'XTg', `const s=P=>P<0?P*n:P;return ${text.slice(a, b)}`);
};
const gP = growthTerm(patched), gV = growthTerm(original);
for (const s of [-8, -3, -0.5, 0, 0.5, 3, 8]) for (const n of [0.4, 1, 1.2, 1.5, 1.8]) {
  check(close(gP(s, n, 1.5, 3), s > 0 ? 1.5 * s : 3 * s * Math.min(n, 1.2)), `growth term s ${s}, Tb ${n}: +1.5 / -3 x min(Tb, 1.2)`);
  check(close(gV(s, n, 5.4, 1.8), s > 0 ? 5.4 * s : 1.8 * s * n), `vanilla growth term s ${s}, Tb ${n}: +5.4 / -1.8 x Tb`);
}
check(gP(-8, 1.8, 1.5, 3) >= -3.6 * 8 - 1e-9, 'bust capped at -3.6 per point at the highest grievance factor');

// 2. ewA: as vanilla (positive part only) before day 365; from day 365 the signed gap to the reference, floored at -3.
const ewA = text => {
  const i = text.indexOf('function zDA(');
  const src = text.slice(i, text.indexOf('}', text.indexOf('return', i)) + 1);
  return new Function('ywB', `return (${src})`)((A, B) => B.gap);
};
const ewP = ewA(patched), ewV = ewA(original);
for (const [gap, gap0] of [[2, 1], [-3, 1], [0, 0], [1, 1], [-0.5, 2.5], [-9, 1], [12, 1], [5, null]]) {
  const B = { gap, _growthGap0: gap0 ?? undefined };
  const want = gap - (Number.isFinite(gap0) ? gap0 : gap);
  for (const day of [0, 100, 364]) check(close(ewP({ day }, B), Math.max(0, want)), `ewA day ${day}: as vanilla (gap ${gap}, reference ${gap0})`);
  check(close(ewP({}, B), Math.max(0, want)), 'ewA with no day: as vanilla');
  for (const day of [365, 2000]) check(close(ewP({ day }, B), Math.max(-3, want)), `ewA day ${day}: signed, floored at -3 (gap ${gap}, reference ${gap0}) -> ${Math.max(-3, want)}`);
  check(close(ewV({ day: 2000 }, B), Math.max(0, want)), `vanilla ewA only positive: gap ${gap}, reference ${gap0}`);
}

// 2b. PEQ (daily society tick) re-takes the reference once from day 365 (marker geobalGrowthRef365), and sets it when
// missing as before.
const peqRef = text => {
  const i = text.indexOf('function EiQ(');
  const a = text.indexOf('let Q=TDA(A,B),g=oqA(A,B,Q);', i) + 'let Q=TDA(A,B),g=oqA(A,B,Q);'.length;
  const b = text.indexOf(',B._apprAnchor==null', a);
  return new Function('ywB', 'A', 'B', `${text.slice(a, b)};return B;`).bind(null, (A, B) => B.gap);
};
const refP = peqRef(patched), refV = peqRef(original);
for (const [day, had, mark, want, wantMark] of [[0, undefined, undefined, 4, undefined], [1, 2, undefined, 2, undefined], [364, 2, undefined, 2, undefined],
  [365, 2, undefined, 4, 365], [366, 2, 365, 2, 365], [800, 2, 365, 2, 365], [800, 2, undefined, 4, 800]]) {
  const B = refP({ day }, { gap: 4, _growthGap0: had, geobalGrowthRef365: mark });
  check(B._growthGap0 === want && B.geobalGrowthRef365 === wantMark, `PEQ day ${day}, reference ${had}, marker ${mark}: ${want}, marker ${wantMark}`);
}
check(refV({ day: 365 }, { gap: 4, _growthGap0: 2 })._growthGap0 === 2 && refV({ day: 0 }, { gap: 4 })._growthGap0 === 4, 'vanilla PEQ sets the reference only when missing');

// 3. D in LcA: 1 + 0.08 g for booms (as vanilla), max(0.5, 1 + 0.12 g) for busts.
const dExpr = text => {
  const i = text.indexOf('function ePA(');
  const a = text.indexOf('D=', i) + 2, b = text.indexOf(',o={}', a);
  return new Function('$vg', 'Q', `return ${text.slice(a, b)}`).bind(null, 0.08);
};
const dP = dExpr(patched), dV = dExpr(original);
for (let g = -20; g <= 20; g += 0.5) {
  const p = dP({ growthGainPct: g }), v = dV({ growthGainPct: g });
  if (g >= 0) check(close(p, v) && close(p, 1 + 0.08 * g), `D for a boom of ${g} equals vanilla`);
  else check(close(p, Math.max(0.5, 1 + 0.12 * g)) && p >= 0.5 && p < 1, `D for a bust of ${g}: loss-averse, floored at 0.5`);
}
check(close(dP({ growthGainPct: 0 }), 1) && close(dP({ growthGainPct: -1e-9 }), 1 - 0.12e-9), 'D continuous at 0');
for (const bad of [NaN, undefined, Infinity, null]) check(close(dP({ growthGainPct: bad }), 1), `D is 1 for non-finite gain ${bad}`);
check(close(dP({}), 1), 'D is 1 with no gain (valence calibration path)');

console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
