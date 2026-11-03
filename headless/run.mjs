// Headless modded-vs-unmodded run. Runs every mod in mods/ against the unmodified game from the same seed and the
// page's own new-game message, plus a null run (a 1e-12 nudge to the household plug) that measures how far countries
// drift through chaos alone. Unmodified and null series are cached in .cache/headless/ and reused; whatever is
// missing runs side by side. Compares month by month and stops early once world aggregates are clearly flat (pass)
// or clearly compounding (fail). Method: docs/headless-simulation.md.
//
// Usage: node --max-old-space-size=6000 headless/run.mjs [--months 12] [--seed 12345] [--country 756] [--party SVP]
//          [--min 4] [--pass 6] [--horizon 12] [--no-early-stop] [--no-null] [--fresh]
// Exit code: 0 pass, 1 fail (compounding, or a value turned non-finite), 2 run error, 3 review (between half the
// limit and the limit when the months ran out).
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { WORKSPACE as ROOT, workspaceBuild as pinnedBuild, bundlePath } from 'geoplanetical-modloader/patcher/build.mjs';
import { applyPatches } from 'geoplanetical-modloader/patcher/patch-engine.mjs';
import { SIM } from 'geoplanetical-modloader/patcher/session.mjs';
import { moddedWorkerData } from './prototype/modded.mjs';
import { measure } from './metrics.mjs';
import { aggregateGaps, earlyStop, finalVerdict, countryFlags } from './compare.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const flag = n => argv.includes(n);
const months = Number(arg('--months', '12'));
if (!(Number.isInteger(months) && months >= 1)) { console.error('--months must be a whole number of months, at least 1'); process.exit(2); }
const seed = Number(arg('--seed', '12345'));
const country = arg('--country', '756');
const party = arg('--party', 'SVP');
const stopOpts = { minMonths: Number(arg('--min', '4')), passMonths: Number(arg('--pass', '6')), horizon: Number(arg('--horizon', '12')) };
const DAYS_PER_MONTH = 31;
const t0 = performance.now();
const log = msg => console.log(`[${((performance.now() - t0) / 1000).toFixed(0).padStart(4)}s] ${msg}`);
const sha = text => createHash('sha256').update(text).digest('hex');
// A run error exits 2, never 1 (which means a FAIL verdict); after the verdict, errors only cost the cache fill.
let verdictCode = null;
const runError = e => {
  if (verdictCode !== null) { log(`cache fill stopped (${e?.message || e}); the verdict above stands`); process.exit(verdictCode); }
  console.error(`run error: ${e?.stack || e}`); process.exit(2);
};
process.on('uncaughtException', runError);
process.on('unhandledRejection', runError);
// Measurements depend on the engine and on this tool's own code too, so both are part of every cache key.
const TOOLS = sha([process.versions.node, process.versions.v8,
  ...['./prototype/bootstrap.mjs', './metrics.mjs'].map(f => readFileSync(new URL(f, import.meta.url), 'utf8'))].join('\n'));

// The page's new-game message (recorded in game, docs/headless-simulation.md), minus view subscriptions.
const BOOT = { playerKey: country, savePayload: null, seed,
  gameplayRules: { aiNuclearFirstUse: false, newPandemicEmergence: 'off', naturalDisasters: 'normal', aiWarDeclarations: true, worldBellicosity: 'normal' },
  playerControl: { partyId: party } };

const build = pinnedBuild();
const appDir = join(ROOT, '.modding', 'decompiled', `app-${build}`);
const original = readFileSync(bundlePath(build, SIM), 'utf8');
const modded = moddedWorkerData(appDir);
const NULL_PATCH = { id: 'chaos-floor-null', bundle: SIM, builds: [build], edits: [{ anchor: 'household-income:baseline:',
  find: 'return Math.max(0,Q*g-r)}', replace: 'return Math.max(0,Q*g-r)*(1+1e-12)}' }] };
