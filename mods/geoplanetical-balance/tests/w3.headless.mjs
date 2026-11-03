// W3 end to end, headless: conquest passes the conquered state's debt to the conquerors.
// As Switzerland (756, CHF), annex through the developer console (annex_country -> transferProvinces -> w9 -> gWg,
// the full-retirement path that runs VXg and then the "finance:sovereign-debt" step):
//   A. Austria (040, EUR, shares its currency): one conqueror. Every Austrian lot is now issued by Switzerland with
//      the same holders, quantities and book values; Switzerland's debt liability rose by Austria's; nothing was
//      written down; the world's sovereign bond face and holders' book values are unchanged.
//   B. Czechia (203, CZK, its own currency, which dies with it): the same, then 31 days of coupons and amortisation
//      on the moved lots (cross-currency settlement), then save and reload (the game's own finance-save validation:
//      ledger trial balance, instrument quantities, positions, banks, external accounts) with the state carried.
//   C. Slovenia (705) split in one transfer between Switzerland and Hungary (348, HUF): test-only instrumentation of
//      the console command, since no console command moves provinces to two countries at once. The conqueror with
//      more population takes the lots; the other owes it its population share of the net debt through the game's
//      succession bond, in its own currency.
//   Also: Austria's treasury arrears with Switzerland (both ways) are cancelled and those with Germany pass to
//   Switzerland; inherited lots are reclassified domestic/foreign against the franc; F. Catalonia secedes from Spain,
//   then Spain is annexed: Spain's succession claim on Catalonia passes to Switzerland and stays performing.
// Usage: node --max-old-space-size=6000 mods/geoplanetical-balance/tests/w3.headless.mjs [--control] [--precheck-case]
//   --control        the unmodified game: Austria's bonds are written off, the arrears cancelled, Spain's claim
//                    stays with its dead treasury.
//   --precheck-case  E alone (day 0): the Netherlands with a closed treasury account; nothing of it moves.
//   Diagnostics: --only-split [--split <key>] (the unmodified game faulted there before build 26346311: W14); --only-a
//   --without-obligation-cancel (step (2) off; before 26368058 it showed the self-sale fault); --w3-only (only the W3 patch).
import { Worker } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import zlib from 'node:zlib';
import { WORKSPACE as ROOT, MODS_DIR, workspaceBuild as pinnedBuild, bundlePath } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';
import { buildBundle } from 'geoplanetical-modloader/patcher/patch-engine.mjs';
import { SIM } from 'geoplanetical-modloader/patcher/session.mjs';
import { moddedWorkerData } from '../../../headless/prototype/modded.mjs';
import { part } from '../../../headless/metrics.mjs';

const build = pinnedBuild();
const control = process.argv.includes('--control');
const onlySplit = process.argv.includes('--only-split');
const argAfter = flag => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : null; };
const P = '756', A_ = '040', B_ = '203', C_ = argAfter('--split') || '705', C2 = '348';

// Test-only: annex_country on Slovenia splits its provinces (alternate province ids) between the player and Hungary
// in one transfer plan. Applied to this test's copy of the bundle only.
const SPLIT_FIND = 'return A.transferProvinces(C,A.playerKey)?.ok?ZA(Q,!0,"territory.countryAnnexed"';
// Test-only, real-engine setups reached through the console's `regions <country> <setup>` (both builds):
//  - w3-arrears: treasury-to-treasury electricity arrears as jjg books them (xnB, payer/payee Ng): the country owes
//    the player 1.25 bn, the player owes it 0.5 bn, it owes Germany 0.75 bn.
//  - w3-close-escrow: its treasury's military escrow account (if empty) is closed, a state exB would reject (and the
//    game's own save validation rejects too, so this runs last, with no save after it).
const REGIONS_FIND = 'regions(A,B,Q){let g=B[0]?Lm(A,B[0]):A.player;';
const REGIONS_REPLACE = REGIONS_FIND + 'if(g&&B[1]==="w3-arrears"){let P=A.player,m=A.countries.get("276"),o=(n,a,p,q)=>({id:"w3-test:arrears/"+n,kind:"electricity_trade",' +
  'dueDay:A.day||0,amountBn:a,payer:Ng(A,p),payee:Ng(A,q),refs:{edgeKey:"w3-test",orderId:"w3-test",quantityTWh:1,paymentRequired:!0}});' +
  'c9B(A.finance,{id:"w3-test:arrears",day:A.day||0,obligations:[o(0,1.25,g,P),o(1,.5,P,g),o(2,.75,g,m)]})}' +
  'if(g&&B[1]==="w3-close-escrow"){let a=A.finance.accounts[A.finance.sovereigns[g.key]?.militaryEscrowAccountId];a&&a.balanceBn===0&&(a.closed=!0)}';
