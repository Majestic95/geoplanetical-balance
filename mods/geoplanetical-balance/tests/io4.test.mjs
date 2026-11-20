// IO4 function test: (1) a trade dispute's consultations end 60 days after the clause takes effect (CVt), not 30;
// (2) the AI retaliation step (SGo) skips a due dispute when the complainant is small next to the respondent (GDP under
// 5%) and depends on it (25% or more of its exports), and still retaliates otherwise. CVt, SGo and the patch's helper
// are taken from both bundles; party membership (Xe), trade flows (nr), events and the clause builder are stubbed.
// Usage: node mods/geoplanetical-balance/tests/io4.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };
const fnSrc = (text, name) => {
  const s = text.indexOf(`function ${name}(`);
  if (s < 0 || text.indexOf(`function ${name}(`, s + 1) >= 0) throw new Error(`${name}: not found once`);
  let depth = 0, i = text.indexOf('){', s) + 1;
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(s, i + 1);
};
const K = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const Xe = (e, p) => (e.blocs?.[p] || [p]);

// (1) consultation length
const loadCVt = (text) => new Function('yEr', 'K', 'Xe', 'H', 'AN', `${fnSrc(text, 'CVt')};return CVt;`)(() => [], K, Xe, () => {}, 'tariff_raise');
const openDispute = (text) => {
  const e = { day: 100, tradePolicy: { seq: 1, disputes: new Map() } };
  const act = { id: 'act1', issuerPartyId: 'BIG', sponsorKey: 'BIG' };
  return loadCVt(text)(e, act, [{ id: 'cl1', activeDay: 110, targetPartyIds: ['SMALL'] }])[0];
};
const od = openDispute(original), pd = openDispute(patched);
check(od.responseDueDay === 140, 'original: consultations end 30 days after the clause (negative control)', String(od.responseDueDay));
check(pd.responseDueDay === 170, 'patched: consultations end 60 days after the clause', String(pd.responseDueDay));

// (2) hold back, inside dGo (the due-dispute picker, oldest first, at most eGo = 3), before the slice.
const loadDGo = (text) => {
  const helper = text.includes('function __geobalRetaliationHoldBack(') ? fnSrc(text, '__geobalRetaliationHoldBack') : '';
  return new Function('ls', 'cGo', 'uGo', 'Xe', 'K', 'eGo', 'nr', `${helper}${fnSrc(text, 'dGo')};return dGo;`)(
    () => null, () => false, () => false, Xe, K, 3, (e) => e.flows);
};
const D = { o: loadDGo(original), p: loadDGo(patched) };
const dispute = (id, respondent, openedDay) => ({ id, status: 'action_due', complainantPartyId: 'SMALL', respondentPartyId: respondent, openedDay });
const world = ({ gdpSmall, shareToBig, blocs, respondent = 'BIG', disputes }) => ({
  countries: new Map([['SMALL', { gdp: gdpSmall }], ['BIG', { gdp: 1000 }], ['B2', { gdp: 1000 }], ['OTHER', { gdp: 500 }], ['PEER', { gdp: 30 }]]),
  blocs,
  flows: [
    { exporterActorId: 'SMALL', importerActorId: 'BIG', goodId: 'g', tradeValue: 100 * shareToBig },
    { exporterActorId: 'SMALL', importerActorId: 'OTHER', goodId: 'g', tradeValue: 100 * (1 - shareToBig) },
    { exporterActorId: 'BIG', importerActorId: 'SMALL', goodId: 'g', tradeValue: 50 },
  ],
  tradePolicy: { disputes: new Map((disputes || [dispute('d1', respondent, 10)]).map((d) => [d.id, d])) },
});
const due = (which, w) => D[which](w, 'SMALL').map((d) => d.id);
const dep = world({ gdpSmall: 20, shareToBig: 0.6 });
check(due('o', dep).includes('d1'), 'original: a small dependent economy is due to retaliate (negative control)');
check(!due('p', dep).length, 'patched: small (2% of GDP) and dependent (60% of exports) holds back');
check(due('p', world({ gdpSmall: 80, shareToBig: 0.6 })).includes('d1'), 'patched: 8% of GDP (Canada-sized) still retaliates');
check(due('p', world({ gdpSmall: 20, shareToBig: 0.1 })).includes('d1'), 'patched: small but not dependent still retaliates');
check(!due('p', world({ gdpSmall: 20, shareToBig: 0.25 })).length, 'patched: exactly 25% of exports holds back');
check(!due('p', world({ gdpSmall: 49.9, shareToBig: 0.6 })).length && due('p', world({ gdpSmall: 50, shareToBig: 0.6 })).length === 1, 'patched: 5% GDP boundary');
check(!due('p', world({ gdpSmall: 80, shareToBig: 0.6, blocs: { BLOC: ['BIG', 'B2'] }, respondent: 'BLOC' })).length,
  'patched: bloc respondent GDP counted together');
const nod = world({ gdpSmall: 20, shareToBig: 0.6 }); nod.flows = [];
check(due('p', nod).includes('d1'), 'patched: no trade flows, no hold back');
// Three older held-back disputes (against BIG) do not crowd out a newer one against a peer (PEER: SMALL is 67% of its GDP).
const crowd = world({ gdpSmall: 20, shareToBig: 0.6, disputes: [dispute('h1', 'BIG', 1), dispute('h2', 'BIG', 2), dispute('h3', 'BIG', 3), dispute('ok', 'PEER', 9)] });
check(JSON.stringify(due('o', crowd)) === '["h1","h2","h3"]', 'original: the three oldest are picked (negative control)', JSON.stringify(due('o', crowd)));
check(JSON.stringify(due('p', crowd)) === '["ok"]', 'patched: held-back disputes are left out before the three oldest are picked', JSON.stringify(due('p', crowd)));
// SGo keeps the game's own filter (patrons) and no longer filters again.
check(fnSrc(patched, 'SGo').includes('let a=dGo(e,t.key).filter(s=>!fGo(e,t,s));'), 'SGo unchanged apart from the helper placed before it');
console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
