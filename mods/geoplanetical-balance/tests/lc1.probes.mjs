// LC1 probe: counts allied country pairs (the game's yr) and the military treaties in force after --days 190 (seed
// 12345, player 756). Run it twice: with the mod, and with LC1's one edit neutralised (.cache/beta-20261119/negctl190.sh
// lc1-alliance-relation-bar 0 mods/geoplanetical-balance/tests/lc1.probes.mjs, which forwards --days 190); the difference is LC1's own effect on AI alliances in the
// first six months.
// Run: node --max-old-space-size=6000 headless/prototype/probe-edits.mjs mods/geoplanetical-balance/tests/lc1.probes.mjs
//      --seed 12345 --days 190
// Test tooling only; never shipped.

export const probes = [
  {
    id: 'lc1-alliance-count',
    edits: ['lc1-alliance-relation-bar#1'],
    code: String.raw`
const e = Ogr.sim;
const keys = [...e.countries.keys()].sort(K);
const pairs = [];
for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) if (yr(e, keys[i], keys[j])) pairs.push(keys[i] + '-' + keys[j]);
const treaties = [...(e.militaryTreaties?.values?.() || [])].filter(t => t && !['ended', 'terminated', 'expired'].includes(t.status));
const kinds = {}, statuses = {};
for (const t of e.militaryTreaties?.values?.() || []) statuses[t?.status] = (statuses[t?.status] || 0) + 1;
for (const t of treaties) kinds[t.kind || 'unknown'] = (kinds[t.kind || 'unknown'] || 0) + 1;
const sample = treaties[0] ? Object.keys(treaties[0]).sort().join(',') : '';
const recent = treaties.map(t => ({ id: t.id, kind: t.kind, members: t.members, day: t.startedDay ?? null }))
  .filter(t => Number(t.day) > 0).sort((a, b) => a.day - b.day || K(String(a.id), String(b.id)));
check(Jr.relations.allyAcceptRelation === 40 || Jr.relations.allyAcceptRelation === 60, 'bar read', String(Jr.relations.allyAcceptRelation));
console.log('LC1 bar', Jr.relations.allyAcceptRelation, 'day', e.day, 'allied pairs', pairs.length, 'treaties', JSON.stringify(kinds));
console.log('LC1 treaty fields', sample, 'statuses', JSON.stringify(statuses));
console.log('LC1 signed after day 0', JSON.stringify(recent));
return { bar: Jr.relations.allyAcceptRelation, day: e.day, alliedPairs: pairs.length, kinds, recent: recent.length };
`,
  },
];
