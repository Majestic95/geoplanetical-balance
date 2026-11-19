// X2 function test: the He-3 mine profile (mine_helium3 in the module profile table) yields 5.5 kg a month per unit with
// the patch and 40 without it; every other field of the profile is unchanged, and the AI's yearly He-3 estimate (the
// game's VL, run with its site, module and grade lookups stubbed) takes the same field, so it scales by 5.5 / 40.
// Usage: node mods/geoplanetical-balance/tests/x2.test.mjs (from the repo root)
import { workspaceBuild, buildAll, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const ID = 'x2-helium3-mine-rate';
const [MOD] = loadMods(MODS_DIR, { only: ['geoplanetical-balance'] });
if (!MOD.patches.some(x => x.id === ID)) throw new Error(`${ID} is not in the balance mod`);
const SIMB = m => buildAll(workspaceBuild(), [m]).get('simulation-worker.bundle.js').text;
const patched = SIMB(MOD), withoutFix = SIMB({ ...MOD, patches: MOD.patches.filter(x => x.id !== ID) });
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

const profile = text => {
  const h = 'mine_helium3:Object.freeze({family:"extraction"', s = text.indexOf(h);
  if (s < 0 || text.indexOf(h, s + 1) >= 0) throw new Error('He-3 profile not found once');
  const e = text.indexOf('})', s);
  return new Function(`return (${text.slice(s + 'mine_helium3:Object.freeze('.length, e + 1)})`)();
};
const o = profile(withoutFix), p = profile(patched);
check(o.rate === 40 && p.rate === 5.5, 'rate 40 -> 5.5 kg a month per unit', `${o.rate} -> ${p.rate}`);
const rest = x => JSON.stringify({ ...x, rate: 0 });
check(rest(o) === rest(p), 'power, maintenance, output and the water co-product unchanged', `${rest(o)} vs ${rest(p)}`);
check(p.powerNeed === 5.5 && p.coProductId === 'water_ice' && p.coProductRate === 1, 'power need kept at 5.5 MW');
// The game's own VL (the AI's He-3 stock and yearly mine output), sliced from both builds and run on one site with one
// operational mine at full grade and capacity 1; the profile table kn comes from each build.
const vlOf = (text, prof) => {
  const s = text.indexOf('function VL(e,t){'), e = text.indexOf('function ', s + 10);
  if (s < 0 || e - s > 1500) throw new Error('VL not found');
  const S2 = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  return new Function('kn', 'mf', 'vPa', 'Bc', 'n5', 'Do', 'YL', 'S2', 'yu', 'o5', 'Li', 'SPa', 'CEe', `${text.slice(s, e)};return VL;`)(
    { mine_helium3: prof }, () => null, () => 0, () => [{ id: 's1', bodyId: 'moon', regionId: 'r1', operatorId: 'op' }], () => 'r1', () => ({}),
    () => true, S2, () => ({ helium3: 0 }), () => 1, () => [{ profileId: 'mine_helium3', state: 'operational', capacity: 1 }], () => [], 0);
};
const yo = vlOf(withoutFix, o)({ space: {} }, { key: 'X' }).ownMineKgPerYear, yp = vlOf(patched, p)({ space: {} }, { key: 'X' }).ownMineKgPerYear;
check(yo === 480 && Math.abs(yp - 66) < 1e-9, 'AI yearly estimate per unit, from the game VL: 480 -> 66 kg (the Mark II miner)', `${yo} -> ${yp}`);
const VLHEAD = 'f.profileId==="mine_helium3"&&f.state==="operational"&&(i+=S2(l?.rate)';
check(patched.includes(VLHEAD) && withoutFix.includes(VLHEAD), 'the AI estimate still reads the profile rate (kn.mine_helium3)');

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
