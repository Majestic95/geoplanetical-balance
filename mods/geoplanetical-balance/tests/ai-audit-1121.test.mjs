// Function tests for the AI audit batch of 2026-11-21 (build 26734764): AX19 (approval reaches the AI's law and budget
// weights), AX22 (AI police review sees crime), AX17 (budget review on a fiscal or jobs shock), AX18 (market yields reach
// the AI budget's pressure), AX27 (bilateral aid skips enemies and sanctioned states). Each function is taken from the
// original and the patched bundle and run on the same inputs with its game helpers stubbed; every effect has a negative
// control on the unmodded code.
// Usage: node mods/geoplanetical-balance/tests/ai-audit-1121.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const O = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const P = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail !== '' ? `: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`); } };
const fnSrc = (text, name, need = true) => {
  const s = text.indexOf(`function ${name}(`);
  if (s < 0) { if (need) throw new Error(`${name}: not found`); return ''; }
  if (text.indexOf(`function ${name}(`, s + 1) >= 0) throw new Error(`${name}: found twice`);
  let depth = 0, i = text.indexOf('{', text.indexOf(')', s)) ;
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(s, i + 1);
};
const load = (text, names, stubs, helpers = []) => {
  const src = names.map(n => fnSrc(text, n)).join('\n') + helpers.map(n => fnSrc(text, n, false)).join('\n');
  const keys = Object.keys(stubs);
  return new Function(...keys, `${src};return {${names.join(',')}};`)(...keys.map(k => stubs[k]));
};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ---------- AX19 ----------
{
  const near = { v: 0.5 };
  const base = {
    Oh: () => near.v, TEa: clamp, Lpe: () => 0, b1o: 540,
    _f: (t) => t.integ, gMo: () => ({ id: 'p' }), I6: () => ({}), Zt: () => ({ traits: {} }), Bbt: () => ({}), z6e: () => ({}),
    to: () => 'p', O4e: clamp, Jh: (x, d = 0) => (Number.isFinite(x) ? x : d), yMo: () => 0, ZP: () => 1, $tr: () => 0,
  };
  const ld = (text) => load(text, ['Pae', 'Dbt'], base, ['__geobalElecNear']);
  const Lo = ld(O), Lp = ld(P);
  const country = (approval, integ = 0.9) => ({ approval, integ, pol: { parties: [{ id: 'p', ideology: {} }] } });
  const dbt = (L, c) => L.Dbt({ climate: {} }, c, { mode: 'neutral', observation: { pressure: 0, inflationPct: 2 }, fatiguePct: 0 });
  for (const n of [0, 0.5, 1]) {
    near.v = n;
    for (const a of [45, 60, 90]) {
      const c = country(a);
      check(Lp.Pae({}, c).publicWeight === Lo.Pae({}, c).publicWeight, `AX19: approval ${a}, nearness ${n}: law weight unchanged`, [Lp.Pae({}, c).publicWeight, Lo.Pae({}, c).publicWeight]);
      const dp = dbt(Lp, c), dO = dbt(Lo, c);
      check(dp.popularWeight === dO.popularWeight && dp.electoralPull === dO.electoralPull && dp.fiscalDiscipline === dO.fiscalDiscipline,
        `AX19: approval ${a}, nearness ${n}: budget weights unchanged`, [dp.popularWeight, dO.popularWeight, dp.electoralPull, dO.electoralPull]);
    }
  }
  near.v = 1;
  const lose = country(20), win = country(70);
  check(Lo.Pae({}, lose).publicWeight === Lo.Pae({}, win).publicWeight, 'AX19 negative control: original law weight ignores approval');
  const wL = Lp.Pae({}, lose).publicWeight, wW = Lp.Pae({}, win).publicWeight;
  check(Math.abs(wL - 0.9 * (0.15 + 0.45 * 2.25)) < 1e-12 && wL > 1.9 * wW, 'AX19: at 20% approval on the eve of a vote the law weight is about doubled', [wL, wW]);
  const dl = dbt(Lp, lose), dw = dbt(Lp, win);
  check(dl.popularWeight > dw.popularWeight && Math.abs(dl.popularWeight - (0.4 + 0.9 * (0.6 + 2.25))) < 1e-12, 'AX19: budget popular weight rises for a losing government', [dl.popularWeight, dw.popularWeight]);
  check(dl.electoralPull === 1 && dw.electoralPull === 0.9, 'AX19: electoral pull capped at 1 (keeps the tightening damper in [0,1])', [dl.electoralPull, dw.electoralPull]);
  check(dl.fiscalDiscipline >= 0.35 && dl.fiscalDiscipline <= 1, 'AX19: fiscal discipline stays in its band', dl.fiscalDiscipline);
  near.v = 0;
  check(Lp.Pae({}, lose).publicWeight > Lp.Pae({}, win).publicWeight && Lp.Pae({}, win).publicWeight === Lo.Pae({}, win).publicWeight,
    'AX19: far from a vote, a losing government still listens a little more', [Lp.Pae({}, lose).publicWeight, Lp.Pae({}, win).publicWeight]);
  {
    const keep = base.Lpe; base.Lpe = () => null; near.v = 0;
    const Ln = load(P, ['Pae'], base, ['__geobalElecNear']);
    check(Ln.Pae({}, country(20, 0.05)).publicWeight === 0.05 * 0.15, 'AX19: no election scheduled: no far-from-a-vote term', Ln.Pae({}, country(20, 0.05)).publicWeight);
    base.Lpe = keep;
  }
  const auto = country(10, 0);
  check(Lp.Pae({}, auto).publicWeight === 0 && dbt(Lp, auto).electoralPull === 0, 'AX19: no electoral integrity, no effect');
  for (const bad of [NaN, undefined, null, 'x', -50, 500]) {
    near.v = 0.7; const c = country(bad);
    const w = Lp.Pae({}, c).publicWeight;
    check(Number.isFinite(w) && w >= 0 && w <= 0.9 * (0.15 + 0.45 * 2.25) + 1e-12, `AX19: approval ${bad} gives a finite bounded weight`, w);
  }
  check(!P.includes('electoralPull:i*s,') && P.includes('electoralPull:Math.min(1,i*s),'), 'AX19: patched bundle carries the cap');
  check((P.match(/[^ ]__geobalElecNear\(e,t\)/g) || []).length === 3, 'AX19: three readers use the helper (law weight, its fallback, budget)', (P.match(/.{12}__geobalElecNear\(e,t\)/g) || []));
}

