// FF8 function test: a currency reform's household deposit haircut (vjt) is followed by a write-down of every household
// loan of the reformed country by the same share, through the game's own loan write-off (g8e with gB and y8e), and the
// loan's repayment schedule (original principal, amortisation, accrued interest; both mortgage parts) is scaled by the
// same factor, so the next instalment (the game's TH) falls in proportion. A mortgage whose parts do not add up is
// skipped with a warning instead of throwing halfway through the reform. vjt, the patch's helpers, g8e, gB, y8e, Cne,
// kne, TH and the game's exact-money module (le, St, oe, Y, zi and their helpers) are taken from the bundles; the
// ledger post (ke, recorded and checked to balance), the bank solvency test ($i), is, SVe, TA, Zc, tt and F2 are stubbed.
// Usage: node mods/geoplanetical-balance/tests/ff8.test.mjs (from the repo root)
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
  let depth = 0, i = text.indexOf('){', s) + 1;
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(s, i + 1);
};
const money = (text) => { // the game's exact-money module, from pYe through Qbr
  const a = text.indexOf('function pYe(e)'); if (a < 0) throw new Error('money module start missing');
  const q = text.indexOf('function Qbr(e,t,a)'); let depth = 0, i = text.indexOf('{', q);
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(a, i + 1);
};
const names = ['vjt', 'Cne', 'gB', 'y8e', 'g8e', 'kne', 'TH'];
const make = (text, rec) => {
  const extra = text.includes('function __geobalReformLoans(') ? fnSrc(text, '__geobalReformTerms') + fnSrc(text, '__geobalReformLoans') : '';
  const src = `${money(text)}${names.map((n) => fnSrc(text, n)).join('')}${extra};return {vjt,TH,g8e,gB,le};`;
  return new Function('ke', '$i', 'is', 'SVe', 'TR', 'Ut', 'Xb', 'K', 'TA', 'Zc', 'tt', 'F2', 'console', src)(
    (r, tx) => { rec.posts.push(tx); return tx; },
    () => ({ solvent: true, equityBn: 1 }), () => {}, () => {},
    (x, lo, hi) => Math.max(lo, Math.min(hi, x)), (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d), 1e-9,
    (a, b) => (a < b ? -1 : a > b ? 1 : 0), () => 1, () => 0, (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d), 1e-9,
    { warn: (...a) => rec.warnings.push(a.join(' ')) },
  );
};
const loan = (id, qty, terms) => ({ id, type: 'bank_loan', active: true, quantityIssued: qty, currencyCode: 'XXX',
  terms: { bankId: 'b1', maturityMonths: 120, settledMonths: 20, principalArrearsBn: 0, accruedInterestBn: 0.01, annualRatePct: 5,
    accounts: { loanLiabilityId: `ll-${id}`, forgivenessIncomeId: `fi-${id}` }, ...terms } });
const world = () => {
  const instruments = {
    L1: loan('L1', 1.0, { originalPrincipalBn: 1.2 }),
    M1: loan('M1', 1.0, { originalPrincipalBn: 1.3, housingMortgage: { originalPrincipalBn: 0.8, consumerOriginalPrincipalBn: 0.5,
      outstandingPrincipalBn: 0.6, consumerOutstandingPrincipalBn: 0.4, maturityMonths: 300, principalAmortizationBnM: 0.003 }, principalAmortizationBnM: 0.004 }),
    BAD: loan('BAD', 1.0, { originalPrincipalBn: 1.3, housingMortgage: { originalPrincipalBn: 0.8, consumerOriginalPrincipalBn: 0.5,
      outstandingPrincipalBn: 0.5, consumerOutstandingPrincipalBn: 0.4, maturityMonths: 300 } }),
    LZ: loan('LZ', 2.0, { originalPrincipalBn: 2.0 }),
  };
  const positions = {}; for (const [k, v] of Object.entries(instruments)) positions[k] = { b1: { holderId: 'b1', quantity: v.quantityIssued, bookValueBn: v.quantityIssued } };
  return { day: 400, finance: {
    households: {
      h1: { id: 'h1', countryKey: 'X', assetAccountId: 'a1', financialExpenseAccountId: 'fe1', bankId: 'b1', bankLoanInstrumentIds: ['L1', 'M1'] },
      h2: { id: 'h2', countryKey: 'X', assetAccountId: 'a2', financialExpenseAccountId: 'fe2', bankId: 'b1', bankLoanInstrumentIds: ['BAD'] },
      hz: { id: 'hz', countryKey: 'Z', assetAccountId: 'az', financialExpenseAccountId: 'fez', bankId: 'b1', bankLoanInstrumentIds: ['LZ'] },
    },
    accounts: { a1: { balanceBn: 2 }, a2: { balanceBn: 1 }, az: { balanceBn: 3 } },
    banks: { b1: { id: 'b1', status: 'active', accountIds: { depositLiability: 'bdl', resolutionIncome: 'bri', creditLossExpense: 'bcl', loanAsset: 'bla' } } },
    instruments, positions,
  } };
};
const run = (text) => { const rec = { posts: [], warnings: [] }, w = world(), g = make(text, rec); const before = JSON.parse(JSON.stringify(w.finance.instruments));
  let err = null; try { g.vjt(w, { key: 'X' }, 0.85); } catch (e) { err = e; } return { rec, w, g, before, err }; };
