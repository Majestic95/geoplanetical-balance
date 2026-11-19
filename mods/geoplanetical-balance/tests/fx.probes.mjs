// Probe for T1 edit 2 (headless/prototype/probe-edits.mjs; runs at day 0, as port-checks.sh starts it).
// Code uses 26734764 names (session host Ogr.sim); names and offsets inside comments are those of 26519199.
// The automatic reserve top-up IQa (26519199 @14629489; called from the treasury settlement T_o @14777044) borrows in
// a foreign currency when an AI (or autopilot) country's reserves cover under $m=6 months and it has a funding need;
// the patch records that borrowing in sovereign.geobalFxBorrowing so it counts toward the player's cap and cooldown,
// without limiting the top-up itself.
export const probes = [
  {
    id: 't1-auto-topup-recorded',
    edits: ['t1-fx-borrowing-limits#2'],
    code: String.raw`
const S = Ogr.sim, day = S.day || 0;
// A country the top-up acts for: AI-run, market open, a real funding need, a foreign currency to borrow in, money
// flowing out of its reserves, and a currency of its own (single member) so lowering its reserves moves the months.
// On 26519199 (1.1.0 reasoning, kept for history): the countries with a funding need after a month all have currencies the top-up skips (union, dollarised or strong:
// ola @9671313), so the probe gives an eligible country a real one through the game's own fiscal settlement wCt
// (@4915044): an expense above its cash books the shortfall to its funding-need liability.
// On 26734764 at day 0 every country with a reserve outflow shares its currency (the two CFA unions, the shekel), so
// the probe gives a single-currency country one through a real input of the game's reserve flow (G1e @11900270:
// current account + private inflows - principal not rolled over + fdiInflowDeltaBnY, times the regime factor): an FDI
// outflow larger than the rest of the flow. wut (@11900582) then reports the drain the top-up's trigger reads.
const cands = [], n = { ai: 0, market: 0, fx: 0, cover: 0, single: 0, outflow: 0 };
for (const c of S.countries.values()) {
  if (!_1r(S, c) || S.playerControlsGovernment?.(c)) continue; n.ai++;
  if (!C9(c)) continue; n.market++;
  const fx = dL(S, c);
  if (!fx || fx === c.ccy) continue; n.fx++;
  if (!yh(S, c)) continue; n.cover++;
  if ((c.ccy?.members || []).length !== 1 || !c._trade || !c.externalFinancing0) continue; n.single++;
  const flow0 = G1e(S, c), fdi0 = Number(c.fdiInflowDeltaBnY) || 0, push = Math.abs(flow0) + Math.max(1, 0.02 * (Number(c.gdpNom) || 0));
  c.fdiInflowDeltaBnY = fdi0 - push;
  const cov = yh(S, c);
  if (!(cov?.drainBnY > 1e-6)) { c.fdiInflowDeltaBnY = fdi0; continue; } n.outflow++;
  cands.push({ c, cov, flow0, fdi0 });
  break;
}
if (!check(cands.length > 0, 'an AI country with an open market, its own eligible currency, a foreign currency and a reserve outflow', { found: cands.length, day, passing: n })) return null;
check(cands[0].cov.reserveFlowBnY < 0, 'reserve outflow from the FDI input (G1e)', { flow0: cands[0].flow0, flow: cands[0].cov.reserveFlowBnY, drainBnY: cands[0].cov.drainBnY });
const { c, cov } = cands[0];
// Amounts on the ledger's grid (te, as the game rounds them).
const cash0 = Ka(S, c), need0 = ai(S, c), shortBn = ae(Math.max(0.5, 0.01 * (Number(c.gdpNom) || 0)), 'floor');
const st = JTt(S, c, { revenueBn: 0, expenseBn: ae(cash0 + shortBn, 'floor'), refs: { probe: 't1-auto-topup' } });
const need = ai(S, c);
check(Math.abs(need - need0 - shortBn) < 1e-6, 'a real funding need booked by the game settlement (wCt)', { cash0, shortBn, shortfall: st.shortfallBn, need });
const sov = S.finance.sovereigns[c.key], before = Array.isArray(sov.geobalFxBorrowing) ? sov.geobalFxBorrowing.length : 0;
// Lower the reserves to 3 months of the outflow so the top-up's trigger (months < 6) holds; what it then borrows is
// min(funding need, the gap to 6 months), as in the game.
const reserves0 = c.reserves;
c.reserves = cov.drainBnY * 3 / 12;
const cov2 = yh(S, c), expected = Math.min(need, fL(cov2, cf));
const got = C1r(S, c);
check(cov2.months < cf, 'trigger holds: reserves under 6 months of outflow', { months: cov2.months });
check(got > 0, 'the top-up borrowed', { amountBn: got, requestedBn: expected, fundingNeedBn: need });
const list = sov.geobalFxBorrowing || [], last = list[list.length - 1];
check(list.length === before + 1 && last && last[0] === day && Math.abs(last[1] - got) < 1e-9,
  'the borrowing is recorded as [day, amount] (edit 2)', { last, entries: list.length });
const room = __geobalFxRoom(S, c);
check(room.cooldown === true && Math.abs(room.usedBn - list.filter(e => day - e[0] < 365).reduce((a, e) => a + e[1], 0)) < 1e-9,
  'it counts toward the cooldown and the 365-day cap', { cooldown: room.cooldown, usedBn: room.usedBn, capBn: room.capBn });
// The top-up's request is min(need, gap) whatever the cap (the patch records, it does not limit); reported, not checked.
return { country: c.key, rating: c.rating, currency: c.ccy?.code, borrowedIn: dL(S, c)?.code, requestedBn: expected, placedBn: got, capBn: room.capBn, reserves0 };
`,
  },
];
