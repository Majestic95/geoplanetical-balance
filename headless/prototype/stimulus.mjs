// Stimulus tests for the AI decision audit: does an AI country respond to a change in its situation the way a
// self-interested government would? Each test runs in two worlds booted from the same seed and new-game message: a
// control world and a treated world. Both run the test's `pick` code (choose the subject countries, deterministically)
// after `preDays`; only the treated world then runs `perturb`; both advance `days` with the session's own clock and
// run `measure`; the test's `check(control, treated, picked, applied)` function (in Node) returns the checks. Control
// worlds are shared by every test with the same preDays and days. Test tooling only; never shipped.
//
// Tests file: an ES module exporting `tests = [{ id, preDays = 0, days, pick, perturb, measure, check }]`. `pick`,
// `perturb` and `measure` are async function bodies evaluated in the simulation bundle's scope (game functions by
// their minified names; `Ogr.sim` is the world; `P` is what `pick` returned). They must return JSON values.
// Usage: node --max-old-space-size=6000 headless/prototype/stimulus.mjs <tests.mjs> [--unmodded] [--jobs 2]
//          [--only id,id] [--seed 12345] [--player 756]
import { Worker } from 'node:worker_threads';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { workspaceBuild, bundlePath } from 'geoplanetical-modloader/patcher/build.mjs';
import { SIM } from 'geoplanetical-modloader/patcher/session.mjs';
import { moddedWorkerData } from './modded.mjs';

const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const { tests: all } = await import(pathToFileURL(resolve(argv[0])).href);
const only = opt('--only', null)?.split(',');
const tests = only ? all.filter(t => only.includes(t.id)) : all;
const unmodded = argv.includes('--unmodded'), jobs = Math.max(1, Number(opt('--jobs', '2')));
const build = workspaceBuild(), bundle = bundlePath(build, SIM);
let sourceText, overrides = {};
if (unmodded) sourceText = readFileSync(bundle, 'utf8');
else ({ sourceText, overrides } = moddedWorkerData(resolve('.modding', 'decompiled', `app-${build}`)));
const HOOK_AT = '})();\n/*! Bundled license information';
if (sourceText.split(HOOK_AT).length !== 2) { console.error('eval hook point not found exactly once'); process.exit(2); }
sourceText = sourceText.replace(HOOK_AT, ';globalThis.__geoEval=async __s=>{const __r=[];const check=(c,l,d)=>{__r.push({pass:!!c,label:l,detail:d});return !!c};' +
  'const value=await eval("(async()=>{"+__s+"\\n})()");return {value,checks:__r}};' + HOOK_AT);
const BOOT = fileURLToPath(new URL('./bootstrap.mjs', import.meta.url));

// One booted world: request/response to the session, and eval in the bundle's scope.
async function world(label) {
  const w = new Worker(BOOT, { workerData: { bundlePath: bundle, sourceText, overrides }, resourceLimits: { maxOldGenerationSizeMb: 12000 } });
  let rid = 0, epoch = 0; const pending = new Map(), evals = new Map();
  w.on('message', m => {
    if (m?.type === 'response') { const p = pending.get(m.requestId); pending.delete(m.requestId); epoch = m.sessionEpoch || epoch; m.ok ? p.res(m.payload) : p.rej(new Error(JSON.stringify(m.error).slice(0, 800))); }
    else if (m?.type === 'geo-eval') { evals.get(m.id)?.(m); evals.delete(m.id); }
  });
  w.on('error', e => { console.error(label, 'worker error', e); process.exit(2); });
  const req = (command, payload = {}) => new Promise((res, rej) => { const r = ++rid; pending.set(r, { res, rej }); w.postMessage({ protocolVersion: 2, type: 'request', requestId: r, sessionEpoch: epoch, command, payload }); });
  const run = async (code, P) => {
    const r = await new Promise(res => { const id = ++rid; evals.set(id, res); w.postMessage({ type: 'geo-eval', id, code: `const P=${JSON.stringify(P ?? null)};\n${code}` }); });
    if (!r.ok) throw new Error(`${label}: ${r.error}`);
    return JSON.parse(r.value ?? 'null')?.value;
  };
  await req('session.boot', { playerKey: opt('--player', '756'), savePayload: null, seed: Number(opt('--seed', '12345')),
    gameplayRules: { aiNuclearFirstUse: false, newPandemicEmergence: 'off', naturalDisasters: 'normal', aiWarDeclarations: true, worldBellicosity: 'normal' } });
  const ok = await run('return !!(Ogr && Ogr.sim && Ogr.sim.countries?.size > 0)');
  if (!ok) throw new Error('session host Ogr.sim not found: update the host name for this build');
  return { advance: async d => { if (d > 0) await req('clock.advanceDays', { days: d }); }, run, end: () => w.terminate() };
}

