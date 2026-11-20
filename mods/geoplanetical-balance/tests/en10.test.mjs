// EN10 function test: the electrification grid gate (npt) measures blackouts against the country's own day-0 unserved
// share (energy.serviceDeliveryBaseline.unservedShare) and reads a negative settled day-0 reserve margin (recorded by the
// patch in Qat as serviceDeliveryBaseline.__geobalMarginPct0) relative to that start; healthy day-0 grids are unchanged.
// The configured margin (initialMarginPct) is not the reference: the settled grid differs from it. npt and its helpers (g0, ZL) are taken from both bundles.
// Usage: node mods/geoplanetical-balance/tests/en10.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';
import { sealGateProblems, SEAL_GATE_HINT } from './t0-seal-gate.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };
const fnSrc = (text, name) => {
  const s = text.indexOf(`function ${name}(`);
  if (s < 0 || text.indexOf(`function ${name}(`, s + 1) >= 0) throw new Error(`${name}: not found once`);
  let depth = 0, i = text.indexOf('){', s) + 1;
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(s, i + 1);
};
const G0 = 'g0=(e,t=0)=>Number.isFinite(Number(e))?Number(e):t';
check(original.includes(G0), 'g0 is the game helper the test copies');
const load = (text) => new Function(`const ${G0};const ZL=(e,t,a)=>Math.max(t,Math.min(a,e));${fnSrc(text, 'npt')};return npt;`)();
const O = load(original), P = load(patched);
const c = (e) => ({ energy: e });
const near = (a, b) => Math.abs(a - b) < 1e-9;

// Healthy grid: same either way.
const healthy = c({ lastServiceWindow: { unservedShare: 0 }, deficitFrac: 0, marginPct: 10, initialMarginPct: -5, serviceDeliveryBaseline: { unservedShare: 0, __geobalMarginPct0: 1.2 } });
check(near(O(healthy), 12 / 17) && near(P(healthy), 12 / 17), 'healthy settled grid unchanged (a negative configured margin is ignored)', `${O(healthy)} ${P(healthy)}`);
// Chronic shortage at day 0 (8% unserved, margin -6 from the start), unchanged since.
const chronic = c({ lastServiceWindow: { unservedShare: 0.08 }, deficitFrac: 0.08, marginPct: -6, initialMarginPct: 3, serviceDeliveryBaseline: { unservedShare: 0.08, __geobalMarginPct0: -6 } });
check(O(chronic) === 0, 'original: a chronic day-0 shortage freezes electrification (negative control)', String(O(chronic)));
check(near(P(chronic), 2 / 17), 'patched: chronic shortage at its day-0 level runs at a reduced pace', String(P(chronic)));
// Same country, grid worse than at the start by more than 1 point: frozen.
const worse = c({ ...chronic.energy, lastServiceWindow: { unservedShare: 0.095 }, deficitFrac: 0.095 });
check(P(worse) === 0, 'patched: worse than day 0 by >1 point still freezes', String(P(worse)));
// Grid improved past the start: margin above start counts.
const better = c({ ...chronic.energy, lastServiceWindow: { unservedShare: 0.02 }, deficitFrac: 0.02, marginPct: 3 });
check(near(P(better), 11 / 17), 'patched: improved grid gets a larger factor', String(P(better)));
// Healthy day 0 that falls into a 3% shortage: frozen as before.
const fell = c({ ...healthy.energy, lastServiceWindow: { unservedShare: 0.03 }, deficitFrac: 0.03 });
check(O(fell) === 0 && P(fell) === 0, 'patched: a healthy grid falling into shortage still freezes');
// Before the service baseline exists (null), or a baseline without the recorded margin (older game): the game's rule.
const nobase = c({ lastServiceWindow: { unservedShare: 0.05 }, deficitFrac: 0.05, marginPct: -6, serviceDeliveryBaseline: null });
check(P(nobase) === 0 && O(nobase) === 0, 'patched: no baseline yet, a 5% deficit still freezes');
const nobase2 = c({ lastServiceWindow: { unservedShare: 0 }, deficitFrac: 0, marginPct: -6, initialMarginPct: -6, serviceDeliveryBaseline: null });
check(O(nobase2) === 0 && P(nobase2) === 0, 'patched: no baseline, zero deficit, margin -6: the game rule (0), not the configured margin', `${O(nobase2)} ${P(nobase2)}`);
const oldbase = c({ lastServiceWindow: { unservedShare: 0 }, deficitFrac: 0, marginPct: -1, initialMarginPct: -6, serviceDeliveryBaseline: { unservedShare: 0 } });
check(near(O(oldbase), 1 / 17) && near(P(oldbase), 1 / 17), 'patched: baseline without the recorded margin keeps the game rule', `${O(oldbase)} ${P(oldbase)}`);
// Extreme inputs.
for (const [m0, m] of [[-100, -100], [-100, 500], [-95, 200], [50, -100]]) { const v = P(c({ deficitFrac: 1, serviceDeliveryBaseline: { unservedShare: 1, __geobalMarginPct0: m0 }, marginPct: m })); check(v >= 0 && v <= 1, `extreme: settled margin ${m0}, margin ${m}: factor in [0,1]`, String(v)); }
// The Qat edit records the settled margin next to the day-0 unserved share.
check(patched.includes('r.serviceDeliveryBaseline.__geobalMarginPct0=Number.isFinite(Number(r.marginPct))?Number(r.marginPct):null') && !original.includes('__geobalMarginPct0'), 'Qat records the settled day-0 margin');
check(/function zcr\(e,t\)\{fda\(e,t\.plants\),Sra\(e,t\.energy\);for\(let c of e\.countries\.values\(\)\)/.test(patched), 'the checkpoint energy restore (zcr) records it too');
check(P(c({})) === 1 && O(c({})) === 1, 'missing fields default as before');
check(P(null) === 0, 'no energy: 0');
// Port watch: the game's T0 runtime seal must stay skipped for the certified checkpoint (see t0-seal-gate.mjs).
for (const [label, text] of [['original', original], ['patched', patched]]) { const probs = sealGateProblems(text); check(!probs.length, `${label}: T0 seal gate still skips certified checkpoints`, probs.length ? `${probs.join('; ')}. ${SEAL_GATE_HINT}` : ''); }
console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
