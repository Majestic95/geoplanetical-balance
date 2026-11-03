// P1 function test: slices the bill submission (i9) and the player's withdrawal (VnQ) out of the patched and the
// original bundle and runs both with stubs for the law catalogue and the vote forecast. The game's own deposit rule
// (WnQ, LBB, yH) and clamp (SS) are taken from the bundle. Since build 26346311 the game itself gives back
// max(0, the law's approval change recomputed at withdrawal), undecayed. Checks the deposit is recorded and given back
// on withdrawal (net -2 whatever its sign or the 0-100 clamp, only the undecayed part after a late withdrawal), the
// 30-day cooldown and its boundary, the game's give-back for bills without a recorded deposit, malformed fields, and
// that everything else matches the original. Minified names are those of build 26346311.
// Usage: node mods/geoplanetical-balance/tests/p1.test.mjs
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
// The game's helpers, from the bundle: SS (clamp), w3 (procedure states), mvA, yH (deposit share 0.45, cap 7), LBB.
const helpers = text => `${slice(text, 'var yW=', 'function ZDB(')}${slice(text, 'var aqA=', 'function bwB(')}`;
const load = text => new Function('stubs', `const {mQ:TQ,XQB:ZDB,Ww:wr,Xw:rr,eZ:vAA,Lg:hg,_0:L2,D6:q0,T:N,qQ:YQ,xrA:VoA,Eg:ig,WQB:_DB,NrA:XoA,u4:In}=stubs;${helpers(text)}` +
  `${slice(text, 'function z5(', 'function U9Q(')}${slice(text, 'function U9Q(', 'function _Sg(')}return {submit:z5,withdraw:U9Q,deposit:KwB};`);

const events = [];
let seq = 0;
const stubs = {
  mQ: id => (id === 'unknown' ? null : { id }),
  XQB: () => ({ ok: true }),
  Ww: (law, value) => value,
  Xw: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  eZ: () => null,
  Lg: () => 'GOV',
  _0: law => (law.id === 'decree_law' ? 'executive_decree' : 'law'),
  D6: () => 'parliament',
  T: (A, type, payload) => events.push({ type, payload }),
  qQ: (law, value) => Number(value) || 0,
  xrA: (B, kind) => `${B.key}:${kind}:${++seq}`,
  Eg: v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v))),
  WQB: () => ({ passes: true }),
  NrA: () => ({ decreedResolution: true }),
  u4: (A, B) => Object.assign({}, A, B),
};
const P = load(patched)(stubs), O = load(original)(stubs);

let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };
const close = (a, b) => Math.abs(a - b) <= 1e-9;

// A world whose law approval is `weight` x the value of law "x": a bill moving x by d changes law approval by weight x d.
const world = ({ approval = 50, weight = 1, day = 100, x = 0, lawCooldown = {} } = {}) => {
  const player = { key: '826', approval, laws: { x, decree_law: 0 }, procedures: [], lawCooldown, pol: { constitution: {} } };
  const A = { day, player, playerKey: '826', _lawApproval: c => weight * (Number(c.laws.x) || 0) };
  return { A, player };
};
const bill = (impl, w, target, opts = {}) => impl.submit(w.A, w.player, 'x', target, { notify: true, ...opts });

