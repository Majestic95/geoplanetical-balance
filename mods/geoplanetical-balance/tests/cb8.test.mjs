// CB8 function test: the nuclear casualty functions (svo, lvo, Cte, and in the patched bundle __geobalWarheadYield)
// are sliced from the patched and unmodded bundles and run on a test province, with the game's own design table
// (designs: gun, implosion, boosted, thermo) read from the bundle. Checks that deaths scale with (yield/300)^(2/3) and
// reliability (the exact expected toll of independently failing warheads, checked against a binomial sum), that a
// country without a design keeps the game's numbers, that every strike path passes the attacker's design (Ov, lVa,
// uVa, dVa, fVa) and that the AI's own forecasts (f9t, AVa, TVa, NVa) name the firing country for the warhead size only
// (geobalYieldKey, leaving actorKey and so the game's target choice alone). Ov is run with the province picker stubbed.
// Usage: node mods/geoplanetical-balance/tests/cb8.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

const slice = (text, from, to) => {
  const a = text.indexOf(from), b = text.indexOf(to, a + 1);
  if (a < 0 || b < 0 || b - a > 4000 || text.indexOf(from, a + 1) >= 0) throw new Error(`slice ${from}`);
  return text.slice(a, b);
};
const designsText = (() => { const a = original.indexOf('designs:{gun:'), b = original.indexOf('},vectors:', a); return original.slice(a + 'designs:'.length, b + 1); })();
const designs = new Function(`return ${designsText}`)();
check(designs.gun.yieldKt === 15 && designs.thermo.yieldKt === 300 && designs.gun.reliability === 0.85, 'design table read from the bundle', JSON.stringify(designs.gun));
const load = (text) => {
  const src = slice(text, 'var xv=(e,t,a)=>', 'function JYa(');
  const names = text === patched ? 'Cte,lvo,svo,__geobalWarheadYield,__geobalMixedDeaths' : 'Cte,lvo,svo';
  const ovSrc = slice(text, 'function Ov(e,t,a,r={}){', 'function ');
  // The province picker XNe (targeting) is stubbed: every warhead goes to the one test province, and the options it
  // receives are recorded so the test can see that actorKey is not set by the AI forecasts.
  return new Function('hM', 'XNe', `${src};${ovSrc};return {${names},Ov};`)(designs, (e, t, a, r) => { seen.push(r); return [{ pf: e.__prov, w: a }]; });
};
const seen = [];
const P = load(patched), O = load(original);
// A test province: 2 M people on 4 000 km2 (__area is in steradians: km2 / R^2).
const prov = { __pop: 2, __area: 4000 / (6371 * 6371) };
const world = (design) => ({ countries: new Map([['X', { forces: { nuclear: { design } } }]]) });
const yieldOf = (design) => P.__geobalWarheadYield(world(design), 'X');

