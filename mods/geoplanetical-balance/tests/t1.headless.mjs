// T1 end to end, headless, through the real player action and the game's own save and restore:
// borrow -> second borrow refused (cooldown, and the view says why) -> save -> reload from the save -> still refused,
// state carried -> +31 days -> allowed again -> borrow every 31 days until the yearly cap clips an amount.
// Usage: node --max-old-space-size=6000 mods/geoplanetical-balance/tests/t1.headless.mjs [--control]
//   --control  run the same sequence on the unmodified game: the second same-day borrowing must succeed there
//              (the exploit), proving the refusals come from T1.
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import zlib from 'node:zlib';
import { WORKSPACE as ROOT, workspaceBuild as pinnedBuild, bundlePath } from 'geoplanetical-modloader/patcher/build.mjs';
import { SIM } from 'geoplanetical-modloader/patcher/session.mjs';
import { moddedWorkerData } from '../../../headless/prototype/modded.mjs';
import { part } from '../../../headless/metrics.mjs';

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

const BOOT = { playerKey: '756', savePayload: null, seed: 12345,
  gameplayRules: { aiNuclearFirstUse: false, newPandemicEmergence: 'off', naturalDisasters: 'normal', aiWarDeclarations: true, worldBellicosity: 'normal' },
  playerControl: { partyId: 'SVP' } };
const DECODE = { gzip: zlib.gunzipSync, deflate: zlib.inflateSync, zstd: zlib.zstdDecompressSync };
const identity = p => { // what Electron's main process hands the page on load (electron/save-io.js:36-38)
  const raw = p.source === 'raw' || p.compression === 'identity' ? new Uint8Array(p.bytes) : DECODE[p.compression](new Uint8Array(p.bytes));
  return { id: p.id, compression: 'identity', rawBytes: raw.byteLength, bytes: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) };
};
let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const borrow = async amountBn => (await req('domain.call', { methodId: 'borrowForeignCurrency', args: [amountBn] })).result;
const field = async () => {
  const snap = await req('save.snapshot');
  return { snap, log: part(snap, 'finance').sovereigns['756'].geobalFxBorrowing, gdpNom: part(snap, 'countries')['756'].gdpNom };
};

// The monetary view's FX borrow action (found by shape: the object holding `reasonId` next to `amountBn`).
const borrowView = async () => {
  const v = await req('view.snapshot', { viewId: 'budget.country' });
  const stack = [v];
  while (stack.length) {
    const o = stack.pop();
    if (o && typeof o === 'object') {
      if ('reasonId' in o && 'amountBn' in o && 'available' in o) return o;
      stack.push(...Object.values(o));
    }
  }
  return null;
};

try {
  await req('session.boot', BOOT);
  check(await borrow(10) === true, 'day 0: first foreign-currency borrowing succeeds');
  if (control) {
    check(await borrow(10) === true, 'control (unmodified game): second same-day borrowing succeeds, the exploit T1 closes');
    throw Object.assign(new Error('control done'), { done: true });
  }
  check(await borrow(10) === false, 'day 0: second borrowing refused (cooldown)');
  const view = await borrowView();
  check(view?.available === false && view?.reasonId === 'cooldown', 'the view marks the action unavailable with reason cooldown', JSON.stringify(view && { available: view.available, reasonId: view.reasonId }));
  const before = await field();
  check(Array.isArray(before.log) && before.log.length === 1 && before.log[0][0] === 0 && before.log[0][1] > 0, 'state recorded on the sovereign', JSON.stringify(before.log));
  await req('session.boot', { playerKey: '756', savePayload: { formatVersion: 3, meta: before.snap.meta, parts: before.snap.artifact.parts.map(identity) } });
  const after = await field();
  check(JSON.stringify(after.log) === JSON.stringify(before.log), 'state survives save and reload', JSON.stringify(after.log));
  check(await borrow(10) === false, 'after reload: still refused (cooldown carried)');
  await req('clock.advanceDays', { days: 31 });
  check(await borrow(10) === true, 'day 31: borrowing allowed again');
  const end = await field();
  check(Array.isArray(end.log) && end.log.length === 2, 'second borrowing recorded', JSON.stringify(end.log));
  // Switzerland (AAA) may borrow 10% of GDP a year. Ask for 29 bn every 31 days until the cap clips an amount.
  let clipped = null;
  for (let i = 0; i < 6 && !clipped; i++) {
    await req('clock.advanceDays', { days: 31 });
    const ok = await borrow(29);
    const { log, gdpNom } = await field();
    const lastAmount = log[log.length - 1][1];
    // Clipped by T1, not by the game's own 3%-of-GDP offer (cLQ): below both the 29 bn asked and 3% of GDP.
    if (ok && lastAmount < Math.min(29, 0.03 * gdpNom) - 1e-6) clipped = { day: log[log.length - 1][0], amountBn: lastAmount, gdpNom, log };
    if (!ok) { clipped = { refused: true, log }; break; }
  }
  check(!!clipped && !clipped.refused, 'the yearly cap clips a borrowing to the room left', JSON.stringify(clipped));
  const used = clipped?.log?.reduce((s, e) => s + e[1], 0) ?? 0;
  const cap = 0.1 * (clipped?.gdpNom ?? NaN);
  // The clipped borrowing fills the room exactly: the total equals 10% of GDP (AAA) up to rounding and GDP drift.
  check(Math.abs(used - cap) <= 0.005 * cap, 'total borrowed in the window equals the AAA cap of 10% of GDP', `${used.toFixed(2)} bn vs cap ${cap.toFixed(2)} bn`);
} catch (e) {
  if (!e.done) check(false, 'run', e.message);
}
await w.terminate();
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