const SPLIT_REPLACE = `return (g.key===${JSON.stringify(C_)}?(()=>{let w=X5(A,{moves:[{provIds:C.filter((x,i)=>i%2===0),to:A.playerKey},` +
  `{provIds:C.filter((x,i)=>i%2===1),to:${JSON.stringify(C2)}}]});return{ok:w.ok!==!1&&!!(w.touched&&w.touched.length)}})()` +
  ':A.transferProvinces(C,A.playerKey))?.ok?ZA(Q,!0,"territory.countryAnnexed"';
const instrument = text => {
  for (const f of [SPLIT_FIND, REGIONS_FIND]) if (text.split(f).length !== 2) throw new Error(`test instrumentation: ${f.slice(0, 40)} not found once`);
  return text.replace(REGIONS_FIND, REGIONS_REPLACE).replace(SPLIT_FIND, SPLIT_REPLACE);
};
// --w3-only (diagnostic): only the W3 patch, to separate its effect from the other patches'.
const w3Only = () => {
  const mods = loadMods(MODS_DIR, { only: ['geoplanetical-balance'] }).map(m => ({ ...m, patches: m.patches.filter(p => p.id === 'w3-conquest-debt-succession') }));
  return { sourceText: buildBundle(readFileSync(bundlePath(build, SIM), 'utf8'), mods, { build, bundle: SIM }).text, overrides: {} };
};
const modded0 = control ? null : process.argv.includes('--w3-only') ? w3Only() : moddedWorkerData(join(ROOT, '.modding', 'decompiled', `app-${build}`));
// --without-obligation-cancel (diagnostic, with --only-a): the W3 code without its step (2). Before build 26368058 the
// arrears case faulted there (economic-obligation:self-sale); since then the game's early retirement step retires the
// pairs with the heir first, so this diagnostic no longer isolates step (2) (w3.test.mjs covers that step; w3-early.test.mjs the early step).
const CANCEL = 'let y=__geobalW3Pairs(F,__gbSv,T);if(y.length){';
const modded = modded0 && process.argv.includes('--without-obligation-cancel')
  ? { ...modded0, sourceText: modded0.sourceText.split(CANCEL).length === 2 ? modded0.sourceText.replace(CANCEL, 'let y=[];if(y.length){') : (() => { throw new Error('cancel step not found'); })() }
  : modded0;
const sourceText = instrument(modded ? modded.sourceText : readFileSync(bundlePath(build, SIM), 'utf8'));
const overrides = modded ? modded.overrides : {};
const w = new Worker(fileURLToPath(new URL('../../../headless/prototype/bootstrap.mjs', import.meta.url)),
  { workerData: { bundlePath: bundlePath(build, SIM), sourceText, overrides }, resourceLimits: { maxOldGenerationSizeMb: 12000 } });
let id = 0, epoch = 0; const pending = new Map();
w.on('message', m => { if (m?.type === 'response') { const p = pending.get(m.requestId); pending.delete(m.requestId); epoch = m.sessionEpoch || epoch; m.ok ? p.res(m.payload) : p.rej(new Error(JSON.stringify(m.error).slice(0, 800))); } });
w.on('error', e => { console.error('WORKER ERROR', e.stack || e); process.exit(2); });
const req = (command, payload = {}) => new Promise((res, rej) => { const r = ++id; pending.set(r, { res, rej }); w.postMessage({ protocolVersion: 2, type: 'request', requestId: r, sessionEpoch: epoch, command, payload }); });

const BOOT = { playerKey: P, savePayload: null, seed: 12345,
  gameplayRules: { aiNuclearFirstUse: false, newPandemicEmergence: 'off', naturalDisasters: 'normal', aiWarDeclarations: true, worldBellicosity: 'normal' },
  playerControl: { partyId: 'SVP' } };
const DECODE = { gzip: zlib.gunzipSync, deflate: zlib.inflateSync, zstd: zlib.zstdDecompressSync };
const identity = p => { // what Electron's main process hands the page on load (electron/save-io.js:36-38)
  const raw = p.source === 'raw' || p.compression === 'identity' ? new Uint8Array(p.bytes) : DECODE[p.compression](new Uint8Array(p.bytes));
  return { id: p.id, compression: 'identity', rawBytes: raw.byteLength, bytes: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) };
};
let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const units = x => BigInt(Math.round((Number(x) || 0) * 1e8));
const near = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
const fmt = x => Number(x).toFixed(3);

