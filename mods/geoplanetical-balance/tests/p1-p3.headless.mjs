// P1 and P3 end to end, headless, through the player's own commands (submitBill, withdrawBill, callSnapElection, as
// the UI calls them) and the game's own save and restore, as France without party control (the player holds the
// president's dissolve power there; in the UK it belongs to the head of state and the player cannot call it).
// P1: submit a government bill -> the deposit is recorded on the bill -> save -> reload -> still there -> withdraw ->
//     approval is back to its pre-bill value minus 2, the law is on hold for 30 days -> resubmission refused -> save ->
//     reload -> still on hold -> +30 days -> allowed again.
// P3 caretaker: load the same save with the government set to caretaker -> a snap election is refused
//     (formation_pending: 0 days in caretaker status, though the assembly is over 500 days old) -> the monthly review
//     records the caretaker watch (status put back to caretaker while the game re-forms it) -> it survives save and
//     reload -> with the watch moved back 60 days the dissolution is allowed and clears the watch -> caretaker again:
//     refused; then the untouched save is reloaded.
// P3: call a snap election (allowed: the assembly was elected before the game started) -> +1 day -> call again ->
//     refused, approval unchanged, the refusal notice carries reason recent_mandate.
// Usage: node --max-old-space-size=6000 mods/geoplanetical-balance/tests/p1-p3.headless.mjs [--control]
//   --control  the unmodified game: withdrawal takes back only a positive deposit (since 26346311), resubmission is
//              allowed at once and the second snap election succeeds (what P1 and P3 change).
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import zlib from 'node:zlib';
import { WORKSPACE as ROOT, workspaceBuild as pinnedBuild, bundlePath } from 'geoplanetical-modloader/patcher/build.mjs';
import { SIM } from 'geoplanetical-modloader/patcher/session.mjs';
import { moddedWorkerData } from '../../../headless/prototype/modded.mjs';
import { part } from '../../../headless/metrics.mjs';

const KEY = '250';
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
const DECODE = { gzip: zlib.gunzipSync, deflate: zlib.inflateSync, zstd: zlib.zstdDecompressSync };
const identity = p => { // what Electron's main process hands the page on load (electron/save-io.js:36-38)
  const raw = p.source === 'raw' || p.compression === 'identity' ? new Uint8Array(p.bytes) : DECODE[p.compression](new Uint8Array(p.bytes));
  return { id: p.id, compression: 'identity', rawBytes: raw.byteLength, bytes: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) };
};
let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const call = async (methodId, ...args) => (await req('domain.call', { methodId, args })).result;
const state = async () => {
  const snap = await req('save.snapshot');
  const core = part(snap, 'core');
  return { snap, c: part(snap, 'countries')[KEY], day: core.sim?.day ?? null, core };
};
const reload = async snap => {
  await req('session.boot', { playerKey: KEY, savePayload: { formatVersion: 3, meta: snap.meta, parts: snap.artifact.parts.map(identity) } });
};
// Domain events kept in the save's journal (z pushes every event there), found by shape.
const journal = core => {
  const out = [], stack = [core];
  while (stack.length) {
    const o = stack.pop();
    if (o && typeof o === 'object') {
      if (o.schema === 'domain-event.v1') out.push(o); else stack.push(...Object.values(o));
    }
  }
  return out.sort((a, b) => a.id - b.id);
};
const close = (a, b) => Math.abs(a - b) <= 1e-9;

