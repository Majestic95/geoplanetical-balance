// K4 on the real engine, headless: the adviser's quote (view economy.productiveInvestment with a quote -> ROQ -> Tl -> IoB,
// F_g, the call the industrial-investment screen makes) at day 0, unmodified game vs the K4 patch alone, same seed.
// As North Korea (408), the country with the largest day-0 shortages: for every good with more than 2% of demand
// unmet, and for goods with none, the quote under the import-substitution and strategic-security objectives.
//   - no unmet demand: the quote is identical (the patch only adds the shortage signal and the unmet field);
//   - unmet demand: domestic need is (delivered + unmet - production) / (delivered + unmet) from the saved market
//     arrays, the shortage signal is unmet / demand, and above 2% the import-substitution verdict is no longer
//     already_net_exporter, imports_already_low or imports_limited.
// Usage: node --max-old-space-size=6000 mods/geoplanetical-balance/tests/k4.headless.mjs
import { Worker } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseExpressionAt } from 'acorn';
import { MODS_DIR, workspaceBuild as pinnedBuild, bundlePath } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';
import { buildBundle } from 'geoplanetical-modloader/patcher/patch-engine.mjs';
import { SIM } from 'geoplanetical-modloader/patcher/session.mjs';
import { part } from '../../../headless/metrics.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, SIM), 'utf8');
const k4Only = () => {
  const mods = loadMods(MODS_DIR, { only: ['geoplanetical-balance'] }).map(m => ({ ...m, patches: m.patches.filter(p => p.id === 'k4-adviser-unmet-demand') }));
  if (mods[0]?.patches.length !== 1) throw new Error('K4 patch not found');
  return buildBundle(original, mods, { build, bundle: SIM }).text;
};
// Good ids in market-array order (the goods table the simulation indexes its we.* arrays by).
const goodIds = (() => {
  const at = original.indexOf('goods:[{id:') + 'goods:'.length;
  return parseExpressionAt(original, at, { ecmaVersion: 'latest' }).elements.map(e => e.properties.find(p => p.key.name === 'id').value.value);
})();
const P = '408', OBJECTIVES = ['import_substitution', 'strategic_security'];
const BOOT = { playerKey: P, savePayload: null, seed: 12345,
  gameplayRules: { aiNuclearFirstUse: false, newPandemicEmergence: 'off', naturalDisasters: 'normal', aiWarDeclarations: true, worldBellicosity: 'normal' } };

async function session(sourceText, body) {
  const w = new Worker(fileURLToPath(new URL('../../../headless/prototype/bootstrap.mjs', import.meta.url)),
    { workerData: { bundlePath: bundlePath(build, SIM), sourceText, overrides: {} }, resourceLimits: { maxOldGenerationSizeMb: 12000 } });
  let id = 0, epoch = 0; const pending = new Map();
  w.on('message', m => { if (m?.type === 'response') { const p = pending.get(m.requestId); pending.delete(m.requestId); epoch = m.sessionEpoch || epoch; m.ok ? p.res(m.payload) : p.rej(new Error(JSON.stringify(m.error).slice(0, 800))); } });
  w.on('error', e => { console.error('WORKER ERROR', e.stack || e); process.exit(2); });
  const req = (command, payload = {}) => new Promise((res, rej) => { const r = ++id; pending.set(r, { res, rej }); w.postMessage({ protocolVersion: 2, type: 'request', requestId: r, sessionEpoch: epoch, command, payload }); });
  try { await req('session.boot', BOOT); return await body(req); } finally { await w.terminate(); }
}
const vec = v => (Array.isArray(v) ? v : v && Array.isArray(v.d) ? v.d : []);
const quotes = async (req, goods) => {
  const out = {};
  for (const g of goods) for (const objectiveId of OBJECTIVES) {
    const v = await req('view.snapshot', { viewId: 'economy.productiveInvestment',
      params: { countryKey: P, quote: true, targetType: 'good', targetId: g, goodId: g, objectiveId, envelopeBn: 2, horizonMonths: 60 } });
    out[`${g}/${objectiveId}`] = v.quote;
  }
  return out;
};
const market = async req => {
  const we = part(await req('save.snapshot'), 'countries')[P].we;
  const [cons, unmet, prod, imp, exp] = ['cons', 'unmet', 'prod', 'imp', 'exp'].map(k => vec(we[k]).map(Number));
  return { cons, unmet, prod, imp, exp };
};

