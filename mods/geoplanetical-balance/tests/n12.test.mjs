// N12 function test: the dividend split (in pca) pays every holder on its unfrozen shares; the equity-ban check that
// withheld the target's holders' dividends is gone, the asset freeze (frozenQuantity) still withholds. The holder-share
// expression is sliced from the balance mod bundles built without and with this patch and evaluated with stubs.
// Usage: node mods/geoplanetical-balance/tests/n12.test.mjs (from the repo root)
import { workspaceBuild, buildAll, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

// The balance mod built with and without this patch (approved from the proposals 2026-11-18).
const ID = 'n12-equity-ban-dividends';
const [MOD] = loadMods(MODS_DIR, { only: ['geoplanetical-balance'] });
if (!MOD.patches.some(x => x.id === ID)) throw new Error(`${ID} is not in the balance mod`);
const SIMB = m => buildAll(workspaceBuild(), [m]).get('simulation-worker.bundle.js').text;
const patched = SIMB(MOD), withoutFix = SIMB({ ...MOD, patches: MOD.patches.filter(x => x.id !== ID) });
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

const ANCHOR = 'throw new Error("financial-markets:dividend-accounts")}';
const shares = text => {
  const a = text.indexOf(ANCHOR);
  if (a < 0 || text.indexOf(ANCHOR, a + 1) >= 0) throw new Error('dividend anchor not found once');
  const s = text.indexOf('u=s.map(', a), e = text.indexOf(',d=u.reduce(', s);
  if (s < 0 || e < 0 || e - a > 600) throw new Error('holder-share expression not found');
  // Sender 840 bans equity purchases in target 643: the pair "840>643" is in the policy set.
  return new Function('b4', 'c', 'o', 'xs', 'r', 'ka', 's', `let ${text.slice(s, e)};return u;`)(
    (pol, from, to) => pol.has(`${from}>${to}`), new Set(['840>643']), { headquartersCountryKey: '840' },
    (g, id) => id.split(':')[0], null, x => Number(x) || 0,
    [{ holderId: '643:fund', quantity: 100, frozenQuantity: 0 }, { holderId: '643:bank', quantity: 50, frozenQuantity: 50 },
      { holderId: '276:fund', quantity: 30, frozenQuantity: 10 }, { holderId: '840:fund', quantity: 20 }]);
};
const v = shares(withoutFix), p = shares(patched);
check(JSON.stringify(v) === JSON.stringify([0, 0, 20, 20]), 'without this patch: the target\'s holders of the sender\'s firm get nothing', JSON.stringify(v));
check(JSON.stringify(p) === JSON.stringify([100, 0, 20, 20]), 'patched: unfrozen holdings paid, frozen ones not', JSON.stringify(p));
check(!patched.slice(patched.indexOf(ANCHOR), patched.indexOf(ANCHOR) + 600).includes('"equity")?0:'), 'equity-ban check removed from the dividend split');
const trade = withoutFix.split('"equity"').length - patched.split('"equity"').length;
check(trade === 1, 'exactly one equity check removed; the purchase ban checks stay', String(trade));

console.log(failures ? `${failures} of ${checks} checks FAILED` : `${checks}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
