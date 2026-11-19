// CB16 probe: strikes land only in the player's (operational) wars, so in a booted world (seed 12345, player 756,
// --days 190) the probe has the player declare a real war through the game's own declareWar (ife; it sets up the
// strike campaign), seeds the campaign baseline with the game's Dqa, then lands three strikes on a real enemy power
// plant and two on a real enemy metal mine through cBe (the function every landed strike reaches), lifts the enemy's
// sealed energy window 35 points above the baseline and runs the game's monthly accountability step (s1r). With the
// patch the player's ledger file gains a civilian_infrastructure month for exactly the plant strikes; with edits 3 or
// 4 neutralised (negctl190.sh) it does not. The probe world is thrown away afterwards.
// Run: node --max-old-space-size=6000 headless/prototype/probe-edits.mjs mods/geoplanetical-balance/tests/cb16.probes.mjs
//      --seed 12345 --days 190
// Test tooling only; never shipped.

export const probes = [
  {
    id: 'cb16-energy-strikes',
    edits: ['cb16-energy-strikes-war-crime#3', 'cb16-energy-strikes-war-crime#4'],
    code: String.raw`
const e = Ogr.sim, pk = e.playerKey;
const plantsBy = new Map(), mineBy = new Map();
for (const [id, p] of e.plants || []) if (!plantsBy.has(p.owner) && Number(p.capacityGW) > 0) plantsBy.set(p.owner, id);
for (const [id, f] of e.fields || []) if (!mineBy.has(f.owner) && f.resource === 'copper_ore') mineBy.set(f.owner, id);
let enemy = null, tried = 0;
for (const c of [...e.countries.values()].sort((a, b) => K(a.key, b.key))) {
  if (c.key === pk || !plantsBy.has(c.key) || ha(e, pk, c.key) || yr(e, pk, c.key)) continue;
  tried++;
  if (e.declareWar(c.key, 'conquest')) { enemy = c.key; break; }
  if (tried > 40) break;
}
check(!!enemy, 'the player could declare a war (tried ' + tried + ' countries)', String(enemy));
if (!enemy) return { tried };
const w = e.wars.get(enemy);
check(!!w && !!w.campaign, 'the new war has a strike campaign', JSON.stringify(Object.keys(w || {}).slice(0, 12)));
Dqa(e, w);
const base = w.campaign.outage0?.[enemy];
check(base != null, 'the campaign baseline holds the enemy', JSON.stringify(w.campaign.outage0));
const v = e.countries.get(enemy), en = v.energy;
en.lastServiceWindow = { ...(en.lastServiceWindow || {}), unservedShare: Math.min(1, base + .35) };
check(Math.abs(hl(v).unservedShare - Math.min(1, base + .35)) < 1e-9, 'the game reads the lifted outage through hl', String(hl(v).unservedShare));
const plant = plantsBy.get(enemy), mine = mineBy.get(enemy);
for (let i = 0; i < 3; i++) cBe(e, w, pk, { targetType: 'plant', targetId: plant, damage: 1 });
if (mine) for (let i = 0; i < 2; i++) cBe(e, w, pk, { targetType: 'field', targetId: mine, damage: 1 });
const pair = w.conduct?.[pk]?.[enemy];
check(pair?.geobalStrikes === 3, 'three plant strikes counted' + (mine ? ', the two copper-mine strikes not' : ' (no copper mine to test)'), JSON.stringify(pair));
const before = Number(e.accountability?.files?.[pk]?.episode?.totals?.[enemy]?.civilian_infrastructure?.displacedM) || 0;
s1r(e);
const after = Number(e.accountability?.files?.[pk]?.episode?.totals?.[enemy]?.civilian_infrastructure?.displacedM) || 0;
const expect = Math.max(0, Number(v.pop) || 0) * (Math.min(1, base + .35) - base);
check(expect > 0 && Math.abs(after - before - expect) < 1e-6 * Math.max(1, expect), 'this month booked population x excess as people affected',
  JSON.stringify({ before, after, expect, pop: v.pop, base }));
check(!!e.accountability?.files?.[pk]?.episode, 'the player has an open accountability episode');
return { enemy, plant, mine: mine || null, base, pop: v.pop, booked: after - before };
`,
  },
];
