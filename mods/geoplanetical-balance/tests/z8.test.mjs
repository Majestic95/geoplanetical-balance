// Z8 function test: the disaster availability step (Gte's province and country loops) and the sector supply factor
// (Lar), mapped crops (QCo) and extractive fields (XCo) from the balance mod built without and with this patch.
// Availability becomes 1 - 0.4 x damage / capital (floor 15%, and the country fallback the economy reads,
// we.disasterSupplyFactor), and each shortfall is scaled by its sector's capital-intensity weight (crops and fields by
// their good's sector in the game's goods table); no damage gives 1, an unheld province 0.
// Stubs: Re, F9t, wZa, Er, ot, Zbt, _ae, Kk, Iae, RSe, ZCo, Kc, Xr.
// Usage: node mods/geoplanetical-balance/tests/z8.test.mjs (from the repo root)
import { workspaceBuild, buildAll, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const ID = 'z8-disaster-capital-share';
const [MOD] = loadMods(MODS_DIR, { only: ['geoplanetical-balance'] });
if (!MOD.patches.some(x => x.id === ID)) throw new Error(`${ID} is not in the balance mod`);
const SIMB = m => buildAll(workspaceBuild(), [m]).get('simulation-worker.bundle.js').text;
const patched = SIMB(MOD), withoutFix = SIMB({ ...MOD, patches: MOD.patches.filter(x => x.id !== ID) });
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };
const near = (a, b) => Math.abs(a - b) <= 1e-9;

