// K1/K2 function test: the construction-capacity room (KeQ), the game's stretch-or-refuse rule (NPA) and the patch's
// helpers (__geobalK12Qty, __geobalK12Months) cut from the patched and the original bundle, run with the game's own
// constants (Skg = 3, wv) and a stubbed construction price (Ls).
//   AI orders (player flag off): the helper returns exactly what NPA returns, on a grid that includes no room, zero
//   and invalid quantities and war.
//   Player orders: never refused; an order that fits keeps its months, one that does not is stretched to the months
//   the room needs, at most 3x; no room gives 3x; at war or with nothing to build, the months are unchanged.
//   Quantity: cost x the basket's normalised construction share / the local construction price, as the game's own
//   material orders compute it (mG -> VK), so the check and the order book count the same quantity.
// Usage: node mods/geoplanetical-balance/tests/k1-k2.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;

const cut = (text, endMarker) => {
  const start = text.indexOf('function a4Q(A,B){');
  const end = text.indexOf(endMarker, start);
  if (start < 0 || end < 0 || end - start > 3000) throw new Error('a4Q/NPA block not found');
  return text.slice(start, end + endMarker.length);
};
const constant = (text, re) => { const m = text.match(re); if (!m) throw new Error(`constant ${re} not found`); return Number(m[1]); };
const Skg = constant(original, /,bbg=(\d+(?:\.\d+)?);function a4Q\(/);
const wv = constant(original, /,WM=(\.?\d+(?:\.\d+)?),YN=/);
const TZA = 'construction#';
const Ls = (A, key, good) => good === 'construction' ? A.prices?.[key] : undefined;
const load = (src, names) => new Function('bbg', 'CeB', 'WM', 'tc', `${src}; return {${names}};`)(Skg, TZA, wv, Ls);
const P = load(cut(patched, 'return r<=g?g:Math.min(r,g*bbg)}'), 'KeQ:a4Q,NPA:ulA,__geobalK12Qty,__geobalK12Months');
const V = load(cut(original, 'return e<=g?g:e<=g*bbg?e:null}'), 'KeQ:a4Q,NPA:ulA');

let failures = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
check(Skg === 3 && wv === 0.1, 'game constants read from the bundle', `bbg ${Skg}, wv ${wv}`);
check(String(P.NPA) === String(V.NPA) && String(P.KeQ) === String(V.KeQ), 'NPA and a4Q themselves are unchanged');

// A country with yearly construction capacity capY, other (non-project) use otherY and an order book of `books`
// projects (each needing `need` construction units over 12 months, none received yet).
const country = ({ capY = 100, otherY = 50, books = 0, need = 12, atWar = false } = {}) => {
  const B = { key: 'X', atWar, we: { cap: { [TZA]: capY }, cons: { [TZA]: otherY + 5 }, constructionDemand: { [TZA]: 5 } } };
  const A = { construction: Array.from({ length: books }, (_, i) => ({ id: i + 1, owner: 'X', monthsTotal: 12, materials: { construction: { requiredQuantity: need, receivedQuantity: 0 } } })), extractProjects: [], prices: { X: 2 } };
  return { A, B };
};
// room = 100 x 1.1 - 50 - books x 12
const room = o => P.KeQ(country(o).A, country(o).B).roomY;
check(Math.abs(room({}) - 60) < 1e-9 && Math.abs(room({ books: 5 }) - 0) < 1e-9, 'room as the game computes it', `${room({})}, ${room({ books: 5 })}`);

// AI: identical to NPA on a grid.
let same = 0, total = 0;
for (const o of [{}, { books: 3 }, { books: 5 }, { books: 9 }, { atWar: true, books: 9 }, { capY: 0 }])
  for (const Q of [0, -1, NaN, 1, 5, 30, 60, 200, 1e6])
    for (const g of [0, 1, 6, 24, 84]) {
      const { A, B } = country(o);
      total++;
      if (Object.is(P.__geobalK12Months(A, B, Q, g, false), V.NPA(A, B, Q, g))) same++;
    }
check(same === total, 'AI orders: the helper returns what NPA returns', `${same}/${total}`);

// Player.
const pm = (o, Q, g) => { const { A, B } = country(o); return { p: P.__geobalK12Months(A, B, Q, g, true), ai: V.NPA(A, B, Q, g) }; };
let r = pm({}, 30, 24); // 12 x 30 / 60 = 6 months needed, 24 given
check(r.p === 24 && r.ai === 24, 'player order that fits keeps its months', JSON.stringify(r));
r = pm({}, 120, 12); // needs 24 months, 12 given (2x)
check(r.p === 24 && r.ai === 24, 'player order needing 2x is stretched like the AI\'s', JSON.stringify(r));
r = pm({}, 600, 12); // needs 120 months, 12 given (10x): AI refused, player capped at 3x
check(r.p === 36 && r.ai === null, 'player order needing 10x gets 3x, never a refusal (AI: refused)', JSON.stringify(r));
r = pm({ books: 5 }, 10, 12); // no room
check(r.p === 36 && r.ai === null, 'no room: player 3x (AI: refused)', JSON.stringify(r));
r = pm({ books: 9 }, 10, 12); // negative room
check(r.p === 36 && r.ai === null, 'negative room: player 3x (AI: refused)', JSON.stringify(r));
r = pm({ atWar: true, books: 9 }, 600, 12);
check(r.p === 12 && r.ai === 12, 'at war: months unchanged (as NPA)', JSON.stringify(r));
for (const Q of [0, -5, NaN]) { r = pm({}, Q, 12); check(r.p === 12, `nothing to build (Q=${Q}): months unchanged`, JSON.stringify(r)); }
r = pm({}, 600, 0);
check(r.p === 0, 'zero months: unchanged (as NPA)', JSON.stringify(r));
let mono = true;
for (let Q = 1; Q < 2000; Q *= 1.7) { const a = pm({}, Q, 12).p, b = pm({}, Q * 1.7, 12).p; if (b < a || a < 12 || a > 36) mono = false; }
check(mono, 'player months grow with the order and stay within [g, 3g]');

// Quantity.
const { A } = country({});
const B = { key: 'X' };
const near = (a, b) => Math.abs(a - b) < 1e-12;
check(near(P.__geobalK12Qty(A, B, 8.4, { construction: 0.4, steel: 0.4, machinery: 0.2 }), 8.4 * 0.4 / 2), 'nuclear basket: cost x 0.4 / price');
check(P.__geobalK12Qty(A, B, 8.4, { steel: 0.5, base_metals: 0.04, machinery: 0.3 }) === 0, 'wind basket (no civil works): 0, so no check');
check(near(P.__geobalK12Qty(A, B, 3, { construction: 1, steel: 1 }), 3 * 0.5 / 2), 'basket shares are normalised, as mG does');
check(near(P.__geobalK12Qty(A, B, 5, { construction: 1 }), 5 / 2), 'public facilities ({construction: 1}): cost / price, as hqA computes');
check(P.__geobalK12Qty({ prices: {} }, B, 5, { construction: 1 }) === 0, 'no construction price: 0 (no check, as NPA with an invalid quantity)');
check(P.__geobalK12Qty(A, B, 5, null) === 0 && P.__geobalK12Qty(A, B, 0, { construction: 1 }) === 0, 'no basket or no cost: 0');
// Same quantity as the order book: VK(cost, normalised basket, price).required for construction.
const basket = { construction: 0.15, steel: 0.65, machinery: 0.2 }, sum = Object.values(basket).reduce((a, b) => a + b, 0);
check(near(P.__geobalK12Qty(A, B, 7, basket), 7 * (basket.construction / sum) / 2), 'same quantity the material order books (VK)');

console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
