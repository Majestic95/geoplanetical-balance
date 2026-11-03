// C14 function test: the monthly obligation endurance pass (TyQ) from the patched and the original bundle, with the
// game's own constants and ordering and a stubbed collective write-off (Fd) and event log (R6).
// Usage: node mods/geoplanetical-balance/tests/c14.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
// The constants block (prescription 730 days, dust 2e-6 bn after 30 days, 10 per live entity, the age order), the
// live-entity count and the pass itself, cut by the cap's event kind.
const fn = text => {
  const at = text.indexOf('"economic_obligation_cap"');
  const pass = text.lastIndexOf('function ', at);
  const live = text.lastIndexOf('function ', pass - 1);
  const start = text.lastIndexOf('var ', live);
  const end = text.indexOf('var ', at);
  const src = text.slice(start, end);
  if (at < 0 || end - start > 3000 || !/^var a7C=730,I7C=2e-6,n7C=30,s7C=10,DXQ=/.test(src) || !src.includes('function oXQ(')) throw new Error('endurance pass not found');
  const writeoffs = [];
  // Fd as the game's: rows must be open (same object), unresolved rows are skipped and stay open.
  const Fd = (C, rows, { kind }) => {
    const open = C.economicObligations.open;
    for (const row of rows) if (open[row.id] !== row) throw new Error(`economic-obligation:collective-writeoff-row:${row.id}`);
    const done = rows.filter(row => !row.unresolved);
    for (const row of done) delete open[row.id];
    writeoffs.push({ kind, ids: done.map(row => row.id) });
    return { writtenOffBn: done.reduce((a, row) => a + row.remainingBn, 0), writtenOffRows: done.length, unresolvedRows: rows.length - done.length, byClass: {} };
  };
  const events = [];
  const TyQ = new Function('Xv', 'v0', 'e8', `${src}; return oXQ;`)(Fd, (C, ev) => events.push(ev), A => A?.status === 'liquidated' || A?.status === 'dissolved');
  return (world, opts) => { writeoffs.length = 0; events.length = 0; TyQ(world, opts); return { writeoffs: writeoffs.map(w => ({ ...w })), events: [...events] }; };
};
const P = fn(patched), V = fn(original);

// A world of `live` live entities (cap 10 x live) and the given rows, all owed by company c0 to household h0.
const DAY = 1000;
const world = (rows, { live = 3, liquidated = 0 } = {}) => {
  const companies = {};
  for (let i = 0; i < live - 1; i++) companies[`c${i}`] = { status: 'active' };
  for (let i = 0; i < liquidated; i++) companies[`dead${i}`] = { status: 'liquidated' };
  const open = {};
  for (const r of rows) open[r.id] = { kind: 'goods', payer: { ownerType: 'company', ownerId: 'c0' }, payee: { ownerType: 'social_group', ownerId: 'h0' }, issuedDay: r.dueDay, amountBn: r.remainingBn, ...r };
  return { day: DAY, finance: { economicObligations: { schemaVersion: 1, open }, companies, households: { h0: {} }, sovereigns: {}, histories: {} } };
};
const row = (i, remainingBn, overdue = 100 + i) => ({ id: `o:${String(i).padStart(5, '0')}`, dueDay: DAY - overdue, remainingBn });
const capped = r => r.writeoffs.filter(w => w.kind === 'economic_obligation_cap').flatMap(w => w.ids);
const ofKind = (r, k) => r.writeoffs.filter(w => w.kind === k).flatMap(w => w.ids);
const sameSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const BIG = 5, DUST = 1e-6; // bn; the game's dust threshold is 2e-6 bn

