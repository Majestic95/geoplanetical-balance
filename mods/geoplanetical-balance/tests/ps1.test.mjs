// PS1 function test: the sickness-claims index (Bb, health.social.sicknessClaimsIndex) from the patched and the original
// bundle, evaluated as the game's own expression with stubbed health state, and compared with the L2 hours formula.
// Usage: node mods/geoplanetical-balance/tests/ps1.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const clamp = (A, B, Q) => Math.max(B, Math.min(Q, A)), Ng = (A, B = 0) => Number.isFinite(A) ? A : B;
const pn = Object.freeze(['primary', 'hospital', 'emergency', 'maternal']);
const W = { primary: 1.4, hospital: 5, emergency: 3, maternal: 2.5 };
const expr = text => {
  const i = text.indexOf('sicknessClaimsIndex:'), j = text.indexOf(',.4,3)', i);
  if (i < 0 || j < 0 || j - i > 600) throw new Error('sickness-claims expression not found');
  const src = text.slice(i + 'sicknessClaimsIndex:'.length, j + ',.4,3)'.length);
  return new Function('ame', 'Ur', 'Bh', `return t=>${src}`)(clamp, Ng, pn);
};
const hours = text => {
  const i = text.indexOf('t.sickDaysPer100kYear=f,t.laborHoursIndex=vn('), j = text.indexOf(',.94,1.015)', i);
  if (i < 0 || j < 0 || j - i > 600) throw new Error('labour-hours expression not found');
  return new Function('vn', 'Ur', 'pYt', 'Bh', `return (t,f,e)=>{${text.slice(i, j + ',.94,1.015)'.length)};return t.laborHoursIndex}`)(clamp, Ng, A => A.gambling ?? 0, pn);
};
const P = expr(patched), V = expr(original), H = hours(patched);
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const close = (a, b) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));
const need0 = { primary: 285, hospital: 7.8, emergency: 13.5, maternal: 1.6 };
const N0 = pn.reduce((a, u) => a + need0[u] * W[u], 0);
const state = (s, s0, need = need0) => ({
  sickDaysPer100kYear: s, seed: { sickDays0Per100kYear: s0 }, behavioral: {},
  lines: Object.fromEntries(pn.map(u => [u, { need0Per100k: need[u], unmetRate: 0.1 }])),
});

// The patch is what changed, and the premises it relies on still hold.
check(patched !== original && patched.includes('__geobalN>0?1+1.5*'), 'the patch is in the built bundle');
check(/case"sickness":return \w+\(e\?\.health\?\.social\?\.sicknessClaimsIndex,1\)/.test(patched), 'the spending reader still defaults a missing value to 1');

// Day 0.
for (const s0 of [0.01 * N0, 79.6, 0.3 * N0]) check(P(state(s0, s0)) === 1 && V(state(s0, s0)) === 1, `day 0 (s = s0 = ${s0.toPrecision(3)}): 1 in both`);
// A country with almost no untreated illness at day 0: the original's 1e-9 guard made the ratio tiny, so it sat at the floor.
check(P(state(1e-12, 1e-12)) === 1, 'day 0 with almost no untreated illness: patched 1');
check(V(state(1e-12, 1e-12)) === 0.4, 'day 0 with almost no untreated illness: original at the 0.4 floor');

// The reported case: Germany, 79.5 -> 153.4 measured on 26335289.
const de = state(153.4, 79.5);
check(close(V(de), 153.4 / 79.5), 'original: the German case is the ratio', V(de).toFixed(3));
check(V(de) > 1.9, 'original: the bill nearly doubles', V(de).toFixed(3));
check(close(P(de), 1 + 1.5 * (153.4 - 79.5) / N0), 'patched: 1 + 1.5 x rise / day-0 need', P(de).toFixed(3));
check(P(de) > 1.1 && P(de) < 1.3, 'patched: about +20%, not about +90%', P(de).toFixed(3));

