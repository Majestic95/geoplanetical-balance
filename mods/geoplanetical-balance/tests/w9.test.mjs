// W9 function test: the monthly AI defence budget (err, holding `aiBudgetAnchor||=`) lowers its target at war by
// 0.4 x the larger of two danger ramps (fiscal pressure 0.7 -> 1, public debt 80 -> 100% of GDP), applied to the
// target outside the anchored desire delta, so it bites at the first review and vanishes when the danger passes.
// err and the patch's helpers are taken from the bundles; the environment, desire (Tko), fiscal state (Zn), budget
// object and its setters are stubbed, and A2 (the budget commit) records the new defence line.
// Usage: node mods/geoplanetical-balance/tests/w9.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };
const enclosing = (text, needle) => {
  const a = text.indexOf(needle);
  if (a < 0 || text.indexOf(needle, a + 1) >= 0) throw new Error(`${needle}: not found once`);
  const s = text.lastIndexOf('function ', a);
  let depth = 0, i = text.indexOf('){', s) + 1;
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(s, i + 1);
};
const fnSrc = (text, name) => enclosing(text, `function ${name}(`);
check(original.includes('-(e.atWar?0:a*.8)}') && patched.includes('-(e.atWar?0:a*.8)}'), 'the desire function itself is unchanged');
// err's free names, by their call shapes in its body.
const load = (text) => {
  const src = enclosing(text, 'aiBudgetAnchor||=');
  const name = /function ([\w$]+)\(/.exec(src)[1];
  const pick = (re) => re.exec(src)[1];
  const ids = {
    ctx: pick(/,s=([\w$]+)\(e\);/), unc: pick(/if\(e\.playerControlsGovernment\(l\)\)\{[^}]*\}if\(o&&!o\.has\(String\(l\.key\)\)\|\|!([\w$]+)\(l\)/),
    env: pick(/let c=([\w$]+)\(e,l,s\);/), seen: pick(/;([\w$]+)\(e,l,c\.rivalArms\)/), desire: pick(/let u=([\w$]+)\(l,c,/),
    zn: pick(/,([\w$]+)\(l\)\.pressure\);/), ke: pick(/let d=([\w$]+)\(l\.spend\?\.mil\)/), bud: pick(/h=([\w$]+)\(l\),g=/),
    set: pick(/g=([\w$]+)\(([\w$]+)\.mil,/), tbl: pick(/g=[\w$]+\(([\w$]+)\.mil,/), commit: pick(/v\|\|([\w$]+)\(e,l,h,/),
  };
  const helpers = text.includes('function __geobalW9(') ? fnSrc(text, '__geobalW9') : '';
  return (state) => new Function(...Object.values(ids), '__geobalW8',
    `${helpers}${src};return ${name};`)(
    () => ({}), () => true, () => ({ competence: 0, rivalArms: [] }), () => {}, () => state.desire,
    () => ({ pressure: state.pressure }), (x) => Number(x) || 0, (c) => ({ spending: { mil: c.spend.mil } }),
    (_, x) => x, { mil: 'mil' }, (e, c, h) => { c.spend.mil = h.spending.mil; },
    () => ({ target: 0, pace: 0 }));
};
const P = load(patched), O = load(original);
const sim = (c) => ({ countries: new Map([[c.key, c]]), playerControlsGovernment: () => false });
const country = (atWar, debtRatio) => ({ key: 'X', atWar, debtRatio, spend: { mil: 3 }, forces: {} });
// One monthly step: period 91 days (one quarter) makes the closing share exactly f = .07 (competence 0).
const step = (L, c, state) => { L(state)(sim(c), 91); return c.spend.mil; };
const near = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

// 1. First review in danger (debt 100%): the anchor is set this month; the patched target is 0.4 below the line.
{
  const s = { desire: 1, pressure: 0 };
  const cp = country(true, 100), co = country(true, 100);
  const mp = step(P, cp, s), mo = step(O, co, s);
  check(near(mo, 3), 'negative control: original keeps the line at war with 100% debt', String(mo));
  check(near(mp, 3 - 0.07 * 0.4), 'first review in danger: line moves 7% of the way to 0.4 below it', String(mp));
  // 2. The danger lasts: the cut keeps biting each month.
  const mp2 = step(P, cp, s);
  check(near(mp2, mp + (3 - 0.4 - mp) * 0.07), 'danger lasts: line keeps closing on a target 0.4 below the anchored level (2.6)', `${mp} -> ${mp2}`);
  // 3. Danger passes (debt 50%): target back at the anchored desire, never above the original's.
  cp.debtRatio = 50; co.debtRatio = 50;
  let a = cp.spend.mil, b;
  for (let k = 0; k < 60; k++) b = step(P, cp, s);
  const ob = step(O, co, s);
  check(b > a && b <= ob + 1e-9, 'danger passes: line recovers toward the anchor and never overshoots the original', `${a} -> ${b} (original ${ob})`);
  check(near(cp.forces.aiBudgetAnchor.desireGdpPct, 1), 'anchor stores the un-reduced desire', String(cp.forces.aiBudgetAnchor.desireGdpPct));
}
// 4. Ramps: smooth in pressure and in debt; debt alone works; peace unchanged.
const cut = (debt, pressure, atWar = true) => { const s = { desire: 1, pressure }; const c = country(atWar, debt); return (3 - step(P, c, s)) / 0.07; };
check(near(cut(50, 0), 0) && near(cut(80, 0), 0) && near(cut(90, 0), 0.2) && near(cut(100, 0), 0.4) && near(cut(300, 0), 0.4), 'debt ramp 80 -> 100%: 0, 0.2, 0.4');
check(near(cut(0, 0.7), 0) && near(cut(0, 0.85), 0.2) && near(cut(0, 0.99), 0.4 * 0.29 / 0.3, 1e-9) && near(cut(0, 1), 0.4), 'pressure ramp 0.7 -> 1, no cliff at 0.99 -> 1');
check(near(cut(90, 0.85), 0.2) && near(cut(95, 0.85), 0.3), 'larger of the two ramps');
check(near(cut(150, 1, false), 0), 'peace: unchanged');
check(near(cut(NaN, NaN), 0) && near(cut(undefined, 0.5), 0), 'NaN or missing inputs: no cut');

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
