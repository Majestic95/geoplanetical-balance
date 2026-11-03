// H2 (option C) function test: extracts the household plug function from the original and the patched bundle by
// its anchor and checks the promised behaviour at extreme inputs. Usage: node ../geoplanetical-modloader/patcher/build.mjs first, then
// node mods/geoplanetical-balance/tests/h2.test.mjs
import { readFileSync } from 'node:fs';
import { bundlePath, workspaceBuild as pinnedBuild, buildAll, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const ANCHOR = 'household-income:baseline:';
const END = 'return Math.max(0,Q*g-r)}';

function extract(text) {
  const a = text.indexOf(ANCHOR);
  const start = text.lastIndexOf('function ', a);
  const end = text.indexOf(END, a);
  if (a < 0 || start < 0 || end < 0 || end - start > 1000) throw new Error('plug function not found by anchor');
  return new Function(`return (${text.slice(start, end + END.length)})`)();
}

const build = pinnedBuild();
const vanilla = extract(readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8'));
const patched = extract(buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text);

// plug(h, g): Q = unrepresentedIncomeAnnualBn, C = annualFinancialIncomeBn, w = ledgerNetFinancialIncome0BnY.
const hh = (Q, C, w) => ({ id: 't', unrepresentedIncomeAnnualBn: Q, annualFinancialIncomeBn: C, ledgerNetFinancialIncome0BnY: w });
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };

const Qs = [0, 1e-9, 0.5, 10, 1e4, 1e7];
const Ws = [-1e6, -100, -1, -1e-9, 0, 1e-9, 1, 100, 1e6];
const Cs = [-1e9, -1e6, -100, -1, 0, 1, 100, 1e6, 1e9];
const Gs = [1e-6, 0.5, 1, 1.5, 3, 100];

for (const Q of Qs) for (const w of Ws) for (const g of Gs) {
  // Day 0 path: interest exactly at its baseline gives the same plug as vanilla.
  check(close(patched(hh(Q, w * g, w), g), vanilla(hh(Q, w * g, w), g)), `on-path Q=${Q} e=${w} g=${g}`);
  for (const C of Cs) {
    const p = patched(hh(Q, C, w), g), v = vanilla(hh(Q, C, w), g);
    const tag = `Q=${Q} C=${C} e=${w} g=${g}`;
    check(Number.isFinite(p) && p >= 0, `finite and non-negative ${tag}`);
    check(p <= Q * g + Math.max(0, w) * g * (1 + 1e-12) + 1e-12, `bounded by Q*g + max(0,w)*g ${tag}`);
    if (w >= 0 && C >= w * g) check(close(p, v), `saver above baseline equals vanilla ${tag}`);
    if (w >= 0 && C >= 0 && C < w * g && Q * g - C + w * g >= 0) check(close(p + C, Q * g + w * g), `saver below baseline made whole ${tag}`);
    if (w <= 0 && C < 0) check(close(p, Q * g), `borrower: plug unaffected by interest ${tag}`);
    if (w > 0 && C < 0) check(close(p, Q * g + w * g), `net saver now paying net interest: topped up to normal only ${tag}`);
    if (w <= 0 && C > 0) check(close(p, Math.max(0, Q * g - C)), `net debtor now earning net interest: gain above zero clawed back ${tag}`);
  }
}
// Borrowers feel rates both ways: disposable-relevant total plug + C moves one for one with C.
for (const Q of [10, 1e4]) for (const w of [-100, -1]) {
  const at = C => patched(hh(Q, C, w), 1) + C;
  check(at(-150) < at(-100) && at(-100) < at(-50), `borrower total rises when interest cost falls Q=${Q} e=${w}`);
}
// Bad inputs behave as in vanilla.
for (const [C, w] of [[NaN, 1], [1, NaN], [Infinity, 1], [1, undefined]]) {
  check(close(patched(hh(10, C, w), 1), vanilla(hh(10, C, w), 1)), `non-finite C=${C} e=${w}`);
}
for (const bad of [-1, NaN, undefined]) {
  let threwP = false, threwV = false;
  try { patched(hh(bad, 1, 1), 1); } catch { threwP = true; }
  try { vanilla(hh(bad, 1, 1), 1); } catch { threwV = true; }
  check(threwP === threwV, `invalid Q=${bad} throws like vanilla`);
}

console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
