// P2 function test: slices the law commit ($Lg), the adoption preview (KwA) and the new __geobalHabCarry out of the
// patched bundle, and $Lg and KwA out of the original, and runs them with stubs for the law catalogue (HQ), positions
// (PQ: a law value's 0-100 score) and the domain bridge. Checks habituation is kept, scaled by 1 - |position change| /
// 100, cleared on a return to or a crossing of the day-0 setting, at extreme and malformed inputs, and that the preview
// follows the commit. Minified names are those of build 26318758.
// Usage: node mods/geoplanetical-balance/tests/p2.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const slice = (text, from, to) => {
  const a = text.indexOf(from), b = text.indexOf(to, a + 1);
  if (a < 0 || b < 0 || b - a > 20000) throw new Error(`cannot slice ${from} .. ${to}`);
  return text.slice(a, b);
};

// Law values are numbers (their position) or objects { pos, ... } whose other fields do not move the position.
const pos = v => (v && typeof v === 'object' ? Number(v.pos) : Number(v));
const stubs = {
  HQ: id => (id === 'unknown' ? undefined : { id }),
  PQ: (law, value) => pos(value),
  xw: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  og: v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v))),
  Sw: (law, value) => value,
  c4: (A, B) => Object.assign({}, A, B),
  uaQ: () => ({}), yaQ: null, KaQ: null, PaQ: () => ({}), vaQ: () => ({ ack: true }),
  ZvA: () => ({ handled: true, ok: true }),
};
const args = 'const {HQ:TQ,PQ:YQ,xw:rr,og:ig,Sw:wr,c4:In,uaQ:Q9Q,yaQ:v9Q,KaQ:M9Q,PaQ:g9Q,vaQ:C9Q,ZvA:mfA}=stubs;';
const P = new Function('stubs', `${args}${slice(patched, 'function __geobalHabCarry(', 'function Wd(')}` +
  `${slice(patched, 'function VSg(', 'function ZSg(')}return {carry:__geobalHabCarry,preview:xDA,commit:VSg};`)(stubs);
const O = new Function('stubs', `${args}${slice(original, 'function xDA(', 'function Wd(')}` +
  `${slice(original, 'function VSg(', 'function ZSg(')}return {preview:xDA,commit:VSg};`)(stubs);
if (!slice(patched, 'function VSg(', 'function ZSg(').includes('__geobalHabCarry(B.lawHabituation,B,e.id,D,o)')) throw new Error('VSg not patched');

let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };
const close = (a, b) => Math.abs(a - b) <= 1e-12;
const country = (law0, law, h, extra = {}) => ({
  laws0: { x: law0, y: 10 }, laws: { x: law, y: 30 }, lawHabituation: { ...(h === undefined ? {} : { x: h }), y: 0.3 }, ...extra,
});
const commit = (impl, c, target) => impl.commit({}, c, 'x', target, { procedure: { id: 'p', kind: 'law' } });

// 1. Scaling through a commit: h x max(0, 1 - |position change| / 100); cleared on a return to or a crossing of day 0.
const table = [
  ['tiny amendment (+1)', 50, 80, 81, 0.5 * 0.99],
  ['small amendment back toward day 0 (-20)', 50, 80, 60, 0.5 * 0.8],
  ['further in the same direction (+20)', 50, 80, 100, 0.5 * 0.8],
  ['half-range reform (+50)', 0, 30, 80, 0.5 * 0.5],
  ['back to the day-0 setting', 50, 80, 50, null],
  ['across the day-0 position', 50, 80, 40, null],
  ['full-range move (100)', -10, 0, 100, null],
  ['beyond the nominal range (150)', -10, 0, 150, null],
  ['below day 0, small move', 50, 20, 25, 0.5 * 0.95],
];
for (const [label, law0, from, to, expected] of table) {
  const c = country(law0, from, 0.5);
  const r = commit(P, c, to);
  check(c.laws.x === to && r.target === to, `${label}: law committed`);
  check(expected === null ? !('x' in c.lawHabituation) : close(c.lawHabituation.x, expected), `${label}: habituation`, `${c.lawHabituation.x} vs ${expected}`);
  check(c.lawHabituation.y === 0.3, `${label}: other laws untouched`);
  const o = country(law0, from, 0.5);
  commit(O, o, to);
  check(!('x' in o.lawHabituation) && o.lawHabituation.y === 0.3, `${label}: original clears the law's habituation`);
}
// The exploit closed: the law's weight in approval is importance x (1 - h) (j8). A habituated popular law (h = 0.5)
// amended by one point weighs 1.0 in the original (full effect restored) and 0.505 with the patch.
{
  const c = country(50, 80, 0.5), o = country(50, 80, 0.5);
  commit(P, c, 81); commit(O, o, 81);
  const weight = x => 1 - (x.lawHabituation.x ?? 0);
  check(close(weight(o), 1) && close(weight(c), 0.505), 'amendment weight: original 1.0, patched 0.505', `${weight(o)} / ${weight(c)}`);
}

