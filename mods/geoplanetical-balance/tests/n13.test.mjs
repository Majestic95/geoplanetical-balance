// N13 function test: the monthly AI sanctions step (oLe) now re-checks each participant's instruments with the game's
// leverage test (F1e) before the national review (Ctr): a lapsed instrument is dropped, a participant left with none
// leaves (the game's R1, which ends an empty regime), seeded regimes and participants with an open relief are skipped,
// and the GDP-share rule gets a 10% margin. When a participant loses every tool, the player hears it through the
// game's existing events (as sender: sanction_lifted; as target: sanction_eased; reason leverage_lapsed). The patch's helper and the game's F1e and R1 are taken from the patched
// bundle (F1e's own tests reserveIssuer/techProducer/meo are stubbed); oLe's call order is checked in both bundles.
// Usage: node mods/geoplanetical-balance/tests/n13.test.mjs (from the repo root)
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
// oLe order: the re-check runs after Zg/Hwa and before the national review Ctr.
check(fnSrc(original, 'oLe').includes('Zg(e),Hwa(e),Ctr(e);') && !original.includes('__geobalLeverageLapse'), 'original has no re-check (negative control)');
check(fnSrc(patched, 'oLe').includes('Zg(e),Hwa(e),__geobalLeverageLapse(e),Ctr(e);'), 'patched oLe re-checks before the national review');

const K = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
// The catalogue the game's F1e reads: zK[id].requires and the valid-instrument set Mut.
const zK = { fin_assetfreeze: { requires: { reserveIssuer: true } }, tech_export: { requires: { techProducer: true } },
  fin_equityban: { requires: { minGdpShare: 0.02 } }, trade_arms: {} };
const Mut = new Set(Object.keys(zK));
let recomputed = 0;
const ueo = { minGdpCap: 10 };
// pl (node discovered), f6a (output of the technology goods peo) and the income floor are what the game's feo reads.
const events = [];
const load = () => new Function('K', 'zK', 'Mut', 's6a', 'pl', 'f6a', 'peo', 'ueo', 'meo', 'SQ', 'Aut', 'Zg', 'Il', 'H',
  `${fnSrc(patched, 'R1')}${fnSrc(patched, '__geobalLeverageLapse')};return __geobalLeverageLapse;`)(
  K, zK, Mut, (e, c) => !!c.reserve, (e, c, n) => !!c.chips && n === 'digital.chip_design', (c) => c.techOut ?? (c.chips ? 100 : 0),
  ['semiconductors'], ueo, (e, c, r) => (c.gdp || 0) / (Number.isFinite(r) && r > 0 ? r : 100), () => 100, () => { recomputed++; }, () => {}, () => {}, (e, type, payload, opts) => { events.push({ type, payload, opts }); });
// The helper mirrors the game's leverage rules (F1e, feo) with a 10% margin; a game change to either must be noticed.
check(fnSrc(original, 'F1e') === 'function F1e(e,t,a,r=null){let o=zK[a];if(!o||!Mut.has(a)||!t)return!1;let n=o.requires;return n?!(n.reserveIssuer&&!s6a(e,t)||n.techProducer&&!feo(e,t)||n.minGdpShare!=null&&meo(e,t,r)<n.minGdpShare):!0}',
  'the game leverage rule (F1e) is the one the helper mirrors');
check(fnSrc(original, 'feo') === 'function feo(e,t){return(pl(e,t,"digital.chip_design")||pl(e,t,"digital.mature_fabs"))&&f6a(t,peo)>=Math.max(.25,Math.max(0,Number(t?.gdp)||0)*5e-5)&&(t?.gdpCap||0)>=(ueo.minGdpCap||999)}',
  'the game technology-producer rule (feo) is the one the helper mirrors');
const L = load();
const world = (countries, regimes) => ({ day: 300, countries: new Map(Object.entries(countries).map(([k, c]) => [k, { gdpCap: 50, ...c }])), sanctions: regimes });
const reg = (id, participants, extra = {}) => ({ id, targetKey: 'T', statusId: 'active', preset: false, participants, ...extra });

// A lost its reserve currency: asset freeze dropped, arms embargo kept.
const w1 = world({ A: { reserve: false, chips: true, gdp: 5 }, T: {} },
  [reg('s1', [{ countryKey: 'A', instrumentIds: ['fin_assetfreeze', 'trade_arms'] }])]);
check(L(w1) === true && JSON.stringify(w1.sanctions[0].participants[0].instrumentIds) === '["trade_arms"]', 'lapsed asset freeze dropped, arms kept',
  JSON.stringify(w1.sanctions[0].participants));
