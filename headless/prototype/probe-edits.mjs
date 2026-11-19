// Targeted tests for patch edits a normal run never reaches (per-port protocol, research/headless-simulation.md).
// Boots the modded build with the edit counter (headless/coverage.mjs) and an eval hook inside the bundle's scope, then
// runs each probe from a probes file in that one booted world, in order, and reports which edits' counters moved
// during each probe and the probe's own checks. Test tooling only; never shipped.
//
// Probes file: an ES module exporting `probes = [{ id, edits: ['patch#n', ...], code }]`. `code` is evaluated in the
// bundle's scope as an async function body: game functions are callable by their minified names, `Ogr.sim` is the
// live world (the session host; it was `Jlr` on 26519199, and on 26734764 `Jlr` is a fiscal function), and `check(cond, label, detail)` records a result. It returns any JSON value as the probe's detail.
// Usage: node --max-old-space-size=6000 headless/prototype/probe-edits.mjs <probes.mjs> [--seed 12345] [--player 756]
//        [--days N]   (advance N days before the probes; default 0)
import { Worker } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';
import { MODS_DIR, workspaceBuild, bundlePath } from 'geoplanetical-modloader/patcher/build.mjs';
import { SIM } from 'geoplanetical-modloader/patcher/session.mjs';
import { instrumentedSim } from '../coverage.mjs';
import { moddedWorkerData } from './modded.mjs';

const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const { probes } = await import(pathToFileURL(resolve(argv[0])).href);
const build = workspaceBuild();
const { overrides } = moddedWorkerData(resolve('.modding', 'decompiled', `app-${build}`));
const cov = instrumentedSim(loadMods(MODS_DIR), build);
const HOOK_AT = '})();\n/*! Bundled license information';
if (cov.sourceText.split(HOOK_AT).length !== 2) throw new Error('eval hook point not found exactly once');
const sourceText = cov.sourceText.replace(HOOK_AT, ';globalThis.__geoEval=async __s=>{const __r=[];const check=(c,l,d)=>{__r.push({pass:!!c,label:l,detail:d});return !!c};' +
  'const value=await eval("(async()=>{"+__s+"\\n})()");return {value,checks:__r}};' + HOOK_AT);
const index = new Map(cov.points.map((p, i) => [p.id, i]));
for (const p of probes) for (const e of p.edits) if (!index.has(e)) throw new Error(`${p.id}: unknown edit ${e}`);

const w = new Worker(resolve('headless/prototype/bootstrap.mjs'),
  { workerData: { bundlePath: bundlePath(build, SIM), sourceText, overrides }, resourceLimits: { maxOldGenerationSizeMb: 12000 } });
let rid = 0, epoch = 0; const pending = new Map(), evals = new Map(); let hitsWaiter = null;
w.on('message', m => {
  if (m?.type === 'response') { const p = pending.get(m.requestId); pending.delete(m.requestId); epoch = m.sessionEpoch || epoch; m.ok ? p.res(m.payload) : p.rej(new Error(JSON.stringify(m.error).slice(0, 800))); }
  else if (m?.type === '__geobalHits') { hitsWaiter?.(m.hits); hitsWaiter = null; }
  else if (m?.type === 'geo-eval') { evals.get(m.id)?.(m); evals.delete(m.id); }
});
w.on('error', e => { console.error('worker error', e); process.exit(2); });
const req = (command, payload = {}) => new Promise((res, rej) => { const r = ++rid; pending.set(r, { res, rej }); w.postMessage({ protocolVersion: 2, type: 'request', requestId: r, sessionEpoch: epoch, command, payload }); });
const hits = () => new Promise(res => { hitsWaiter = res; w.postMessage({ type: '__geobalHits' }); });
const evalIn = code => new Promise(res => { const id = ++rid; evals.set(id, res); w.postMessage({ type: 'geo-eval', id, code }); });

await req('session.boot', { playerKey: opt('--player', '756'), savePayload: null, seed: Number(opt('--seed', '12345')),
  gameplayRules: { aiNuclearFirstUse: false, newPandemicEmergence: 'off', naturalDisasters: 'normal', aiWarDeclarations: true, worldBellicosity: 'normal' } });
const days = Number(opt('--days', '0'));
if (days) await req('clock.advanceDays', { days });
// The session host's name changes with every build: a wrong name must stop the run, not pass as an empty world.
const host = await evalIn('if (!Ogr || !Ogr.sim || !(Ogr.sim.countries?.size > 0)) throw new Error("session host Ogr.sim not found: update the host name for this build"); return JSON.stringify({ day: Ogr.sim.day, countries: Ogr.sim.countries.size })');
if (!host.ok) { console.error('boot check failed:', host.error); await w.terminate(); process.exit(2); }
console.log('booted', host.value);
let failed = 0;
for (const p of probes) {
  const before = await hits(), r = await evalIn(p.code), after = await hits();
  const fired = p.edits.map(e => `${e} ${after[index.get(e)] - before[index.get(e)] > 0 ? 'RAN' : 'not run'} (+${after[index.get(e)] - before[index.get(e)]})`);
  const other = cov.points.map((q, i) => [q.id, after[i] - before[i]]).filter(([id, n]) => n > 0 && !p.edits.includes(id)).map(([id, n]) => `${id} +${n}`);
  if (!r.ok) { failed++; console.log(`PROBE ${p.id}: ERROR ${r.error}`); continue; }
  let v;
  try { v = JSON.parse(r.value ?? 'null'); } catch { failed++; console.log(`PROBE ${p.id}: FAIL result not valid JSON (over 200000 characters, cut by bootstrap.mjs?); shorten its details`); continue; }
  const checks = v?.checks ?? [];
  const pass = checks.length > 0 && checks.every(c => c.pass) && p.edits.every(e => after[index.get(e)] > before[index.get(e)] || cov.points[index.get(e)].kind === 'none');
  if (!pass) failed++;
  console.log(`PROBE ${p.id}: ${pass ? 'PASS' : 'FAIL'} | ${fired.join('; ')}`);
  for (const c of checks) console.log(`  ${c.pass ? 'ok  ' : 'FAIL'} ${c.label}${c.detail === undefined ? '' : `: ${JSON.stringify(c.detail)?.slice(0, 300)}`}`);
  if (other.length) console.log(`  other edits that ran: ${other.slice(0, 12).join(', ')}${other.length > 12 ? ' ...' : ''}`);
  if (v?.value !== undefined) console.log(`  detail: ${JSON.stringify(v.value)?.slice(0, 600)}`);
}
console.log(failed ? `${failed} probe(s) failed` : 'all probes passed');
await w.terminate();
process.exit(failed ? 1 : 0);
