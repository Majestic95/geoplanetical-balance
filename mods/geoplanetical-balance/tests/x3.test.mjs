// X3 function test: refined lunar metal returned to Earth is worth USD 10 000 a tonne in the value of a return cargo
// (qCa, which the AI weighs against a return flight's cost) instead of USD 80 million; helium-3 and Mars deposits keep
// their value. Using the metal keeps the game's value (design decision, 2026-11-18: "separate the two"): the module quote's
// credit constant (w3t = 0.08 bn a tonne) and its 20 % cap are unchanged, so an order uses the same tonnage and gets
// the same credit. qCa and the module quote's credit statement are sliced from the balance mod built with and without
// this patch and run with stubs for the helium-3 price, the stock cap and the country's stock.
// Usage: node mods/geoplanetical-balance/tests/x3.test.mjs (from the repo root)
import { workspaceBuild, buildAll, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

// The balance mod built with and without this patch (approved from the proposals 2026-11-18).
const ID = 'x3-lunar-metal-earth-price';
const [MOD] = loadMods(MODS_DIR, { only: ['geoplanetical-balance'] });
if (!MOD.patches.some(x => x.id === ID)) throw new Error(`${ID} is not in the balance mod`);
const SIMB = m => buildAll(workspaceBuild(), [m]).get('simulation-worker.bundle.js').text;
const patched = SIMB(MOD), withoutFix = SIMB({ ...MOD, patches: MOD.patches.filter(x => x.id !== ID) });
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

const ANCHOR = '{machinery:.45,electronics:.35,metal_products:.2}),w3t=';
const QUOTE_HEAD = 'C=y2(e,t)?.strategicStock||{},_=M*F0o,k={},R=';
const QUOTE_END = 'let x=R*w3t;';
const lib = text => {
  const a = text.indexOf(ANCHOR);
  if (a < 0 || text.indexOf(ANCHOR, a + 1) >= 0) throw new Error('constant not found once');
  const w3t = Number(text.slice(a + ANCHOR.length, text.indexOf(',', a + ANCHOR.length)));
  const s = text.indexOf('function qCa(e,t,a={}){'), e = text.indexOf('}function R3t(', s) + 1;
  if (s < 0 || e - s > 500) throw new Error('qCa not found');
  // Since 1.1.5 the cargo value also counts Mars deposits (a5: the deposit ids, HKe: their Earth price), outside X3.
  const qCa = new Function('xe', 'AEe', 'l2e', 'w3t', 'a5', 'HKe', `${text.slice(s, e)};return qCa;`)(
    x => Number(x) || 0, () => 1000, () => 2.5, w3t, ['gold'], (A, k, id, q) => 3 * q);
  // The module quote's credit: R tonnes of the country's stock, at most 20 % of the cost M (F0o), credit x = R * w3t.
  const q0 = text.indexOf(QUOTE_HEAD), q1 = text.indexOf(QUOTE_END, q0);
  if (q0 < 0 || text.indexOf(QUOTE_HEAD, q0 + 1) >= 0 || q1 < 0 || q1 - q0 > 300) throw new Error('module quote not found once');
  const body = text.slice(q0, q1 + QUOTE_END.length);
  const quote = new Function('y2', 'xe', 'F0o', 'w3t', 'M', 'e', 't', `let ${body}return{R,x,k};`)
    .bind(null, (A) => ({ strategicStock: A.stock }), x => Number(x) || 0, 0.2, w3t);
  return { w3t, qCa, quote, quoteText: body };
};
const P = lib(patched), V = lib(withoutFix);
check(V.w3t === 0.08 && P.w3t === 0.08, 'module credit constant unchanged: 0.08 bn a tonne', `${V.w3t} / ${P.w3t}`);
check(Math.abs(V.qCa({}, 'X', { refined_space_metals: 10 }) - 0.8) < 1e-12, 'without the fix: 10 t of returned metal valued at USD 0.8 bn');
check(Math.abs(P.qCa({}, 'X', { refined_space_metals: 10 }) - 1e-4) < 1e-12, 'patched: 10 t valued at USD 100 000', String(P.qCa({}, 'X', { refined_space_metals: 10 })));
check(P.qCa({}, 'X', { helium3: 2 }) === V.qCa({}, 'X', { helium3: 2 }), 'helium-3 value unchanged');
check(P.qCa({}, 'X', { gold: 2 }) === 6 && V.qCa({}, 'X', { gold: 2 }) === 6, 'Mars deposits (1.1.5) keep their own price');
check(P.quoteText === V.quoteText, 'module quote credit code identical in both builds');
// A 1 bn module, 5 000 t in stock: the 20 % cap binds at 2.5 t, credit 0.2 bn, in both builds; the stock is not swept.
for (const [M, stock] of [[1, 5000], [1, 1], [0.5, 0], [10, 100]]) {
  const p = P.quote(M, { stock: { refined_space_metals: stock } }, {}), v = V.quote(M, { stock: { refined_space_metals: stock } }, {});
  check(p.R === v.R && p.x === v.x, `module order (cost ${M} bn, stock ${stock} t): same tonnage and credit`, `${JSON.stringify(p)} vs ${JSON.stringify(v)}`);
  if (M === 1 && stock === 5000) check(Math.abs(p.R - 2.5) < 1e-9 && Math.abs(p.x - 0.2) < 1e-12, '5 000 t in stock: the order uses 2.5 t for a 0.2 bn credit', JSON.stringify(p));
}
const around = (text, a = text.indexOf('function qCa('), c = text.indexOf('}function R3t(', a)) => text.slice(a - 2000, a) + text.slice(c, c + 2000);
check(around(withoutFix) === around(patched), 'nothing else changed around the return-cargo value');

console.log(failures ? `${failures} of ${checks} checks FAILED` : `${checks}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