// 1. Deposit recorded and given back, for popular and unpopular bills, through the clamp at 0 and 100.
const cases = [
  { name: 'popular bill, deposit capped at +7', approval: 50, d: 20, deposit: 7, game: 7 },
  { name: 'small popular bill', approval: 50, d: 4, deposit: 1.8, game: 1.8 },
  { name: 'unpopular bill, deposit -4.5 given back', approval: 50, d: -10, deposit: -4.5, game: 0 },
  { name: 'unpopular bill, capped at -7', approval: 50, d: -100, deposit: -7, game: 0 },
  { name: 'clamped at 100 (applied +2, not +7)', approval: 98, d: 20, deposit: 2, game: 7 },
  { name: 'clamped at 0 (applied -3, not -7)', approval: 3, d: -100, deposit: -3, game: 0 },
  { name: 'already at 100', approval: 100, d: 20, deposit: 0, game: 7 },
];
for (const c of cases) {
  const w = world({ approval: c.approval });
  const r = bill(P, w, c.d);
  const proc = w.player.procedures[0];
  check(r.ok && proc?.lawId === 'x', `${c.name}: submitted`);
  check(close(proc.geobalDeposit, c.deposit), `${c.name}: recorded deposit`, `${proc.geobalDeposit} vs ${c.deposit}`);
  check(close(w.player.approval, c.approval + c.deposit), `${c.name}: approval after submission`, `${w.player.approval}`);
  check(P.withdraw(w.A, 'x') === true, `${c.name}: withdrawn`);
  check(close(w.player.approval, Math.max(0, c.approval - 2)), `${c.name}: net of submit + withdraw is -2`, `${c.approval} -> ${w.player.approval}`);
  check(w.player.procedures.length === 0, `${c.name}: bill removed`);
  // Unmodified game: same deposit on submission; withdrawal costs 2 plus max(0, the law's change x 0.45, capped at 7)
  // recomputed, whatever was actually applied (an unpopular bill keeps its negative deposit).
  const o = world({ approval: c.approval });
  bill(O, o, c.d);
  check(close(o.player.approval, w.player.approval + 2 + c.deposit) || c.approval - 2 < 0, `${c.name}: original keeps the deposit`, `${o.player.approval}`);
  O.withdraw(o.A, 'x');
  check(close(o.player.approval, Math.min(100, Math.max(0, c.approval + c.deposit - 2 - c.game))), `${c.name}: original nets deposit - 2 - recomputed positive deposit`, `${o.player.approval}`);
}
// The clamp at 0 on withdrawal: approval 1 with a +7 deposit gives 8, then 8 - 2 - 7 is clamped to 0 (net -1).
{
  const w = world({ approval: 1 });
  bill(P, w, 20);
  P.withdraw(w.A, 'x');
  check(w.player.approval === 0, 'withdrawal result clamped at 0', `${w.player.approval}`);
}

// 2. No deposit (law approval unchanged): 0 recorded, withdrawal costs 2.
{
  const w = world({ weight: 0 });
  bill(P, w, 10);
  check(w.player.procedures[0].geobalDeposit === 0, 'zero deposit: 0 recorded');
  P.withdraw(w.A, 'x');
  check(w.player.approval === 48, 'zero deposit: withdrawal costs 2', `${w.player.approval}`);
}

// 3. Cooldown: withdrawal on day d blocks resubmission on days d..d+29 with the game's reason; day d+30 is allowed.
for (const day of [0, 1, 400]) {
  const w = world({ day });
  bill(P, w, 20);
  P.withdraw(w.A, 'x');
  check(w.player.lawCooldown.x === day + 30, `cooldown set to day + 30 (day ${day})`, `${w.player.lawCooldown.x}`);
  for (const t of [0, 1, 29]) {
    w.A.day = day + t;
    const r = bill(P, w, 20);
    check(r.ok === false && r.reason === 'cooldown' && w.player.procedures.length === 0, `resubmission refused on day +${t} after ${day}`);
  }
  w.A.day = day + 30;
  check(bill(P, w, 20).ok === true, `resubmission allowed on day +30 after ${day}`);
  // Unmodified game: resubmission allowed on the same day.
  const o = world({ day });
  bill(O, o, 20);
  O.withdraw(o.A, 'x');
  check(o.player.lawCooldown.x === undefined && bill(O, o, 20).ok === true, `original: no cooldown, resubmitted at once (day ${day})`);
}
// A longer cooldown already in place is kept; a missing lawCooldown map is created; the integer survives as such.
{
  const w = world({ day: 10 });
  bill(P, w, 20);
  w.player.lawCooldown.x = 500;
  P.withdraw(w.A, 'x');
  check(w.player.lawCooldown.x === 500, 'a longer cooldown is not shortened');
  const v = world({ day: 7 });
  bill(P, v, 20);
  delete v.player.lawCooldown;
  P.withdraw(v.A, 'x');
  check(v.player.lawCooldown?.x === 37 && Number.isInteger(v.player.lawCooldown.x), 'lawCooldown created when missing');
  const u = world({ day: undefined });
  u.A.day = undefined;
  u.player.procedures.push({ id: '826:law:1', kind: 'law', lawId: 'x', status: 'parliamentary_debate', sponsorKind: 'government' });
  P.withdraw(u.A, 'x');
  check(u.player.lawCooldown.x === 30, 'missing day treated as 0');
}

