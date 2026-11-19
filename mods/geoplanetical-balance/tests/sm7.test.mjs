// SM7 function test: the drug-market demand split (_la) from the balance mod built without and with this patch. Where
// the product is sold legally (Pla), the legal share responds to the levy on legal sales the way the gambling levy does:
// x ((1 + day-0 levy) / (1 + levy))^1.2, clamped 0.05-1.5, share capped at 1; the rest becomes illegal demand. Day-0
// levy, non-legal products and a missing fiscal0 are unchanged. Stubs: Xt, AG, ZLr, G0e, Pla; N7e is the game's own.
// Usage: node mods/geoplanetical-balance/tests/sm7.test.mjs (from the repo root)
import { workspaceBuild, buildAll, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const ID = 'sm7-legal-drug-tax-response';
const [MOD] = loadMods(MODS_DIR, { only: ['geoplanetical-balance'] });
if (!MOD.patches.some(x => x.id === ID)) throw new Error(`${ID} is not in the balance mod`);
const SIMB = m => buildAll(workspaceBuild(), [m]).get('simulation-worker.bundle.js').text;
const patched = SIMB(MOD), withoutFix = SIMB({ ...MOD, patches: MOD.patches.filter(x => x.id !== ID) });
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

const fnText = (text, head) => {
  const s = text.indexOf(head);
  if (s < 0 || text.indexOf(head, s + 1) >= 0) throw new Error(`${head} not found once`);
  let depth = 0, i = text.indexOf('{', s);
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(s, i + 1);
};
const Xt = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const load = (text, legal, share) => new Function('Xt', 'AG', 'ZLr', 'G0e', 'Pla', 'oYt',
  `${fnText(text, 'function N7e(')}${fnText(text, 'function _la(')}return _la;`)(
  Xt, () => 1, () => 100, () => share, () => legal, 1.2);
const N7e = new Function(`${fnText(patched, 'function N7e(')}return N7e;`)();
const country = (acc, acc0) => ({ pop: 10, taxes: { acc }, ...(acc0 === 'none' ? {} : { fiscal0: { rates: { acc: acc0 } } }) });
const run = (text, { legal = true, share = 0.4, acc = 30, acc0 = 30 } = {}) => {
  const m = { occasionalPct: 2, regularPct: 1, dependentPct: 0.5 }; load(text, legal, share)(country(acc, acc0), m, { id: 'cannabis' }); return m;
};
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

{
  const o = run(withoutFix), p = run(patched);
  check(near(o.legalDemandBnY, p.legalDemandBnY) && near(o.illegalDemandBnY, p.illegalDemandBnY), 'day-0 levy: split unchanged', JSON.stringify({ o, p }));
  check(near(o.grossDemandBnY, p.grossDemandBnY) && p.grossDemandBnY > 0, 'gross demand unchanged (and not zero)', String(p.grossDemandBnY));
}
{
  const o = run(withoutFix, { acc: 80 }), p = run(patched, { acc: 80 });
  const f = Math.pow((1 + N7e(30)) / (1 + N7e(80)), 1.2);
  check(near(o.legalDemandBnY, o.grossDemandBnY * 0.4), 'original: legal share ignores the levy');
  check(near(p.legalDemandBnY, p.grossDemandBnY * 0.4 * f) && f < 1, 'higher levy: legal share x the elasticity factor', `${p.legalDemandBnY} vs ${p.grossDemandBnY * 0.4 * f}`);
  check(near(p.illegalDemandBnY, p.grossDemandBnY - p.legalDemandBnY) && p.illegalDemandBnY > o.illegalDemandBnY, 'the lost legal demand becomes illegal demand', JSON.stringify({ o, p }));
}
{
  const o = run(withoutFix, { legal: false, acc: 80 }), p = run(patched, { legal: false, acc: 80 });
  check(near(o.legalDemandBnY, p.legalDemandBnY), 'product not sold legally (medical-only or banned): unchanged');
}
{
  const p = run(patched, { share: 0.95, acc: 0, acc0: 100 });
  check(p.legalDemandBnY <= p.grossDemandBnY + 1e-12 && p.illegalDemandBnY >= 0, 'deep levy cut: legal share capped at 1', JSON.stringify(p));
  const q = run(patched, { share: 0.4, acc: 0, acc0: 100 }), f = Math.min(1.5, Math.pow((1 + N7e(100)) / (1 + N7e(0)), 1.2));
  check(near(q.legalDemandBnY, q.grossDemandBnY * 0.4 * f) && f > 1, 'levy cut draws legal demand back (factor up to 1.5)');
}
{
  const o = run(withoutFix, { acc: 80, acc0: 'none' }), p = run(patched, { acc: 80, acc0: 'none' });
  check(near(o.legalDemandBnY, p.legalDemandBnY), 'no fiscal0 yet (genesis): the current levy is the reference, factor 1');
}
check(patched.includes('oYt))):1);t.grossDemandBnY') && !withoutFix.includes('oYt))):1);t.grossDemandBnY'), 'patch present only in the patched bundle');

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
