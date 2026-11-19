// T14 end to end, headless, through the real player actions: Switzerland borrows in foreign currency (its domestic
// bond rate must not move), then issues domestic debt (the rate must become that issue's clearing rate).
// Usage: node --max-old-space-size=6000 mods/geoplanetical-balance/tests/t14.headless.mjs [--control]
//   --control  the same on the unmodified game: the foreign-currency borrowing overwrites the domestic rate (the bug).
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
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

const PLAYER = '756';
const BOOT = { playerKey: PLAYER, savePayload: null, seed: 12345,
  gameplayRules: { aiNuclearFirstUse: false, newPandemicEmergence: 'off', naturalDisasters: 'normal', aiWarDeclarations: true, worldBellicosity: 'normal' },
  playerControl: { partyId: 'SVP' } };
let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const call = async (methodId, args = []) => (await req('domain.call', { methodId, args })).result;
const state = async () => {
  const snap = await req('save.snapshot');
  const b = part(snap, 'countries')[PLAYER], s = part(snap, 'finance').sovereigns[PLAYER];
  return { bondRate: b.bondRate, ccy: b.ccyCode, sovereignCcy: s.currencyCode };
};

try {
  await req('session.boot', BOOT);
  const s0 = await state();
  check(s0.ccy === 'CHF' && s0.sovereignCcy === 'CHF' && Number.isFinite(s0.bondRate), 'Switzerland: CHF, sovereign record in CHF', `bond rate ${s0.bondRate}`);
  check(await call('borrowForeignCurrency', [10]) === true, 'foreign-currency borrowing succeeds');
  const s1 = await state();
  if (control) check(s1.bondRate !== s0.bondRate, 'control (unmodified game): the foreign issue overwrote the domestic bond rate (the bug T14 fixes)', `${s0.bondRate} -> ${s1.bondRate}`);
  else check(s1.bondRate === s0.bondRate, 'the domestic bond rate is unchanged by the foreign issue', `${s0.bondRate} -> ${s1.bondRate}`);
  // The player's domestic issue quote (owA) prices the auction from bondRate, so the overwrite also reprices the
  // next domestic issue at the foreign rate.
  const res = await call('issueDebt', [5]);
  const s2 = await state();
  const rate = res && typeof res === 'object' ? res.ratePct : undefined;
  const detail = `issue ${JSON.stringify(res && { ok: res.ok, ratePct: res.ratePct, reason: res.reason })}, bond rate ${s2.bondRate}`;
  check(res?.ok === true && Number.isFinite(rate) && s2.bondRate === rate, 'a domestic issue sets the bond rate to its clearing rate', detail);
  if (control) check(rate === s1.bondRate && rate !== s0.bondRate, 'control (unmodified game): the next domestic CHF issue clears at the foreign rate', detail);
  else check(rate === s0.bondRate, 'the next domestic CHF issue clears at the domestic rate it had before the foreign borrowing', detail);
} catch (e) {
  check(false, 'run', e.message);
}
await w.terminate();
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