const near = (a, b, tol = 2e-8) => Math.abs(a - b) <= tol;
const O = run(original), P = run(patched);
check(!O.err && !P.err, 'the reform runs to the end in both builds', `${O.err?.message} ${P.err?.message}`);
check(!O.rec.posts.some((x) => x.kind === 'bank_loan_writeoff'), 'unmodded: no household loan is written down');
check(JSON.stringify(O.rec.posts.filter((x) => x.kind === 'household_deposit_haircut')) === JSON.stringify(P.rec.posts.filter((x) => x.kind === 'household_deposit_haircut')), 'deposit haircuts unchanged');
const balanced = (tx) => near(tx.entries.reduce((s, e) => s + (e.debitBn || 0), 0), tx.entries.reduce((s, e) => s + (e.creditBn || 0), 0), 1e-9);
check(P.rec.posts.every(balanced), 'every ledger post balances (debits = credits)');
const I = P.w.finance.instruments, B = P.before;
{ // plain loan
  check(near(I.L1.quantityIssued, 0.15) && near(P.w.finance.positions.L1.b1.quantity, 0.15), 'plain loan: outstanding cut by 85% (real g8e/gB/y8e)', String(I.L1.quantityIssued));
  check(near(I.L1.terms.originalPrincipalBn, 0.18) && near(I.L1.terms.accruedInterestBn, 0.0015), 'plain loan: original principal and accrued interest scaled by the same factor', JSON.stringify(I.L1.terms));
  const g = P.g, o = O.g, after = g.TH(I.L1, 1, null), pre = o.TH(B.L1, 1, null), unm = o.TH(O.w.finance.instruments.L1, 1, null);
  check(near(after.principalDueBn, pre.principalDueBn * 0.15, 1e-7), 'plain loan: next instalment is 15% of the pre-reform one', `${pre.principalDueBn} -> ${after.principalDueBn}`);
  check(near(unm.principalDueBn, pre.principalDueBn), 'unmodded: the loan and its instalment are unchanged');
}
{ // mortgage
  const m = I.M1.terms.housingMortgage;
  check(near(m.outstandingPrincipalBn + m.consumerOutstandingPrincipalBn, I.M1.quantityIssued) && near(I.M1.quantityIssued, 0.15), 'mortgage: both outstanding parts cut and still summing to the loan', JSON.stringify(m));
  check(near(m.originalPrincipalBn, 0.12) && near(m.consumerOriginalPrincipalBn, 0.075) && near(I.M1.terms.originalPrincipalBn, m.originalPrincipalBn + m.consumerOriginalPrincipalBn, 1e-12), 'mortgage: both original parts scaled and the opening identity kept', JSON.stringify({ m, o: I.M1.terms.originalPrincipalBn }));
  check(near(m.principalAmortizationBnM, 0.003 * I.M1.quantityIssued / 1.0, 1e-12) && near(I.M1.terms.principalAmortizationBnM, 0.004 * I.M1.quantityIssued / 1.0, 1e-12), 'mortgage: monthly amortisation scaled by the remaining share of the loan', JSON.stringify({ d: m.principalAmortizationBnM, t: I.M1.terms.principalAmortizationBnM, q: I.M1.quantityIssued }));
  let thErr = null, after = null; try { after = P.g.TH(I.M1, 1, null); } catch (e) { thErr = e; }
  const pre = O.g.TH(B.M1, 1, null);
  check(!thErr && near(after.principalDueBn, pre.principalDueBn * 0.15, 1e-7), 'mortgage: TH runs after the reform and the instalment falls to 15%', `${thErr?.message} ${pre.principalDueBn} -> ${after?.principalDueBn}`);
}
{ // broken mortgage invariant: skipped, the rest of the reform still applied
  check(I.BAD.quantityIssued === 1.0 && P.rec.warnings.some((x) => /mortgage parts do not add up/.test(x)), 'a mortgage whose parts do not add up is skipped with a warning', P.rec.warnings.join('|'));
  let threw = false; try { O.g.gB(B.BAD, { quantity: 1, bookValueBn: 1 }, 0.85); } catch (e) { threw = /mortgage-principal/.test(e.message); }
  check(threw, "the game's write-off would have thrown on it (banking:mortgage-principal)");
}
check(I.LZ.quantityIssued === 2.0, "another country's household loans are untouched");
{
  const rec = { posts: [], warnings: [] }, w = world(); make(patched, rec).vjt(w, { key: 'X' }, 0);
  check(!rec.posts.some((x) => x.kind === 'bank_loan_writeoff'), 'a zero haircut writes nothing down');
}
console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
