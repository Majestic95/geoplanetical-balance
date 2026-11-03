// A5/C9 end to end, headless, through the player's own action (setSectorPublicShare, as the UI calls it) as Russia:
// privatise the most state-held sector the efficiency formula applies to, advance six months, and check the stored
// efficiency rises above 1 toward the private ceiling, the quote shows it, and it survives save and reload.
// Usage: node --max-old-space-size=6000 mods/geoplanetical-balance/tests/a5-c9.headless.mjs [--control]
//   --control  the unmodified game: efficiency stays at or below 1.
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

const BOOT = { playerKey: '643', savePayload: null, seed: 12345,
  gameplayRules: { aiNuclearFirstUse: false, newPandemicEmergence: 'off', naturalDisasters: 'normal', aiWarDeclarations: true, worldBellicosity: 'normal' } };
const DECODE = { gzip: zlib.gunzipSync, deflate: zlib.inflateSync, zstd: zlib.zstdDecompressSync };
const identity = p => {
  const raw = p.source === 'raw' || p.compression === 'identity' ? new Uint8Array(p.bytes) : DECODE[p.compression](new Uint8Array(p.bytes));
  return { id: p.id, compression: 'identity', rawBytes: raw.byteLength, bytes: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) };
};
let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const call = async (methodId, ...args) => (await req('domain.call', { methodId, args })).result;
// The quote, without changing anything: a privatisation up to a 100% public share is refused (direction_mismatch), and
// the refusal carries the game's quote (kaQ returns { ok: false, reason, quote }).
const quote = async sectorId => (await call('setSectorPublicShare', { sectorId, direction: 'privatize', fraction: 1 }))?.quote;
const own = async () => part(await req('save.snapshot'), 'countries')['643']?.sectorOwnership || {};
// The game's sector factors (sog): efficiency loss from public ownership; 0 for health, education, public.
const F = { utilities: 0.06, transport: 0.05, energy: 0.1, mining: 0.1, agriculture: 0.1, industry: 0.12, construction: 0.12,
  finance: 0.14, trade: 0.16, services: 0.16, consumer: 0.16, hospitality: 0.16, leisure: 0.16, realestate: 0.12, business: 0.14,
  tech: 0.22, ict: 0.22, knowledge: 0.22 };

try {
  await req('session.boot', BOOT);
  // The sector with the largest public share among those the formula applies to (f > 0) that can be privatised.
  const quotes = [];
  // Energy is skipped: privatising it to zero faults the unmodified game itself (financial-markets:ownership-quantity:
  // treasury-equity), a game bug outside this fix.
  for (const sectorId of Object.keys(F).filter(k => k !== 'energy')) {
    const q = await quote(sectorId);
    if (q && Number.isFinite(q.publicShare) && q.minShare < q.publicShare - 0.05) quotes.push({ sectorId, ...q });
  }
  // Rank by the efficiency gain full privatisation would bring: f x (share0^2 - minShare^2).
  const gain = q => F[q.sectorId] * ((q.anchorShare ?? q.publicShare) ** 2 - q.minShare ** 2);
  quotes.sort((a, b) => gain(b) - gain(a));
  const s = quotes[0];
  check(!!s, 'found a privatisable sector with a public share', s ? `${s.sectorId}: public ${s.publicShare.toFixed(3)} (day 0 ${s.anchorShare?.toFixed(3)}), can go to ${s.minShare.toFixed(3)}` : JSON.stringify(quotes.slice(0, 3)));
  if (!s) throw Object.assign(new Error('no sector'), { done: true });
  // Part of the way: down 0.3 of public share, or to the floor the quote allows.
  const to = Math.max(s.minShare, s.publicShare - 0.3);
  const r = await call('setSectorPublicShare', { sectorId: s.sectorId, direction: 'privatize', fraction: to });
  check(r?.ok === true, 'privatisation accepted', JSON.stringify(r && { ok: r.ok, reason: r.reason }));
  const target = (1 - F[s.sectorId] * to ** 2) / (1 - F[s.sectorId] * s.anchorShare ** 2);
  await req('clock.advanceDays', { days: 31 * 6 });
  const snap = await req('save.snapshot'), eff = part(snap, 'countries')['643'].sectorOwnership[s.sectorId].efficiency;
  const q6 = await quote(s.sectorId);
  console.log(`  ${s.sectorId}: target ${target.toFixed(4)}, stored efficiency after 6 months ${eff}, quote shows ${q6?.efficiencyNow}, value added ${q6?.valueAddedBnY?.toFixed?.(2)} bn (day 0 ${s.valueAddedBnY?.toFixed?.(2)})`);
  if (control) {
    check(eff <= 1, 'control (unmodified game): efficiency never above 1', String(eff));
    await req('session.boot', { playerKey: '643', savePayload: { formatVersion: 3, meta: snap.meta, parts: snap.artifact.parts.map(identity) } });
    const rec = (await own())[s.sectorId];
    console.log(`  control after reload: sector record ${JSON.stringify(rec)?.slice(0, 300)}; keys ${Object.keys(await own()).join(' ')}`);
  } else {
    check(target > 1.005 && eff > 1.002 && eff <= target + 1e-9, 'efficiency rises above 1 toward the private ceiling', `${eff} of ${target.toFixed(4)}`);
    check(Math.abs(q6.efficiencyNow - eff) < 1e-12, 'the quote shows the stored efficiency (not clamped to 1)');
    await req('session.boot', { playerKey: '643', savePayload: { formatVersion: 3, meta: snap.meta, parts: snap.artifact.parts.map(identity) } });
    const rec = (await own())[s.sectorId];
    console.log(`  after reload: sector record ${JSON.stringify(rec)?.slice(0, 300)}; keys ${Object.keys(await own()).join(' ')}`);
    const after = rec?.efficiency;
    check(after === eff, 'efficiency above 1 survives save and reload', `${after}`);
  }
} catch (e) {
  if (!e.done) check(false, 'run', e.message);
}
await w.terminate();
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