// ---------- AX22 ----------
{
  const consts = (text) => { const a = text.indexOf('var m2r="securityJustice"'); return text.slice(a, text.indexOf(';', a) + 1); };
  check(/uLo=\.3/.test(consts(O)) && /QWo=1\.18/.test(consts(O)), 'AX22: police constants read from the bundle', consts(O));
  const room = { v: 0.2 };
  const stubsIE = { v: null };
  const sj = (latentRatio, pendingRatio) => ({
    seed: { latentAnnualPer100k: { violent: 200, property: 600, criminalEconomy: 200 }, policePendingPer100k: 100 },
    crime: { latentAnnualPer100k: 1000 * latentRatio, families: { violent: { latentAnnualPer100k: 200 * latentRatio } }, pendingPer100k: 100 * pendingRatio },
  });
  const diag = (s) => ({ bottleneckId: 'police', pressures: { police: s.crime.pendingPer100k / s.seed.policePendingPer100k, justice: 1, prisons: 0.9, recidivism: 1 } });
  stubsIE.v = (t) => diag(t.securityJustice);
  const mk = (text) => {
    const hires = [];
    const stubs = {
      Ke: (x) => (Number.isFinite(Number(x)) ? Number(x) : 0), IE: (t) => stubsIE.v(t), G1: () => ({ integrity: 0.5 }), eO: (a) => a,
      fLo: () => null, yLo: () => !1, pFe: () => null, pLo: () => {}, Gr: () => room.v, tO: (t, i, x) => x, Mo: (x, d = 0) => (Number.isFinite(x) ? x : d),
      nw: () => null, KR: () => null, tMo: [],
    };
    const src = consts(text) + ['mLo', 'hLo', 'gLo', 'f2r', 'ztr', 'dLo'].map(n => fnSrc(text, n)).join('\n') +
      ['__geobalCrimeRatio', '__geobalPoliceDiag', '__geobalPoliceGate'].map(n => fnSrc(text, n, false)).join('\n');
    const keys = Object.keys(stubs);
    const L = new Function(...keys, `${src};return {f2r,ztr};`)(...keys.map(k => stubs[k]));
    const world = { day: 400, playerControlsGovernment: () => !1, setPublicHeadcountTarget: (role, n) => { hires.push([role, n]); return { ok: !0 }; } };
    const run = (s, day = 400, job = { targetChangedDay: 0, targetSource: 'initial' }) => { hires.length = 0; world.day = day; const t = { securityJustice: s, brain: { attention: { lastActionDay: {} } }, employment: { public: { internalSecurity: { targetHeadcountM: 1, headcountM: 1, ...job }, justiceCorrections: { targetHeadcountM: 1, headcountM: 1, ...job } } } }; const r = L.f2r(world, t, null); return { r, hires: hires.slice() }; };
    return { run, ztr: (s) => L.ztr({}, { securityJustice: s }) };
  };
  const Lo = mk(O), Lp = mk(P);
  room.v = 0.2;
  const wave = sj(1.6, 1);
  check(Lo.run(wave).hires.length === 0, 'AX22 negative control: original ignores a crime wave with a flat backlog', Lo.run(wave));
  const h = Lp.run(wave);
  check(h.hires.length === 1 && h.hires[0][0] === 'internalSecurity' && Math.abs(h.hires[0][1] - 1.08) < 1e-12, 'AX22: crime x1.6 hires police (+8%) at fiscal room 0.2', h);
  room.v = 0.1;
  check(Lp.run(wave).hires.length === 0, 'AX22: fiscal room 0.1 is still too little (gate floor 0.15)');
  room.v = 0.2;
  const mild = sj(1.2, 1);
  check(Lp.run(mild).hires.length === 0, 'AX22: crime x1.2 at room 0.2: gate 0.225 not met', Lp.run(mild));
  room.v = 0.3;
  check(Lp.run(mild).hires.length === 1 && Math.abs(Lp.run(mild).hires[0][1] - 1.04) < 1e-12, 'AX22: crime x1.2 at room 0.3 hires +4%', Lp.run(mild));
  check(Lo.run(mild).hires.length === 0, 'AX22 negative control: original does not hire at crime x1.2');
  for (const [lr, pr] of [[1, 2], [1, 1], [0.8, 1.5], [1, 1.3]]) for (const rv of [0.1, 0.3, 0.6]) {
    room.v = rv; const s = sj(lr, pr);
    check(JSON.stringify(Lp.run(s).hires) === JSON.stringify(Lo.run(s).hires), `AX22: no crime rise (ratio ${lr}, backlog ${pr}, room ${rv}): same decision as the game`);
  }
  check(Lp.ztr(wave).pol === 1 && Lo.ztr(wave).pol === 1, 'AX22: the budget police-need term stays on the backlog (it also gates state investment)', [Lp.ztr(wave).pol, Lo.ztr(wave).pol]);
  const back = sj(1, 2);
  check(Lp.ztr(back).pol === 2 && Lo.ztr(back).pol === 2, 'AX22: backlog-driven need unchanged');
  const broken = { seed: {}, crime: { pendingPer100k: 50, latentAnnualPer100k: NaN, families: {} } };
  check(Lp.ztr({ ...broken, seed: { policePendingPer100k: 100 } }).pol != null && Number.isFinite(Lp.ztr({ ...broken, seed: { policePendingPer100k: 100 } }).pol), 'AX22: missing seed crime gives a finite need');
  const huge = sj(50, 1); room.v = 0.6;
  const hh = Lp.run(huge);
  check(hh.hires.length === 1 && Math.abs(hh.hires[0][1] - 1.08) < 1e-12, 'AX22: extreme crime: one 8% step only', hh);
  { const Lh = load(P, ['__geobalCrimeRatio'], { mLo: (e) => ({ latent: e.crime.latentAnnualPer100k / 1000 }) });
    check(Lh.__geobalCrimeRatio(huge) === 4 && Lh.__geobalCrimeRatio({ crime: {}, seed: {} }) === 1, 'AX22: the crime ratio is capped at 4; no seed gives 1'); }
  {
    const cached = diag(wave), snap = JSON.stringify(cached), keep = stubsIE.v;
    stubsIE.v = () => cached; room.v = 0.6; const hc = Lp.run(wave); stubsIE.v = keep;
    check(hc.hires.length === 1 && JSON.stringify(cached) === snap, 'AX22: the cached diagnosis passed in is not mutated (UI keeps the backlog reading)');
  }
  {
    const keep = stubsIE.v; stubsIE.v = () => ({ bottleneckId: 'prisons', pressures: { police: 1, justice: 1, prisons: 2, recidivism: 1 } });
    const s14 = sj(1.4, 1); room.v = 0.2;
    check(Lp.run(s14).hires.length === 0, 'AX22: corrections hiring keeps the 0.3 room gate even with crime x1.4', Lp.run(s14));
    room.v = 0.35;
    check(Lp.run(s14).hires.length === 1 && Lp.run(s14).hires[0][0] === 'justiceCorrections', 'AX22: corrections hire at room 0.35 as in the game', Lp.run(s14));
    stubsIE.v = keep;
  }
  // AX35: the yearly limit counts from a real change, not from the starting target recorded on day 0.
  room.v = 0.6;
  const backlog = sj(1, 2);
  check(Lo.run(backlog, 200).hires.length === 0, 'AX35 negative control: original blocks police hiring in year 1 (target set on day 0)');
  check(Lp.run(backlog, 200).hires.length === 1, 'AX35: a backlog at day 200 with the starting target hires', Lp.run(backlog, 200));
  check(Lp.run(backlog, 200, { targetChangedDay: 100, targetSource: 'ai' }).hires.length === 0, 'AX35: an AI change at day 100 still blocks until day 465');
  check(Lp.run(backlog, 470, { targetChangedDay: 100, targetSource: 'ai' }).hires.length === 1, 'AX35: and allows it after 365 days');
  check(Lp.run(backlog, 200, { targetChangedDay: 0, targetSource: 'player' }).hires.length === 0, 'AX35: a player change on day 0 still counts');
  for (const [name, re] of [['health', /n\.targetSource!=='initial'&&r-Ke\(n\.targetChangedDay\)<TGo/], ['education', /o\.targetSource!=='initial'&&r-Ke\(o\.targetChangedDay\)<nWo/], ['administration', /n\.targetSource!=='initial'&&r-Ke\(n\.targetChangedDay\)<LWo/]])
    check(re.test(P) && !re.test(O), `AX35: the ${name} staffing rule skips the yearly limit for a starting target`);
  check(/targetSource="initial"/.test(O), 'AX35: the game marks starting targets "initial" (init Gzt)');
  {
    // Health (YGo): lasting pressure (l) with staffing at target (no shortage path u) is frozen in year 1 on the game.
    const hc = (text) => { const a = text.indexOf('var Jdr="health"'); return text.slice(a, text.indexOf(';', a) + 1); };
    const hk = (text) => { const m = /,KGo=([\d.]+),xGo=(\d+),OGo=([\d.]+),DGo=([\d.]+),TGo=(\d+),BGo=([\d.]+),PFe=([\d.]+),NGo=([\d.]+)/.exec(text); return m ? `var KGo=${m[1]},xGo=${m[2]},OGo=${m[3]},DGo=${m[4]},TGo=${m[5]},BGo=${m[6]},PFe=${m[7]},NGo=${m[8]};` : ''; };
    check(hk(O) !== '', 'AX35: health constants read from the bundle', hk(O));
    const hires = [];
    const mkH = (text) => new Function('Ke', 'Cxa', 'Gr', 'tO', 'zGo', `${hc(text)}${hk(text)}${fnSrc(text, 'YGo')};return YGo;`)(
      (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d), () => 1, () => 0.6, (t, i, x) => x, () => null);
    const HO = mkH(O), HP = mkH(P);
    const W = { setPublicHeadcountTarget: (r, n) => { hires.push([r, n]); return { ok: !0 }; } };
    const ctry = (src) => ({ health: { fatigue: 0.5 }, employment: { public: { health: { targetHeadcountM: 1, headcountM: 1, targetChangedDay: 0, targetSource: src } } } });
    const diagH = { pressures: { primary: 1.4, hospital: 1.2, emergency: 1, maternal: 1, supplies: 0.5 }, persistentMonths: { primary: 7, hospital: 7, emergency: 0, maternal: 0 } };
    const runH = (H, src, day) => { hires.length = 0; H(W, ctry(src), diagH, day); return hires.slice(); };
    check(runH(HO, 'initial', 200).length === 0, 'AX35 negative control: the game freezes health pressure hiring at day 200');
    check(runH(HP, 'initial', 200).length === 1 && Math.abs(runH(HP, 'initial', 200)[0][1] - 1.05) < 1e-12, 'AX35: health hires +5% at pressure 1.4 in year 1', runH(HP, 'initial', 200));
    check(runH(HP, 'ai', 200).length === 0, 'AX35: after an AI change the yearly health limit applies');
    check(runH(HP, 'ai', 400).length === 1 && runH(HO, 'ai', 400).length === 1, 'AX35: and both allow it after 365 days');
  }
}

