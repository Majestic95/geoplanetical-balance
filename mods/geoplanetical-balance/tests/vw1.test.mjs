// VW1 function test: _playerProvinces cut from the patched and the original bundle, with the game's own bR, hR and FeB,
// checks that asking for the player's provinces no longer rewrites their power data, and that the code the fix relies on
// to keep that data current is still in the bundle.
// Usage: node mods/geoplanetical-balance/tests/vw1.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;

const between = (text, from, to) => {
  const i = text.indexOf(from), j = text.indexOf(to, i);
  if (i < 0 || j < 0 || j - i > 3000) throw new Error(`${from} not found`);
  return text.slice(i, j + to.length);
};
const method = text => between(text, '_playerProvinces(){', ',this._playerProvs}');
const bRsrc = between(original, 'function $$(e,t,a){', 's.__power.plants.push(i.id))}}');
const hRstart = original.indexOf('function Z$(e,t){'), hRend = original.indexOf('function ', hRstart + 10);
const hRsrc = original.slice(hRstart, hRend);
const FeBsrc = between(original, 'function Ika(e,t){', 'return Z$(e,t)-a*8.76*.45}');
const sources = ['coal', 'gas', 'hydro'];
const helpers = new Function('el', 'p2', 'Oi', `${bRsrc}; ${hRsrc}; ${FeBsrc}; return {bR:$$, hR:Z$, FeB:Ika};`)(sources, p => p.gw, null);

const Rr = (prov, key) => String(prov.owner) === String(key);
const load = (text, onRefresh) => {
  const Cls = new Function('Oi', '$$', `return class { ${method(text)} }`)(Rr, (...a) => { onRefresh(); helpers.bR(...a); });
  return Cls;
};
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };

const makeSim = Cls => {
  const provs = [
    { __provId: 1, __provKey: 'p1', owner: 'z', __pop: 100, __industry: 25 },
    { __provId: 2, __provKey: 'p2', owner: 'z', __pop: 300, __industry: 25 },
    { __provId: 3, __provKey: 'p3', owner: 'Y', __pop: 500, __industry: 25 },
  ];
  const player = { key: 'z', energy: { demandTWh: 100 }, _plants: ['a'], provs: provs.slice(0, 2) };
  const sim = new Cls();
  Object.assign(sim, { player, playerKey: 'z', world: { provinces: provs }, plants: new Map([['a', { online: true, provKey: 'p2', src: 'gas', gw: 5, id: 'a' }]]), countries: new Map([['z', player]]) });
  helpers.bR(sim, player, player.provs); // what the monthly tick does
  return { sim, provs, player };
};

check(patched !== original && !method(patched).includes('$$('), 'the patch is in the built bundle');
check(method(original).includes('$$('), 'the original refreshes in this method');

