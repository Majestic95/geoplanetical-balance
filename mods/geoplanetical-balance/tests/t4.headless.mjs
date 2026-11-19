// T4 end to end, headless: at day 0 every country with a day-0 external-financing record stores exactly its day-0
// rating there, and after a month the values survive the game's save and restore unchanged. Usage:
// node --max-old-space-size=6000 mods/geoplanetical-balance/tests/t4.headless.mjs
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
// Every stored day-0 rating (externalFinancing0.geobalRating0), keyed by the nearest country-like key above it.
const ratings = snap => {
  const out = {};
  for (const p of snap.artifact.parts) {
    let root;
    try { root = part(snap, p.id); } catch { continue; } // some parts are binary (statistics)
    const stack = [[root, '?']];
    while (stack.length) {
      const [o, key] = stack.pop();
      if (!o || typeof o !== 'object') continue;
      if (o.externalFinancing0 && typeof o.externalFinancing0 === 'object' && 'geobalRating0' in o.externalFinancing0) out[`${p.id}:${o.key ?? key}`] = o.externalFinancing0.geobalRating0;
      for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object') stack.push([v, /^\d{3}$/.test(k) ? k : key]);
    }
  }
  return out;
};
let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };

try {
  await req('session.boot', BOOT);
  let day0Count = 0;
  {
    // Compare on the same object: the record's stored rating against the country's own day-0 rating.
    const pairs = [];
    for (const p of (await req('save.snapshot')).artifact.parts) {
      let root;
      try { root = part({ artifact: { parts: [p] } }, p.id); } catch { continue; }
      const stack = [root];
      while (stack.length) {
        const o = stack.pop();
        if (!o || typeof o !== 'object') continue;
        const f = o.externalFinancing0;
        if (f && typeof f === 'object' && 'privateFinancingPct' in f) pairs.push([o.key ?? '?', f.geobalRating0, o.rating]);
        for (const v of Object.values(o)) if (v && typeof v === 'object') stack.push(v);
      }
    }
    const off = pairs.filter(([, s, r]) => s !== r);
    day0Count = pairs.length;
    check(pairs.length >= 150 && off.length === 0, 'day 0: every stored rating equals the day-0 rating', off.length ? `${off.length} of ${pairs.length}: ${JSON.stringify(off.slice(0, 6))}` : `${pairs.length} countries`);
  }
  await req('clock.advanceDays', { days: 31 });
  const snap = await req('save.snapshot');
  const before = ratings(snap), keys = Object.keys(before);
  check(keys.length >= day0Count - 2 && keys.every(k => Number.isFinite(before[k])), 'after a month, the records still carry a finite day-0 rating (at most 2 lost to splits or merges)', `${keys.length} of ${day0Count} at day 0, e.g. ${keys.slice(0, 4).map(k => `${k} ${before[k]}`).join(', ')}`);
  await req('session.boot', { playerKey: '756', savePayload: { formatVersion: 3, meta: snap.meta, parts: snap.artifact.parts.map(identity) } });
  await req('clock.advanceDays', { days: 1 });
  const after = ratings(await req('save.snapshot'));
  const changed = keys.filter(k => after[k] !== before[k]);
  check(changed.length === 0, 'day-0 ratings survive save and reload unchanged', changed.length ? JSON.stringify(changed.slice(0, 5).map(k => [k, before[k], after[k]])) : `${keys.length} kept`);
} catch (e) {
  check(false, 'run', e.message);
}
await w.terminate();
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
