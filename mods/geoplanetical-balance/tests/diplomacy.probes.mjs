// Probes for diplomacy and intelligence edits a normal headless run never reaches (IO5, IO22, LC17, I3).
// Run by headless/prototype/probe-edits.mjs in one booted world (day 0, seed 12345, player 756); each `code` is an async
// function body evaluated in the simulation bundle's scope (game functions by their 26734764 names, Ogr.sim = the world;
// names and offsets in comments are those of 26519199).
// Every probe builds its own precondition from real world objects and touches only the countries/objects it picks.
// Test tooling only; never shipped.

// Shared trade setup for the IO22 and IO5 probes (prepended to each, so each probe stays self-contained at run time).
const TRADE = String.raw`
const e = Ogr.sim;
const tariffable = id => jXe.includes(id);
// pbo (26519199 @14690243) as the unmodded game ran it, without the IO22 filter, on goods aggregated in Ea order.
const rankAll = (t, byGood) => [...byGood].map(([n, i]) => { const s = ge.goods.find(c => c.id === n), l = tGo[s?.sector] ?? aGo;
  return { goodId: n, value: i, score: i * l / (rGo + yGo(t, s)) }; }).filter(n => n.value > 0).sort((n, i) => i.score - n.score || K(n.goodId, i.goodId));
// One pass over the live trade flows: what R sells to each partner (pbo's sum) and buys from each (W4t's max(0, value)).
function flowsOf(R) {
  const out = new Map(), inn = new Map(), add = (m, k, g, v) => { let x = m.get(k); x || m.set(k, x = new Map()); x.set(g, (x.get(g) || 0) + v); };
  for (const f of nr(e) || []) {
    if (f.exporterActorId === R) add(out, f.importerActorId, f.goodId, f.tradeValue);
    else if (f.importerActorId === R) add(inn, f.exporterActorId, f.goodId, Math.max(0, f.tradeValue || 0));
  }
  return { out, inn };
}
// A fresh AI complainant against R: no exclusive trade authority (gbo would go through a mandate), patron not R, no open dispute.
function eligible(R, C) {
  const c = e.countries.get(C);
  if (!c || C === R || e.playerControlsGovernment(C) || ls(e, C) || c.brain?.patron === R) return false;
  return ![...e.tradePolicy.disputes.values()].some(d => !['settled', 'closed'].includes(d.status) &&
    (Xe(e, d.complainantPartyId).includes(C) || Xe(e, d.respondentPartyId).includes(C)));
}
// R's tariff on C's good g through the command dispatcher (Ee -> trade.enactAct -> FWa), which opens the dispute (D3e -> bPt).
// The clock is not advanced: the dispute is moved to action_due exactly as the day-30 pass IPt does, and only when PPt holds.
function tariffAndDispute(R, C, g, rate) {
  const res = Te(e, e.countries.get(R), { verb: 'trade.enactAct', draft: { customName: null,
    clauses: [{ targetPartyIds: [pSt(e, C)], scopeId: 'custom', goodIds: [g], ratePct: rate, noticeDays: 0, durationDays: null }] } });
  if (!res?.ok) return { res };
  const d = (res.disputeIds || []).map(id => e.tradePolicy.disputes.get(id)).find(x => x && x.complainantPartyId === pSt(e, C));
  if (!d) return { res };
  const due = AVt(e, d, d.responseDueDay);
  if (due) { d.status = 'action_due'; d.history.push({ day: d.responseDueDay, kind: 'consultations_expired' }); }
  return { res, d, due };
}
const retaliationAct = (C, d) => [...e.tradePolicy.acts.values()].find(a => a.sponsorKey === C &&
  a.clauses.some(x => x.legalBasis === 'retaliation' && x.causeDisputeId === d.id));
`;