// 3b. Late withdrawal: approval relaxes to its target by the game's daily rate (rate G2Q read from the bundle), so only
// the deposit left after n days is given back and the result is the never-submitted path minus 2 at any n (d is the
// change in law x, so the law approval change).
{
  const rate = Number(/[,;]mwB=([\d.]+),/.exec(original)?.[1]);
  check(rate === 0.06, 'approval response rate read from the bundle', `${rate}`);
  for (const d of [-100, -10, 4, 20]) for (const n of [0, 1, 7, 30, 365]) {
    const w = world({ day: 100 });
    bill(P, w, d);
    for (let t = 0; t < n; t++) w.player.approval += (50 - w.player.approval) * rate;
    w.A.day = 100 + n;
    P.withdraw(w.A, 'x');
    check(close(w.player.approval, 48), `target ${d}, withdrawn after ${n} days: never-submitted path minus 2`, `${w.player.approval}`);
  }
  // Unmodified game: the decayed rest of the deposit stays after a late withdrawal (here -7 x 0.94^30). Giving back the
  // full recorded deposit instead would lift approval by about 5 above the never-submitted path after 30 days.
  const o = world({ day: 100 });
  bill(O, o, -100);
  for (let t = 0; t < 30; t++) o.player.approval += (50 - o.player.approval) * rate;
  o.A.day = 130;
  O.withdraw(o.A, 'x');
  check(close(o.player.approval, 48 - 7 * Math.pow(0.94, 30)), 'original: decayed deposit kept after a late withdrawal', `${o.player.approval}`);
  // Unmodified game, popular bill: the full +7 is taken back after 30 days although only 7 x 0.94^30 of it remains,
  // so approval ends about 5.9 below the never-submitted path minus 2.
  const q = world({ day: 100 });
  bill(O, q, 20);
  for (let t = 0; t < 30; t++) q.player.approval += (50 - q.player.approval) * rate;
  q.A.day = 130;
  O.withdraw(q.A, 'x');
  check(close(q.player.approval, 48 + 7 * Math.pow(0.94, 30) - 7), 'original: full deposit taken back after a late withdrawal (overshoot)', `${q.player.approval}`);
  // A bill without a usable day0, or one dated after today, gives back the full deposit.
  for (const day0 of [undefined, 'x', null, 200]) {
    const v = world({ day: 150 });
    const proc = { id: '826:law:9', kind: 'law', lawId: 'x', status: 'parliamentary_debate', sponsorKind: 'government', geobalDeposit: 3 };
    if (day0 !== undefined) proc.day0 = day0;
    v.player.procedures.push(proc);
    v.player.approval = 53;
    P.withdraw(v.A, 'x');
    check(close(v.player.approval, 48), `day0 ${String(day0)}: full deposit given back`, `${v.player.approval}`);
  }
}

