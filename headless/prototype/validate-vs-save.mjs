// Compare an in-game save (day N) with a headless run booted with the exact page boot payload.
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';
const [,, appDir, savePath, days] = process.argv;
const require = createRequire(import.meta.url);
const saveIo = require(`${appDir}/electron/save-io.js`);
const DECODE = { gzip: zlib.gunzipSync, deflate: zlib.inflateSync, zstd: zlib.zstdDecompressSync };
const raw = p => p.compression === 'identity' ? new Uint8Array(p.bytes) : DECODE[p.compression](new Uint8Array(p.bytes));
const game = await saveIo.readSavePayloadFileAsync(savePath);
mkdirSync('dump-game', { recursive: true });
for (const p of game.parts) writeFileSync(`dump-game/${p.id}.json`, raw(p));
console.log('game save: day', game.meta?.inGameDay, 'seed0?', game.meta?.seed0, 'parts', game.parts.map(p => p.id + ':' + p.compression).join(' '));
const w = new Worker(fileURLToPath(new URL('./bootstrap.mjs', import.meta.url)), { workerData: { bundlePath: `${appDir}/renderer/simulation-worker.bundle.js` }, resourceLimits: { maxOldGenerationSizeMb: 12000 } });
let id = 0, epoch = 0; const pending = new Map();
w.on('message', m => { if (m?.type === 'response') { const p = pending.get(m.requestId); pending.delete(m.requestId); epoch = m.sessionEpoch || epoch; m.ok ? p.res(m.payload) : p.rej(new Error(JSON.stringify(m.error).slice(0, 800))); } });
const req = (command, payload = {}) => new Promise((res, rej) => { const r = ++id; pending.set(r, { res, rej }); w.postMessage({ protocolVersion: 2, type: 'request', requestId: r, sessionEpoch: epoch, command, payload }); });
await req('session.boot', { playerKey: '756', savePayload: null, seed: 12345,
  gameplayRules: { aiNuclearFirstUse: false, newPandemicEmergence: 'off', naturalDisasters: 'normal', aiWarDeclarations: true, worldBellicosity: 'normal' },
  playerControl: { partyId: 'SVP' },
  viewSubscriptions: ['shell', 'hud', 'player.control', 'sitroom', 'globe.structure', 'globe.visual', 'globe.effects', 'globe.climateReference', 'identity.flags'].map(viewId => ({ viewId })) });
const a = await req('clock.advanceDays', { days: Number(days) });
const snap = await req('save.snapshot');
mkdirSync('dump-headless', { recursive: true });
for (const p of snap.artifact.parts) writeFileSync(`dump-headless/${p.id}.json`, p.source === 'raw' ? new Uint8Array(p.bytes) : raw(p));
console.log('headless: day', a.status?.day, 'meta day', snap.meta?.inGameDay);
await w.terminate(); process.exit(0);
