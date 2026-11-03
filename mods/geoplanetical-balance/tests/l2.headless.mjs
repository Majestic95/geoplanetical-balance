// L2 end to end, headless: the health labour-hours index (health.laborHoursIndex) in every country after one and six
// months of a normal new game (no player action), to show it starts at 1 and stays small without a health shock.
// Usage: node --max-old-space-size=6000 mods/geoplanetical-balance/tests/l2.headless.mjs [--control]
//   --control  the unmodified game (the index is about 1 everywhere: the dead channel).
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
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

const BOOT = { playerKey: '756', savePayload: null, seed: 12345,
  gameplayRules: { aiNuclearFirstUse: false, newPandemicEmergence: 'off', naturalDisasters: 'normal', aiWarDeclarations: true, worldBellicosity: 'normal' } };
let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const read = async label => {
  const c = part(await req('save.snapshot'), 'countries');
  const rows = Object.entries(c).filter(([, x]) => x?.health && Number.isFinite(x.health.laborHoursIndex))
    .map(([k, x]) => ({ k, v: x.health.laborHoursIndex, s: x.health.sickDaysPer100kYear, s0: x.health.seed?.sickDays0Per100kYear }));
  const v = rows.map(r => r.v).sort((a, b) => a - b), q = f => v[Math.min(v.length - 1, Math.floor(f * v.length))];
  console.log(`  ${label}: ${rows.length} countries; min ${v[0]?.toFixed(5)}, p10 ${q(0.1)?.toFixed(5)}, median ${q(0.5)?.toFixed(5)}, p90 ${q(0.9)?.toFixed(5)}, max ${v.at(-1)?.toFixed(5)}`);
  const worst = rows.slice().sort((a, b) => a.v - b.v).slice(0, 5);
  console.log(`    lowest: ${worst.map(r => `${r.k} ${r.v.toFixed(4)} (s ${r.s?.toFixed(1)} vs s0 ${r.s0?.toFixed(1)})`).join('; ')}`);
  return { rows, v };
};

try {
  await req('session.boot', BOOT);
  await req('clock.advanceDays', { days: 31 });
  const m1 = await read('after 1 month');
  await req('clock.advanceDays', { days: 31 * 5 });
  const m6 = await read('after 6 months');
  check(m1.rows.length > 150, 'health state in most countries', String(m1.rows.length));
  const far = r => r.filter(x => Math.abs(x.v - 1) > 0.005).length;
  if (control) {
    check(m6.v.every(x => Math.abs(x - 1) < 1e-3), 'control (unmodified game): the index stays within 0.1% of 1 everywhere');
  } else {
    check(m1.v.every(x => x >= 0.94 && x <= 1.015), 'month 1: inside the game clamp everywhere');
    check(far(m1.rows) <= m1.rows.length * 0.05, 'month 1: day 0 carries over (at most 5% of countries move more than 0.5%)', `${far(m1.rows)} of ${m1.rows.length}`);
    check(far(m6.rows) <= m6.rows.length * 0.1, 'month 6, no health shock: at most 10% of countries move more than 0.5%', `${far(m6.rows)} of ${m6.rows.length}`);
  }
} catch (e) {
  console.error(e.stack || e); failures++;
} finally {
  await w.terminate();
  console.log(failures ? `${failures} check(s) FAILED` : 'all checks passed');
  process.exit(failures ? 1 : 0);
}
