// NP7 function test: the fragility score (mYa) used by the AI war decision for the actor and the target stays in [0,1]:
// one weakness scores as in the game, both together are capped at 1. mYa is taken from both bundles with the game's
// j5 and Kv. Negative control: the original scores a country with stability 0 and approval 0 at 2.
// Usage: node mods/geoplanetical-balance/tests/np7.test.mjs (from the repo root)
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
const helpers = (text) => { const a = text.indexOf('j5=(e,t,a)=>'); const b = text.indexOf(',s9o=', a); if (a < 0 || b < 0) throw new Error('helpers'); return `const ${text.slice(a, b)};`; };
const load = (text) => new Function(`${helpers(text)}${fnSrc(text, 'mYa')};return mYa;`)();
const P = load(patched), O = load(original);
check(fnSrc(patched, 'mYa') !== fnSrc(original, 'mYa'), 'patch applied');
check(original.includes('domesticFragility:w,targetFragility:M') && /w=mYa\(t\),M=mYa\(p\)/.test(original), 'mYa feeds both fragility fields');

check(O({ stab: 0, approval: 0 }) === 2, 'original: both weaknesses score 2', String(O({ stab: 0, approval: 0 })));
check(P({ stab: 0, approval: 0 }) === 1, 'patched: both weaknesses capped at 1', String(P({ stab: 0, approval: 0 })));
check(P({ stab: -1e9, approval: -1e9 }) === 1 && P({ stab: 1e9, approval: 1e9 }) === 0, 'patched: extremes in [0,1]');
check(P({}) === 0 && P(null) === 0, 'patched: missing inputs default to 50 (score 0)');
check(P({ stab: 'x', approval: NaN }) === O({ stab: 'x', approval: NaN }), 'patched: bad inputs as the game');
let same = true, capped = true;
for (let s = -10; s <= 100; s += 2) for (let a = -10; a <= 100; a += 2) {
  const o = O({ stab: s, approval: a }), p = P({ stab: s, approval: a });
  if (o <= 1 && Math.abs(o - p) > 1e-15) same = false;
  if (o > 1 && p !== 1) capped = false;
  if (p < 0 || p > 1) capped = false;
}
check(same, 'patched: unchanged wherever the game scored 1 or less');
check(capped, 'patched: capped at 1 wherever the game scored above 1');

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
