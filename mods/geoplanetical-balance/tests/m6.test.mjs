// M6 function test: the devalue action ($mQ) and the monetary view's devalue reason, patched vs original, on a small
// world (issuer X and a second member Y of a pegged currency): cooldown boundaries, the escalating credibility cut,
// the 3-year window, the anchor floor, missing or malformed state, and refusals the game already had.
// Minified names are those of build 26318758. Usage: node mods/geoplanetical-balance/tests/m6.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;

const slice = (text, from, to, what) => {
  const a = text.indexOf(from), b = text.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error(`${what} not found`);
  return text.slice(a, b);
};
// The game's own helpers: Bt (number or default), hX (clamp), m6B (the 15% step) and wH (regime refusals).
const deps = text => {
  const at = text.indexOf('var Yt=');
  return text.slice(at + 4, text.indexOf(';', at));
};
const wHText = text => slice(text, 'function qG(', 'var c2=', 'tf');
const load = (text, from) => new Function('N', `const ${deps(text)};${wHText(text)};${slice(text, from, 'function zYA(', 'devalue action')};` +
  'return { devalue: ixQ, state: typeof __geobalDevalueState === "function" ? __geobalDevalueState : null, wH:qG };');
const events = [];
const z = (A, id) => events.push(id);
const P = load(patched, 'function __geobalDevalueState(')(z), O = load(original, 'function ixQ(')(z);
if (!P.state) throw new Error('M6 helpers not found in the patched bundle');

let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const close = (a, b) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));

// A pegged currency issued by X (largest member) with a second member Y; sovereign record on X.
const world = ({ day = 0, log, regime = 'peg', members = ['X', 'Y'], anchors = { X: 0.9, Y: 0.6 }, sovereign = true } = {}) => {
  const ccy = { code: 'C', regime, pegRatio: 1, perUnit: 1, perUsd: 1, reer: 1, members };
  const countries = new Map();
  for (const k of ['X', 'Y']) countries.set(k, { key: k, ccy, anchor: anchors[k], anchor0: 1, approval: 50, stab: 50 });
  const sov = log === undefined ? {} : { geobalDevaluations: log };
  const A = { day, countries, finance: { sovereigns: sovereign ? { X: sov } : {} }, _largestMember: () => 'X' };
  return { A, B: countries.get('X'), Y: countries.get('Y'), ccy, sov };
};

// The exploit in the original: repeated devaluations on the same day all go through and cost no credibility.
{
  const w = world();
  const r = [O.devalue(w.A, w.B), O.devalue(w.A, w.B), O.devalue(w.A, w.B)];
  check(r.every(x => x.ok) && close(w.ccy.pegRatio, 1.15 ** 3), 'original: three devaluations on day 0 all succeed');
  check(w.B.anchor === 0.9 && w.Y.anchor === 0.6, 'original: no credibility cost');
  check(w.B.approval === 41 && w.B.stab === 44, 'original: -3 approval, -2 stability each');
}

// Patched: first devaluation goes through with a 5% cut to every member's anchor and is recorded.
{
  const w = world();
  events.length = 0;
  const r = P.devalue(w.A, w.B);
  check(r.ok && close(r.devaluationPct, 15) && close(w.ccy.pegRatio, 1.15), 'first devaluation succeeds, 15% step unchanged');
  check(close(w.B.anchor, 0.9 * 0.95) && close(w.Y.anchor, 0.6 * 0.95), `5% cut on every member: ${w.B.anchor}, ${w.Y.anchor}`);
  check(w.B.approval === 47 && w.B.stab === 48 && events.join() === 'finance.currency_devalued', 'game effects and event unchanged');
  check(JSON.stringify(w.sov.geobalDevaluations) === '[0]', 'recorded on the sovereign record');
  // Second on the same day: refused, nothing changes.
  const before = JSON.stringify([w.ccy, w.B, w.Y, w.sov]);
  events.length = 0;
  const r2 = P.devalue(w.A, w.B);
  check(!r2.ok && r2.reason === 'cooldown', 'second devaluation on the same day refused (cooldown)');
  check(JSON.stringify([w.ccy, w.B, w.Y, w.sov]) === before && events.length === 0, 'a refusal changes nothing');
  for (const d of [1, 100, 179]) { w.A.day = d; check(P.devalue(w.A, w.B).reason === 'cooldown', `day ${d}: still refused`); }
  check(P.state(w.A, w.B).waitDays === 1, 'day 179: one day left');
  w.A.day = 180;
  const r3 = P.devalue(w.A, w.B);
  check(r3.ok && close(w.B.anchor, 0.9 * 0.95 * 0.9) && close(w.Y.anchor, 0.6 * 0.95 * 0.9), 'day 180: allowed, the second cut is 10%');
  check(JSON.stringify(w.sov.geobalDevaluations) === '[0,180]', 'second recorded');
}