// ---------- AX17 ----------
{
  const z = { band: 0 }, slot = { v: false };
  const st = { K5: () => !1, Zn: () => ({ band: z.band }), Apr: () => 0, ti: () => ({ month: slot.v ? 0 : 1 }), Pjo: 6 };
  const ld = (text) => load(text, ['wjo'], st, ['__geobalFiscalShock']);
  const Lo = ld(O), Lp = ld(P);
  const c = (band0, u, u0, extra = {}) => ({ key: '1', deficitNow: 3, unemployment: u, brain: { economicPolicy: { observation: { band: band0, unemploymentPct: u0 } } }, ...extra });
  const W = { rngSeed0: 1, day: 100 };
  z.band = 1;
  check(!Lo.wjo(W, c(0, 5, 5)), 'AX17 negative control: original waits for its quarterly month after a band rise');
  check(Lp.wjo(W, c(0, 5, 5)), 'AX17: band 0 -> 1 since the last review triggers a review');
  check(!Lp.wjo(W, c(1, 5, 5)), 'AX17: band unchanged at 1: no extra review');
  z.band = 0;
  check(!Lp.wjo(W, c(1, 5, 5)), 'AX17: band falling: no extra review');
  check(Lp.wjo(W, c(0, 7, 5)) && !Lo.wjo(W, c(0, 7, 5)), 'AX17: unemployment +2 points triggers a review');
  check(!Lp.wjo(W, c(0, 6.4, 5)), 'AX17: unemployment +1.4 points: no extra review');
  check(!Lp.wjo(W, c(0, 3, 5)), 'AX17: unemployment falling: no extra review');
  check(!Lp.wjo(W, { key: '1', deficitNow: 3, unemployment: 9, brain: {} }), 'AX17: no previous review: game rule only');
  check(!Lp.wjo(W, c(NaN, NaN, 5)) && !Lp.wjo(W, c(undefined, 'x', null)), 'AX17: missing numbers do not trigger');
  for (const sv of [true, false]) for (const extra of [{ defaulted: true }, { deficitNow: 7 }, {}]) {
    slot.v = sv; z.band = 0;
    const k = c(0, 5, 5, extra);
    check(Lp.wjo(W, k) === Lo.wjo(W, k), `AX17: no shock (slot ${sv}, ${JSON.stringify(extra)}): same as the game`);
  }
}

