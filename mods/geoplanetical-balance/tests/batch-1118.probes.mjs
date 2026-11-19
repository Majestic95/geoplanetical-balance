// Probes for the 2026-11-18 batch: edits a normal headless run never reaches (coverage, .cache/fixes-overnight).
// Run by headless/prototype/probe-edits.mjs in one booted world (seed 12345, player 756) advanced --days 190 (IO15's probe was removed: IO15 is parked). Each `code` is an async function body evaluated in the simulation bundle's
// scope (26734764 names; Ogr.sim = the world). Every probe builds its precondition from real world objects and calls
// the game path the patch sits on; the decisive checks use the game's own functions, so a negative control (the
// patch's edits neutralised) fails on behaviour, not on a missing helper. CB8 runs last (its impact step changes a
// province). Test tooling only; never shipped.

export const probes = [
  {
    id: 'x3-earth-metal-price',
    edits: ['x3-lunar-metal-earth-price#1'],
    code: String.raw`
const e = Ogr.sim, t = e.countries.get(e.playerKey);
const v = qCa(e, t, { refined_space_metals: 1000 });
check(v > 0 && v < 0.05, '1000 t of returned metal valued at the Earth price (about 0.01 bn)', String(v));
check(w3t === 0.08, 'module-order credit per tonne unchanged (w3t = 0.08)', String(w3t));
return { value: v, w3t };
`,
  },
  {
    id: 'v24-departure-clamp',
    edits: ['v24-migration-clamp#1', 'v24-migration-clamp#2'],
    code: String.raw`
const e = Ogr.sim;
let threw = null, r = null;
try { r = kUt(e, [{ sourceRef: { kind: 'stateless', provinceKey: '__geobal_probe_missing__' }, actualAmountM: 1 }]); } catch (x) { threw = String(x.message || x); }
check(threw === null, 'a departure from a missing province does not throw', threw || '');
check(r === 0, 'nothing removed for a missing province', String(r));
let nm = null;
for (const p of e.world?.provByKey?.values?.() || []) if ((p.__polityKey || p.__countryKey) === '__nomans' && p.__pop > 0) { nm = p; break; }
let clamp = null;
if (nm) {
  const pop0 = nm.__pop; let t2 = null, r2 = null;
  try { r2 = kUt(e, [{ sourceRef: { kind: 'stateless', provinceKey: nm.__provKey }, actualAmountM: pop0 + 5 }]); } catch (x) { t2 = String(x.message || x); }
  check(t2 === null && Math.abs(r2 - pop0) < 1e-9 && nm.__pop === 0, 'a departure larger than the stateless population is clamped to it', JSON.stringify({ t2, r2, pop0, after: nm.__pop }));
  nm.__pop = pop0; clamp = { pop0, r2 };
}
// The monthly migration step (hHt): a stateless departure larger than its province holds is scaled down before it
// is applied (here the province does not exist, so to zero), instead of reaching the departure step at full size.
const flow = { kind: 'probe', sourceRef: { kind: 'stateless', provinceKey: '__geobal_probe_missing__' }, amountM: 1 };
let t3 = null;
try { hHt(e, [flow], 1); } catch (x) { t3 = String(x.message || x); }
check(t3 === null && flow.actualAmountM === 0, 'the migration step scales an impossible stateless departure to what the province holds', JSON.stringify({ t3, actual: flow.actualAmountM }));
return { r, clamp: clamp || 'no stateless province in this world', scaled: flow.actualAmountM };
`,
  },
  {
    id: 'n1-members-bound-and-released',
    edits: ['n1-un-sanctions-all-members#1', 'n1-un-sanctions-all-members#2'],
    code: String.raw`
const e = Ogr.sim;
const council = new Set(qee(e).map(String));
const target = [...e.countries.keys()].sort().find(k => k !== e.playerKey && !council.has(k) && kF(e.countries.get(k)) && !(e.sanctions || []).some(r => r.targetKey === k));
const nonCouncil = [...e.countries.keys()].sort().find(k => k !== target && k !== e.playerKey && !council.has(k) && kF(e.countries.get(k)) && Hc(e, k, k, 'diplomacy'));
const observer = [...e.countries.keys()].sort().find(k => k !== target && !kF(e.countries.get(k)) && Hc(e, k, k, 'diplomacy'));
const sponsor = [...council].sort().find(k => k !== target);
e.un.dossiers.push({ id: 'probe:n1:dossier', kind: 'aggression', warId: 'probe:n1:war', status: 'open', targetKey: target });
e.un.resolutions.push({ id: 'probe:n1:res', type: 'sanctions', status: 'draft', targetKey: target, sponsorKey: sponsor, dossierId: 'probe:n1:dossier', voteDay: e.day, decisionIds: {} });
const orig = cqa; let adopted = null;
try { cqa = () => 'yes'; adopted = syo(e, 'probe:n1:res'); } finally { cqa = orig; }
check(adopted === true, 'the probe resolution is adopted (every Council member votes yes)', String(adopted));
const reg = (e.sanctions || []).find(r => r.sourceTypeId === 'un_resolution' && r.sourceId === 'probe:n1:res');
const parts = new Set((reg?.participants || []).map(p => String(p.countryKey)));
check(!!reg && parts.has(nonCouncil), 'a UN member outside the Council is bound', JSON.stringify({ nonCouncil, n: parts.size }));
check(!observer || !parts.has(observer), 'a non-member (observer) is not bound', String(observer));
check(!parts.has(String(e.playerKey)), 'the player, who did not vote, is not bound');
check(reg?.initiatorKey === sponsor, 'the sponsor is recorded as initiator', JSON.stringify({ init: reg?.initiatorKey, sponsor }));
Zg(e);
const after = new Set((reg?.participants || []).map(p => String(p.countryKey)));
check(!after.has(nonCouncil) && [...after].every(k => council.has(k)), 'when the war is over, the members bound only by this rule are released; yes voters stay', JSON.stringify({ left: after.size }));
return { target, sponsor, nonCouncil, observer, bound: parts.size, after: after.size };
`,
  },
  {
    id: 'p20-first-year-refused',
    edits: ['p20-snap-presidential-guards#1'],
    code: String.raw`
const e = Ogr.sim, a = e.player, inst = st(a), day = VD(e.day);
if (xee(e, a.pol)) return { skipped: 'reform freeze active' };
const org = Ve(a, 'head_of_state');
const off = inst.offices?.[org];
check(!!off, 'the player has a head-of-state office', String(org));
const offSaved = off ? { ...off } : null, contests0 = inst.contests;
inst.offices = { ...inst.offices, [org]: { ...off, mandate: { ...(off?.mandate || {}), startedDay: day - 100 } } };
const contest = { id: 'probe:p20', type: 'office', targetOrganId: 'head_of_state', termYears: 5, nextDay: day + 1500 };
inst.contests = { ...contests0, 'probe:p20': contest };
// The election step itself is replaced for the probe (the constructed contest is not a real transition), so the
// decisive check is that the guard refuses before the game reaches it.
const onPres = e._onPresidential; let reached = false;
e._onPresidential = () => { reached = true; return { ok: false, reason: 'probe' }; };
let r = null, threw = null;
try { r = xGa(e, 'probe:p20'); } catch (x) { threw = String(x.message || x); } finally { e._onPresidential = onPres; }
check(threw === null && r === false && !reached, 'a snap presidential election 100 days into the mandate is refused by the first-year guard, before the election step', JSON.stringify({ r, threw, reached }));
check(inst.contests['probe:p20']?.nextDay === day + 1500, 'the scheduled vote is unchanged');
inst.contests = contests0; inst.offices = { ...inst.offices, [org]: offSaved };
return { org, r, day };
`,
  },
  {
    id: 'cb8-yield-and-reliability',
    edits: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `cb8-warhead-yield-reliability#${n}`), // #11 (the retaliation decision NVa) needs a pending exchange decision: covered by tests/cb8.test.mjs only
    code: String.raw`
const e = Ogr.sim;
const factor = k => { const d = hM[e.countries.get(k)?.forces?.nuclear?.design]; if (!d) return null; const y = Number(d.yieldKt), r = Number(d.reliability); return { area: y > 0 ? Math.pow(y / 300, 2 / 3) : 1, rel: r > 0 && r <= 1 ? r : 1 }; };
const att = [...e.countries.keys()].sort().find(k => { const f = factor(k); return f && Ar(e.countries.get(k).forces.nuclear) > 0 && (Math.abs(f.area - 1) > 0.05 || f.rel < 0.99); });
check(!!att, 'a nuclear power whose warhead design is not the 300 kt reference', String(att));
if (!att) return { skipped: 'no attacker' };
const A = e.countries.get(att);
const tgt = [...e.countries.keys()].sort((x, y) => (e.countries.get(y).pop || 0) - (e.countries.get(x).pop || 0)).find(k => k !== att && d5(e, k)?.provinceKeys?.length);
const f = factor(att);
const plan = XNe(e, tgt, 3, { actorKey: att });
const unscaled = plan.reduce((s, n) => s + lvo(n.pf.__pop || 0, ivo(n.pf), n.w), 0);
const scaled = plan.reduce((s, n) => s + lvo(n.pf.__pop || 0, ivo(n.pf), n.w, f.area, f.rel), 0);
const fc = Ov(e, tgt, 3, { actorKey: att });
check(Math.abs(fc - scaled) <= 1e-9 * Math.max(1, scaled) && Math.abs(fc - unscaled) > 1e-6 * Math.max(1, unscaled), 'the strike forecast scales with the design yield and reliability', JSON.stringify({ fc, scaled, unscaled, f }));
const list = lVa(e, tgt, 3, { actorKey: att });
check(Math.abs(list.reduce((s, x) => s + x.deaths, 0) - fc) <= 1e-9 * Math.max(1, fc), 'the per-city forecast list matches the forecast');
const ob = uVa(e, { targets: [{ key: tgt, warheads: 2 }] }, { actorKey: att });
check(Array.isArray(ob.outbound) && ob.outbound.every(o => Number.isFinite(o.deaths)), 'the strike plan computes deaths', JSON.stringify({ n: ob.outbound?.length, reason: ob.reasonId }));
const ex = fVa(e);
check(ex.outbound.every(o => Number.isFinite(o.deaths)), 'the exchange forecast computes deaths', String(ex.outbound.length));
// The AI's other forecasts: a guarantor's reply cost (f9t), a victim's received deaths (AVa) and the preview exchange
// (BVa -> TVa) now carry the attacker's design.
const sumFor = (key, w, k) => XNe(e, key, w, {}).reduce((s, n) => s + lvo(n.pf.__pop || 0, ivo(n.pf), n.w, k ? f.area : 1, k ? f.rel : 1), 0);
const g = f9t(e, e.countries.get(tgt), 'none', att);
check(!(g.replyWarheads > 0) || Math.abs(g.deathsM - sumFor(tgt, g.replyWarheads, true)) <= 1e-9 * Math.max(1, g.deathsM) && Math.abs(g.deathsM - sumFor(tgt, g.replyWarheads, false)) > 1e-9, 'a guarantor weighs the reply of the attacker with its design', JSON.stringify({ w: g.replyWarheads, d: g.deathsM }));
const ord = AVa(e, { id: 'probe:cb8:ex', orderSeq: 0, orders: [] }, { id: 'probe:cb8:strike', actorKey: att }, tgt, { warheads: 3, byPolity: new Map([[tgt, 3]]) });
check(Math.abs(ord.receivedDeathsM - sumFor(tgt, 3, true)) <= 1e-9 * Math.max(1, ord.receivedDeathsM) && Math.abs(ord.receivedDeathsM - sumFor(tgt, 3, false)) > 1e-9, 'received deaths of a victim use the attacker design', JSON.stringify({ d: ord.receivedDeathsM, scaled: sumFor(tgt, 3, true), unscaled: sumFor(tgt, 3, false) }));
const pv = BVa(e, att, [{ key: tgt, warheads: 2 }]);
check(Number.isFinite(pv.deaths) && pv.deaths >= 0, 'the exchange preview computes deaths with the designs', JSON.stringify(pv.deaths));
let impact = null;
if (ob.outbound?.length) { const s = { ...ob.outbound[0], attackerKey: att }; try { impact = dVa(e, s); } catch (x) { impact = { error: String(x.message) }; } }
check(!impact || impact.error == null, 'the strike impact runs with the scaled deaths', JSON.stringify(impact?.error || impact?.impact?.deaths));
return { att, tgt, f, fc, unscaled, planned: ob.outbound?.length || 0, impactDeaths: impact?.impact?.deaths ?? null };
`,
  },
];
