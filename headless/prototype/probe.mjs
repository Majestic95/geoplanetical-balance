// H2/H3 experiment. Variants patch the household plug ($_g, anchor `household-income:baseline:`):
//   base     unmodified
//   plugoff  plug = 0               (step 1: where does the plug's money come from?)
//   d        plug = Q*g, no netting (step 2: H2 option D, rate changes pass through)
//   mod      every mod in mods/, built by the mod loader's own build (geoplanetical-modloader/patcher/build.mjs)
// Boots the page's exact new-game message (seed 12345, Switzerland), advances month by month and writes one JSON
// line per month: money account totals by type, household plug/financial-income totals, and per-country figures.
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';
const [,, appDir, variant = 'base', months = '1'] = process.argv;
const { applyPatches } = await import('geoplanetical-modloader/patcher/patch-engine.mjs');
const bundlePath = `${appDir}/renderer/simulation-worker.bundle.js`;
const FIND = '?Math.max(0,C-w*g):0;return Math.max(0,Q*g-r)}';
const REPLACE = { plugoff: '?Math.max(0,C-w*g):0;return 0}', d: '?Math.max(0,C-w*g):0;return Math.max(0,Q*g)}' };
let sourceText, overrides = {}, mods = [];
if (variant === 'mod') {
  ({ sourceText, overrides, loaded: mods } = (await import('./modded.mjs')).moddedWorkerData(appDir));
} else if (variant !== 'base') {
  const patch = { id: `probe-${variant}`, bundle: 'simulation-worker.bundle.js', builds: ['probe'],
    edits: [{ anchor: 'household-income:baseline:', find: FIND, replace: REPLACE[variant] }] };
  sourceText = applyPatches(readFileSync(bundlePath, 'utf8'), [patch], { build: 'probe', bundle: patch.bundle }).text;
}
const out = `probe-${variant}.jsonl`; writeFileSync(out, '');
const w = new Worker(fileURLToPath(new URL('./bootstrap.mjs', import.meta.url)), { workerData: { bundlePath, sourceText, overrides }, resourceLimits: { maxOldGenerationSizeMb: 12000 } });
let id = 0, epoch = 0; const pending = new Map();
w.on('message', m => { if (m?.type === 'response') { const p = pending.get(m.requestId); pending.delete(m.requestId); epoch = m.sessionEpoch || epoch; m.ok ? p.res(m.payload) : p.rej(new Error(JSON.stringify(m.error).slice(0, 800))); } });
w.on('error', e => { console.error(variant, 'WORKER ERROR', e.stack || e); process.exit(2); });
const req = (command, payload = {}) => new Promise((res, rej) => { const r = ++id; pending.set(r, { res, rej }); w.postMessage({ protocolVersion: 2, type: 'request', requestId: r, sessionEpoch: epoch, command, payload }); });
const DECODE = { gzip: zlib.gunzipSync, deflate: zlib.inflateSync, zstd: zlib.zstdDecompressSync };
const part = (snap, pid) => { const p = snap.artifact.parts.find(x => x.id === pid); const b = p.source === 'raw' ? new Uint8Array(p.bytes) : DECODE[p.compression](new Uint8Array(p.bytes)); return JSON.parse(new TextDecoder().decode(b)); };
async function measure(day) {
  const snap = await req('save.snapshot');
  const f = part(snap, 'finance'), c = part(snap, 'countries');
  const money = {};
  for (const r of f.accounts.rows) { const t = r[0].split(':')[0]; if (/deposit|reserve|backing|currency|bank-loans|bank-funding|bank-equity|cb-liquidity|liquidity-assets|sovereign/.test(t)) money[t] = (money[t] || 0) + (Number(r[7]) || 0); }
  const byCountry = {};
  for (const h of Object.values(f.households)) {
    const k = h.countryKey; const e = byCountry[k] || (byCountry[k] = { plugBn: 0, finIncBnY: 0, finInc0BnY: 0, plugAnnualBn: 0 });
    e.plugBn += h.operatingIncome?.unrepresentedIncomeBn || 0; e.finIncBnY += h.annualFinancialIncomeBn || 0;
    e.finInc0BnY += Number.isFinite(h.ledgerNetFinancialIncome0BnY) ? h.ledgerNetFinancialIncome0BnY : 0; e.plugAnnualBn += h.unrepresentedIncomeAnnualBn || 0;
  }
  const dep = {}; for (const r of f.accounts.rows) if (r[0].startsWith('hh-deposits:')) dep[r[3]] = (dep[r[3]] || 0) + (Number(r[7]) || 0);
  for (const [k, x] of Object.entries(c)) { const e = byCountry[k] || (byCountry[k] = {}); Object.assign(e, { gdp: x.gdpNom, growth: x.growth, inflation: x.inflation, unemployment: x.unemployment, approval: x.approval, hhDepositsBn: dep[k] || 0 }); }
  appendFileSync(out, JSON.stringify({ variant, mods, day, money, byCountry }) + '\n');
  const ch = byCountry['756'];
  console.log(variant, 'day', day, 'CH gdp', ch.gdp?.toFixed(2), 'plug', ch.plugBn?.toFixed(3), 'finInc', ch.finIncBnY?.toFixed(2), 'deposits', ch.hhDepositsBn?.toFixed(1));
}
await req('session.boot', { playerKey: '756', savePayload: null, seed: 12345,
  gameplayRules: { aiNuclearFirstUse: false, newPandemicEmergence: 'off', naturalDisasters: 'normal', aiWarDeclarations: true, worldBellicosity: 'normal' },
  playerControl: { partyId: 'SVP' } });
await measure(0);
let day = 0;
for (let m = 0; m < Number(months); m++) { const a = await req('clock.advanceDays', { days: 31 }); day = a.status?.day; await measure(day); }
await w.terminate(); process.exit(0);
