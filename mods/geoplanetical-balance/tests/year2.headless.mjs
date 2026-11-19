// Year-two references, headless: the full mod for 18 months. A1 re-takes its election reference on day 365, A3/C17
// stores its switch rates and D1/D2 its rating reference from day 365; all three survive the game's save and restore.
// --rows <file> also writes the monthly measurements, to compare with an unmodified run of the same length.
// Usage: node --max-old-space-size=6000 mods/geoplanetical-balance/tests/year2.headless.mjs [--rows <file>]
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import zlib from 'node:zlib';
import { WORKSPACE as ROOT, workspaceBuild as pinnedBuild, bundlePath } from 'geoplanetical-modloader/patcher/build.mjs';
import { SIM } from 'geoplanetical-modloader/patcher/session.mjs';
import { moddedWorkerData } from '../../../headless/prototype/modded.mjs';
import { part, measure } from '../../../headless/metrics.mjs';
import { writeFileSync } from 'node:fs';

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
// Per country: the three references taken from day 365, and E13's carbon-intensity reference (taken at game start),
// read from the countries part.
const refs = snap => {
  const c = part(snap, 'countries'), out = {};
  for (const [k, b] of Object.entries(c)) if (b && typeof b === 'object' && b.pop > 0) out[k] = { growthGap0: b._growthGap0, growthMark: b.geobalGrowthRef365 ?? null, userCost: b.geobalUserCost0 ?? null, rating: b.geobalRatingRef ?? null, co2: b.geobalCo2I0 ?? null };
  return out;
};
let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const out = process.argv.includes('--rows') ? process.argv[process.argv.indexOf('--rows') + 1] : null;

try {
  await req('session.boot', BOOT);
  const rows = [{ month: 0, ...measure(await req('save.snapshot')) }];
  const r0 = refs(await req('save.snapshot'));
  check(Object.values(r0).every(r => r.userCost === null && r.rating === null), 'day 0: no A3/C17 or D1/D2 reference yet');
  const co2 = Object.keys(r0).filter(k => Number.isFinite(r0[k].co2));
  check(co2.length >= 150, 'E13: every country with power data has its carbon-intensity reference from day 0', `${co2.length} of ${Object.keys(r0).length}, e.g. 156 ${r0['156']?.co2}`);
  let snap = null, at12 = null;
  for (let m = 1; m <= 18; m++) {
    await req('clock.advanceDays', { days: 31 });
    snap = await req('save.snapshot');
    rows.push({ month: m, ...measure(snap) });
    if (m === 11) at12 = refs(snap); // day 341: before the references
    if (m === 11) check(Object.values(at12).every(r => r.userCost === null && r.rating === null), 'month 11 (day 341): still no reference');
  }
  if (out) writeFileSync(out, rows.map(r => JSON.stringify(r)).join('\n'));
  const r18 = refs(snap), keys = Object.keys(r18);
  const uc = keys.filter(k => r18[k].userCost && Number.isFinite(r18[k].userCost.s1) && Number.isFinite(r18[k].userCost.c0) && r18[k].userCost.v === 2);
  const rr = keys.filter(k => r18[k].rating && ['growth', 'inflation', 'debt'].every(f => Number.isFinite(r18[k].rating[f])));
  check(uc.length >= 150, 'A3/C17: countries carry the switch rates after day 365', `${uc.length} of ${keys.length}, e.g. 756 ${JSON.stringify(r18['756']?.userCost)}`);
  check(rr.length >= 150, 'D1/D2: countries carry the rating reference after day 365', `${rr.length} of ${keys.length}, e.g. 756 ${JSON.stringify(r18['756']?.rating)}`);
  check(co2.every(k => r18[k]?.co2 === r0[k].co2), 'E13: the carbon-intensity reference is taken once (unchanged at month 18)');
  const moved = keys.filter(k => Number.isFinite(r0[k]?.growthGap0) && r18[k].growthGap0 !== r0[k].growthGap0);
  check(moved.length >= 100, 'A1: the election reference was re-taken on day 365', `${moved.length} of ${keys.length} changed`);
  check(keys.filter(k => r18[k].growthMark === 365).length >= 150, 'A1: the re-take is marked with its day (365)', `${keys.filter(k => r18[k].growthMark === 365).length} of ${keys.length}`);
  await req('session.boot', { playerKey: '756', savePayload: { formatVersion: 3, meta: snap.meta, parts: snap.artifact.parts.map(identity) } });
  const after = refs(await req('save.snapshot'));
  const lost = keys.filter(k => JSON.stringify(after[k]) !== JSON.stringify(r18[k]));
  check(lost.length === 0, 'all the references (and the A1 marker) survive save and reload unchanged', lost.length ? JSON.stringify(lost.slice(0, 4).map(k => [k, r18[k], after[k]])) : `${keys.length} countries`);
  // E13 on a save without the mod's references (an older save): loading takes none (a reloaded game must equal a
  // continuous one); the month-end pass takes them for every country with power data.
  const parts = snap.artifact.parts.map(identity), ci = parts.findIndex(x => x.id === 'countries');
  const cobj = JSON.parse(new TextDecoder().decode(new Uint8Array(parts[ci].bytes)));
  for (const b of Object.values(cobj)) if (b && typeof b === 'object') delete b.geobalCo2I0;
  const enc = new TextEncoder().encode(JSON.stringify(cobj));
  parts[ci] = { ...parts[ci], rawBytes: enc.byteLength, bytes: enc.buffer.slice(enc.byteOffset, enc.byteOffset + enc.byteLength) };
  await req('session.boot', { playerKey: '756', savePayload: { formatVersion: 3, meta: snap.meta, parts } });
  const atLoad = refs(await req('save.snapshot'));
  check(Object.values(atLoad).every(r => r.co2 === null), 'E13: loading a save without the references takes none');
  await req('clock.advanceDays', { days: 31 });
  const rs = refs(await req('save.snapshot')), back = Object.keys(rs).filter(k => Number.isFinite(rs[k].co2) && rs[k].co2 >= 0);
  check(back.length >= 150, 'E13: the month-end pass takes them back', `${back.length} of ${Object.keys(rs).length}, e.g. 756 ${rs['756']?.co2}`);
} catch (e) {
  check(false, 'run', e.message);
}
await w.terminate();
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
