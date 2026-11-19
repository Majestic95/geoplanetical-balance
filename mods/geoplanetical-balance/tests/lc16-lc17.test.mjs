// LC16 and LC17 function test: lwC, and C6B, iMQ and e6B, cut from the patched and the original bundle, run with stubs.
// Usage: node mods/geoplanetical-balance/tests/lc16-lc17.test.mjs
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
  if (i < 0 || j < 0 || j - i > 3000) throw new Error(`${from} not found`);
  return text.slice(i, j + to.length);
};
const G = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// LC16.
const lwC = text => new Function('Lm', 'm4e', 'K', `${between(text, 'function lwo(e,t,a,r,o){', '[0]||null}')}; return lwo;`)(A => A, e => e.subject, G);
const caseOf = (actId, to, subject = 'law1') => ({ id: `${actId}:${to.personId}`, actId, from: { personId: 'me' }, to, subject, updatedDay: 1, status: 'answered' });
const world = cases => ({ cases: Object.fromEntries(cases.map(c => [c.id, c])) });
const me = { personId: 'me' }, bench = { personId: 'b2', partyId: 'p1' }, other = { personId: 'c1', partyId: 'p2' };
const asked = world([caseOf('lawSupport', { personId: 'b1', partyId: 'p1' })]);
const P16 = lwC(patched), V16 = lwC(original);
check(P16(asked, me, bench, 'lawSupport', 'law1') !== null, 'LC16 patched: another member of the same party counts as already asked');
check(V16(asked, me, bench, 'lawSupport', 'law1') === null, 'LC16 original: another member is a fresh roll (the bug)');
check(P16(asked, me, other, 'lawSupport', 'law1') === null, 'LC16: another party can still be asked');
check(P16(asked, me, bench, 'lawSupport', 'law2') === null, 'LC16: the same party can be asked about another law');
check(P16(asked, { personId: 'you' }, bench, 'lawSupport', 'law1') === null, 'LC16: another asker is separate, as before');
const noParty = world([caseOf('lawSupport', { personId: 'x1', partyId: null })]);
check(P16(noParty, me, { personId: 'x2', partyId: null }, 'lawSupport', 'law1') === null, 'LC16: two people with no party do not match each other');
check(P16(noParty, me, { personId: 'x1', partyId: null }, 'lawSupport', 'law1') !== null, 'LC16: a person with no party keeps the per-person rule');
const un = world([caseOf('unVoteMatch', { personId: 'b1', partyId: 'p1' })]);
check(P16(un, me, bench, 'unVoteMatch', 'law1') === null, 'LC16: other letter types stay per person');
check(/partyId:e\?\.party\|\|null,personId:e\?\.id\|\|null/.test(patched), 'LC16: the target record still carries the party');

// LC17: C6B, c6B and iMQ together. The AI's own lean comes from a stub through _alignment.
const load = text => {
  const src = [between(text, 'function G6t(e,t,a){', ':null}'), between(text, 'function Z6t(e,t){', ':null}'), between(text, 'function cqa(e,t,a){', '"no":"abstain"}'), between(text, 'function W6t(e,t,a){', 'return o}')].join('');
  return new Function('qLa', 'K', 'CF', 'lC', 'Zt', 'zl', 'LO', 'LLa', 'KC', 'WO', 'Lee', '_x', `${src}; return {C6B:G6t, c6B:Z6t, iMQ:cqa, e6B:W6t};`)(
    A => A.engagements, G, (A, k) => ({ key: k }), () => [], () => null, () => 0, () => false, d => d,
    (A, ...r) => A.trust.push(r), () => {}, { kept: 1, broken: -1 }, () => 'm');
};
const pledge = o => ({ id: 'e1', type: 'un_vote_pledge', status: 'active', subjectRef: { entityId: 'r1' }, debtorCountryKey: 'D', creditorCountryKey: 'P', promisedVote: 'yes', createdDay: 1, to: { personId: 't' }, from: { personId: 'f' }, ...o });
const state = () => ({ engagements: { e1: pledge({}) }, trust: [], day: 9, people: new Set(['t', 'f']), playerControlsGovernment: () => false, _alignment: () => 0 });
const res = votes => ({ id: 'r1', type: 'other', targetKey: 'T', votesByCountry: votes });
const P17 = load(patched), V17 = load(original);
const natural = 'abstain'; // with alignment 0 and type "other", w = -.05
check(P17.iMQ(state(), { key: 'D' }, res({})) === 'yes', 'LC17: the creditor has not voted: the pledge binds, as before');
check(P17.iMQ(state(), { key: 'D' }, res({ P: 'yes' })) === 'yes', 'LC17: the creditor voted as asked: the pledge binds');
check(P17.iMQ(state(), { key: 'D' }, res({ P: 'no' })) === natural, 'LC17 patched: the creditor votes otherwise: the AI votes its own way');
check(V17.iMQ(state(), { key: 'D' }, res({ P: 'no' })) === 'yes', 'LC17 original: the AI stays bound (the bug)');
check(P17.iMQ(state(), { key: 'D' }, res({ D: 'no', P: 'yes' })) === 'no', 'LC17: a stored vote of the debtor still wins');
// Two countries pledged to each other: stored votes only, so no recursion.
{
  const s = state();
  s.engagements.e2 = pledge({ id: 'e2', debtorCountryKey: 'P', creditorCountryKey: 'D', promisedVote: 'yes' });
  check(P17.iMQ(s, { key: 'D' }, res({})) === 'yes' && P17.iMQ(s, { key: 'P' }, res({})) === 'yes', 'LC17: mutual pledges resolve with no recursion');
}
// Settlement.
const settle = (lib, votes) => { const s = state(); const out = lib.e6B(s, 'r1', Object.entries(votes).map(([countryKey, vote]) => ({ countryKey, vote }))); return { e: s.engagements.e1, out, trust: s.trust }; };
{
  const a = settle(P17, { D: 'abstain', P: 'no' });
  check(a.e.status === 'lapsed' && a.trust.length === 0 && a.out.length === 0, 'LC17 patched: released by the creditor\'s vote: lapses, no trust lost');
  const b = settle(V17, { D: 'abstain', P: 'no' });
  check(b.e.status === 'broken' && b.trust.length === 1, 'LC17 original: the same case counts as broken');
  const c = settle(P17, { D: 'yes', P: 'yes' });
  check(c.e.status === 'fulfilled' && c.trust.length === 1, 'LC17: kept pledge: fulfilled, trust moves');
  const d = settle(P17, { D: 'no', P: 'yes' });
  check(d.e.status === 'broken' && d.trust.length === 1, 'LC17: the creditor kept to it and the debtor did not: broken');
  const e = settle(P17, { D: 'yes', P: 'no' });
  check(e.e.status === 'fulfilled', 'LC17: the debtor kept it anyway: fulfilled');
  const f = settle(P17, { D: 'no' });
  check(f.e.status === 'broken', 'LC17: no vote recorded for the creditor: broken, as before');
  const g = settle(P17, { P: 'no' });
  check(g.e.status === 'lapsed', 'LC17: the debtor did not vote: lapses, as before');
}

console.log(failures ? `${failures} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
