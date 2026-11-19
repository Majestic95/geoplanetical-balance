// K1/K2 transport-path function test (build 26734764, game 1.1.5): the game's transport quote-and-financing step (zce),
// the start (Kg) and the road/rail programme quote (SW), cut from the patched and the original bundle with the patch's
// helpers (__geobalK12Qty, __geobalK12Months, __geobalK12Ent), the game's own room (yX), stretch-or-refuse rule (qRe),
// quote wrapper (tP, which since 1.1.5 gives a quote without a monthly cost cost / months) and error helper (Wt).
// Stubbed: the raw project quote RHr (its real shape: costBn, months, plan...), the financing gate jS (as the 1.1.5
// gate does through hi: a treasury not in default borrows any shortfall, so it passes; a defaulted one passes only when
// its cash covers the committed monthly payments plus this project's; it also returns a funding record),
// the materials basket (Hce), the programme's province rows and allocation (EHr, KHr), events.
// Intent (26403824 patch, edits 5-7): the construction check runs before financing, so the budget gate sees the
// stretched monthly cost; the player's works are stretched up to 3x, never refused; AI works needing more than 3x are
// not started; the transport quote shown to the player (transportProjectQuote -> zce) keeps the normal schedule.
// Usage: node --max-old-space-size=4000 mods/geoplanetical-balance/tests/k1-k2-transport.test.mjs
import { readFileSync } from 'node:fs';
import { parseExpressionAt } from 'acorn';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const fnSrc = (text, name) => {
  const at = text.indexOf(`function ${name}(`);
  if (at < 0 || text.indexOf(`function ${name}(`, at + 1) >= 0) throw new Error(`${name} not found once`);
  return text.slice(at, parseExpressionAt(text, at, { ecmaVersion: 'latest' }).end);
};