// Snapshot view: finance part, accounts by id (rows: id, ownerType, ownerId, countryKey, currencyCode, kind, normal,
// balanceBn, ...), countries part.
const view = snap => {
  const f = part(snap, 'finance'), c = part(snap, 'countries'), acc = new Map();
  for (const r of f.accounts.rows) acc.set(r[0], { ownerType: r[1], ownerId: r[2], countryKey: r[3], currencyCode: r[4], kind: r[5], normal: r[6], bal: Number(r[7]) || 0 });
  return { snap, f, c, acc, bal: id => acc.get(id)?.bal ?? 0 };
};
const snapshot = async () => view(await req('save.snapshot'));
const annex = async key => (await req('domain.call', { methodId: 'executeDevConsoleCommand', args: [{ name: 'annex_country', args: [key] }] })).result;
const lotsOf = (v, key) => (v.f.sovereigns[key]?.lotIds || []).map(i => v.f.instruments[i]).filter(Boolean);
const positions = (v, lotId) => Object.values(v.f.positions[lotId] || {});
// Ledger sums the game keeps balanced: debit-normal minus credit-normal balances, in ledger units (1e-8 bn).
const trial = v => { let d = 0n; for (const a of v.acc.values()) d += a.normal === 'debit' ? units(a.bal) : -units(a.bal); return d; };
// Every non-equity instrument: positions sum to the quantity issued, in ledger units (the game's own m3 check).
const quantityErrors = v => Object.values(v.f.instruments).filter(i => i.type !== 'equity' && i.type !== 'equity_basket_unit' && i.unitFaceBn === 1)
  .filter(i => positions(v, i.id).reduce((s, p) => s + units(p.quantity), 0n) !== units(i.quantityIssued)).map(i => i.id);
// World totals: face of every active sovereign bond and every holder's book value in them.
const world = v => {
  let face = 0, book = 0;
  for (const i of Object.values(v.f.instruments)) {
    if (i.type !== 'sovereign_bond' || i.active === false) continue;
    face += Number(i.quantityIssued) || 0;
    for (const p of positions(v, i.id)) book += Number(p.bookValueBn) || 0;
  }
  return { face, book };
};
// Lot fingerprint for "kept": quantity issued, terms that matter, and the sorted holder positions (holder ids can
// change when the conquered country's banks pass to the conqueror, so positions compare as a multiset).
const keep = (v, lot) => ({ q: lot.quantityIssued, active: lot.active !== false, status: lot.terms?.defaultStatus,
  coupon: lot.terms?.couponRatePct, maturity: lot.terms?.maturityDay, ccy: lot.currencyCode,
  pos: positions(v, lot.id).map(p => `${(+p.quantity).toFixed(8)}/${(+p.bookValueBn).toFixed(8)}`).sort().join(',') });

// One conqueror: the conquered state's lots, liability and holders before and after.
async function conquerAlone(before, key, label) {
  const sov0 = before.f.sovereigns[key], heir0 = before.f.sovereigns[P];
  const lots0 = lotsOf(before, key), liab0 = before.bal(sov0.debtLiabilityAccountId), forg0 = before.bal(sov0.forgivenessIncomeAccountId);
  const res = await annex(key);
  const after = await snapshot();
  check(res?.ok === true && !after.c[key], `${label}: annex_country ${key} succeeds and the country is gone`, JSON.stringify(res).slice(0, 160));
  const face0 = lots0.reduce((s, l) => s + l.quantityIssued, 0);
  console.log(`  ${label}: ${lots0.length} lots, face ${fmt(face0)} bn, liability ${fmt(liab0)} bn, holders ${[...new Set(lots0.flatMap(l => positions(before, l.id).map(p => p.holderId.split(':')[0])))].join('/')}`);
  const heir = after.f.sovereigns[P], sov1 = after.f.sovereigns[key];
  const moved = lots0.map(l => after.f.instruments[l.id]);
  if (control) return { before, after, lots0, moved, liab0, forg0, sov0, heir0, heir, sov1 };
  check(moved.every(l => l && l.countryKey === P && l.issuerId === heir.id && l.terms.liabilityAccountId === heir.debtLiabilityAccountId && heir.lotIds.includes(l.id)),
    `${label}: every lot is now issued by ${P} and listed among its lots`);
  check(lots0.every((l, k) => JSON.stringify(keep(before, l)) === JSON.stringify(keep(after, moved[k]))),
    `${label}: every lot keeps its quantity, coupon, maturity, currency, status and every holder's quantity and book value`);
  check(moved.every(l => l.terms.defaultStatus !== 'written_off'), `${label}: no lot written off`);
  check((sov1?.lotIds || []).length === 0 && sov1?.successorCountryKey === P && sov1?.status === 'dissolved',
    `${label}: the dissolved treasury holds no lots and names ${P} as successor`);
  const liabP0 = before.bal(heir0.debtLiabilityAccountId), liabP1 = after.bal(heir.debtLiabilityAccountId);
  check(near(liabP1, liabP0 + liab0, 1e-9) && after.bal(sov0.debtLiabilityAccountId) === 0,
    `${label}: ${P}'s debt liability rose by the conquered liability`, `${fmt(liabP0)} + ${fmt(liab0)} -> ${fmt(liabP1)}`);
  check(after.bal(sov0.forgivenessIncomeAccountId) === forg0, `${label}: no retirement debt release booked (forgiveness income unchanged)`);
  return { before, after, lots0, moved };
}