// Same extra burden, same rise, from any starting level; the original fails this, which proves the check can fail.
const a = P(state(0.03 * N0 + 40, 0.03 * N0)), b = P(state(0.3 * N0 + 40, 0.3 * N0));
check(close(a, b) && a > 1, '+40 untreated: the same rise from a low and a high starting level', a.toFixed(4));
check(V(state(0.03 * N0 + 40, 0.03 * N0)) > 2 * V(state(0.3 * N0 + 40, 0.3 * N0)) - 1, 'original: the low starting level rises far more');

// It tracks the L2 hours: index - 1 is 1.5 / 0.06 = 25 times the hours lost, while the hours stay in their clamp.
for (const x of [0.02, 0.1, 0.4]) {
  const s0 = 0.1 * N0, s = s0 + x * N0, st = state(s, s0), lost = 1 - H(st, s, { gambling: 0 });
  check(close(P(st) - 1, 25 * lost), `untreated share +${x * 100} points: the bill moves 25 x the hours lost`, `${(P(st) - 1).toFixed(4)} vs ${lost.toFixed(5)}`);
}
// Untreated epidemic cases raise claims but not hours (the epidemic model already moves those hours).
{
  const s0 = 0.1 * N0, extra = 30 * 0.4 * 5, st = { ...state(s0 + extra, s0), epidemicHospitalNeedPer100k: 30 };
  st.lines = { ...st.lines, hospital: { ...st.lines.hospital, unmetRate: 0.4 } };
  check(close(H(st, s0 + extra, { gambling: 0 }), 1), 'epidemic cases untreated: no hours lost (L2 unchanged)');
  check(P(st) > 1, 'epidemic cases untreated: the bill still rises', P(st).toFixed(4));
}

// Better access: smaller reward, and no free fall to the floor.
check(close(P(state(0.5 * 0.05 * N0, 0.05 * N0)), 1 - 1.5 * 0.025), 'untreated illness halved in a rich country: a small saving', P(state(0.5 * 0.05 * N0, 0.05 * N0)).toFixed(4));
check(V(state(0.1, 0.05 * N0)) === 0.4, 'original: the same improvement could reach the 0.4 floor');
check(P(state(0, 0.05 * N0)) > 0.9, 'patched: no untreated illness at all stays above 0.9 in a rich country', P(state(0, 0.05 * N0)).toFixed(4));

// Extremes and bad input.
check(P(state(100 * N0, 0.1 * N0)) === 3, 'collapse: held at the game ceiling of 3');
check(P(state(0, 10 * N0)) === 0.4, 'far better than an unusually high start: held at the game floor of 0.4');
const noNeed = { primary: 0, hospital: 0, emergency: 0, maternal: 0 };
check(P(state(500, 10, noNeed)) === 1, 'no day-0 need recorded: 1');
{
  const st = state(500, 10); delete st.lines;
  check(P(st) === 1, 'no care lines at all: 1, no throw');
  const st2 = state(500, 10); delete st2.lines.hospital;
  check(Number.isFinite(P(st2)) && P(st2) > 1, 'one care line missing: measured on the others, no throw', P(st2).toFixed(3));
  const st3 = state(500, 10); st3.lines.primary.need0Per100k = NaN;
  check(Number.isFinite(P(st3)), 'a non-finite need counts as 0', P(st3).toFixed(3));
}
check(Number.isNaN(P(state(undefined, 10))) && Number.isNaN(V(state(undefined, 10))), 'no monthly value yet: NaN in both, and the reader turns it into 1');
let inClamp = true, mono = true, prev = -Infinity;
for (let s = 0; s <= 3 * N0; s += N0 / 37) { const x = P(state(s, 0.1 * N0)); if (!(x >= 0.4 && x <= 3)) inClamp = false; if (x < prev) mono = false; prev = x; }
check(inClamp, 'inside the game clamp on a grid');
check(mono, 'more untreated illness never lowers the bill');

console.log(failures ? `${failures} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
