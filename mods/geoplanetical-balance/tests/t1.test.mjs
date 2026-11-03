// T1 function test: extracts the cooldown/cap helpers from the patched bundle and checks them at day boundaries,
// Minified names in comments are those of build 26296134; the code and strings use the current build's names.
// every rating, extreme GDP and missing or malformed state. Usage: node mods/geoplanetical-balance/tests/t1.test.mjs
import { workspaceBuild as pinnedBuild, buildAll, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const text = buildAll(pinnedBuild(), loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const start = text.indexOf('function __geobalFxRoom(');
const end = text.indexOf('function cxQ(', start);
const a0At = text.indexOf('var Yt=');
if (start < 0 || end < 0 || a0At < 0) throw new Error('T1 helpers not found in the patched bundle');
const a0 = text.slice(a0At + 4, text.indexOf(',D_=', a0At));
const { room, record } = new Function(`const ${a0};${text.slice(start, end)};return { room: __geobalFxRoom, record: __geobalFxRecord };`)();

let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const world = (day, log, rating = 0, gdpNom = 1000) => {
  const s = log === undefined ? {} : { geobalFxBorrowing: log };
  return [{ day, finance: { sovereigns: { X: s } } }, { key: 'X', rating, gdpNom }, s];
};

// Cap by rating: max(1%, 10% - 0.5% per notch), clamped at notch 18.
for (let r = -3; r <= 25; r++) {
  const [A, B] = world(100, [], r);
  const n = Math.min(18, Math.max(0, r));
  check(close(room(A, B).capBn, 1000 * Math.max(0.01, 0.1 - 0.005 * n)), `cap at rating ${r}`);
}
check(close(room(...world(0, [], 0)).capBn, 100) && close(room(...world(0, [], 8)).capBn, 60) && close(room(...world(0, [], 14)).capBn, 30) && close(room(...world(0, [], 18)).capBn, 10), 'cap anchors AAA 10%, BBB 6%, B 3%, rating 18 floor 1% (unreachable: market closed from 17)');
for (const bad of [NaN, undefined, 'x', null]) check(close(room(...world(0, [], bad)).capBn, 100), `rating ${bad} treated as AAA`);
for (const gdp of [0, -5, NaN, undefined, 1e9]) {
  const c = room(...world(0, [], 0, gdp)).capBn;
  check(Number.isFinite(c) && c >= 0, `cap finite and non-negative for gdp ${gdp}`);
}

// Missing or malformed state: no cooldown, full room.
for (const log of [undefined, null, 'x', {}, [], [null, 'x', [], [NaN, 5], ['a', 5]]]) {
  const r = room(...world(500, log));
  check(!r.cooldown && close(r.roomBn, r.capBn) && r.usedBn === 0, `malformed state ${JSON.stringify(log)}`);
}

// Cooldown boundary: borrowing on day d blocks days d..d+29, allows d+30.
for (const d of [0, 1, 400]) {
  for (const t of [0, 1, 29]) check(room(...world(d + t, [[d, 5]])).cooldown, `cooldown on day +${t} after ${d}`);
  check(!room(...world(d + 30, [[d, 5]])).cooldown, `cooldown over on day +30 after ${d}`);
  check(room(...world(d + 10, [[d, 5]])).daysLeft === 20, `days left after ${d}`);
}
// Window: entries count for 365 days, then drop out; future-dated entries are ignored.
check(close(room(...world(364, [[0, 30]])).usedBn, 30), 'used at day 364');
check(room(...world(365, [[0, 30]])).usedBn === 0, 'dropped at day 365');
check(room(...world(10, [[11, 30]])).usedBn === 0 && !room(...world(10, [[11, 30]])).cooldown, 'future entry ignored');
check(close(room(...world(100, [[10, 40], [50, 50], [90, 5]])).roomBn, 5), 'room = cap - used (100 - 95)');
check(room(...world(100, [[10, 80], [50, 80]])).roomBn === 0, 'room never negative');
check(room(...world(100, [[10, -50]])).usedBn === 0, 'negative amounts ignored');

// Record: prunes old and future entries, appends, ignores non-positive amounts and missing sovereigns.
{
  const [A, B, s] = world(400, [[0, 1], [100, 2], [500, 3], 'junk']);
  record(A, B, 7);
  check(JSON.stringify(s.geobalFxBorrowing) === JSON.stringify([[100, 2], [400, 7]]), `record prunes and appends: ${JSON.stringify(s.geobalFxBorrowing)}`);
  record(A, B, 0); record(A, B, -1); record(A, B, NaN);
  check(s.geobalFxBorrowing.length === 2, 'record ignores non-positive amounts');
  const [A2, B2, s2] = world(5, undefined);
  record(A2, B2, 3);
  check(JSON.stringify(s2.geobalFxBorrowing) === JSON.stringify([[5, 3]]), 'record creates the field');
  let threw = false;
  try { record({ day: 1, finance: { sovereigns: {} } }, { key: 'Y' }, 3); record({ day: 1 }, { key: 'Y' }, 3); } catch { threw = true; }
  check(!threw, 'record without a sovereign does nothing');
}
// Room is read-only.
{
  const log = [[0, 1], [900, 2]];
  const [A, B, s] = world(400, log);
  room(A, B);
  check(s.geobalFxBorrowing === log && log.length === 2, 'room does not modify state');
}

console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
