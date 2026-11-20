// Q20 probe: the enemy's collapse in a player war is reached only when a player war drives the enemy's support to zero,
// which a headless run never does. In a booted world the probe has the player declare a real war through the game's
// declareWar, replaces the enemy-support function _8t (restored afterwards) and runs the front-by-front war step i8o
// (a generator, drained) at chosen days by setting the world's day for each step (the probe world is thrown away):
// support 0 on day D, 75 on D+30, 0 on D+90: the war must still be active at D+149 and end in the player's victory at
// D+150 (60 days after the second zero, not the first). Negative control: on the unpatched bundle the war is still
// active at D+150.
// Run: node --max-old-space-size=6000 headless/prototype/probe-edits.mjs mods/geoplanetical-balance/tests/q20.probes.mjs
//      --seed 12345 --days 30
// Code uses 26734764 names. Test tooling only; never shipped.

export const probes = [
  {
    id: 'q20-enemy-front-collapse',
    edits: ['q20-enemy-front-collapse#1'],
    code: String.raw`
const e = Ogr.sim, pk = e.playerKey, me = e.countries.get(pk);
let enemy = null, tried = 0;
for (const c of [...e.countries.values()].sort((a, b) => K(a.key, b.key))) {
  if (c.key === pk || ha(e, pk, c.key) || yr(e, pk, c.key)) continue;
  tried++;
  if (e.declareWar(c.key, 'conquest')) { enemy = c.key; break; }
  if (tried > 40) break;
}
check(!!enemy, 'the player could declare a war (tried ' + tried + ')', String(enemy));
if (!enemy) return { tried };
const w = e.wars.get(enemy), foe = e.countries.get(enemy);
check(!!w && w.sideAKey === pk && w.status === 'active', 'player is side A of an active war', JSON.stringify({ a: w?.sideAKey, s: w?.status }));
check(!!e.finance?.sovereigns?.[pk], 'the player has a sovereign record');
const ended = [];
const prevEnd = e._onWarEnd, day0 = e.day, real8t = _8t;
e._onWarEnd = (u) => { ended.push(u); prevEnd && prevEnd(u); };
let support = 0;
_8t = () => support;
const stepAt = (d, s) => { e.day = d; support = s; const g = i8o(e, w, me, foe); for (let x = g.next(); !x.done; x = g.next()); };
const live = () => e.wars.get(enemy) === w && !ended.length;
const D = day0 + 1;
const rec = () => JSON.stringify(e.finance?.sovereigns?.[pk]?.geobalEnemyZero ?? null);
try {
  stepAt(D, 0);
  check(w.support.e <= 0 && live(), 'day D at 0: war goes on', rec());
  stepAt(D + 30, 75);
  check(live(), 'day D+30 at 75: war goes on, count cleared', rec());
  stepAt(D + 90, 0);
  check(live(), 'day D+90 at 0 again: war goes on (the first spell does not count)', rec());
  stepAt(D + 149, 0);
  check(live(), 'day D+149: 59 days into the second spell, war goes on', rec());
  stepAt(D + 150, 0);
  check(e.wars.get(enemy) !== w, 'day D+150: 60 days at 0, the war has ended', rec());
  check(ended.length === 1 && ended[0].outcome === 'victory', 'the player won', JSON.stringify(ended.map(u => u.outcome)));
} finally { _8t = real8t; e._onWarEnd = prevEnd; e.day = day0; }
return { enemy, outcome: ended[0]?.outcome ?? null, annexed: ended[0]?.annexed ?? null, record: rec() };
`,
  },
];
