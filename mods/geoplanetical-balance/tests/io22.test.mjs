// IO22 function test: the AI's candidate goods for retaliation, and the validator that used to strip them, from the bundle.
// Usage: node --max-old-space-size=4000 mods/geoplanetical-balance/tests/io22.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const between = (text, from, to, max = 3000) => {
  const i = text.indexOf(from), j = text.indexOf(to, i);
  if (i < 0 || j < 0 || j - i > max) throw new Error(`${from} not found`);
  return text.slice(i, j + to.length);
};

const LNA = ['grain', 'steel', 'machinery'];
const JNA = new Function('jXe', 'HXe', `${between(patched, 'function zXe(e,t=[]){', 'return[...HXe[e]||[]]}')}; return zXe;`)(LNA, {});
check(between(patched, 'function zXe(e,t=[]){', 'return[...HXe[e]||[]]}') === between(original, 'function zXe(e,t=[]){', 'return[...HXe[e]||[]]}'), 'the validator is the game\'s own, unchanged');
check(JNA('custom', ['tourism']).length === 0 && JNA('custom', ['tourism', 'steel'])[0] === 'steel', 'the validator strips services (why the clause came back empty)');

const goods = [{ id: 'tourism', sector: 'services' }, { id: 'steel', sector: 'industry' }, { id: 'grain', sector: 'agriculture' }];
const X8C = text => new Function('nr', 'ge', 'tGo', 'aGo', 'rGo', 'yGo', 'K', 'jXe', `${between(text, 'function hGo(e,t,a,r){', 'K(n.goodId,i.goodId))}')}; return hGo;`);
const flows = rows => rows.map(([goodId, tradeValue, exporterActorId = 'E', importerActorId = 'I']) => ({ goodId, tradeValue, exporterActorId, importerActorId }));
const run = (text, rows) => X8C(text)(() => flows(rows), { goods }, { agriculture: 1.45, consumer: 1.25, industry: 1.1 }, 0.9, 0.35, () => 0, (a, b) => (a < b ? -1 : a > b ? 1 : 0), LNA)({}, {}, new Set(['E']), new Set(['I']));

{
  const o = run(original, [['tourism', 100]]), p = run(patched, [['tourism', 100]]);
  check(o.length === 1 && o[0].goodId === 'tourism', 'IO22 original: tourism is chosen (the bug)');
  check(JNA('custom', o.map(x => x.goodId)).length === 0, 'IO22 original: and the validator then leaves no goods');
  check(p.length === 0, 'IO22 patched: only tourism, no candidates, so no draft is built');
}
{
  const o = run(original, [['tourism', 100], ['steel', 10]]), p = run(patched, [['tourism', 100], ['steel', 10]]);
  check(o[0].goodId === 'tourism', 'IO22 original: services rank first when larger');
  check(p.length === 1 && p[0].goodId === 'steel', 'IO22 patched: the tariffable good is chosen');
  check(p[0].score === o.find(x => x.goodId === 'steel').score, 'IO22: its score is unchanged');
}
{
  const rows = [['steel', 10], ['grain', 10]];
  check(JSON.stringify(run(patched, rows)) === JSON.stringify(run(original, rows)), 'IO22: goods only, the same list and order as the game');
  check(run(patched, [['steel', 0]]).length === 0, 'IO22: a zero value still drops out');
  check(run(patched, [['steel', 5, 'other', 'I']]).length === 0, 'IO22: another exporter does not count');
  check(run(patched, []).length === 0, 'IO22: no flows, no error');
}
check(patched.includes('l$t=Object.freeze(ge.goods.filter((e,t)=>!["service","lunar"].includes(e.tier)'), 'IO22: the real tariffable list leaves out services by tier');
check(/,jXe=Object\.freeze\(l\$t\.map\(e=>e\.id\)\)/.test(patched) && /new Set\(jXe\)/.test(patched), 'IO22: the list exists under this name in the bundle');
// The rate, in the game's own W8C: with services gone, value and rate are computed on goods that can carry a tariff.
{
  const W8C = new Function('hGo', 'Xe', 'mSt', 'oGo', `${between(patched, 'function gGo(e,t,a,r=null){', 'causeDisputeId:a.id}]}}')}; return gGo;`);
  const clause = { id: 'c', ratePct: 25 };
  const sim = { tradePolicy: { acts: new Map([['a', { sponsorKey: 'S', clauses: [clause] }]]) } };
  const dispute = { id: 'd', sourceActId: 'a', claimRefs: [{ clauseId: 'c' }], respondentPartyId: 'r', complainantPartyId: 'p', harmBnY: 5 };
  const draft = list => W8C(() => list, () => ['x'], () => 0, null)(sim, {}, dispute);
  const one = draft([{ goodId: 'steel', value: 100 }, { goodId: 'grain', value: 100 }]).clauses[0];
  check(one.goodIds.length === 1 && one.ratePct === 5, 'IO22: a small harm takes one good, at the rate that covers it', `${one.goodIds} at ${one.ratePct}`);
  const all = draft([{ goodId: 'steel', value: 2 }, { goodId: 'grain', value: 2 }]).clauses[0];
  check(all.goodIds.length === 2 && all.ratePct === 25, 'IO22: a harm larger than the trade takes every good, capped at the offending rate', `${all.goodIds} at ${all.ratePct}`);
  check(draft([]) === null, 'IO22: nothing tariffable, no draft');
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
