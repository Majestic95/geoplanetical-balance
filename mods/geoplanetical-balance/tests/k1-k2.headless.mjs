// K1/K2 end to end, headless: the unmodified game, then the modded one, from the same start (Switzerland, seed 12345),
// one simulation worker at a time.
//   Player (K1, K2): the facility planner quote for 1 and 500 hospitals, then the 500-hospital order (hqA), a 10-unit
//   gas plant (buildPlantAt -> Z7A, quote HeQ) and a 2,000 km motorway programme (gjB). Expected with the mod: none
//   is refused; an order that fits construction capacity keeps its months; one that does not is stretched to the
//   months the capacity needs, at most 3x (the AI's own limit, Skg), and the project carries the quoted months.
//   AI (K2): six months of new projects by kind (count, mean months) against the unmodified game, and the number of
//   countries short of power. Reported, not asserted, apart from AI power plants still being started.
//   Day 0: the construction part at boot is byte-identical (the patch changes no genesis project).
// Usage: node --max-old-space-size=6000 mods/geoplanetical-balance/tests/k1-k2.headless.mjs [--months N]
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { WORKSPACE as ROOT, workspaceBuild as pinnedBuild, bundlePath } from 'geoplanetical-modloader/patcher/build.mjs';
import { SIM } from 'geoplanetical-modloader/patcher/session.mjs';
import { moddedWorkerData } from '../../../headless/prototype/modded.mjs';
import { part } from '../../../headless/metrics.mjs';

const build = pinnedBuild();
const argAfter = flag => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : null; };
const MONTHS = Math.max(1, Math.min(6, Number(argAfter('--months')) || 6));
const PLAYER = '756';
const BOOT = { playerKey: PLAYER, savePayload: null, seed: 12345,
  gameplayRules: { aiNuclearFirstUse: false, newPandemicEmergence: 'off', naturalDisasters: 'normal', aiWarDeclarations: true, worldBellicosity: 'normal' },
  playerControl: { partyId: 'SVP' } };
let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };

async function run(modded) {
  const { sourceText, overrides } = modded ? moddedWorkerData(join(ROOT, '.modding', 'decompiled', `app-${build}`)) : { sourceText: undefined, overrides: {} };
  const w = new Worker(fileURLToPath(new URL('../../../headless/prototype/bootstrap.mjs', import.meta.url)),
    { workerData: { bundlePath: bundlePath(build, SIM), sourceText, overrides }, resourceLimits: { maxOldGenerationSizeMb: 12000 } });
  let id = 0, epoch = 0; const pending = new Map();
  w.on('message', m => { if (m?.type === 'response') { const p = pending.get(m.requestId); pending.delete(m.requestId); epoch = m.sessionEpoch || epoch; m.ok ? p.res(m.payload) : p.rej(new Error(JSON.stringify(m.error).slice(0, 800))); } });
  w.on('error', e => { console.error('WORKER ERROR', e.stack || e); process.exit(2); });
  const req = (command, payload = {}) => new Promise((res, rej) => { const r = ++id; pending.set(r, { res, rej }); w.postMessage({ protocolVersion: 2, type: 'request', requestId: r, sessionEpoch: epoch, command, payload }); });
  const call = async (methodId, args = []) => (await req('domain.call', { methodId, args })).result;
  const projects = async () => part(await req('save.snapshot'), 'construction');
  const out = { label: modded ? 'modded' : 'control' };
  try {
    await req('session.boot', BOOT);
    const p0 = await projects();
    out.day0 = fnv(JSON.stringify(p0));
    const maxId0 = p0.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);
    const quote = async units => (await req('view.snapshot', { viewId: 'public.facilityPlanner', params: { facilityId: 'hospital', units, provinceKeys: [] } })).quote;
    out.q1 = (await quote(1)).months;
    out.q500 = (await quote(500)).months;
    const fac = await call('startPublicFacilityProgram', ['hospital', 500, []]);
    let ps = await projects();
    out.facility = { ok: fac?.ok === true, reason: fac?.reason ?? null, months: [...new Set(ps.filter(p => fac?.projectIds?.includes(p.id)).map(p => p.monthsTotal))] };
    const before = new Set(ps.map(p => p.id));
    const plant = await call('buildPlantAt', [46.95, 7.45, 'gas', 10]);
    ps = await projects();
    const np = ps.filter(p => !before.has(p.id) && p.kind === 'plant' && p.owner === PLAYER);
    out.plant = { ok: plant === true, months: np.map(p => p.monthsTotal) };
    const surf = await call('startSurfaceInfrastructureProgram', ['motorway', 2000, []]);
    ps = await projects();
    out.surface = { ok: surf?.ok === true, reason: surf?.reason ?? null, quoteMonths: surf?.quote?.months ?? null,
      months: [...new Set(ps.filter(p => surf?.projectIds?.includes(p.id)).map(p => p.monthsTotal))] };
    const playerIds = new Set(ps.filter(p => p.owner === PLAYER && Number(p.id) > maxId0).map(p => p.id));
    for (let m = 1; m <= MONTHS; m++) await req('clock.advanceDays', { days: 31 });
    const snap = await req('save.snapshot');
    const fin = part(snap, 'construction').filter(p => Number(p.id) > maxId0 && !playerIds.has(p.id) && p.owner !== PLAYER);
    out.ai = {};
    for (const p of fin) {
      const e = out.ai[p.kind] ||= { n: 0, months: 0 };
      e.n++; e.months += Number(p.monthsTotal) || 0;
    }
    const countries = part(snap, 'countries');
    const short = Object.values(countries).map(c => Number(c?.energy?.deficitFrac)).filter(Number.isFinite);
    out.powerShort = short.length ? short.filter(x => x > 0.01).length : null;
    out.day = (part(snap, 'core')?.day) ?? null;
  } catch (e) {
    out.error = e.message;
  }
  await w.terminate();
  return out;
}