const Er = (v, lo, hi) => Math.max(lo, Math.min(hi, v)), ot = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
// Gte's two loops: from the province loop to the end of the country loop.
const loops = text => {
  const a = text.indexOf('for(let o of e.world?.provinces||[]){let n=e.countries?.get?.(String(Re(o)||""))');
  const b = text.indexOf('}}var Fbo=', a);
  if (a < 0 || b < 0 || b - a > 800) throw new Error('Gte loops not found');
  return new Function('Re', 'F9t', 'wZa', 'Er', 'ot', `return (e,t,a,r)=>{${text.slice(a, b + 1)}}`)(
    o => o.owner, (n, o) => o.capital, (t, k) => t.damage[k] || 0, Er, ot);
};
const world = () => {
  const c = { key: 'X', capital: 1000, we: {} };
  return { e: { world: { provinces: [{ __provKey: 'p1', owner: 'X', capital: 100 }, { __provKey: 'p2', owner: 'X', capital: 100 }] }, countries: new Map([['X', c]]) },
    t: { damage: { p1: 20, p2: 0 } }, a: new Map([['X', 0]]), r: new Map([['X', 200]]), c };
};
{
  const wo = world(), wp = world();
  loops(withoutFix)(wo.e, wo.t, wo.a, wo.r); loops(patched)(wp.e, wp.t, wp.a, wp.r);
  const [o1, o2] = wo.e.world.provinces, [p1, p2] = wp.e.world.provinces;
  check(near(o1.__disasterAvailability, 0.8) && near(p1.__disasterAvailability, 1 - 0.4 * 0.2), 'province: 20% capital lost -> 0.8 before, 0.92 now', `${o1.__disasterAvailability} -> ${p1.__disasterAvailability}`);
  check(o2.__disasterAvailability === 1 && p2.__disasterAvailability === 1, 'undamaged province stays 1');
  check(near(wo.c.we.disasterSupplyFactor, 0.8) && near(wp.c.we.disasterSupplyFactor, 0.92), 'country fallback the economy reads (we.disasterSupplyFactor): 200 of 1000 lost -> 0.8 before, 0.92 now', `${wo.c.we.disasterSupplyFactor} -> ${wp.c.we.disasterSupplyFactor}`);
}
{
  const w = world(); w.t.damage.p1 = 100; w.r.set('X', 1000); loops(patched)(w.e, w.t, w.a, w.r);
  check(near(w.e.world.provinces[0].__disasterAvailability, 0.6) && near(w.c._disasterCapacity, 0.6), 'total loss: 0.6 (capital share), floor 15% kept');
}
// Lar with its weight table.
const lar = (text, zbt) => {
  const s = text.indexOf(text.includes('var __geobalZ8Weight=') ? 'var __geobalZ8Weight=' : 'function Lar(e,t){');
  const e = text.indexOf('function QCo(', s);
  if (s < 0 || e < 0 || e - s > 1200) throw new Error('Lar not found');
  return new Function('Zbt', '_ae', 'Kk', 'Iae', `${text.slice(s, e)};return Lar;`)(zbt, ot, Er, 1e-10);
};
const country = { key: 'X', provs: [{ id: 1, __sectorCapacityBn0: { industry: 10, finance: 10, mystery: 10 } }, { id: 2, __sectorCapacityBn0: { industry: 10, finance: 10, mystery: 10 } }] };
const avail = new Map([[1, 0.92], [2, 1]]);
const zbt = p => avail.get(p.id);
{
  const O = lar(withoutFix, zbt), P = lar(patched, zbt);
  check(near(O(country, 'industry'), 0.96) && near(O(country, 'finance'), 0.96), 'original: every sector the same (0.96)');
  check(near(P(country, 'industry'), 1 - 0.5 * 0.08 * 1.25), 'industry (weight 1.25): 0.95', String(P(country, 'industry')));
  check(near(P(country, 'finance'), 1 - 0.5 * 0.08 * 0.6), 'finance (weight 0.6): 0.976', String(P(country, 'finance')));
  check(near(P(country, 'mystery'), 0.96), 'unknown sector: weight 1');
  const P0 = lar(patched, p => (p.id === 1 ? 0 : 1));
  check(near(P0(country, 'finance'), 0.5), 'province not held (Zbt 0) still counts 0, not raised by a light weight');
  check(lar(patched, () => 1)(country, 'industry') === 1, 'no damage: 1');
}
// QCo (mapped crops) and XCo (extractive fields), sliced from both builds; goods sectors from a stubbed goods table.
const goods = new Map([['rice', { sector: 'agriculture' }], ['coal', { sector: 'energy' }], ['iron_ore', { sector: 'mining' }]]);
const fns = (text, zbt) => {
  const s = text.indexOf(text.includes('var __geobalZ8Weight=') ? 'var __geobalZ8Weight=' : 'function Lar(e,t){');
  const q = text.indexOf('function QCo('), j = text.indexOf('function JCo(', q), x = text.indexOf('function XCo('), y = text.indexOf('}return a}', x) + '}return a}'.length;
  if (s < 0 || q < 0 || j < 0 || x < 0 || y - x > 800) throw new Error('QCo/XCo not found');
  const helpers = text.includes('var __geobalZ8Weight=') ? text.slice(s, text.indexOf('function Lar(e,t){', s)) : '';
  return new Function('Zbt', '_ae', 'Kk', 'Iae', 'RSe', 'ZCo', 'Kc', 'Xr', `${helpers}${text.slice(q, j)}${text.slice(x, y)};return {QCo,XCo};`)(
    zbt, ot, Er, 1e-10, (n, g) => n.crop[g] || 0, goods, new Set(['coal', 'iron_ore']), f => f.units);
};
{
  const zbt = p => (p ? p.avail : 0);
  const O = fns(withoutFix, zbt), P = fns(patched, zbt);
  const c = { key: 'X', provs: [{ avail: 0.92, crop: { rice: 10 } }, { avail: 1, crop: { rice: 10 } }] };
  check(near(O.QCo(c, 'rice', 1), 0.96) && near(P.QCo(c, 'rice', 1), 1 - 0.5 * 0.08 * 0.8), 'crops: agriculture weight 0.8 (0.968 instead of 0.96)', `${O.QCo(c, 'rice', 1)} -> ${P.QCo(c, 'rice', 1)}`);
  const prov = { avail: 0.92 };
  const world = { fields: new Map([['f1', { owner: 'X', resource: 'coal', units: 5, provKey: 'p' }], ['f2', { owner: 'X', resource: 'iron_ore', units: 5, provKey: 'p' }]]), world: { provByKey: new Map([['p', prov]]) } };
  const own = new Map([['X', { key: 'X' }]]);
  const ro = O.XCo(world, own).get('X'), rp = P.XCo(world, own).get('X');
  check(near(ro.get('coal').weighted / 5, 0.92) && near(rp.get('coal').weighted / 5, 1 - 0.08 * 1.25), 'coal field: energy weight 1.25 (0.90 instead of 0.92)', `${ro.get('coal').weighted / 5} -> ${rp.get('coal').weighted / 5}`);
  check(near(rp.get('iron_ore').weighted / 5, 1 - 0.08 * 1.2), 'iron ore field: mining weight 1.2 (0.904)', String(rp.get('iron_ore').weighted / 5));
  prov.avail = 1;
  check(P.XCo(world, own).get('X').get('coal').weighted === 5, 'undamaged field: full output');
}

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