// ---------- AX18 ----------
{
  const z = { pressure: 0.2, band: 1 };
  const st = { __geobalGdpQ3: () => null, Zn: () => ({ ...z }), Zl: (x, d = 0) => (Number.isFinite(x) ? x : d) };
  const ld = (text) => load(text, ['h4t'], st, ['__geobalMarketTerm']);
  const Lo = ld(O), Lp = ld(P);
  const c = (br, avg, g0) => { const k = { bondRate: br, debtAvgRate: avg, gdpVol: 100, debtRatio: 60, growth: 1, unemployment: 5, inflation: 2 }; if (g0 !== undefined) k.__geobalBondGap0 = g0; return k; };
  z.pressure = 0.2;
  check(Lp.h4t(c(6.6, 4, 2.6), 5).pressure === 0.2 && Lo.h4t(c(6.6, 4, 2.6), 5).pressure === 0.2, 'AX18: gap at its baseline: pressure unchanged');
  check(Lp.h4t(c(7.6, 4, 2.6), 5).pressure === 0.2, 'AX18: gap widened 1 point: ignored');
  const r3 = Lp.h4t(c(9.6, 4, 2.6), 5);
  check(Math.abs(r3.pressure - 0.5) < 1e-12 && r3.band === 1, 'AX18: gap widened 3 points: pressure 0.5, band unchanged', r3);
  check(Lo.h4t(c(9.6, 4, 2.6), 5).pressure === 0.2, 'AX18 negative control: original ignores the yield');
  check(Lp.h4t(c(30, 4, 2.6), 5).pressure === 1, 'AX18: extreme widening clamps at 1');
  z.pressure = 0.9;
  check(Lp.h4t(c(9.6, 4, 2.6), 5).pressure === 0.9, 'AX18: higher rating pressure is kept');
  z.pressure = 0;
  check(Lp.h4t(c(6, 4, -3), 5).pressure === 1, 'AX18: a widening from a negative baseline counts in full (-3 to +2 = 5 points)', Lp.h4t(c(6, 4, -3), 5).pressure);
  check(Math.abs(Lp.h4t(c(4, 4, -2), 5).pressure - 0.25) < 1e-12, 'AX18: -2 to 0 is a 2-point widening: 0.25');
  const fresh = c(9.6, 4);
  check(Lp.h4t(fresh, 0).pressure === 0 && !('__geobalBondGap0' in fresh), 'AX18: no baseline is taken on day 0 (opening yields still being set)');
  check(Lp.h4t(fresh, 1).pressure === 0 && fresh.__geobalBondGap0 === 5.6, 'AX18: first reading from day 1 sets the baseline (no jump)', fresh);
  fresh.bondRate = 12.6;
  check(Math.abs(Lp.h4t(fresh, 40).pressure - 0.5) < 1e-12, 'AX18: then a 3-point widening gives 0.5');
  check(Lp.h4t(c(9.6, 4, null), 5).pressure === 0, 'AX18: a baseline lost as null in a save is re-set, not read as 0');
  { const parent = c(4, 4); parent.key = 'P'; Lp.h4t(parent, 1); const child = { ...parent, key: 'C', bondRate: 9 };
    check(Lp.h4t(child, 40).pressure === 0 && child.__geobalBondGap0 === 5 && child.__geobalBondGapKey === 'C', 'AX18: a seceded copy of a country takes its own baseline', child); }
  for (const [br, avg] of [[NaN, 4], [5, undefined], [Infinity, 2]]) {
    const k = c(br, avg, 1); const o = Lp.h4t(k, 5);
    check(o.pressure === 0 && k.__geobalBondGap0 === 1, `AX18: bad yields (${br}, ${avg}): no term, baseline untouched`);
  }
  const k = c(9.6, 4, 2.6), a = Lp.h4t(k, 5), b = Lo.h4t(k, 5);
  const ks = (o) => Object.keys(o).filter(x => !x.startsWith('__geobal')).sort().join();
  check(ks(a) === ks(b) && a.day === b.day && a.gdpBn === b.gdpBn, 'AX18: observation keeps every field');
  check(!P.includes('t.__geobalBondGap0=Number(t.bondRate)'), 'AX18: no baseline written at debt set-up (opening yields change after it)');
}

