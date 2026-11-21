// P11, P12, PM4, PM5, LC2 and LC6 function test: code cut from the patched and the original bundle, run with stubs.
// Usage: node mods/geoplanetical-balance/tests/p11-p12-pm4-pm5-lc2-lc6.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const between = (text, from, to, max = 4000) => {
  const i = text.indexOf(from), j = text.indexOf(to, i);
  if (i < 0 || j < 0 || j - i > max) throw new Error(`${from} not found`);
  return text.slice(i, j + to.length);
};
const clamp = (A, B, Q) => Math.max(B, Math.min(Q, A));

// PM5: the country reaches both score calls.
const jz = text => (YQ, law) => new Function('xxt', 'Ra', 'ur', 'Vs', 'Ba', 'sn', 'Yo', `${between(text, 'function uH(e){', 'xxt.length)}')}; return uH;`)(
  ['minimum_wage'], () => ({ doctrine: { axes: { econ: -1 } } }), () => law.now, () => law.base, YQ, x => x, clamp);
// A stand-in for YQ's income-ratio score, not YQ itself: it keeps conversion and the income divisor and leaves out the
// floor, the ratio scale, indexation and coverage. The checks on what reaches YQ run the game's own jz.
const score = (g, amount, c) => (c ? amount / c.perUsd / (c.gdpCap * 1e3) : amount / 1e4) * 100;
const weak = { perUsd: 1000, gdpCap: 4, key: 'W' };
{
  const seen = [];
  jz(patched)((g, v, c) => { seen.push(c); return score(g, v, c); }, { now: 110, base: 100 })(weak);
  check(seen.length === 2 && seen.every(c => c === weak), 'PM5 patched: the country is passed to both score calls');
  const old = [];
  jz(original)((g, v, c) => { old.push(c); return score(g, v, c); }, { now: 110, base: 100 })(weak);
  check(old.every(c => c == null), 'PM5 original: no country (the bug)');
  const big = { now: 137280, base: 124800 };
  const P = jz(patched)((g, v, c) => score(g, v, c), big)(weak), V = jz(original)((g, v, c) => score(g, v, c), big)(weak);
  check(P < 0.1 && V === 1, 'PM5: on the income-ratio form, a 10% rise in a weak currency is small with the country, at the ceiling without', `${P.toFixed(4)} vs ${V.toFixed(3)}`);
  check(jz(patched)((g, v, c) => score(g, v, c), { now: 100, base: 100 })(weak) === 0, 'PM5: no change in the law, no pressure (day 0)');
}
check(/function Ba\(e,t,a=null\)\{/.test(patched) && /dynamic==="income_ratio"/.test(patched), 'PM5: the score still takes a country');

// PM4: the threshold, with the game's own rule table.
const oIBsrc = between(patched, 'function kbt(e){', 'referendum:!1}}}');
const pct = text => {
  const expr = text.match(/\{type:"supermajority",pct:a\.amendmentPct.{0,120}?\}(?=,i=t==="constitutional_amendment")/)[0];
  return new Function('kbt', 'e', 'a', `return (${expr}).pct`).bind(null, new Function(`${oIBsrc}; return kbt;`)());
};
const P4 = pct(patched), V4 = pct(original);
for (const [rule, want] of [['flexible', 0.5], ['qualified2_3', 2 / 3], ['referendum', 0.6], [undefined, 0.6]]) {
  const c = { amendment: rule ? { rule } : undefined };
  check(near(P4(c, {}), want), `PM4 patched: rule ${rule}: ${want.toFixed(3)}`);
  check(V4(c, {}) === 0.6, `PM4 original: rule ${rule}: 0.6`);
}
check(P4({ amendment: { rule: 'flexible' } }, { amendmentPct: 0.8 }) === 0.8, 'PM4: a reform\'s own figure still wins');
check(P4({}, {}) === 0.6, 'PM4: a constitution with no amendment record: 0.6');
check(/_reformExecCtx\(t\)\{return\{amendmentPct:this\._amendmentThreshold\(t\.pol\)\.pct\}\}/.test(patched), 'PM4: reforms still pass their own figure');

// P11.
const pen = (text, name) => {
  const src = between(text, `"default",t.defaulted?-${name}`, ':0,ki.economy', 300).slice('"default",'.length, -',ki.economy'.length);
  return new Function(name, 'e', 't', `return ${src}`).bind(null, name === 'sme' ? 12 : 10);
};
for (const [name, base] of [['sme', 12], ['E5t', 10]]) {
  const P = pen(patched, name), V = pen(original, name);
  const at = (days, d = 1000) => P({ day: d + days }, { defaulted: true, defaultDay: d });
  check(near(at(0), -base), `P11 ${name}: the default day pays the full ${base}`);
  check(near(at(365), -base * 0.625), `P11 ${name}: after a year, 62.5%`, at(365).toFixed(3));
  check(near(at(365 * 40), -base * 0.25, 1e-6), `P11 ${name}: after decades, the quarter that remains`);
  check(V({ day: 1000 + 365 * 40 }, { defaulted: true, defaultDay: 1000 }) === -base, `P11 ${name} original: flat for ever (the bug)`);
  check(P({ day: 1000 }, { defaulted: false, defaultDay: 1 }) === 0, `P11 ${name}: no default, no penalty`);
  check(near(P({ day: 0 }, { defaulted: true }), -base), `P11 ${name}: a country starting in default pays the full penalty at day 0`);
  check(near(P({ day: 365 }, { defaulted: true }), -base * 0.625), `P11 ${name}: and counts from day 0`);
  check(near(at(-5), -base), `P11 ${name}: a clock before the default day cannot raise it`);
  let mono = true; for (let d = 0; d < 4000; d += 50) if (at(d + 50) < at(d)) mono = false;
  check(mono, `P11 ${name}: the penalty only fades`);
}

// P12.
const IDB = text => new Function('Iu', `${between(text, 'function Gyt(e,t,a=0){', '))}')}; return Gyt;`)(clamp);
const P12 = IDB(patched), V12 = IDB(original);
const party = (support, cred) => ({ support, organization: { credibility: cred } });
for (const c of [0, 0.25, 0.5, 0.75, 1]) check(near(P12(party(30, c), 0), V12(party(30, c), 0)), `P12: no campaign: same as the original at credibility ${c}`);
for (const q of [-8, -3, 3, 8]) check(near(P12(party(30, 0.5), 0, q), V12(party(30, 0.5), 0, q)), `P12: promises of ${q}, no campaign: same as the original`);
check(P12(party(30, 1), 50, 8) > P12(party(30, 1), 40, 8), 'P12: with full credibility and promises, more campaign still counts');
check(near(P12(party(30, 0.5), 40), 30 * Math.exp(0.08)), 'P12 patched: score 40 adds about 8%', P12(party(30, 0.5), 40).toFixed(2));
check(near(V12(party(30, 0.5), 40), 30 * Math.exp(0.35)), 'P12 original: score 40 takes 30 to about 42.6, before shares are renormalised (the bug)', V12(party(30, 0.5), 40).toFixed(2));
check(P12(party(30, 0.5), 50) > P12(party(30, 0.5), 40), 'P12: more campaign still helps up to the cap');
check(near(P12(party(30, 1), 1000), 30 * Math.exp(0.24)) && near(P12(party(30, 0), -1000), 30 * Math.exp(-0.24)), 'P12: held at the clamp');
check(P12(party(0, 0.5), 40) === 0 && P12({ support: -5 }, 10) === 0, 'P12: no support stays at zero');

// LC2.
const score2 = text => {
  const m = text.match(/d=(-\.\d+)\+l\+u\+o\*\.22\+i,p=\[/);
  if (!m) throw new Error('peace appeal score not found');
  return (D, E, C, r) => Number(m[1]) + D + E + C * 0.22 + r;
};
const S2P = score2(patched), S2V = score2(original);
check(S2P(0.35, 0.21, 1, 0.06) >= 0.5 && S2V(0.35, 0.21, 1, 0.06) < 0.5, 'LC2: best partner, long war, exhaustion 70: accepted (the original refuses)');
check(S2P(0.1, 0.05, 0.2, 0) < 0.5, 'LC2: a young war with little exhaustion still refuses');
check(S2P(0.35, 0.3, 0, 0) >= 0.5, 'LC2: at full exhaustion in a long war, a neutral partner can accept');
check(S2V(0.35, 0.3 * 0.96, 1, 0.06) < 0.5, 'LC2 original: exhaustion 96 still refuses (the bug)');

// LC6: the response.
// AX16 (balance 0.7.0) adds two helpers to W7a; with no aggressor nukes, power or trade (GK, Y7t, zl stubbed to 0) they
// change nothing, so the LC6 checks below keep their meaning.
const fnText = (text, name) => { const s = text.indexOf(`function ${name}(`); if (s < 0) return ''; let d = 0, i = text.indexOf('{', text.indexOf(')', s)); for (; i < text.length; i++) { if (text[i] === '{') d++; else if (text[i] === '}' && --d === 0) break; } return text.slice(s, i + 1); };
const P1Q = text => new Function('Dn', 'wl', 'FQ', 'df', 'GK', 'Y7t', 'zl', `${fnText(text, '__geobalTreatyRisk')}${fnText(text, '__geobalTreatyAdj')}${between(text, 'function W7a(e,t){', 'reasons:g}}')}; return W7a;`)(() => ({ hawkish: 0.6, riskTolerance: 0.5 }), () => false, () => null, () => ({ ok: true }), () => ({ value: 0 }), () => 0, () => 0);
const treaty = (align = { d: 0.6, a: 0.3 }) => ({
  countries: new Map([['m', { key: 'm', treasury: 1 }], ['d', { key: 'd' }], ['a', { key: 'a' }]]),
  militaryTreaties: new Map([['t', { credibility: 0.92 }]]),
  _alignment: (x, y) => align[y.key],
});
const call = memberBreach => ({ memberKey: 'm', defenderKey: 'd', aggressorKey: 'a', treatyId: 't', warId: 'w', memberBreach });
const P6 = P1Q(patched), V6 = P1Q(original);
check(V6(treaty(), call(true)).response === 'join', 'LC6 original: the hand example joins against the ally (the bug)');
check(P6(treaty(), call(true)).response === 'access', 'LC6 patched: the same case stops at access');
check(P6(treaty({ d: 0.1, a: 0.9 }), call(true)).response === 'refuse', 'LC6: closer to the attacker: refuses');
check(P6(treaty({ d: 1, a: -1 }), call(true)).response === 'access', 'LC6: even a very close defender gets no more than access');
check(P6(treaty(), call(false)).response === V6(treaty(), call(false)).response && near(P6(treaty(), call(false)).score, V6(treaty(), call(false)).score), 'LC6: an attack from outside the treaty is unchanged');
check(P6(treaty(), call(true)).reasons.includes('member_aggression'), 'LC6: the reason is still recorded');
// LC6: the settlement cost.
const settle = text => {
  const src = between(text, 'if(c<1){', 'obligation:.8*(1-c)})}', 500) + (text === patched ? '}' : '');
  return (g, Q, D = [{ violations: [] }]) => {
    const log = [], o = { join: 1, support: 1, access: 0.25, refuse: 0 }[Q];
    new Function('e', 'r', 'a', 'l', 'c', 'hde', 'eRe', 'bp', 'D7a', src)({ day: 5, countries: new Map() }, g, Q, D, o, T => log.push(`cred:${T.id ?? '-'}`), () => -0.2, () => log.push('rel'), T => T.members || []);
    return { log, violations: D[0].violations.length, byTreaty: D.map(T => T.violations.length) };
  };
};
const SP = settle(patched), SV = settle(original);
{
  // A member of the attacker's treaty and of a separate pact refuses: only the pact (the attacker is not in it) takes
  // the credibility loss and the refusal record; the original charged every treaty on the call.
  const two = () => [{ id: 'nato', members: ['a', 'd', 'm'], violations: [] }, { id: 'pact', members: ['d', 'm'], violations: [] }];
  const p = SP({ memberBreach: false, aggressorKey: 'a' }, 'refuse', two()), v = SV({ memberBreach: false, aggressorKey: 'a' }, 'refuse', two());
  check(p.log.join() === 'cred:pact,rel' && p.byTreaty.join() === '0,1', 'LC6 patched: a mixed member\'s refusal is charged to the pact only', JSON.stringify(p));
  check(v.log.join() === 'cred:nato,cred:pact,rel' && v.byTreaty.join() === '1,1', 'LC6 original: every treaty on the call is charged', JSON.stringify(v));
  const out = SP({ memberBreach: false, aggressorKey: 'z' }, 'refuse', two());
  check(out.log.join() === 'cred:nato,cred:pact,rel' && out.byTreaty.join() === '1,1', 'LC6: an outside attacker: every treaty is still charged');
}
// LC6: AI members are answered after every treaty is on the call (the whole jle, with stubs).
{
  const T1 = { id: 'nato', members: ['a', 'd', 'm', 'n'], violations: [] }, T2 = { id: 'pact', members: ['d', 'm'], violations: [] };
  const run = (text, treaties) => {
    const src = between(text, 'function vde(e,t,a,r,o="detailed",n={}){', '}return i}', 3000);
    const seen = [];
    const yV = (A, id, resp) => { const c = A.militaryCalls.get(id); seen.push({ m: c.memberKey, treaties: c.treatyIds.slice(), breach: c.memberBreach, resp }); c.status = 'resolved'; c.response = resp; return { ok: true }; };
    const jle = new Function('bh', 'N7a', 'D7a', 'qB', 'G7a', 'Tao', 'La', 'H', 'JQ', 'Hao', 'wl', 'ds', 'Uao', `${src}; return vde;`)(
      () => treaties.map(T => ({ ...T, violations: [] })), () => true, T => T.members, T => T.members, () => true, (() => { let k = 0; return () => `c${++k}`; })(),
      () => ({ id: 'dec' }), () => {}, yV, () => 'refuse', () => null, () => {}, () => {}); // Uao: 1.1.5's non-aggression breach, not under test
    jle({ day: 3, militaryCalls: new Map(), playerKey: 'p', playerControlsGovernment: k => k === 'p' }, 'w1', 'a', 'd', 'detailed', { preview: [] });
    return seen;
  };
  for (const order of [[T1, T2], [T2, T1]]) {
    const s = run(patched, order), m = s.filter(x => x.m === 'm');
    check(m.length === 1 && m[0].treaties.length === 2 && m[0].breach === false,
      `LC6 patched: the mixed member is answered once, with both treaties on its call and no breach (${order.map(T => T.id).join(' first, ')})`, JSON.stringify(m));
  }
  const o = run(original, [T1, T2]).filter(x => x.m === 'm');
  check(o.length === 1 && o[0].treaties.length === 1, 'LC6 original: the member is answered inside the first treaty, with only that treaty on its call', JSON.stringify(o));
}
check(SP({ memberBreach: true }, 'refuse').log.length === 0 && SP({ memberBreach: true }, 'refuse').violations === 0, 'LC6 patched: refusing an ally\'s war on an ally costs nothing');
check(SV({ memberBreach: true }, 'refuse').log.length === 2 && SV({ memberBreach: true }, 'refuse').violations === 1, 'LC6 original: it costs credibility and standing');
check(SP({ memberBreach: false }, 'refuse').log.length === 2 && SP({ memberBreach: false }, 'refuse').violations === 1, 'LC6: refusing against an outside attacker still costs');
check(SP({ memberBreach: false }, 'access').log.length === 2 && SP({ memberBreach: false }, 'access').violations === 0, 'LC6: access against an outside attacker still costs credibility');
check(/t\.memberBreach&&L7a\[o\]<1\?0:eRe\(o\)/.test(patched), 'LC6: the player\'s decision screen shows the same');
// LC6: a call counts as a breach only if the attacker is in every treaty behind it.
// Runs the game's own merge in both places a call is built, with two treaties in both orders.
{
  const T1 = { id: 'both', members: ['a', 'd', 'm'] }, T2 = { id: 'pact', members: ['d', 'm'] }, T3 = { id: 'other', members: ['a', 'd', 'm'] };
  const common = { n1Q: E => E.members, fL: E => E.members, u1Q: () => true };
  const preview = (text, treaties) => {
    const src = between(text, 'function O9(e,t,a){', 'defenderKey:a})})}', 800);
    const f = new Function('bh', 'N7a', 'D7a', 'qB', 'G7a', 'W7a', `${src}; return O9;`)(() => treaties, () => true, common.n1Q, common.fL, common.u1Q, (A, c) => ({ response: 'x', memberBreach: c.memberBreach }));
    return f({ playerControlsGovernment: () => false }, 'a', 'd').find(c => c.memberKey === 'm').memberBreach;
  };
  // `at`: the flag when the call is created, which is what an AI member's immediate settlement (`yV` inside the same
  // loop) reads; otherwise the flag after every treaty has been merged.
  const created = (text, treaties, at = false) => {
    const body = between(text, 'for(let u of s)for(let d of qB(u,r,{theaterKey:r})){let p=', 'decisionId:null};', 900);
    const f = new Function('e', 't', 'a', 'r', 'o', 's', 'c', 'i', 'D7a', 'qB', 'G7a', 'Tao', 'seen', `${body}seen.push([f.memberKey,f.memberBreach]);e.militaryCalls.set(f.id,f);i.push(f)}`);
    const A = { militaryCalls: new Map(), day: 1 }; let id = 0; const seen = [];
    const o = new Set(treaties.filter(E => E.members.includes('a')).flatMap(E => E.members));
    f(A, 'w1', 'a', 'd', 'detailed', treaties, o, [], common.n1Q, common.fL, common.u1Q, () => `c${++id}`, seen);
    return at ? seen.find(([k]) => k === 'm')[1] : [...A.militaryCalls.values()].find(c => c.memberKey === 'm').memberBreach;
  };
  check(created(patched, [T1, T2], true) === false && created(patched, [T2, T1], true) === false,
    'LC6 call: a separate pact without the attacker is not a breach already when the call is made, in either order');
  check(created(patched, [T1, T3], true) === true, 'LC6 call: the attacker in every treaty is a breach when the call is made');
  // A defender's pact that does not name the member does not excuse it (the merge looks only at treaties naming it).
  const T4 = { id: 'aside', members: ['d', 'x'] };
  check(created(patched, [T1, T4], true) === true && created(patched, [T4, T1], true) === true && preview(patched, [T1, T4]) === true,
    'LC6: a defender pact that does not name the member leaves its breach in place (both orders, preview too)');
  for (const [name, fn] of [['preview', preview], ['call', created]]) {
    check(fn(patched, [T1, T2]) === false && fn(patched, [T2, T1]) === false, `LC6 ${name}: a separate pact without the attacker: not a breach, in either order`);
    check(fn(patched, [T1, T3]) === true, `LC6 ${name}: the attacker in every treaty: a breach`);
    check(fn(patched, [T2]) === false && fn(patched, [T1]) === true, `LC6 ${name}: one treaty: decided by that treaty`);
    check(fn(original, [T1, T2]) === true, `LC6 ${name} original: the mixed call counts as a breach`);
  }
}
// LC6: access inside a breach does not enter the war.
{
  const tail = text => {
    const src = between(text, 'u&&d&&!s&&a!=="support"&&', 'e._deployCoalitionParticipant(u,r.memberKey,d.side))', 400);
    return (g, Q) => { const log = []; new Function('e', 'r', 'a', 'u', 'd', 's', 'x9', 'J4', src)({}, g, Q, { id: 'x' }, { side: 't' }, null, () => log.push('r7'), (...r) => log.push(r[4])); return log; };
  };
  const TP = tail(patched), TV = tail(original);
  check(TV({ memberKey: 'm', memberBreach: true }, 'access').includes('support'), 'LC6 original: access enters the war as support (the bug)');
  check(TP({ memberKey: 'm', memberBreach: true }, 'access').length === 0, 'LC6 patched: access to a breach stays out of the war');
  check(TP({ memberKey: 'm', memberBreach: false }, 'access').includes('support'), 'LC6: access against an outside attacker still enters as support');
  check(TP({ memberKey: 'm', memberBreach: true }, 'join').includes('cobelligerent'), 'LC6: a player who chooses to join still can');
}

console.log(failures ? `${failures} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