// 4. Bills without the field (submitted before the mod) and malformed values: the game's own give-back, here 0
// (the bill has no target, so no law change), so withdrawal costs 2. null reads as a recorded 0.
for (const dep of [undefined, null, 'x', NaN, Infinity, {}]) {
  const w = world();
  const proc = { id: '826:law:9', kind: 'law', lawId: 'x', status: 'parliamentary_debate', sponsorKind: 'government' };
  if (dep !== undefined) proc.geobalDeposit = dep;
  w.player.procedures.push(proc);
  P.withdraw(w.A, 'x');
  check(w.player.approval === 48 && w.player.lawCooldown.x === 130, `deposit ${String(dep)}: costs 2, cooldown set`, `${w.player.approval}`);
}
// A bill without the field whose law change is popular: the game give-back (+7 recomputed, undecayed), as unmodded.
{
  const w = world(), o = world();
  for (const v of [w, o]) { v.player.procedures.push({ id: '826:law:9', kind: 'law', lawId: 'x', status: 'parliamentary_debate', sponsorKind: 'government', day0: 40, target: 20 }); v.player.approval = 57; }
  P.withdraw(w.A, 'x'); O.withdraw(o.A, 'x');
  check(close(w.player.approval, 48) && close(o.player.approval, 48) && w.player.lawCooldown.x === 130, 'no recorded deposit: the game give-back (7), plus the cooldown', `${w.player.approval}`);
}
// A numeric string is a recorded number after a JSON round trip anyway; Number() reads it.
{
  const w = world();
  w.player.procedures.push({ id: '826:law:9', kind: 'law', lawId: 'x', status: 'parliamentary_debate', sponsorKind: 'government', geobalDeposit: 3 });
  w.player.approval = 53;
  P.withdraw(w.A, 'x');
  check(w.player.approval === 48, 'recorded deposit read from a loaded bill');
}

// 5. What the withdrawal does not touch: party bills, bills at the assent stage, unknown laws, other bills.
{
  const w = world();
  w.player.procedures.push({ id: 'p', kind: 'law', lawId: 'x', status: 'parliamentary_debate', sponsorKind: 'party', geobalDeposit: 5 });
  w.player.procedures.push({ id: 'a', kind: 'law', lawId: 'y', status: 'awaiting_executive_assent', sponsorKind: 'government', geobalDeposit: 5 });
  const before = JSON.stringify(w.player);
  check(P.withdraw(w.A, 'x') === false && P.withdraw(w.A, 'y') === false && P.withdraw(w.A, 'z') === false, 'party, assent-stage and missing bills cannot be withdrawn');
  check(JSON.stringify(w.player) === before, 'refused withdrawals change nothing');
}
{
  const w = world();
  bill(P, w, 20);
  w.player.procedures.push({ id: 'other', kind: 'law', lawId: 'y', status: 'parliamentary_debate', sponsorKind: 'government', geobalDeposit: 4 });
  P.withdraw(w.A, 'x');
  check(w.player.procedures.length === 1 && w.player.procedures[0].id === 'other' && !('y' in w.player.lawCooldown), 'only the withdrawn bill is removed and put on hold');
}

// 6. Everything else as in the original: party bills and decrees get no deposit; the bill object, events and results
// match the original apart from the new field.
for (const [label, opts, target, law] of [['government bill', {}, 20, 'x'], ['party bill', { sponsorKind: 'party', sponsorPartyId: 'OPP' }, 20, 'x'], ['decree', {}, 20, 'decree_law']]) {
  const w = world(), o = world();
  events.length = 0; seq = 0;
  const rp = P.submit(w.A, w.player, law, target, { notify: true, ...opts });
  const ep = JSON.stringify(events);
  events.length = 0; seq = 0;
  const ro = O.submit(o.A, o.player, law, target, { notify: true, ...opts });
  const strip = v => JSON.stringify(v, (k, x) => (k === 'geobalDeposit' ? undefined : x));
  check(strip(rp) === strip(ro) && strip(w.player) === strip(o.player) && ep === JSON.stringify(events), `${label}: same result, state and events as the original`);
  check(label === 'government bill' ? w.player.procedures[0]?.geobalDeposit === 7 : !w.player.procedures.some(p => 'geobalDeposit' in p), `${label}: deposit recorded only for government bills`);
}
// The game's existing refusals are unchanged (pending, full, cooldown from a failed vote).
{
  const w = world();
  bill(P, w, 20);
  check(bill(P, w, 30).reason === 'pending', 'second bill on the same law refused (pending)');
  w.player.procedures.push({ id: 'b', kind: 'law', lawId: 'y' });
  check(P.submit(w.A, w.player, 'z', 5, {}).reason === 'full', 'third bill refused (full)');
  const v = world({ lawCooldown: { x: 280 } });
  check(bill(P, v, 20).reason === 'cooldown', 'failed-vote cooldown still applies');
}

console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
