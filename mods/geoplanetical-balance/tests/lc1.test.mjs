// LC1 function test: the AI's alliance bar (relations.allyAcceptRelation) is 40 with the patch and 60 without it, the
// rest of the relations table is unchanged, and the 1.1.5 readers (the AI partner search TNo, the acceptance check MAe
// and the country inspector's snapshot, Ayr) still read the setting rather than a constant. Also shows the settled
// scale: alignment x 45 with no aid passes 40 from alignment 0.89 and never passes 60.
// Usage: node mods/geoplanetical-balance/tests/lc1.test.mjs (from the repo root)
import { workspaceBuild, buildAll, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const ID = 'lc1-alliance-relation-bar';
const [MOD] = loadMods(MODS_DIR, { only: ['geoplanetical-balance'] });
if (!MOD.patches.some(x => x.id === ID)) throw new Error(`${ID} is not in the balance mod`);
const SIMB = m => buildAll(workspaceBuild(), [m]).get('simulation-worker.bundle.js').text;
const patched = SIMB(MOD), withoutFix = SIMB({ ...MOD, patches: MOD.patches.filter(x => x.id !== ID) });
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

// The relations table, read as numbers (the _doc text is dropped).
const table = text => {
  const h = 'relations:{alignmentScale:', s = text.indexOf(h);
  if (s < 0 || text.indexOf(h, s + 1) >= 0) throw new Error('relations table not found once');
  const e = text.indexOf(',_doc:', s);
  return new Function(`return ({${text.slice(s + 'relations:{'.length, e)}})`)();
};
const o = table(withoutFix), p = table(patched);
check(o.allyAcceptRelation === 60 && p.allyAcceptRelation === 40, 'bar 60 -> 40', `${o.allyAcceptRelation} -> ${p.allyAcceptRelation}`);
check(JSON.stringify({ ...o, allyAcceptRelation: 0 }) === JSON.stringify({ ...p, allyAcceptRelation: 0 }), 'every other relations value unchanged');
check(o.alignmentScale === 45 && o.driftPerMonth === .08 && o.allyFloor === 45, 'settled scale is still alignment x 45, drift 8% a month');

const readers = text => (text.match(/\.allyAcceptRelation\b/g) || []).length;
check(readers(patched) === 4 && readers(withoutFix) === 4, 'four reads of the setting, unchanged (TNo filter, MAe test, MAe refusal reason, the inspector snapshot)', `${readers(withoutFix)} -> ${readers(patched)}`);
check(patched.includes('At(e,n.partner,t)>=r.allyAcceptRelation') && patched.includes('i>=r.allyAcceptRelation&&n>=r.allyAcceptAlign'),
  'TNo and MAe compare relations with the setting');
// Settled relations (alignment x 45, no aid) against each bar.
const settled = a => a * o.alignmentScale;
check(settled(.89) >= 40 && settled(.88) < 40, 'at 40 a pair without aid stays eligible from alignment 0.89');
check(settled(1) < 60, 'at 60 no pair without aid stays eligible once relations settle');
check(!/allyAcceptRelation:60/.test(patched), 'no copy of the old bar left in the simulation');
check(patched.includes('allianceAcceptance:{relationMin:$f(Jr.relations.allyAcceptRelation)'), 'the inspector snapshot sends the setting, so the "close" badge moves with it');

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
