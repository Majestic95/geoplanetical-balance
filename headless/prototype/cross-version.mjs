// Save compatibility across mod versions. Step 1 (in a folder holding the OLD mod version):
//   node --max-old-space-size=6000 headless/prototype/cross-version.mjs save <bundlePath> <save.json> [days=31]
// Step 2 (in the old folder, then in the new one):
//   node --max-old-space-size=6000 headless/prototype/cross-version.mjs load <bundlePath> <save.json> <summary.json> [days=60]
// The mods are those of the current folder's mods/ (modded.mjs). An old-version folder (a git worktree) also needs
// .modding/decompiled and node_modules: link them to the main checkout's with Windows junctions (`mklink /J`), and
// remove the links with `rmdir` (never a recursive
// delete) before removing the worktree. `load` boots from the save, advances, and writes a
// summary of every country (approval, budget mode, deficit, debt, rating, mod fields) for comparison. Test tool only.
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import zlib from 'node:zlib';

const DECODE = { gzip: zlib.gunzipSync, deflate: zlib.inflateSync, zstd: zlib.zstdDecompressSync };
const toIdentity = p => {
  const raw = p.source === 'raw' || p.compression === 'identity' ? new Uint8Array(p.bytes) : DECODE[p.compression](new Uint8Array(p.bytes));
  return { id: p.id, compression: 'identity', rawBytes: raw.byteLength, bytes: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) };
};
const [,, mode, bundlePath, file, out, daysArg] = process.argv;
const days = Number((mode === 'save' ? out : daysArg) || (mode === 'save' ? 31 : 60));
const { sourceText, overrides } = (await import('./modded.mjs')).moddedWorkerData(resolve(dirname(bundlePath), '..'));
const w = new Worker(fileURLToPath(new URL('./bootstrap.mjs', import.meta.url)), { workerData: { bundlePath, sourceText, overrides }, resourceLimits: { maxOldGenerationSizeMb: 12000 } });
let id = 0, epoch = 0; const pending = new Map();
w.on('message', m => { if (m?.type === 'response') { const p = pending.get(m.requestId); pending.delete(m.requestId); epoch = m.sessionEpoch || epoch; m.ok ? p.res(m.payload) : p.rej(new Error(JSON.stringify(m.error).slice(0, 1500))); } });
w.on('error', e => { console.error(mode, 'WORKER ERROR', e.stack || e); process.exit(2); });
const req = (command, payload = {}) => new Promise((res, rej) => { const r = ++id; pending.set(r, { res, rej }); w.postMessage({ protocolVersion: 2, type: 'request', requestId: r, sessionEpoch: epoch, command, payload }); });
try {
  if (mode === 'save') {
    await req('session.boot', { playerKey: '756', seed: 12345 });
    const r = await req('clock.advanceDays', { days });
    const snap = await req('save.snapshot');
    const parts = snap.artifact.parts.map(toIdentity).map(p => ({ id: p.id, b64: Buffer.from(p.bytes).toString('base64') }));
    writeFileSync(file, JSON.stringify({ meta: snap.meta, parts }));
    console.log('saved day', r.status?.day, 'parts', parts.length, '->', file);
  } else if (mode === 'load') {
    const s = JSON.parse(readFileSync(file, 'utf8'));
    const parts = s.parts.map(p => { const b = Buffer.from(p.b64, 'base64'); return { id: p.id, compression: 'identity', rawBytes: b.byteLength, bytes: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; });
    const b = await req('session.boot', { playerKey: '756', savePayload: { formatVersion: 3, parts, meta: s.meta } });
    console.log('loaded at day', b.status?.day);
    const r = await req('clock.advanceDays', { days });
    const end = await req('save.snapshot');
    const decoded = end.artifact.parts.map(toIdentity);
    const summary = { day: r.status?.day, parts: {} };
    for (const p of decoded) {
      let v; try { v = JSON.parse(Buffer.from(p.bytes).toString('utf8')); } catch { v = null; }
      summary.parts[p.id] = v ? Object.keys(v).length : 'binary';
      const cs = p.id === 'countries' ? v : null;
      if (cs && typeof cs === 'object') {
        const list = Object.entries(cs).map(([k, c]) => ({ ...c, key: c?.key ?? k }));
        summary.countries = list.filter(c => c && c.key != null).map(c => ({ key: c.key, approval: c.approval, mode: c.brain?.economicPolicy?.mode, deficitNow: c.deficitNow, debtRatio: c.debtRatio, rating: c.rating,
          gap0: c.__geobalBondGap0, gapKey: c.__geobalBondGapKey, sig: c.brain?.attention?.observed?.warSignature, defenseIntent: !!c.brain?.attention?.pending?.defense }));
      }
    }
    writeFileSync(out, JSON.stringify(summary));
    console.log('played to day', r.status?.day, 'countries', summary.countries?.length ?? 'not found', '->', out);
  } else throw new Error('mode must be save or load');
} catch (e) { console.error(mode, 'FAILED', e.message); process.exitCode = 1; }
await w.terminate(); process.exit(process.exitCode ?? 0);
