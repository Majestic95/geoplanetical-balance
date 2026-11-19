// X7 function test: the monthly contract expiry pass (in p2Q) hands an expired concession's site back to its previous
// operator (or its legal owner), as the fulfilled and cancelled paths do; other contract kinds are unchanged. The
// expiry loop is sliced from the patched and unmodded bundles; Y2Q, n5, yJA, Eo and L2Q are stubbed.
// Usage: node mods/geoplanetical-balance/tests/x7.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

const HEAD = 'for(let a of e.space?.contracts?.values?.()||[]){if(a.status!=="active"||a.deadlineDay>=(e.day||0)';
const loop = (text, events) => {
  const s = text.indexOf(HEAD);
  if (s < 0 || text.indexOf(HEAD, s + 1) >= 0) throw new Error('expiry loop: not found once');
  let depth = 0, i = text.indexOf('{', s);
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  const body = text.slice(s, i + 1);
  if (!body.includes('"space.contract.expired"')) throw new Error('expiry loop: wrong slice');
  return new Function('dSa', 'xP', 'BVe', 'hu', 'Bm', 'pSa', `return e=>{let t=!1;${body};return t}`)(
    () => false, () => true, () => 0, () => {}, 1e-9, (A, Q, kind) => events.push([Q.id, kind]));
};
const world = contracts => ({
  day: 400,
  space: { contracts: new Map(contracts.map(c => [c.id, { status: 'active', deliveredQuantity: 0, ...c }])),
    sites: new Map([['s1', { id: 's1', operatorId: 'opC', legalOwnerOperatorId: 'opL' }], ['s2', { id: 's2', operatorId: 'opC', legalOwnerOperatorId: 'opL' }]]) },
});
const run = (text, contracts) => { const events = [], A = world(contracts), changed = loop(text, events)(A); return { A, events, changed }; };

{
  const C = [{ id: 'c1', kind: 'concession', concessionSiteId: 's1', previousOperatorId: 'opP', deadlineDay: 399 }];
  const p = run(patched, C), v = run(original, C);
  check(v.A.space.sites.get('s1').operatorId === 'opC', 'unmodded: the expired concessionaire keeps the site');
  check(p.A.space.sites.get('s1').operatorId === 'opP', 'patched: the site goes back to the previous operator', p.A.space.sites.get('s1').operatorId);
  check(p.A.space.contracts.get('c1').status === 'failed' && p.A.space.contracts.get('c1').closedDay === 400, 'contract closed as failed on the day, as before');
  check(JSON.stringify(p.events) === JSON.stringify(v.events) && p.changed === true, 'same expiry event');
}
{
  const C = [{ id: 'c1', kind: 'concession', concessionSiteId: 's1', previousOperatorId: null, deadlineDay: 399, deliveredQuantity: 3 }];
  const p = run(patched, C);
  check(p.A.space.sites.get('s1').operatorId === 'opL', 'no previous operator: the site goes to its legal owner');
  check(p.A.space.contracts.get('c1').status === 'partially_failed', 'partly delivered: partially_failed, as before');
}
{
  const C = [{ id: 'c1', kind: 'concession', concessionSiteId: 'gone', previousOperatorId: 'opP', deadlineDay: 399 },
    { id: 'c2', kind: 'goods', concessionSiteId: 's2', previousOperatorId: 'opP', deadlineDay: 399 },
    { id: 'c3', kind: 'concession', concessionSiteId: 's1', previousOperatorId: 'opP', deadlineDay: 400 }];
  const p = run(patched, C), v = run(original, C);
  check(p.A.space.sites.get('s2').operatorId === 'opC', 'another contract kind naming a site: site untouched');
  check(p.A.space.sites.get('s1').operatorId === 'opC' && p.A.space.contracts.get('c3').status === 'active', 'concession not yet past its deadline: untouched');
  check(JSON.stringify([...p.A.space.contracts.values()]) === JSON.stringify([...v.A.space.contracts.values()]), 'missing site: no error, contracts identical to the unmodded game');
}

console.log(failures ? `${failures} of ${checks} checks FAILED` : `${checks}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
