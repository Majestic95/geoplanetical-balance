// T2 end to end, headless: after a month every priced (floating or managed) currency carries geobalCaPct0, and the
// values survive the game's own save and restore unchanged. Usage:
// node --max-old-space-size=6000 mods/geoplanetical-balance/tests/t2.headless.mjs
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import zlib from 'node:zlib';
import { WORKSPACE as ROOT, workspaceBuild as pinnedBuild, bundlePath } from 'geoplanetical-modloader/patcher/build.mjs';
import { SIM } from 'geoplanetical-modloader/patcher/session.mjs';
import { moddedWorkerData } from '../../../headless/prototype/modded.mjs';
import { part } from '../../../headless/metrics.mjs';

const build = pinnedBuild();
const { sourceText, overrides } = moddedWorkerData(join(ROOT, '.modding', 'decompiled', `app-${build}`));
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
const identity = p => {
  const raw = p.source === 'raw' || p.compression === 'identity' ? new Uint8Array(p.bytes) : DECODE[p.compression](new Uint8Array(p.bytes));
  return { id: p.id, compression: 'identity', rawBytes: raw.byteLength, bytes: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) };
};
// Every baseline in the saved state (sovereign.geobalCaPct0 maps), keyed by currency code.
const baselines = snap => {
  const out = {};
  for (const p of snap.artifact.parts) {
    let root;
    try { root = part(snap, p.id); } catch { continue; } // some parts are binary (statistics)
    const stack = [root];
    while (stack.length) {
      const o = stack.pop();
      if (!o || typeof o !== 'object') continue;
      if (o.geobalCaPct0 && typeof o.geobalCaPct0 === 'object') for (const [code, value] of Object.entries(o.geobalCaPct0)) out[code] = { value, regime: null };
      for (const v of Object.values(o)) if (v && typeof v === 'object') stack.push(v);
    }
  }
  return out;
};
let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };

try {
  await req('session.boot', BOOT);
  check(Object.keys(baselines(await req('save.snapshot'))).length === 0, 'day 0: no baseline yet (no pricing has run)');
  await req('clock.advanceDays', { days: 31 });
  const snap = await req('save.snapshot');
  const before = baselines(snap);
  const codes = Object.keys(before);
  check(codes.length >= 10 && codes.every(c => Number.isFinite(before[c].value)), 'after a month, priced currencies carry a finite baseline', `${codes.length} currencies, e.g. ${codes.slice(0, 4).map(c => `${c} ${before[c].value.toFixed(2)}`).join(', ')}`);
  await req('session.boot', { playerKey: '756', savePayload: { formatVersion: 3, meta: snap.meta, parts: snap.artifact.parts.map(identity) } });
  await req('clock.advanceDays', { days: 1 });
  const after = baselines(await req('save.snapshot'));
  const changed = codes.filter(c => after[c]?.value !== before[c].value);
  check(changed.length === 0, 'baselines survive save and reload unchanged', changed.length ? JSON.stringify(changed.slice(0, 5)) : `${codes.length} kept`);
} catch (e) {
  check(false, 'run', e.message);
}
await w.terminate();
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
