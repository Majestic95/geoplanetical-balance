// U10 function test: the payment clearing (Vge) pays a payer's old unpaid bills (arrears) after wages and required
// purchases but ahead of this month's other bills, oldest first; before the fix arrears were paid last. Vge is taken
// from both bundles; the money-unit helpers (le, Ye) are stubbed with exact 1e-8 units.
// Usage: node mods/geoplanetical-balance/tests/u10.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };
const fnSrc = (text, name) => {
  const s = text.indexOf(`function ${name}(`);
  if (s < 0 || text.indexOf(`function ${name}(`, s + 1) >= 0) throw new Error(`${name}: not found once`);
  let depth = 0, i = text.indexOf('={}){', s) + 4;
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(s, i + 1);
};
// The priority constants and the wage-kind set sit just before Vge: `zOt=new Set([...]),YOt=0,jYe=1,VOt=2,FSr=3,$Ot=4;`
const prelude = (text) => {
  const v = text.indexOf('function Vge(');
  const a = text.lastIndexOf('=new Set(["private_wage"', v);
  const start = text.lastIndexOf(',', a) + 1;
  return 'var ' + text.slice(start, v);
};
const load = (text) => new Function('le', 'DI', 'HOt', 'ZOt', 'QOt', 'qSr',
  `${prelude(text)}${fnSrc(text, 'Vge')};return Vge;`)(
  (x) => Math.round(x * 1e8), (u) => u / 1e8, 0, new WeakMap(), new WeakMap(), Object.freeze({}));
const O = load(original), P = load(patched);
check(original.includes('O[Na]=nt?FSr:ya?YOt:wt?jYe:VOt'), 'original ranks arrears in the last bucket');

const acct = (bal) => ({ normal: 'debit', balanceBn: bal });
const world = (cash, open) => ({
  accounts: { firm: acct(cash), wkr: acct(0), sup1: acct(0), sup2: acct(0), sup3: acct(0) },
  economicObligations: { open: Object.fromEntries(open.map((o) => [o.id, o])) },
});
const ob = (id, kind, amt, payee, dueDay, extra = {}) => ({ id, kind, amountBn: amt, dueDay, issuedDay: dueDay,
  payer: { cashAccountId: 'firm', ownerType: 'company', ownerId: 'f' }, payee: { cashAccountId: payee, ownerType: 'company', ownerId: payee }, ...extra });
const paid = (res) => Object.fromEntries(res.payments.map((p) => [p.obligationId, p.amountBn]));

// Cash 10: wages 2 (new), required input 3 (new), arrears 4 (day 10), other new bill 5 (day 40).
const arrears = ob('old', 'goods', 4, 'sup1', 10);
const fresh = [ob('wage', 'private_wage', 2, 'wkr', 40), ob('req', 'goods', 3, 'sup2', 40, { refs: { paymentRequired: true } }),
  ob('new', 'goods', 5, 'sup3', 40)];
const run = (V) => paid(V(world(10, [arrears]), { obligations: fresh, day: 40, requiredShortfallPolicy: 'arrears' }));
const o = run(O), p = run(P);
check(o.wage === 2 && o.req === 3 && o.new === 5 && !(o.old > 0), 'original: new bill paid in full, arrears unpaid (negative control)', JSON.stringify(o));
check(p.wage === 2 && p.req === 3 && p.old === 4 && p.new === 1, 'patched: wages, required, arrears, then new bill', JSON.stringify(p));

// Extreme: cash covers only wages; nothing else paid either way.
const q = paid(P(world(2, [arrears]), { obligations: fresh, day: 40, requiredShortfallPolicy: 'arrears' }));
check(q.wage === 2 && !(q.old > 0) && !(q.new > 0), 'patched: wages still first when cash is short', JSON.stringify(q));
// Two arrears: the older is paid first.
const two = [ob('older', 'goods', 3, 'sup1', 5), ob('newer', 'goods', 3, 'sup2', 20)];
const r = paid(P(world(4, two), { obligations: [ob('new', 'goods', 5, 'sup3', 40)], day: 40, requiredShortfallPolicy: 'arrears' }));
check(r.older === 3 && r.newer === 1 && !(r.new > 0), 'patched: oldest arrears first', JSON.stringify(r));
// Wage arrears are not ranked ahead of required purchases (they keep the arrears bucket, behind required).
const wa = [ob('oldwage', 'private_wage', 3, 'wkr', 10)];
const s = paid(P(world(4, wa), { obligations: [ob('req', 'goods', 3, 'sup2', 40, { refs: { paymentRequired: true } })], day: 40, requiredShortfallPolicy: 'arrears' }));
check(s.req === 3 && s.oldwage === 1, 'patched: required purchase ahead of arrears', JSON.stringify(s));
// Enough cash: everything paid, same as the original.
const full = paid(P(world(100, [arrears]), { obligations: fresh, day: 40, requiredShortfallPolicy: 'arrears' }));
check(full.wage === 2 && full.req === 3 && full.old === 4 && full.new === 5, 'patched: full cash pays everything', JSON.stringify(full));

// The payee is itself short of cash: firm pays sup1 its 4 of arrears; sup1 (no cash) then owes sup2 old arrears of 2 and
// sup3 a new bill of 3, and can pay them only from what it receives. The clearing iterates receipts, so sup1 pays its
// own arrears before its new bill.
const chainWorld = () => ({
  accounts: { firm: acct(4), sup1: acct(0), sup2: acct(0), sup3: acct(0) },
  economicObligations: { open: { old: ob('old', 'goods', 4, 'sup1', 10), s1old: { ...ob('s1old', 'goods', 2, 'sup2', 12), payer: { cashAccountId: 'sup1', ownerType: 'company', ownerId: 'sup1' } } } },
});
const s1new = { ...ob('s1new', 'goods', 3, 'sup3', 40), payer: { cashAccountId: 'sup1', ownerType: 'company', ownerId: 'sup1' } };
const co = paid(O(chainWorld(), { obligations: [s1new], day: 40, requiredShortfallPolicy: 'arrears' }));
const cp = paid(P(chainWorld(), { obligations: [s1new], day: 40, requiredShortfallPolicy: 'arrears' }));
check(co.old === 4 && co.s1new === 3 && co.s1old === 1, 'original: the short payee pays its new bill before its arrears (negative control)', JSON.stringify(co));
check(cp.old === 4 && cp.s1old === 2 && cp.s1new === 2, 'patched: the short payee pays its arrears from its receipts first', JSON.stringify(cp));
console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
