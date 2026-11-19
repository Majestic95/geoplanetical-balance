// I2 function test: an intelligence service's free agents per branch (KK) are capped by the service's free total, so
// launch checks (qDA) cannot commit more agents than the service has after the branch allocation is moved. KK, qDA,
// Izg, yK, KcQ, nzg and their helpers are sliced from the patched and unmodded bundles; GkA and zrB are stubbed.
// Usage: node mods/geoplanetical-balance/tests/i2.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

const once = (text, head) => { const s = text.indexOf(head); if (s < 0 || text.indexOf(head, s + 1) >= 0) throw new Error(`${head}: not found once`); return s; };
const fn = (text, name) => {
  const s = once(text, `function ${name}(`);
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
const lib = text => {
  const table = text.slice(once(text, 'tdo=Object.freeze('), once(text, ',SKa=4,BX=12,'));
  const helpers = text.slice(once(text, 'lv=(e,t,a)=>'), once(text, ';function Wq('));
  const body = ['Lq', 'Hpe', 'ado', 'Wq', 'PKa', 'rdo'].map(n => fn(text, n)).join('\n');
  return new Function('nOe', 'O4t', `const jpe=Object.freeze(["foreign","counter","covert"]);let ${table},BX=12,${helpers};${body};return {XK:Lq,zDA:Hpe};`)(
    () => 20, () => 72);
};
const P = lib(patched), V = lib(original);

const MISSION = { foreign: 'investigate_actor', counter: 'counterintel_sweep', covert: 'sabotage_plant' };
const world = (active, allocation, ops = [], nets = []) => ({
  countries: new Map([['X', { key: 'X' }]]),
  intelligence: { services: { X: { staff: { active, target: active, training: [] }, allocation } },
    networks: new Map(nets.map((n, i) => [`n${i}`, { ownerKey: 'X', status: 'active', ...n }])),
    operations: new Map(ops.map((o, i) => [`o${i}`, { status: 'active', sponsorKey: 'X', ...o }])) },
});
const op = (branch, staffAgents) => ({ mission: MISSION[branch], staffAgents });

// 1. Unchanged whenever no branch has more agents committed than allocated (day 0 and normal play).
const ALLOCS = [{ foreign: .34, counter: .36, covert: .3 }, { foreign: .8, counter: .1, covert: .1 }, { foreign: .1, counter: .1, covert: .8 }, { foreign: .45, counter: .25, covert: .3 }];
let same = 0, cases = 0;
for (const active of [12, 13, 30, 47, 72]) for (const alloc of ALLOCS) for (const k of [0, .5, 1]) {
  const allocated = V.XK(world(active, alloc), 'X').allocated;
  const ops = Object.entries(allocated).map(([b, n]) => Math.floor(n * k)).map((n, i) => n > 0 ? op(['foreign', 'counter', 'covert'][i], n) : null).filter(Boolean);
  const A = world(active, alloc, ops);
  cases++;
  if (JSON.stringify(P.XK(A, 'X')) === JSON.stringify(V.XK(A, 'X'))) same++;
}
check(same === cases, 'no overcommitted branch: staffing view identical to the unmodded game', `${same}/${cases}`);
{
  const A = world(30, ALLOCS[0], [], [{ access: 70 }, { access: 10 }]);
  check(JSON.stringify(P.XK(A, 'X')) === JSON.stringify(V.XK(A, 'X')), 'networks within the foreign allocation: identical');
}

// 2. The exploit: 30 agents, 24 committed to foreign missions, then the allocation is moved to covert (.1/.1/.8).
{
  const A = world(30, { foreign: .1, counter: .1, covert: .8 }, [op('foreign', 12), op('foreign', 12)]);
  const p = P.XK(A, 'X'), v = V.XK(A, 'X');
  check(v.available.covert === 24 && v.availableTotal === 27, 'unmodded: 27 agents shown free although only 6 are not committed', JSON.stringify(v.available));
  check(p.available.covert === 6 && p.available.counter === 3 && p.available.foreign === 0 && p.availableTotal === 6, 'patched: covert 6, counter 3, total 6 free', JSON.stringify(p.available));
  check(V.zDA(A, 'X', 'covert', 'sabotage_plant').ok === true, 'unmodded: a 7-agent sabotage launches');
  const r = P.zDA(A, 'X', 'covert', 'sabotage_plant');
  check(r.ok === false && r.reason === 'agents_unavailable' && r.availableAgents === 6, 'patched: refused with the game\'s own reason, 6 free', JSON.stringify(r));
  check(P.zDA(A, 'X', 'covert', 'capture_person').ok === true, 'patched: a 5-agent mission still launches');
  check(JSON.stringify(p.overcommitted) === JSON.stringify(v.overcommitted) && p.usedTotal === v.usedTotal && p.active === v.active, 'overcommitted list, used and active unchanged');
}

// 2b. The second route: 30 agents, 9 on foreign missions, then the staff target is cut to 20 (the game lowers active
// at once and re-splits it), so foreign is overcommitted without any allocation change.
{
  const A = world(20, ALLOCS[0], [op('foreign', 9)]);
  const p = P.XK(A, 'X'), v = V.XK(A, 'X');
  check(v.overcommitted.includes('foreign') && v.availableTotal === 13, 'unmodded: staff cut leaves 13 shown free with 11 uncommitted', JSON.stringify(v.available));
  check(p.availableTotal === 11 && p.available.counter <= 11 && p.available.covert <= 11, 'patched: free agents capped at the 11 uncommitted', JSON.stringify(p.available));
}

// 3. Extremes: every agent committed; more committed than active (an old save); minimum staff.
{
  const A = world(12, { foreign: .1, counter: .1, covert: .8 }, [op('foreign', 12)]);
  const p = P.XK(A, 'X');
  check(Object.values(p.available).every(x => x === 0) && p.availableTotal === 0, 'all 12 committed: nothing free in any branch', JSON.stringify(p.available));
  const B = world(20, ALLOCS[0], [op('foreign', 15), op('covert', 15)]);
  const q = P.XK(B, 'X');
  check(Object.values(q.available).every(x => x === 0) && q.availableTotal === 0, 'committed 30 > active 20: nothing free, never negative', JSON.stringify(q.available));
  check(V.XK(B, 'X').availableTotal > 0, 'unmodded: the same service still shows agents free');
}

// 4. Repeated reallocation: launch the most missions each branch allows, move the allocation, repeat.
const exploit = L => {
  const A = world(30, ALLOCS[0]); let n = 0, peak = 0;
  for (let round = 0; round < 6; round++) {
    const branch = ['foreign', 'counter', 'covert'][round % 3];
    A.intelligence.services.X.allocation = { foreign: .1, counter: .1, covert: .1, [branch]: .8 };
    for (let guard = 0; guard < 50 && L.zDA(A, 'X', branch, MISSION[branch]).ok; guard++)
      A.intelligence.operations.set(`x${n++}`, { status: 'active', sponsorKey: 'X', mission: MISSION[branch], staffAgents: L.zDA(A, 'X', branch, MISSION[branch]).requiredAgents });
    peak = Math.max(peak, L.XK(A, 'X').usedTotal);
  }
  return peak;
};
const peakV = exploit(V), peakP = exploit(P);
check(peakV > 30, 'unmodded: reallocating commits more agents than the service has', String(peakV));
check(peakP <= 30, 'patched: committed agents never exceed the 30 active', String(peakP));

console.log(failures ? `${failures} of ${checks} checks FAILED` : `${checks}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