try {
  await req('session.boot', BOOT);
  // ---- P1 ----
  let s = await state();
  const day0 = s.day ?? 0;
  // A government bill with a non-zero deposit: lower the retirement age, else other common reforms.
  const laws = s.c.laws;
  const candidates = [['retirement_age', Number(laws.retirement_age) - 2], ['paid_annual_leave', Number(laws.paid_annual_leave) + 5],
    ['weekly_working_time', Number(laws.weekly_working_time) - 3], ['paid_parental_leave', Number(laws.paid_parental_leave) + 8]];
  let lawId = null, a0 = s.c.approval, a1 = null;
  for (const [law, target] of candidates) {
    if (!Number.isFinite(target)) continue;
    const r = await call('submitBill', law, target);
    const st = await state(), after = st.c;
    if (r?.ok && !r.decreed && after.approval !== a0) { lawId = law; a1 = after.approval; s = st; break; }
    if (r?.ok && !r.decreed) { await call('withdrawBill', law); a0 = (await state()).c.approval; }
  }
  check(!!lawId, 'a government bill with a non-zero deposit was submitted', `${lawId}: approval ${a0} -> ${a1} (deposit ${(a1 - a0).toFixed(4)})`);
  if (!lawId) throw Object.assign(new Error('no bill'), { done: true });
  const bill = () => (s.c.procedures || []).find(p => p.kind === 'law' && p.lawId === lawId);
  if (control) {
    check(bill() && !('geobalDeposit' in bill()), 'control: no deposit recorded on the bill');
    check(await call('withdrawBill', lawId) === true, 'control: withdrawn');
    const c2 = (await state()).c;
    // Since build 26346311 the game takes back max(0, the deposit recomputed now): a same-day withdrawal of a popular
    // bill nets -2, an unpopular bill keeps its deposit.
    check(Math.abs(c2.approval - (a1 > a0 ? a0 - 2 : a1 - 2)) < 1e-6, 'control: the game takes back a positive deposit, keeps a negative one', `${a0} -> ${a1} -> ${c2.approval}`);
    check((await call('submitBill', lawId, candidates.find(x => x[0] === lawId)[1]))?.ok === true, 'control: resubmitted at once (the exploit P1 closes)');
    await call('withdrawBill', lawId);
  } else {
    check(close(bill()?.geobalDeposit, a1 - a0), 'deposit recorded on the bill', `${bill()?.geobalDeposit}`);
    await reload(s.snap);
    s = await state();
    check(close(bill()?.geobalDeposit, a1 - a0) && close(s.c.approval, a1), 'deposit survives save and reload', `${bill()?.geobalDeposit}`);
    check(await call('withdrawBill', lawId) === true, 'withdrawn after reload');
    s = await state();
    check(close(s.c.approval, a0 - 2), 'approval back to its pre-bill value minus 2', `${a0} -> ${a1} -> ${s.c.approval}`);
    check(s.c.lawCooldown?.[lawId] === day0 + 30 && !bill(), 'law on hold for 30 days (lawCooldown), bill removed', JSON.stringify(s.c.lawCooldown));
    const target = candidates.find(x => x[0] === lawId)[1];
    const refused = await call('submitBill', lawId, target);
    check(refused?.ok === false && refused.reason === 'cooldown', 'resubmission refused (cooldown)', JSON.stringify(refused)?.slice(0, 120));
    await reload(s.snap);
    s = await state();
    check(s.c.lawCooldown?.[lawId] === day0 + 30, 'hold survives save and reload', JSON.stringify(s.c.lawCooldown));
    check((await call('submitBill', lawId, target))?.reason === 'cooldown', 'after reload: still refused');
    await req('clock.advanceDays', { days: 29 });
    check((await call('submitBill', lawId, target))?.reason === 'cooldown', 'day 29: still refused');
    await req('clock.advanceDays', { days: 1 });
    const again = await call('submitBill', lawId, target);
    check(again?.ok === true, 'day 30: resubmission allowed', JSON.stringify(again)?.slice(0, 120));
    if (again?.ok) await call('withdrawBill', lawId);
  }

  // ---- P3, caretaker: time in caretaker status, not the election's age ----
  // A save whose government has just become caretaker (edited in the save, loaded through the game's own load path).
  // The assembly was elected before the game (over 500 days ago), so an election-age rule would let it dissolve.
  s = await state();
  const formed = s.snap;
  // Boot `snap` with the player's government set to caretaker (same government id) and its watch edited by `watch`.
  const bootCaretaker = async (snap, watch = w0 => w0) => {
    const parts = snap.artifact.parts.map(identity).map(p => {
      if (p.id !== 'countries') return p;
      const all = JSON.parse(new TextDecoder().decode(new Uint8Array(p.bytes)));
      all[KEY].pol.institutionState.government.status = 'caretaker';
      const wv = watch(all[KEY].geobalCaretakerWatch);
      if (wv) all[KEY].geobalCaretakerWatch = wv; else delete all[KEY].geobalCaretakerWatch;
      const raw = new TextEncoder().encode(JSON.stringify(all));
      return { id: p.id, compression: 'identity', rawBytes: raw.byteLength, bytes: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) };
    });
    await req('session.boot', { playerKey: KEY, savePayload: { formatVersion: 3, meta: snap.meta, parts } });
  };
  {
    await bootCaretaker(formed, () => null);
    let t = await state();
    const gov = () => t.c.pol.institutionState.government;
    check(gov()?.status === 'caretaker', 'caretaker government loaded', gov()?.status);
    const apC = t.c.approval, seqC = Math.max(0, ...journal(t.core).map(e => e.id));
    const r = await call('callSnapElection');
    t = await state();
    if (control) {
      check(r === true, 'control: a fresh caretaker government dissolves at once');
    } else {
      const ev = journal(t.core).filter(e => e.type === 'politics.snap_election_rejected' && e.id > seqC).pop();
      check(r === false && close(t.c.approval, apC) && ev?.payload?.reason === 'formation_pending', 'fresh caretaker refused (formation_pending), approval unchanged', JSON.stringify(ev?.payload));
      // The monthly country review (T6C, on the country's hashed day) starts the watch, as YJQ does for the AI. The game
      // re-forms the edited government within days, so it is put back to caretaker (same id) until a review sees it.
      let seen = null, reboots = 0;
      for (let d = 0; d < 40 && !seen; d++) {
        if (gov()?.status !== 'caretaker') { await bootCaretaker(t.snap); reboots++; }
        await req('clock.advanceDays', { days: 1 });
        t = await state();
        if (t.c.geobalCaretakerWatch) seen = { ...t.c.geobalCaretakerWatch, day: t.day, govId: String(gov()?.id) };
      }
      // The game may form a new government (new id) in between; the watch must name the one caretaker on the review day.
      check(!!seen && seen.governmentId === seen.govId && seen.sinceDay === seen.day, 'monthly review records the caretaker watch', `${JSON.stringify(seen)} (status put back ${reboots} times)`);
      if (seen) {
        if (gov()?.status !== 'caretaker') { await bootCaretaker(t.snap); t = await state(); }
        check(await call('callSnapElection') === false, 'still refused right after the watch starts');
        t = await state();
        await reload(t.snap);
        t = await state();
        check(JSON.stringify(t.c.geobalCaretakerWatch) === JSON.stringify({ governmentId: seen.governmentId, sinceDay: seen.sinceDay }), 'watch survives save and reload', JSON.stringify(t.c.geobalCaretakerWatch));
        // 60 days in caretaker status (watch moved back): the dissolution is allowed and clears the watch, as YJQ does
        // after an AI dissolution, so a hung result cannot be dissolved again the next day on the old clock.
        await bootCaretaker(t.snap, wv => ({ ...wv, sinceDay: wv.sinceDay - 60 }));
        t = await state();
        const ok = await call('callSnapElection');
        t = await state();
        check(ok === true && !t.c.geobalCaretakerWatch, 'after 60 caretaker days: allowed, and the watch is cleared', `${ok} ${JSON.stringify(t.c.geobalCaretakerWatch)} status ${gov()?.status}`);
        await bootCaretaker(t.snap);
        check(await call('callSnapElection') === false, 'caretaker again the next moment (hung result): refused, clock restarted');
      }
    }
    await reload(formed);
  }

  // ---- P3 ----
  s = await state();
  const contest = () => s.c.pol.institutionState.contests['election:chamber:an'];
  const next0 = contest()?.nextDay;
  check(Number.isFinite(next0) && next0 - (s.day ?? 0) >= 180, 'assembly elected before the game, next election far away', `day ${s.day}, nextDay ${next0}`);
  const ap0 = s.c.approval;
  check(await call('callSnapElection') === true, 'first snap election allowed');
  s = await state();
  check(close(s.c.approval, ap0 - 3) && contest().nextDay > next0, 'it cost 3 approval and rescheduled the next election', `${ap0} -> ${s.c.approval}, nextDay ${contest().nextDay}`);
  await req('clock.advanceDays', { days: 1 });
  s = await state();
  const ap1 = s.c.approval, seq = Math.max(0, ...journal(s.core).map(e => e.id));
  const second = await call('callSnapElection');
  const s2 = await state();
  if (control) {
    check(second === true && close(s2.c.approval, ap1 - 3), 'control: second snap election a day later succeeds (the exploit P3 closes)', `${ap1} -> ${s2.c.approval}`);
  } else {
    check(second === false && close(s2.c.approval, ap1), 'second snap election a day later refused, approval unchanged', `${second}, ${ap1} -> ${s2.c.approval}`);
    const ev = journal(s2.core).filter(e => e.type === 'politics.snap_election_rejected').pop();
    check(ev?.payload?.reason === 'recent_mandate' && ev.payload.countryKey === KEY && ev.id > seq, 'refusal notice with reason recent_mandate', JSON.stringify(ev?.payload));
    check(s2.c.pol.institutionState.government?.status !== 'caretaker', 'government formed (not caretaker)', s2.c.pol.institutionState.government?.status);
  }
} catch (e) {
  if (!e.done) check(false, 'run', e.message);
}
await w.terminate();
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