// ---------- AX27 ----------
{
  const sanc = [], wars = new Set();
  const targets = [{ key: '408', gap: 9 }, { key: '4', gap: 8 }, { key: '50', gap: 7 }, { key: '800', gap: 6 }];
  const st = {
    VMo: () => targets.map(t => ({ target: { key: t.key }, gapBnMo: t.gap })), BQ: () => !0, YMo: () => 0.5,
    zMo: (a, b) => b.score - a.score, Jr: { aid: { aiBilateralTargets: 2 } }, LB: () => sanc, M7: (e, a, b) => wars.has(`${a}-${b}`),
  };
  const ld = (text) => load(text, ['$Mo'], st, ['__geobalAidBarred', '__geobalAidSanctioned']);
  const Lo = ld(O), Lp = ld(P);
  const pick = (L) => L.$Mo({}, { key: '840' }).map(r => r.target.key).join();
  check(pick(Lp) === pick(Lo) && pick(Lp) === '408,4', 'AX27: no sanctions or wars: same two recipients');
  sanc.push({ sender: '840', target: '408' }, { sender: '250', target: '4' });
  check(pick(Lo) === '408,4', 'AX27 negative control: original funds the sanctioned state');
  check(pick(Lp) === '4,50', 'AX27: a state the donor sanctions is skipped; another sender\'s sanctions do not count', pick(Lp));
  wars.add('840-4');
  check(pick(Lp) === '50,800', 'AX27: a state the donor fights is skipped', pick(Lp));
  sanc.length = 0; wars.clear();
  sanc.push({ sender: 840, target: 408 });
  check(pick(Lp) === '4,50', 'AX27: numeric keys match string keys');
  check(Lp.$Mo({}, {}).length === 2, 'AX27: a donor without a key falls back to the game rule');
  check(P.includes("let c=i[l];if(!r.aidCommit[c])continue;if(e.playerControlsGovernment&&!e.playerControlsGovernment(r)&&__geobalAidBarred(e,r.key,c)){delete r.aidCommit[c];continue}") && O.includes('let c=i[l];if(!r.aidCommit[c])continue;'),
    'AX27: the monthly payout drops an AI-governed donor commitment to a barred recipient (player-run governments untouched)');
}

