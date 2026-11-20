// Harness check: no perturbation, so control and treated must match exactly.
export const tests = [{
  id: 'null', days: 30,
  pick: "const c=[...Ogr.sim.countries.values()].filter(x=>x.key!==Ogr.sim.playerKey).sort((a,b)=>K(a.key,b.key))[5];return {key:c.key};",
  perturb: "return 'nothing';",
  measure: "const c=Ogr.sim.countries.get(P.key);return {day:Ogr.sim.day,approval:c.approval,debt:c.debt,gdp:c.gdp,keys:Object.keys(c).length};",
  check: (c, t) => [{ pass: JSON.stringify(c) === JSON.stringify(t), label: 'control and treated identical', detail: { c, t } }],
}];
