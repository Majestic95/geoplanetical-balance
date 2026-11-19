// I3 function test: a joint dismantle of a foreign cell checks and charges the sponsor's covert branch (Fzg), as the
// solo mission does and as the staffing count (nzg) books it; a joint trace stays on the foreign branch. ZcQ (joint
// check) and yzg (joint launch) are sliced from the patched and unmodded bundles, with Fzg; the rest is stubbed.
// Usage: node mods/geoplanetical-balance/tests/i3.test.mjs (from the repo root)
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
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const DQ = (x, d = 0) => Number.isFinite(Number(x)) ? Number(x) : d;
const lib = (text, calls) => new Function('Gq', 'F4t', 'cOe', 'Hpe', 'Wq', 'Lq', '_do', 'GKa', '_t', 'va', 'ae', 'St', 'oe', 'Zo', 'lo', 'aO', 'oOe', '$pe', 'H',
  `${fn(text, 'Sdo')}\n${fn(text, 'LKa')}\n${fn(text, 'Cdo')}\nreturn {K8Q:LKa,hTg:Cdo};`)(
  () => ({ id: 'cell' }), () => ({ confidence: .9 }), () => .9,
  (A, C, domain, mission) => { calls.push(domain); return { ok: true, domain, requiredAgents: 5, availableAgents: 20 }; },
  () => 5, () => ({ available: { counter: 20 } }), () => ({ accepted: true, score: 1, threshold: .5 }),
  () => ({ baseCostBn: 1, baseSuccess: .5, trace: .2 }), clamp, DQ, x => Math.ceil(x * 1000) / 1000, x => x / 2, (a, b) => a - b,
  () => ({ quote: () => ({ ok: true }), debit: k => ({ ok: true, amountBn: k }), credit: k => ({ ok: true, amountBn: k }) }), k => `gov:${k}`,
  () => null, () => 60, () => .5, () => {});
const service = () => ({ readiness: { foreign: 1, counter: 1, covert: 1 }, capital: { analysis: .5, sigint: .5, covert: .5, counterIntel: .5, humint: .5 } });
const world = () => ({
  day: 10, countries: new Map([['A', { key: 'A', gdp: 100 }], ['B', { key: 'B', gdp: 100 }]]),
  nonStateActors: new Map([['act', { status: 'active', dossierQuality: .5, commonThreat: .5 }]]),
  intelligence: { services: { A: service(), B: service() }, operations: new Map(), seq: { operation: 0 } },
});
const run = (text, mission) => {
  const calls = [], L = lib(text, calls), W = world();
  const q = L.K8Q(W, 'A', { partnerKey: 'B', actorId: 'act', countryKey: 'A', mission });
  if (!q.ok) throw new Error(`${mission}: K8Q refused (${q.reason})`);
  const out = L.hTg(W, q), op = W.intelligence.operations.get(out.operationId);
  return { checked: calls[0], readiness: W.intelligence.services.A.readiness, partner: W.intelligence.services.B.readiness, op };
};

const pd = run(patched, 'dismantle_foreign_cell'), vd = run(original, 'dismantle_foreign_cell');
check(vd.checked === 'foreign' && vd.readiness.foreign === .9 && vd.readiness.covert === 1, 'unmodded dismantle: checked and charged on foreign', JSON.stringify(vd));
check(pd.checked === 'covert', 'patched dismantle: free agents checked on covert', pd.checked);
check(Math.abs(pd.readiness.covert - .9) < 1e-12 && pd.readiness.foreign === 1 && pd.readiness.counter === 1, 'patched dismantle: covert readiness -0.1, foreign untouched', JSON.stringify(pd.readiness));
check(pd.op.mission === 'dismantle_foreign_cell' && !('domain' in pd.op), 'the op record is unchanged (the staffing count books it as covert by mission)');
const pt = run(patched, 'trace_foreign_cell'), vt = run(original, 'trace_foreign_cell');
check(pt.checked === 'foreign' && vt.checked === 'foreign', 'trace: still checked on foreign');
check(JSON.stringify(pt.readiness) === JSON.stringify(vt.readiness) && Math.abs(pt.readiness.foreign - .9) < 1e-12, 'trace: readiness hit identical to the unmodded game');
check(JSON.stringify(pd.partner) === JSON.stringify(vd.partner) && Math.abs(pd.partner.counter - .88) < 1e-12, 'partner counter-intelligence hit unchanged');
check(JSON.stringify({ ...pd.op, id: 0 }) === JSON.stringify({ ...vd.op, id: 0 }), 'dismantle op record identical to the unmodded game');

console.log(failures ? `${failures} of ${checks} checks FAILED` : `${checks}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