export const probes = [
  {
    // IO22: Norway-style case. The player's tariff on a partner whose largest purchase from the player is a service; the AI
    // partner's retaliation (gbo -> fbo -> mbo -> pbo) must now rank goods only, validate, and be enacted.
    id: 'io22-ai-retaliation-goods-only',
    edits: ['io22-retaliation-tariffable-goods#1'],
    code: TRADE + String.raw`
const R = e.playerKey;
check(Array.isArray(nr(e)) && !ls(e, R), 'precondition: trade flows loaded and the player has no exclusive trade authority', { flows: nr(e)?.length ?? null });
let { out, inn } = flowsOf(R), pick = null;
for (const C of ['578', ...[...e.countries.keys()].sort(K)]) {
  if (!eligible(R, C) || !out.has(C) || !inn.has(C)) continue;
  const all = rankAll(e.countries.get(C), out.get(C));
  if (!all.length || tariffable(all[0].goodId) || !all.some(x => tariffable(x.goodId))) continue;
  // The tariffed good is worth no more than the top service, so the unmodded draft stops at that service alone.
  const g = [...inn.get(C)].filter(([id, v]) => tariffable(id) && v > 0 && v <= all[0].value).sort((a, b) => b[1] - a[1] || K(a[0], b[0]))[0];
  if (g) { pick = { C, g: g[0] }; break; }
}
check(!!pick, 'precondition: a partner whose top-ranked purchase from the player is a service', { R });
if (!pick) return null;
const { C, g } = pick, cty = e.countries.get(C);
const { res, d, due } = tariffAndDispute(R, C, g, 10);
check(!!d && due, 'precondition: the player tariff opened a real dispute, now action_due', { act: res?.actId ?? res?.reason, dispute: d?.id, harmBnY: d?.harmBnY });
if (!d) return { C, g };
({ out } = flowsOf(R));
const all = rankAll(cty, out.get(C) || new Map());
const src = e.tradePolicy.acts.get(d.sourceActId);
const rate = Math.max(0, ...d.claimRefs.map(r => src.clauses.find(x => x.id === r.clauseId)?.ratePct || 0));
// The unmodded draft: mbo's loop over the unfiltered ranking, then the game's own validator (_yo -> Iyo -> cze).
let goods0 = [], sum = 0;
for (const f of all) { goods0.push(f.goodId); sum += f.value; if (sum * rate / 100 >= d.harmBnY) break; }
const v0 = nAo(e, cty, { customName: null, clauses: [{ targetPartyIds: [d.respondentPartyId], scopeId: 'custom', goodIds: goods0,
  ratePct: Math.min(rate, d.harmBnY / sum * 100), noticeDays: 0, durationDays: oGo, legalBasis: 'retaliation', causeDisputeId: d.id }] });
check(!v0.ok && v0.errors.some(x => x.reason === 'no_goods'), 'unmodded draft: the top service only, refused by the validator (no_goods)',
  { goods0, tier: ge.goods.find(x => x.id === goods0[0])?.tier, reason: v0.reason });
// Patched: the ranking keeps goods only, in the unmodded order and scores.
const listP = hGo(e, cty, new Set(Xe(e, d.respondentPartyId)), new Set(Xe(e, d.complainantPartyId)));
const want = all.filter(x => tariffable(x.goodId));
check(listP.length > 0 && listP.every(x => tariffable(x.goodId)) && JSON.stringify(listP) === JSON.stringify(want),
  'IO22: the AI ranks tariffable goods only, same order and scores', { patched: listP.slice(0, 3).map(x => x.goodId), unmoddedTop: all.slice(0, 3).map(x => x.goodId) });
const clauses = vGo(e, cty, [d]), vP = nAo(e, cty, { customName: null, clauses });
check(vP.ok, 'IO22: the patched retaliation draft passes the same validator', { goods: clauses.flatMap(x => x.goodIds), rate: clauses[0]?.ratePct, reason: vP.reason });
const enacted = SGo(e, cty), act = retaliationAct(C, d), rc = act?.clauses.find(x => x.causeDisputeId === d.id);
check(enacted === true && !!rc && d.status === 'retaliated' && d.retaliationActId === act.id, 'IO22: the AI retaliation is enacted and the dispute is retaliated',
  { enacted, act: act?.id, status: d.status });
check(!!rc && rc.goodIds.length > 0 && rc.goodIds.every(tariffable), 'IO22: the enacted clause carries tariffable goods only', { goods: rc?.goodIds });
return { R, C, tariffed: g, harmBnY: d.harmBnY, topService: all[0] && { id: all[0].goodId, value: all[0].value } };
`,
  },
  {
    // IO5: a fresh AI retaliation (own pair, own dispute) has no end date and stays in force past the old 730 days.
    id: 'io5-retaliation-no-end-date',
    edits: ['io5-retaliation-lasts#1'],
    code: TRADE + String.raw`
const R = e.playerKey;
check(Array.isArray(nr(e)) && !ls(e, R), 'precondition: trade flows loaded and the player has no exclusive trade authority', { flows: nr(e)?.length ?? null });
const { out, inn } = flowsOf(R);
let pick = null;
for (const C of [...e.countries.keys()].sort(K)) {
  if (!eligible(R, C) || !out.has(C) || !inn.has(C)) continue;
  if (!rankAll(e.countries.get(C), out.get(C)).some(x => tariffable(x.goodId))) continue;
  const g = [...inn.get(C)].filter(([id, v]) => tariffable(id) && v > 0).sort((a, b) => b[1] - a[1] || K(a[0], b[0]))[0];
  if (g) { pick = { C, g: g[0] }; break; }
}
check(!!pick, 'precondition: a partner with tariffable trade both ways', { R });
if (!pick) return null;
const { C, g } = pick, cty = e.countries.get(C);
const { res, d, due } = tariffAndDispute(R, C, g, 10);
check(!!d && due, 'precondition: the player tariff opened a real dispute, now action_due', { act: res?.actId ?? res?.reason, dispute: d?.id, harmBnY: d?.harmBnY });
if (!d) return { C, g };
const clauses = vGo(e, cty, [d]);
check(clauses.length > 0 && clauses.every(x => x.legalBasis === 'retaliation' && x.durationDays === null),
  'IO5: the AI retaliation draft (mbo) has no duration', { durationDays: clauses.map(x => x.durationDays), unmodded: oGo });
const enacted = SGo(e, cty), act = retaliationAct(C, d), rc = act?.clauses.find(x => x.causeDisputeId === d.id);
check(enacted === true && !!rc && rc.expiresDay === null && rc.status === 'active' && d.status === 'retaliated',
  'IO5: the enacted retaliation clause has no end date', { enacted, act: act?.id, expiresDay: rc?.expiresDay, status: rc?.status });
if (!rc) return { C, g };
const end0 = rc.activeDay + oGo;
check(MVt(rc, end0) && MVt(rc, rc.activeDay + 3650), 'IO5: the game activity test keeps it in force at activeDay+730 and +3650', { activeDay: rc.activeDay, end0 });
check(!MVt({ ...rc, expiresDay: end0 }, end0), 'contrast: the unmodded clause (expiresDay = activeDay + 730) is out of force that day', { end0 });
return { R, C, tariffed: g, goods: rc.goodIds, ratePct: rc.ratePct };
`,
  },
  {
    // LC17: a real Security Council resolution (pQ -> m2t), a real pledge from an accepted unVoteMatch letter (k1o option,
    // D1o -> fEe), then the creditor votes otherwise: the debtor is released (mMa) and the pledge lapses at the vote (oao -> o2t).
    id: 'lc17-un-pledge-released-by-creditor',
    edits: ['lc17-un-pledge-creditor-vote#1', 'lc17-un-pledge-creditor-vote#2', 'lc17-un-pledge-creditor-vote#3'],
    code: String.raw`
const e = Ogr.sim, VOTES = ['yes', 'no', 'abstain'];
const seats = qee(e), pc = k => !!e.playerControlsGovernment(k);
// Only f2t writes a resolution vote, for the player holding a seat; otherwise an AI creditor's vote is written the same way.
const playerSeat = seats.includes(e.playerKey) && pc(e.playerKey);
const screen = T => ({ id: 'probe:lc17-screen', type: 'condemnation', targetKey: T, victimKey: null, joined: [], votesByCountry: {} });
let pick = null;
for (const T of [...e.countries.keys()].sort(K)) {
  if (seats.includes(T) || T === e.playerKey) continue;
  if (e.un.dossiers.some(d => d.status === 'open' && d.targetKey === T) || e.un.resolutions.some(r => r.status === 'draft' && r.targetKey === T)) continue;
  const s = screen(T), v = new Map(seats.map(k => [k, cqa(e, CF(e, k), s)]));
  for (const P of playerSeat ? [e.playerKey] : seats.filter(k => !pc(k))) {
    const D = seats.find(k => k !== P && !pc(k) && v.get(k) !== v.get(P));
    if (D) { pick = { T, P, D }; break; }
  }
  if (pick) break;
}
check(!!pick, 'precondition: two council members who would vote differently on a condemnation', { seats: seats.length, playerSeat });
if (!pick) return null;
const { T, P, D } = pick;
const dossier = Fee(e, { kind: 'annexation', targetKey: T, victimKey: null, provinceCount: 1 });
const R = e.un.resolutions.find(r => r.status === 'draft' && Jg(r).includes(dossier?.id));
check(!!R && R.type === 'condemnation', 'precondition: the dossier drafted a real resolution', { dossier: dossier?.id, res: R?.id, type: R?.type, sponsor: R?.sponsorKey });
if (!R) return null;
const opt = owo(e, { countryKey: P }, { countryKey: D }).find(o => o.subjectRef.entityId === String(R.id));
const vP = opt?.terms?.requestedVote, vD = opt?.quote?.baselineVote;
check(!!opt && vP !== vD, 'precondition: the letter asks the debtor for the creditor vote, unlike its own', { T, P, D, vP, vD });
if (!opt || vP === vD) return null;
const hp = Zt(e, CF(e, P)), hd = Zt(e, CF(e, D));
const kase = { id: 'ccase:probe-lc17', actId: 'unVoteMatch', kind: 'proposal', subjectRef: opt.subjectRef, terms: opt.terms, quote: opt.quote,
  from: { personId: hp?.id || 'probe:creditor', countryKey: P, partyId: null }, to: { personId: hd?.id || 'probe:debtor', countryKey: D, partyId: null } };
const acc = dwo(e, kase), eng = acc?.ok ? qLa(e)[acc.engagementId] : null;
check(!!eng && eng.type === 'un_vote_pledge' && eng.status === 'active' && eng.promisedVote === vP && eng.creditorCountryKey === P,
  'precondition: the accepted letter created an active pledge', { acc: acc?.engagementId || acc?.reason });
if (!eng) return null;
const found = G6t(e, R.id, D);
check(found?.engagementId === eng.id && found.vote === vP && found.creditorKey === P, 'LC17 edit 1: the pledge lookup returns the creditor', found);
const bound = cqa(e, CF(e, D), R);
check(bound === vP, 'LC17 edit 3: creditor has not voted, the debtor votes as pledged', { bound, vP });
const vP2 = VOTES.find(x => x !== vP && x !== vD), byPlayer = P === e.playerKey;
if (byPlayer) $6t(e, R.id, vP2); else R.votesByCountry[P] = vP2;
check(Z6t(R, P) === vP2, 'precondition: the creditor stored vote now differs from the promise', { vP2, byPlayer });
const released = cqa(e, CF(e, D), R);
check(released === vD && released !== vP, 'LC17 edit 3: creditor voted otherwise, the debtor votes its own way', { released, vD, vP });
const tie = () => _d(e, eng.from.personId, eng.to.personId).trust, trust0 = tie();
syo(e, R.id);
const vote = k => R.votes.find(x => x.countryKey === k)?.vote;
check(R.status !== 'draft' && vote(D) === vD && vote(P) === vP2, 'the resolution was voted: debtor own way, creditor otherwise', { status: R.status, D: vote(D), P: vote(P) });
check(eng.status === 'lapsed' && eng.actualVote === undefined && eng.settledDay != null, 'LC17 edit 2: the pledge lapses at the vote, not broken', { status: eng.status });
check(tie() === trust0, 'LC17 edit 2: no trust lost by the debtor', { trust0, trust1: tie(), brokenDelta: Lee?.broken?.trust,
  people: !!(e.people?.has?.(eng.from.personId) && e.people?.has?.(eng.to.personId)) });
return { T, P, D, res: R.id, vP, vD, vP2, byPlayer, engagement: eng.id };
`,
  },
  {
    // I3: a joint dismantle of a foreign cell (UMe = the domain method launchJointIntelligenceOperation: g9a check, LVr
    // launch) checks and charges the sponsor's covert branch; a joint trace still checks foreign.
    id: 'i3-joint-dismantle-covert',
    edits: ['i3-joint-dismantle-branch#1', 'i3-joint-dismantle-branch#2'],
    code: String.raw`
const e = Ogr.sim, M = 'dismantle_foreign_cell', need = Wq(M), pneed = Math.max(2, Math.ceil(need / 2));
const svc = k => e.intelligence?.services?.[k], free = (k, dom) => Lq(e, k)?.available?.[dom] || 0;
const busy = (id, k) => [...e.intelligence.operations.values()].some(o => o.status === 'active' && o.targetKind === 'foreign_cell' && o.targetActorId === id && o.targetCountryKey === k);
// The partner is the group's host state (as the AI's Z9o picks it); the sponsor is the country the cell sits in (g9a).
const actors = [...(e.nonStateActors?.values?.() || [])].filter(a => a?.status === 'active' && a.hostKey && e.countries.has(a.hostKey) &&
  svc(a.hostKey) && free(a.hostKey, 'counter') >= pneed).sort((a, b) => K(String(a.id), String(b.id)));
let pick = null;
for (const a of actors) {
  for (const cell of Object.values(a.international?.cellsByCountry || {}).sort((x, y) => K(x.countryKey, y.countryKey))) {
    const C = cell.countryKey;
    if (C !== a.hostKey && e.countries.has(C) && svc(C) && !busy(a.id, C) && free(C, 'covert') >= need) { pick = { a, C, created: false }; break; }
  }
  if (pick) break;
}
// No usable cell yet (cells grow from monthly projects): create one with the game's own cell builder (iVr, as sVr does).
if (!pick) for (const a of actors) {
  const C = [...e.countries.keys()].sort(K).find(k => k !== a.hostKey && svc(k) && !busy(a.id, k) && free(k, 'covert') >= need);
  if (C) { jC(e, a); V1o(e, a, { countryKey: C, provinceKey: null }); pick = { a, C, created: true }; break; }
}
check(!!pick, 'precondition: a foreign cell, its host as partner, both with free agents', { actors: actors.length });
if (!pick) return null;
const { a, C } = pick, H = a.hostKey, sponsor = e.countries.get(C);
let row = F4t(e, C, a.id, C), raised = null;
if (!row || cOe(row) < .5) { raised = aO(e, a.id, C, .6, C); row = F4t(e, C, a.id, C); }
check(!!row && cOe(row) >= .48, 'precondition: the sponsor knows the cell well enough to dismantle it', { conf: row ? cOe(row) : null, raised: raised?.ok ?? null, created: pick.created });
const params = { partnerKey: H, actorId: a.id, countryKey: C };
// Test-only spy on the free-agent check, restored below: records which branch g9a asks about.
const realUue = Hpe, seen = [];
let spied = false;
try { Hpe = function (w, t, dom, m) { seen.push(m + ':' + dom); return realUue.apply(this, arguments); }; spied = Hpe !== realUue; } catch (err) { spied = false; }
let trace, res, declined = null, rd0, pr0, used0;
try {
  trace = LKa(e, sponsor, { ...params, mission: 'trace_foreign_cell' }, false);
  rd0 = { ...svc(C).readiness }; pr0 = { ...svc(H).readiness }; used0 = { ...Lq(e, C).used };
  res = uOe(e, sponsor, { ...params, mission: M });
  if (!res.ok && res.reason === 'partner_declined') {
    declined = { score: res.acceptanceScore, threshold: res.acceptanceThreshold };
    const q = LKa(e, sponsor, { ...params, mission: M }, false);
    res = q.ok ? Cdo(e, q) : q;
  }
} finally { if (spied) Hpe = realUue; }
check(spied && seen.includes(M + ':covert') && !seen.includes(M + ':foreign') && seen.includes('trace_foreign_cell:foreign'),
  'I3 edit 1: the dismantle checks covert agents, the trace still foreign', { spied, seen: [...new Set(seen)], trace: trace?.ok || trace?.reason });
check(!!res?.ok, 'the joint dismantle launched', { reason: res?.reason, declined, sponsor: C, partner: H, actor: a.id });
const op = res?.ok ? e.intelligence.operations.get(res.operationId) : null;
const cl = x => Math.max(0, Math.min(1, x)), rd1 = svc(C).readiness, pr1 = svc(H).readiness;
check(!!op && Math.abs(rd1.covert - cl(rd0.covert - .1)) < 1e-12 && rd1.foreign === rd0.foreign,
  'I3 edit 2: covert readiness -0.1, foreign untouched', { before: rd0, after: { foreign: rd1.foreign, counter: rd1.counter, covert: rd1.covert } });
check(!!op && Math.abs(pr1.counter - cl(pr0.counter - .12)) < 1e-12, 'partner counter-intelligence readiness -0.12, as before', { before: pr0.counter, after: pr1.counter });
const fl = Lq(e, C);
check(!!op && op.mission === M && fl.used.covert === used0.covert + op.staffAgents && fl.used.foreign === used0.foreign && !fl.overcommitted.includes('covert'),
  'the agents are booked on the covert branch the launch checked', { staff: op?.staffAgents, used0, used1: fl.used, overcommitted: fl.overcommitted });
return { sponsor: C, partner: H, actor: a.id, created: pick.created, op: op?.id ?? null, declined };
`,
  },
];
