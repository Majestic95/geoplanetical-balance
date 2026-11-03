// Modded vs unmodded comparison: world aggregate gaps per month, the early-stop rule, and per-country gaps measured
// against a chaos floor (a null run's drift from the same baseline).

const sum = (row, f) => Object.values(row.byCountry).reduce((s, e) => s + (Number(e[f]) || 0), 0);
// A zero baseline with a non-zero modded value is an infinite gap, never a silent 0%.
const pct = (m, b) => (b ? (m / b - 1) * 100 : m ? Infinity : 0);

// World aggregates that show compounding money effects. limit: projected % gap at the horizon that fails a fix.
export const AGGREGATES = [
  { id: 'plug', label: 'household plug paid', get: r => sum(r, 'plugBn'), limit: 10 },
  { id: 'deposits', label: 'household deposits', get: r => sum(r, 'hhDepositsBn'), limit: 1 },
  { id: 'cbReserves', label: 'central-bank reserves', get: r => r.money['central-bank-reserves'] || 0, limit: 2 },
  { id: 'gdp', label: 'world nominal GDP', get: r => sum(r, 'gdp'), limit: 2 },
];

export function aggregateGaps(base, mod) {
  return AGGREGATES.map(a => ({ id: a.id, label: a.label, limit: a.limit, gapPct: pct(a.get(mod), a.get(base)) }));
}

// Linear trend of the last `window` values, projected forward to `horizon` months (never backwards: past the
// horizon the projection is the trend from the latest month on).
function project(series, horizon, limit, window = 3) {
  const pts = series.slice(-window);
  const last = pts[pts.length - 1];
  if (!last) return 0;
  // A non-finite gap (zero baseline, broken value) is itself the result: it fails, never turns into NaN.
  if (pts.some(p => !Number.isFinite(p.v))) return Infinity;
  if (pts.length < 2) return last.v;
  const slope = (last.v - pts[0].v) / (last.m - pts[0].m);
  const linear = last.v + slope * Math.max(0, horizon - last.m);
  // Geometric too, so an accelerating gap that a straight line under-projects is caught: when the last points keep
  // one sign and grow in size, project their growth ratio (capped) as well, and keep the larger projection. Only for
  // gaps already at a tenth of the limit: below that, ratios of tiny numbers project noise into a fail.
  const first = pts[0];
  if (Math.abs(last.v) >= limit / 10 && Math.sign(first.v) === Math.sign(last.v) && Math.abs(first.v) > 1e-9 && Math.abs(last.v) > Math.abs(first.v)) {
    const ratio = Math.min(3, (Math.abs(last.v) / Math.abs(first.v)) ** (1 / (last.m - first.m)));
    const geometric = last.v * ratio ** Math.max(0, horizon - last.m);
    if (Math.abs(geometric) > Math.abs(linear)) return geometric;
  }
  return linear;
}

// Early stop on world aggregates: fail once a projected gap passes its limit three months running (from minMonths); pass once every
// projected gap stays under half its limit (from passMonths). history: [{ month, gaps: aggregateGaps(...) }].
function projectAll(history, horizon) {
  return AGGREGATES.map(a => {
    const series = history.map(h => ({ m: h.month, v: h.gaps.find(g => g.id === a.id).gapPct }));
    // projected (geometric only from a tenth of the limit) decides fails; unfloored (geometric at any size) must
    // also stay under half the limit for a pass, so a tiny gap that triples monthly is not passed early.
    return { id: a.id, label: a.label, limit: a.limit, now: series[series.length - 1]?.v ?? 0,
      projected: project(series, horizon, a.limit), unfloored: project(series, horizon, 0) };
  });
}

// A fail needs the same aggregate over its limit for three months running (one trend window), so a one-time step,
// which the 3-point trend reads as steep while the step is inside the window, does not fail a fix on its own.
const PERSIST = 3;
const underHalf = p => Math.abs(p.projected) <= p.limit / 2 && Math.abs(p.unfloored) <= p.limit / 2;

function persistentlyOver(history, horizon) {
  const projected = projectAll(history, horizon);
  const overAt = k => new Set(projectAll(history.slice(0, history.length - k), horizon).filter(p => Math.abs(p.projected) > p.limit).map(p => p.id));
  const earlier = Array.from({ length: PERSIST - 1 }, (_, i) => overAt(i + 1));
  // A non-finite projection fails at once: it is a broken value, not a trend.
  return { projected, over: projected.filter(p => !Number.isFinite(p.projected) || (Math.abs(p.projected) > p.limit && earlier.every(set => set.has(p.id)))) };
}

export function earlyStop(history, { minMonths = 4, passMonths = 6, horizon = 12 } = {}) {
  const m = history.length ? history[history.length - 1].month : 0;
  const { projected, over } = persistentlyOver(history, horizon);
  if (m >= minMonths && over.length) return { verdict: 'fail', month: m, projected, reason: over.map(p => p.id).join(', ') };
  if (m >= passMonths && projected.every(underHalf)) return { verdict: 'pass', month: m, projected };
  return { verdict: 'continue', month: m, projected };
}

// The verdict when the months ran out without an early one: same persistence rule for a fail; pass under half the
// limit; anything else needs a look (review).
export function finalVerdict(history, { horizon = 12 } = {}) {
  const m = history.length ? history[history.length - 1].month : 0;
  const { projected, over } = persistentlyOver(history, horizon);
  if (over.length) return { verdict: 'fail', month: m, projected, reason: over.map(p => p.id).join(', ') };
  if (projected.every(underHalf)) return { verdict: 'pass', month: m, projected };
  return { verdict: 'review', month: m, projected, reason: projected.filter(p => !underHalf(p)).map(p => p.id).join(', ') };
}

// Per-country gaps at the last common month, flagged only above the chaos floor: |modded gap| > factor x |null gap|
// and above an absolute minimum. Series that turn non-finite on one side only are listed separately.
const COUNTRY_METRICS = [
  { f: 'gdp', unit: '%', min: 0.5 }, { f: 'hhDepositsBn', unit: '%', min: 0.5 }, { f: 'finIncBnY', unit: '%', min: 1 },
  { f: 'inflation', unit: 'pt', min: 0.3 }, { f: 'unemployment', unit: 'pt', min: 0.3 }, { f: 'approval', unit: 'pt', min: 3 },
];
const gapOf = (unit, m, b) => (unit === 'pt' ? m - b : pct(m, b));

export function countryFlags(base, mod, nul, { factor = 3 } = {}) {
  const flags = [], broken = [];
  for (const k of Object.keys(base.byCountry)) {
    for (const { f, unit, min } of COUNTRY_METRICS) {
      const b = base.byCountry[k]?.[f], m = mod.byCountry[k]?.[f], n = nul?.byCountry[k]?.[f];
      if (Number.isFinite(b) !== Number.isFinite(m)) { broken.push({ country: k, metric: f, base: b ?? null, modded: m ?? null }); continue; }
      if (!Number.isFinite(b)) continue;
      const g = gapOf(unit, m, b), floor = Number.isFinite(n) ? Math.abs(gapOf(unit, n, b)) : 0;
      if (Math.abs(g) > Math.max(min, factor * floor)) flags.push({ country: k, metric: f, unit, gap: g, chaosFloor: floor });
    }
  }
  flags.sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap));
  return { flags, broken };
}
