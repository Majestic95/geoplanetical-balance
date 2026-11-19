// X5 function test: a lunar region's solar factor is capped by latitude (0.5 below 85 degrees, rising to 0.96 at the
// pole) where the region's resources are built (mYr); lower game values are kept. mYr and Xpa are sliced from the mod-only
// and patched bundles with the data table stubbed.
// Usage: node mods/geoplanetical-balance/tests/x5.test.mjs (from the repo root)
import { workspaceBuild, buildAll, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

// The balance mod built with and without this patch (approved from the proposals 2026-11-18).
const ID = 'x5-lunar-solar-latitude';
const [MOD] = loadMods(MODS_DIR, { only: ['geoplanetical-balance'] });
if (!MOD.patches.some(x => x.id === ID)) throw new Error(`${ID} is not in the balance mod`);
const SIMB = m => buildAll(workspaceBuild(), [m]).get('simulation-worker.bundle.js').text;
const patched = SIMB(MOD), withoutFix = SIMB({ ...MOD, patches: MOD.patches.filter(x => x.id !== ID) });
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

// Since 1.1.5 (build 26734764) the Moon's builder (mYr) passes its resources to a builder shared with Mars (Xpa).
const HEAD = 'function mYr(e,t){';
const lib = text => {
  const s = text.indexOf(HEAD), e = text.indexOf('function fYr(', s);
  const xs = text.indexOf('function Xpa('), xe = text.indexOf('function pYr(', xs);
  if (s < 0 || text.indexOf(HEAD, s + 1) >= 0 || e - s > 1200 || xs < 0 || xe - xs > 600) throw new Error('mYr/Xpa not found once');
  return new Function('oYr', `${text.slice(xs, xe)};${text.slice(s, e)};return mYr;`)({ 0: { solarFactor: .77 }, 1: { solarFactor: .3 }, 2: { solarFactor: .92 }, 3: {} });
};
const P = lib(patched), V = lib(withoutFix);
const solar = (L, lat, id = 0) => L({ c: [lat, 10] }, id).__spaceResources.solarFactor;
check(solar(V, 57.4) === .77 && solar(P, 57.4) === .5, 'mid-latitude: 0.77 -> 0.5', String(solar(P, 57.4)));
check(solar(P, 0) === .5 && solar(P, -85) === .5, 'equator and 85 S: 0.5');
check(Math.abs(solar(P, -88, 2) - .776) < 1e-12, '88 S: cap 0.776 below the game\'s 0.92', String(solar(P, -88, 2)));
check(solar(P, 90, 2) === .92 && solar(P, 89.9, 2) === .92, 'pole: the game\'s 0.92 is under the 0.96 cap, kept');
check(solar(P, 30, 1) === .3 && solar(V, 30, 1) === .3, 'a game value already below the cap is kept');
check(solar(P, 30, 3) === 0 && solar(V, 30, 3) === 0, 'missing data: 0 as before');
check(solar(P, NaN) === .5 && P({}, 0).__spaceResources.solarFactor === .5, 'no centroid: treated as equatorial');
const other = L => { const r = L({ c: [57.4, 10] }, 0); return JSON.stringify({ ...r, __spaceResources: { ...r.__spaceResources, solarFactor: 0 } }); };
check(other(P) === other(V), 'every other region field unchanged');

console.log(failures ? `${failures} of ${checks} checks FAILED` : `${checks}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