let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const canon = x => (x && typeof x === 'object' ? (Array.isArray(x) ? x.map(canon) : Object.fromEntries(Object.keys(x).sort().map(k => [k, canon(x[k])]))) : x);
// The quote without the patch's additions (signals.shortage, candidate.unmet), for the no-shortage comparison.
const strip = q => JSON.parse(JSON.stringify(q), (k, v) => (k === 'shortage' || k === 'unmet' ? undefined : v));

const m0 = await session(original, async req => {
  const m = await market(req);
  if (m.cons.length !== goodIds.length) throw new Error(`goods table ${goodIds.length} vs market arrays ${m.cons.length}`);
  const share = m.cons.map((c, i) => (c + m.unmet[i] > 1e-9 ? m.unmet[i] / (c + m.unmet[i]) : null));
  const short = goodIds.filter((g, i) => share[i] > 0.02);
  const none = goodIds.filter((g, i) => share[i] === 0 && m.cons[i] > 0).slice(0, 8);
  console.log(`  ${P} day 0: ${short.length} goods with more than 2% unmet (${short.map(g => `${g} ${(share[goodIds.indexOf(g)] * 100).toFixed(0)}%`).join(', ')}); comparing ${none.length} goods with none`);
  return { m, short, none, q: await quotes(req, [...short, ...none]) };
});
const m1 = await session(k4Only(), async req => ({ m: await market(req), q: await quotes(req, [...m0.short, ...m0.none]) }));

check(JSON.stringify(m0.m) === JSON.stringify(m1.m), 'day-0 market arrays identical (the patch changes no state)');
check(m0.short.length > 0, 'the test country has shortages to test');
for (const g of m0.none) for (const o of OBJECTIVES) {
  const k = `${g}/${o}`;
  check(JSON.stringify(canon(strip(m1.q[k]))) === JSON.stringify(canon(m0.q[k])), `${k}: no unmet demand, quote identical`);
}
let changed = 0;
for (const g of m0.short) {
  const i = goodIds.indexOf(g), d = m0.m.cons[i] + m0.m.unmet[i];
  const need = Math.max(0, Math.min(1, (d - m0.m.prod[i]) / d)), short = m0.m.unmet[i] / d;
  for (const o of OBJECTIVES) {
    const k = `${g}/${o}`, a = m1.q[k], b = m0.q[k];
    const ca = a?.candidates?.find(c => c.goodId === g), cb = b?.candidates?.find(c => c.goodId === g);
    if (!ca || !cb) { check(!ca && !cb && a?.ok === b?.ok, `${k}: no candidate in either run (${a?.reason}/${b?.reason})`); continue; }
    check(Math.abs(ca.signals.domesticNeed - need) < 1e-9 && Math.abs(ca.signals.shortage - short) < 1e-9 && ca.unmet === m0.m.unmet[i],
      `${k}: domestic need ${cb.signals.domesticNeed.toFixed(3)} -> ${ca.signals.domesticNeed.toFixed(3)}, shortage ${(short * 100).toFixed(1)}%`);
    check(ca.signals.importDependence === cb.signals.importDependence && ca.consumption === cb.consumption, `${k}: import dependence and consumption unchanged`);
    const va = a.advice, vb = b.advice;
    if (o === 'import_substitution' && a.selectedCandidate?.goodId === g)
      check(!['already_net_exporter', 'imports_already_low', 'imports_limited'].includes(va.issueId), `${k}: verdict ${vb.verdictId}/${vb.issueId} -> ${va.verdictId}/${va.issueId}`);
    if (o !== 'import_substitution') check(va.issueId === vb.issueId || a.selectedCandidate?.goodId !== b.selectedCandidate?.goodId, `${k}: ${o} verdict issue unchanged (${vb.issueId} -> ${va.issueId})`);
    if (JSON.stringify(va) !== JSON.stringify(vb)) changed++;
  }
}
console.log(`  verdicts changed: ${changed} of ${m0.short.length * OBJECTIVES.length} shortage quotes`);
console.log(failures ? `K4 headless: ${failures} FAILED` : 'K4 headless: all checks pass');
process.exit(failures ? 1 : 0);
