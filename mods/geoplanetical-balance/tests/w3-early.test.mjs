// W3 early-retirement function test: the helpers W3 adds around the game's early obligation retirement (since build
// 26368058 the game retires a dead state's open obligations among its early retirement steps, before W3's hook).
// Runs the patched __geobalW3Spare0 / __geobalW3Early / __geobalW3Unspare, sliced from the built bundle, on the game's
// own obligation resolver (QKA) and selection (E9B), with recording stubs for the ledger and validation calls.
// Checks which rows a W3 conquest keeps open (the conquered treasury's rows with other living countries) and which
// it retires as the game does, every fallback to the game's own step, the flag's lifetime, the refusal path, and that
// the game's a9B (whose body __geobalW3Early follows) is unchanged. End to end: w3.headless.mjs.
// Usage: node mods/geoplanetical-balance/tests/w3-early.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const ok = (cond, what, detail = '') => { checks++; if (!cond) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

// A top-level function's source, by brace matching (string literals skipped).
const fnSource = (text, name) => {
  const s = text.indexOf(`function ${name}(`);
  if (s < 0 || text.indexOf(`function ${name}(`, s + 1) >= 0) throw new Error(`${name}: not found once`);
  let depth = 0, q = null;
  for (let i = text.indexOf('{', s); i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(s, i + 1);
  }
  throw new Error(`${name}: unbalanced`);
};

// The game's a9B, which __geobalW3Early follows step by step: a change here needs W3's copy re-checked.
ok(fnSource(original, 'l9B') === 'function l9B(A,B,Q=0){let g=String(B||"");if(!g||!Number.isSafeInteger(Q)||Q<0)throw new Error("economic-obligation:retirement-input");let C=zt(A,{touchedAccountIds:[]}),e=v9B(A,g,C.open);if(!e)return Object.freeze({retiredCount:0,amountBn:0});let{rows:r,entries:w,amountBn:D}=e;kA(A,{day:Q,kind:"economic_obligation_country_retirement",refs:{countryKey:g,retiredCount:r.length,amountBn:D},entries:w});for(let o of r)delete C.open[o.id];return u$(C),zt(A,{touchedAccountIds:w.map(o=>o.accountId)}),Object.freeze({retiredCount:r.length,amountBn:D})}',
  "the game's l9B is the body __geobalW3Early follows (unchanged)");
// The early step calls the helper, which runs the game's own a9B whenever W3 is not taking over.
ok(patched.includes('id:"finance:economic-obligations"') && patched.includes('run:(A,B)=>__geobalW3Early(A,B,()=>l9B(A.finance,B.country.key,A.day||0))})') &&
  original.includes('run:(A,B)=>l9B(A.finance,B.country.key,A.day||0)})'), 'the early obligation step goes through __geobalW3Early');

// The helpers, from `var __geobalW3Spare` to the hook they precede, and the game's resolver and selection.
const hs = patched.indexOf('var __geobalW3Spare=null;'), he = patched.indexOf('function T1C(A,B,Q){', hs);
if (hs < 0 || he < hs || he - hs > 3000) throw new Error('W3 early helpers not found');
const calls = [];
const gA = x => Math.round(x * 1e8);
const W = a => a.reduce((t, x) => t + gA(x), 0) / 1e8;
const o9B = (F, items) => items.flatMap(({ row, units }) => [
  { accountId: row.payer.payableAccountId, side: 'debitBn', units }, { accountId: row.payee.receivableAccountId, side: 'creditBn', units }]);
const QKA = new Function(`return (${fnSource(original, 'oKA')})`)();
const E9B = new Function('oKA', 'P9B', 'gA', 'W', `return (${fnSource(original, 'v9B')})`)(QKA, o9B, gA, W);
const zt = (F, opts) => { calls.push(['zt', opts.touchedAccountIds.slice()]); return F.economicObligations; };
const kA = (F, entry) => { calls.push(['kA', entry.kind, entry.refs.countryKey, entry.refs.retiredCount, entry.day]); };
const n$ = () => { calls.push(['u$']); };
const a9B = (F, k, d) => { calls.push(['l9B', k, d]); return 'game l9B'; };
const H = new Function('zt', 'v9B', 'kA', 'u$', 'oKA', 'l9B',
  `${patched.slice(hs, he)};return {Spare0:__geobalW3Spare0,Early:__geobalW3Early,Unspare:__geobalW3Unspare,flag:()=>__geobalW3Spare}`)(zt, E9B, kA, n$, QKA, a9B);

// A world: Austria (040) conquered by Switzerland (756, heir), Germany (276) alive; companies and households of each.
const tr = k => ({ ownerType: 'treasury', ownerId: `treasury:${k}`, payableAccountId: `pay:${k}`, receivableAccountId: `rec:${k}` });
const co = (id, k) => ({ ownerType: 'company', ownerId: id, payableAccountId: `pay:${id}`, receivableAccountId: `rec:${id}`, _k: k });
const world = (extra = {}) => {
  const rows = [
    ['heir', tr('040'), tr('756')], // conquered treasury owes the heir's treasury: retired (as the game does)
    ['heir-back', tr('756'), tr('040')], // the heir's treasury owes the conquered: retired
    ['third', tr('040'), tr('276')], // owes Germany's treasury: kept for W3
    ['third-back', tr('276'), tr('040')], // Germany's treasury owes the conquered: kept
    ['heir-co', tr('040'), co('c756', '756')], // owes a company of the heir's country: kept (a living country)
    ['third-co', co('c276', '276'), tr('040')], // a German company owes it: kept
    ['own-co', tr('040'), co('c040', '040')], // owes a company of its own (dead) country: retired
    ['own-co-only', co('c040', '040'), co('c276', '276')], // not the treasury: retired as the game does
    ['nowhere', tr('040'), { ownerType: 'other', ownerId: 'x' }], // counterparty resolves to no country: retired
    ['self', tr('040'), tr('040')], // the same treasury both sides: retired
    ['others', tr('276'), tr('756')], // the dead state is no party: untouched
  ];
  const open = Object.fromEntries(rows.map(([id, payer, payee], i) => [id, { id, payer, payee, remainingBn: i + 1 }]));
  return {
    day: 40,
    finance: {
      sovereigns: { '040': { id: 'treasury:040', countryKey: '040' }, '756': { id: 'treasury:756', countryKey: '756' }, '276': { id: 'treasury:276', countryKey: '276' }, ...extra.sovereigns },
      companies: { c756: { headquartersCountryKey: '756' }, c276: { headquartersCountryKey: '276' }, c040: { headquartersCountryKey: '040' } },
      accounts: {}, economicObligations: { open },
    },
  };
};
const step = (A, key = '040') => H.Early(A, { country: { key } }, () => { calls.push(['vanilla']); return 'vanilla'; });
const conquest = { country: '040', heir: '756' };

