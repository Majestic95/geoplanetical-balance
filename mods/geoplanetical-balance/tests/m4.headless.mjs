// M4 end to end, headless, through the real player actions and the game's own save and restore. China (the law makes
// its central bank government-controlled, so the player may take control) takes control and restores independence on
// the same day, then plays on. Run twice from the same seed, one after the other: the full mod without the M4 patch
// (the original behaviour, everything else equal) and the full mod. Checks: the same-day toggle leaves no trace
// without M4 and costs credibility with it; the control day survives save and reload; the daily step records days
// under control.
// Usage: node --max-old-space-size=6000 mods/geoplanetical-balance/tests/m4.headless.mjs
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';
import { SIM } from 'geoplanetical-modloader/patcher/session.mjs';
import { part } from '../../../headless/metrics.mjs';

const build = pinnedBuild();
const variant = drop => {
  const mods = loadMods(MODS_DIR, { only: ['geoplanetical-balance'] }).map(m => ({ ...m, patches: m.patches.filter(p => !drop.includes(p.id)) }));
  const built = buildAll(build, mods);
  return { sourceText: built.get(SIM).text, overrides: Object.fromEntries([...built].filter(([b]) => b !== SIM).map(([b, r]) => [b, r.text])) };
};
const PLAYER = '156';
const BOOT = { playerKey: PLAYER, savePayload: null, seed: 12345,
  gameplayRules: { aiNuclearFirstUse: false, newPandemicEmergence: 'off', naturalDisasters: 'normal', aiWarDeclarations: true, worldBellicosity: 'normal' },
  playerControl: { partyId: 'PCC' } };
const DECODE = { gzip: zlib.gunzipSync, deflate: zlib.inflateSync, zstd: zlib.zstdDecompressSync };
const identity = p => { // what Electron's main process hands the page on load (electron/save-io.js:36-38)
  const raw = p.source === 'raw' || p.compression === 'identity' ? new Uint8Array(p.bytes) : DECODE[p.compression](new Uint8Array(p.bytes));
  return { id: p.id, compression: 'identity', rawBytes: raw.byteLength, bytes: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) };
};
let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };

async function play(name, { sourceText, overrides }, reload) {
  const w = new Worker(fileURLToPath(new URL('../../../headless/prototype/bootstrap.mjs', import.meta.url)),
    { workerData: { bundlePath: bundlePath(build, SIM), sourceText, overrides }, resourceLimits: { maxOldGenerationSizeMb: 12000 } });
  let id = 0, epoch = 0; const pending = new Map();
  w.on('message', m => { if (m?.type === 'response') { const p = pending.get(m.requestId); pending.delete(m.requestId); epoch = m.sessionEpoch || epoch; m.ok ? p.res(m.payload) : p.rej(new Error(JSON.stringify(m.error).slice(0, 800))); } });
  w.on('error', e => { console.error(name, 'WORKER ERROR', e.stack || e); process.exit(2); });
  const req = (command, payload = {}) => new Promise((res, rej) => { const r = ++id; pending.set(r, { res, rej }); w.postMessage({ protocolVersion: 2, type: 'request', requestId: r, sessionEpoch: epoch, command, payload }); });
  const call = async (methodId, args = []) => (await req('domain.call', { methodId, args })).result;
  const state = async () => {
    const snap = await req('save.snapshot');
    const b = part(snap, 'countries')[PLAYER];
    return { snap, day: part(snap, 'core').sim.day, anchor: b.anchor, anchor0: b.anchor0, rel: b.anchor / b.anchor0,
      cbAuto: b.cbAuto, controlDay: b.geobalCbControlDay, policyRate: b.policyRate, law: b.laws?.central_bank_status };
  };
  const out = {};
  try {
    await req('session.boot', BOOT);
    await req('clock.advanceDays', { days: 1 });
    out.s1 = await state();
    out.took = await call('setPolicyRate', [out.s1.policyRate]);
    out.restored = await call('restoreCbIndependence');
    out.s2 = await state();
    await req('clock.advanceDays', { days: 60 });
    out.s3 = await state();
    if (reload) {
      await req('session.boot', { playerKey: PLAYER, savePayload: { formatVersion: 3, meta: out.s3.snap.meta, parts: out.s3.snap.artifact.parts.map(identity) } });
      out.s3r = await state();
    }
    await req('clock.advanceDays', { days: 30 });
    out.s4 = await state();
    out.took2 = await call('setPolicyRate', [out.s4.policyRate]);
    await req('clock.advanceDays', { days: 2 });
    out.s5 = await state();
  } catch (e) {
    out.error = e.message;
  }
  await w.terminate();
  for (const k of Object.keys(out)) if (out[k]?.snap) delete out[k].snap;
  return out;
}

const fmt = s => s && `day ${s.day} anchor ${s.anchor?.toFixed(5)} (${(100 * s.rel).toFixed(2)}% of ${s.anchor0}) cbAuto ${s.cbAuto} controlDay ${s.controlDay}`;
const base = await play('without M4', variant(['m4-cb-independence-credibility']), false);
const mod = await play('with M4', variant([]), true);
check(!base.error && !mod.error, 'both runs completed', base.error || mod.error || '');
if (!base.error && !mod.error) {
  check(mod.s1.law === 'government_controlled' && mod.s1.cbAuto === true, 'China: law government-controlled, bank independent at the start', `${mod.s1.law}, cbAuto ${mod.s1.cbAuto}`);
  check(mod.s1.anchor === base.s1.anchor, 'day 1: identical before any player action', `${mod.s1.anchor} / ${base.s1.anchor}`);
  check(base.took === true && base.restored === true && mod.took === true && mod.restored === true, 'take control (set a rate) and restore on the same day: both accepted');
  check(base.s2.controlDay === undefined && mod.s2.controlDay === 1 && mod.s2.cbAuto === true, 'with M4 the restore records the control day', `${base.s2.controlDay} / ${mod.s2.controlDay}`);
  console.log(`     without M4: ${fmt(base.s3)}\n     with M4:    ${fmt(mod.s3)}`);
  check(mod.s3.rel < base.s3.rel - 0.03, '60 days later: credibility clearly lower with M4 (the toggle is no longer free)', `${(100 * mod.s3.rel).toFixed(2)}% vs ${(100 * base.s3.rel).toFixed(2)}%`);
  check(mod.s3r.controlDay === 1 && mod.s3r.anchor === mod.s3.anchor && mod.s3r.cbAuto === true, 'control day and anchor survive save and reload', fmt(mod.s3r));
  check(mod.s4.rel < base.s4.rel - 0.03, '90 days later: still lower', `${(100 * mod.s4.rel).toFixed(2)}% vs ${(100 * base.s4.rel).toFixed(2)}%`);
  // The day counter may advance before or after the macro step within a day: the last recorded day is the last step.
  check(mod.took2 === true && mod.s5.cbAuto === false && mod.s5.controlDay >= mod.s5.day - 1 && mod.s5.controlDay <= mod.s5.day && mod.s5.controlDay > mod.s4.day,
    'under control the daily step records each day', fmt(mod.s5));
  check(base.s5.controlDay === undefined, 'without M4 nothing is recorded');
}
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
