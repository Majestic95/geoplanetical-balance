// Save/reload determinism: mode "straight" runs 0->61; mode "reload" runs 0->31, snapshots, reboots from the
// snapshot in the same worker, runs ->61. Both print the final snapshot hash. Also times each month alone.
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';
import { resolve, dirname } from 'node:path';
// What Electron's main process does on load: hand the page uncompressed parts (save-io.js:36-38).
const DECODE = { gzip: zlib.gunzipSync, deflate: zlib.inflateSync, zstd: zlib.zstdDecompressSync };
const toIdentity = p => {
  const raw = p.source === 'raw' || p.compression === 'identity' ? new Uint8Array(p.bytes) : DECODE[p.compression](new Uint8Array(p.bytes));
  const bytes = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  return { id: p.id, compression: 'identity', rawBytes: bytes.byteLength, bytes };
};
const [,, bundlePath, mode = 'straight', withMods = ''] = process.argv;
// withMods = "mod": run every mod in mods/, built by the launcher's own loader (modded.mjs).
let sourceText, overrides = {};
if (withMods === 'mod') {
  ({ sourceText, overrides } = (await import('./modded.mjs')).moddedWorkerData(resolve(dirname(bundlePath), '..')));
}
const t0 = performance.now(); const T = () => ((performance.now() - t0) / 1000).toFixed(1) + 's';
const w = new Worker(fileURLToPath(new URL('./bootstrap.mjs', import.meta.url)), { workerData: { bundlePath, sourceText, overrides }, resourceLimits: { maxOldGenerationSizeMb: 12000 } });
let id = 0, epoch = 0; const pending = new Map();
w.on('message', m => { if (m?.type === 'response') { const p = pending.get(m.requestId); pending.delete(m.requestId); epoch = m.sessionEpoch || epoch; m.ok ? p.res(m.payload) : p.rej(new Error(JSON.stringify(m.error).slice(0, 1500))); } });
w.on('error', e => { console.error(mode, T(), 'WORKER ERROR', e.stack || e); process.exit(2); });
const req = (command, payload = {}, transfer) => new Promise((res, rej) => { const r = ++id; pending.set(r, { res, rej }); w.postMessage({ protocolVersion: 2, type: 'request', requestId: r, sessionEpoch: epoch, command, payload }, transfer); });
const digest = snap => { const h = createHash('sha256'); for (const p of snap.artifact.parts) h.update(new Uint8Array(p.bytes)); return h.digest('hex').slice(0, 16); };
const adv = async n => { const a = performance.now(); const r = await req('clock.advanceDays', { days: n }); console.log(mode, T(), 'day', r.status?.day, `+${((performance.now() - a) / 1000).toFixed(1)}s`); };
try {
  await req('session.boot', { playerKey: '756', seed: 12345 });
  console.log(mode, T(), 'booted');
  await adv(31);
  if (mode === 'reload') {
    const snap = await req('save.snapshot');
    console.log(mode, T(), 'saved at day 31, hash', digest(snap), 'parts', snap.artifact.parts.map(p => p.id + ':' + p.source + '/' + p.compression).join(' '));
    const parts = undefined;
    const b = await req('session.boot', { playerKey: '756', savePayload: { formatVersion: 3, parts: snap.artifact.parts.map(toIdentity), meta: snap.meta } }, parts);
    console.log(mode, T(), 'rebooted from save, day', b.status?.day, 'epoch', b.sessionEpoch);
  }
  await adv(30);
  const end = await req('save.snapshot');
  console.log(mode, withMods ? 'with mods' : 'unmodded', T(), 'FINAL day 61 hash', digest(end));
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(`dump-${mode}${withMods}`, { recursive: true });
  for (const p of end.artifact.parts) { const id = toIdentity(p); writeFileSync(`dump-${mode}${withMods}/${p.id}.json`, new Uint8Array(id.bytes)); }
  console.log(mode, T(), 'dumped', end.artifact.parts.length, 'parts');
} catch (e) { console.error(mode, T(), 'FAILED', e.message); process.exitCode = 1; }
await w.terminate(); process.exit(process.exitCode ?? 0);
