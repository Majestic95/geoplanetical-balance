// A5/C9 function test: sector efficiency by public share (IbA), and the three later steps that used to clamp it to 1
// (stored efficiency in qaQ, the per-sector map in MrA, the production factor), patched vs original.
// Minified names in comments are those of build 26296134; the code and strings use the current build's names.
// Usage: node mods/geoplanetical-balance/tests/a5-c9.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const ibA = text => {
  const a = text.indexOf('var Zeg=Object.freeze('), b = text.indexOf('var k7B=', a);
  const PP = (x, lo, hi) => Math.max(lo, Math.min(hi, x)), n6 = (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d);
  return new Function('P7', 'mE', `${text.slice(a, b)};return TyA;`)(PP, n6);
};
const p = ibA(patched), v = ibA(original);
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const close = (a, b) => Math.abs(a - b) < 1e-12;
const F = { tech: 0.22, trade: 0.16, industry: 0.12, health: 0 };
for (const [sector, f] of Object.entries(F)) {
  for (const s0 of [0, 0.3, 0.6, 1]) {
    check(close(p(sector, s0, s0), 1) && close(v(sector, s0, s0), 1), `${sector}: day 0 (share = share0 ${s0}) gives 1`);
    for (const s of [0, 0.2, 0.5, 0.8, 1]) {
      const want = Math.max(Math.max(0.55, 1 - 1.6 * f), Math.min(Math.max(1, 1 / (1 - f * s0 * s0)), (1 - f * s * s) / (1 - f * s0 * s0)));
      check(close(p(sector, s, s0), want), `${sector} ${s0} -> ${s}: ${want.toFixed(4)} (original ${v(sector, s, s0).toFixed(4)})`);
      if (s >= s0) check(close(p(sector, s, s0), v(sector, s, s0)), `${sector} ${s0} -> ${s}: nationalisation unchanged`);
    }
  }
}
check(close(p('tech', 0, 0.6), 1 / (1 - 0.22 * 0.36)) && p('tech', 0, 0.6) > 1.08, 'tech 60% -> 0%: about +8.6%');
check(close(p('tech', 0.3, 0.6, 0.05), p('tech', 0.3, 0.6) - 0.05), 'memory term still subtracts');

// The later steps: values above 1 now pass through (up to 1.3); below 1 as before.
const qaQ = text => {
  const i = text.indexOf('function d5Q('), j = text.indexOf('}C6A(B)}', i) + 8;
  return new Function('so', 'mI', 'TyA', 'ifA', 'OfA', 'JoA', 'GRg', 'C6A', `${text.slice(i, j)};return d5Q;`);
};
const WD = (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d), lvA = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
for (const [label, text] of [['patched', patched], ['original', original]]) {
  const run = target => {
    const B = { key: '756', sectorOwnership: { tech: { efficiency: 1, memory: {} } } };
    qaQ(text)(WD, () => ({ publicShare: 0, publicShare0: 0.6 }), () => target, () => 0, lvA, m => m, 0.5, () => {})({ day: 10 }, B);
    return B.sectorOwnership.tech.efficiency;
  };
  if (label === 'patched') {
    check(close(run(1.086), 1.043), 'qaQ: efficiency moves toward a target above 1 (half way at speed 0.5)');
    check(close(run(2), 1.3), 'qaQ: clamped at 1.3');
    check(close(run(0.8), 0.9), 'qaQ: below 1 as before');
  } else check(close(run(1.086), 1), 'qaQ original clamps at 1 (control)');
}
const mrA = text => { const i = text.indexOf('function C6A('), j = text.indexOf('var GRg=', i); return new Function('so', `${text.slice(i, j)};return C6A;`)(WD); };
{
  const A = () => ({ we: {}, sectorOwnership: { tech: { efficiency: 1.05 }, trade: { efficiency: 1 }, industry: { efficiency: 0.9 } } });
  const a = A(); mrA(patched)(a);
  check(JSON.stringify(a.we.ownershipSectorEfficiency) === JSON.stringify({ industry: 0.9, tech: 1.05 }), 'MrA passes values above and below 1, not 1');
  const b = A(); mrA(original)(b);
  check(JSON.stringify(b.we.ownershipSectorEfficiency) === JSON.stringify({ industry: 0.9 }), 'MrA original drops values above 1 (control)');
  const c = { we: { ownershipSectorEfficiency: { x: 1 } }, sectorOwnership: { tech: { efficiency: 1 } } }; mrA(patched)(c);
  check(!('ownershipSectorEfficiency' in c.we), 'MrA: all at 1 leaves no map (day 0)');
}
{
  const reader = text => text.slice(text.indexOf('m=e?1:vg(Number.isFinite(A.ownershipSectorEfficiency'), text.indexOf(',y=e?1:vg(Number.isFinite(A.employerLockoutAvailability'));
  const f = text => new Function('e', 'A', 'B', 'We', 'vg', `let ${reader(text)};return m;`);
  const Cg = (x, lo, hi) => Math.max(lo, Math.min(hi, x)), A = v => ({ ownershipSectorEfficiency: { tech: v } });
  check(close(f(patched)(false, A(1.086), 0, ['tech'], Cg), 1.086) && close(f(original)(false, A(1.086), 0, ['tech'], Cg), 1), 'production factor: 1.086 reaches production (original: 1)');
  check(close(f(patched)(false, A(5), 0, ['tech'], Cg), 1.3) && close(f(patched)(false, A(0.7), 0, ['tech'], Cg), 0.7) && f(patched)(true, A(1.1), 0, ['tech'], Cg) === 1, 'production factor: capped at 1.3, below 1 and the exempt case as before');
}
{
  // The save validator (AQB) accepts efficiency up to 1.3 (was 1).
  const aqb = text => { const i = text.indexOf('function uoB('); return new Function('u5Q', 'poA', `${text.slice(i, text.indexOf('}return!0}', i) + 10)};return uoB;`); };
  const vaQ = ['revision', 'efficiency', 'scarPermanent', 'scarTransient', 'scarDay', 'memory', 'lastDirection', 'lastDay', 'cooldownUntilDay', 'reverseCooldownUntilDay'];
  const rec = efficiency => ({ tech: { revision: 1, efficiency, scarPermanent: 0, scarTransient: 0, scarDay: 0, memory: { day: 1, takeVa: 0, cedeVa: 0 }, lastDirection: 'privatize', lastDay: 0, cooldownUntilDay: 0, reverseCooldownUntilDay: 0 } });
  const ok = (text, e) => { try { return aqb(text)(vaQ, ['privatize', 'nationalize', 'cooperative'])(rec(e), '643'); } catch { return false; } };
  check(ok(patched, 1.05) === true && ok(original, 1.05) === false, 'save validator: 1.05 accepted (original rejects it)');
  check(ok(patched, 1.3) === true && ok(patched, 1.31) === false && ok(patched, -0.1) === false && ok(patched, 0.7) === true, 'save validator: bound 1.3, negatives rejected, below 1 as before');
}
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
