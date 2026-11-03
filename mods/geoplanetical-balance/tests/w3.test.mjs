// W3 function test: the conquest succession (__geobalW3, called right after VXg in gWg's retirement loop), sliced
// from the built bundle, with stubs for the game functions it orchestrates (Si net debt, QxB secession bond,
// obligations tt/XnB/ZW/dA, $CQ stockpiles, exB integration succession, xsg self-claim release, OnB obligations,
// taB project funding, Ur view refresh, AE stockpile check). Checks the call site, the order of calls, the shares
// given to non-heir conquerors (from the inherited debt, whatever the heir's own net debt), the cancellation of
// treasury obligations between the conquered state and the heir, the move of succession claims the conquered
// state holds, the FX reclassification of inherited lots, and that every skip or failed precheck leaves the state
// untouched (game write-off). The ledger effects themselves are checked end to end in w3.headless.mjs.
// Usage: node mods/geoplanetical-balance/tests/w3.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const ok = (cond, what) => { checks++; if (!cond) { failures++; console.log(`FAIL ${what}`); } };

// Call site: in gWg's retirement loop, after VXg, conquest only, with H = the plan's heir (tkQ for conquest).
{
  const at = patched.indexOf('T1C(A,q,a);let __gbW3R=g.integration?null:__geobalW3(A,q,a,U);');
  const head = patched.lastIndexOf('U=g.integration?g.integration.targetKey:VpQ(A,q,a),p=IFA(A,H,{heirKey:U}),F=__geobalW3Spare0(g.integration||U==null?null:{country:String(q),heir:String(U)},()=>nFA(A,p));', at);
  ok(at > 0 && head > 0 && at - head < 300, 'call site: right after T1C, U is the retirement heir (VpQ for conquest), skipped for integration');
  ok(patched.indexOf('GFA(A,q,{deferInvalidation:!0,retirementPlan:p', at) - at < 600, 'call site: before GFA runs the finance retirement steps (incl. finance:sovereign-debt)');
  // Since 26346311 the game moves the conquered strategic reserves to the heir itself (F9A) after this point; W3 has
  // already moved them (and handed the reserve accounts to the heir), so the game's move runs only when W3 refused.
  const guard = patched.indexOf('y&&(A.finance&&!__gbW3R&&DdA(A,H,y),aQQ(H.energy,y.energy))', at);
  ok(guard > at && guard - at < 400 && original.includes('y&&(A.finance&&DdA(A,H,y),aQQ(H.energy,y.energy))'), 'call site: the game\'s own reserve move (DdA) is skipped when W3 took over the treasury, kept otherwise');
  const vxg = t => { const s = t.indexOf('function T1C(A,B,Q){'); return t.slice(s, t.indexOf('function VpQ(', s)); };
  ok(vxg(patched) === vxg(original) && vxg(original).length > 500, 'T1C itself unchanged');
}

const s = patched.indexOf('function __geobalW3Ready('), e = patched.indexOf('function T1C(A,B,Q){', s);
if (s < 0 || e < s || e - s > 5000) throw new Error('W3 functions not found');
const NA = (A, B = 0) => (Number.isFinite(Number(A)) ? Number(A) : B);
const gA = x => Math.round(x * 1e8);
const R = a => a.reduce((t, x) => t + gA(x), 0) / 1e8;
const jxQ = new Set(['central_bank_reserve_asset', 'deposit_guarantee_reserve_asset']);

