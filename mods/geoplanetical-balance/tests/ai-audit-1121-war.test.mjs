// Function tests for the AI audit war set of 2026-11-21 (build 26734764): AX14 (war and crisis utilities weigh the
// attacker's finances and expected sanctions), AX16 (treaty allies weigh the aggressor's nuclear cover, strength and trade ties), AX23 (crisis opponents
// are threats), AX25 (second war). AX15 is held (proposals/held/tests/ax15.test.mjs). Each function runs from the original
// and the patched bundle on the same inputs with its helpers stubbed; every effect has a negative control.
// Usage: node mods/geoplanetical-balance/tests/ai-audit-1121-war.test.mjs (from the repo root)
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
  let depth = 0, i = text.indexOf('{', text.indexOf(')', s));
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(s, i + 1);
};
const load = (text, names, stubs, helpers = []) => {
  const src = names.map(n => fnSrc(text, n)).join('\n') + helpers.map(n => fnSrc(text, n, false)).join('\n');
  const keys = Object.keys(stubs);
  return new Function(...keys, `${src};return {${names.join(',')}};`)(...keys.map(k => stubs[k]));
};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ---------- AX14 ----------
{
  const zn = { pressure: 0 };
  const st = { Zn: () => ({ ...zn }), j5: clamp, Kv: (x, d = 0) => (Number.isFinite(x) ? x : d), xm: () => null, Z5a: new Set() };
  const Lo = load(O, ['y9o'], st), Lp = load(P, ['y9o'], st, ['__geobalWarEcon']);
  const inputs = (actor) => ({ actor, leader: { ambition: 0.5, hawkish: 0.5, nationalist: 0.5, authoritarian: 0.5, integrity: 0.5, institutionalist: 0.5 },
    targetKey: '1', hostility: 0.8, powerRatio: 1.5, tradeExposure: 0.1, domesticFragility: 0, nuclearRisk: 0, crisisPressure01: 0.5, targetFragility: 0, openQuote: null });
  const obj = (leg) => ({ id: 'status:x', allowsWar: true, legitimacy01: leg, warGoalType: 'status', preference: 0 });
  const actor = (extra = {}) => ({ brain: { priorities: { security: 0.4 } }, gdpVol: 1000, exports: 200, imports: 200, ...extra });
  const u = (L, a, leg) => L.y9o(inputs(a), obj(leg)).utilities;
  zn.pressure = 0;
  const solventClosed = actor({ exports: 0, imports: 0 });
  check(near(u(Lp, solventClosed, 0.3).war, u(Lo, solventClosed, 0.3).war) && near(u(Lp, solventClosed, 0.3).coercion, u(Lo, solventClosed, 0.3).coercion),
    'AX14: solvent closed economy: utilities unchanged');
  const open = actor();
  check(near(u(Lp, open, 1).war, u(Lo, open, 1).war), 'AX14: a fully legitimate war carries no sanction term');
  check(near(u(Lo, open, 0.3).war - u(Lp, open, 0.3).war, 0.4 * 0.2 * 0.7), 'AX14: open economy, weak legitimacy: war cost +0.4 x openness x (1 - legitimacy)',
    u(Lo, open, 0.3).war - u(Lp, open, 0.3).war);
  zn.pressure = 0.5;
  const stressed = actor({ exports: 0, imports: 0 });
  check(near(u(Lo, stressed, 0.3).war - u(Lp, stressed, 0.3).war, 0.15), 'AX14: fiscal pressure 0.5 adds 0.15 to the war cost');
  check(near(u(Lo, stressed, 0.3).coercion - u(Lp, stressed, 0.3).coercion, 0.35 * 0.15), 'AX14: and 0.35 of it to crisis coercion');
  { const w5 = u(Lo, stressed, 0.3).war; zn.pressure = 0; const w0 = u(Lo, stressed, 0.3).war; zn.pressure = 0.5;
    check(w5 === w0, 'AX14 negative control: the original war utility is the same at fiscal pressure 0 and 0.5', [w0, w5]); }
  zn.pressure = 1;
  const broke = actor({ defaulted: true, _trade: { openness: 100 } });
  check(near(u(Lo, broke, 0).war - u(Lp, broke, 0).war, 0.3 + 0.4 + 0.4), 'AX14: defaulted, full pressure, fully open, illegitimate: +1.1 cost (bound)');
  for (const bad of [{ gdpVol: 0, gdp: 0 }, { gdpVol: NaN, exports: NaN }, { _trade: { openness: 'x' } }, { _trade: { openness: -50 } }]) {
    zn.pressure = NaN;
    const d = u(Lo, actor(bad), 0.3).war - u(Lp, actor(bad), 0.3).war;
    check(Number.isFinite(d) && d >= 0 && d <= 1.1 + 1e-9, `AX14: bad inputs ${JSON.stringify(bad)}: finite bounded cost`, d);
  }
  const notWar = { ...obj(0.3), allowsWar: false };
  zn.pressure = 0.5;
  check(Lp.y9o(inputs(stressed), notWar).utilities.war === -2, 'AX14: an objective that disallows war stays at -2');
}

