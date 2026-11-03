// P2 end to end, headless, as the United Kingdom without party control (a Labour majority passes government bills):
// pass a lower retirement age through parliament -> a month later the law has habituation -> pass a one-year
// amendment -> the law keeps its habituation scaled by 1 - |position change| / 100, the position being the game's own
// law score (currentScore in the politics view, PQ). The unmodified game clears it.
// Usage: node --max-old-space-size=6000 mods/geoplanetical-balance/tests/p2.headless.mjs [--control]
//   --control  the unmodified game: the amendment clears the habituation (the reset P2 removes).
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { WORKSPACE as ROOT, workspaceBuild as pinnedBuild, bundlePath } from 'geoplanetical-modloader/patcher/build.mjs';
import { SIM } from 'geoplanetical-modloader/patcher/session.mjs';
import { moddedWorkerData } from '../../../headless/prototype/modded.mjs';
import { part } from '../../../headless/metrics.mjs';

const KEY = '826', LAW = 'retirement_age', MONTHLY = 0.023;
const build = pinnedBuild();
const control = process.argv.includes('--control');
const { sourceText, overrides } = control ? { sourceText: undefined, overrides: {} }
  : moddedWorkerData(join(ROOT, '.modding', 'decompiled', `app-${build}`));
const w = new Worker(fileURLToPath(new URL('../../../headless/prototype/bootstrap.mjs', import.meta.url)),
  { workerData: { bundlePath: bundlePath(build, SIM), sourceText, overrides }, resourceLimits: { maxOldGenerationSizeMb: 12000 } });
let id = 0, epoch = 0; const pending = new Map();
w.on('message', m => { if (m?.type === 'response') { const p = pending.get(m.requestId); pending.delete(m.requestId); epoch = m.sessionEpoch || epoch; m.ok ? p.res(m.payload) : p.rej(new Error(JSON.stringify(m.error).slice(0, 800))); } });
w.on('error', e => { console.error('WORKER ERROR', e.stack || e); process.exit(2); });
const req = (command, payload = {}) => new Promise((res, rej) => { const r = ++id; pending.set(r, { res, rej }); w.postMessage({ protocolVersion: 2, type: 'request', requestId: r, sessionEpoch: epoch, command, payload }); });

const BOOT = { playerKey: KEY, savePayload: null, seed: 12345,
  gameplayRules: { aiNuclearFirstUse: false, newPandemicEmergence: 'off', naturalDisasters: 'normal', aiWarDeclarations: true, worldBellicosity: 'normal' } };
let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const inconclusive = what => Object.assign(new Error(what), { inconclusive: true });
const call = async (methodId, ...args) => (await req('domain.call', { methodId, args })).result;
const state = async () => {
  const snap = await req('save.snapshot');
  return { c: part(snap, 'countries')[KEY], day: part(snap, 'core').sim?.day };
};
// The law's position (PQ) from the politics view's law entries (currentScore).
const score = async () => {
  const v = await req('view.snapshot', { viewId: 'politics.country' });
  const stack = [v];
  while (stack.length) {
    const o = stack.pop();
    if (o && typeof o === 'object') {
      if (o.id === LAW && 'currentScore' in o && 'current' in o) return { value: o.current, score: o.currentScore };
      stack.push(...Object.values(o));
    }
  }
  return null;
};
// Advance one day at a time until the law holds `value` (its bill was voted), at most `max` days.
const until = async (value, max) => {
  let s = await state();
  for (let i = 0; i < max && s.c.laws[LAW] !== value; i++) { await req('clock.advanceDays', { days: 1 }); s = await state(); }
  return s;
};

try {
  await req('session.boot', BOOT);
  let s = await state();
  const cur = Number(s.c.laws[LAW]);
  check(Number.isFinite(cur) && s.c.laws0[LAW] === cur, 'day 0: retirement age at its day-0 setting', `${cur}`);
  const t1 = cur - 2, t2 = cur - 3;
  const b1 = await call('submitBill', LAW, t1);
  check(b1?.ok === true && !b1.decreed, 'bill 1 submitted to parliament', `vote day ${b1?.bill?.voteDay}`);
  if (!b1?.ok) throw inconclusive('bill 1 not submitted');
  await req('clock.advanceDays', { days: Math.max(0, b1.bill.voteDay - (s.day ?? 0) - 1) });
  s = await until(t1, 5);
  if (s.c.laws[LAW] !== t1) throw inconclusive(`bill 1 did not pass (law ${s.c.laws[LAW]} on day ${s.day})`);
  check(true, 'bill 1 passed', `day ${s.day}, law ${t1}`);
  // Habituation starts at the next monthly pass (hEQ): 0.023.
  for (let i = 0; i < 8 && !(s.c.lawHabituation?.[LAW] > 0); i++) { await req('clock.advanceDays', { days: 5 }); s = await state(); }
  const h1 = s.c.lawHabituation?.[LAW];
  check(h1 > 0, 'a month later the law has habituation', `day ${s.day}, h ${h1}`);
  const p1 = await score();
  const b2 = await call('submitBill', LAW, t2);
  check(b2?.ok === true && !b2.decreed, 'bill 2 (one-year amendment) submitted', `vote day ${b2?.bill?.voteDay}`);
  if (!b2?.ok) throw inconclusive('bill 2 not submitted');
  await req('clock.advanceDays', { days: Math.max(0, b2.bill.voteDay - (s.day ?? 0) - 1) });
  const pre = await state();
  const hPre = pre.c.lawHabituation?.[LAW];
  s = await until(t2, 5);
  if (s.c.laws[LAW] !== t2) throw inconclusive(`bill 2 did not pass (law ${s.c.laws[LAW]} on day ${s.day})`);
  const p2 = await score();
  const hPost = s.c.lawHabituation?.[LAW];
  const k = 1 - Math.abs(p2.score - p1.score) / 100;
  // A monthly pass between the read before the vote and the read after it grows the kept value once more.
  const kept = hPre * k, keptThenMonth = kept + (1 - kept) * MONTHLY;
  console.log(`     positions ${p1.score} -> ${p2.score} (k ${k}), habituation before ${hPre}, after ${hPost}, day ${pre.day} -> ${s.day}`);
  if (control) {
    check(hPost === undefined || Math.abs(hPost - MONTHLY) < 1e-12, 'control: the amendment cleared the habituation (the reset P2 removes)', `${hPost}`);
  } else {
    check(k > 0.9 && k < 1, 'a one-year amendment moves the law a few points on the 0-100 scale', `${k}`);
    check(Math.abs(hPost - kept) < 1e-12 || Math.abs(hPost - keptThenMonth) < 1e-12, 'habituation kept, scaled by 1 - |position change| / 100', `${hPost} vs ${kept}`);
  }
} catch (e) {
  if (e.inconclusive) { console.log(`INCONCLUSIVE ${e.message}`); failures++; } else check(false, 'run', e.message);
}
await w.terminate();
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