check(recomputed === 1, 'sanction maps recomputed once after a change', String(recomputed));
// Still has leverage: untouched, no recompute.
recomputed = 0;
const w2 = world({ A: { reserve: true, chips: true, gdp: 5 }, T: {} }, [reg('s1', [{ countryKey: 'A', instrumentIds: ['fin_assetfreeze', 'tech_export'] }])]);
check(L(w2) === false && w2.sanctions[0].participants[0].instrumentIds.length === 2 && recomputed === 0, 'leverage held: unchanged');
// Only instrument lapses, sole participant: the regime ends through R1.
const w3 = world({ A: { chips: false, gdp: 5 }, T: {} }, [reg('s1', [{ countryKey: 'A', instrumentIds: ['tech_export'] }])]);
L(w3);
check(w3.sanctions[0].participants.length === 0 && w3.sanctions[0].statusId === 'ended' && w3.sanctions[0].endedDay === 300, 'empty regime ends', JSON.stringify(w3.sanctions[0]));
// Two participants, one loses everything: the other stays.
const w4 = world({ A: { chips: false }, B: { chips: true }, T: {} },
  [reg('s1', [{ countryKey: 'A', instrumentIds: ['tech_export'] }, { countryKey: 'B', instrumentIds: ['tech_export'] }])]);
L(w4);
check(w4.sanctions[0].statusId === 'active' && w4.sanctions[0].participants.map((p) => p.countryKey).join() === 'B', 'participant without tools leaves, regime stays');
// Seeded regime without the setup record (a game started before this version): not re-checked.
const w5 = world({ A: { reserve: false }, T: {} }, [reg('s1', [{ countryKey: 'A', instrumentIds: ['fin_assetfreeze'] }], { preset: true })]);
check(L(w5) === false && w5.sanctions[0].participants[0].instrumentIds.length === 1, 'seeded regime without a record skipped');
// Seeded regime with the record: the seeded tool is exempt, a tool added in play is re-checked (Germany adds an equity ban).
const w5b = world({ A: { reserve: false, gdp: 1 }, B: { gdp: 1 }, T: {} }, [reg('s1', [{ countryKey: 'A', instrumentIds: ['fin_assetfreeze', 'fin_equityban'] },
  { countryKey: 'B', instrumentIds: ['fin_equityban'] }], { preset: true, __geobalSeed: { A: ['fin_assetfreeze'] } })]);
L(w5b);
check(w5b.sanctions[0].participants.map((p) => p.countryKey + ':' + p.instrumentIds.join('+')).join() === 'A:fin_assetfreeze',
  'seeded tool exempt; tools added later (and a participant that joined later) re-checked', JSON.stringify(w5b.sanctions[0].participants));