// ---------- AX25 ----------
{
  const zn = { pressure: 0 };
  const st = { Zn: () => ({ ...zn }), j5: clamp, Kv: (x, d = 0) => (Number.isFinite(x) ? x : d), xm: () => null, Z5a: new Set() };
  const Lo = load(O, ['y9o'], st), Lp = load(P, ['y9o'], st, ['__geobalWarEcon']);
  const inp = (actor) => ({ actor, leader: { ambition: 0.5, hawkish: 0.5, nationalist: 0.5, authoritarian: 0.5, integrity: 0.5, institutionalist: 0.5 },
    targetKey: '1', hostility: 0.8, powerRatio: 1.5, tradeExposure: 0, domesticFragility: 0, nuclearRisk: 0, crisisPressure01: 0.5, targetFragility: 0, openQuote: null });
  const obj = { id: 'status:x', allowsWar: true, legitimacy01: 1, warGoalType: 'status', preference: 0 };
  const peace = { brain: { priorities: {} }, exports: 0, imports: 0, gdpVol: 100 }, war = { ...peace, atWar: true };
  check(near(Lp.y9o(inp(peace), obj).utilities.war, Lo.y9o(inp(peace), obj).utilities.war), 'AX25: at peace: war utility unchanged');
  check(near(Lo.y9o(inp(war), obj).utilities.war - Lp.y9o(inp(war), obj).utilities.war, 0.35), 'AX25: already at war: war utility 0.35 lower');
  check(Lo.y9o(inp(war), obj).utilities.war === Lo.y9o(inp(peace), obj).utilities.war, 'AX25 negative control: the original ignores an existing war');
  check(near(Lp.y9o(inp(war), obj).utilities.coercion, Lo.y9o(inp(war), obj).utilities.coercion), 'AX25: coercion unchanged');
  check(Lp.y9o(inp(war), { ...obj, allowsWar: false }).utilities.war === -2, 'AX25: an objective without war stays at -2');
}