// 2. Edge cases of the stored value and the inputs (helper called directly).
const carry = (h, law0, from, to, id = 'x', extra = {}) => {
  const H = h === undefined ? { y: 0.3 } : { x: h, y: 0.3 };
  const C = { laws0: law0 === undefined ? {} : { x: law0 }, ...extra };
  P.carry(H, C, id, from, to);
  return H;
};
check(!('x' in carry(undefined, 50, 80, 81)), 'no habituation: none created');
for (const bad of [null, NaN, 'x', {}, Infinity]) check(!('x' in carry(bad, 50, 80, 81)), `habituation ${String(bad)}: cleared as before`);
check(close(carry('0.5', 50, 80, 81).x, 0.495), 'numeric string read as a number');
check(close(carry(1.7, 50, 80, 81).x, 0.99), 'habituation above 1 clamped to 1 before scaling');
check(carry(-0.3, 50, 80, 81).x === 0, 'negative habituation clamped to 0');
check(carry(0, 50, 80, 81).x === 0, 'zero habituation stays 0');
check(close(carry(1, 50, 80, 81).x, 0.99), 'full habituation scaled');
{
  const H = { unknown: 0.5 };
  P.carry(H, { laws0: { unknown: 1 } }, 'unknown', 2, 3);
  check(!('unknown' in H), 'law not in the catalogue: cleared as before');
}
check(!('x' in carry(0.5, undefined, 80, 81)), 'no day-0 value: cleared as before');
check(!('x' in carry(0.5, null, 80, 81)), 'null day-0 value: cleared as before');
check(!('x' in carry(0.5, 50, 'nan', 81)), 'position not a number (old): cleared');
check(!('x' in carry(0.5, 50, 80, 'nan')), 'position not a number (new): cleared');
check(close(carry(0.5, 'nan', 80, 81).x, 0.495), 'day-0 position not a number: scaling only (no crossing test)');
// A value whose position sits on the day-0 position but differs in another field: not a crossing, scaled.
check(close(carry(0.5, { pos: 50, k: 1 }, { pos: 80, k: 1 }, { pos: 50, k: 2 }).x, 0.5 * 0.7), 'on the day-0 position, other field differs: scaled');
check(!('x' in carry(0.5, { pos: 50, k: 1 }, { pos: 80, k: 1 }, { pos: 50, k: 1 })), 'object value equal to day 0: cleared');
check(close(carry(0.5, { pos: 50, k: 1 }, { pos: 80, k: 1 }, { pos: 80, k: 3 }).x, 0.5), 'same position, other field changed: kept in full');
// Deterministic: the same inputs give the same output.
check(carry(0.37, 12, 40, 47).x === carry(0.37, 12, 40, 47).x, 'deterministic');

// 3. The commit's other behaviour is unchanged.
{
  const c = country(50, 80, 0.5), o = country(50, 80, 0.5);
  const rp = commit(P, c, 81), ro = commit(O, o, 81);
  check(JSON.stringify(rp) === JSON.stringify(ro) && Object.isFrozen(rp), 'commit returns the same result');
  check(JSON.stringify(c.laws) === JSON.stringify(o.laws), 'commit writes the same laws');
  let threw = '';
  try { commit(P, country(50, 80, 0.5), 80); } catch (e) { threw = e.message; }
  check(threw === 'law-runtime:commit_unchanged:x', 'unchanged value still refused', threw);
  const n = { laws0: { x: 50 }, laws: { x: 80 } };
  commit(P, n, 81);
  check(!('lawHabituation' in n), 'country without lawHabituation: none created');
}

// 4. The preview (KwA) follows the commit, on a copy: the country itself is not modified.
{
  const c = country(50, 80, 0.5);
  const before = JSON.stringify(c);
  const v = P.preview(c, 'x', 81);
  check(JSON.stringify(c) === before, 'preview leaves the country unchanged');
  check(v.laws.x === 81 && close(v.lawHabituation.x, 0.495) && v.lawHabituation.y === 0.3, 'preview: law set, habituation scaled like the commit');
  const committed = country(50, 80, 0.5);
  commit(P, committed, 81);
  check(close(committed.lawHabituation.x, v.lawHabituation.x), 'preview habituation equals the committed one');
  const o = O.preview(country(50, 80, 0.5), 'x', 81);
  check(!('x' in o.lawHabituation), 'original preview clears it');
  const w = P.preview({ laws0: { x: 50 }, laws: { x: 80 } }, 'x', 81);
  check(!('lawHabituation' in w) && w.laws.x === 81, 'preview without habituation: no lawHabituation key, as the original');
  check(!('x' in P.preview(country(50, 80, 0.5), 'x', 50).lawHabituation), 'preview of a return to day 0 clears it');
  const raw = { pos: 81 };
  const r = P.preview(country({ pos: 50 }, { pos: 80 }, 0.5), 'x', raw);
  check(r.laws.x !== raw && close(r.lawHabituation.x, 0.495), 'preview copies the target (og) and scales');
}

console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
