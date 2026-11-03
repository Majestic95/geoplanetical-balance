// E4 function test: war damage to a plant (fzB) charges its owner's treasury through the game's payment (X6), with
// stubs for the capex table (GC), local cost multiplier (t7A), payment (X6) and repair time (baA).
// Minified names in comments are those of build 26296134; the code and strings use the current build's names.
// Usage: node mods/geoplanetical-balance/tests/e4.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const GC = { nuclear: { capex: 6 }, coal: { capex: 2 }, nocost: {} };
const make = (text, pay) => {
  const s = text.indexOf('function __geobalWarRepair(') >= 0 ? text.indexOf('function __geobalWarRepair(') : text.indexOf('function voQ(');
  const e = text.indexOf('function $BB(', s);
  if (s < 0 || e - s > 2000) throw new Error('plant damage function (qTB) not found');
  const payments = [];
  const TP = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const fn = new Function('uC', 'AA', 'fdA', 'k0', 'IiA', 'D5', 'WBB', 'soQ', `${text.slice(s, e)};return voQ;`)(
    GC, x => Math.round(x * 1e6) / 1e6, () => 1.25,
    (A, O, k, opts) => { payments.push({ country: O.key, k, opts }); return pay(k, opts); },
    r => 14 + Math.round(r * 166), TP, () => {}, () => {});
  return { fzB: fn, payments };
};
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const close = (a, b) => Math.abs(a - b) < 1e-9;
const world = () => ({ day: 100, countries: new Map([['250', { key: '250' }], ['804', { key: '804' }]]) });
const plant = (src, gw, extra = {}) => ({ id: 'p1', src, capacityGW: gw, owner: '804', ...extra });
const full = k => ({ ok: true, amountBn: k, shortfallBn: 0 });

{
  const { fzB, payments } = make(patched, full), A = world(), P = plant('nuclear', 1.4);
  const out = fzB(A, P, 1, 'war');
  check(payments.length === 1 && payments[0].country === '804' && close(payments[0].k, 1 * 1.4 * 6 * 1.25), `full destruction of 1.4 GW nuclear: owner pays 10.5 (got ${payments[0]?.k})`);
  check(payments[0].opts.purposeId === 'war_repair' && payments[0].opts.refs.plantId === 'p1', 'booked as war_repair with the plant id');
  check(out.repairDay === 100 + 14 + 166 && P._warRepairDay === 280, 'paid in full: repair time as the game sets it');
  // A second hit charges only the added damage (already at 1: nothing).
  fzB(A, P, 0.5, 'war');
  check(payments.length === 1, 'no added damage (already destroyed): no second charge');
}
{
  const { fzB, payments } = make(patched, full), A = world(), P = plant('coal', 2, { warDamage: 0.2 });
  fzB(A, P, 0.3, 'sabotage');
  check(payments.length === 1 && close(payments[0].k, 0.3 * 2 * 2 * 1.25), `added damage 0.3 on 2 GW coal: 1.5 (got ${payments[0]?.k})`);
}
{
  // The game's payment (yr): a full payment is refused when the treasury cannot borrow (e.g. in default); then the
  // patch retries with allowPartial and pays the cash there is.
  const pay = (k, o) => (o.allowPartial ? { ok: true, amountBn: k / 4, shortfallBn: (3 * k) / 4 } : { ok: false, reason: 'sovereign-default' });
  const { fzB, payments } = make(patched, pay), A = world(), P = plant('nuclear', 1);
  fzB(A, P, 1, 'war');
  check(payments.length === 2 && !payments[0].opts.allowPartial && payments[1].opts.allowPartial === true && payments[1].opts.purposeId === 'war_repair', 'refused in full: retried once with allowPartial, same purpose');
  check(P._warRepairDay === 280 + Math.ceil(0.75 * 180), `three quarters unpaid: repair takes 135 days longer (got ${P._warRepairDay})`);
}
{
  const { fzB, payments } = make(patched, k => ({ ok: true, amountBn: k, shortfallBn: 0, financingRequiredBn: k / 2 })), A = world(), P = plant('nuclear', 1);
  fzB(A, P, 1, 'war');
  check(payments.length === 1 && P._warRepairDay === 280, 'a treasury that borrows for the shortfall pays in full: no retry, repair as the game sets it');
}
{
  const { fzB, payments } = make(patched, () => ({ ok: false, reason: 'treasury-state' })), A = world(), P = plant('nuclear', 1);
  fzB(A, P, 1, 'war');
  check(payments.length === 2 && P._warRepairDay === 280 + 180, 'refused both times: repair takes twice as long');
}
{
  // Many small hits on an owner that cannot pay: the delay is bounded by twice the repair time for the damage.
  const { fzB } = make(patched, () => ({ ok: false, reason: 'treasury-state' })), A = world(), P = plant('coal', 1);
  for (let i = 0; i < 20; i++) fzB(A, P, 0.05, 'war');
  const d = P.warDamage, limit = 100 + 2 * (14 + Math.round(d * 166));
  check(P._warRepairDay <= limit && P._warRepairDay >= 100 + 14 + Math.round(d * 166), `20 unpaid hits: repair day ${P._warRepairDay} within twice the repair time (${limit})`);
}
for (const [label, P] of [['no capex for the technology', plant('nocost', 1)], ['unknown technology', plant('mystery', 1)], ['zero capacity', plant('coal', 0)], ['owner not a country', plant('coal', 1, { owner: 'xx' })]]) {
  const { fzB, payments } = make(patched, full), A = world();
  fzB(A, P, 1, 'war');
  check(payments.length === 0 && P._warRepairDay === 280, `${label}: no charge, repair as the game sets it`);
}
{
  // Everything else fzB returns or sets is as in the original.
  const a = make(patched, full), b = make(original, full);
  const A1 = world(), A2 = world(), P1 = plant('coal', 2, { warDamage: 0.1 }), P2 = plant('coal', 2, { warDamage: 0.1 });
  const o1 = a.fzB(A1, P1, 0.4, 'war', 'op7'), o2 = b.fzB(A2, P2, 0.4, 'war', 'op7');
  check(JSON.stringify(o1) === JSON.stringify(o2) && JSON.stringify(P1) === JSON.stringify(P2), 'result and plant state as the original when paid in full');
  check(b.payments.length === 0, 'original charges nothing (control)');
}
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