// A small world: country 001 conquered, 002 and 003 conquerors, 004 a conqueror without a treasury record.
const FIELDS = ['cashAccountId', 'equityAccountId', 'debtLiabilityAccountId', 'revenueAccountId', 'expenseAccountId'];
const normal = f => (/Liability|equity|revenue/i.test(f) ? 'credit' : 'debit');
function makeWorld({ debt = 50, heirNet = 100, claimBook = 0, heirCcy = 'EUR' } = {}) {
  const accounts = {}, sovereigns = {}, countries = new Map(), instruments = {}, positions = {};
  for (const k of ['001', '002', '003']) {
    const sv = { id: `treasury:${k}`, countryKey: k, currencyCode: k === '003' ? 'HUF' : k === '002' ? heirCcy : 'EUR', lotIds: [], holderIds: [], budgetExpenseAccountIds: { aid: `aid:${k}` } };
    for (const f of FIELDS) { sv[f] = `${f}:${k}`; accounts[sv[f]] = { id: sv[f], normal: normal(f), kind: f === 'cashAccountId' ? 'treasury_cash' : 'x', currencyCode: sv.currencyCode, balanceBn: 1 }; }
    accounts[`aid:${k}`] = { id: `aid:${k}`, normal: 'debit', kind: 'x', currencyCode: sv.currencyCode, balanceBn: 0 };
    sovereigns[k] = sv;
  }
  // The conquered state's lots: a domestic EUR lot (debt - 5) and a USD FX lot (5).
  instruments['gov:001:legacy:dom'] = { id: 'gov:001:legacy:dom', currencyCode: 'EUR', quantityIssued: debt - 5, active: true, terms: { fx: false } };
  instruments['gov:001:legacy:fx'] = { id: 'gov:001:legacy:fx', currencyCode: 'USD', quantityIssued: 5, active: true, terms: { fx: true } };
  sovereigns['001'].lotIds.push('gov:001:legacy:dom', 'gov:001:legacy:fx');
  for (const k of ['001', '002', '003', '004']) countries.set(k, { key: k, stockpiles: {} });
  const net = { '001': debt - claimBook, '002': heirNet, '003': 20 }, book = { '001': claimBook, '002': 0, '003': 0 };
  const calls = [];
  const stubs = {
    Si: (F, key) => ({ netDebtBn: net[key] ?? 0, successionClaimBookBn: book[key] ?? 0 }),
    QxB: (A, B, Q, frac) => {
      const face = Math.floor(net[B.key] * frac * 1e8) / 1e8, id = `gov:${Q.key}:succession:${B.key}`;
      calls.push(['yZB', B.key, Q.key, frac, face]);
      if (!(face > 0)) return null;
      net[B.key] -= face; book[B.key] += face; net[Q.key] = (net[Q.key] || 0) + face;
      instruments[id] = { id, currencyCode: sovereigns[Q.key].currencyCode, quantityIssued: face, terms: { creditorCountryKey: B.key } };
      positions[id] = { [`treasury:${B.key}`]: { holderId: `treasury:${B.key}`, quantity: face, bookValueBn: face, cashAccountId: `cashAccountId:${B.key}`, incomeAccountId: `revenueAccountId:${B.key}`, lossAccountId: `expenseAccountId:${B.key}`, assetAccountId: `treasury-sovereign-claim:${B.key}:x` } };
      return { faceBn: face };
    },
    tt: F => { calls.push(['tt']); return F.economicObligations; },
    XnB: (F, rows) => { calls.push(['P9B', rows.map(r => r.row.id)]); for (const r of rows) if (r.row.bad) throw new Error('economic-obligation:retirement-account'); return rows.map(r => ({ accountId: r.row.payer.payableAccountId, debitBn: r.units / 1e8 })); },
    ZW: () => calls.push(['ZW']),
    dA: (F, tx) => calls.push(['kA', tx.kind, tx.refs.retiredCount]),
    $CQ: (A, g, h) => { calls.push(['$CQ', g.key, h.key]); return new Map([['stock:001', 'stock:002']]); },
    exB: (A, g, h) => {
      calls.push(['zZB', g.key, h.key]);
      net[h.key] += net[g.key]; net[g.key] = 0;
      for (const i of sovereigns[g.key].lotIds) { instruments[i].countryKey = h.key; sovereigns[h.key].lotIds.push(i); }
      sovereigns[g.key].lotIds = [];
      return { accountMap: new Map(FIELDS.map(f => [`${f}:${g.key}`, `${f}:${h.key}`])) };
    },
    xsg: (A, h) => calls.push(['xsg', h.key]),
    OnB: (F, from, to, r, day) => calls.push(['O8B', from, to, r.accountMap.get('stock:001'), day]),
    taB: (A, from, to, r) => calls.push(['taB', from, to, r.accountMap.size]),
    Ur: (A, h) => calls.push(['sr', h.key]),
    AE: st => { if (st.bad) throw new Error('strategic-reserve:book-mismatch'); return st; },
  };
  const names = ['Si', 'QxB', 'tt', 'XnB', 'ZW', 'dA', '$CQ', 'exB', 'xsg', 'OnB', 'taB', 'Ur', 'AE'];
  const NEW = { Si: 'r3', QxB: 'yZB', tt: 'zt', XnB: 'P9B', ZW: 'u$', dA: 'kA', $CQ: 'DdA', exB: 'zZB', xsg: 'gdg', OnB: 't9B', taB: 'a3B', Ur: 'kr', AE: 'd6' };
  // Names only the early-retirement helpers (__geobalW3Early, __geobalW3Unspare) reference: never called here.
  const unused = { v9B: null, oKA: null, l9B: null };
  const fn = new Function(...names.map(n => NEW[n]), ...Object.keys(unused), 'Hgg', 'jA', 'gA', 'W', `${patched.slice(s, e)};return{ready:__geobalW3Ready,run:__geobalW3};`)(...names.map(n => stubs[n]), ...Object.values(unused), jxQ, NA, gA, R);
  const A = { day: 40, countries, finance: { sovereigns, accounts, instruments, positions, economicObligations: { schemaVersion: 1, open: {} } } };
  return { A, fn, calls, net };
}
const moves = (...m) => m.map(([to, pop]) => ({ from: '001', to, movedPop: pop }));
const close = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const order = calls => calls.map(c => c[0]).join(',');

