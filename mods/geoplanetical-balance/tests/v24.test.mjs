// V24 function test: the monthly migration step (hHt with kUt) scales stateless departures to the population actually
// in the source province before any destination is credited, so people are neither created nor counted twice, and
// neither kUt nor the education emigration step (O9e) throws when a departure exceeds its stock; they clamp and warn. Both functions are sliced from the balance mod built
// with and without this patch and run with the game's own helpers (A4, Oa, Sy); the graveyard pass and the cohort
// weights (bFt, $b, P3) are stubbed out, so the skill-share step runs without cohorts. hHt runs with the game's fHt, A4
// and kUt; the refugee, departure-record and population-sum helpers (bUt, y_, Eve) and CUt are stubbed.
// Usage: node mods/geoplanetical-balance/tests/v24.test.mjs (from the repo root)
import { workspaceBuild, buildAll, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const ID = 'v24-migration-clamp';
const [MOD] = loadMods(MODS_DIR, { only: ['geoplanetical-balance'] });
if (!MOD.patches.some(x => x.id === ID)) throw new Error(`${ID} is not in the balance mod`);
const SIMB = m => buildAll(workspaceBuild(), [m]).get('simulation-worker.bundle.js').text;
const patched = SIMB(MOD), withoutFix = SIMB({ ...MOD, patches: MOD.patches.filter(x => x.id !== ID) });
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

const fnText = (text, name) => {
  const head = `function ${name}(`, a = text.indexOf(head);
  if (a < 0 || text.indexOf(head, a + 1) >= 0) throw new Error(`${name}: not found once`);
  const b = text.indexOf('}function ', a);
  return text.slice(a, b + 1);
};
const helper = (text, def) => { // the game's own one-line arrow helpers, e.g. "Oa=(e,t=0)=>..."
  const a = text.indexOf(def); if (a < 0) throw new Error(`helper ${def} missing`);
  let i = a + def.length, depth = 0;
  for (; i < text.length; i++) { const c = text[i]; if ('([{'.includes(c)) depth++; else if (')]}'.includes(c)) { if (depth === 0) break; depth--; } else if (c === ',' && depth === 0) break; }
  return text.slice(a, i);
};
const warnings = [];
const load = text => new Function('console', `let ${helper(text, 'Oa=(e,t=0)=>')},${helper(text, 'A4=e=>')},${helper(text, 'Sy=e=>')};` +
  `function CUt(){}const bFt=()=>null,$b=0,P3={working:[0,0]};${fnText(text, 'kUt')}${fnText(text, 'O9e')};return {kUt,O9e};`)({ warn: (...a) => warnings.push(a.join(' ')) });
const P = load(patched), O = load(withoutFix);
check(!fnText(patched, 'kUt').includes('throw new RangeError') && !fnText(patched, 'O9e').includes('throw new RangeError'), 'patched: no RangeError left in either step');

// Stateless departures: province X has 1.0 M, departures ask for 1.5 M; province Y is not no-man's land.
const world = () => ({ world: { provByKey: new Map([['X', { __polityKey: '__nomans', __pop: 1.0 }], ['Y', { __polityKey: '250', __pop: 5 }]]) } });
const dep = (key, amt) => ({ sourceRef: { kind: 'stateless', provinceKey: key }, actualAmountM: amt });
{
  const w = world();
  let threw = false; try { O.kUt(w, [dep('X', 1.5)]); } catch (e) { threw = /stateless:departure-stock/.test(e.message); }
  check(threw, 'original: departure above the stock throws');
  warnings.length = 0;
  const w2 = world(), r = P.kUt(w2, [dep('X', 1.5)]);
  check(w2.world.provByKey.get('X').__pop === 0 && Math.abs(r - 1.0) < 1e-12, 'patched: clamped to the province population, total 1.0', JSON.stringify({ pop: w2.world.provByKey.get('X').__pop, r }));
  check(warnings.length === 1 && /clamped/.test(warnings[0]), 'patched: one warning', warnings.join('|'));
  const w3 = world(), r3 = P.kUt(w3, [dep('X', 0.4)]);
  const w4 = world(), r4 = O.kUt(w4, [dep('X', 0.4)]);
  check(r3 === r4 && w3.world.provByKey.get('X').__pop === w4.world.provByKey.get('X').__pop, 'within the stock: same as the original');
  warnings.length = 0;
  const w5 = world(), r5 = P.kUt(w5, [dep('Y', 0.2), dep('X', 0.3)]);
  check(w5.world.provByKey.get('Y').__pop === 5 && Math.abs(w5.world.provByKey.get('X').__pop - 0.7) < 1e-12 && Math.abs(r5 - 0.3) < 1e-12 && warnings.length === 1, 'reassigned province skipped with a warning, others still processed');
  let t2 = false; try { O.kUt(world(), [dep('Y', 0.2)]); } catch (e) { t2 = true; } check(t2, 'original: reassigned province throws');
}
// Education emigration: labour force 10 M, shares 50/30/20; 6 M high-skill leavers against a 2 M stock.
const country = () => ({ key: 'C1', pop: 20, employment: { laborForceM: 10 }, education: { skills: { shares: [0.5, 0.3, 0.2] } } });
{
  let threw = false; try { O.O9e(country(), { incomingM: [0, 0, 0], outgoingM: [0, 0, 6] }); } catch (e) { threw = /education:migration:source-stock/.test(e.message); }
  check(threw, 'original: emigrants above the skill stock throw');
  warnings.length = 0;
  const c = country(); P.O9e(c, { incomingM: [0, 0, 0], outgoingM: [0, 0, 6] });
  const s = c.education.skills.shares;
  check(Math.abs(s[0] - 5 / 8) < 1e-12 && Math.abs(s[1] - 3 / 8) < 1e-12 && s[2] === 0, 'patched: the skill group empties (shares 5/8, 3/8, 0)', JSON.stringify(s));
  check(warnings.length === 1, 'patched: one warning');
  const a = country(), b = country();
  P.O9e(a, { incomingM: [0.1, 0, 0], outgoingM: [0.2, 0.1, 0.1] }); O.O9e(b, { incomingM: [0.1, 0, 0], outgoingM: [0.2, 0.1, 0.1] });
  check(JSON.stringify(a.education.skills) === JSON.stringify(b.education.skills), 'within the stock: same as the original');
}
// The whole monthly step: destinations are credited from the same (scaled) amounts the source loses.
const loadH = text => new Function('console', `let ${helper(text, 'fHt=e=>')},${helper(text, 'A4=e=>')};` +
  `function CUt(){}const bUt=()=>{},y_=()=>{},Eve=a=>a.reduce((x,y)=>x+y,0);` +
  `${text.includes('function __geobalClampStateless(') ? fnText(text, '__geobalClampStateless') : ''}${fnText(text, 'kUt')}${fnText(text, 'hHt')};return hHt;`)({ warn: (...a) => warnings.push(a.join(' ')) });
const PH = loadH(patched), OH = loadH(withoutFix);
const hw = () => ({ countries: new Map(), world: { provByKey: new Map([['X', { __polityKey: '__nomans', __pop: 1.0 }], ['Y', { __polityKey: '250', __pop: 5 }], ['D', { __polityKey: '276', __pop: 10 }]]) } });
const flow = (key, amt) => ({ kind: 'migrant', originKey: '__nomans', sourceRef: { kind: 'stateless', provinceKey: key }, amountM: amt, destinationProvinceKey: 'D' });
{
  let threw = false; try { OH(hw(), [flow('X', 1.5)], 1); } catch (e) { threw = /stateless:departure-stock/.test(e.message); }
  check(threw, 'original hHt: a stateless request above the stock throws');
  warnings.length = 0;
  const w = hw(), pv = w.world.provByKey; PH(w, [flow('X', 1.0), flow('X', 0.5)], 1);
  check(Math.abs(pv.get('X').__pop) < 1e-12 && Math.abs(pv.get('D').__pop - 11) < 1e-12, 'patched hHt: 1.5 M asked from 1.0 M moves exactly 1.0 M (source 0, destination +1.0)', JSON.stringify({ X: pv.get('X').__pop, D: pv.get('D').__pop }));
  check(warnings.some(x => /scaled/.test(x)), 'patched hHt: a warning names the scaled province', warnings.join('|'));
  const w2 = hw(), p2 = w2.world.provByKey; PH(w2, [flow('Y', 0.3)], 1);
  check(p2.get('Y').__pop === 5 && p2.get('D').__pop === 10, 'patched hHt: a province no longer stateless moves nobody (no double count)', JSON.stringify({ Y: p2.get('Y').__pop, D: p2.get('D').__pop }));
  const w3 = hw(), w4 = hw(); PH(w3, [flow('X', 0.4)], 1); OH(w4, [flow('X', 0.4)], 1);
  check(w3.world.provByKey.get('X').__pop === w4.world.provByKey.get('X').__pop && w3.world.provByKey.get('D').__pop === w4.world.provByKey.get('D').__pop, 'patched hHt: within the stock, identical to the original');
  const before = [...hw().world.provByKey.values()].reduce((s, x) => s + x.__pop, 0), w5 = hw(); PH(w5, [flow('X', 3), flow('Y', 1)], 1);
  const after = [...w5.world.provByKey.values()].reduce((s, x) => s + x.__pop, 0);
  check(Math.abs(after - before) < 1e-12, 'patched hHt: total population conserved', `${before} -> ${after}`);
}
console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
