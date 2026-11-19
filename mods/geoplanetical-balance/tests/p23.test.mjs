// P23 function test: the head of government chosen after a legislative election (sRg) is the leading party's
// top-ranked bench member who may serve another term, as the game's own party-candidate rule (_partyCandidate)
// chooses. sRg is sliced from the patched and unmodded bundles; rB, x1, Xe, Qg, e5, G, AB and lf are stubbed.
// Usage: node mods/geoplanetical-balance/tests/p23.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

const fn = (text, name) => {
  const s = text.indexOf(`function ${name}(`);
  if (s < 0 || text.indexOf(`function ${name}(`, s + 1) >= 0) throw new Error(`${name}: not found once`);
  let depth = 0, q = null;
  for (let i = text.indexOf('){', s) + 1; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(s, i + 1);
  }
  throw new Error(`${name}: unbalanced`);
};
// A country: offices name their holder; `limits` lists people the term limit rules out; `caretaker` marks a caretaker.
const make = (text, limits = new Set()) => new Function('mt', 'B0', 'xn', 'Ia', 'l8', 'K', 'Ve', 'O7', `${fn(text, 'C4o')};return C4o;`)(
  (B, g) => B.offices[g] ?? null,
  (B, g) => B.holderParty?.[g] ?? null,
  B => ({ status: B.caretaker ? 'caretaker' : 'installed' }),
  () => ({ role: 'prime_minister' }),
  (A, w) => w.born == null || 2026 - w.born >= 18,
  (a, b) => a < b ? -1 : a > b ? 1 : 0,
  (B, g) => B.organs?.[g] ?? null,
  (B, organ, id) => ({ eligible: !limits.has(String(id)) }));
const person = (id, party, extra = {}) => ({ id, party, countryKey: 'K', alive: true, born: 1970, role: 'mp', ...extra });
const world = (people, B) => ({ A: { people: new Map(people.map(p => [p.id, p])) }, B: { key: 'K', organs: { head_of_gov: 'org:hog' }, ...B } });
// Party R wins; its bench ranks r9 (leader) then r5; r1 has the lowest id. The outgoing PM (p1) is from party L.
const PEOPLE = [person('p1', 'E', { role: 'prime_minister' }), person('h1', 'E', { role: 'head_of_state' }), person('r1', 'R'), person('r5', 'R'), person('r9', 'R', { role: 'opposition_leader' }), person('l2', 'E')];
const BASE = { offices: { head_of_gov: 'p1', head_of_state: 'h1' }, holderParty: { head_of_gov: 'E' }, partyBench: { R: ['r9', 'r5', 'r1'], L: ['p1', 'l2'] } };

{
  const { A, B } = world(PEOPLE, BASE);
  check(make(original)(A, B, 'R', 'head_of_gov')?.id === 'r1', 'unmodded: change of government picks the lowest id (r1)');
  check(make(patched)(A, B, 'R', 'head_of_gov')?.id === 'r9', 'patched: picks the bench leader (r9)');
  check(make(patched, new Set(['r9']))(A, B, 'R', 'head_of_gov')?.id === 'r5', 'leader term-limited: the next on the bench (r5)');
}
{
  const { A, B } = world(PEOPLE, BASE);
  check(make(patched)(A, B, 'E', 'head_of_gov')?.id === 'p1' && make(original)(A, B, 'E', 'head_of_gov')?.id === 'p1', 'same party wins: the incumbent stays (both)');
  check(make(patched, new Set(['p1']))(A, B, 'E', 'head_of_gov')?.id === 'l2', 'same party wins, incumbent term-limited: the next on the bench');
  check(make(original, new Set(['p1']))(A, B, 'E', 'head_of_gov')?.id === 'p1', 'unmodded: a term-limited incumbent stays');
}
{
  const { A, B } = world(PEOPLE, { ...BASE, caretaker: true });
  check(make(patched)(A, B, 'E', 'head_of_gov')?.id === 'l2' && make(original)(A, B, 'E', 'head_of_gov')?.id === 'l2', 'caretaker incumbent: replaced, as before');
}
{
  const kids = [...PEOPLE, person('r0', 'R', { born: 2015 }), person('r8', 'R', { alive: false }), person('r7', 'R', { countryKey: 'X' })];
  const { A, B } = world(kids, { ...BASE, partyBench: { R: ['r0', 'r8', 'r7', 'r5'] } });
  check(make(patched)(A, B, 'R', 'head_of_gov')?.id === 'r5', 'bench members who are minors, dead or abroad are skipped');
}
{
  const { A, B } = world(PEOPLE, { ...BASE, partyBench: {} });
  check(make(patched)(A, B, 'R', 'head_of_gov')?.id === 'r1', 'no bench for the party: falls back to the lowest id, as before');
  const { A: A2, B: B2 } = world(PEOPLE, { ...BASE, organs: {} });
  check(make(patched, new Set(['r9', 'r5', 'r1']))(A2, B2, 'R', 'head_of_gov')?.id === 'r9', 'no organ id: no term-limit check (as _partyCandidate)');
  check(make(patched, new Set(['r9', 'r5', 'r1']))(A, B, 'R', 'head_of_gov') === null, 'everyone term-limited: no candidate (the caller already handles that)');
}
{
  const { A, B } = world([...PEOPLE, person('r3', 'R', { role: 'prime_minister' })], BASE);
  check(make(patched)(A, B, 'R', 'head_of_gov')?.id === 'r3' && make(original)(A, B, 'R', 'head_of_gov')?.id === 'r3', 'a party member already holding the office role still comes first (unchanged)');
}

console.log(failures ? `${failures} of ${checks} checks FAILED` : `${checks}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
