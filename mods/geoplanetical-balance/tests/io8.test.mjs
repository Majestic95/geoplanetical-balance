// IO8 function test: the daily sanctions review (Zg) no longer ends a coalition regime because its initiator left; the
// other members keep their sanctions, the regime still ends for its other reasons (war over, annexation reversed), and
// the withdrawal quote (_k) no longer reports that the coalition closes. Zg is taken from both bundles with its helpers
// stubbed (geo, weo, gL, VK, Aut, Il); the quote is checked in the bundle text.
// Usage: node mods/geoplanetical-balance/tests/io8.test.mjs (from the repo root)
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
const load = (text) => new Function('geo', 'weo', 'gL', 'VK', 'Aut', 'Il', '__geobalUnRelease', `${fnSrc(text, 'Zg')};return Zg;`)(
  () => false, () => [], () => false, () => false, () => {}, () => {}, () => false);
const O = load(original), P = load(patched);
const regime = (extra) => ({ id: 's1', targetKey: 'T', statusId: 'active', sourceTypeId: 'coalition', objectiveId: 'punitive',
  initiatorKey: 'PLAYER', participants: [{ countryKey: 'A' }, { countryKey: 'B' }], ...extra });
const world = (regimes, conflicts = []) => ({ day: 200, sanctions: regimes, conflicts: new Map(conflicts.map((c) => [c.id, c])) });

// Initiator has left; two members remain.
const wo = world([regime()]), wp = world([regime()]);
O(wo); P(wp);
check(wo.sanctions[0].statusId === 'ended', 'original: the coalition ends when its initiator leaves (negative control)', wo.sanctions[0].statusId);
check(wp.sanctions[0].statusId === 'active' && wp.sanctions[0].participants.length === 2, 'patched: remaining members keep the regime', JSON.stringify(wp.sanctions[0]));
// Initiator still a member: active either way.
const w2 = world([regime({ participants: [{ countryKey: 'PLAYER' }, { countryKey: 'A' }] })]);
P(w2); check(w2.sanctions[0].statusId === 'active', 'patched: coalition with its initiator stays active');
// Other end reasons still work: a war-support regime whose war ended.
const w3 = world([regime({ sourceTypeId: 'war_support', sourceId: 'c9' })], [{ id: 'c9', status: 'ended' }]);
P(w3); check(w3.sanctions[0].statusId === 'ended' && w3.sanctions[0].endedDay === 200, 'patched: war-support regime still ends with its war');
const w4 = world([regime({ sourceTypeId: 'war_support', sourceId: 'c9' })], [{ id: 'c9', status: 'active' }]);
P(w4); check(w4.sanctions[0].statusId === 'active', 'patched: war-support regime with its war running stays');
// Quote (_k): coalitionCloses is now true only when the leader withdrawing is the last participant.
const closes = (text) => { const m = /coalitionCloses:([^,]+),limits/.exec(fnSrc(text, '_k')); if (!m) throw new Error('coalitionCloses missing'); return new Function('a', 'r', 'o', `return ${m[1]};`); };
const CO = closes(original), CP = closes(patched);
const qa = { effect: 'withdraw_participation' };
const qr = (n) => ({ sourceTypeId: 'coalition', objectiveId: 'punitive', initiatorKey: 'P', participants: Array.from({ length: n }, (_, i) => ({ countryKey: i ? 'X' + i : 'P' })) });
check(CO(qa, qr(3), { countryKey: 'P' }) === true, 'original: the leader leaving a 3-member coalition is told it closes (negative control)');
check(CP(qa, qr(3), { countryKey: 'P' }) === false, 'patched: leader leaving a 3-member coalition: others remain');
check(CP(qa, qr(1), { countryKey: 'P' }) === true, 'patched: leader as the last member: the case closes');
check(CP(qa, qr(3), { countryKey: 'X1' }) === false && CP({ effect: 'suspend' }, qr(1), { countryKey: 'P' }) === false, 'patched: other members and suspensions: no closing warning');
console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
