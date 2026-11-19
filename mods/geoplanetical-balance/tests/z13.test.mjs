// Z13 function test: the daily volcano draw (xbo) from the balance mod built without and with this patch, run for many
// simulated years with the game's own seeded volcanic stream (k9t, sliced) and a stubbed eruption step (SZa). With the
// patch, a rest-of-the-world source adds about 0.0594 large eruptions a year (VEI 5/6/7 at 0.0508/0.0081/0.0005), placed
// at catalogue volcanoes by eruption rate; the catalogue's own draws keep their rate; natural disasters off (t = 0) adds
// nothing; the original never forces a VEI.
// Usage: node mods/geoplanetical-balance/tests/z13.test.mjs (from the repo root)
import { workspaceBuild, buildAll, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const ID = 'z13-volcano-rest-of-world';
const [MOD] = loadMods(MODS_DIR, { only: ['geoplanetical-balance'] });
if (!MOD.patches.some(x => x.id === ID)) throw new Error(`${ID} is not in the balance mod`);
const SIMB = m => buildAll(workspaceBuild(), [m]).get('simulation-worker.bundle.js').text;
const patched = SIMB(MOD), withoutFix = SIMB({ ...MOD, patches: MOD.patches.filter(x => x.id !== ID) });
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

const fnText = (text, head) => {
  const s = text.indexOf(head);
  if (s < 0 || text.indexOf(head, s + 1) >= 0) throw new Error(`${head} not found once`);
  let depth = 0, i = text.indexOf('{', s);
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(s, i + 1);
};
const HFE = [{ id: 'a', eruptionsPerYear: 0.5 }, { id: 'b', eruptionsPerYear: 0.2 }, { id: 'c', eruptionsPerYear: 0.3 }];
const load = (text, calls) => {
  const src = fnText(text, 'function k9t(') + fnText(text, 'function xbo(') + (text.includes('function __geobalZ13(') ? fnText(text, 'function __geobalZ13(') : '');
  return new Function('Hfe', 'G$a', 'SZa', 'ot', `${src};return xbo;`)(HFE, v => Math.max(0, Number(v?.eruptionsPerYear) || 0) / 365,
    (e, opt) => { calls.push(opt); return {}; }, (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d));
};
const run = (text, years, t = 1) => {
  const calls = [], xbo = load(text, calls), e = { disasters: { volcanicRngState: 123456789 } };
  for (let d = 0; d < years * 365; d++) xbo(e, t);
  return calls;
};
const YEARS = 4000;
const o = run(withoutFix, YEARS), p = run(patched, YEARS);
const forced = p.filter(c => c.vei != null), cat = p.filter(c => c.vei == null);
check(o.every(c => c.vei == null), 'original never forces a VEI');
const rate = forced.length / YEARS;
check(rate > 0.0594 * 0.85 && rate < 0.0594 * 1.15, 'extra large-eruption rate about 0.0594 a year', `${forced.length} in ${YEARS} years = ${rate.toFixed(4)}`);
const v5 = forced.filter(c => c.vei === 5).length / forced.length, v6 = forced.filter(c => c.vei === 6).length / forced.length;
check(v5 > 0.78 && v5 < 0.93 && v6 > 0.08 && v6 < 0.2 && forced.every(c => c.vei >= 5 && c.vei <= 7), 'VEI split near 0.855 / 0.136 / 0.008', `v5 ${v5.toFixed(3)} v6 ${v6.toFixed(3)}`);
const share = id => forced.filter(c => c.volcanoId === id).length / forced.length;
check(share('a') > 0.38 && share('a') < 0.62 && share('b') > 0.1 && share('b') < 0.3, 'placed by eruption rate (a 0.5, b 0.2, c 0.3)', `a ${share('a').toFixed(2)} b ${share('b').toFixed(2)}`);
const catRate = cat.length / YEARS, oRate = o.length / YEARS;
check(Math.abs(catRate - 1) < 0.08 && Math.abs(oRate - 1) < 0.08, 'catalogue draws keep their rate (1 a year in total)', `orig ${oRate.toFixed(3)}, patched ${catRate.toFixed(3)}`);
check(run(patched, 200, 0).length === 0, 'natural disasters off (t = 0): nothing');

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