// Premises: the code that keeps the data current is still there, and it covers every country at load and each month.
check(/"aggregateProvincePower",\w+=>\{\w+\.energy&&\$\$\(e,\w+,\w+\.provs\|\|\[\]\)\}/.test(patched), 'the monthly tick still refreshes every country');
check(/for\(let r of e\.countries\.values\(\)\)r\.energy&&fp\(e,r,!1\);return e\}/.test(patched), 'load still refreshes every country');
check(/function fp\(e,t,a=!0\)\{t\?\.energy&&\(\w+\(e,t\),\$\$\(e,t,t\.provs\|\|\[\]\)/.test(patched), 'plant changes still refresh the owner');

// The core: opening the screen does not change the data.
for (const [label, text, expectCalls] of [['patched', patched, 0], ['original', original, 1]]) {
  let calls = 0;
  const { sim, provs } = makeSim(load(text, () => { calls++; }));
  const before = provs[0].__power, share = provs[0].__power.loadShare;
  provs[0].__pop = 900; // war deaths or displacement mid-month: the monthly split is now out of date
  const list = sim._playerProvinces();
  check(calls === expectCalls, `${label}: refreshes on the first call: ${expectCalls}`, String(calls));
  check(list.length === 2 && list.every(p => p.owner === 'z'), `${label}: returns the player's provinces`);
  check(sim._playerProvinces() === list, `${label}: the list is cached`);
  if (expectCalls === 0) {
    check(provs[0].__power === before && provs[0].__power.loadShare === share, 'patched: the power data is untouched');
  } else {
    check(provs[0].__power !== before && provs[0].__power.loadShare !== share, 'original: the view rewrites the power data (the bug)');
  }
}

// What an order reads. An order calls _playerProvinces itself (JeB, T4Q, AVQ), so in the original a screen matters by
// taking that first refresh earlier: screen, then population moves, then the order, against population moves, then the order.
{
  const run = (text, screenFirst) => {
    const { sim, provs } = makeSim(load(text, () => {}));
    sim._playerProvs = null; // after a reset, as at session start
    if (screenFirst) sim._playerProvinces();
    provs[0].__pop = 900;
    sim._playerProvinces(); // the order's own call
    return helpers.FeB(sim, provs[0]);
  };
  check(run(patched, true) === run(patched, false), 'patched: plant-site ranking is the same with or without the screen', String(run(patched, true)));
  check(run(original, true) !== run(original, false), 'original: plant-site ranking depends on the screen', `${run(original, true)} vs ${run(original, false)}`);
}

// The territory step (_FA) refreshes the countries a change touched.
const cutFA = text => between(text, 'function xWe(e,t,a={}){', 'return e._territoryRevision||0}');
const loadFA = (text, onRefresh) => new Function('$$', 'f2a', 'cMe', 'km', `${cutFA(text)}; return xWe;`)((...a) => { onRefresh(a[1].key); helpers.bR(...a); }, () => {}, () => ({ changed: true }), () => {});
check(cutFA(patched).includes('$$(') && !cutFA(original).includes('$$('), 'the territory step refreshes only in the patched bundle');
const transfer = (s, provKey, to) => {
  const p = s.provs.find(x => x.__provKey === provKey), from = s.sim.countries.get(p.owner), dest = s.sim.countries.get(to);
  if (from) from.provs = from.provs.filter(x => x !== p);
  p.owner = to; dest.provs.push(p);
  return [from?.key, to].filter(Boolean);
};
{
  const refreshed = [];
  const s = makeSim(load(patched, () => { throw new Error('the view must not refresh'); }));
  const { sim, provs, player } = s;
  const kept = { __provId: 4, __provKey: 'p4', owner: 'Y', __pop: 500, __industry: 25 };
  provs.push(kept);
  const donor = { key: 'Y', energy: { demandTWh: 50 }, _plants: [], provs: [provs[2], kept] };
  sim.countries.set('Y', donor);
  helpers.bR(sim, donor, donor.provs);
  check(kept.__power.loadShare > 0.4 && kept.__power.loadShare < 0.6, 'before the transfer the donor splits its load', String(kept.__power.loadShare));
  const FA = loadFA(patched, k => refreshed.push(k));
  sim._playerProvinces();
  provs[0].__pop = 500;
  FA(sim, new Set(transfer(s, 'p3', 'z')));
  check(refreshed.join() === 'Y,z', 'a transfer refreshes the donor and the receiver', refreshed.join());
  check(provs[2].__power?.ownerKey === 'z', 'the province has its new owner at once');
  check(Math.abs(kept.__power.loadShare - 1) < 1e-12, 'the donor re-splits its load over what it keeps', String(kept.__power.loadShare));
  const shares = provs.slice(0, 3).map(p => p.__power.loadShare);
  check(Math.abs(shares.reduce((a, b) => a + b, 0) - 1) < 1e-12, 'load shares of the receiver add up to 1');
  const straight = provs.map(p => JSON.stringify(p.__power));
  helpers.bR(sim, player, player.provs);
  check(provs.map(p => JSON.stringify(p.__power)).join() === straight.join(), 'same data as a reload would compute after the transfer');
  check(sim._playerProvinces().length === 3, 'the list follows the new owner, with no refresh in the view');
  const r2 = []; const FA2 = loadFA(patched, k => r2.push(k));
  FA2(sim, ['z']); check(r2.join() === 'z', 'an array of touched keys works too');
  r2.length = 0; FA2(sim, new Set()); FA2(sim, []); FA2(sim, null);
  check(r2.length === 0, 'nothing touched: no refresh');
  FA2(sim, ['gone']); check(r2.length === 0, 'a key with no country: skipped, no throw');
  donor.energy = null; FA2(sim, ['Y']); check(r2.length === 0, 'a country with no energy data: skipped');
  const noPlants = { countries: sim.countries, transport: null };
  FA2(noPlants, ['z']); check(r2.length === 0, 'plants not restored yet: skipped, no throw');
}
// The original: a transfer does not refresh, so the first caller afterwards did.
{
  const refreshed = [];
  const s = makeSim(load(original, () => {}));
  loadFA(original, k => refreshed.push(k))(s.sim, new Set(['z']));
  check(refreshed.length === 0 && s.sim._playerProvs === null, 'original: the territory step only clears the list');
}
// Readers of a province with no power data.
{
  const { sim, provs } = makeSim(load(patched, () => {}));
  check(helpers.hR(sim, provs[2]) === 0 && Number.isFinite(helpers.FeB(sim, provs[2])), 'readers tolerate a province with no power data', String(helpers.hR(sim, provs[2])));
}
// Nothing to refresh, or a world with no provinces: no throw.
{
  const Cls = load(patched, () => {});
  const sim = new Cls(); Object.assign(sim, { player: { key: 'z' }, playerKey: 'z', world: {} });
  check(sim._playerProvinces().length === 0, 'no provinces: an empty list');
}
check(method(patched) === method(original).replace(',$$(this,this.player,this._playerProvs)', ''), 'nothing else in the method changed');

console.log(failures ? `${failures} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
