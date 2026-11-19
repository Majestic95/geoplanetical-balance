// G1 end to end, headless, through the player's own action (setAdministrationPolicy, as the UI calls it) as the
// Philippines (lower-middle income): switch the domestic priority to fiscal, advance six months, switch back to
// balanced, advance six more, and read the collection ratio, the fiscal backlog and tax revenue.
// Usage: node --max-old-space-size=6000 mods/geoplanetical-balance/tests/g1.headless.mjs [--control]
//   --control  the unmodified game: the pulse leaves collection permanently above 1.05 (the exploit).
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { WORKSPACE as ROOT, workspaceBuild as pinnedBuild, bundlePath } from 'geoplanetical-modloader/patcher/build.mjs';
import { SIM } from 'geoplanetical-modloader/patcher/session.mjs';
import { moddedWorkerData } from '../../../headless/prototype/modded.mjs';
import { part } from '../../../headless/metrics.mjs';

const build = pinnedBuild();
const control = process.argv.includes('--control');
const KEY = '608';
const { sourceText, overrides } = control ? { sourceText: undefined, overrides: {} }
  : moddedWorkerData(join(ROOT, '.modding', 'decompiled', `app-${build}`));
const w = new Worker(fileURLToPath(new URL('../../../headless/prototype/bootstrap.mjs', import.meta.url)),
  { workerData: { bundlePath: bundlePath(build, SIM), sourceText, overrides }, resourceLimits: { maxOldGenerationSizeMb: 12000 } });
let id = 0, epoch = 0; const pending = new Map();
w.on('message', m => { if (m?.type === 'response') { const p = pending.get(m.requestId); pending.delete(m.requestId); epoch = m.sessionEpoch || epoch; m.ok ? p.res(m.payload) : p.rej(new Error(JSON.stringify(m.error).slice(0, 800))); } });
w.on('error', e => { console.error('WORKER ERROR', e.stack || e); process.exit(2); });
const req = (command, payload = {}) => new Promise((res, rej) => { const r = ++id; pending.set(r, { res, rej }); w.postMessage({ protocolVersion: 2, type: 'request', requestId: r, sessionEpoch: epoch, command, payload }); });

const BOOT = { playerKey: KEY, savePayload: null, seed: 12345,
  gameplayRules: { aiNuclearFirstUse: false, newPandemicEmergence: 'off', naturalDisasters: 'normal', aiWarDeclarations: true, worldBellicosity: 'normal' } };
let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const call = async (methodId, ...args) => (await req('domain.call', { methodId, args })).result;
const read = async label => {
  const c = part(await req('save.snapshot'), 'countries')[KEY];
  const a = c.administration, q = a?.queues?.fiscal;
  const s = { ratio: a?.outcomes?.collectionRatio, backlog: q?.backlog, delay: q?.delayMonths, delay0: q?.baseline?.delayMonths,
    eff: c.eff, taxRev: c.eco?.taxRev ?? c.revGDP, priority: a?.policy?.domesticPriority?.selectedId };
  console.log(`  ${label}: ratio ${s.ratio?.toFixed(4)}, fiscal backlog ${s.backlog?.toFixed(4)} (delay ${s.delay?.toFixed(3)} vs day 0 ${s.delay0?.toFixed(3)}), tax revenue ${s.taxRev?.toFixed?.(3)} % GDP, priority ${s.priority}`);
  return s;
};

try {
  await req('session.boot', BOOT);
  const d0 = await read('day 0');
  check(Number.isFinite(d0.ratio) && Math.abs(d0.ratio - 1) < 0.02, 'day 0: collection ratio about 1', String(d0.ratio));
  const r1 = await call('setAdministrationPolicy', 'domesticPriority', 'fiscal');
  check(r1?.ok === true, 'fiscal priority accepted', JSON.stringify(r1 && { ok: r1.ok, reason: r1.reason }));
  await req('clock.advanceDays', { days: 31 * 6 });
  const m6 = await read('after 6 months on fiscal priority');
  const r2 = await call('setAdministrationPolicy', 'domesticPriority', 'balanced');
  check(r2?.ok === true, 'back to balanced accepted (cooldown passed)', JSON.stringify(r2 && { ok: r2.ok, reason: r2.reason, until: r2.cooldownUntilDay }));
  await req('clock.advanceDays', { days: 31 * 6 });
  const m12 = await read('six months after switching back');
  check(m6.backlog < d0.backlog, 'the fiscal priority drains the backlog', `${d0.backlog} -> ${m6.backlog}`);
  check([d0, m6, m12].every(s => Number.isFinite(s.taxRev)), 'tax revenue is read from the snapshot', [d0, m6, m12].map(s => s.taxRev).join(' '));
  if (control) {
    check(m12.ratio > 1.05, 'control (unmodified game): collection stays well above 1 after the pulse (the exploit)', m12.ratio.toFixed(4));
  } else {
    check(m12.ratio <= Math.pow(1.05, 0.18) * 1.02, 'after the pulse, collection gains at most about 1%', m12.ratio.toFixed(4));
    check(m6.ratio < 1.1, 'during the pulse, only the temporary catch-up term remains', m6.ratio.toFixed(4));
  }
} catch (e) {
  console.error(e.stack || e); failures++;
} finally {
  await w.terminate();
  console.log(failures ? `${failures} check(s) FAILED` : 'all checks passed');
  process.exit(failures ? 1 : 0);
}