// ---------- AX23 ----------
{
  const rel = new Map(), rung = new Map();
  const st = {
    Ato: () => null, h8a: (c) => c.value ?? 10, Eto: () => 0, ks: (k, d) => d, g8a: () => !1, ide: clamp, y5: (x, d = 0) => (Number.isFinite(x) ? x : d),
    At: (e, a, b) => rel.get(b.key) ?? 0, Rto: () => ({ land: 1 }), Dn: () => ({ authoritarianRaw: 0.5, competence: 0.5, riskTolerance: 0.5 }),
    K: (a, b) => (a < b ? -1 : a > b ? 1 : 0), Fs: (c, k) => rung.get(`${c.id}:${k}`) ?? 0,
  };
  const names = ['__geobalCrisisList', '__geobalCrisisFoeKeys', '__geobalCrisisFoes', '__geobalCrisisThreat', '__geobalCrisisSig'];
  const Lo = load(O, ['P1t'], st), Lp = load(P, ['P1t'], st, names);
  const T = { key: 'T', forces: {}, brain: {}, value: 10 }, F = { key: 'F', forces: {}, value: 30 }, N = { key: 'N', forces: {}, value: 30 };
  const crises = new Map([['c1', { id: 'c1', status: 'active', openerKey: 'F', targetKey: 'T' }]]);
  const world = { countries: new Map([['T', T], ['F', F], ['N', N]]), world: { adjacency: { T: ['N'] } }, securityCrises: { crises } };
  rung.set('c1:F', 3);
  const a = Lo.P1t(world, T), b = Lp.P1t(world, T);
  check(!a.primary && b.primary?.key === 'F' && b.primary.hostility === 1, 'AX23: a distant crisis opener at rung 3 becomes the primary threat (hostility 1)', [a.primary, b.primary?.key, b.primary?.hostility]);
  check(a.aggregatePressure === 0 && b.aggregatePressure > 0, 'AX23 negative control: the original sees no threat from a non-adjacent crisis opener');
  rung.set('c1:F', 1);
  check(Math.abs(Lp.P1t(world, T).primary.hostility - 1 / 3) < 1e-12, 'AX23: rung 1 gives hostility 1/3');
  rung.set('c1:F', 0);
  check(Lp.P1t(world, T).primary === null, 'AX23: rung 0 stays below the 0.15 floor');
  rel.set('N', -60); rung.set('c1:F', 0);
  check(JSON.stringify(Lp.P1t(world, T)) === JSON.stringify(Lo.P1t(world, T)), 'AX23: without crisis escalation the threat is the game\'s own');
  crises.get('c1').status = 'resolved'; rung.set('c1:F', 3);
  check(JSON.stringify(Lp.P1t(world, T)) === JSON.stringify(Lo.P1t(world, T)), 'AX23: a closed crisis counts for nothing');
  crises.get('c1').status = 'active';
  check(/warSignature:`\$\{t\.atWar\?1:0\}:\$\{r\}\$\{__geobalCrisisSig\(e,t\.key\)\}`/.test(P), 'AX23: the defence-review signature carries the crisis opponents');
  const Ls = load(P, ['__geobalCrisisSig'], st, ['__geobalCrisisList', '__geobalCrisisFoeKeys']);
  rung.set('c1:F', 2);
  check(Ls.__geobalCrisisSig(world, 'T') === ':F=2' && Ls.__geobalCrisisSig(world, 'N') === '', 'AX23: signature lists F at rung 2 for T; empty for N (old saves compare equal)', Ls.__geobalCrisisSig(world, 'T'));
  rung.set('c1:F', 0);
  check(Ls.__geobalCrisisSig(world, 'T') === '', 'AX23: an opponent at rung 0 adds nothing to the signature');
  crises.get('c1').supporters = { N: 'opener', T2: 'target' }; rung.set('c1:N', 3); rung.set('c1:F', 3);
  check(Ls.__geobalCrisisSig(world, 'T') === ':F=3,N=3', 'AX23: a supporter on the other side is an opponent; a second opponent escalating changes the signature', Ls.__geobalCrisisSig(world, 'T'));
  check(Lp.P1t(world, T).rivalArms.some(x => x.key === 'N'), 'AX23: an escalated supporter is on the threat list');
  rung.set('c1:N', 0); world.world.adjacency.T = []; rel.set('N', -60);
  check(!Lp.P1t(world, T).rivalArms.some(x => x.key === 'N'), 'AX23: a supporter at rung 0 is not added (no escalation of its own)');
  world.world.adjacency.T = ['N']; rel.delete('N');
  delete crises.get('c1').supporters;
}

