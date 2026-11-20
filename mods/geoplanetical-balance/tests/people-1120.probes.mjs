// Probes for the 2026-11-20 people batch: edits a normal headless run reaches only when a government cuts staff.
// Run by headless/prototype/probe-edits.mjs in one booted world (seed 12345, player 756, --days 5). Each `code` is an
// async function body evaluated in the simulation scope (26734764 names; Ogr.sim = the world). Negative control: the
// probe fails when every hp11 edit is neutralised (replace = find). Test tooling only; never shipped.

export const probes = [
  {
    id: 'hp11-severance-paid',
    edits: ['hp11-public-severance#1', 'hp11-public-severance#2', 'hp11-public-severance#3', 'hp11-public-severance#4', 'hp11-public-severance#5'],
    code: String.raw`
const e = Ogr.sim, c = e.countries.get(e.playerKey), edu = c.employment?.public?.education;
check(!!edu && edu.headcountM > 0, 'player has public education staff', String(edu?.headcountM));
edu.targetHeadcountM = edu.headcountM * 0.8;
const origOd = od, origUzt = Uzt, booked = [], cuts = [];
try {
  // Policy cuts only: headcount just before and just after the staff step, per civil role, at the wage the step leaves.
  Uzt = function (k, ...rest) {
    const pub = k?.employment?.public || {}, before = Object.fromEntries(Nl.map(f => [f.id, pub[f.id]?.headcountM ?? 0]));
    const r = origUzt.call(this, k, ...rest);
    if (k === c) for (const f of Nl) { const s = pub[f.id]; if (!s) continue; const d = before[f.id] - s.headcountM; if (d > 0) cuts.push({ id: f.id, d, wage: s.wageAnnualK > 0 ? s.wageAnnualK : 0 }); }
    return r;
  };
  // Booked payments only: a failed full payment followed by a partial one counts once.
  od = function (w, k, x, o) { const r = origOd.call(this, w, k, x, o); if (k === c && o?.kind === 'public_severance_payment' && r?.ok && r.amountBn > 0) booked.push({ amountBn: r.amountBn, months: o.refs?.months }); return r; };
  tdr(e, e.player, 1 / 12);
} finally { od = origOd; Uzt = origUzt; }
const eduCut = cuts.find(x => x.id === 'education');
check(!!eduCut && eduCut.d > 0, 'the staff step cut education toward the lower target', JSON.stringify(eduCut || null));
const months = booked[0]?.months, sum = booked.reduce((a, b) => a + b.amountBn, 0);
const expect = cuts.reduce((a, x) => a + x.d * x.wage, 0) * (months || 0) / 12;
check(booked.length === 1, 'one redundancy payment booked for the player', String(booked.length));
check(months >= 2 && months <= 6, 'months from the trade-union law', String(months));
check(expect > 0 && Math.abs(sum - expect) <= 1e-7 + 1e-9 * expect, 'booked amount = policy leavers x wage x months / 12 (ledger rounding)', JSON.stringify({ sum, expect }));
return { cuts, months, sum, expect };
`,
  },
];
