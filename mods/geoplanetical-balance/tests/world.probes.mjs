// World probes for edits a 12-month headless run never reaches (X7, Y9 panel, VW1). Run by
// headless/prototype/probe-edits.mjs in one booted world (new game, day 0); code uses build 26734764's names (Ogr.sim);
// names and offsets in comments are those of 26519199.
// Order: VW1 (read-only), Y9 (perturbs two fields and restores them), X7 (adds a lunar site, polity, operator, contract).
// Keep every check detail small: bootstrap truncates the serialized result at 4000 characters.
export const probes = [
  {
    id: 'vw1-energy-view-no-power-refresh',
    edits: ['vw1-energy-view-refresh#1'],
    code: String.raw`
// VW1 edit 1. Unmodded, _playerProvinces (sim class yar@14870841, method @14875595) ran qV@10781334 on its first call
// after a reset, and qV replaces every player province's __power with a new object and rewrites __wLoad. The Energy
// view reaches it through the host: viewSnapshot -> LTe@15394781 (Pe.ENERGY) -> znr@15230440 -> e._playerProvinces().
// On 26734764 no view calls it (app.bundle.js has no reference); its callers are the player's own commands: Z3t@13003035
// (plant on a province), Aka@13003278 (first statement) and Nmr@16160134 (province power lever). The probe opens the
// Energy view (no refresh expected) and then makes the call those commands make, the first one after a reset.
const e = Ogr.sim, P = e.player;
check(!!P?.energy, 'player country has an energy record, so the unmodded path would run qV', { player: e.playerKey });
// The state every reset leaves (gTe@15103593 restore, territory change @13607627, control change @8820869).
e._playerProvs = null;
const provs = (e.world.provinces || []).filter(p => Oi(p, e.playerKey));
const refs = provs.map(p => p.__power), loads = provs.map(p => p.__wLoad);
const dump = () => JSON.stringify(provs.map(p => [p.__provKey, p.__power ?? null, p.__wLoad ?? null]));
const before = dump();
const snap = await Ogr.viewSnapshot({ viewId: Me.ENERGY });
const kept = provs.filter((p, i) => p.__power === refs[i] && p.__wLoad === loads[i]).length;
check(!!snap && snap.player?.key === e.playerKey, 'Energy view built through the host snapshot', { viewId: Me.ENERGY, day: snap?.day });
check(provs.length > 0 && kept === provs.length, 'no province __power object or __wLoad replaced by opening the view',
  { provinces: provs.length, untouched: kept, withPowerBefore: refs.filter(Boolean).length });
check(dump() === before, '__power contents (capacity, ownerKey, loadShare, plants) unchanged', { bytes: before.length });
const list = e._playerProvinces();   // as Aka/Z3t/Nmr call it, first call since the reset
const kept2 = provs.filter((p, i) => p.__power === refs[i] && p.__wLoad === loads[i]).length;
check(kept2 === provs.length && dump() === before, 'first _playerProvinces call after a reset leaves __power and __wLoad as they were',
  { provinces: provs.length, untouched: kept2 });
check(Array.isArray(e._playerProvs) && e._playerProvs === list && list.length === provs.length, '_playerProvinces only filtered and cached',
  { cached: e._playerProvs?.length });
return { provinces: provs.length, sample: provs[0] ? { key: provs[0].__provKey, loadShare: provs[0].__power?.loadShare ?? null } : null };
`,
  },
  {
    id: 'y9-territory-panel-own-economy',
    edits: ['y9-territory-own-economy#1', 'y9-territory-own-economy#3'],
    code: String.raw`
// Y9 edits 1 and 3. The question panel row s5o@13973867 (built for the regional view by NUa@13975361) calls
// Dmt@12963671 with the first living sovereign (O5t@13957592). Patched, unemployment, its baseline and civil liberties
// come from the question's polity (economyActor); war still from the sovereign. Questions are seeded at boot
// (BF@13975506 -> IUa). Test: raise one actor's unemployment by 8 points, read the row, restore the exact value.
const e = Ogr.sim, day = e.day || 0, reg = OU(e);
if (!check(!!reg, 'regional questions seeded at boot')) return null;
const qs = Object.values(reg.questions).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const hasBase = c => Number.isFinite(Number(c?.domestic?.baseline?.unemployment)) && Number.isFinite(Number(c?.unemployment));
const isTerritory = q => !q.outcomeId && q.polityKey && !q.sovereignKeys.includes(q.polityKey) &&
  hasBase(e.countries.get(q.polityKey)) && hasBase(rPt(e, q));
// Since 1.1.5 (kpt@12668370 -> Mpt@12657683) a polity whose social groups carry satisfaction baselines gets economy 0
// and a living_conditions cause from its own satisfaction instead; Y9's economyActor path applies to a polity without
// that data. Prefer such a territory; with none, check 1.1.5's rule instead (economy stays 0 for the territory).
const hasGroups = c => (c?.pops?.groups || []).some(g => g.share > 0 && Number.isFinite(g.sat) &&
  Number.isFinite(c.domestic?.baseline?.groups?.[g.id]?.satisfaction));
const noGroups = x => isTerritory(x) && !hasGroups(e.countries.get(x.polityKey));
const q = qs.find(x => x.id === 'puerto_rico' && noGroups(x)) || qs.find(noGroups) || qs.find(isTerritory);
const ctrl = qs.find(x => !x.outcomeId && !x.polityKey && hasBase(rPt(e, x)));
if (!check(!!q && !!ctrl, 'a territory question (polity is a country) and a no-polity control', { territory: q?.id, control: ctrl?.id })) return null;
const T = e.countries.get(q.polityKey), S = rPt(e, q), S2 = rPt(e, ctrl);
const orig = [T.unemployment, S.unemployment, S2.unemployment];
const row = x => YRo(e, x, '');   // viewer '' : observer row, no verb evaluation (i5o returns [])
const econ = r => (r.causes.find(c => c.causeId === 'economy') || { value: 0 }).value;
// Dmt's economy term for a given actor (Is clamp, H2 rounding to 1e-6).
const expect = (a, x) => { const n = Math.max(0, Number(a.unemployment) - Number(a.domestic.baseline.unemployment));
  return Math.round(Math.max(0, Math.min(1, n / 8)) * (.5 + Number(x.identity) * .5) * .18 * 1e6) / 1e6; };
const bump = (c, fn) => { const u0 = c.unemployment; try { c.unemployment = u0 + 8; return fn(); } finally { c.unemployment = u0; } };
const r0 = row(q);
const [rT, wantT] = bump(T, () => [row(q), expect(T, q)]);
const rS = bump(S, () => row(q));
const c0 = row(ctrl);
const [rC, wantC] = bump(S2, () => [row(ctrl), expect(S2, ctrl)]);
const restored = [T.unemployment, S.unemployment, S2.unemployment].every((u, i) => u === orig[i]);
if (day === 0) check(!r0.causes.some(c => c.causeId === 'economy' || c.causeId === 'liberties'),
  'day 0: no economy or liberties cause (measured against the polity\'s own baseline)', { causes: r0.causes });
if (!hasGroups(T)) check(Math.abs(econ(rT) - wantT) < 1e-6 && econ(rT) > econ(r0), 'territory unemployment +8 moves its economy cause (reads the polity)',
  { territory: q.polityKey, got: econ(rT), want: wantT, before: econ(r0) });
else check(econ(rT) === 0 && econ(r0) === 0, 'no territory without group satisfaction data: its economy cause stays 0 (the 1.1.5 rule)',
  { territory: q.polityKey, got: econ(rT), before: econ(r0) });
check(econ(rS) === econ(r0), 'sovereign unemployment +8 leaves the territory economy cause alone',
  { sovereign: S.key, got: econ(rS), before: econ(r0), sovereignWouldGive: bump(S, () => expect(S, q)) });
check(Math.abs(econ(rC) - wantC) < 1e-6 && econ(rC) > econ(c0), 'no-polity question still reads its sovereign (unchanged)',
  { control: ctrl.id, sovereign: S2.key, got: econ(rC), want: wantC, before: econ(c0) });
check(restored, 'perturbed unemployment restored exactly', { orig });
return { day, territory: q.id, polity: q.polityKey, polityHasGroupData: hasGroups(T), sovereign: S.key, identity: q.identity,
  unemployment: { territory: [T.unemployment, T.domestic.baseline.unemployment], sovereign: [S.unemployment, S.domestic.baseline.unemployment] } };
`,
  },
  {
    id: 'x7-expired-concession-returns-site',
    edits: ['x7-concession-expiry-return#1'],
    code: String.raw`
// X7 edit 1: the expiry loop in e4a@11461497 (monthly space tick, called by uha@11691012). On 26519199 nothing in the
// game issues a concession (F_e's callers O4a@11524369 and Pga@11614217 pass delivery / service_capacity only), so the
// concession is signed by calling F_e@11453844 directly, on a site built by the game's own functions as the scenario
// helper alr@15403379 does: H_e@11471894 (site + administration + public operator), P$@11503830 (polity, charter
// closed), b4a@11509139 (charter open, which F_e requires), Wp@11446974 (buyer operator of another country),
// jya@11447551 -> L_e (sponsor capital so the buyer can escrow; on 26734764 aSa = t2t check + QRe transfer). F_e clamps the deadline to day+1, so the one contract
// created here is back-dated by a day; e4a then expires it. Space is empty at day 0 (nst@11468555), so e4a's other
// loops only see the two operators made here (unless an earlier probe added space objects; counts in the detail).
const e = Ogr.sim, day = e.day || 0, owner = e.playerKey;
const pre = { operators: e.space.operators.size, sites: e.space.sites.size,
  activeContracts: [...e.space.contracts.values()].filter(c => c.status === 'active').length };
const bodyId = 'moon';   // 26519199's Fp() returned the first playable body, the Moon; 1.1.5 has no such helper (Mars is playable too)
const free = (e.world?.bodies?.[bodyId]?.provinces || []).filter(p => hJ(e, bodyId, p.__region).state === 'free')
  .sort((a, b) => a.__region - b.__region)[0];
if (!check(!!free, 'a free region on the Moon', { bodyId })) return pre;
const site = dEe(e, owner, { bodyId, regionId: free.__region });
if (!check(!!site?.operatorId, 'H_e founded a site with its operator', { site: site?.id, operator: site?.operatorId })) return pre;
const polity = wJ(e, site.id);
const charter = polity && sPa(e, e.countries.get(owner), polity.id, { settlementRights: 'open' });
if (!check(!!charter?.ok && polity.charter.settlementRights === 'open', 'site polity chartered open', { polity: polity?.id, charter })) return pre;
const buyerKey = ['250', '276', '826', '392'].find(k => k !== owner && e.countries.has(k));
const buyer = e.countries.get(buyerKey), op = ff(e, buyerKey, bodyId);
const fund = op && aSa(e, buyer, op.id, 0.1);   // 1.1.5 split the old jya: t2t only validates, aSa validates then transfers (QRe)
if (!check(!!fund?.ok, 'buyer operator capitalised by its sponsor', { buyer: buyerKey, operator: op?.id, fund })) return pre;
const made = eEe(e, buyer, { kind: 'concession', buyerRef: 'operator:' + op.id, sellerRef: 'operator:' + site.operatorId,
  originLocationId: site.id, quantity: 1, unitPriceBn: 0.05 });
const c = made?.contract;
if (!check(!!made?.ok && c?.kind === 'concession' && site.operatorId === op.id && c.previousOperatorId === site.legalOwnerOperatorId,
  'concession signed: buyer now operates the site', { made: made?.ok ? 'ok' : made, siteOperator: site.operatorId,
    previous: c?.previousOperatorId, deadline: c?.deadlineDay })) return pre;
c.deadlineDay = day - 1;   // past its deadline (F_e floor is day+1)
const buyerCash = () => xP(e, c.buyerRef).balance();
const cash0 = buyerCash();
mSa(e);
check(c.status === 'failed' && c.closedDay === day, 'contract closed as failed on the day, as before', { status: c.status, closedDay: c.closedDay });
check(site.operatorId === c.previousOperatorId && site.operatorId !== op.id,
  'expired concession hands the site back to its previous operator (unmodded: buyer keeps it)',
  { siteOperator: site.operatorId, previous: c.previousOperatorId, legalOwner: site.legalOwnerOperatorId, buyerOperator: op.id });
return { day, pre, bodyId, region: free.__region, site: site.id, contract: c.id, escrowBn: 0.05,
  buyerRefundBn: Math.round((buyerCash() - cash0) * 1e9) / 1e9 };
`,
  },
];