// Escalation every 180 days: 5, 10, 15, 20, 25, 30, then capped at 30%.
{
  const w = world({ anchors: { X: 1, Y: 1 } });
  let expect = 1;
  const cuts = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.3];
  cuts.forEach((h, i) => {
    w.A.day = i * 180;
    const ok = P.devalue(w.A, w.B).ok;
    expect = Math.max(0.02, expect * (1 - h));
    check(ok && close(w.B.anchor, expect), `devaluation ${i + 1} on day ${i * 180}: cut ${h * 100}% (anchor ${w.B.anchor.toFixed(4)})`);
  });
  check(w.B.anchor < 0.31, `seven devaluations in 3 years leave under a third of the credibility: ${w.B.anchor.toFixed(3)}`);
  // Day 1300: entries 1095 days or older drop out of the window and the record.
  w.A.day = 1300;
  const before = w.B.anchor;
  check(P.devalue(w.A, w.B).ok && close(w.B.anchor, before * 0.7), 'day 1300: five recent devaluations, cut capped at 30%');
  check(JSON.stringify(w.sov.geobalDevaluations) === '[360,540,720,900,1080,1300]', `record pruned to 3 years: ${JSON.stringify(w.sov.geobalDevaluations)}`);
}
{
  // Window boundary: a devaluation exactly 1095 days old no longer counts.
  const a = world({ day: 1094, log: [0], anchors: { X: 1, Y: 1 } }), b = world({ day: 1095, log: [0], anchors: { X: 1, Y: 1 } });
  P.devalue(a.A, a.B); P.devalue(b.A, b.B);
  check(close(a.B.anchor, 0.9) && close(b.B.anchor, 0.95), 'a devaluation counts for 1094 days, not 1095');
}

// Floor and odd anchors.
{
  const w = world({ anchors: { X: 0.021, Y: 0.02 } });
  P.devalue(w.A, w.B);
  check(w.B.anchor === 0.02 && w.Y.anchor === 0.02, 'anchor floored at the game\'s 0.02');
  for (const bad of [undefined, NaN, null, 'x']) {
    const v = world({ anchors: { X: 0.8, Y: bad } });
    const ok = P.devalue(v.A, v.B).ok;
    check(ok && close(v.B.anchor, 0.76) && (Object.is(v.Y.anchor, bad)), `member with anchor ${bad} is skipped`);
  }
  const solo = world({ members: null });
  check(P.devalue(solo.A, solo.B).ok && close(solo.B.anchor, 0.855) && solo.Y.anchor === 0.6, 'no member list: only the issuer is cut');
}

// Missing or malformed state: no cooldown, first-devaluation cut, record rewritten clean.
for (const log of [null, 'x', {}, [], [NaN, 'a', null, -Infinity, Infinity], [5000]]) {
  const w = world({ day: 100, log });
  const r = P.devalue(w.A, w.B);
  check(r.ok && close(w.B.anchor, 0.855) && JSON.stringify(w.sov.geobalDevaluations) === '[100]', `state ${JSON.stringify(log)}: treated as none`);
}
{
  const w = world({ sovereign: false });
  let threw = false, r;
  try { r = P.devalue(w.A, w.B); r = [r, P.devalue(w.A, w.B)]; } catch (e) { threw = e; }
  check(!threw && r[0].ok && r[1].ok && close(w.B.anchor, 0.9 * 0.95 * 0.95), 'no sovereign record: works, cannot remember (no state to save)');
}
{
  const log = [10, 20];
  const w = world({ day: 25, log });
  const s = P.state(w.A, w.B);
  check(w.sov.geobalDevaluations === log && JSON.stringify(log) === '[10,20]' && s.waitDays === 175, 'state read is read-only');
}

// The game's own refusals come first and write nothing.
{
  const f = world({ regime: 'float' });
  check(P.devalue(f.A, f.B).reason === 'regime' && O.devalue(f.A, f.B).reason === 'regime' && !('geobalDevaluations' in f.sov) && f.B.anchor === 0.9, 'floating currency: refused as before, nothing recorded');
  const n = world();
  n.A._largestMember = () => 'Y';
  check(P.devalue(n.A, n.B).reason === 'issuer' && !('geobalDevaluations' in n.sov), 'not the issuer: refused as before');
}

// The monetary view's devalue reason: the game's reason first, then cooldown.
{
  const at = patched.indexOf('E=qG(A,B,"devalue")||');
  const expr = patched.slice(at, patched.indexOf(',t=qG(A,B,"float")', at));
  const view = new Function('qG', '__geobalDevalueState', 'A', 'B', `let E;${expr};return E`).bind(null, P.wH, P.state);
  check(view(world().A, world().B) === null, 'view: no devaluation yet, available');
  const w = world({ day: 10, log: [0] });
  check(view(w.A, w.B) === 'cooldown', 'view: cooldown after a devaluation');
  w.A.day = 180;
  check(view(w.A, w.B) === null, 'view: available again on day 180');
  const f = world({ day: 10, log: [0], regime: 'float' });
  check(view(f.A, f.B) === 'not_fixed', 'view: the game\'s own reason wins');
  check(JSON.stringify(w.sov.geobalDevaluations) === '[0]', 'view writes nothing');
}

console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
