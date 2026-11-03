// L2 function test: the health labour-hours index (hGg, health.laborHoursIndex) from the patched and the original
// bundle, evaluated as the game's own expression with stubbed health state.
// Usage: node mods/geoplanetical-balance/tests/l2.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const qC = (A, B, Q) => Math.max(B, Math.min(Q, A)), Ng = (A, B = 0) => Number.isFinite(A) ? A : B;
const pn = Object.freeze(['primary', 'hospital', 'emergency', 'maternal']);
const W = { primary: 1.4, hospital: 5, emergency: 3, maternal: 2.5 };
const expr = text => {
  const i = text.indexOf('B.sickDaysPer100kYear=c,B.laborHoursIndex=bC('), j = text.indexOf(',.94,1.015)', i);
  if (i < 0 || j < 0 || j - i > 600) throw new Error('labour-hours expression not found');
  const src = text.slice(i, j + ',.94,1.015)'.length);
  return new Function('bC', '$g', 'ImB', 'Gs', `return (B,c,A)=>{${src};return B.laborHoursIndex}`)(qC, Ng, A => A.gambling ?? 0, pn);
};
const P = expr(patched), V = expr(original);
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const close = (a, b) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));
// Day-0 need per line (per 100k per month) and unmet share; s0 from the same weights, as iJ computes it.
const need0 = { primary: 285, hospital: 7.8, emergency: 13.5, maternal: 1.6 };
const N0 = pn.reduce((a, u) => a + need0[u] * W[u], 0);
const state = ({ s0, behavioral = 0, epi, hospUnmet = 0.1 }) => ({
  seed: { sickDays0Per100kYear: s0 }, behavioral: { laborHoursDelta: behavioral },
  lines: Object.fromEntries(pn.map(u => [u, { need0Per100k: need0[u], unmetRate: u === 'hospital' ? hospUnmet : 0.1 }])),
  ...(epi === undefined ? {} : { epidemicHospitalNeedPer100k: epi }),
});
const run = (f, o, s, gambling = 0) => f(state(o), s, { gambling });

for (const s0 of [0.03 * N0, 0.1 * N0, 0.3 * N0]) {
  check(run(P, { s0 }, s0) === 1 && run(V, { s0 }, s0) === 1, `day 0 (s = s0 = ${s0.toFixed(1)}): 1 in both`);
  check(Math.abs(run(V, { s0 }, s0 + 0.9 * N0) - 1) < 2e-4, `original: almost all care unmet moves hours under 0.0002 (s0 ${s0.toFixed(1)})`);
  check(close(run(P, { s0 }, s0 + 0.1 * N0), 0.994), `untreated share +10 points of all illness: 0.6% fewer hours (s0 ${s0.toFixed(1)})`);
  check(run(P, { s0 }, s0 + 1.2 * N0) === 0.94, `collapse beyond all day-0 illness: held at the 6% floor (s0 ${s0.toFixed(1)})`);
  check(close(run(P, { s0 }, s0 - 0.1 * N0), 1.006), `untreated share -10 points: +0.6% (s0 ${s0.toFixed(1)})`);
  check(run(P, { s0 }, s0 - 0.5 * N0) === 1.015, `far better access: held at the +1.5% ceiling (s0 ${s0.toFixed(1)})`);
  check(close(run(P, { s0, behavioral: 0.004 }, s0 + 0.1 * N0), 0.99) && close(run(V, { s0, behavioral: 0.004 }, s0), 0.996), `behavioural deduction still applies (s0 ${s0.toFixed(1)})`);
  check(close(run(P, { s0 }, s0, 0.002), run(V, { s0 }, s0, 0.002)), `gambling deduction unchanged (s0 ${s0.toFixed(1)})`);
}
// The same extra untreated burden costs the same hours whatever the starting level.
const a = run(P, { s0: 0.03 * N0 }, 0.03 * N0 + 40), b = run(P, { s0: 0.3 * N0 }, 0.3 * N0 + 40);
check(close(a, b) && a < 1, `+40 untreated: the same loss from a low and a high starting level (${a.toFixed(5)})`);
// Untreated epidemic hospital cases are left out: the epidemic model already takes them out of work.
const s0 = 0.1 * N0, epi = 30, hospUnmet = 0.4, extra = epi * hospUnmet * 5;
check(close(run(P, { s0, epi, hospUnmet }, s0 + extra), 1), 'epidemic hospital cases untreated: no extra hours lost');
check(close(run(P, { s0, epi, hospUnmet }, s0 + extra + 0.1 * N0), 0.994), 'epidemic plus other untreated illness: only the other part counts');
check(close(run(P, { s0, epi: -20, hospUnmet }, s0 - 20 * hospUnmet * 5), 1), 'calm epidemic month (negative excess need lowers s): nothing added back');
check(close(run(P, { s0, epi: NaN, hospUnmet }, s0 + 0.1 * N0), 0.994), 'no epidemic field: treated as none');
// Edge cases.
check(run(P, { s0: 0 }, 50) < 1 && Number.isFinite(run(P, { s0: 0 }, 50)), 's0 = 0 with day-0 need: still measured against need');
const noNeed = state({ s0: 10 }); for (const u of pn) noNeed.lines[u].need0Per100k = 0;
check(P(noNeed, 500, { gambling: 0 }) === 1, 'no day-0 need recorded: no health term');
for (let s = 0; s <= 3 * N0; s += N0 / 37) {
  const x = run(P, { s0: 0.1 * N0 }, s);
  check(x >= 0.94 && x <= 1.015 && Number.isFinite(x), `s ${s.toFixed(1)}: inside the game clamp`);
}
for (let s = 0; s < N0; s += N0 / 20) check(run(P, { s0: 0.1 * N0 }, s) >= run(P, { s0: 0.1 * N0 }, s + N0 / 20), `s ${s.toFixed(1)}: more untreated care never adds hours`);

console.log(failures ? `${failures} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
