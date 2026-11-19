// Targeted probes for war edits a 12-month headless run never reaches (code ported to game build 26734764).
// Run with: node --max-old-space-size=6000 headless/prototype/probe-edits.mjs mods/geoplanetical-balance/tests/war.probes.mjs
// Each `code` runs in the modded bundle's scope in one booted day-0 world, in this order. LC6 starts a real
// Turkey-Greece war (kept: P5 reads it); E4 damages two real plants (kept); AX11 and LC2 restore what they touch.
// Code uses 26734764 names (session host Ogr.sim); names and offsets in comments are those of 26519199. Test tooling only; never shipped.

export const probes = [
  {
    // E4: hnt (war hit, @10775954) and Lpa (sabotage hit, @10776001) both call Npa (@10775354), whose patched tail
    // calls __geobalWarRepair -> dd (treasury payment, @4909831). Paid amount = delta of the owner's expense account
    // for purpose war_repair (FP, @4905450); nothing else posts during a synchronous probe.
    id: 'e4-war-repair',
    edits: ['e4-war-repair-cost#1', 'e4-war-repair-cost#2'],
    code: String.raw`
const S = Ogr.sim, day = S.day || 0, pk = S.playerKey;
const capex = P => Math.max(0, Number(So[P.src] && So[P.src].capex) || 0);
const cost = (P, O, d) => capex(P) * d * (Number(P.capacityGW) || 0) * XKe(S, O, P.src);
const acct = O => qI(S, O, 'expense', 'war_repair');
const near = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
const owner = P => S.countries.get(P.owner);
const usable = P => !(Number(P.warDamage) > 0) && !P._warRepairDay && Number(P.capacityGW) > 0 && capex(P) > 0 &&
  P.owner !== pk && !!owner(P) && !!acct(owner(P));
const plants = [...S.plants.values()];

// Case A: a real nuclear plant whose owner is not in default. War hit to 0.5, sabotage to 1, then a hit with no
// added damage. Effect: owner pays added damage x GW x capex x local multiplier (ECe); full destruction = capex x GW x m.
const PA = plants.find(P => usable(P) && P.src === 'nuclear' && !owner(P).defaulted) || plants.find(P => usable(P) && !owner(P).defaulted);
if (!check(!!PA, 'a real undamaged plant with a capital cost, owner not in default')) return null;
const OA = owner(PA), gw = Number(PA.capacityGW), mult = XKe(S, OA, PA.src);
const out = { plant: PA.id, src: PA.src, owner: PA.owner, gw, capex: capex(PA), mult };
const x0 = acct(OA).balanceBn, cash0 = Ka(S, OA);
cst(S, PA, 0.5);
const x1 = acct(OA).balanceBn, k1 = cost(PA, OA, 0.5);
check(k1 > 0 && near(x1 - x0, k1), 'war hit 0 -> 0.5: owner pays 0.5 x GW x capex x multiplier (expense, war_repair)', { paidBn: x1 - x0, expectedBn: k1 });
check(PA._warRepairDay === day + gSe(0.5), 'paid in full: repair day as the game sets it', { repairDay: PA._warRepairDay, gameDay: day + gSe(0.5) });
lda(S, PA, 0.6);
const x2 = acct(OA).balanceBn;
check(PA.warDamage === 1 && near(x2 - x1, cost(PA, OA, 0.5)), 'sabotage hit 0.5 -> 1: only the added 0.5 is charged', { paidBn: x2 - x1, expectedBn: cost(PA, OA, 0.5), damage: PA.warDamage });
check(near(x2 - x0, capex(PA) * gw * mult), 'fully destroyed: total = capex x GW x multiplier', { totalBn: x2 - x0, perGW: (x2 - x0) / gw, cashBefore: cash0, cashAfter: Ka(S, OA) });
cst(S, PA, 0.5);
check(acct(OA).balanceBn === x2, 'a hit on a destroyed plant adds no damage: no further charge', { extraBn: acct(OA).balanceBn - x2 });
out.paidBn = x2 - x0;

// Case B: an owner that cannot pay in full. Prefer one in default at day 0 whose cash is below the cost of a full
// destruction; otherwise set defaulted on such an owner for this one call (restored). Effect: it pays the cash it has,
// and the repair takes longer by the unpaid share of the game's repair time, never more than twice that time.
const cands = plants.filter(P => usable(P) && P.owner !== PA.owner);
let PB = cands.find(P => owner(P).defaulted && Ka(S, owner(P)) < cost(P, owner(P), 1)), forced = false;
if (!PB) { PB = cands.find(P => Ka(S, owner(P)) < cost(P, owner(P), 1)); forced = !!PB; }
if (check(!!PB, 'a real plant whose owner cannot pay a full destruction', PB ? { plant: PB.id, owner: PB.owner, inDefaultAtStart: !forced } : null)) {
  const OB = owner(PB), had = Object.prototype.hasOwnProperty.call(OB, 'defaulted'), old = OB.defaulted;
  const y0 = acct(OB).balanceBn, cashB = Ka(S, OB), kB = cost(PB, OB, 1);
  try { if (forced) OB.defaulted = true; cst(S, PB, 1); }
  finally { if (forced) { if (had) OB.defaulted = old; else delete OB.defaulted; } }
  const paid = acct(OB).balanceBn - y0, u = cashB > 0 ? (kB - cashB) / kB : 1, base = day + gSe(1);
  const want = Math.min(base + Math.ceil(u * gSe(1)), day + 2 * gSe(1));
  check(near(paid, cashB), 'cannot borrow: pays the cash it has', { paidBn: paid, cashBn: cashB, costBn: kB, cashAfter: Ka(S, OB) });
  check(Math.abs(PB._warRepairDay - want) <= 1 && PB._warRepairDay > base && PB._warRepairDay <= day + 2 * gSe(1),
    'unpaid share lengthens the repair, capped at twice the game repair time', { repairDay: PB._warRepairDay, expected: want, gameDay: base });
  out.shortfall = { plant: PB.id, src: PB.src, owner: PB.owner, forcedDefault: forced, costBn: kB, paidBn: paid, repairDay: PB._warRepairDay, gameRepairDay: base };
}
return out;
`,
  },
  {
    // AX11: jlo (@13111002, AI war-plan step; called by Ulo @13111525) takes the war-on-player branch when the
    // target's defence authority is the player, and now refuses an attacker lacking defence or diplomacy power (qe,
    // @877761) before calling w1e (@12828978, the declaration). w1e is stubbed for this probe so the control attacker
    // cannot start a real war on the player; restored in finally. Plan object: the fields jlo reads from r.objective.
    id: 'ax11-defence-authority',
    edits: ['ax11-defence-authority#1'],
    code: String.raw`
const S = Ogr.sim, pk = S.playerKey, PL = S.countries.get(pk);
const warsBefore = S.wars ? [...S.wars.keys()] : [];
check(wd(S, pk, 'defense')[0] === pk, 'precondition: the player holds its own defence, so jlo takes the war-on-player branch', wd(S, pk, 'defense'));
const others = [...S.countries.values()].filter(c => c.key !== pk);
let subj = others.find(c => !He(c, 'defense') && He(c, 'diplomacy')) || others.find(c => !He(c, 'defense')), built = false, saved;
const ctl = others.find(c => c !== subj && He(c, 'defense') && He(c, 'diplomacy'));
if (!subj) {
  // No subject state in this world: give a real country the game's own protected_state profile (aM) for this call.
  subj = others.find(c => c !== ctl && He(c, 'defense'));
  saved = subj.constitutional; built = true;
}
const plan = { objective: { warGoalType: 'coercion', targetProvinceKeys: [], statusProfileId: null } };
const real = sfe; let calls = 0, stubbed = false, r1 = null, r2 = null, n1 = null, n2 = null;
try {
  sfe = function () { calls++; return false; };
  stubbed = sfe !== real;
  if (built) subj.constitutional = Object.assign({}, saved || {}, { competencies: fA.protected_state.competencies, relationPrincipalKey: ctl ? ctl.key : '' });
  if (stubbed) {
    r1 = K9o(S, subj, PL, plan); n1 = calls;
    if (ctl) { r2 = K9o(S, ctl, PL, plan); n2 = calls - n1; }
  }
} finally { sfe = real; if (built) subj.constitutional = saved; }
check(stubbed && sfe === real, 'declaration function stubbed for the probe and restored');
check(!!r1 && r1.ok === false && r1.reasonId === 'declaration', 'attacker without defence authority: jlo returns the usual declaration refusal',
  { attacker: subj.key, constructedProfile: built, result: r1 });
check(n1 === 0, 'refused before the declaration function was called', { declarationCalls: n1 });
const warsAfter = S.wars ? [...S.wars.keys()] : [];
check(warsAfter.length === warsBefore.length, 'no war on the player started', { before: warsBefore.length, after: warsAfter.length });
check(!!ctl && n2 === 1 && r2 && r2.ok === false, 'control: an attacker holding both powers still reaches the declaration (stub refuses it)', { control: ctl && ctl.key, declarationCalls: n2 });
return { attacker: subj.key, attackerDiplomacy: built ? false : He(subj, 'diplomacy'), constructedProfile: built, control: ctl && ctl.key };
`,
  },
  {
    // LC6: Cft (@13107687, AI declares war on an AI) -> o7 preview -> jle (@10227831) raises one call per treaty
    // member and resolves each AI call with yV (@10231488); QKo (@15293524) is the player's decision view of a call.
    // Setup: Turkey (792) attacks Greece (300), both NATO (the 1974 case in the effect text), after a real bilateral pact
    // Greece-France is added with the game's own treaty constructor Ob (@10221504), so France is called through two
    // treaties and one excludes the attacker (edit 7). Clones of real calls (shape: the call object jle builds), put back
    // to pending, go through yV and QKo as a player's decision would. The war, pact and clones are kept.
    id: 'lc6-ally-attacks-ally',
    edits: ['lc6-ally-attacks-ally#3', 'lc6-ally-attacks-ally#4', 'lc6-ally-attacks-ally#6', 'lc6-ally-attacks-ally#7', 'lc6-ally-attacks-ally#8', 'lc6-ally-attacks-ally#9'],
    code: String.raw`
const S = Ogr.sim, pk = S.playerKey, day = S.day || 0;
const T = id => S.militaryTreaties.get(id);
const nato = [...S.militaryTreaties.values()].find(t => t.nameId === 'nato');
if (!check(!!nato, 'the seeded NATO treaty exists')) return null;
const ok = k => k !== pk && S.countries.has(k);
const pairs = [['792', '300']];
for (const a of nato.members) for (const r of nato.members) if (a !== r && pairs.length < 25) pairs.push([a, r]);
let war = null, A, D, M, pact = null, gBefore = {}, natoViol0 = 0;
// Edit 6: record each call's breach flag at the moment jle settles it (yV, @10231488), which is what the costs and
// the war entry read; the final flag alone cannot tell the old edit 6 from the new one (edit 7 merges it later).
const atSettle = {}, yV0 = JQ;
JQ = (e, id, resp) => { const c = e.militaryCalls && e.militaryCalls.get(id); if (c && !(c.warId + '|' + c.memberKey in atSettle)) atSettle[c.warId + '|' + c.memberKey] = { breach: c.memberBreach, treaties: c.treatyIds.length }; return yV0(e, id, resp); };
try {
for (const [ak, dk] of pairs) {
  if (!ok(ak) || !ok(dk)) continue;
  A = S.countries.get(ak); D = S.countries.get(dk);
  if (!He(A, 'defense') || !He(A, 'diplomacy') || !He(D, 'diplomacy') || ha(S, ak, dk)) continue;
  M = ['250'].concat(nato.members).find(k => k !== ak && k !== dk && ok(k) && nato.members.includes(k) && G7a(S, k));
  if (!M) continue;
  pact = CP(S, { kind: 'defensive_alliance', nameId: 'probe_bilateral_pact', members: [dk, M], clauses: Object.assign({}, W1t), credibility: 0.85 });
  if (!pact) continue;
  gBefore = JSON.parse(JSON.stringify((D.brain && D.brain.grudges) || {}));
  natoViol0 = nato.violations.length;
  const res = Z7t(S, A, D, {});
  if (res && res.ok) { war = res.war; break; }
  S.militaryTreaties.delete(pact.id); pact = null;
}
} finally { JQ = yV0; }
if (!check(!!war, 'an AI-vs-AI war between two NATO members started (Cft)', war ? { war: war.id, attacker: A.key, defender: D.key, pactMember: M, pact: pact.id } : null)) return null;
const conflict = wl(S, war.id), calls = [...S.militaryCalls.values()].filter(c => c.warId === war.id);
const inAll = c => c.treatyIds.every(id => ((T(id) && T(id).members) || []).includes(A.key));
const tally = {}; for (const c of calls) tally[c.response] = (tally[c.response] || 0) + 1;
check(calls.length > 0, 'jle raised defence calls', { calls: calls.length, responses: tally });

// Edits 6 and 7: a call is a breach exactly when the attacker is in every treaty behind it.
const wrong = calls.filter(c => !!c.memberBreach !== inAll(c)).map(c => c.memberKey);
check(wrong.length === 0, 'memberBreach set iff the attacker is in every treaty behind the call', { wrong });
const mc = calls.find(c => c.memberKey === M);
const settled = atSettle[war.id + '|' + M] || {}, settledFlag = settled.breach, order = bh(S, D.key).map(t => t.id);
check(settledFlag === false && settled.treaties === 2 && order.indexOf(nato.id) < order.indexOf(pact.id),
  'edits 6, 9: the pact member is settled with both treaties on its call and no breach, although the treaty with the attacker is listed first', { settledFlag, treatiesOnCall: settled.treaties, order: [nato.id, pact.id].map(id => order.indexOf(id)), spied: Object.keys(atSettle).length });
check(!!mc && mc.treatyIds.includes(pact.id) && mc.treatyIds.includes(nato.id) && mc.memberBreach === false,
  'member also bound by a pact without the attacker: merged across both treaties, not a breach', mc && { member: M, treatyIds: mc.treatyIds, memberBreach: mc.memberBreach, response: mc.response });

// AI members in breach (edit 2 via the preview): no further than access; edit 8: access does not enter the war;
// edit 3: no defense_refused violation and no grudge from the defender for any breach answer.
const breach = calls.filter(c => c.memberBreach);
const tooFar = breach.filter(c => c.response !== 'access' && c.response !== 'refuse').map(c => c.memberKey + ':' + c.response);
check(breach.length > 0 && tooFar.length === 0, 'breach calls answered access or refuse only', { breach: breach.length, tooFar });
const entered = breach.filter(c => conflict.participants[c.memberKey]).map(c => c.memberKey + ':' + conflict.participants[c.memberKey].role);
check(entered.length === 0, 'no breach member entered the war', { entered, accessAnswers: breach.filter(c => c.response === 'access').length });
const newViol = nato.violations.slice(natoViol0).filter(v => v.kind === 'defense_refused' && breach.some(c => c.memberKey === v.memberKey));
check(newViol.length === 0, 'no defense_refused violation recorded for a breach member', { newViol: newViol.length });
const gNow = (D.brain && D.brain.grudges) || {};
const grudged = breach.filter(c => JSON.stringify(gNow[c.memberKey]) !== JSON.stringify(gBefore[c.memberKey])).map(c => c.memberKey);
check(grudged.length === 0, 'defender holds no new grudge against a breach member (no standing cost)', { grudged });

// The pact member is not a breach, so its answer carries full force. This discriminates the old edit 6 only when the
// member answers access or refuse; the at-settlement check above covers every answer.
const mResp = mc && mc.response, mPart = conflict.participants[M];
const mViol = [nato, pact].some(t => t.violations.some(v => v.kind === 'defense_refused' && v.memberKey === M && v.day === day));
const full = mResp === 'join' ? !!mPart && mPart.role === 'cobelligerent' : mResp === 'support' ? !!mc.supportId :
  mResp === 'access' ? !!mPart && mPart.role === 'support' : mResp === 'refuse' ? mViol : false;
check(full, 'pact member answered with full force (join: cobelligerent; support: programme; access: enters as support; refuse: violation)',
  { member: M, response: mResp, role: mPart ? mPart.role : null, violation: mViol, grudgeBefore: gBefore[M] || null, grudgeAfter: gNow[M] || null });

// Player decision path on clones of a real breach call (same object shape as jle's): QKo shows no credibility cost
// below full support (edit 4); yV refuse and access charge nothing and access stays out of the war (edits 3, 8).
const clone = (c, extra) => { const x = Object.assign({}, c, { id: Tao(S), status: 'pending', response: null, supportId: null, decisionId: null, treatyIds: c.treatyIds.slice() }, extra || {}); delete x.resolvedDay; return x; };
const free = breach.filter(c => !conflict.participants[c.memberKey]);
const B = free[0], C = free[1];
if (!check(!!B && !!C, 'two breach members outside the war to test the decision path', { free: free.length })) return { tally };
const qB = zQo(S, clone(B)).credibilityDelta, qN = zQo(S, clone(B, { memberBreach: false })).credibilityDelta;
check(qB && qB.access === 0 && qB.refuse === 0 && qB.join === eRe('join') && qB.support === eRe('support'), 'decision screen, breach: access and refuse cost no credibility', qB);
check(qN && qN.access === eRe('access') && qN.refuse === eRe('refuse') && qN.access < 0, 'decision screen, outside attacker (control): access and refuse still cost', qN);
const rec = () => Number(nato.credibilityRecord) || 0, grudge = k => JSON.stringify(gNow[k]);
const rec0 = rec(), viol0 = nato.violations.length, gB0 = grudge(B.memberKey);
const c1 = clone(B); S.militaryCalls.set(c1.id, c1); const y1 = JQ(S, c1.id, 'refuse');
const c2 = clone(B); S.militaryCalls.set(c2.id, c2); const y2 = JQ(S, c2.id, 'access');
check(y1.ok && y2.ok && rec() === rec0 && nato.violations.length === viol0 && grudge(B.memberKey) === gB0,
  'breach member refuses, then grants access: no credibility, violation or standing cost', { member: B.memberKey, recBefore: rec0, recAfter: rec(), violations: nato.violations.length - viol0 });
check(!conflict.participants[B.memberKey], 'breach member granting access stays out of the war', { member: B.memberKey, role: conflict.participants[B.memberKey] ? conflict.participants[B.memberKey].role : null });
// Control: the same call with memberBreach false (an outside attacker) still costs credibility and enters as support.
// An outside attacker means one in none of the call's treaties (edit 3 charges only treaties without the attacker).
const outsider = [...S.countries.keys()].find(k => k !== D.key && k !== C.memberKey && !C.treatyIds.some(id => ((T(id) && T(id).members) || []).includes(k)));
const rec1 = rec(), c3 = clone(C, { memberBreach: false, aggressorKey: outsider }); S.militaryCalls.set(c3.id, c3); const y3 = JQ(S, c3.id, 'access');
const pC = conflict.participants[C.memberKey];
check(y3.ok && Math.abs(rec() - rec1 - eRe('access')) < 1e-9 && !!pC && pC.role === 'support', 'control (not the patch): access to an outside attacker costs credibility and enters as support',
  { member: C.memberKey, recDelta: rec() - rec1, expected: eRe('access'), role: pC ? pC.role : null });
return { war: war.id, attacker: A.key, defender: D.key, pactMember: M, calls: calls.length, tally, pactMemberResponse: mResp };
`,
  },
  {
    // P5/W6: tZr (@12138333) tallies a country's wars for approval (Mue @12141761) and stability (kue @12143789) via
    // bZ (@12141600). Patched, it also returns weight (aggressor 1, every other fighting member 0.7) and rally (directly
    // attacked principal of a war begun during play: 6 x 0.5^(days/90); none for wars with days before day 0).
    // Edit 1 is the header declaring both accumulators (no counter): checked through tZr's result and the war rows.
    // Uses the war LC6 started if present, else starts one with Cft between two countries no defence treaty covers.
    id: 'p5-w6-war-opinion',
    edits: ['p5-w6-war-opinion#1'],
    code: String.raw`
const S = Ogr.sim, pk = S.playerKey, day = S.day || 0;
const near = (a, b) => Math.abs(a - b) < 1e-9;
const live = k => eh(S, k).filter(o => o.status !== 'ended' && Oo(o, k));
const expect = k => {
  let w = 0, r = 0;
  for (const o of live(k)) {
    const f = o.aggressorKey === k, as = o.participants[o.aggressorKey] && o.participants[o.aggressorKey].side, me = o.participants[k];
    w += f ? 1 : 0.7;
    if (!f && me.role === 'principal' && as && me.side !== as && !(Number(o.preT0DurationDays) > 0)) r = Math.max(r, 6 * Math.pow(0.5, Math.max(0, day - (Number(o.startDay) || 0)) / 90));
  }
  return { w, r };
};
const fresh = o => o.status !== 'ended' && !(Number(o.preT0DurationDays) > 0) && o.aggressorKey && o.participants && o.participants[o.aggressorKey] &&
  Object.keys(o.participants).some(k => o.participants[k].role === 'principal' && o.participants[k].side !== o.participants[o.aggressorKey].side);
let war = [...(S.conflicts ? S.conflicts.values() : [])].find(fresh) || null, started = false;
if (!war) {
  const cs = [...S.countries.values()].filter(c => c.key !== pk && He(c, 'defense') && He(c, 'diplomacy'));
  const bare = cs.filter(c => !bh(S, c.key).some(u => N7a(u, c.key, { theaterKey: c.key })));
  outer: for (const d of bare.slice(0, 15)) for (const a of cs.slice(0, 15)) {
    if (a === d || ha(S, a.key, d.key)) continue;
    const r = Z7t(S, a, d, {}); if (r && r.ok) { war = r.war; started = true; break outer; }
  }
}
if (!check(!!war, 'a war begun during play exists', war ? { war: war.id, aggressor: war.aggressorKey, startDay: war.startDay, startedHere: started } : null)) return null;
const agg = war.aggressorKey, aSide = war.participants[agg].side;
const vict = Object.keys(war.participants).find(k => war.participants[k].role === 'principal' && war.participants[k].side !== aSide);
const out = { war: war.id, aggressor: agg, attacked: vict };

// Aggressor pays in full: weight 1 for this war, no rally.
const tA = $2o(S, agg), eA = expect(agg);
check(near(tA.weight, eA.w) && near(tA.rally, eA.r) && (live(agg).length > 1 || (tA.weight === 1 && tA.rally === 0)), 'aggressor: weight 1 per war it started, no rally', { tally: tA, expected: eA, wars: live(agg).length });
// Directly attacked principal: weight 0.7, rally 6 on the start day; 3 when the war is 90 days old.
const tV = $2o(S, vict), eV = expect(vict), sd = war.startDay;
let t90;
try { war.startDay = day - 90; t90 = $2o(S, vict); } finally { war.startDay = sd; }
const only = live(vict).length === 1;
check(near(tV.weight, eV.w) && near(tV.rally, eV.r) && (!only || (near(tV.weight, 0.7) && near(tV.rally, 6 * Math.pow(0.5, Math.max(0, day - sd) / 90)))),
  'attacked principal: weight 0.7, rally 6 x 0.5^(age/90)', { tally: tV, expected: eV, wars: live(vict).length });
check(!only || near(t90.rally, 3), 'rally halves in 90 days', { rallyAt90: t90.rally });
// AI allies who join the attacked side: 0.7, no rally.
const cob = Object.keys(war.participants).filter(k => war.participants[k].role === 'cobelligerent' && war.participants[k].side !== aSide);
const cobBad = cob.filter(k => { const t = $2o(S, k), e = expect(k); return !near(t.weight, e.w) || !near(t.rally, e.r) || (live(k).length === 1 && t.rally !== 0); });
check(cobBad.length === 0, 'allies who join the attacked side: weight 0.7, no rally', { cobelligerents: cob, wrong: cobBad });
// Wars under way before day 0 (preT0DurationDays > 0): no rally for their participants.
const pre = [...(S.conflicts ? S.conflicts.values() : [])].filter(o => o.status !== 'ended' && Number(o.preT0DurationDays) > 0);
const preKeys = [...new Set(pre.flatMap(o => Object.keys(o.participants || {})))].filter(k => live(k).length && live(k).every(o => Number(o.preT0DurationDays) > 0));
const preBad = preKeys.filter(k => { const t = $2o(S, k), e = expect(k); return t.rally !== 0 || !near(t.weight, e.w); });
check(preBad.length === 0, 'participants in wars begun before day 0: no rally, weight by role', { checked: preKeys.length, wrong: preBad, sample: preKeys.slice(0, 4).map(k => [k, $2o(S, k).weight]) });
// The approval and stability "war" rows use weight and rally (edits 3, 4 read what edit 1 declares).
const rows = k => { const c = S.countries.get(k), z = ZX(S, c), ar = [], sr = []; cme(S, c, z, ar); ume(S, c, z, sr);
  return { w: z.war, a: (ar.find(x => x.id === 'war') || {}).contribution, s: (sr.find(x => x.id === 'war') || {}).contribution }; };
const rV = rows(vict), rA = rows(agg);
check(near(rV.a, -rV.w.weight * 7 - rV.w.exhaustion * 0.1 + rV.w.rally) && near(rV.s, -rV.w.weight * 5 - rV.w.exhaustion * 0.08 + rV.w.rally * 0.5),
  'attacked: approval war row -0.7x7 - exh x0.1 + rally, stability -0.7x5 - exh x0.08 + rally/2',
  { approval: rV.a, stability: rV.s, oldApproval: -rV.w.count * 7 - rV.w.exhaustion * 0.1, oldStability: -rV.w.count * 5 - rV.w.exhaustion * 0.08 });
check(near(rA.a, -rA.w.weight * 7 - rA.w.exhaustion * 0.1 + rA.w.rally) && rA.a <= rV.a, 'aggressor: approval war row in full, below the attacked', { aggressor: rA.a, attacked: rV.a });
out.attackedTally = tV; out.aggressorTally = tA; out.preT0Checked = preKeys.length;
return out;
`,
  },
  {
    // LC2: y1o (@13409411) scores a peace appeal: -0.15 (was -0.42) + long war (<= 0.35, zh @12664808 / 720) +
    // exhaustion (<= 0.3) + 0.22 x personal (g2a @10312905) + noise (p1o @13408717, +-0.06); DNa (@13411940) accepts at
    // score >= Xdo (0.5). y1o is pure; DNa is not called (it writes person memory via WCa). Ask object: the fields y1o
    // reads, shaped as the ask validator at @10413650 requires. The conflict's startDay, preT0DurationDays and the
    // recipient coalition's exhaustion are set for the sweep and restored in finally.
    id: 'lc2-peace-appeal',
    edits: ['lc2-peace-appeal#1'],
    code: String.raw`
const S = Ogr.sim, pk = S.playerKey, TH = typeof RPo === 'number' ? RPo : 0.5;
const conflicts = [...(S.conflicts ? S.conflicts.values() : [])].filter(c => c.status !== 'ended' && c.participants && c.coalitions);
if (!check(conflicts.length > 0, 'a live conflict exists', { conflicts: conflicts.length })) return null;
const leader = c => { const p = c ? Zt(S, c) : null; return p && p.alive !== false ? p : null; };
const mkAsk = (conf, toKey, toP, fromKey, fromP) => ({ id: 'probe-lc2:' + conf.id + ':' + fromKey, actId: 'peaceAppeal',
  from: { countryKey: fromKey, personId: fromP.id }, to: { countryKey: toKey, personId: toP.id },
  subjectRef: { domain: 'war', entityType: 'conflict', entityId: conf.id }, terms: { pressure01: 0.5 }, quote: { startDay: conf.startDay } });
const noise = a => (FPo(a.id + ':' + a.to.personId) % 2001 / 1e3 - 1) * 0.06;
// The closest real partner: the (recipient, sender) pair with the largest 0.22 x personal + noise.
const senders = [...S.countries.values()].map(c => [c.key, leader(c)]).filter(x => x[1]);
let best = null;
for (const conf of conflicts) for (const toKey of Object.keys(conf.participants)) {
  if (toKey === pk) continue;
  const toP = leader(S.countries.get(toKey)); if (!toP) continue;
  for (const [fk, fp] of senders) {
    if (fk === toKey || conf.participants[fk]) continue;
    const a = mkAsk(conf, toKey, toP, fk, fp), v = 0.22 * w_a(S, toP, fp) + noise(a);
    if (!best || v > best.v) best = { conf, a, v };
  }
}
if (!check(!!best, 'a recipient and a sender with leaders')) return null;
const conf = best.conf, a = best.a, co = conf.coalitions[conf.participants[a.to.countryKey].side];
// The player's own appeal to the same recipient (detail only: a neutral partner accepts only on favourable noise).
const plP = leader(S.countries.get(pk)), swiss = plP && !conf.participants[pk] ? { a: mkAsk(conf, a.to.countryKey, S.people.get(a.to.personId), pk, plP) } : null;
if (!check(!!co, 'recipient coalition exists')) return null;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const keep = { sd: conf.startDay, pre: conf.preT0DurationDays, hasPre: has(conf, 'preT0DurationDays'), exh: co.exhaustion, hasExh: has(co, 'exhaustion') };
const at = (ask, longDays, exh) => { conf.startDay = S.day || 0; conf.preT0DurationDays = longDays; co.exhaustion = exh; return HPo(S, ask); };
let real, young, long70, longFull, minExh = null, swissFull = null;
try {
  real = HPo(S, a);
  young = at(a, 0, 0);
  long70 = at(a, 720, 70);
  longFull = at(a, 720, 100);
  for (let x = 0; x <= 100; x++) if (at(a, 720, x).score >= TH) { minExh = x; break; }
  if (swiss) swissFull = { score: at(swiss.a, 720, 100).score, personal: w_a(S, S.people.get(a.to.personId), plP) };
} finally {
  conf.startDay = keep.sd;
  if (keep.hasPre) conf.preT0DurationDays = keep.pre; else delete conf.preT0DurationDays;
  if (keep.hasExh) co.exhaustion = keep.exh; else delete co.exhaustion;
}
// The base constant in the live function: score minus every other term.
const l = Math.max(0, Math.min(0.35, B5(S, conf) / 720)), u = Math.max(0, Math.min(1, (Number(co.exhaustion) || 0) / 100)) * 0.3;
const base = real.score - l - u - 0.22 * real.personal - noise(a);
check(Math.abs(base + 0.15) < 1e-9, 'score base is -0.15 (was -0.42)', { base, score: real.score, longWar: l, exhaustion: u, personal: real.personal, noise: noise(a) });
check(young.score < TH, 'young war, no exhaustion: refuses', { score: young.score });
check(longFull.score >= TH, 'closest partner, long war, full exhaustion: accepts', { score: longFull.score, originalBase: longFull.score - 0.27 });
check(minExh !== null && minExh < 97, 'acceptance reachable below the ~97 exhaustion the original needed in the best case', { minExhaustion: minExh, scoreAt70: long70.score });
return { conflict: conf.id, to: a.to.countryKey, from: a.from.countryKey, personal: real.personal, noise: noise(a), minExhaustion: minExh, playerAppealAtFullExhaustion: swissFull };
`,
  },
];