// ---------- AX30 ----------
{
  const launched = [], hawk = { v: 0.5 };
  const quote = { det: 0.3 };
  const mkWorld = () => ({ day: 100, rngSeed0: 1, intelligence: { services: { A: { readiness: { state: 1 } } }, networks: new Map() },
    countries: new Map([['A', { key: 'A', brain: {}, treasury: 100 }], ['B', { key: 'B' }]]), playerControlsGovernment: () => !1 });
  const st = {
    ti: () => ({ quarterKey: 0 }), Yp: (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d), K: (a, b) => (a < b ? -1 : a > b ? 1 : 0), vLo: () => [],
    h2r: (e, r, f) => ({ mission: f.mission, commandId: 'launchStateOperation', params: f, quote: { ok: !0, costBn: 0, domain: 'state', detectionProb: quote.det } }),
    aw: () => ({ ok: !0 }), iOe: (e, r, p) => { launched.push(p.mission); return { ok: !0 }; }, WX: () => [], Vpe: () => ({ targets: [{ countryKey: 'B' }] }),
    Pm: () => 0, Aa: () => 0, bLo: () => ({ key: 'B', rivalry: 0.9, relation: -90 }), M7: () => !0, SLo: () => ['energy'], PLo: () => [{ mission: 'sabotage_plant' }],
    zC: () => ({ ok: !0 }), Dn: () => ({ hawkish: hawk.v }), GBo: 0.45,
  };
  const ld = (text) => load(text, ['g2r'], st, ['__geobalSabotageExposed']);
  const Lo = ld(O), Lp = ld(P);
  const run = (L) => { launched.length = 0; L.g2r(mkWorld()); return launched.slice(); };
  quote.det = 0.3;
  check(run(Lp).join() === 'sabotage_plant' && run(Lo).join() === 'sabotage_plant', 'AX30: detection 0.3: sabotage goes ahead as in the game');
  quote.det = 0.6;
  check(run(Lo).join() === 'sabotage_plant', 'AX30 negative control: the original sabotages at detection 0.6');
  check(run(Lp).length === 0, 'AX30: detection 0.6 with a neutral leader: called off');
  hawk.v = 1; quote.det = 0.54;
  check(run(Lp).join() === 'sabotage_plant', 'AX30: a hawkish leader accepts up to 0.55');
  hawk.v = 0; quote.det = 0.36;
  check(run(Lp).length === 0, 'AX30: a dovish leader stops above 0.35');
  hawk.v = 0.5; quote.det = NaN;
  check(run(Lp).join() === 'sabotage_plant', 'AX30: no detection figure: the game rule applies');
  st.PLo = () => [{ mission: 'steal_state_secrets' }]; quote.det = 0.9;
  const L2 = load(P, ['g2r'], st, ['__geobalSabotageExposed']);
  check(run(L2).join() === 'steal_state_secrets', 'AX30: non-sabotage missions are not gated');
}

