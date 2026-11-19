// SC20 function test: the opposed-landing check (ete, with its weights Zgt/Qgt and the factor table OBe) is sliced
// from the patched and unmodded bundles and run with stubbed formations. Checks the power ratio a landing needs to win
// with and without air superiority, that shore fire still adds, and that only the two factors changed.
// Usage: node mods/geoplanetical-balance/tests/sc20.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

const slice = (text, from, to) => {
  const a = text.indexOf(from), b = text.indexOf(to, a + 1);
  if (a < 0 || b < 0 || b - a > 6000 || text.indexOf(from, a + 1) >= 0) throw new Error(`slice ${from}`);
  return text.slice(a, b);
};
const load = (text) => {
  const tbl = slice(text, 'var OBe=Object.freeze({attackFactor:', 'function f6o(');
  const weights = slice(text, 'function Zgt(', 'function ete(');
  const ete = slice(text, 'function ete(', 'function Jgt(');
  // Em: the game's air multipliers (read from the bundle); gUa: the side's air superiority 0..1 (stubbed by war.air);
  // KK: a formation's land power; f6o: naval shore fire; ps: distance in km.
  const em = slice(text, 'Em=Object.freeze({homeDefense:', ';function uh(');
  return new Function('KK', 'f6o', 'ps', `const ${em};const gUa=(e,t)=>e.air||0;${tbl};${weights};${ete};return {ete,OBe};`)(
    (e, f) => f.power, (e, ships) => ships.reduce((s, x) => s + x.fire, 0), () => 0);
};
const P = load(patched), O = load(original);
// One attacking formation of power A against one defender in reach of power D (defender hold = D).
const run = (L, A, D, air = 0, fire = 0) => L.ete({}, { air }, 'A', [{ power: A }], [{ ll: [0, 0], reachKm: 100, hold: D, f: { manpowerK: 1 } }], [0, 0], fire ? [{ fire }] : []);
const wins = (L, A, D, air) => run(L, A, D, air).holds;

check(O.OBe.attackFactor === 0.6 && O.OBe.defenseFactor === 0.8, 'original factors 0.6 / 0.8');
check(P.OBe.attackFactor === 0.4 && P.OBe.defenseFactor === 1, 'patched factors 0.4 / 1');
check(P.OBe.assaultDays === O.OBe.assaultDays && JSON.stringify(P.OBe.shoreFire) === JSON.stringify(O.OBe.shoreFire), 'assault window and shore fire unchanged');
// Without air control: original wins above 1.33x, patched needs above 2.5x.
check(wins(O, 1.4, 1, 0) && !wins(O, 1.3, 1, 0), 'original: 1.4x wins, 1.3x fails (threshold 1.33x)');
check(!wins(P, 2.4, 1, 0) && wins(P, 2.6, 1, 0), 'patched: 2.4x fails, 2.6x wins (threshold 2.5x)');
// Full air superiority: original wins outnumbered (0.8x), patched needs about 1.39x.
check(wins(O, 0.8, 1, 1), 'original: an outnumbered landing (0.8x) wins under full air superiority');
check(!wins(P, 0.8, 1, 1) && !wins(P, 1.35, 1, 1) && wins(P, 1.45, 1, 1), 'patched: 0.8x and 1.35x fail, 1.45x wins under full air superiority');
// Shore fire still adds to the attack after the factor.
const r0 = run(P, 1, 1, 0, 0), r1 = run(P, 1, 1, 0, 0.5);
check(Math.abs(r1.attack - r0.attack - 0.5) < 1e-12 && r1.shoreFire === 0.5, 'shore fire adds after the factor', JSON.stringify([r0.attack, r1.attack]));
// Ratio reported as attack / defense.
const r = run(P, 3, 1, 0);
check(Math.abs(r.ratio - 1.2) < 1e-12 && r.holds, 'ratio = 0.4 x 3 / 1', String(r.ratio));

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