// 1. Under the cap (3 live entities: cap 30): identical, prescription and dust rules as before.
{
  const rows = [row(0, BIG, 800), row(1, DUST, 40), row(2, DUST, 10), row(3, BIG, 20), ...Array.from({ length: 20 }, (_, i) => row(10 + i, 0.01 * (i + 1)))];
  const p = P(world(rows)), v = V(world(rows));
  check(JSON.stringify(p) === JSON.stringify(v), 'under the cap: identical write-offs and events');
  check(sameSet(ofKind(p, 'economic_obligation_prescription'), ['o:00000']) && sameSet(ofKind(p, 'economic_obligation_dust'), ['o:00001']), 'prescription (>730 days) and dust (>30 days, <2e-6) still apply');
}
// 2. Over the cap with only large rows: the original writes off the oldest whatever the size; the patch keeps them.
{
  const rows = Array.from({ length: 60 }, (_, i) => row(i, BIG + i, 600 - i));
  const p = P(world(rows)), v = V(world(rows));
  check(capped(v).length === 60 - 27 && sameSet(capped(v), rows.slice(0, 33).map(r => r.id)), 'original: 33 oldest large rows written off by count (60 open, cap 30)');
  check(capped(p).length === 0 && !p.events.length, 'patched: no large row written off between the cap and 4 x the cap');
}
// 3. Over the cap with young dust rows: only dust goes, oldest first, at most down to 90% of the cap.
{
  const rows = [...Array.from({ length: 40 }, (_, i) => row(i, BIG, 300 - i)), ...Array.from({ length: 10 }, (_, i) => row(100 + i, DUST, 25 - i))];
  const p = P(world(rows));
  check(sameSet(capped(p), rows.slice(40).map(r => r.id)) && ofKind(p, 'economic_obligation_dust').length === 0, 'patched: the 10 young dust rows (under 30 days overdue) go, the 40 large stay');
  const many = Array.from({ length: 60 }, (_, i) => row(i, DUST, 29 - (i % 29)));
  const pm = P(world(many)), vm = V(world(many));
  check(sameSet(capped(pm), capped(vm)) && capped(pm).length === 33, 'all-dust world: same rows as the original (oldest first, down to 27)');
  const atDust = Array.from({ length: 40 }, (_, i) => row(i, 2e-6, 20));
  check(capped(P(world(atDust))).length === 0, 'a row of exactly 2e-6 bn is not dust (strictly below, as the dust rule)');
}
// 4. Above the hard bound (4 x cap = 120): dust first, then the smallest overdue rows, down to 90% of the bound (108).
{
  const rows = Array.from({ length: 200 }, (_, i) => i < 5 ? row(i, DUST, 10 + i) : row(i, 0.001 * ((i * 37) % 200 + 1), 500 - i));
  const w = world(rows), p = P(w);
  const cut = capped(p), left = Object.keys(w.finance.economicObligations.open);
  check(left.length === 108 && cut.length === 92, `hard bound: 200 open, 92 written off, 108 left (got ${cut.length}, ${left.length})`);
  const maxCut = Math.max(...cut.map(id => rows.find(r => r.id === id).remainingBn));
  const minLeft = Math.min(...left.map(id => rows.find(r => r.id === id).remainingBn));
  check(maxCut <= minLeft && rows.slice(0, 5).every(r => cut.includes(r.id)), 'hard bound: dust and the smallest rows go, every larger row stays');
  const v = V(world(rows));
  check(capped(v).length === 200 - 27, 'original: written off down to 90% of the cap (27)');
}
// 5. Ties in size break by age, then id (the game's order); the result does not depend on insertion order.
{
  const rows = Array.from({ length: 130 }, (_, i) => row(i, i % 2 ? BIG : 0.5, 400 - (i % 7)));
  const a = capped(P(world(rows))), b = capped(P(world([...rows].reverse())));
  check(a.length === 130 - 108 && JSON.stringify([...a].sort()) === JSON.stringify([...b].sort()), 'deterministic: same rows whatever the insertion order');
  const cut = rows.filter(r => a.includes(r.id));
  check(cut.every(r => r.remainingBn === 0.5) && Math.min(...cut.map(r => DAY - r.dueDay)) >= Math.max(...rows.filter(r => r.remainingBn === 0.5 && !a.includes(r.id)).map(r => DAY - r.dueDay)), 'equal sizes: oldest first');
}
// 6. Rows not yet due are never written off by count; unresolved rows stay open as before.
{
  const rows = [...Array.from({ length: 150 }, (_, i) => row(i, 0.001, -5 - i)), ...Array.from({ length: 30 }, (_, i) => row(500 + i, 0.002, 50))];
  const w = world(rows), p = P(w);
  check(capped(p).length === 30 && capped(p).every(id => id.startsWith('o:005')), 'only overdue rows are candidates (150 not yet due stay)');
  const un = Array.from({ length: 130 }, (_, i) => ({ ...row(i, 0.001 * (i + 1), 100), unresolved: i < 10 }));
  const wu = world(un), pu = P(wu);
  check(un.slice(0, 10).every(r => wu.finance.economicObligations.open[r.id]), 'unresolved rows are skipped by the write-off and stay open');
}
// 7. An explicit hardCap argument stays a hard cap: over it, dust then the smallest rows, down to 90% of it.
{
  const rows = Array.from({ length: 50 }, (_, i) => row(i, 0.1 * (50 - i), 300 - i));
  const p = P(world(rows), { hardCap: 20 }), v = V(world(rows), { hardCap: 20 });
  check(capped(p).length === capped(v).length && capped(p).length === 32, 'hardCap 20: as many rows written off as the original (down to 18)');
  check(sameSet(capped(p), rows.slice(18).map(r => r.id)), 'hardCap 20: the 32 smallest rows, not the 32 oldest');
}
// 8. Liquidated companies do not count as live entities (cap from the game's own count).
{
  const rows = Array.from({ length: 35 }, (_, i) => row(i, BIG, 100));
  check(capped(V(world(rows, { live: 3, liquidated: 5 }))).length === 8 && capped(P(world(rows, { live: 3, liquidated: 5 }))).length === 0, 'cap from live entities only; patched keeps large rows');
}
// The closed-company check stubbed above as the game's e8: a change in the game's body needs the stub (and case 9) re-checked.
check(original.includes('function e8(A){return A?.status==="liquidated"||A?.status==="dissolved"}'), "the game's closed-company check (e8) is the stub's");
// 9. Rows owed by liquidated companies (the game's own closed-payer step, first in the pass since 26391432) are cleared
//    before the cap counts the open rows: the patch neither changes that step nor lets those rows reach the cap.
{
  const dead = Array.from({ length: 40 }, (_, i) => ({ ...row(i, BIG, 300 - i), payer: { ownerType: 'company', ownerId: 'dead0' } }));
  const rows = [...dead, ...Array.from({ length: 10 }, (_, i) => row(100 + i, DUST, 25 - i))];
  const p = P(world(rows, { liquidated: 1 })), v = V(world(rows, { liquidated: 1 }));
  check(sameSet(ofKind(p, 'economic_obligation_closed_payer'), dead.map(r => r.id)) && JSON.stringify(p) === JSON.stringify(v),
    'closed payers: the 40 rows owed by a liquidated company are cleared by the game step, identically patched and unpatched');
  // The game's end-of-pass summary reports the closed-payer write-off; it has no cap entry and 10 rows stay open.
  check(capped(p).length === 0 && p.events.length === 1 && !p.events[0].capped && p.events[0].openAfter === 10,
    'closed payers: the cleared rows never reach the cap (10 open left, cap 30)');
}
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