{ // One conqueror: the integration finance block, in TdQ's order, then xsg after the claim move, then Ur.
  const { A, fn, calls, net } = makeWorld();
  const r = fn.run(A, '001', moves(['002', 9]), '002');
  ok(order(calls) === '$CQ,zZB,xsg,O8B,taB,sr', `one conqueror: $CQ, zZB, xsg, O8B, taB, sr (got ${order(calls)})`);
  ok(calls[3][3] === 'stock:002' && calls[4][3] === FIELDS.length + 1, 'one conqueror: the stockpile account map is merged into the succession map before O8B and taB (as TdQ)');
  ok(calls[3][4] === (A.day || 0) && Number.isInteger(calls[3][4]), 'one conqueror: the obligation move (NsB since 26346311) is dated today, as the game\'s own integration calls it');
  ok(r?.heirKey === '002' && close(r.inheritedNetDebtBn, 50) && r.shares.length === 0 && close(net['002'], 150), 'one conqueror: the heir takes the whole net debt (100 + 50)');
}
// Two conquerors 70/30 inheriting 50: the other conqueror owes 15 whatever the heir's own net debt (finding 4).
for (const heirNet of [100, 0, -40, -100]) {
  const { A, fn, calls } = makeWorld({ heirNet });
  const r = fn.run(A, '001', moves(['002', 7], ['003', 3]), '002');
  const q = calls.filter(c => c[0] === 'yZB');
  ok(q.length === 1 && q[0][1] === '001' && q[0][2] === '003' && close(q[0][4], 15) && close(r.shares[0].faceBn, 15),
    `70/30, heir net debt ${heirNet}: one bond of 30% x 50 = 15 from the other conqueror, booked to the conquered treasury (got ${q.map(c => c[4])})`);
  ok(order(calls).startsWith('yZB,$CQ,zZB'), `heir net debt ${heirNet}: the bond is booked before the treasury passes to the heir`);
}
{ // The bond, booked to the conquered treasury, passes to the heir with it (finding 2 machinery).
  const { A, fn } = makeWorld();
  fn.run(A, '001', moves(['002', 7], ['003', 3]), '002');
  const id = 'gov:003:succession:001', p = A.finance.positions[id];
  ok(p && !p['treasury:001'] && p['treasury:002']?.holderId === 'treasury:002' && p['treasury:002'].cashAccountId === 'cashAccountId:002' &&
    p['treasury:002'].incomeAccountId === 'revenueAccountId:002' && p['treasury:002'].lossAccountId === 'expenseAccountId:002' &&
    A.finance.instruments[id].terms.creditorCountryKey === '002', 'the new succession bond is held by the heir, accounts remapped, creditor the heir');
}
{ // Three conquerors 50/30/20 of 80, the 30% one in two move entries: one bond per country, shares of 80.
  const { A, fn, calls } = makeWorld({ debt: 80, heirNet: -500 });
  A.finance.sovereigns['004'] = { ...A.finance.sovereigns['003'], id: 'treasury:004', countryKey: '004', lotIds: [] };
  fn.run(A, '001', moves(['002', 5], ['003', 1], ['004', 2], ['003', 2]), '002');
  const q = calls.filter(c => c[0] === 'yZB');
  ok(q.length === 2 && q[0][2] === '003' && q[1][2] === '004' && close(q[0][4], 24) && close(q[1][4], 16),
    `three conquerors: 30% x 80 = 24 and 20% x 80 = 16, in move order (got ${q.map(c => `${c[2]}:${c[4]}`)})`);
}
{ // The inherited debt is the lots' face net of the conquered state's own succession claims.
  const { A, fn, calls } = makeWorld({ debt: 50, claimBook: 10 });
  fn.run(A, '001', moves(['002', 7], ['003', 3]), '002');
  const q = calls.find(c => c[0] === 'yZB');
  ok(q && close(q[4], 12), `claims held by the conquered state net the inherited debt: 30% x (50 - 10) = 12 (got ${q?.[4]})`);
}
{ // Lots held wholly by the heir's treasury are released by the takeover (xsg's rule), not inherited: they leave the
  // base. A heir succession claim and a heir bilateral loan both count; a heir-creditor lot partly held by others,
  // or one already written off, stays in the base.
  const run = lots => {
    const { A, fn, calls } = makeWorld({ debt: 50 });
    for (const [id, face, terms, holders] of lots) {
      A.finance.instruments[id] = { id, currencyCode: 'EUR', quantityIssued: face, active: true, terms };
      A.finance.positions[id] = Object.fromEntries(holders.map(h => [h, { holderId: h, quantity: face / holders.length }]));
      A.finance.sovereigns['001'].lotIds.push(id);
    }
    fn.run(A, '001', moves(['002', 7], ['003', 3]), '002');
    return calls.find(c => c[0] === 'yZB')?.[4];
  };
  let v = run([['gov:001:succession:002', 20, { creditorCountryKey: '002' }, ['treasury:002']]]);
  ok(close(v, 15), `the heir's own 20 bn claim leaves the base: 30% x (70 - 20) = 15 (got ${v})`);
  v = run([['bil:002:001', 20, { bilateral: true }, ['treasury:002']]]);
  ok(close(v, 15), `a 20 bn bilateral loan held by the heir leaves the base (got ${v})`);
  v = run([['gov:001:succession:002', 20, { creditorCountryKey: '002' }, ['treasury:002', 'bank:x']]]);
  ok(close(v, 21), `a heir-creditor lot also held by others stays: 30% x 70 = 21 (got ${v})`);
  v = run([['gov:001:succession:002', 20, { creditorCountryKey: '002', defaultStatus: 'written_off' }, ['treasury:002']]]);
  ok(close(v, 21), `a written-off heir lot stays in the base, as xsg skips it (got ${v})`);
}
{ // A conqueror with no treasury record is skipped; the heir keeps its share.
  const { A, fn, calls } = makeWorld();
  fn.run(A, '001', moves(['002', 6], ['004', 4]), '002');
  ok(calls.filter(c => c[0] === 'yZB').length === 0 && calls.some(c => c[0] === 'zZB'), 'conqueror without a treasury record: no bond, the heir keeps the debt');
}
{ // Dust and no debt: no bonds.
  const a = makeWorld({ debt: 5 + 2e-6 }); // lots face 5 + 2e-6 minus claims 5 -> 2e-6
  a.A.finance.instruments['gov:001:legacy:fx'].quantityIssued = 0;
  a.A.finance.instruments['gov:001:legacy:dom'].quantityIssued = 2e-6;
  a.fn.run(a.A, '001', moves(['002', 7], ['003', 3]), '002');
  ok(a.calls.filter(c => c[0] === 'yZB').length === 0, 'share below 1e-6 bn: no dust bond');
  const b = makeWorld({ claimBook: 60 });
  b.fn.run(b.A, '001', moves(['002', 5], ['003', 5]), '002');
  ok(b.calls.filter(c => c[0] === 'yZB').length === 0, 'inherited net debt not positive (claims exceed lots): no bonds');
  const c = makeWorld();
  c.fn.run(c.A, '001', moves(['002', 0], ['003', 0]), '002');
  ok(c.calls.some(x => x[0] === 'zZB') && !c.calls.some(x => x[0] === 'yZB'), 'no population moved: heir takes the treasury, no shares');
}
{ // Finding 1: treasury obligations between the conquered state and the heir are cancelled first (as the game's
  // retirement does, kind economic_obligation_country_retirement), the others pass to the heir through OnB.
  const { A, fn, calls } = makeWorld();
  const t = (id) => ({ ownerType: 'treasury', ownerId: id, payableAccountId: `pay:${id}`, receivableAccountId: `rec:${id}` });
  A.finance.economicObligations.open = {
    'o:2': { id: 'o:2', payer: t('treasury:001'), payee: t('treasury:002'), remainingBn: 3 },
    'o:1': { id: 'o:1', payer: t('treasury:002'), payee: t('treasury:001'), remainingBn: 1 },
    'o:3': { id: 'o:3', payer: t('treasury:001'), payee: t('treasury:003'), remainingBn: 2 },
    'o:4': { id: 'o:4', payer: t('treasury:001'), payee: { ownerType: 'company', ownerId: 'treasury:002' }, remainingBn: 2 },
  };
  fn.run(A, '001', moves(['002', 9]), '002');
  const x = calls.filter(c => c[0] === 'P9B');
  ok(x.length === 2 && JSON.stringify(x[1][1]) === '["o:1","o:2"]', `the two obligations between the treasuries, both directions, sorted by id (got ${JSON.stringify(x.map(c => c[1]))})`);
  ok(calls.some(c => c[0] === 'kA' && c[1] === 'economic_obligation_country_retirement' && c[2] === 2), 'cancelled with the retirement posting kind');
  ok(!A.finance.economicObligations.open['o:1'] && !A.finance.economicObligations.open['o:2'] && A.finance.economicObligations.open['o:3'] && A.finance.economicObligations.open['o:4'],
    'only those two are removed; obligations with third parties stay for O8B');
  ok(order(calls).indexOf('kA') < order(calls).indexOf('zZB') && order(calls).indexOf('zZB') < order(calls).indexOf('O8B'), 'cancelled before zZB and O8B (no self-sale after the remap)');
  const w = makeWorld();
  w.A.finance.economicObligations.open = { 'o:9': { id: 'o:9', bad: true, payer: t('treasury:001'), payee: t('treasury:002'), remainingBn: 1 } };
  ok(w.fn.run(w.A, '001', moves(['002', 9]), '002') === null && w.calls.filter(c => c[0] !== 'P9B').length === 0,
    'precheck: an obligation between the two that cannot be cancelled (no retirement account) leaves everything untouched');
}
{ // Finding 2: succession claims the conquered state holds on third countries (not bilateral) pass to the heir.
  const { A, fn, calls } = makeWorld();
  const F = A.finance;
  F.instruments['gov:005:succession:001:1'] = { id: 'gov:005:succession:001:1', terms: { creditorCountryKey: '001' } };
  F.positions['gov:005:succession:001:1'] = { 'treasury:001': { holderId: 'treasury:001', quantity: 20, bookValueBn: 20, cashAccountId: 'cashAccountId:001', incomeAccountId: 'revenueAccountId:001', lossAccountId: 'expenseAccountId:001', assetAccountId: 'claim:001' } };
  F.instruments['bil:1'] = { id: 'bil:1', terms: { bilateral: true, creditorCountryKey: '001' } };
  F.positions['bil:1'] = { 'treasury:001': { holderId: 'treasury:001', quantity: 1 } };
  F.instruments['gov:006:succession:001:1'] = { id: 'gov:006:succession:001:1', terms: { creditorCountryKey: '001' } };
  F.positions['gov:006:succession:001:1'] = { 'treasury:001': { holderId: 'treasury:001', quantity: 2 }, 'treasury:002': { holderId: 'treasury:002', quantity: 3 } };
  fn.run(A, '001', moves(['002', 9]), '002');
  const p = F.positions['gov:005:succession:001:1'];
  ok(!p['treasury:001'] && p['treasury:002']?.quantity === 20 && p['treasury:002'].bookValueBn === 20 && p['treasury:002'].cashAccountId === 'cashAccountId:002' && p['treasury:002'].assetAccountId === 'claim:001' &&
    F.instruments['gov:005:succession:001:1'].terms.creditorCountryKey === '002', 'a 20 bn succession claim on a third country: held by the heir, creditor the heir (no dead-creditor write-down)');
  ok(F.positions['bil:1']['treasury:001'] && F.instruments['bil:1'].terms.creditorCountryKey === '001', 'bilateral instruments are left to zZB');
  ok(F.positions['gov:006:succession:001:1']['treasury:001'], 'a claim the heir already co-holds is not merged (left as the game has it)');
  ok(order(calls).indexOf('xsg') > order(calls).indexOf('zZB') && order(calls).indexOf('xsg') < order(calls).indexOf('O8B'), 'xsg runs again after the move, so a claim on the heir itself is released');
}
{ // Finding 3: inherited lots are reclassified against the heir's currency (as the game's currency reform does).
  const a = makeWorld({ heirCcy: 'EUR' });
  a.fn.run(a.A, '001', moves(['002', 9]), '002');
  ok(a.A.finance.instruments['gov:001:legacy:dom'].terms.fx === false && a.A.finance.instruments['gov:001:legacy:fx'].terms.fx === true, 'EUR heir: EUR lot domestic, USD lot foreign');
  const b = makeWorld({ heirCcy: 'CHF' });
  b.fn.run(b.A, '001', moves(['002', 9]), '002');
  ok(b.A.finance.instruments['gov:001:legacy:dom'].terms.fx === true, 'CHF heir: the inherited EUR lot becomes foreign-currency debt');
  const c = makeWorld({ heirCcy: 'USD' });
  c.fn.run(c.A, '001', moves(['002', 9]), '002');
  ok(c.A.finance.instruments['gov:001:legacy:fx'].terms.fx === false, 'USD heir: the inherited USD lot becomes domestic (reverse mismatch)');
  ok(order(c.calls).endsWith('sr'), 'the heir\'s debt view is refreshed after the reclassification');
}
// Skips: nothing is called, the game's write-off then runs as before.
const untouched = (label, mutate, args) => {
  const w = makeWorld();
  mutate?.(w);
  const r = w.fn.run(w.A, ...(args || ['001', moves(['002', 9]), '002']));
  ok(r === null && w.calls.filter(c => c[0] !== 'P9B').length === 0, `${label}: nothing moved`);
};
untouched('no heir', null, ['001', moves(['002', 9]), null]);
untouched('heir is the conquered country', null, ['001', moves(['002', 9]), '001']);
untouched('heir unknown', null, ['001', moves(['002', 9]), '009']);
untouched('heir without a treasury record', null, ['001', moves(['004', 9]), '004']);
untouched('conquered without a treasury record', w => { delete w.A.finance.sovereigns['001']; });
untouched('heir treasury dissolved', w => { w.A.finance.sovereigns['002'].status = 'dissolved'; });
untouched('no finance state', w => { delete w.A.finance; });
untouched('precheck: missing account on the heir', w => { delete w.A.finance.accounts['revenueAccountId:002']; });
untouched('precheck: closed account', w => { w.A.finance.accounts['equityAccountId:001'].closed = true; });
untouched('precheck: normal side differs', w => { w.A.finance.accounts['cashAccountId:002'].normal = 'credit'; });
untouched('precheck: missing lot instrument', w => { w.A.finance.sovereigns['001'].lotIds.push('gov:001:gone'); });
untouched('precheck: lotIds not a list', w => { w.A.finance.sovereigns['002'].lotIds = null; });
untouched('precheck: budget expense accounts missing on the heir', w => { delete w.A.finance.sovereigns['002'].budgetExpenseAccountIds; });
untouched('precheck: inconsistent strategic stock', w => { w.A.countries.get('001').stockpiles = { oil: { bad: true } }; });
untouched('precheck: heir strategic stock inconsistent', w => { w.A.countries.get('001').stockpiles = { oil: {} }; w.A.countries.get('002').stockpiles = { oil: { bad: true } }; });
untouched('precheck: central-bank reserve account across currencies with a balance', w => {
  for (const k of ['001', '002']) w.A.finance.accounts[`cashAccountId:${k}`].kind = 'central_bank_reserve_asset';
  w.A.finance.accounts['cashAccountId:001'].currencyCode = 'CZK';
});
{
  const w = makeWorld();
  for (const k of ['001', '002']) w.A.finance.accounts[`cashAccountId:${k}`].kind = 'central_bank_reserve_asset';
  w.A.finance.accounts['cashAccountId:001'].currencyCode = 'CZK';
  w.A.finance.accounts['cashAccountId:001'].balanceBn = 0;
  ok(w.fn.run(w.A, '001', moves(['002', 9]), '002') !== null, 'precheck: an empty central-bank reserve account across currencies is fine (nothing to settle)');
}
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
