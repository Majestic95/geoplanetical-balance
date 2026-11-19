// CB16 function test: strikes on energy that leave more than 20 points of extra unserved electricity count as a war
// crime. Runs the game's own accountability ledger (gHt, vHt, xve, Kve, lAr, _Ht), its war validator (U9e) and the
// patch's helpers, all sliced from the built bundles, on hand-made wars: the strict 20-point bar, the split between
// strikers in one war and across wars, no double charge, strikes before a baseline, target types (energy fields count, metal mines do not),
// a month with no strike, a victim outside the campaign baseline, key order, and a save validation that keeps the new
// fields.
// Usage: node mods/geoplanetical-balance/tests/cb16.test.mjs (from the repo root)
import { workspaceBuild, buildAll, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const ID = 'cb16-energy-strikes-war-crime';
const [MOD] = loadMods(MODS_DIR, { only: ['geoplanetical-balance'] });
if (!MOD.patches.some(x => x.id === ID)) throw new Error(`${ID} is not in the balance mod`);
const SIMB = m => buildAll(workspaceBuild(), [m]).get('simulation-worker.bundle.js').text;
const patched = SIMB(MOD), withoutFix = SIMB({ ...MOD, patches: MOD.patches.filter(x => x.id !== ID) });
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

// Slices one function declaration by brace matching, skipping strings and template literals.
function fnSrc(text, name) {
  const s = text.indexOf(`function ${name}(`);
  if (s < 0 || text.indexOf(`function ${name}(`, s + 1) >= 0) throw new Error(`${name} not found once`);
  let i = text.indexOf('{', s), depth = 0;
  const stack = [];
  for (; i < text.length; i++) {
    const ch = text[i];
    const top = stack[stack.length - 1];
    if (top === '"' || top === "'") { if (ch === '\\') i++; else if (ch === top) stack.pop(); continue; }
    if (top === '`') { if (ch === '\\') i++; else if (ch === '`') stack.pop(); else if (ch === '$' && text[i + 1] === '{') { stack.push('${'); i++; } continue; }
    if (ch === '"' || ch === "'" || ch === '`') { stack.push(ch); continue; }
    if (ch === '{') { if (top === '${') stack.push('{'); else depth++; continue; }
    if (ch === '}') {
      if (top === '{') { stack.pop(); continue; }
      if (top === '${') { stack.pop(); continue; }
      depth--; if (depth === 0) return text.slice(s, i + 1);
    }
  }
  throw new Error(`${name}: unbalanced`);
}
const between = (text, a, b) => {
  const s = text.indexOf(a), e = text.indexOf(b, s);
  if (s < 0 || e < 0 || text.indexOf(a, s + 1) >= 0) throw new Error(`slice ${a} not found once`);
  return text.slice(s, e);
};

function harness(text, withHelpers) {
  const ledger = between(text, 'var Iy=', 'function MHt(');
  const valid = between(text, 'var Uz=Object.freeze', 'function eUt(');
  const pre = ['lN', 'Lie', 'q9e'].map(n => fnSrc(text, n)).join('\n');
  const helpers = withHelpers ? ['__geobalStrikeCount', '__geobalEnergyHarm'].map(n => fnSrc(text, n)).join('\n') : '';
  const body = `var p_=100,L9e=.35,C4=e=>Number.isFinite(Number(e))?Number(e):0;function F9e(e){return Math.min(1.35,Math.max(0,e)*1e3*.18)}
${pre}
${ledger}
${valid}
${helpers}
return {gHt,vHt,xve,_Ht,U9e,lN,${withHelpers ? '__geobalStrikeCount,__geobalEnergyHarm' : ''}};`;
  return (hl) => new Function('hl', body)(hl);
}
// Pinning: the strings the harness needs are the ones the 1.1.5 bundle has.
check(withoutFix.includes('var p_=100') || /p_=100[,;]/.test(withoutFix), 'p_ is 100 (displaced count as one hundredth)');
check(/L9e=\.35[,;]/.test(withoutFix), 'the monthly bar L9e is .35');
check(withoutFix.includes('function F9e(e){return Math.min(skr,Math.max(0,e)*1e3*ikr)}') && /skr=1\.35[,;]/.test(withoutFix),
  'F9e is min(1.35, harm x 1000 x dualUseStrikePressure)');
check(withoutFix.includes('dualUseStrikePressure:.18'), 'dualUseStrikePressure is .18 (the harness uses it)');

const energy = new Map(); // country key -> unservedShare
const hl = c => ({ unservedShare: energy.get(c.key) ?? 0 });
const P = harness(patched, true)(hl), O = harness(withoutFix, false)(hl);
check(P.gHt.civilian_infrastructure === 'war_crimes' && O.gHt.civilian_infrastructure === undefined, 'new kind civilian_infrastructure files as war_crimes (absent without the fix)');
check(P.vHt.some(r => r.join() === 'geobalEnergyHarmM,civilian_infrastructure,displacedM') && P.vHt.length === O.vHt.length + 1, 'vHt gains one row: geobalEnergyHarmM as people affected');

const world = (pops) => {
  const keys = Object.keys(pops);
  return {
    day: 400, countries: new Map(keys.map(k => [k, { key: k, pop: pops[k] }])),
    plants: new Map(keys.map(k => [`pl:${k}`, { owner: k }])),
    fields: new Map(keys.flatMap(k => [[`oil:${k}`, { owner: k, resource: 'oil' }], [`cu:${k}`, { owner: k, resource: 'copper_ore' }]])),
  };
};
const war = (outage0, id = 'w1') => ({ id, status: 'active', campaign: { outage0 }, conduct: {} });
// A landed strike as the game hands it to cBe: { targetType, targetId }.
const strikes = (e, w, s, v, n, target = 'pl') => {
  for (let i = 0; i < n; i++) P.__geobalStrikeCount(e, w, s, { targetType: target === 'pl' ? 'plant' : 'field', targetId: `${target}:${v}` });
};
const month = (e, ws) => { P.__geobalEnergyHarm(e, ws); for (const w of ws) P.xve(e, w); return P._Ht(e, e.day); };

// 1. One striker, 35 points of excess in a country of 37 M: booked and qualified.
{
  const e = world({ RUS: 144, UKR: 37 }), w = war({ RUS: 0, UKR: .1 });
  energy.set('UKR', .45);
  strikes(e, w, 'RUS', 'UKR', 3);
  const q = month(e, [w]);
  const p = w.conduct.RUS.UKR;
  check(p.geobalStrikes === 3 && p.geobalStrikesSeen === 3, 'strikes counted per striker and victim', JSON.stringify(p));
  check(Math.abs(p.geobalEnergyHarmM - 37 * .35) < 1e-9, 'people affected = 37 M x 0.35', String(p.geobalEnergyHarmM));
  check(q.qualified.some(x => x.perpetratorKey === 'RUS' && x.victimKey === 'UKR' && x.qualificationId === 'war_crimes'),
    'the month qualifies as war crimes', JSON.stringify(q));
  check(q.opened.length === 1, 'an episode opens for the striker');
  const tot = e.accountability.files.RUS.episode.totals.UKR.civilian_infrastructure;
  check(Math.abs(tot.displacedM - 12.95) < 1e-9 && tot.deathsM === 0, 'episode total books people affected, no deaths', JSON.stringify(tot));
  // 2. Next month: the outage stays but no new strike: nothing more.
  e.day += 30;
  const q2 = month(e, [w]);
  check(Math.abs(p.geobalEnergyHarmM - 12.95) < 1e-9 && q2.qualified.length === 0, 'a month without a strike books nothing', JSON.stringify(q2));
  // 3. Strikes resume with excess just under 20 points: nothing; the strikes are still marked seen.
  energy.set('UKR', .3); strikes(e, w, 'RUS', 'UKR', 2); e.day += 30;
  const q3 = month(e, [w]);
  check(Math.abs(p.geobalEnergyHarmM - 12.95) < 1e-9 && q3.qualified.length === 0 && p.geobalStrikesSeen === 5,
    'excess under 20 points does not count, strikes still marked seen');
}
// 3b. The bar is strict: exactly 20 points (.5 - .3 is 0.2 exactly) and the floating-point edge (.55 - .35 is
// 0.20000000000000007) both stay uncharged; 20.01 points is charged.
{
  for (const [base, out, charged] of [[.3, .5, false], [.35, .55, false], [.3, .5001, true]]) {
    const e = world({ A: 50, V: 10 }), w = war({ A: 0, V: base });
    energy.set('V', out); strikes(e, w, 'A', 'V', 1);
    month(e, [w]);
    check(!!w.conduct.A.V.geobalEnergyHarmM === charged, `${out} over a ${base} baseline is ${charged ? '' : 'not '}charged`);
  }
}
// 4. Two strikers 3:1 on a 40-point excess: shares 30 and 10 points; only the first is charged.
{
  const e = world({ A: 50, B: 20, V: 10 }), w = war({ A: 0, B: 0, V: 0 });
  energy.set('V', .4);
  strikes(e, w, 'B', 'V', 1); strikes(e, w, 'A', 'V', 3);
  const q = month(e, [w]);
  check(Math.abs(w.conduct.A.V.geobalEnergyHarmM - 10 * .3) < 1e-9, 'striker with 3 of 4 strikes charged on 30 points', String(w.conduct.A.V.geobalEnergyHarmM));
  check(!w.conduct.B.V.geobalEnergyHarmM, 'striker with 1 of 4 strikes (10 points) not charged');
  check(q.qualified.length === 1 && q.qualified[0].perpetratorKey === 'A', 'only A qualifies', JSON.stringify(q.qualified));
}
// 4b. The same two strikers in two separate wars on one victim: the outage is split across the wars, as in one war.
{
  const e = world({ A: 50, B: 20, V: 10 }), w1 = war({ A: 0, V: 0 }, 'w1'), w2 = war({ B: 0, V: .05 }, 'w2');
  energy.set('V', .35);
  strikes(e, w1, 'A', 'V', 1); strikes(e, w2, 'B', 'V', 1);
  const q = month(e, [w1, w2]);
  check(!w1.conduct.A.V.geobalEnergyHarmM && !w2.conduct.B.V.geobalEnergyHarmM && q.qualified.length === 0,
    'two wars, one strike each, 30 points over the higher baseline: 15 each, neither charged', JSON.stringify(q.qualified));
  energy.set('V', .65); strikes(e, w1, 'A', 'V', 1); strikes(e, w2, 'B', 'V', 1); e.day += 30;
  month(e, [w1, w2]);
  check(Math.abs(w1.conduct.A.V.geobalEnergyHarmM - 10 * .3) < 1e-9 && Math.abs(w2.conduct.B.V.geobalEnergyHarmM - 10 * .3) < 1e-9,
    '60 points over the higher baseline (.05): 30 each, both charged', JSON.stringify([w1.conduct.A.V, w2.conduct.B.V]));
}
// 4c. Running the step twice on the same strikes charges them once.
{
  const e = world({ A: 50, V: 10 }), w = war({ A: 0, V: 0 });
  energy.set('V', .5); strikes(e, w, 'A', 'V', 2);
  P.__geobalEnergyHarm(e, [w]);
  check(Math.abs(w.conduct.A.V.geobalEnergyHarmM - 5) < 1e-9, 'strikes charged on the first run');
  P.__geobalEnergyHarm(e, [w]);
  check(Math.abs(w.conduct.A.V.geobalEnergyHarmM - 5) < 1e-9, 'the same strikes are not charged twice');
}
// 5. Target types and owners: oil field counts, copper mine does not; no baseline, no campaign, own plant: nothing.
{
  const e = world({ A: 50, V: 10 }), w = war({ A: 0, V: 0 });
  strikes(e, w, 'A', 'V', 2, 'cu');
  check(!w.conduct.A?.V, 'a strike on a copper mine is not counted');
  strikes(e, w, 'A', 'V', 1, 'oil');
  check(w.conduct.A.V.geobalStrikes === 1, 'a strike on an oil field is counted');
  P.__geobalStrikeCount(e, w, 'A', { targetType: 'base', targetId: 'b1' });
  P.__geobalStrikeCount(e, w, 'A', { targetType: 'plant', targetId: 'missing' });
  check(w.conduct.A.V.geobalStrikes === 1 && Object.keys(w.conduct.A).length === 1, 'bases and unknown plants are not counted');
  const w1 = war({ A: 0 });
  energy.set('V', .9); strikes(e, w1, 'A', 'V', 4); month(e, [w1]);
  check(!w1.conduct.A.V.geobalEnergyHarmM, 'victim outside outage0 is not charged');
  const w2 = { id: 'w2', status: 'active', conduct: {} }; strikes(e, w2, 'A', 'V', 2); P.__geobalEnergyHarm(e, [w2]);
  check(!w2.conduct.A.V.geobalEnergyHarmM && w2.conduct.A.V.geobalStrikesSeen === 2, 'a war without a campaign baseline yet books nothing and marks the strikes seen');
  w2.campaign = { outage0: { A: 0, V: 0 } }; P.__geobalEnergyHarm(e, [w2]);
  check(!w2.conduct.A.V.geobalEnergyHarmM, 'once the baseline exists, the earlier strikes are not charged as a backlog');
  const w3 = war({ A: 0 }); strikes(e, w3, 'A', 'A', 1); P.__geobalStrikeCount(e, w3, 'A', null);
  check(Object.keys(w3.conduct).length === 0, 'own-plant and empty strikes are not counted');
}
// 6. Key order does not change the result (determinism).
{
  const run = (order) => {
    const e = world({ A: 50, B: 20, V: 10, W: 5 }), w = war({ A: 0, B: 0, V: .05, W: .1 });
    energy.set('V', .7); energy.set('W', .45);
    for (const [s, v, n] of order) strikes(e, w, s, v, n);
    month(e, [w]);
    return JSON.stringify(['A', 'B'].map(s => ['V', 'W'].map(v => w.conduct[s]?.[v]?.geobalEnergyHarmM ?? 0)));
  };
  const a = run([['A', 'V', 2], ['B', 'V', 1], ['A', 'W', 1], ['B', 'W', 3]]);
  const b = run([['B', 'W', 3], ['A', 'W', 1], ['B', 'V', 1], ['A', 'V', 2]]);
  check(a === b, 'same charges whatever order the conduct keys were created in', `${a} vs ${b}`);
}
// 7. Save validation (the game's U9e) keeps the new fields and reports no change.
{
  const e = world({ A: 50, V: 10 }), w = war({ A: 0, V: 0 }); strikes(e, w, 'A', 'V', 2);
  w.conduct.A.V.geobalStrikesSeen = 2; w.conduct.A.V.geobalEnergyHarmM = 3.5;
  const before = JSON.stringify(w.conduct), clone = JSON.parse(before);
  const r = P.U9e({ ...w, conduct: clone });
  const kept = r ? r.war.conduct : clone;
  check(JSON.stringify(kept.A.V.geobalEnergyHarmM) === '3.5' && kept.A.V.geobalStrikes === 2 && kept.A.V.geobalStrikesSeen === 2,
    'validator keeps the three fields (in what it returns, or in the war it was given)', JSON.stringify(kept.A.V));
  check(!r || r.changes.every(c => !/geobal/.test(c.path)), 'validator reports nothing about them', JSON.stringify(r?.changes));
  check(JSON.stringify(clone) === before, 'validator leaves the war it was given as it was');
}
// 8. Wiring: the monthly step runs once over all live wars before the ledger reads them (a war closed by z2a is not
// charged for its last partial month); the counter sits at the head of cBe, which every landed strike reaches after uKe.
check(patched.includes('__geobalEnergyHarm(e,a);for(let i of a)xve(e,i);') && withoutFix.includes('for(let i of a)xve(e,i);'),
  'monthly step runs before xve in s1r, over all live wars');
check(fnSrc(patched, 'z2a') === fnSrc(withoutFix, 'z2a'), 'the war-close path (z2a) is unchanged');
check(fnSrc(patched, 'cBe').startsWith('function cBe(e,t,a,r){__geobalStrikeCount(e,t,a,r);'), 'cBe counts each landed strike');
const sites = (patched.match(/uKe\(e,t,[^)]*\),cBe\(e,t,/g) || []).length;
check(sites === 3 && fnSrc(patched, 'uKe') === fnSrc(withoutFix, 'uKe'), 'all three strike sites call cBe right after uKe; uKe unchanged', String(sites));

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
