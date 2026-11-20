// AI audit DA2: does an AI government answer a crime wave with police? Crime x1.6 at day 100 in three AI countries;
// variant B also cuts trust in the police to 60% (fewer crimes reported). Compare day 280 with the control world.
const pick = String.raw`
const e=Ogr.sim; const l=[...e.countries.values()].filter(c=>c.key!==e.playerKey&&c.brain&&MG(c)?.seed&&(c.pop||0)>10).sort((a,b)=>K(a.key,b.key));
const step=Math.floor(l.length/3); return {keys:[l[0].key,l[step].key,l[2*step].key]};`;
const wave = (trust) => String.raw`
const e=Ogr.sim; const out={};
for(const k of P.keys){const c=e.countries.get(k),t=MG(c);let s=0;for(const f of vg){t.crime.families[f].latentAnnualPer100k*=1.6;s+=t.crime.families[f].latentAnnualPer100k}t.crime.latentAnnualPer100k=s;${trust ? 't.trust.police*=.6;' : ''}out[k]=Math.round(s)}
return out;`;
const measure = String.raw`
const e=Ogr.sim,out={};
for(const k of P.keys){const c=e.countries.get(k),t=MG(c),u=Uot(c,t),s0=vg.reduce((a,f)=>a+t.seed.latentAnnualPer100k[f],0);
out[k]={crime:Math.round(t.crime.latentAnnualPer100k/s0*100)/100,head:Math.round(u.policeHeadcount*1000)/1000,cap:Math.round(u.police*1000)/1000,spendPol:Math.round((c.spend?.pol||0)*1000)/1000,pending:Math.round(t.crime.pendingPer100k),approval:c.approval}}
return out;`;
const check = (c, t, P) => P.keys.flatMap(k => [
  { pass: true, label: `${k}: crime ratio control ${c[k].crime} vs treated ${t[k].crime}` },
  { pass: t[k].head > c[k].head * 1.02 || t[k].spendPol > c[k].spendPol * 1.02, label: `${k}: police headcount or budget rose against control`, detail: { control: c[k], treated: t[k] } },
]);
export const tests = [
  { id: 'crime-wave', preDays: 100, days: 180, pick, perturb: wave(false), measure, check },
  { id: 'crime-wave-low-trust', preDays: 100, days: 180, pick, perturb: wave(true), measure, check },
];
