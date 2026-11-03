// C1 end to end, headless, through the real player verb (startCorporateInvestment, as the UI calls it: company id and
// cost). Playing Switzerland, then Russia, it orders an investment of 1% of revenue from every listed firm, twice.
// Expected with the mod: private firms never take a second expansion while one is funded (active_project);
// Russia's state-controlled firms still accept orders and are not limited. Profitability refusals (project_return)
// are reported, not asserted: every sector starts profitable at day 0, so that rule binds only later.
// Usage: node --max-old-space-size=6000 mods/geoplanetical-balance/tests/c1.headless.mjs [--control]
//   --control  the unmodified game: every order the mod refuses must be one the unmodified game accepts.
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
  gameplayRules: { aiNuclearFirstUse: false, newPandemicEmergence: 'off', naturalDisasters: 'normal', aiWarDeclarations: true, worldBellicosity: 'normal' },
  playerControl: { partyId: 'SVP' } };
let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
// The verb's result: true, or a refusal object with a reason (validator results pass through the domain call).
const order = async (companyId, costBn) => {
  const r = (await req('domain.call', { methodId: 'startCorporateInvestment', args: [companyId, costBn] })).result;
  const ok = r === true || (r && typeof r === 'object' && r.ok !== false);
  return { ok, reason: ok ? null : (r && typeof r === 'object' ? r.reason ?? JSON.stringify(r).slice(0, 80) : String(r)) };
};

// Orders every listed firm of the player country once, then again if accepted.
async function orderAll(key) {
  const fin = part(await req('save.snapshot'), 'finance');
  // Company rows (finance-companies-table-v1): [shape, id, publicNameId, nameDescriptor, headquartersCountryKey(4),
  // sectorId(5), kind(6), status(7), ownership(8), parentCompanyId, operatingShares, productiveGoodIds, assetRefs,
  // employmentM, employment0M, revenueBnY(15), ...]. Sector aggregates have status "residual" and cannot expand.
  const firms = fin.companies.rows.map(r => ({ id: r[1], hq: r[4], status: r[7], ownership: r[8], revenueBnY: Number(r[15]) || 0 }))
    .filter(f => f.hq === key && f.status === 'listed' && f.ownership);
  const results = [];
  for (const f of firms) {
    const cost = Math.max(0.05, f.revenueBnY * 0.01);
    const a = await order(f.id, cost);
    const b = a.ok ? await order(f.id, cost) : null;
    results.push({ id: f.id, controlled: f.ownership.controlled === true, first: a.ok, firstReason: a.reason, second: b?.ok ?? null, secondReason: b?.reason ?? null });
  }
  return results;
}

try {
  // Switzerland: 14 listed private firms, no state-controlled ones. Russia: several state-controlled listed firms.
  for (const [key, boot] of [['756', BOOT], ['643', { playerKey: '643', savePayload: null, seed: 12345, gameplayRules: BOOT.gameplayRules }]]) {
    await req('session.boot', boot);
    const results = await orderAll(key);
    const priv = results.filter(r => !r.controlled), state = results.filter(r => r.controlled);
    console.log(`  ${key}: private firms ${priv.length} (accepted ${priv.filter(r => r.first).length}), state-controlled ${state.length} (accepted ${state.filter(r => r.first).length}); refusals ${JSON.stringify([...new Set(results.map(r => r.firstReason).filter(Boolean))])}, project_return ${priv.filter(r => r.firstReason === 'project_return').length}`);
    check(results.length > 0, `${key}: found listed companies`, String(results.length));
    if (control) {
      check(priv.some(r => r.second === true), `${key} control: a second order to the same private firm is accepted (no concurrency limit)`);
    } else {
      check(priv.some(r => r.first), `${key}: private firms still accept a first order (the patch does not block them all)`);
      check(priv.every(r => r.second !== true) && priv.filter(r => r.second === false).every(r => r.secondReason === 'active_project'),
        `${key}: second orders to private firms refused for active_project`);
      if (key === '643') {
        check(state.length > 0 && state.some(r => r.first), '643: state-controlled firms still accept orders', `${state.filter(r => r.first).length} of ${state.length}`);
        check(state.filter(r => r.first).every(r => r.second === true), '643: state-controlled firms are not limited to one expansion at a time');
      }
    }
  }
} catch (e) {
  check(false, 'run', e.message);
}
await w.terminate();
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
