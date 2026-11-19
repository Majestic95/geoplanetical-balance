// O1 function test: the secularisation income index (o0g) reads GDP per head in thousand USD, so it runs from 0 at
// USD 1 200 to 1 at USD 70 000 instead of 0 for every country, and the yearly secular pull (bfB) follows. o0g and bfB
// are sliced from the patched and unmodded bundles; the religion-policy helpers are stubbed.
// Usage: node mods/geoplanetical-balance/tests/o1.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

const fn = (text, name) => {
  const s = text.indexOf(`function ${name}(`);
  if (s < 0 || text.indexOf(`function ${name}(`, s + 1) >= 0) throw new Error(`${name}: not found once`);
  let depth = 0, q = null;
  for (let i = text.indexOf('){', s) + 1; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(s, i + 1);
  }
  throw new Error(`${name}: unbalanced`);
};
// Religion policy levels and a two-group country (christian 70 %, unaffiliated 30 %), no favoured faith.
const lib = (text, policy) => new Function('ia', '_n', 'w7', 'q8e', 'ln', 'oR', `${fn(text, 'Lwr')}\n${fn(text, 'eNt')}\nreturn {k0g:Lwr,NqB:eNt};`)(
  (A, B = 0) => Number.isFinite(Number(A)) ? Number(A) : B, (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
  () => ({ groups: [{ id: 'christian' }, { id: 'unaffiliated' }] }),
  () => ({ religious_funding: 0, religion_in_education: 0, religion_state: 0, ...policy }), ['christian', 'unaffiliated'], () => 'tolerated');
const P = lib(patched), V = lib(original);
const near = (a, b) => Math.abs(a - b) < 1e-9;

for (const cap of [0.5, 1, 6, 12, 40, 85, 140]) check(V.k0g({ gdpCap: cap }) === 0, `unmodded: income index 0 at ${cap}k USD a head`);
check(P.k0g({ gdpCap: 1 }) === 0 && P.k0g({ gdpCap: 1.2 }) === 0, 'patched: 0 at or below USD 1 200');
check(near(P.k0g({ gdpCap: 12 }), (Math.log10(12000) - Math.log10(1200)) / (Math.log10(7e4) - Math.log10(1200))), 'patched: USD 12 000 gives the log-scale share (about 0.57)', String(P.k0g({ gdpCap: 12 })));
check(P.k0g({ gdpCap: 70 }) === 1 && P.k0g({ gdpCap: 85 }) === 1, 'patched: 1 at USD 70 000 and above');
check(P.k0g({}) === V.k0g({}) && P.k0g({ gdpCap: 'x' }) === V.k0g({ gdpCap: 'x' }) && P.k0g({ gdpCap: null }) === V.k0g({ gdpCap: null }), 'missing, non-numeric or null GDP per head: same fallback as before');

const rich = { gdpCap: 85, religions: { groups: [{ id: 'christian' }, { id: 'unaffiliated' }] } };
check(near(V.NqB(rich).secularPull, .0007) && near(P.NqB(rich).secularPull, .0029), 'rich country, no religious funding: pull 0.07 % -> 0.29 % a year', `${V.NqB(rich).secularPull} -> ${P.NqB(rich).secularPull}`);
const poor = { gdpCap: 1, religions: rich.religions };
check(near(V.NqB(poor).secularPull, P.NqB(poor).secularPull), 'poor country: unchanged');
const funded = lib(patched, { religious_funding: 5, religion_in_education: 5 });
check(near(funded.NqB(rich).secularPull, .0029 - .0027), 'state funding and religious education still slow it (0.29 % - 0.27 %)');
const t = P.NqB(rich).transfers;
check(t.length === 1 && t[0].fromId === 'christian' && t[0].toId === 'unaffiliated' && near(t[0].annualRate, .0029) && t[0].cause === 'secularization', 'one transfer: christian -> unaffiliated at the pull', JSON.stringify(t));

console.log(failures ? `${failures} of ${checks} checks FAILED` : `${checks}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