const variants = {
  base: { sourceText: undefined, overrides: {}, hash: sha(original) },
  mod: { sourceText: modded.sourceText, overrides: modded.overrides, hash: sha(modded.sourceText + JSON.stringify(Object.keys(modded.overrides))) },
};
if (!flag('--no-null')) {
  const text = applyPatches(original, [NULL_PATCH], { build, bundle: SIM }).text;
  variants.null = { sourceText: text, overrides: {}, hash: sha(text) };
}
const cacheDir = join(ROOT, '.cache', 'headless');
mkdirSync(cacheDir, { recursive: true });
for (const [name, v] of Object.entries(variants)) {
  v.file = join(cacheDir, `${name}-${sha(JSON.stringify({ build, hash: v.hash, BOOT, DAYS_PER_MONTH, TOOLS })).slice(0, 16)}.jsonl`);
  v.rows = [];
  v.waiters = [];
  if (name !== 'mod' && !flag('--fresh') && existsSync(v.file)) {
    v.rows = readFileSync(v.file, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
    // Used only when complete and in order (month 0, 1, 2, ...).
    v.cached = v.rows.length >= months + 1 && v.rows.every((r, i) => r.month === i);
    if (!v.cached) v.rows = [];
  }
}

function startRun(name, v) {
  // Rows go to this process's own file, renamed into place once complete, so concurrent runs never interleave
  // rows in the shared cache file.
  v.partial = `${v.file}.${process.pid}.partial`;
  writeFileSync(v.partial, '');
  const w = new Worker(fileURLToPath(new URL('./prototype/bootstrap.mjs', import.meta.url)),
    { workerData: { bundlePath: bundlePath(build, SIM), sourceText: v.sourceText, overrides: v.overrides }, resourceLimits: { maxOldGenerationSizeMb: 12000 } });
  let id = 0, epoch = 0; const pending = new Map();
  w.on('message', m => { if (m?.type === 'response') { const p = pending.get(m.requestId); pending.delete(m.requestId); epoch = m.sessionEpoch || epoch; m.ok ? p.res(m.payload) : p.rej(new Error(JSON.stringify(m.error).slice(0, 800))); } });
  w.on('error', e => runError(new Error(`${name} worker: ${e.message}`)));
  // A worker that exits with requests pending (the simulation called close(), or it died) is a run error, not a hang.
  w.on('exit', code => { if (pending.size && !v.stop) runError(new Error(`${name} worker exited (code ${code}) with ${pending.size} request(s) pending`)); });
  const req = (command, payload = {}) => new Promise((res, rej) => { const r = ++id; pending.set(r, { res, rej }); w.postMessage({ protocolVersion: 2, type: 'request', requestId: r, sessionEpoch: epoch, command, payload }); });
  const push = row => { v.rows.push(row); appendFileSync(v.partial, JSON.stringify(row) + '\n'); for (const f of v.waiters.splice(0)) f(); };
  v.worker = w;
  v.done = (async () => {
    await req('session.boot', BOOT);
    push({ month: 0, ...measure(await req('save.snapshot')) });
    for (let m = 1; m <= months && !v.stop; m++) {
      await req('clock.advanceDays', { days: DAYS_PER_MONTH });
      push({ month: m, ...measure(await req('save.snapshot')) });
    }
    await w.terminate();
    finishCache(v);
  })().catch(e => runError(new Error(`${name}: ${e.message}`)));
}

// A complete series becomes the cache; anything else is removed. A failed rename only costs the cache.
function finishCache(v) {
  if (!v.partial) return;
  try {
    if (v.rows.length >= months + 1 && v.rows.every((r, i) => r.month === i)) renameSync(v.partial, v.file);
    else rmSync(v.partial, { force: true });
  } catch (e) {
    log(`cache not saved (${e.message})`);
    try { rmSync(v.partial, { force: true }); } catch { /* left for the next run to overwrite */ }
  }
  v.partial = null;
}
process.on('exit', () => { for (const v of Object.values(variants)) if (v.partial) try { rmSync(v.partial, { force: true }); } catch { /* best effort */ } });

const rowAt = (v, m) => (v.rows.length > m ? Promise.resolve(v.rows[m]) : new Promise(r => v.waiters.push(r)).then(() => rowAt(v, m)));

log(`build ${build}; mods ${modded.loaded.map(m => `${m.id} ${m.version}`).join(', ')}; seed ${seed}, country ${country}; up to ${months} months`);
for (const [name, v] of Object.entries(variants)) {
  if (v.cached) log(`${name}: from cache (${v.rows.length - 1} months)`);
  else { log(`${name}: running`); startRun(name, v); }
}

const history = [];
let decision = { verdict: 'continue' };
console.log('month  ' + ['plug', 'deposits', 'cbReserves', 'gdp'].map(s => `${s} gap%`.padStart(16)).join(''));
for (let m = 1; m <= months; m++) {
  const [b, d] = await Promise.all([rowAt(variants.base, m), rowAt(variants.mod, m)]);
  const gaps = aggregateGaps(b, d);
  history.push({ month: m, gaps });
  console.log(String(m).padStart(5) + '  ' + gaps.map(g => g.gapPct.toFixed(3).padStart(16)).join(''));
  decision = earlyStop(history, stopOpts);
  if (decision.verdict !== 'continue' && !flag('--no-early-stop')) break;
}
// Ran out of months without an early verdict: the same persistence rule fails, under half passes, else review.
if (decision.verdict === 'continue') decision = finalVerdict(history, stopOpts);
const last = history[history.length - 1].month;
variants.mod.stop = true;

const nul = variants.null ? await rowAt(variants.null, last) : null;
const { flags, broken } = countryFlags(variants.base.rows[last], variants.mod.rows[last], nul);
console.log(`\nverdict: ${decision.verdict.toUpperCase()} at month ${last}${decision.reason ? ` (${decision.reason})` : ''}`);
for (const p of decision.projected) console.log(`  ${p.label.padEnd(24)} now ${Number(p.now).toFixed(3)}%  projected to month ${stopOpts.horizon}: ${Number(p.projected).toFixed(3)}% (limit ${p.limit}%)`);
console.log(`country gaps above the chaos floor${nul ? '' : ' (no null run: absolute minimums only)'}: ${flags.length}`);
for (const x of flags.slice(0, 12)) console.log(`  ${x.country.padEnd(5)} ${x.metric.padEnd(13)} ${x.gap.toFixed(3)} ${x.unit}  (chaos floor ${x.chaosFloor.toFixed(3)})`);
if (broken.length) {
  console.log(`!!! ${broken.length} series turned non-finite on one side only:`);
  for (const x of broken.slice(0, 12)) console.log(`  ${x.country} ${x.metric}: base ${x.base} modded ${x.modded}`);
}
console.log('not exercised: player actions (the run only advances days); a fix on a player-action path needs its own end-to-end test');
if (flags.length) console.log('REVIEW the country flags above: the chaos floor is one null sample per country, so it is a guide, not a test');
const code = decision.verdict === 'fail' || broken.length ? 1 : decision.verdict === 'review' ? 3 : 0;
verdictCode = code;
await variants.mod.worker?.terminate().catch(() => {});
const filling = ['base', 'null'].filter(n => variants[n]?.done && !variants[n].cached);
if (filling.length) {
  log(`finishing the ${filling.join(' and ')} cache to ${months} months for later runs (the verdict above is final; Ctrl+C is safe)`);
  await Promise.all(filling.map(n => variants[n].done));
}
process.exit(code);