// ---------- AX16 ----------
{
  const pw = new Map(), nuc = new Map(), trade = new Map();
  const st = {
    Dn: () => ({ hawkish: 0.5, riskTolerance: 0 }), wl: () => !1, FQ: () => null, df: () => ({ ok: !0 }),
    GK: (e, a, o) => ({ value: nuc.get(o) ?? 0 }), Y7t: (e, c) => pw.get(c.key) ?? 0, zl: (a, ks) => trade.get(ks[0]) ?? 0,
  };
  const Lo = load(O, ['W7a'], st), Lp = load(P, ['W7a'], st, ['__geobalTreatyRisk', '__geobalTreatyAdj']);
  const M = { key: 'M', treasury: 10 }, D = { key: 'D' }, A = { key: 'A' };
  const align = { M: { D: 0.8, A: -0.2 } };
  const world = { countries: new Map([['M', M], ['D', D], ['A', A]]), militaryTreaties: new Map([['t', { credibility: 0.8 }]]), _alignment: (x, y) => align[x.key]?.[y.key] ?? 0 };
  const call = { memberKey: 'M', defenderKey: 'D', aggressorKey: 'A', treatyId: 't', warId: 'w' };
  const sc = (L) => L.W7a(world, call);
  pw.set('A', 100); pw.set('M', 60); pw.set('D', 50);
  check(near(sc(Lp).score, sc(Lo).score) && sc(Lp).response === sc(Lo).response, 'AX16: weaker aggressor, no nukes, no trade: same answer', [sc(Lp), sc(Lo)]);
  const base = sc(Lo).score;
  check(sc(Lo).response === 'join', 'AX16: the case is a join call on the original', sc(Lo));
  nuc.set('A', 1);
  check(near(base - sc(Lp).score, 0.45) && sc(Lp).response === 'support', 'AX16: nuclear-armed aggressor: cautious ally supports instead of joining', sc(Lp));
  check(sc(Lo).score === base, 'AX16 negative control: the original ignores the aggressor\'s nukes');
  nuc.set('A', 0); pw.set('A', 330);
  check(near(base - sc(Lp).score, 0.5), 'AX16: aggressor three times member+defender: power term at its cap 0.5', base - sc(Lp).score);
  pw.set('A', 100); trade.set('A', 0.5);
  check(near(base - sc(Lp).score, 0.15), 'AX16: half of trade with the aggressor: -0.15', base - sc(Lp).score);
  st.Dn = () => ({ hawkish: 0.5, riskTolerance: 1 });
  const Lp2 = load(P, ['W7a'], st, ['__geobalTreatyRisk', '__geobalTreatyAdj']), Lo2 = load(O, ['W7a'], st);
  check(near(Lo2.W7a(world, call).score - Lp2.W7a(world, call).score, 0.15 / 3), 'AX16: a reckless leader weighs it a third as much');
  {
    // A weak call (access on the original) is never pushed to a refusal.
    align.M = { D: 0.15, A: 0 }; M.treasury = -1; nuc.set('A', 1); trade.set('A', 0); pw.set('A', 100);
    const o = Lo2.W7a(world, call), p = Lp2.W7a(world, call);
    st.Dn = () => ({ hawkish: 0.5, riskTolerance: 0 });
    const Lp3 = load(P, ['W7a'], st, ['__geobalTreatyRisk', '__geobalTreatyAdj']), Lo3 = load(O, ['W7a'], st);
    const o3 = Lo3.W7a(world, call), p3 = Lp3.W7a(world, call);
    check(o3.response === 'access' && p3.response === 'access' && p3.score > 0.12 && p3.score < o3.score, 'AX16: access stays access under the penalty (floor at the access line)', [o3, p3]);
    align.M = { D: 0.0, A: 0.3 };
    const o4 = Lo3.W7a(world, call), p4 = Lp3.W7a(world, call);
    check(o4.response === 'refuse' && p4.score === o4.score, 'AX16: a refusal is unchanged', [o4.score, p4.score]);
    align.M = { D: 0.8, A: -0.2 }; M.treasury = 10; void o; void p;
  }
  trade.set('A', NaN); pw.set('A', NaN); nuc.set('A', 'x');
  check(Number.isFinite(Lp2.W7a(world, call).score), 'AX16: bad inputs give a finite score');
}

console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