// W3 conquest: keeps the conquered treasury's rows with living countries, retires the rest as a9B does.
{
  calls.length = 0;
  const A = world();
  const r = H.Spare0(conquest, () => step(A));
  const left = Object.keys(A.finance.economicObligations.open).sort().join();
  ok(left === 'heir-co,others,third,third-back,third-co', 'conquest: kept the rows with other living countries (treasuries and companies), untouched rows stay', left);
  ok(r.retiredCount === 6 && Object.isFrozen(r), 'conquest: retired the heir pairs, own-country, no-country and self rows (6)', JSON.stringify(r));
  ok(Math.abs(r.amountBn - (1 + 2 + 7 + 8 + 9 + 10)) < 1e-9, 'conquest: the retired amount is their sum', String(r.amountBn));
  const k = calls.find(c => c[0] === 'kA');
  ok(k && k[1] === 'economic_obligation_country_retirement' && k[2] === '040' && k[3] === 6 && k[4] === 40, 'conquest: one ledger entry of the game\'s kind, for the conquered country, on today', JSON.stringify(k));
  const z = calls.filter(c => c[0] === 'zt');
  ok(z.length === 2 && z[0][1].length === 0 && z[1][1].length === 12 && calls.some(c => c[0] === 'u$'), 'conquest: validation before and after over the touched accounts, caches invalidated, as l9B does');
  ok(!calls.some(c => c[0] === 'vanilla'), "conquest: the game's step is replaced, not run as well");
  ok(H.flag() === null, 'the flag is cleared after the early steps');
}
// Fallbacks to the game's own step.
for (const [what, x, key, extra] of [
  ['no conquest flag', null, '040', {}],
  ['another country retiring', conquest, '276', {}],
  ['no heir', { country: '040', heir: null }, '040', {}],
  ['heir without a sovereign', { country: '040', heir: '999' }, '040', {}],
  ['heir is the conquered state', { country: '040', heir: '040' }, '040', {}],
  ['conquered sovereign already dissolved', conquest, '040', { sovereigns: { '040': { id: 'treasury:040', countryKey: '040', status: 'dissolved' } } }],
  ['heir sovereign dissolved', conquest, '040', { sovereigns: { '756': { id: 'treasury:756', countryKey: '756', status: 'dissolved' } } }],
]) {
  calls.length = 0;
  const A = world(extra);
  const r = H.Spare0(x, () => step(A, key));
  ok(r === 'vanilla' && calls.length === 1 && Object.keys(A.finance.economicObligations.open).length === 11, `fallback (${what}): the game's step runs unchanged`);
}
// Nothing to retire: the same frozen zero receipt as a9B, no ledger entry.
{
  calls.length = 0;
  const A = world();
  for (const id of ['heir', 'heir-back', 'own-co', 'own-co-only', 'nowhere', 'self']) delete A.finance.economicObligations.open[id];
  const r = H.Spare0(conquest, () => step(A));
  ok(r.retiredCount === 0 && r.amountBn === 0 && Object.isFrozen(r) && !calls.some(c => c[0] === 'kA') && Object.keys(A.finance.economicObligations.open).length === 5,
    'conquest with only kept rows: zero receipt, no ledger entry, rows stay');
}
// The flag lives only while the early steps run, also when they throw.
{
  let threw = false;
  try { H.Spare0(conquest, () => { throw new Error('boom'); }); } catch { threw = true; }
  ok(threw && H.flag() === null, 'the flag is cleared when the early steps throw');
  ok(H.Spare0(conquest, () => H.flag()) === conquest, 'the flag is visible while the early steps run');
}
// W3 refused: the kept rows are retired at once through the game's own a9B.
{
  calls.length = 0;
  H.Unspare(world(), '040');
  ok(calls.length === 1 && calls[0][0] === 'l9B' && calls[0][1] === '040' && calls[0][2] === 40, "refusal: the game's l9B retires the conquered state's rows, today");
  calls.length = 0;
  H.Unspare({ day: 3, finance: {} }, '040');
  ok(calls.length === 0, 'refusal without an obligation store: nothing to do');
}
// Call site: the flag is set only for a conquest with an heir, and the refusal runs only when W3 refused.
ok(patched.includes('F=__geobalW3Spare0(g.integration||U==null?null:{country:String(q),heir:String(U)},()=>nFA(A,p));T1C(A,q,a);let __gbW3R=g.integration?null:__geobalW3(A,q,a,U);g.integration||__gbW3R||__geobalW3Unspare(A,q);'),
  'call site: flag for conquests with an heir only; refusal fallback only when W3 refused');

console.log(failures ? `${failures} of ${checks} checks FAILED` : `${checks}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
