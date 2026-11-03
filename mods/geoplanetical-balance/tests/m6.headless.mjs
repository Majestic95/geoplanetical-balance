// M6 end to end, headless, through the real player action and the game's own save and restore. Denmark issues the
// DKK peg (members Denmark, Faroe Islands, Greenland): devalue -> every member's credibility anchor cut by 5% ->
// second devaluation refused, the view says cooldown -> save -> reload -> state carried, still refused -> day 179
// refused -> day 180 allowed, cut 10%.
// Usage: node --max-old-space-size=6000 mods/geoplanetical-balance/tests/m6.headless.mjs [--control]
//   --control  the same opening on the unmodified game: the second same-day devaluation succeeds and no anchor moves
//              (the exploit M6 closes).
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

const PLAYER = '208', MEMBERS = ['208', '234', '304'];
const BOOT = { playerKey: PLAYER, savePayload: null, seed: 12345,
  gameplayRules: { aiNuclearFirstUse: false, newPandemicEmergence: 'off', naturalDisasters: 'normal', aiWarDeclarations: true, worldBellicosity: 'normal' },
  playerControl: { partyId: 'A' } };
const DECODE = { gzip: zlib.gunzipSync, deflate: zlib.inflateSync, zstd: zlib.zstdDecompressSync };
const identity = p => { // what Electron's main process hands the page on load (electron/save-io.js:36-38)
  const raw = p.source === 'raw' || p.compression === 'identity' ? new Uint8Array(p.bytes) : DECODE[p.compression](new Uint8Array(p.bytes));
  return { id: p.id, compression: 'identity', rawBytes: raw.byteLength, bytes: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) };
};
let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const devalue = async () => (await req('domain.call', { methodId: 'devalueCurrency', args: [] })).result;
const state = async () => {
  const snap = await req('save.snapshot');
  const c = part(snap, 'countries'), f = part(snap, 'finance');
  return { snap, day: part(snap, 'core').sim.day, log: f.sovereigns[PLAYER].geobalDevaluations,
    anchors: MEMBERS.map(k => c[k].anchor), approval: c[PLAYER].approval, ccy: MEMBERS.map(k => c[k].ccyCode) };
};
// The monetary view's devalue action (found by shape: the object holding `stepPct` next to `reasonId`).
const devalueView = async () => {
  const v = await req('view.snapshot', { viewId: 'budget.country' });
  const stack = [v];
  while (stack.length) {
    const o = stack.pop();
    if (o && typeof o === 'object') {
      if ('stepPct' in o && 'reasonId' in o && 'available' in o) return o;
      stack.push(...Object.values(o));
    }
  }
  return null;
};
const ratios = (a, b) => a.anchors.map((x, i) => x / b.anchors[i]);
const near = (xs, r) => xs.every(x => Math.abs(x - r) < 1e-9);
const fmt = xs => xs.map(x => x.toFixed(6)).join(', ');

try {
  await req('session.boot', BOOT);
  const s0 = await state();
  check(s0.ccy.every(c => c === 'DKK') && s0.anchors.every(Number.isFinite), 'Denmark, Faroe Islands and Greenland share the DKK', `${s0.ccy} anchors ${fmt(s0.anchors)}`);
  const v0 = await devalueView();
  check(v0?.available === true && v0?.reasonId === null, 'day 0: the view offers the devaluation', JSON.stringify(v0));
  check(await devalue() === true, 'day 0: first devaluation succeeds');
  const s1 = await state();
  check(Math.abs(s1.approval - Math.max(0, s0.approval - 3)) < 1e-9, 'the game\'s own approval cost (-3) is unchanged', `${s0.approval} -> ${s1.approval}`);
  if (control) {
    check(near(ratios(s1, s0), 1), 'control (unmodified game): the devaluation costs no credibility', fmt(ratios(s1, s0)));
    check(await devalue() === true, 'control (unmodified game): a second same-day devaluation succeeds, the exploit M6 closes');
    throw Object.assign(new Error('control done'), { done: true });
  }
  check(near(ratios(s1, s0), 0.95), 'every member\'s anchor cut by 5%', fmt(ratios(s1, s0)));
  check(JSON.stringify(s1.log) === '[0]', 'devaluation day recorded on the sovereign', JSON.stringify(s1.log));
  check(await devalue() === false, 'day 0: second devaluation refused (cooldown)');
  const v1 = await devalueView();
  check(v1?.available === false && v1?.reasonId === 'cooldown', 'the view marks it unavailable with reason cooldown', JSON.stringify(v1 && { available: v1.available, reasonId: v1.reasonId }));
  const s2 = await state();
  check(near(ratios(s2, s1), 1) && JSON.stringify(s2.log) === '[0]', 'the refusal changed nothing');
  await req('session.boot', { playerKey: PLAYER, savePayload: { formatVersion: 3, meta: s2.snap.meta, parts: s2.snap.artifact.parts.map(identity) } });
  const s3 = await state();
  check(JSON.stringify(s3.log) === '[0]' && near(ratios(s3, s2), 1), 'state and anchors survive save and reload', `${JSON.stringify(s3.log)} ${fmt(s3.anchors)}`);
  check(await devalue() === false, 'after reload: still refused');
  check((await devalueView())?.reasonId === 'cooldown', 'after reload: the view still says cooldown');
  await req('clock.advanceDays', { days: 179 });
  check(await devalue() === false, 'day 179: still refused');
  await req('clock.advanceDays', { days: 1 });
  const s4 = await state();
  check(s4.day === 180 && (await devalueView())?.available === true, 'day 180: the view offers it again', `day ${s4.day}`);
  check(await devalue() === true, 'day 180: second devaluation allowed');
  const s5 = await state();
  check(near(ratios(s5, s4), 0.9), 'second cut is 10% (one devaluation in the last 3 years)', fmt(ratios(s5, s4)));
  check(JSON.stringify(s5.log) === '[0,180]', 'both recorded', JSON.stringify(s5.log));
  check(s5.anchors.every((x, i) => x < s0.anchors[i]), 'credibility still below the start on day 180', `${fmt(s0.anchors)} -> ${fmt(s5.anchors)}`);
} catch (e) {
  if (!e.done) check(false, 'run', e.message);
}
await w.terminate();
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