check(Math.abs(P.Cte(prov, 3) - O.Cte(prov, 3)) < 1e-12, 'no attacker design: same deaths as the game');
check(P.__geobalWarheadYield(world('nope'), 'X') === null && P.__geobalWarheadYield(world('thermo'), null) === null, 'unknown design or no attacker: no scaling');
const thermo = yieldOf('thermo'), gun = yieldOf('gun'), boosted = yieldOf('boosted');
check(Math.abs(thermo.area - 1) < 1e-12 && thermo.rel === 0.98, 'thermonuclear: full area, reliability 0.98', JSON.stringify(thermo));
check(Math.abs(gun.area - Math.pow(15 / 300, 2 / 3)) < 1e-12 && Math.abs(gun.area - 0.1357) < 1e-3, '15 kt: area x 0.136', String(gun.area));
const d0 = O.Cte(prov, 1), dThermo = P.Cte(prov, 1, thermo), dGun = P.Cte(prov, 1, gun), dBoost = P.Cte(prov, 1, boosted);
check(dThermo < d0 && dThermo > 0.97 * d0, 'thermonuclear deaths about 2% below the game (reliability)', `${dThermo} vs ${d0}`);
check(Math.abs(dThermo - 0.98 * d0) < 1e-12, 'one warhead: reliability times the toll of a successful one (expected value)', `${dThermo} vs ${0.98 * d0}`);
// w warheads failing independently: E[pop x (1 - (1 - r)^K)], K ~ Binomial(w, rel), summed exactly.
{
  const w = 6, y = yieldOf('implosion'), r = P.Cte(prov, 1, { area: y.area, rel: 1 }) / prov.__pop; // one sure warhead's kill share
  const C = (n, k) => { let c = 1; for (let i = 0; i < k; i++) c = c * (n - i) / (i + 1); return c; };
  let ex = 0;
  for (let k = 0; k <= w; k++) ex += C(w, k) * Math.pow(y.rel, k) * Math.pow(1 - y.rel, w - k) * prov.__pop * (1 - Math.pow(1 - r, k));
  check(Math.abs(P.Cte(prov, w, y) - ex) < 1e-12, `${w} implosion warheads: exact binomial expectation`, `${P.Cte(prov, w, y)} vs ${ex}`);
}
check(dGun < 0.15 * d0 && dGun > 0.08 * d0, 'a 15 kt warhead kills about 12% of what the game counted', `${(dGun / d0).toFixed(3)}`);
check(dGun < dBoost && dBoost < dThermo, 'deaths rise with yield');
// Many warheads still saturate the province (the kill share per warhead is capped at 0.92 by the game).
check(P.Cte(prov, 200, gun) <= prov.__pop && P.Cte(prov, 200, gun) > 0.9 * prov.__pop, 'many small warheads still saturate the province');
// Zero landed warheads stay zero.
check(P.Cte(prov, 0, gun) === 0, 'no landed warhead, no deaths');
// Every strike path that knows its attacker passes the design.
// The real Ov: the yield key, or the game's actorKey, picks the design; none keeps the game's numbers.
{
  const W = { ...world('gun'), __prov: prov };
  seen.length = 0;
  check(Math.abs(P.Ov(W, 'T', 3, { geobalYieldKey: 'X' }) - P.Cte(prov, 3, gun)) < 1e-12, 'Ov with geobalYieldKey: the design of the firing country');
  check(seen[0] && seen[0].actorKey === undefined, 'Ov with geobalYieldKey: no actorKey reaches the target picker', JSON.stringify(seen[0]));
  check(Math.abs(P.Ov(W, 'T', 3, { actorKey: 'X' }) - P.Cte(prov, 3, gun)) < 1e-12, 'Ov with actorKey (player screen): same design');
  check(Math.abs(P.Ov(W, 'T', 3) - O.Ov(W, 'T', 3)) < 1e-12, 'Ov without a key: the numbers of the game');
  // A mixed retaliation (TVa): the game's combined toll scaled by scaled / unscaled per-country tolls.
  const l = [{ warheads: 2, deaths: P.Ov(W, 'T', 2, { geobalYieldKey: 'X' }) }, { warheads: 3, deaths: P.Ov(W, 'T', 3) }];
  const want = O.Ov(W, 'T', 5) * (l[0].deaths + l[1].deaths) / (O.Ov(W, 'T', 2) + O.Ov(W, 'T', 3));
  check(Math.abs(P.__geobalMixedDeaths(W, 'T', l) - want) < 1e-12 && want < O.Ov(W, 'T', 5), 'mixed retaliation: combined toll scaled by the mix', `${P.__geobalMixedDeaths(W, 'T', l)} vs ${want}`);
  check(P.__geobalMixedDeaths(W, 'T', [{ warheads: 0, deaths: 0 }]) === 0, 'mixed retaliation with no warheads: zero');
}
for (const [path, needle] of [['f9t', 'c=l>0?Ov(e,t.key,l,{geobalYieldKey:r}):0,'], ['AVa', 'i+Ov(e,s,l,{geobalYieldKey:a.actorKey}),0)'],
  ['TVa per country', 'deaths:y>0?Ov(e,a,y,{geobalYieldKey:m.key}):0})'], ['TVa total', 'Math.max(0,i?.pop||0),__geobalMixedDeaths(e,a,l))'],
  ['NVa', 'deathsM:m>0?Ov(e,i.key,m,{geobalYieldKey:n.key}):0']]) {
  check(patched.split(needle).length === 2, `${path} names the firing country for the warhead size`);
}
// Who fires at each AI forecast, read from the real functions.
check(/function f9t\(e,t,a,r\)\{let o=wVa,n=e\.countries\.get\(r\)/.test(patched), 'f9t: r is the retaliating country');
check(/function AVa\(e,t,a,r,o\)\{let n=\{[^]*?attackerKey:a\.actorKey/.test(patched), 'AVa: a is the strike, a.actorKey its attacker');
check(/function NVa\(e,t\)\{[^]*?n=e\.countries\.get\(o\.actorKey\),i=e\.countries\.get\(o\.attackerKey\)/.test(patched), 'NVa: n responds against i');
for (const [path, needle] of [['Ov', 'Cte(n.pf,n.w,__geobalWarheadYield(e,r.geobalYieldKey??r.actorKey))'], ['lVa', 'deaths:Cte(o.pf,o.w,__geobalWarheadYield(e,r.geobalYieldKey??r.actorKey))'],
  ['uVa', 'deaths:I>0?Cte(b,I,__geobalWarheadYield(e,r)):0,'], ['dVa', 'l=s>0?Cte(o,s,__geobalWarheadYield(e,t.attackerKey)):0,'], ['fVa', 'w=I>0?Cte(b,I,__geobalWarheadYield(e,i.key)):0;']]) {
  check(patched.split(needle).length === 2, `${path} passes the attacker's design`);
}
// uVa's r is its actorKey, dVa's t the impact record, fVa's i the attacking country (read from the real functions).
check(/function uVa\(e,t,\{maxWarheads:a=1\/0,actorKey:r=/.test(patched), 'uVa: r is the actor key');
check(/function fVa\(e\)\{[^]*?for\(let i of t\)\{let s=i\.forces&&i\.forces\.nuclear/.test(patched), 'fVa: i is the attacking country');

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