const C = await run(false);
console.log(JSON.stringify(C));
const M = await run(true);
console.log(JSON.stringify(M));
check(!C.error && !M.error, 'both runs complete', C.error || M.error || '');
if (!C.error && !M.error) {
  check(C.day0 === M.day0, 'day 0: the construction part is identical', `${C.day0} / ${M.day0}`);
  check(M.q1 === C.q1, 'K1: a 1-hospital quote that fits capacity keeps its months', `${C.q1} / ${M.q1}`);
  check(M.q500 > C.q500 && M.q500 <= 3 * C.q500, 'K1: the 500-hospital quote (more than the room) is stretched, at most 3x', `${C.q500} -> ${M.q500}`);
  check(C.facility.ok && M.facility.ok, 'K1: the player\'s 500-hospital order is accepted in both', `${C.facility.reason} / ${M.facility.reason}`);
  check(M.facility.months.length === 1 && M.facility.months[0] === M.q500, 'K1: the ordered projects carry the quoted months', JSON.stringify(M.facility.months));
  check(C.plant.ok === M.plant.ok, 'K2: the player\'s gas plant is never refused by the patch', `${C.plant.ok} / ${M.plant.ok}`);
  check(C.plant.ok && M.plant.ok, 'K2: the gas plant starts in both runs (so the stretch is tested)', `${C.plant.ok} / ${M.plant.ok}`);
  if (C.plant.ok && M.plant.ok) check(M.plant.months[0] > C.plant.months[0] && M.plant.months[0] <= 3 * C.plant.months[0], 'K2: the plant months are stretched by capacity, at most 3x', `${C.plant.months} -> ${M.plant.months}`);
  check(C.surface.ok === M.surface.ok, 'K2: the player\'s motorway programme is never refused by the patch', `${C.surface.reason} / ${M.surface.reason}`);
  check(C.surface.ok && M.surface.ok, 'K2: the motorway programme starts in both runs (so the stretch is tested)', `${C.surface.reason} / ${M.surface.reason}`);
  if (C.surface.ok && M.surface.ok) {
    check(M.surface.quoteMonths > C.surface.quoteMonths && M.surface.quoteMonths <= 3 * C.surface.quoteMonths, 'K2: the programme months are stretched by capacity, at most 3x', `${C.surface.quoteMonths} -> ${M.surface.quoteMonths}`);
    check(M.surface.months.every(x => x >= Math.min(...C.surface.months)), 'K2: no programme project is shortened', `${C.surface.months} -> ${M.surface.months}`);
  }
  const kinds = [...new Set([...Object.keys(C.ai), ...Object.keys(M.ai)])].sort();
  for (const k of kinds) {
    const a = C.ai[k] || { n: 0, months: 0 }, b = M.ai[k] || { n: 0, months: 0 };
    console.log(`  AI ${k.padEnd(26)} control ${String(a.n).padStart(5)} (mean ${(a.n ? a.months / a.n : 0).toFixed(1)} months)   modded ${String(b.n).padStart(5)} (mean ${(b.n ? b.months / b.n : 0).toFixed(1)} months)`);
  }
  console.log(`  countries short of power (deficit > 1%): control ${C.powerShort}, modded ${M.powerShort}`);
  if ((C.ai.plant?.n || 0) > 0) check((M.ai.plant?.n || 0) > 0, 'K2: AI governments still start power plants', `${C.ai.plant.n} / ${M.ai.plant?.n || 0}`);
}
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
