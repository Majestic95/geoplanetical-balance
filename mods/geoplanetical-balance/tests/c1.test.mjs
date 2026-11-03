// C1 function test: extracts the patched validate/apply of the player verb finance.startCorporateInvestment from the
// Minified names in comments are those of build 26296134; the code and strings use the current build's names.
// built bundle and runs them with stubs for the game's pgA (project quote) and $3Q (project start), recording the
// terms each receives. Usage: node mods/geoplanetical-balance/tests/c1.test.mjs
import { workspaceBuild as pinnedBuild, buildAll, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const text = buildAll(pinnedBuild(), loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const at = text.indexOf('XA("finance.startCorporateInvestment"');
const vStart = text.indexOf('validate(A,B,Q){', at);
const aEnd = text.indexOf('}})', text.indexOf('apply(A,B,Q){', vStart)) + 1;
if (at < 0 || vStart < 0 || aEnd <= vStart || aEnd - vStart > 2000) throw new Error('verb not found in the patched bundle');
const calls = [];
const verb = new Function('n1A', 'FHQ', `return {${text.slice(vStart, aEnd)}};`)(
  (A, terms) => { calls.push({ fn: 'n1A', terms }); return { ok: true }; },
  (A, actor, terms) => { calls.push({ fn: 'FHQ', terms }); return { ok: true }; },
);

let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const world = (companies, projects = {}) => ({ finance: { companies, projects } });
const B = { key: '756' };
const priv = { id: 'p', headquartersCountryKey: '756', ownership: { controlled: false } };
const state = { id: 's', headquartersCountryKey: '756', ownership: { controlled: true } };
const noOwn = { id: 'n', headquartersCountryKey: '756' };
const Q = id => ({ companyId: id, costBn: 1 });

for (const [label, co] of [['private', priv], ['no ownership record', noOwn]]) {
  calls.length = 0;
  const A = world({ [co.id]: co });
  check(verb.validate(A, B, Q(co.id)) === true, `${label}: validate passes when the quote is ok`);
  check(calls[0]?.terms?.requireProfitable === true, `${label}: validate asks pgA for a profitable route`);
  verb.apply(A, B, Q(co.id));
  check(calls[1]?.fn === 'FHQ' && calls[1].terms.requireProfitable === true, `${label}: apply uses the same terms`);
}
{
  calls.length = 0;
  const A = world({ s: state });
  verb.validate(A, B, Q('s'));
  verb.apply(A, B, Q('s'));
  check(calls.length === 2 && calls.every(c => c.terms.requireProfitable === undefined), 'state-controlled: terms unchanged (no profitability requirement)');
}
// One funded expansion at a time for private firms; other purposes and other statuses don't count.
const proj = (companyId, status, purpose) => ({ companyId, status, ...(purpose ? { purpose } : {}) });
const refused = verb.validate(world({ p: priv }, { x: proj('p', 'funded') }), B, Q('p'));
check(refused?.ok === false && refused.reason === 'active_project', 'private: a funded expansion project blocks a second (purpose defaults to expansion)');
check(verb.validate(world({ p: priv }, { x: proj('p', 'funded', 'expansion') }), B, Q('p'))?.reason === 'active_project', 'private: explicit expansion purpose blocks');
check(verb.validate(world({ p: priv }, { x: proj('p', 'completed') }), B, Q('p')) === true, 'private: a completed project does not block');
check(verb.validate(world({ p: priv }, { x: proj('p', 'funded', 'renewal') }), B, Q('p')) === true, 'private: a funded renewal project does not block');
check(verb.validate(world({ p: priv }, { x: proj('other', 'funded') }), B, Q('p')) === true, "private: another company's project does not block");
check(verb.validate(world({ s: state }, { x: proj('s', 'funded') }), B, Q('s')) === true, 'state-controlled: no one-at-a-time limit');
// AI investment (decisionSource set, as the planner BPQ does) is untouched: original terms, no one-at-a-time limit.
{
  calls.length = 0;
  const ai = { companyId: 'p', capacity: 1, requireProfitable: true, decisionSource: 'corporate_market_signal' };
  const A = world({ p: priv }, { x: proj('p', 'funded') });
  check(verb.validate(A, B, ai) === true, 'AI path: a funded expansion does not block the planner');
  verb.apply(A, B, ai);
  check(calls.length === 2 && calls.every(c => c.terms === ai), 'AI path: validate and apply pass the planner terms unchanged');
}
// Existing checks unchanged.
check(verb.validate(world({}), B, Q('missing'))?.reason === 'company', 'unknown company refused as before');
check(verb.validate(world({ p: { ...priv, headquartersCountryKey: '840' } }), B, Q('p'))?.reason === 'company', 'foreign company refused as before');

console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