const common = (before, after, label) => {
  const w0 = world(before), w1 = world(after);
  check(near(w0.face, w1.face, 1e-12) && near(w0.book, w1.book, 1e-12),
    `${label}: world sovereign bond face and holders' book value unchanged (nothing created or lost)`,
    `face ${fmt(w0.face)} -> ${fmt(w1.face)}, book ${fmt(w0.book)} -> ${fmt(w1.book)}`);
  check(trial(after) === trial(before), `${label}: ledger trial balance unchanged`, `${trial(before)} -> ${trial(after)} units`);
  const q = quantityErrors(after);
  check(q.length === 0, `${label}: every instrument's positions sum to its quantity`, q.slice(0, 3).join(', '));
};

try {
  await req('session.boot', BOOT);
  const s0 = await snapshot();
  console.log(`  baseline: trial ${trial(s0)} units, quantity errors ${quantityErrors(s0).length}`);
  if (onlySplit) {
    // Diagnostic: the split alone (with --control: on the unmodified game).
    let fault = null, res = null;
    try { res = await annex(C_); } catch (e) { fault = e.message; }
    console.log(`  split ${C_} between ${P} and ${C2} (${control ? 'unmodified' : 'modded'}): ${fault ? `FAULT ${fault.slice(0, 200)}` : JSON.stringify(res).slice(0, 120)}`);
    throw Object.assign(new Error('split diagnostic done'), { done: true });
  }
  // Open obligations: the save holds them as economic-obligations-table-v1 (rows of [shape, ...fields in shape
  // order]; ids as [string index, suffix]; payer and payee as indexes into `actors`).
  const obligations = v => {
    const t = v.f.economicObligations?.open, out = {};
    if (!t?.rows) return t || {};
    for (const r of t.rows) {
      const o = {};
      t.shapes[r[0]].forEach((k, i) => { o[k] = r[i + 1]; });
      o.id = Array.isArray(o.id) ? t.strings[o.id[0]] + o.id[1] : typeof o.id === 'number' ? t.strings[o.id] : o.id;
      o.payer = t.actors[o.payer]; o.payee = t.actors[o.payee];
      out[o.id] = o;
    }
    return out;
  };
  const arrears = v => { const o = obligations(v); return ['0', '1', '2'].map(n => o[`w3-test:arrears/${n}`] || null); };
  // F. Catalonia secedes from Spain (Catalonia owes Spain a succession bond held by Spain's treasury), then Spain is
  // annexed: the claim must pass to Switzerland (the game's integration succession would leave it with the dead
  // treasury, and the debtor's settlement oiA would write it off as a dead-creditor claim).
  const secedeThenAnnex = async before => {
    const sc = (await req('domain.call', { methodId: 'executeDevConsoleCommand', args: [{ name: 'secede', args: ['catalonia'] }] })).result;
    const mid = await snapshot(), child = sc?.data?.country?.key;
    const claims = child ? lotsOf(mid, child).filter(l => l.terms?.creditorCountryKey === '724') : [];
    const claim = claims[0], held0 = claim ? positions(mid, claim.id) : [];
    check(sc?.ok === true && claims.length === 1 && held0.length === 1 && held0[0].holderId === mid.f.sovereigns['724'].id,
      `F: Catalonia (${child}) secedes and owes Spain a succession bond held by Spain's treasury`, claim ? `${claim.id} ${fmt(claim.quantityIssued)} bn` : JSON.stringify(sc).slice(0, 160));
    const r = await conquerAlone(mid, '724', 'F Spain');
    return { ...r, mid, child, claimId: claim?.id, claimQ: claim?.quantityIssued };
  };
  const fx = (v, ids) => ids.every(i => v.f.instruments[i].terms.fx === (v.f.instruments[i].currencyCode !== v.f.sovereigns[P].currencyCode));
  const setup = async (key, what) => (await req('domain.call', { methodId: 'executeDevConsoleCommand', args: [{ name: 'regions', args: [key, what] }] })).result;
  if (process.argv.includes('--precheck-case')) {
    // E (own mode, day 0, no save after it: the game's own save validation rejects a closed treasury account). The
    // Netherlands' empty military escrow account is closed, a state exB would reject: the precheck must refuse,
    // leaving the game's write-off (control: the same write-off) and nothing half-moved.
    const e0 = s0, esc = e0.f.sovereigns['528'].militaryEscrowAccountId;
    check(e0.bal(esc) === 0, `E Netherlands: its military escrow account ${esc} is empty (precondition for closing it)`, String(e0.bal(esc)));
    await setup('528', 'w3-close-escrow');
    // Treasury arrears both ways with Switzerland and one with Germany: W3 refuses this takeover, so the rows its early
    // obligation step kept open must be retired right after, as the unmodified game does (none left on a dead treasury).
    await setup('528', 'w3-arrears');
    const eA = await snapshot();
    check(arrears(eA).map(o => o?.remainingBn).join() === '1.25,0.5,0.75', 'E Netherlands: setup arrears with Switzerland and Germany are open');
    const nl0 = lotsOf(e0, '528'), liabP0 = e0.bal(e0.f.sovereigns[P].debtLiabilityAccountId), book0 = world(e0).book;
    const res = await annex('528');
    const e1 = await snapshot();
    check(res?.ok === true && !e1.c['528'], 'E Netherlands (closed account): annexed without a fault', JSON.stringify(res).slice(0, 120));
    const nlTreasury = e0.f.sovereigns['528'].id, left = Object.values(obligations(e1)).filter(o => o.payer?.ownerId === nlTreasury || o.payee?.ownerId === nlTreasury);
    check(arrears(e1).every(o => o === null) && left.length === 0, 'E Netherlands: every arrear of the refused takeover is retired; no open obligation on the dead treasury',
      JSON.stringify(left.map(o => o.id)));
    const nl1 = nl0.map(l => e1.f.instruments[l.id]);
    // annex_country 528 also takes the Dutch Caribbean polities (provinces under Dutch sovereignty with their own
    // treasuries); they retire through the same path and their treasuries are fine, so their debt passes (modded).
    const others = Object.keys(e0.c).filter(k => k !== '528' && !e1.c[k] && e0.f.sovereigns[k]);
    const othersLiab = others.reduce((t, k) => t + e0.bal(e0.f.sovereigns[k].debtLiabilityAccountId), 0);
    const othersMoved = others.every(k => lotsOf(e0, k).every(l => e1.f.instruments[l.id].countryKey === (control ? k : P)));
    const liabP1 = e1.bal(e1.f.sovereigns[P].debtLiabilityAccountId);
    const detail = nl1.map(l => `${l.id} country ${l.countryKey} ${l.terms.defaultStatus}`).join('; ') +
      `; successor ${e1.f.sovereigns['528'].successorCountryKey}; also retired ${others.join('/')} (liability ${fmt(othersLiab)} bn); 756 liability ${fmt(liabP0)} -> ${fmt(liabP1)}`;
    check(nl1.length > 0 && nl1.every(l => l.countryKey === '528' && l.terms.defaultStatus === 'written_off') && !e1.f.sovereigns['528'].successorCountryKey &&
      othersMoved && near(liabP1, liabP0 + (control ? 0 : othersLiab), 1e-9),
      `E Netherlands: nothing of the Netherlands moved, the game wrote its debt off as before${control ? '' : '; the other retired polities\' debt passed'}`, detail);
    console.log(`  E Netherlands: holders' book value ${fmt(book0)} -> ${fmt(world(e1).book)} bn (the game's write-off)`);
    const swiss = v => Object.fromEntries(v.f.sovereigns[P].lotIds.map(i => [i, v.f.instruments[i]?.quantityIssued]));
    const s0l = swiss(e0), s1l = swiss(e1);
    console.log('  Swiss lots changed:', JSON.stringify(Object.keys(s1l).filter(i => s1l[i] !== s0l[i]).map(i => [i, s0l[i] ?? null, s1l[i], e1.f.instruments[i].terms?.creditorCountryKey ?? null])));
    check(trial(e1) === trial(e0) && quantityErrors(e1).length === 0, 'E Netherlands: trial balance unchanged, every instrument balances');
    throw Object.assign(new Error('precheck case done'), { done: true });
  }
  // Austria's treasury arrears with Switzerland (both ways) and Germany, checked to exist before the annex.
  const setupRes = await setup(A_, 'w3-arrears');
  const sA = await snapshot(), ar0 = arrears(sA);
  if (process.argv.includes('--probe-arrears')) {
    const open = sA.f.economicObligations?.open || {};
    console.log('setup result', JSON.stringify(setupRes).slice(0, 300));
    console.log('open obligations', Object.keys(open).length, Object.keys(open).filter(k => /w3|040/.test(k)).slice(0, 10));
    console.log('open keys', Object.keys(open), JSON.stringify(open).slice(0, 1500));
    throw Object.assign(new Error('probe done'), { done: true });
  }
  check(ar0.map(o => o?.remainingBn).join() === '1.25,0.5,0.75' && ar0[0].payer.ownerId === sA.f.sovereigns[A_].id && ar0[0].payee.ownerId === sA.f.sovereigns[P].id &&
    ar0[1].payer.ownerId === sA.f.sovereigns[P].id && ar0[2].payee.ownerId === sA.f.sovereigns['276'].id,
    'setup: Austria owes Switzerland 1.25 bn, Switzerland owes Austria 0.5 bn, Austria owes Germany 0.75 bn (open treasury obligations)');

  if (control) {
    const r = await conquerAlone(sA, A_, 'A control');
    const book0 = r.lots0.reduce((s, l) => s + positions(r.before, l.id).reduce((t, p) => t + p.bookValueBn, 0), 0);
    const book1 = r.moved.reduce((s, l) => s + positions(r.after, l?.id).reduce((t, p) => t + p.bookValueBn, 0), 0);
    check(r.moved.every(l => l && l.terms.defaultStatus === 'written_off' && l.countryKey === A_),
      'control (unmodified game): every Austrian lot is written off and stays with the dissolved treasury');
    check(book0 > 0 && book1 === 0, "control: the bondholders' book value is lost", `${fmt(book0)} bn -> ${fmt(book1)} bn`);
    check(near(r.after.bal(r.heir.debtLiabilityAccountId), r.before.bal(r.heir0.debtLiabilityAccountId), 1e-12),
      "control: Switzerland's debt liability is unchanged (it keeps the treasury, not the debt)");
    check(arrears(r.after).every(o => o === null), 'control: the retirement cancels all three test arrears (no crash)');
    const f = await secedeThenAnnex(r.after);
    const held = f.claimId ? positions(f.after, f.claimId) : [];
    check(held.length === 1 && held[0].holderId === f.mid.f.sovereigns['724'].id, "control: Spain's claim on Catalonia stays with Spain's dissolved treasury");
    await req('clock.advanceDays', { days: 31 });
    const s = await snapshot(), lot = f.claimId && s.f.instruments[f.claimId];
    console.log(`  control: 31 days later the claim is ${lot?.terms?.defaultStatus}, ${fmt(lot?.quantityIssued)} bn`);
    throw Object.assign(new Error('control done'), { done: true });
  }

  // A. Austria, one conqueror, with treasury arrears both ways with Switzerland and one with Germany.
  const a = await conquerAlone(sA, A_, 'A Austria');
  common(sA, a.after, 'A Austria');
  const ar = arrears(a.after);
  check(ar[0] === null && ar[1] === null, 'A Austria: the arrears between Austria and Switzerland are cancelled (no self-sale fault)');
  check(ar[2]?.payer?.ownerId === a.after.f.sovereigns[P].id && ar[2]?.payee?.ownerId === a.after.f.sovereigns['276'].id && ar[2]?.remainingBn === 0.75,
    'A Austria: the arrears to Germany pass to Switzerland (0.75 bn)', JSON.stringify(ar[2] && { payer: ar[2].payer.ownerId, payee: ar[2].payee.ownerId, remainingBn: ar[2].remainingBn }));
  check(fx(a.after, a.lots0.map(l => l.id)), "A Austria: inherited lots reclassified against the franc (EUR lot now foreign-currency debt)",
    a.lots0.map(l => `${l.id} ${l.currencyCode} fx ${a.after.f.instruments[l.id].terms.fx}`).join('; '));
  if (process.argv.includes('--only-a')) throw Object.assign(new Error('phase A only'), { done: true });

  // B. Czechia (own currency).
  const b = await conquerAlone(a.after, B_, 'B Czechia');
  common(a.after, b.after, 'B Czechia');
  check(fx(b.after, b.lots0.map(l => l.id)), 'B Czechia: inherited lots reclassified against the franc',
    b.lots0.map(l => `${l.id} ${l.currencyCode} fx ${b.after.f.instruments[l.id].terms.fx}`).join('; '));

  // F. Spain with its claim on Catalonia.
  const f = await secedeThenAnnex(b.after);
  common(f.mid, f.after, 'F Spain');
  {
    const held = f.claimId ? positions(f.after, f.claimId) : [], lot = f.claimId && f.after.f.instruments[f.claimId];
    check(held.length === 1 && held[0].holderId === f.after.f.sovereigns[P].id && lot?.terms?.creditorCountryKey === P && lot.quantityIssued === f.claimQ &&
      held[0].cashAccountId === f.after.f.sovereigns[P].cashAccountId,
      "F Spain: Spain's succession claim on Catalonia is now held by Switzerland's treasury, creditor Switzerland", `${fmt(f.claimQ)} bn`);
  }

  // A month of payments, then save and reload.
  const movedIds = [...a.lots0, ...b.lots0, ...f.lots0].map(l => l.id);
  await req('clock.advanceDays', { days: 31 });
  const s3 = await snapshot();
  {
    const lot = f.claimId && s3.f.instruments[f.claimId];
    check(lot?.terms?.defaultStatus === 'performing' && positions(s3, f.claimId)[0]?.holderId === s3.f.sovereigns[P].id,
      'after 31 days: the claim on Catalonia is performing and still Swiss (no dead-creditor write-off)', `${lot?.terms?.defaultStatus} ${fmt(lot?.quantityIssued)} bn`);
  }
  const live = movedIds.map(i => s3.f.instruments[i]);
  check(live.every(l => l && l.countryKey === P && positions(s3, l.id).length > 0 && l.terms.defaultStatus === 'performing'),
    'after 31 days: the moved lots are still Swiss, held and performing (coupons and amortisation ran)',
    live.map(l => `${l?.id} ${fmt(l?.quantityIssued)}`).join('; '));
  const paidDown = movedIds.reduce((s, i) => s + (b.after.f.instruments[i].quantityIssued - s3.f.instruments[i].quantityIssued), 0);
  console.log(`  amortisation paid on the moved lots in 31 days: ${fmt(paidDown)} bn`);
  check(quantityErrors(s3).length === 0, 'after 31 days: every instrument balances');
  await req('session.boot', { playerKey: P, savePayload: { formatVersion: 3, meta: s3.snap.meta, parts: s3.snap.artifact.parts.map(identity) } });
  const s4 = await snapshot();
  check(movedIds.every(i => JSON.stringify(keep(s3, s3.f.instruments[i])) === JSON.stringify(keep(s4, s4.f.instruments[i])) && s4.f.instruments[i].countryKey === P),
    'save then reload (passes the game\'s finance-save validation): moved lots, terms and holders carried');
  check(JSON.stringify(s4.f.sovereigns[P].lotIds) === JSON.stringify(s3.f.sovereigns[P].lotIds) &&
    s4.bal(s4.f.sovereigns[P].debtLiabilityAccountId) === s3.bal(s3.f.sovereigns[P].debtLiabilityAccountId),
    "save then reload: Switzerland's lot list and debt liability carried");

  // C. Slovenia split between Switzerland and Hungary in one transfer.
  const c0 = s4, sl = lotsOf(c0, C_), slFace = sl.reduce((s, l) => s + l.quantityIssued, 0);
  const pop0 = { [P]: c0.c[P].pop, [C2]: c0.c[C2].pop };
  const resC = await annex(C_);
  const c1 = await snapshot();
  check(resC?.ok === true && !c1.c[C_], 'C split: Slovenia annexed by two countries in one transfer', JSON.stringify(resC).slice(0, 120));
  const gained = { [P]: c1.c[P].pop - pop0[P], [C2]: c1.c[C2].pop - pop0[C2] };
  const heirKey = sl.length ? c1.f.instruments[sl[0].id]?.countryKey : null, other = heirKey === P ? C2 : P;
  const share = gained[other] / (gained[P] + gained[C2]);
  console.log(`  C split: ${sl.length} lots, face ${fmt(slFace)} bn; population taken ${P} ${fmt(gained[P])} M, ${C2} ${fmt(gained[C2])} M; heir ${heirKey}`);
  check(heirKey === (gained[P] >= gained[C2] ? P : C2) && sl.every(l => c1.f.instruments[l.id].countryKey === heirKey),
    'C split: the conqueror taking more population takes every lot');
  // With two recipients there is no private succession: the territory move splits the conquered households'
  // positions between the recipients' households (before the retirement, as in the unmodified game), so holders
  // change; each lot's totals and terms must not.
  const totals = (v, lot) => ({ ...keep(v, lot), pos: undefined, sumQ: positions(v, lot.id).reduce((t, p) => t + units(p.quantity), 0n).toString(),
    sumBook: positions(v, lot.id).reduce((t, p) => t + units(p.bookValueBn), 0n).toString() });
  const holderChange = sl.map(l => `${l.id}: ${positions(c0, l.id).length} -> ${positions(c1, l.id).length} holders`).join('; ');
  check(sl.every(l => JSON.stringify(totals(c0, l)) === JSON.stringify(totals(c1, c1.f.instruments[l.id]))),
    'C split: every lot keeps its quantity, terms and holders\' total quantity and book value', holderChange);
  const heirSov = c1.f.sovereigns[heirKey], otherSov = c1.f.sovereigns[other];
  const claimLots = otherSov.lotIds.filter(i => !c0.f.sovereigns[other].lotIds.includes(i)).map(i => c1.f.instruments[i]);
  const claim = claimLots[0];
  const held = claim && positions(c1, claim.id);
  check(claimLots.length === 1 && claim.terms.creditorCountryKey === heirKey && held.length === 1 && held[0].holderId === heirSov.id &&
    claim.currencyCode === otherSov.currencyCode,
    `C split: ${other} issued one succession bond to ${heirKey}'s treasury, in its own currency`, claim ? `${claim.id} ${claim.currencyCode} ${fmt(claim.quantityIssued)} bn` : 'none');
  // Shares as VXg's: population moved. Slovenia's net debt = its lots (no succession claims or IMF credit).
  check(!!claim && near(claim.quantityIssued, slFace * share, 0.01),
    `C split: the bond is ${other}'s population share of the debt taken over`, `${fmt(claim?.quantityIssued)} vs ${fmt(slFace)} x ${share.toFixed(4)} = ${fmt(slFace * share)}`);
  check(!!claim && near(c1.bal(otherSov.debtLiabilityAccountId) - c0.bal(c0.f.sovereigns[other].debtLiabilityAccountId), claim.quantityIssued, 1e-9),
    `C split: ${other}'s debt liability rose by the bond`);
  const w0 = world(c0), w1 = world(c1);
  check(near(w1.face, w0.face + (claim?.quantityIssued || 0), 1e-12) && near(w1.book, w0.book + (claim?.quantityIssued || 0), 1e-12),
    'C split: world bond face and book value change only by the new intergovernmental bond (both sides booked)',
    `face ${fmt(w0.face)} -> ${fmt(w1.face)}`);
  check(trial(c1) === trial(c0) && quantityErrors(c1).length === 0, 'C split: trial balance unchanged, every instrument balances');
  await req('clock.advanceDays', { days: 31 });
  const c2 = await snapshot();
  await req('session.boot', { playerKey: P, savePayload: { formatVersion: 3, meta: c2.snap.meta, parts: c2.snap.artifact.parts.map(identity) } });
  const c3 = await snapshot();
  check(!!claim && JSON.stringify(keep(c2, c2.f.instruments[claim.id])) === JSON.stringify(keep(c3, c3.f.instruments[claim.id])),
    'C split: 31 days later, save then reload carries the succession bond', claim ? `${fmt(c2.f.instruments[claim.id].quantityIssued)} bn` : '');
} catch (e) {
  if (!e.done) check(false, 'run', e.message);
}
await w.terminate();
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
