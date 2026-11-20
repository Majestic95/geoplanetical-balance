// Q20 end to end through the game's own save and restore: the day the enemy's support reached zero is kept in the
// player's sovereign record (finance.sovereigns[player].geobalEnemyZero, keyed by war) because the war's own record
// is saved with a fixed field list. The test boots the modded game with an eval hook, has the player declare a real
// war, runs the war step once with the enemy's support pinned at 0 (the record is written), saves, checks the record in
// the saved finance part, reloads from the save, checks the record and the war again, and runs the war step 60 days
// after the recorded day: the war must end in the player's victory. Test tooling only; never shipped.
// Usage: node --max-old-space-size=6000 mods/geoplanetical-balance/tests/q20.headless.mjs
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import zlib from 'node:zlib';
import { WORKSPACE as ROOT, workspaceBuild as pinnedBuild, bundlePath } from 'geoplanetical-modloader/patcher/build.mjs';
import { SIM } from 'geoplanetical-modloader/patcher/session.mjs';
import { moddedWorkerData } from '../../../headless/prototype/modded.mjs';
import { part } from '../../../headless/metrics.mjs';

const build = pinnedBuild();
const mod = moddedWorkerData(join(ROOT, '.modding', 'decompiled', `app-${build}`));
const HOOK_AT = '})();\n/*! Bundled license information';
if (mod.sourceText.split(HOOK_AT).length !== 2) throw new Error('eval hook point not found exactly once');
const sourceText = mod.sourceText.replace(HOOK_AT, ';globalThis.__geoEval=async __s=>{const __r=[];const check=(c,l,d)=>{__r.push({pass:!!c,label:l,detail:d});return !!c};' +
  'const value=await eval("(async()=>{"+__s+"\\n})()");return {value,checks:__r}};' + HOOK_AT);
const w = new Worker(fileURLToPath(new URL('../../../headless/prototype/bootstrap.mjs', import.meta.url)),
  { workerData: { bundlePath: bundlePath(build, SIM), sourceText, overrides: mod.overrides }, resourceLimits: { maxOldGenerationSizeMb: 12000 } });
let id = 0, epoch = 0; const pending = new Map(), evals = new Map();
w.on('message', m => {
  if (m?.type === 'response') { const p = pending.get(m.requestId); pending.delete(m.requestId); epoch = m.sessionEpoch || epoch; m.ok ? p.res(m.payload) : p.rej(new Error(JSON.stringify(m.error).slice(0, 800))); }
  else if (m?.type === 'geo-eval') { evals.get(m.id)?.(m); evals.delete(m.id); }
});
w.on('error', e => { console.error('WORKER ERROR', e.stack || e); process.exit(2); });
const req = (command, payload = {}) => new Promise((res, rej) => { const r = ++id; pending.set(r, { res, rej }); w.postMessage({ protocolVersion: 2, type: 'request', requestId: r, sessionEpoch: epoch, command, payload }); });
const evalIn = async (code) => {
  const r = await new Promise(res => { const i = ++id; evals.set(i, res); w.postMessage({ type: 'geo-eval', id: i, code }); });
  if (!r.ok) throw new Error(r.error);
  const v = JSON.parse(r.value);
  for (const c of v.checks) check(c.pass, c.label, c.detail == null ? '' : JSON.stringify(c.detail));
  return v.value;
};
const DECODE = { gzip: zlib.gunzipSync, deflate: zlib.inflateSync, zstd: zlib.zstdDecompressSync };
const identity = p => {
  const raw = p.source === 'raw' || p.compression === 'identity' ? new Uint8Array(p.bytes) : DECODE[p.compression](new Uint8Array(p.bytes));
  return { id: p.id, compression: 'identity', rawBytes: raw.byteLength, bytes: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) };
};
let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const BOOT = { playerKey: '756', savePayload: null, seed: 12345,
  gameplayRules: { aiNuclearFirstUse: false, newPandemicEmergence: 'off', naturalDisasters: 'normal', aiWarDeclarations: true, worldBellicosity: 'normal' } };
// Runs the war step once with the enemy's support pinned at `s`, at the world's day `d` (null = today).
const STEP = (s, d) => String.raw`
const e = Ogr.sim, pk = e.playerKey, wk = globalThis.__q20Enemy, w = e.wars.get(wk);
if (!w) return { ended: true };
const real8t = _8t, day0 = e.day;
_8t = () => ${s};
try { if (${d} != null) e.day = ${d}; const g = i8o(e, w, e.countries.get(pk), e.countries.get(wk)); for (let x = g.next(); !x.done; x = g.next()); }
finally { _8t = real8t; e.day = day0; }
return { ended: e.wars.get(wk) !== w, record: e.finance.sovereigns[pk].geobalEnemyZero ?? null, warKey: __geobalWarKey(w), day: e.day };`;

try {
  await req('session.boot', BOOT);
  await req('clock.advanceDays', { days: 30 });
  const start = await evalIn(String.raw`
const e = Ogr.sim, pk = e.playerKey;
let enemy = null, tried = 0;
for (const c of [...e.countries.values()].sort((a, b) => K(a.key, b.key))) {
  if (c.key === pk || ha(e, pk, c.key) || yr(e, pk, c.key)) continue;
  tried++;
  if (e.declareWar(c.key, 'conquest')) { enemy = c.key; break; }
  if (tried > 40) break;
}
check(!!enemy, 'the player declared a war', String(enemy));
globalThis.__q20Enemy = enemy;
return { enemy, day: e.day, warId: e.wars.get(enemy)?.id ?? null };`);
  const s1 = await evalIn(STEP(0, null));
  check(!s1.ended && Number.isInteger(s1.record?.[s1.warKey]), 'support 0: the day is recorded, the war goes on', JSON.stringify(s1));
  const zeroDay = s1.record?.[s1.warKey];
  const snap = await req('save.snapshot');
  const saved = part(snap, 'finance').sovereigns?.['756']?.geobalEnemyZero;
  check(saved?.[s1.warKey] === zeroDay, 'the record is in the saved finance part', JSON.stringify(saved));
  await req('session.boot', { playerKey: '756', savePayload: { formatVersion: 3, meta: snap.meta, parts: snap.artifact.parts.map(identity) } });
  const back = await evalIn(String.raw`
const e = Ogr.sim, wk = globalThis.__q20Enemy, w = e.wars.get(wk);
check(!!w && w.status === 'active', 'after reload: the war is there');
check(!!w && __geobalWarKey(w) === ${JSON.stringify(s1.warKey)}, 'after reload: the war key is the same');
return { record: e.finance.sovereigns[e.playerKey].geobalEnemyZero ?? null };`);
  check(back.record?.[s1.warKey] === zeroDay, 'after reload: the record survives', JSON.stringify(back.record));
  const s2 = await evalIn(STEP(0, zeroDay + 59));
  check(!s2.ended, 'after reload, 59 days at 0: the war goes on', JSON.stringify(s2));
  const s3 = await evalIn(STEP(0, zeroDay + 60));
  check(s3.ended, 'after reload, 60 days at 0: the war has ended', JSON.stringify(s3));
  console.log('detail', JSON.stringify({ start, zeroDay }));
} catch (e) { check(false, 'run', e.message); }
await w.terminate();
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
