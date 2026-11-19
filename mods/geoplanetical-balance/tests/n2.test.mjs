// N2 function test: Iran is OPEC+ quota-exempt in the cartel's member data (sb), and the game's own quota pass (g7Q),
// sliced from the patched bundle, leaves day-0 quotas unchanged and spares Iran's entitlement in a cut.
// Usage: node mods/geoplanetical-balance/tests/n2.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

// The object literal assigned to `var sb=`, by brace matching (string literals skipped).
const literal = (text, head) => {
  const s = text.indexOf(head);
  if (s < 0 || text.indexOf(head, s + 1) >= 0) throw new Error(`${head}: not found once`);
  let depth = 0, q = null;
  for (let i = s + head.length - 1; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return new Function(`return (${text.slice(s + head.length - 1, i + 1)})`)();
  }
  throw new Error(`${head}: unbalanced`);
};
const cartel = text => literal(text, 'var fF={');
const P = cartel(patched), V = cartel(original);
check(P._note.includes('Iran') && /exempt/.test(P._note), "the data note names Iran as quota-exempt");
check(P.members['364'].exempt === true && V.members['364'].exempt === false, 'Iran (364): exempt in the patch, not in the unmodded data');
check(['434', '862', '484'].every(k => P.members[k].exempt === true), 'Libya, Venezuela and Mexico stay exempt');
const others = Object.keys(V.members).filter(k => k !== '364');
check(others.every(k => JSON.stringify(P.members[k]) === JSON.stringify(V.members[k])) && JSON.stringify({ ...P, members: null }) === JSON.stringify({ ...V, members: null }),
  'every other member and every other field unchanged');

// The game's quota pass on the cartel's own members (countries absent, so only the quota scale runs).
const fn = text => {
  const s = text.indexOf('function hNa(');
  let depth = 0, i = text.indexOf('{', s);
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const UDB = B => { let b = 0, c = 0; for (const k of B.members) { b += B.entitlement.get(k) || 0; c += (B.entitlement.get(k) || 0) * 1.2; } return { sumBase: b, sumCeil: c }; };
  return new Function('yNa', 'Lp', 'zS', 'zZ', 'XDe', 'Vme', 'uNa', '_ht', 'N3o', 'PAe', 'Sht', 'G3o', 'aNa', `return (${text.slice(s, i + 1)})`)(
    UDB, clamp, () => null, () => 0, () => 0, () => false, () => 1, () => 1, 1, 0, () => 0, 1, 30);
};
const world = (data, target) => {
  const keys = Object.keys(data.members);
  const m = f => new Map(keys.map(k => [k, f(data.members[k])]));
  return { members: new Set(keys), exempt: new Set(keys.filter(k => data.members[k].exempt)), entitlement: m(r => r.baseline), baseline: m(r => r.baseline),
    quota: new Map(), compliance: m(() => 1), prod: new Map(), spare: m(r => r.spare), target, mode: 'defend', floodFear: 0, _playerQuotaTarget: null };
};
const quotas = (text, data, target) => { const B = world(data, target); fn(text)({ countries: new Map(), _alignment: () => 1 }, B, null, 30, null); return B.quota; };
const sum = obj => Object.values(obj.members).reduce((s, r) => s + r.baseline, 0);
for (const [label, text, data] of [['patched', patched, P], ['unmodded', original, V]]) {
  const q = quotas(text, data, null);
  check([...q].every(([k, v]) => Math.abs(v - data.members[k].baseline) < 1e-12), `${label}, no cut: every quota equals its entitlement (day 0 unchanged)`);
}
const target = 0.9 * sum(P);
const qp = quotas(patched, P, target), qv = quotas(original, V, target);
check(Math.abs(qp.get('364') - P.members['364'].baseline) < 1e-12, 'patched, 10% cut: Iran keeps its full entitlement', String(qp.get('364')));
check(qv.get('364') < V.members['364'].baseline - 1e-6, 'unmodded, 10% cut: Iran was cut', String(qv.get('364')));
check(Math.abs([...qp.values()].reduce((a, b) => a + b, 0) - target) < 1e-9, 'patched, 10% cut: quotas still sum to the target');
check(qp.get('682') < qv.get('682'), 'patched, 10% cut: the non-exempt members carry Iran\'s share (Saudi quota lower)', `${qp.get('682')} vs ${qv.get('682')}`);

console.log(failures ? `${failures} of ${checks} checks FAILED` : `${checks}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