// Security-crisis regimes are left to the crisis.
for (const k of ['causeId', 'sourceTypeId']) {
  const w = world({ A: { reserve: false }, T: {} }, [reg('s1', [{ countryKey: 'A', instrumentIds: ['fin_assetfreeze'] }], { [k]: 'security_crisis' })]);
  check(L(w) === false && w.sanctions[0].participants[0].instrumentIds.length === 1, `security-crisis regime skipped (${k})`);
}
// Technology rule: 10% margin on output and income per head; no chip node, no leverage.
const tx = (c) => { const w = world({ A: c, T: {} }, [reg('s1', [{ countryKey: 'A', instrumentIds: ['tech_export', 'trade_arms'] }])]); L(w); return w.sanctions[0].participants[0].instrumentIds.join(); };
check(tx({ chips: true, techOut: 0.23 }) === 'tech_export,trade_arms', 'tech output 8% under the bar keeps export controls', tx({ chips: true, techOut: 0.23 }));
check(tx({ chips: true, techOut: 0.2 }) === 'trade_arms', 'tech output 20% under the bar loses them');
check(tx({ chips: true, gdpCap: 9.2 }) === 'tech_export,trade_arms' && tx({ chips: true, gdpCap: 8.5 }) === 'trade_arms', 'income-per-head margin 10%');
check(tx({ chips: false }) === 'trade_arms', 'no chip node: export controls lapse');
// Open relief: skipped; ended relief: re-checked.
const w6 = world({ A: { reserve: false }, T: {} }, [reg('s1', [{ countryKey: 'A', instrumentIds: ['fin_assetfreeze', 'trade_arms'], reliefs: [{ statusId: 'observing' }] }])]);
check(L(w6) === false && w6.sanctions[0].participants[0].instrumentIds.length === 2, 'participant with an open relief skipped');
const w7 = world({ A: { reserve: false }, T: {} }, [reg('s1', [{ countryKey: 'A', instrumentIds: ['fin_assetfreeze', 'trade_arms'], reliefs: [{ statusId: 'ended' }] }])]);
check(L(w7) === true && w7.sanctions[0].participants[0].instrumentIds.join() === 'trade_arms', 'ended relief does not block the re-check');
// GDP margin: 1.9% of world GDP keeps the equity ban (within 10%), 1.7% loses it.
const eq = (gdp) => { const w = world({ A: { gdp }, T: {} }, [reg('s1', [{ countryKey: 'A', instrumentIds: ['fin_equityban', 'trade_arms'] }])]); L(w); return w.sanctions[0].participants[0].instrumentIds.join(); };
check(eq(1.9) === 'fin_equityban,trade_arms', '1.9% of world GDP keeps the equity ban (margin)', eq(1.9));
check(eq(1.7) === 'trade_arms', '1.7% of world GDP loses it', eq(1.7));
// Player notices (existing game events) only when a participant loses every tool.
const notice = (playerKey, sender, target, tools) => {
  events.length = 0;
  const w = { ...world({ [sender]: { reserve: false }, [target]: {} }, [{ ...reg('s1', [{ countryKey: sender, instrumentIds: tools }]), targetKey: target }]), playerKey };
  L(w); return events.map((x) => `${x.type}|${x.payload.reason}|${x.payload.senderKey ?? ''}|${x.payload.targetKey}`).join();
};
check(notice('P', 'P', 'T', ['fin_assetfreeze']) === 'diplomacy.sanction_lifted|leverage_lapsed||T', 'player as sender loses every tool: "you withdrew" notice', notice('P', 'P', 'T', ['fin_assetfreeze']));
check(notice('P', 'A', 'P', ['fin_assetfreeze']) === 'diplomacy.sanction_eased|leverage_lapsed|A|P', 'sender against the player loses every tool: "lifts its sanctions" notice');
check(notice('P', 'P', 'T', ['fin_assetfreeze', 'trade_arms']) === '' && notice('P', 'A', 'P', ['fin_assetfreeze', 'trade_arms']) === '', 'tools left: no notice (no game text for a partial lapse)');
check(notice('P', 'A', 'T', ['fin_assetfreeze']) === '', 'AI against AI: no notice');
events.length = 0;
const wo = { ...world({ A: { reserve: false }, P: {} }, [{ ...reg('s1', [{ countryKey: 'A', instrumentIds: ['fin_assetfreeze'] }]), targetKey: 'P' },
  { ...reg('s2', [{ countryKey: 'A', instrumentIds: ['trade_arms'] }]), targetKey: 'P' }]), playerKey: 'P' };
L(wo);
check(events.length === 0 && wo.sanctions[0].statusId === 'ended' && wo.sanctions[1].statusId === 'active',
  'sender keeps another sanction on the player: no "lifts its sanctions" notice', JSON.stringify(events.map((x) => x.type)));
check(!original.includes('leverage_lapsed'), 'original has no lapse notice (negative control)');
// Ended regimes and missing countries are ignored.
const w8 = world({ T: {} }, [reg('s1', [{ countryKey: 'GONE', instrumentIds: ['fin_assetfreeze'] }]), reg('s2', [{ countryKey: 'GONE', instrumentIds: ['fin_assetfreeze'] }], { statusId: 'ended' })]);
check(L(w8) === false, 'missing country and ended regime ignored');
// Seeded tools are recorded at setup on both paths: the data seed (b6a) and the economic T0 checkpoint load (K6a).
check(fnSrc(patched, 'b6a').includes('i.__geobalSeed=Object.fromEntries(o.map(s=>[s.countryKey,[...s.instrumentIds]]))'), 'b6a records the seeded tools');
check(fnSrc(patched, 'K6a').includes('r?.preset&&!r.__geobalSeed&&(r.__geobalSeed='), 'K6a records the seeded tools of a checkpoint without the record');
check(!original.includes('__geobalSeed'), 'original has no record (negative control)');
// Port watch: the game's T0 runtime seal must stay skipped for the certified checkpoint (see t0-seal-gate.mjs).
for (const [label, text] of [['original', original], ['patched', patched]]) { const probs = sealGateProblems(text); check(!probs.length, `${label}: T0 seal gate still skips certified checkpoints`, probs.length ? `${probs.join('; ')}. ${SEAL_GATE_HINT}` : ''); }
console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