// Game constants and helpers, as in k1-k2.test.mjs.
const Mco = Number(original.match(/,Mco=(\d+(?:\.\d+)?);function yX\(/)[1]);
const Y_ = Number(original.match(/,Y_=(\.?\d+(?:\.\d+)?),YY=/)[1]);
const TZA = 'construction#';
const HOLDS = new Set(['delivery_hold', 'program_paused', 'legal_hold', 'occupation_hold', 'diplomatic_hold', 'suspended', 'site_hold']);
const stubs = {
  Mco, Y_, cpe: TZA,
  T0: (e, key, good) => (good === 'construction' ? e.prices?.[key] : undefined),
  ec: (e, c = null) => [e.construction || [], e.extractProjects || [], ...(c ? [c._milIndustryProjects || []] : [])],
  C5: p => HOLDS.has(String(p || '')),
  bW: (e, t) => e.countries.get(typeof t === 'string' ? t : t?.key) || null,
  RHr: (e, t, a) => (a.projectType === 'surface_program' ? e.surfaceQuote(a) : { ...e.quote }),
  Hce: e => e.basket,
  jS: (e, c, costBn, monthlyBn) => {
    if (!Number.isFinite(costBn) || costBn < 0 || !Number.isFinite(monthlyBn) || monthlyBn < 0) throw new TypeError('infrastructureFundingFeasibility: invalid project quote');
    const ok = !e.fin.defaulted || e.fin.cashBn >= e.fin.committedMonthlyBn + monthlyBn;
    return { ok, reason: ok ? null : 'default', monthlyBn, availableCashBn: e.fin.cashBn, canBorrow: !e.fin.defaulted, funding: { ok }, committedMonthlyBn: e.fin.committedMonthlyBn };
  },
  H: (e, id, data) => e.events.push([id, data]),
  vp: x => (x == null ? x : JSON.parse(JSON.stringify(x))),
  tlt: () => ['p1'],
  Hn: () => {},
  // SW's own helpers.
  eP: (x, lo, hi) => Math.max(lo, Math.min(hi, x)), Da: (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d), Q4: { minKm: 1, maxKm: 5e4 },
  _6: () => true, Y: a => a.reduce((s, x) => s + x, 0), ae: x => x,
  EHr: e => e.rows.map(r => ({ ...r, ok: true, capacityBefore: 0 })), KHr: l => l, pZ: () => 0,
};
const names = ['yX', 'qRe', 'Wt', 'tP', 'zce', 'Kg', 'SW'];
const load = (text, extra) => new Function(...Object.keys(stubs),
  `${[...names, ...extra].map(n => fnSrc(text, n)).join('\n')};return {${[...names, ...extra].join(',')}};`)(...Object.values(stubs));
const P = load(patched, ['__geobalK12Qty', '__geobalK12Months', '__geobalK12Ent']), V = load(original, []);

// A world: player X and AI Y, each with yearly construction capacity 100 (x1.1), other use 50: room 60 a year.
// Construction price 1, every transport basket all construction, so a project's construction quantity is its cost.
const world = ({ cost = 10, months = 12, fin = {}, rows = null } = {}) => {
  const country = key => ({ key, we: { cap: { [TZA]: 100 }, cons: { [TZA]: 55 }, constructionDemand: { [TZA]: 5 } } });
  const e = {
    playerKey: 'X', countries: new Map([['X', country('X')], ['Y', country('Y')]]), prices: { X: 1, Y: 1 }, construction: [], extractProjects: [],
    _projSeq: 0, events: [], basket: { construction: 1 },
    fin: { defaulted: false, committedMonthlyBn: 0, cashBn: 0, ...fin },
    quote: { ok: true, projectType: 'new_corridor', targetId: 'c1', targetKind: 'corridor', terrainId: 'plain', costBn: cost, months, monthlyCostBn: cost / months, plan: { corridor: { id: 'c1' } } },
    rows: rows || [],
    surfaceQuote: a => { const r = e.rows.find(x => x.provinceKey === a.provinceKey); return { ok: true, projectType: 'surface_program', targetId: `surface:${a.provinceKey}`, targetKind: 'surface_province', terrainId: 'plain', costBn: r.cost, months: r.months, distanceKm: r.lengthKm, operatingCostIndex: 0, plan: { surfaceProgram: { ...a } } }; },
  };
  e.playerControlsGovernment = c => (typeof c === 'string' ? c : c?.key) === e.playerKey;
  return e;
};
const SPEC = { projectType: 'new_corridor', terrainId: 'plain' };
const start = (L, o, who = 'X') => { const e = world(o); const r = L.Kg(e, who, SPEC); return { r, e, p: r.project }; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Premises: the call site and the unpatched quote.
check(fnSrc(patched, 'zce') === fnSrc(original, 'zce'), 'zce (the transport quote, transportProjectQuote) is the game' + "'" + 's own, unpatched');
check(fnSrc(patched, 'Kg') === fnSrc(original, 'Kg').replace('o=zce(e,t,a)', 'o=__geobalK12Ent(e,t,a)'), 'Kg differs only in calling __geobalK12Ent');
check(/transportProjectQuote\(t,a\)\{return a===void 0&&\(a=t,t=this\.player\),zce\(this,t,a\)\}/.test(patched) && /startTransportProject\(t,a\)\{return a===void 0&&\(a=t,t=this\.player\),Kg\(this,t,a\)\}/.test(patched),
  'the UI quote calls zce and the start calls Kg');
check(fnSrc(patched, 'yX') === fnSrc(original, 'yX') && fnSrc(patched, 'qRe') === fnSrc(original, 'qRe') && fnSrc(patched, 'jS') === fnSrc(original, 'jS') && fnSrc(patched, 'tP') === fnSrc(original, 'tP'), 'yX, qRe, jS and tP are the game' + "'" + 's own');

// (a) Under the room: quote and project identical to the game's, player and AI.
for (const who of ['X', 'Y']) for (const [cost, months] of [[10, 12], [30, 6], [60, 12]]) {
  const a = start(P, { cost, months }, who), b = start(V, { cost, months }, who);
  check(a.r.ok && same(a.r, b.r) && same(a.e.events, b.e.events), `(a) ${who} cost ${cost} over ${months} months (needs ${Math.ceil(12 * cost / 60)}): started exactly as the game does`, `${a.p?.monthsTotal}`);
}

// (b) Over the room: stretched, monthly cost recomputed, at most 3x for the player.
{
  const a = start(P, { cost: 120, months: 12 }), b = start(V, { cost: 120, months: 12 });
  check(a.r.ok && a.p.monthsTotal === 24 && a.p.monthsLeft === 24 && a.r.quote.months === 24 && a.r.quote.monthlyCostBn === 5, '(b) player, 120 needing 24 months of 12: stretched to 24, monthly cost 5', JSON.stringify({ m: a.p?.monthsTotal, mc: a.r.quote?.monthlyCostBn }));
  check(b.p.monthsTotal === 12, '(b) original: the same project at full speed', String(b.p.monthsTotal));
  check(a.p.totalCost === 120 && a.r.quote.costBn === 120, '(b) cost unchanged by the stretch');
  const c = start(P, { cost: 600, months: 12 });
  check(c.r.ok && c.p.monthsTotal === 36 && c.r.quote.monthlyCostBn === 600 / 36, '(b) player needing 10x: given 3x (36 months), never refused', String(c.p?.monthsTotal));
  const d = start(P, { cost: 120, months: 12 }, 'Y');
  check(d.r.ok && d.p.monthsTotal === 24 && d.r.quote.monthlyCostBn === 5, '(b) AI needing 2x: stretched like the game\'s own AI rule (qRe)', String(d.p?.monthsTotal));
}

// (c) The financing gate sees the stretched monthly cost (26403824 edit 5: `e=C.costBn/k` before the gate). Since
// 1.1.5 the gate (jS) refuses only a treasury in default whose cash cannot cover the month; a solvent one borrows.
{
  const fin = { defaulted: true, committedMonthlyBn: 0, cashBn: 6 };
  const a = start(P, { cost: 120, months: 12, fin }), b = start(V, { cost: 120, months: 12, fin });
  check(b.r.ok === false && b.r.reason === 'financing_unavailable', '(c) original: a defaulted treasury with 6 in cash cannot carry 10 a month', b.r.reason);
  check(a.r.ok === true && a.p.monthsTotal === 24 && a.r.quote.monthlyCostBn === 5, '(c) patched: stretched to 24 months at 5 a month, its cash carries it and it starts', JSON.stringify({ ok: a.r.ok, m: a.p?.monthsTotal }));
  const tight = start(P, { cost: 120, months: 12, fin: { ...fin, cashBn: 4 } });
  check(tight.r.ok === false && tight.r.reason === 'financing_unavailable' && tight.e.events.some(([id]) => id === 'transport.project_rejected'), '(c) still too expensive when stretched: refused for financing, with the player notice');
  const solvent = start(P, { cost: 120, months: 12, fin: { defaulted: false, cashBn: 0 } });
  check(solvent.r.ok && solvent.p.monthsTotal === 24, '(c) a solvent treasury borrows the shortfall (1.1.5): passes, on the stretched schedule');
}

// The single-surface, port and airport quotes the raw quote (RHr) returns carry no monthlyCostBn. Since 1.1.5 the
// game's wrapper tP gives every such quote cost / months, for the AI too, so K11's case is the game's own now.
{
  const noMonthly = (L, o, who = 'X') => { const e = world(o); delete e.quote.monthlyCostBn; const r = L.Kg(e, who, SPEC); return { r, p: r.project }; };
  const fin = { defaulted: false, committedMonthlyBn: 0, cashBn: 0 };
  for (const who of ['X', 'Y']) {
    const a = noMonthly(P, { cost: 10, months: 12, fin }, who), b = noMonthly(V, { cost: 10, months: 12, fin }, who);
    check(same(a.r, b.r) && b.r.ok === true && b.r.quote.monthlyCostBn === 10 / 12, `(c) ${who} quote without a monthly cost, under the room: the game gives it cost / months and starts it, as patched`);
  }
  const c = noMonthly(P, { cost: 120, months: 12, fin }), d = noMonthly(V, { cost: 120, months: 12, fin });
  check(c.r.ok === true && c.p.monthsTotal === 24 && c.r.quote.monthlyCostBn === 5 && d.r.ok === true && d.p.monthsTotal === 12,
    '(c) the same over the room: stretched to 24 months at 5 a month (the game: 12 months)', JSON.stringify({ patched: c.p?.monthsTotal, game: d.p?.monthsTotal }));
}

// (d) An AI transport work needing more than 3x is not started.
{
  const a = start(P, { cost: 600, months: 12 }, 'Y');
  check(a.r.ok === false && a.r.reason === 'construction_backlog' && !a.p && a.e.construction.length === 0, '(d) AI needing 10x: refused construction_backlog, nothing started', a.r.reason);
  check(a.e.events.length === 0, '(d) no player notice for an AI refusal');
  const b = start(P, { cost: 600, months: 12, fin: { cashBn: 1e6 } }, 'Y');
  check(b.r.ok === false && b.r.reason === 'construction_backlog', '(d) not started even with cash for it');
  const n = world({ cost: 600, months: 12 }); n.countries.get('Y').atWar = true;
  check(P.Kg(n, 'Y', SPEC).project?.monthsTotal === 12, '(d) a country at war is exempt, as in the game\'s own rule');
}

// (e) The UI quote keeps the normal schedule.
{
  const e = world({ cost: 120, months: 12 });
  const q = P.zce(e, 'X', SPEC);
  check(q.ok && q.months === 12 && q.monthlyCostBn === 10 && same(q, V.zce(world({ cost: 120, months: 12 }), 'X', SPEC)), '(e) transportProjectQuote: 12 months, as the game shows it', JSON.stringify({ m: q.months }));
}

// (f) The road/rail programme quote (SW): the programme is checked on the sum of its projects' yearly pace and each
// project is stretched by the same factor (26403824 effect text); AI programmes needing more than 3x are refused.
{
  const rows = [{ provinceKey: 'p1', provinceName: 'p1', lengthKm: 10, stockKm: 0, ceilingKm: 100, metrics: { roadCondition: 1 }, cost: 60, months: 12 },
    { provinceKey: 'p2', provinceName: 'p2', lengthKm: 10, stockKm: 0, ceilingKm: 100, metrics: { roadCondition: 1 }, cost: 30, months: 6 }];
  const prog = (L, o, who = 'X') => L.SW(world({ rows, ...o }), who, 'road', 20, []);
  const small = rows.map(r => ({ ...r, cost: r.cost / 10 }));
  check(same(prog(P, { rows: small }), prog(V, { rows: small })), '(f) under the room: the programme quote is the game\'s');
  // Yearly pace at the longest project's schedule: 60 x 12/12 + 30 x 12/6 = 120 against a room of 60 -> 2x.
  const a = prog(P, {}), b = prog(V, {});
  check(a.ok && a.allocation.map(x => x.months).join() === '24,12' && b.allocation.map(x => x.months).join() === '12,6', '(f) player programme needing 2x: each project stretched by the same factor', JSON.stringify(a.allocation.map(x => x.months)));
  check(Math.abs(a.monthlyBn - (60 / 24 + 30 / 12)) < 1e-12 && a.months === 24 && a.allocation.every(x => Math.abs(x.quote.monthlyCostBn - x.costBn / x.months) < 1e-12),
    '(f) monthly cost and length recomputed on the stretched schedule', `${a.monthlyBn} over ${a.months}`);
  const fin = { defaulted: true, committedMonthlyBn: 0, cashBn: 6 };
  check(prog(V, { fin }).reason === 'financing_unavailable' && prog(P, { fin }).ok === true, '(f) the financing gate sees the stretched pace (a defaulted treasury with 6 in cash: 10 a month refused by the game, 5 passes)');
  const big = rows.map(r => ({ ...r, cost: r.cost * 5 }));
  const p = prog(P, { rows: big }), q = prog(P, { rows: big }, 'Y');
  check(p.ok && p.allocation.map(x => x.months).join() === '36,18', '(f) player programme needing 10x: 3x, never refused', JSON.stringify(p.allocation?.map(x => x.months)));
  check(q.ok === false && q.reason === 'construction_backlog', '(f) AI programme needing 10x: refused construction_backlog', q.reason);
}

console.log(failures ? `${failures} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
