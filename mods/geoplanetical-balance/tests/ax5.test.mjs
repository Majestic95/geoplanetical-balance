// AX5 function test: the AI budget policy's recession test (g4t's "support" mode) reads the ratio of the last three
// months' real output to the three months before, taken from the game's twelve-month output ring (_gdpRing,
// _gdpRingIdx), instead of this month against last month. The observation builder (h4t), the patch's helper, the mode
// rule (g4t) and its constants are taken from the bundles; the fiscal-state helper Zn is stubbed.
// Usage: node mods/geoplanetical-balance/tests/ax5.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };
const fnSrc = (text, name) => {
  const s = text.indexOf(`function ${name}(`);
  if (s < 0 || text.indexOf(`function ${name}(`, s + 1) >= 0) throw new Error(`${name}: not found once`);
  let depth = 0, i = text.indexOf('){', s) + 1;
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(s, i + 1);
};
// The constants block of the mode rule: `var C1o=.999,k1o=-.5,A1o=2,R1o=.5;` sits just before h4t.
const consts = (text) => {
  const h = text.indexOf('function h4t(');
  const v = text.lastIndexOf('var ', h);
  return text.slice(v, h);
};
const f4t = Number((/,f4t=([\d.]+),/.exec(original) || [])[1]);
check(f4t > 0, 'primary-deficit threshold f4t read from the bundle', String(f4t));
const src = (text) => consts(text) + `var f4t=${f4t};` + fnSrc(text, 'h4t') +
  (text.includes('function __geobalGdpQ3(') ? fnSrc(text, '__geobalGdpQ3') : '') + fnSrc(text, 'g4t');
const load = (text) => new Function('Zn', 'Zl', `${src(text)};return {h4t,g4t};`)(
  (c) => ({ deficitPct: c.deficitPct ?? 5, primaryDeficitPct: c.primaryDeficitPct ?? 4, crisis: !!c.crisis, pressure: c.pressure ?? 1 }),
  (e, t = 0) => (Number.isFinite(e) ? e : t),
);
const P = load(patched), O = load(original);
check(consts(original).includes('.999'), 'the game uses a 0.1% monthly fall as its recession test', consts(original));

// A country whose ring holds `hist` (oldest first, 12 months) and whose current output is the last entry.
const country = (hist, extra = {}) => {
  const ring = new Float64Array(12);
  const idx = 5; // ring index the next commit will write; the latest value sits at idx-1
  for (let k = 1; k <= 12; k++) ring[((idx - k) % 12 + 12) % 12] = hist[12 - k];
  return { _gdpRing: ring, _gdpRingIdx: idx, gdpVol: hist[11], gdp: hist[11], growth: (hist[11] / hist[0] - 1) * 100,
    debtRatio: 60, unemployment: 5, inflation: 2, ...extra };
};
const mode = (L, c, prevGdp) => {
  const obs = L.h4t(c, 300);
  const prev = prevGdp == null ? null : { gdpBn: prevGdp, debtRatio: 60 };
  return L.g4t(obs, prev, 0);
};

// 1. Growing economy with one small dip this month (-0.3%): the original calls recession; the patch does not.
const rising = Array.from({ length: 12 }, (_, i) => 100 * Math.pow(1.002, i));
const dip = rising.slice(); dip[11] = dip[10] * 0.997;
check(mode(O, country(dip), dip[10]) === 'support', 'negative control: original goes to support on one month\'s 0.3% dip', mode(O, country(dip), dip[10]));
check(mode(P, country(dip), dip[10]) === 'consolidate', 'patched: one weak month in a growing economy stays in consolidation', mode(P, country(dip), dip[10]));

// 2. A real downturn: output falling 0.5% a month for six months, with a small uptick this month.
const falling = Array.from({ length: 12 }, (_, i) => (i < 6 ? 100 : 100 * Math.pow(0.995, i - 5)));
falling[11] = falling[10] * 1.001;
check(mode(O, country(falling), falling[10]) !== 'support', 'original misses a downturn in a month with a small uptick', mode(O, country(falling), falling[10]));
check(mode(P, country(falling), falling[10]) === 'support', 'patched: a quarter-on-quarter fall is a recession even after one up month', mode(P, country(falling), falling[10]));

// 3. Flat output: neutral threshold (0.1% margin) is kept: a 0.05% quarter fall is not a recession, 0.2% is.
const quarter = (q) => { const h = Array(12).fill(100); for (let i = 9; i < 12; i++) h[i] = 100 * (1 - q); return h; };
check(mode(P, country(quarter(0.0005)), 100) !== 'support', 'patched: a 0.05% quarter fall is within the margin');
check(mode(P, country(quarter(0.002)), 100) === 'support', 'patched: a 0.2% quarter fall is a recession');

// 4. Extreme inputs: no ring, a short ring, zeros, NaN: the patch falls back to the original one-month test exactly.
for (const [name, extra] of [['no ring', { _gdpRing: undefined }], ['short ring', { _gdpRing: new Float64Array(6) }],
  ['zero ring', { _gdpRing: new Float64Array(12) }], ['bad index', { _gdpRingIdx: 2.5 }]]) {
  const c = country(dip, extra);
  check(mode(P, c, dip[10]) === mode(O, c, dip[10]), `fallback to the original test: ${name}`, `${mode(P, c, dip[10])} vs ${mode(O, c, dip[10])}`);
}
// A non-finite or non-positive month among the six read falls back to the original test exactly, and the ratio is null.
for (const bad of [NaN, Infinity, 0, -5]) for (const slot of [1, 4, 6]) {
  const c = country(dip); c._gdpRing[((c._gdpRingIdx - slot) % 12 + 12) % 12] = bad;
  check(P.h4t(c, 300).__geobalGdpQ3 === null && mode(P, c, dip[10]) === mode(O, c, dip[10]),
    `bad month (${bad}) at ring slot -${slot}: original test`, `${P.h4t(c, 300).__geobalGdpQ3} ${mode(P, c, dip[10])}`);
}
// A bad month outside the six read (seven months ago) does not matter.
const far = country(dip); far._gdpRing[((far._gdpRingIdx - 7) % 12 + 12) % 12] = NaN;
check(Number.isFinite(P.h4t(far, 300).__geobalGdpQ3), 'a bad month older than six months is ignored');

// 5. Crisis still wins, and the observation carries the ratio as a finite number.
check(mode(P, country(rising, { }), null) !== 'crisis', 'no crisis without the crisis flag');
const obs = P.h4t(country(rising), 300);
check(Number.isFinite(obs.__geobalGdpQ3) && obs.__geobalGdpQ3 > 1, 'observation records the 3-month ratio', String(obs.__geobalGdpQ3));
const crisisC = country(dip, { crisis: true });
check(P.g4t({ ...P.h4t(crisisC, 300), crisis: true }, null, 0) === 'crisis', 'crisis mode unchanged');

// 6. Same inputs, same answer (determinism of the helper).
check(mode(P, country(dip), dip[10]) === mode(P, country(dip), dip[10]), 'deterministic');

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
