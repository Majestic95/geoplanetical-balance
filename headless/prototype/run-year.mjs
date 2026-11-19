// Prototype: boot, advance N days in steps, report timing/memory, hash the full save snapshot.
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const [,, bundlePath, playerKey = '756', seed = '12345', days = '365', step = '30', tag = 'run'] = process.argv;
const t0 = performance.now(); const T = () => ((performance.now() - t0) / 1000).toFixed(1) + 's';
const w = new Worker(fileURLToPath(new URL('./bootstrap.mjs', import.meta.url)), { workerData: { bundlePath }, resourceLimits: { maxOldGenerationSizeMb: 12000 } });
let id = 0, epoch = 0; const pending = new Map();
w.on('message', m => { if (m?.type === 'response') { const p = pending.get(m.requestId); pending.delete(m.requestId); epoch = m.sessionEpoch || epoch; m.ok ? p.res(m.payload) : p.rej(new Error(JSON.stringify(m.error).slice(0, 800))); } });
w.on('error', e => { console.error(tag, T(), 'WORKER ERROR', e.stack || e); process.exit(2); });
const req = (command, payload = {}) => new Promise((res, rej) => { const r = ++id; pending.set(r, { res, rej }); w.postMessage({ protocolVersion: 2, type: 'request', requestId: r, sessionEpoch: epoch, command, payload }); });
const rss = () => (process.memoryUsage().rss / 1e9).toFixed(2) + 'GB';
try {
  await req('session.boot', { playerKey, seed: Number(seed) });
  console.log(tag, T(), 'booted rss', rss());
  let last = performance.now();
  for (let d = 0; d < Number(days); d += Number(step)) {
    const a = await req('clock.advanceDays', { days: Math.min(Number(step), Number(days) - d) });
    const now = performance.now();
    if ((d / Number(step)) % 3 === 2 || d + Number(step) >= Number(days)) console.log(tag, T(), 'day', a.status?.day, `+${((now - last) / 1000).toFixed(1)}s`, 'rss', rss());
    last = now;
  }
  const h = (await req('view.snapshot', { viewId: 'hud' })).player;
  console.log(tag, T(), 'hud', JSON.stringify({ gdp: h.gdp, growth: h.growth, infl: h.inflation, unemp: h.unemployment, debt: h.debtRatio, treas: h.treasury, appr: h.approval }));
  const snap = await req('save.snapshot');
  const hash = createHash('sha256'); let bytes = 0;
  for (const p of snap.artifact.parts) { const b = new Uint8Array(p.bytes); hash.update(b); bytes += b.byteLength; }
  console.log(tag, T(), 'snapshot', snap.artifact.parts.length, 'parts', (bytes / 1e6).toFixed(1), 'MB sha256', hash.digest('hex').slice(0, 16));
} catch (e) { console.error(tag, T(), 'FAILED', e.message); process.exitCode = 1; }
await w.terminate(); process.exit(process.exitCode ?? 0);