// ---------- AX32 ----------
{
  const room = { v: 0.5 }, applied = [];
  const st = {
    Pn: (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d), VUo: () => null, h4: () => [], KB: () => !1, Hd: 'public_wage', XI: () => null, Uo: (t) => ({ spending: { ...t.spend }, taxes: { ...t.taxes } }),
    A2: (e, t, y) => { applied.push(y.spending?.sante); return { applied: !0 }; }, pre: () => {}, BUo: () => null, NUo: () => null, HUo: () => null,
    K: (a, b) => (a < b ? -1 : a > b ? 1 : 0), r_: () => ({}), Gr: () => room.v,
  };
  const ld = (text) => load(text, ['$Uo'], st, ['__geobalConcedeShare']);
  const Lo = ld(O), Lp = ld(P);
  const mv = (mob, thr) => ({ id: 'm1', mobilization01: mob, regimeThreat01: thr, claim: { objectives: [{ id: 'o', metricId: 'fiscal_spend', subjectId: 'sante', openingValue: 5, targetValue: 7, weight: 1 }] } });
  const run = (L, m) => { applied.length = 0; L.$Uo({}, { brain: {}, spend: { sante: 5 }, taxes: {} }, m, 100); return applied.slice(); };
  check(Math.abs(run(Lo, mv(0.15, 0.05))[0] - 6) < 1e-12, 'AX32 negative control: the original gives a weak movement half the gap');
  check(run(Lp, mv(0.15, 0.05)).length === 0, 'AX32: a weak movement (0.15) gets no budget concession');
  check(Math.abs(run(Lp, mv(0.8, 0.2))[0] - 6) < 1e-12, 'AX32: a strong movement (0.8) gets the full half-step');
  check(Math.abs(run(Lp, mv(0.2, 0.56))[0] - (5 + 1 * 0.8)) < 1e-12, 'AX32: threat 0.56 gets 0.8 of the half-step', run(Lp, mv(0.2, 0.56)));
  room.v = 0.1;
  check(Math.abs(run(Lp, mv(0.8, 0))[0] - 5.5) < 1e-12, 'AX32: fiscal room below 0.2 halves it');
  room.v = NaN;
  check(Math.abs(run(Lp, mv(0.8, 0))[0] - 6) < 1e-12, 'AX32: unknown room: no halving');
  check(run(Lp, mv(NaN, undefined)).length === 0, 'AX32: missing strength counts as weak');
}

console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
