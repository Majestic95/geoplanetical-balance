// P8 function test: in the party-choice model (Pke) a voter bloc below the neutral satisfaction of 52 multiplies the
// ruling parties' vote by min(1 - 0.02 x gap, the game's collapse curve), floored at 0.12; gains are unchanged. The
// main check is on normalised vote shares: a loss never costs fewer votes than an equal gain wins.
// Pke, qya and Lya are taken from the bundles; the popularity weights (Zct), clamp (Cn) and party factor (Lct) are
// stubbed. Negative control: in the original, -1 and -10 cost fewer votes than +1 and +10 win.
// Usage: node mods/geoplanetical-balance/tests/p8.test.mjs (from the repo root)
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
const src = (text) => fnSrc(text, 'Lya') + fnSrc(text, 'qya') + fnSrc(text, 'Pke');
const load = (text) => new Function('Zct', 'Cn', 'Lct', 'Ya', 'Eya', 'MXr', `${src(text)};return Pke;`)(
  (parties) => Object.fromEntries(parties.map((p) => [p.id, 1])),
  (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
  () => 1,
  ['econ', 'social', 'gov', 'nat'],
  { econ: 0, social: 0, gov: 0, nat: 0 },
  0.08,
);
const P = load(patched), O = load(original);
check(patched.includes('Math.min(1+h*.02,1/(1+Math.pow(-h/30,2.4)))'), 'patch applied');

// Two parties at the same ideology, R ruling: R's share = f / (f + x), where x is the game's (unpatched) opposition
// multiplier, so the ruling factor f = x * s / (1 - s).
const parties = [{ id: 'R', ideology: { econ: 0 } }, { id: 'X', ideology: { econ: 0 } }];
const opp = (h) => (h >= 0 ? Math.max(0.55, Math.min(1, 1 - h * 0.008)) : Math.max(1, Math.min(2.8, 1 + Math.pow(-h / 34, 2.2) * 1.3)));
const factor = (Pke, sat, charisma = 1) => {
  const s = Pke(parties, [{ share: 1, sat, ideal: { econ: 0 } }], { ruling: ['R'], charisma }).R;
  return opp(sat - 52) * s / (1 - s);
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const curve = (g) => 1 / (1 + Math.pow(g / 30, 2.4));

// The ruling party's normalised share of an evenly split bloc (what the vote count sees).
const share = (Pke, sat) => Pke(parties, [{ share: 1, sat, ideal: { econ: 0 } }], { ruling: ['R'], charisma: 1 }).R;
const loss = (Pke, g) => 0.5 - share(Pke, 52 - g), gain = (Pke, g) => share(Pke, 52 + g) - 0.5;

// Negative control: the game's small losses cost fewer votes than equal gains win.
check(loss(O, 1) < gain(O, 1) && loss(O, 10) < gain(O, 10), 'original: -1 and -10 cost less than +1 and +10 win',
  `${loss(O, 1).toFixed(4)}/${gain(O, 1).toFixed(4)} ${loss(O, 10).toFixed(4)}/${gain(O, 10).toFixed(4)}`);
// Patched: on normalised shares, a loss never costs less than an equal gain wins, at every gap.
let worst = Infinity, at = 0;
for (let g = 0.1; g <= 48; g += 0.1) { const d = loss(P, g) - gain(P, g); if (d < worst) { worst = d; at = g; } }
check(worst >= -1e-12, 'patched: normalised loss >= gain at every gap 0.1..48', `worst ${worst} at ${at.toFixed(1)}`);
check(loss(P, 10) >= 1.5 * gain(P, 10), 'patched: -10 costs at least 1.5 x what +10 wins', `${loss(P, 10).toFixed(4)} vs ${gain(P, 10).toFixed(4)}`);
check(Math.abs(loss(P, 10) - 0.0763) < 0.001, 'patched: -10 costs about 7.6 points (effect text)', String(loss(P, 10)));
check(Math.abs(loss(O, 10) - 0.0383) < 0.001, 'original: -10 cost about 3.8 points (effect text)', String(loss(O, 10)));
// The weight itself: 1 - 0.02 per point, floor 0.12 (from -44).
check(near(factor(P, 42), 0.80), 'patched weight: -10 gives 0.80', String(factor(P, 42)));
check(near(factor(P, 32), 0.60), 'patched weight: -20 gives 0.60', String(factor(P, 32)));
check(near(factor(P, 52 - 44), 0.12) && near(factor(P, 0), 0.12), 'patched weight: floor 0.12 from -44', String(factor(P, 0)));
check(factor(P, -500) >= 0.12 - 1e-12, 'patched: floor 0.12 holds at extreme input');
for (let g = 1; g <= 60; g++) check(factor(P, 52 - g) <= Math.max(0.12, curve(g)) + 1e-12, `patched weight never above the game's curve (gap -${g})`);
// Never milder than the original at any loss.
for (let sat = 51; sat >= -20; sat -= 1) check(factor(P, sat) <= factor(O, sat) + 1e-12, `patched never milder at sat ${sat}`);
// Gains and neutral unchanged.
for (const sat of [52, 60, 80, 200]) check(near(factor(P, sat), factor(O, sat)), `gain unchanged at sat ${sat}`);
// Charisma still softens the loss as in the game: w = 1 + (w - 1) / clamp(charisma, .6, 1.6).
check(near(factor(P, 42, 1.6), 1 + (0.80 - 1) / 1.6), 'charisma softens the patched loss');
// Monotone in satisfaction.
let prev = -1; let mono = true;
for (let sat = -40; sat <= 120; sat += 0.5) { const f = factor(P, sat); if (f < prev - 1e-12) mono = false; prev = f; }
check(mono, 'patched factor rises with satisfaction');

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
