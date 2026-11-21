// AI audit war set (AX14-AX16, AX23, AX25): does the war seeded at the start still run, and how many wars and crises does
// the year bring? No perturbation: both worlds are the same world, so run it once modded and once with --unmodded and
// compare the two reports (the control and treated columns must match within a run; the null check).
//   node --max-old-space-size=6000 headless/prototype/stimulus.mjs headless/ai-audit/war-watch.stim.mjs --jobs 2
//   node --max-old-space-size=6000 headless/prototype/stimulus.mjs headless/ai-audit/war-watch.stim.mjs --jobs 2 --unmodded
// Test tooling only; never shipped.
const pick = String.raw`return {};`;
const perturb = String.raw`return null;`;
const measure = String.raw`
const e = Ogr.sim, out = { day: e.day, wars: [], crises: 0, crisisRungs: [] };
for (const w of e.conflicts?.values?.() || []) {
  if (!n_(w)) continue;
  const side = (s) => { try { const r = kP(e, w, s); return r ? { p: r.principalKey, E: Math.round(r.continuationUtility * 1000) / 1000, t: r.terminationIntentId, ex: Math.round(r.exhaustion01 * 100) / 100 } : null; } catch (x) { return { err: String(x).slice(0, 60) }; } };
  out.wars.push({ id: String(w.id).slice(0, 40), A: side('A'), B: side('B') });
}
for (const c of e.securityCrises?.crises?.values?.() || []) if (c?.status === 'active') { out.crises++; out.crisisRungs.push([c.openerKey, c.targetKey, Fs(c, c.openerKey), Fs(c, c.targetKey)]); }
out.crisisRungs = out.crisisRungs.slice(0, 10);
return out;`;
const check = (c, t) => [
  { pass: JSON.stringify(c) === JSON.stringify(t), label: 'null check: control and treated identical' },
  { pass: true, label: 'state', detail: t },
];
export const tests = [
  { id: 'war-watch-365', preDays: 0, days: 365, pick, perturb, measure, check },
];
