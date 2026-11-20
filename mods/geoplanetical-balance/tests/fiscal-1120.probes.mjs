// Targeted probe for a fiscal edit of the 2026-11-20 batch that ordinary headless runs may not reach (build 26734764).
// Run with: node --max-old-space-size=6000 headless/prototype/probe-edits.mjs mods/geoplanetical-balance/tests/fiscal-1120.probes.mjs
// Each `code` runs in the modded bundle's scope in one booted day-0 world. Uses 26734764 names (session host Ogr.sim).
// Test tooling only; never shipped.

export const probes = [
  {
    // W9: err (monthly AI defence budget, holds aiBudgetAnchor||=) subtracts __geobalW9(l) from its target at war:
    // 0.4 x max(pressure ramp .7 -> 1, debt ramp 80 -> 100%). A real AI country at war with fiscal pressure at most
    // 0.7 is taken (so only the debt ramp moves), and err runs for it alone twice, with debtRatio 50 and then 100.
    // A2 (the budget commit) is replaced for the two calls by a recorder, and the country's anchor, spend and debt
    // ratio are restored, so the world is unchanged. Effect: the recorded defence line is lower at 100% debt by
    // 0.4 x the month's closing share; on the unmodded game the two are equal (negative control).
    id: 'w9-war-defence-fiscal-term',
    edits: ['w9-war-defence-fiscal-term#1', 'w9-war-defence-fiscal-term#2'],
    code: String.raw`
const S = Ogr.sim, pk = S.playerKey;
const ai = [...S.countries.values()].filter(c => c.key !== pk && c.atWar && c.forces && c.brain && !S.playerControlsGovernment(c) &&
  Number(Zn(c).pressure) <= 0.7);
if (!check(ai.length > 0, 'an AI country at war with fiscal pressure at most 0.7', { count: ai.length })) return null;
const c = ai[0], key = String(c.key);
const hadAnchor = Object.prototype.hasOwnProperty.call(c.forces, 'aiBudgetAnchor'), anchor0 = hadAnchor ? JSON.parse(JSON.stringify(c.forces.aiBudgetAnchor)) : null;
const hadDebt = Object.prototype.hasOwnProperty.call(c, 'debtRatio'), debt0 = c.debtRatio, mil0 = c.spend && c.spend.mil;
const A2real = A2;
const run = debt => {
  let got = null;
  if (hadAnchor) c.forces.aiBudgetAnchor = JSON.parse(JSON.stringify(anchor0)); else delete c.forces.aiBudgetAnchor;
  c.debtRatio = debt;
  if (c.spend) c.spend.mil = mil0;
  A2 = (e, l, h) => { if (String(l.key) === key) got = h.spending.mil; return { ok: true }; };
  try { err(S, 91, null, null, new Set([key])); } finally { A2 = A2real; }
  return got == null ? Number(c.spend && c.spend.mil) : got;
};
let low, high;
try { low = run(50); high = run(100); }
finally {
  A2 = A2real;
  if (hadAnchor) c.forces.aiBudgetAnchor = anchor0; else delete c.forces.aiBudgetAnchor;
  if (hadDebt) c.debtRatio = debt0; else delete c.debtRatio;
  if (c.spend) c.spend.mil = mil0;
}
const out = { key, pressure: Zn(c).pressure, debtRatio: debt0, milAt50: low, milAt100: high, diff: low - high };
check(Number.isFinite(low) && Number.isFinite(high) && low - high > 1e-6, 'at war, 100% debt gives a lower defence line than 50% (restraint observed)', out);
return out;
`,
  },
];