const t0 = Date.now(), T = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;
console.log(`stimulus: build ${build}, ${unmodded ? 'unmodded' : 'modded'}, ${tests.length} test(s), jobs ${jobs}`);
// Control worlds, one per (preDays, days) group: pick for every test of the group, advance, measure.
const groups = new Map();
for (const t of tests) { const k = `${t.preDays || 0}|${t.days}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); }
const control = new Map(), picked = new Map(), errors = new Map();
async function runControl([k, ts]) {
  const [pre, days] = k.split('|').map(Number);
  const w = await world(`control ${k}`);
  try {
    await w.advance(pre);
    for (const t of ts) { try { picked.set(t.id, await w.run(t.pick)); } catch (e) { errors.set(t.id, `pick: ${e.message}`); } }
    await w.advance(days);
    for (const t of ts) if (!errors.has(t.id)) { try { control.set(t.id, await w.run(t.measure, picked.get(t.id))); } catch (e) { errors.set(t.id, `control measure: ${e.message}`); } }
  } finally { w.end(); }
  console.log(`[${T()}] control ${k} done (${ts.map(t => t.id).join(', ')})`);
}
async function runTreated(t) {
  if (errors.has(t.id)) return null;
  const w = await world(`treated ${t.id}`);
  try {
    await w.advance(t.preDays || 0);
    const P = await w.run(t.pick);
    if (JSON.stringify(P) !== JSON.stringify(picked.get(t.id))) throw new Error(`pick differs between worlds: ${JSON.stringify(P)} vs ${JSON.stringify(picked.get(t.id))}`);
    const applied = await w.run(t.perturb, P);
    await w.advance(t.days);
    return { applied, measure: await w.run(t.measure, P) };
  } finally { w.end(); }
}
const pool = async (items, fn) => { const q = [...items]; await Promise.all(Array.from({ length: Math.min(jobs, q.length) }, async () => { while (q.length) await fn(q.shift()); })); };
await pool([...groups], runControl);
const treated = new Map();
await pool(tests, async t => { try { treated.set(t.id, await runTreated(t)); } catch (e) { errors.set(t.id, `treated: ${e.message}`); } console.log(`[${T()}] treated ${t.id} done`); });

let failed = 0;
for (const t of tests) {
  if (errors.has(t.id)) { failed++; console.log(`TEST ${t.id}: ERROR ${errors.get(t.id)}`); continue; }
  const c = control.get(t.id), tr = treated.get(t.id);
  let checks;
  try { checks = t.check(c, tr.measure, picked.get(t.id), tr.applied); } catch (e) { failed++; console.log(`TEST ${t.id}: ERROR in check: ${e.message}`); continue; }
  const pass = checks.length > 0 && checks.every(x => x.pass);
  if (!pass) failed++;
  console.log(`TEST ${t.id}: ${pass ? 'AS EXPECTED' : 'NOT AS EXPECTED'}`);
  for (const x of checks) console.log(`  ${x.pass ? 'ok  ' : 'MISS'} ${x.label}${x.detail === undefined ? '' : `: ${JSON.stringify(x.detail)?.slice(0, 400)}`}`);
  console.log(`  picked ${JSON.stringify(picked.get(t.id))?.slice(0, 200)} | applied ${JSON.stringify(tr.applied)?.slice(0, 200)}`);
  console.log(`  control ${JSON.stringify(c)?.slice(0, 500)}`);
  console.log(`  treated ${JSON.stringify(tr.measure)?.slice(0, 500)}`);
}
console.log(`[${T()}] ${failed ? `${failed} test(s) not as expected or errored` : 'all tests as expected'}`);
process.exit(failed ? 1 : 0);
