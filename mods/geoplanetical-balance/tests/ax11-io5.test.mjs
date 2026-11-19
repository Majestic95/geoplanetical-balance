// AX11 and IO5 function test: code cut from the patched and the original bundle, run with stubs.
// AX11: the declaration test in LQC. IO5: the retaliation clause W8C drafts, and the game's activity test on it.
// Usage: node mods/geoplanetical-balance/tests/ax11-io5.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const between = (text, from, to) => {
  const i = text.indexOf(from), j = text.indexOf(to, i);
  if (i < 0 || j < 0 || j - i > 4000) throw new Error(`${from} not found`);
  return text.slice(i, j + to.length);
};

// AX11: the declaration test in LQC, the AI's own war path against the player.
const declare = (text, powers, aeaResult = true) => {
  const m = text.match(/if\((?:!He\(t,"defense"\)\|\|!He\(t,"diplomacy"\)\|\|)?!sfe\(e,t\.key,n,i,r\.objective\.statusProfileId,a\.key\)\)return\{ok:!1,reasonId:"declaration"\};/);
  if (!m) throw new Error('declaration test not found');
  let called = 0;
  const out = new Function('He', 'sfe', 'e', 't', 'n', 'i', 'r', 'a', `${m[0]}return{ok:!0}`)(
    (c, d) => powers[d] !== false, () => { called++; return aeaResult; }, {}, { key: 'X' }, 'cb', [], { objective: {} }, { key: 'P' });
  return { ok: out.ok, called };
};
for (const [name, powers, want] of [['both powers', {}, true], ['no defence', { defense: false }, false], ['no diplomacy', { diplomacy: false }, false], ['neither', { defense: false, diplomacy: false }, false]])
  check(declare(patched, powers).ok === want, `AX11 patched, attacker with ${name}: ${want ? 'may declare' : 'refused'}`);
check(declare(patched, { defense: false }).called === 0, 'AX11: a refused attacker does not reach the declaration');
check(declare(original, { defense: false, diplomacy: false }).ok === true, 'AX11 original: an attacker with neither power may declare (the bug)');
check(declare(patched, {}, false).ok === false, 'AX11: the declaration\'s own refusals still count');
check(between(patched, 'function sfe(e,t,a,r=null,o=null,n=e.playerKey){', 'return!1;') === between(original, 'function sfe(e,t,a,r=null,o=null,n=e.playerKey){', 'return!1;'), 'AX11: w1e itself is unchanged, so a nuclear strike in flight still starts its war');
check(/!He\(t,"defense"\)\|\|!He\(t,"diplomacy"\)\|\|!He\(a,"diplomacy"\)/.test(original), 'AX11: the AI-against-AI rule it copies is still there');

// IO5: the clause W8C drafts.
const draft = text => {
  const src = between(text, 'function gGo(e,t,a,r=null){', 'causeDisputeId:a.id}]}}');
  const f = new Function('Xe', 'mSt', 'hGo', 'oGo', `${src}; return gGo;`)(() => ['R'], () => 5, () => [{ goodId: 'steel', value: 100 }], 730);
  const act = { sponsorKey: 'R', clauses: [{ id: 'c', ratePct: 25 }] };
  return f({ tradePolicy: { acts: new Map([['a', act]]) } }, 'o', { sourceActId: 'a', claimRefs: [{ clauseId: 'c' }], respondentPartyId: 'r', complainantPartyId: 'c', id: 'd' }).clauses[0];
};
check(draft(patched).durationDays === null, 'IO5 patched: the retaliation clause has no end date');
check(draft(original).durationDays === 730, 'IO5 original: it ends after 730 days');
check(draft(patched).legalBasis === 'retaliation' && draft(patched).causeDisputeId === 'd' && draft(patched).ratePct === draft(original).ratePct, 'IO5: the rest of the clause is unchanged');
{
  const jYB = new Function(`${between(patched, 'function MVt(e,t){', 'e.expiresDay)}')}; return MVt;`)();
  check(jYB({ status: 'active', expiresDay: null }, 1e6) === true, 'IO5: a clause with no end date stays active');
  check(jYB({ status: 'repealed', expiresDay: null }, 1) === false, 'IO5: a repealed one does not');
  check(/durationDays==null\?null:/.test(patched), 'IO5: the clause builder turns no duration into no end date');
  check(/expiresDay=Number\.isFinite\(\w+\.expiresDay\)\?.{0,60}:null/.test(patched), 'IO5: the save normaliser keeps no end date');
  check(/expiresDay!=null&&\(!Number\.isInteger/.test(patched), 'IO5: the validator accepts no end date');
  check(/legalBasis==="retaliation"&&\w+\.causeDisputeId===\w+&&\w+\.basisLostDay==null/.test(patched), 'IO5: settling a dispute still flags its clauses for repeal');
}

console.log(failures ? `${failures} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
