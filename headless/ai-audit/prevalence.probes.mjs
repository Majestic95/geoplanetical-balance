// AI audit: how often each blind spot bites in an ordinary game. Run at --days 365 (seed 12345, player 756).
// Each check reports a count with a short sample; pass means the measurement ran. Test tooling only.
export const probes = [{ id: 'ai-prevalence', edits: [], code: String.raw`
const e=Ogr.sim, ai=[...e.countries.values()].filter(c=>c.key!==e.playerKey&&c.brain).sort((a,b)=>K(a.key,b.key));
const r1=x=>Math.round(x*10)/10, fz=c=>{try{return Zn(c)}catch{return {band:-1,pressure:0}}};
const S=(f)=>{try{return f()}catch(x){return 'ERR '+String(x.message||x).slice(0,120)}};
// Budget modes and AF1: stressed countries waiting for a review.
check(true,'budget modes', S(()=>{const m={};for(const c of ai){const k=c.brain.economicPolicy?.mode||'none';m[k]=(m[k]||0)+1}return m}));
check(true,'AF1 stressed (band>=1) with last budget review over 31 days ago', S(()=>{const l=ai.filter(c=>fz(c).band>=1);const w=l.filter(c=>e.day-(c.brain.economicPolicy?.lastReviewDay??-999)>31);return {stressed:l.length,waiting:w.length,sample:w.slice(0,6).map(c=>c.key+':b'+fz(c).band)}}));
// DA1: accountable governments trailing badly near an election.
check(true,'DA1 accountable, election near (Oh>.6), approval<35', S(()=>{const l=ai.filter(c=>_f(c)>=.5&&Oh(e,c)>.6&&(c.approval??100)<35);return {n:l.length,sample:l.slice(0,8).map(c=>c.key+':a'+Math.round(c.approval)+':'+(c.brain.economicPolicy?.mode||''))}}));
// Crises and wars: the fiscal state of those who start and keep fighting.
check(true,'crises: opener fiscal band', S(()=>{const cr=[...(e.securityCrises?.crises?.values()||[])];return {n:cr.length,rows:cr.slice(0,10).map(x=>{const o=e.countries.get(x.openerKey);return x.openerKey+'>'+x.targetKey+':'+x.status+':b'+fz(o).band+':debt'+Math.round(o?.debt||0)})}}));
check(true,'wars (aiWars): sides fiscal band', S(()=>{const w=[...(e.aiWars?.values()||[])];return {n:w.length,rows:w.slice(0,10).map(x=>{const a=e.countries.get(x.sideAKey),b=e.countries.get(x.sideBKey);return x.sideAKey+'v'+x.sideBKey+':'+x.status+':'+(e.day-x.startDay)+'d:bA'+fz(a).band+':bB'+fz(b).band})}}));
check(true,'MW2 will to fight vs fiscal state (conflicts)', S(()=>{const out=[];for(const W of e.conflicts?.values()||[]){if(W.status&&W.status!=='active')continue;for(const s of ['A','B']){const k=kP(e,W,s);if(!k)continue;const c=e.countries.get(k.principalKey);out.push(k.principalKey+s+':u'+r1(k.continuationUtility)+':x'+r1(k.exhaustion01)+':b'+fz(c).band+':def'+(c?.defaulted?1:0)+':'+(k.terminationIntentId||'-'))}}return {n:out.length,rows:out.slice(0,12)}}));
// D2: AI aid to countries the donor is hostile to or sanctions.
check(true,'D2 aid to hostile or sanctioned recipients', S(()=>{const rows=[];for(const d of ai){const ac=d.aidCommit||{};for(const rk of Object.keys(ac)){if(!(ac[rk]>0))continue;const r=e.countries.get(rk);if(!r)continue;const rel=At(e,d,r),sanc=(e.sanctions||[]).some(s=>(s.statusId||'active')==='active'&&s.targetKey===rk&&s.participants?.some(p=>p.countryKey===d.key));if(rel<-50||sanc)rows.push(d.key+'>'+rk+':rel'+Math.round(rel)+(sanc?':sanc':''))}}return {n:rows.length,sample:rows.slice(0,10)}}));
// DA2: crime above day 0 and police capacity.
check(true,'DA2 crime >10% above seed, police capacity', S(()=>{const rows=[];for(const c of ai){const t=MG(c);if(!t?.seed)continue;const s0=vg.reduce((a,f)=>a+t.seed.latentAnnualPer100k[f],0),r=t.crime.latentAnnualPer100k/s0;if(r>1.1)rows.push(c.key+':x'+r1(r)+':pol'+r1(Uot(c,t).police))}return {n:rows.length,sample:rows.slice(0,10)}}));
// D1 and AX3 context: treaties with mutual defence held by AI members.
check(true,'treaties with mutual defence', S(()=>{let n=0;for(const t of e.militaryTreaties?.values()||[])if(t.clauses?.mutualDefense)n++;return n}));
return {day:e.day, ai:ai.length};
`}];
