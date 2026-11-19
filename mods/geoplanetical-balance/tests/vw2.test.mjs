// VW2 function test: the bloc-pole list (UAB, with its reader BvA) cut from the patched and the original bundle and run
// with the game's own bloc constants and a stubbed alignment. Core property: what the tick reads does not depend on
// whether a view read earlier. The original must fail it, which proves the test can see the bug.
// Usage: node mods/geoplanetical-balance/tests/vw2.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;

const cut = text => {
  const start = text.indexOf('function u1t(e){');
  const marker = 'function vAe(e,t){', mid = text.indexOf(marker, start);
  const end = text.indexOf('role:a.key===t.key?"pole":"member"}}', mid);
  if (start < 0 || mid < 0 || end < 0 || end - start > 1500) throw new Error('u1t/vAe block not found');
  return text.slice(start, end + 'role:a.key===t.key?"pole":"member"}}'.length);
};
const cfg = original.match(/bloc:\{poleCount:(\d+),poleSearchPool:(\d+),poleSeparation:([\d.]+),affiliationThreshold:([\d.]+)/);
if (!cfg) throw new Error('bloc constants not found');
const Bg = { bloc: { poleCount: +cfg[1], poleSearchPool: +cfg[2], poleSeparation: +cfg[3], affiliationThreshold: +cfg[4] } };
// Stub alignment: every pair below the pole separation, except what a test sets in `A.align`.
const e2 = (A, B, Q) => A.align?.[`${B.key}|${Q.key}`] ?? 0;
const load = text => new Function('Hga', 'Jr', 'Kp', `${cut(text)}; return {UAB:u1t, BvA:vAe};`)(new WeakMap(), Bg, e2);
const fresh = () => ({ P: load(patched), V: load(original) });

let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const keys = list => list.map(c => c.key).join(',');
const world = (day = 100) => {
  const gdp = { a: 900, b: 800, c: 700, d: 600, e: 500, f: 400 };
  return { day, countries: new Map(Object.entries(gdp).map(([key, g]) => [key, { key, gdp: g, pol: {} }])) };
};
check(Bg.bloc.poleCount === 4 && Bg.bloc.poleSearchPool === 30, 'game constants read from the bundle', JSON.stringify(Bg.bloc));
check(patched.includes('(e.day||0)===t.day)return t.poles') && !patched.includes('e.day-t.day<365)return t.poles'), 'the patch is in the built bundle');

// Premises in the host: views never run while a day is in progress, and a yield restores the published day.
check(/async viewSnapshot\(t=\{\}\)\{[^}]{0,200}await this\.settlePendingDay\(r\)/.test(patched), 'viewSnapshot settles the pending day first');
check(/subscribeView\(t=\{\}\)\{.{0,500}\w\._dayJob\)\{/.test(patched), 'subscribeView does not build a view during a day');
check(/!a\._dayJob&&this\.viewSubscriptions\.size\?this\.subscribedViews\(\)/.test(patched), 'status does not build subscribed views during a day');
check(/e\.day=t\.published,l\?"waiting"/.test(patched), 'a yield restores the published day');
check(/function\*\w+\(e\)\{e\.day\+\+;/.test(patched), 'the tick moves the day before it reads');

// Core property: a view at day D, then the GDP order changes, then the tick reads at day D+1.
const scenario = (mod, viewFirst) => {
  const A = world(100);
  if (viewFirst) mod.UAB(A);
  A.countries.get('f').gdp = 9999; // f rises to first between the view and the tick
  A.day = 101;
  return { poles: keys(mod.UAB(A)), role: mod.BvA(A, A.countries.get('f')).role };
};
{
  const p0 = scenario(fresh().P, false), p1 = scenario(fresh().P, true), v0 = scenario(fresh().V, false), v1 = scenario(fresh().V, true);
  check(JSON.stringify(p0) === JSON.stringify(p1), 'patched: the tick reads the same with or without an earlier view', JSON.stringify(p1));
  check(p1.poles.startsWith('f') && p1.role === 'pole', 'patched: the tick reads the current ranks');
  check(JSON.stringify(v0) !== JSON.stringify(v1), 'original: the view changes what the tick reads (the bug)', `${JSON.stringify(v0)} vs ${JSON.stringify(v1)}`);
  check(v1.role === 'none' || v1.role === 'member', 'original: after a view, the risen country is not a pole', v1.role);
}

// A reload is a new state object and an empty cache: same answer as a straight run on the same state.
{
  const { P } = fresh();
  const straight = world(100); P.UAB(straight); straight.countries.get('f').gdp = 9999; straight.day = 200;
  const reloaded = world(200); reloaded.countries.get('f').gdp = 9999;
  check(keys(P.UAB(straight)) === keys(P.UAB(reloaded)) && keys(P.UAB(reloaded)).startsWith('f'), 'patched: after the ranks change, a reload gives the same list as a straight run');
  const { V } = fresh();
  const a = world(100); V.UAB(a); a.countries.get('f').gdp = 9999; a.day = 200;
  const b = world(200); b.countries.get('f').gdp = 9999;
  check(keys(V.UAB(a)) !== keys(V.UAB(b)), 'original: a reload restarts the year and can give another list');
}

// Inside one day the list does not move, so the tick is consistent with itself and repeated reads cost nothing.
// Known limit (stated in the patch): reads on one game day share a list, so a player command, if any reads the poles,
// could see one taken earlier that day. The tick cannot: it reads after its own day++.
{
  const { P } = fresh();
  const A = world(100), first = P.UAB(A);
  check(P.UAB(A) === first, 'patched: repeated reads on one day return the same list');
  A.countries.get('f').gdp = 9999;
  check(P.UAB(A) === first, 'patched: a change later in the same day does not move the list');
  A.day = 101;
  check(P.UAB(A) !== first, 'patched: the next day rebuilds it');
}
// Conditions the game already had stay.
{
  const { P } = fresh();
  const A = world(100), first = P.UAB(A);
  A.countries.set('a', { key: 'a', gdp: 1, pol: {} });
  check(P.UAB(A) !== first && !keys(P.UAB(A)).startsWith('a'), 'patched: a replaced pole rebuilds the list the same day');
  const B = world(100); const f2 = P.UAB(B);
  B.countries.set('z', { key: 'z', gdp: 9999, pol: {} });
  check(P.UAB(B) !== f2 && keys(P.UAB(B)).startsWith('z'), 'patched: a new country rebuilds the list the same day');
  const C = world(100); const f3 = P.UAB(C);
  C.countries = new Map(C.countries);
  check(P.UAB(C) !== f3, 'patched: a replaced country table rebuilds the list');
}
// Day missing or zero.
{
  const { P } = fresh();
  const A = world(100); delete A.day;
  const first = P.UAB(A);
  check(first.length === 4 && P.UAB(A) === first, 'patched: no day recorded counts as day 0, no throw');
  const Z = world(0), z = P.UAB(Z);
  check(P.UAB(Z) === z, 'patched: day 0 caches');
}
// Separation and the pole search work as before: only the cache rule changed.
{
  const { P, V } = fresh();
  const mk = () => { const A = world(100); A.align = { 'b|a': 0.9, 'a|b': 0.9 }; return A; };
  check(keys(P.UAB(mk())) === keys(V.UAB(mk())) && !keys(P.UAB(mk())).includes('b'), 'patched: a close partner of a pole is still skipped', keys(P.UAB(mk())));
  const noPol = world(100); noPol.countries.get('a').pol = null;
  check(!keys(P.UAB(noPol)).includes('a'), 'patched: a country with no political model is still skipped');
  const w = world(100);
  check(P.BvA(w, w.countries.get('a')).role === 'pole' && V.BvA(world(100), world(100).countries.get('e')).role === 'none', 'vAe roles unchanged');
}
const srcP = cut(patched), srcV = cut(original);
check(srcP.replace('(e.day||0)===t.day', 'e.day-t.day<365') === srcV, 'nothing else in the two functions changed');

console.log(failures ? `${failures} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
