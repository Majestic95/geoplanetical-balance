// N1 function test: an adopted UN sanctions resolution (syo) binds every UN member (kF) but the target, the player's
// country only when the player voted yes, with the resolution's sponsor as the regime's initiator; each country gets only
// the instruments the game lets it apply (the real join path Oc -> YK -> F1e: the asset freeze needs a reserve-currency
// issuer). The sanctions review (Zg) then releases the countries N1 enrolled once the aggression war named in the
// dossier has ended, and keeps them for other dossier kinds. syo, Oc, YK, F1e, Peo, rut, Zg and the patch's helpers are
// sliced from the balance mod built without and with this patch; kF's status table, lha, the reserve-issuer test and the
// bookkeeping helpers are stubbed.
// Usage: node mods/geoplanetical-balance/tests/n1.test.mjs (from the repo root)
import { workspaceBuild, buildAll, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

// The balance mod built with and without this patch (approved from the proposals 2026-11-18).
const ID = 'n1-un-sanctions-all-members';
const [MOD] = loadMods(MODS_DIR, { only: ['geoplanetical-balance'] });
if (!MOD.patches.some(x => x.id === ID)) throw new Error(`${ID} is not in the balance mod`);
const SIMB = m => buildAll(workspaceBuild(), [m]).get('simulation-worker.bundle.js').text;
const patched = SIMB(MOD), withoutFix = SIMB({ ...MOD, patches: MOD.patches.filter(x => x.id !== ID) });
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } };

const fn = (text, name, need = true) => {
  const s = text.indexOf(`function ${name}(`);
  if (s < 0) { if (need) throw new Error(`${name}: not found`); return ''; }
  if (text.indexOf(`function ${name}(`, s + 1) >= 0) throw new Error(`${name}: not found once`);
  let depth = 0, q = null;
  for (let i = text.indexOf('){', s) + 1; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(s, i + 1);
  }
  throw new Error(`${name}: unbalanced`);
};
// The instrument rules the join path reads, checked against the bundle so a change there fails the test.
for (const t of ['fin_assetfreeze:{channel:"finance",severity:.6,selfCost:.04,requires:{reserveIssuer:!0}}', 'trade_arms:{channel:"military",severity:.2,selfCost:.08}', 'q6t=Object.freeze(["fin_assetfreeze","trade_arms"])'])
  if (!patched.includes(t)) throw new Error(`instrument data changed: ${t}`);
const zK = { fin_assetfreeze: { requires: { reserveIssuer: true } }, trade_arms: {} };
const Mut = new Set(['trade_arms', 'fin_assetfreeze']);

// Council: US, GB, FR yes; CN abstains; RU no. World: 9 countries, target IR (364); Palestine (275) is an observer.
const COUNCIL = { '840': 'yes', '826': 'yes', '250': 'yes', '156': 'abstain', '643': 'no' };
const KEYS = ['840', '826', '250', '156', '643', '364', '276', '392', '275'];
const MEMBERS = new Set(KEYS.filter(k => k !== '275'));
const RESERVE = new Set(['840', '826', '250', '392', '156']); // issuers of reserve currencies (stub of s6a)
const K = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const load = (text) => new Function('qee', 'cqa', 'CF', 'W6t', 'B3e', 'LO', 'Jg', 'ra', 'H', 'Il', 'q6t', 'lC', 'kF', 'Vo', 'zK', 'Mut', 's6a', 'feo', 'meo', 'He', 'h6a', 'GB', 'lha', 'zl', 'bp', 'vQ', 'K', 'geo', 'weo', 'gL', 'VK', 'Aut', 'log',
  `${fn(text, 'Peo')}${fn(text, 'F1e')}${fn(text, 'YK')}${fn(text, 'rut')}${fn(text, 'Oc')}${fn(text, 'syo')}${fn(text, 'Zg')}${fn(text, '__geobalUnWarActive', false)}${fn(text, '__geobalUnRelease', false)};return {syo, Zg};`);
const run = (text, { playerKey = '276', type = 'sanctions', dossier = { id: 'd1', kind: 'aggression', warId: 'w1' } } = {}) => {
  const log = { grudges: [], recompute: 0 };
  let seq = 0;
  const api = load(text)(
    () => Object.keys(COUNCIL), (A, c) => COUNCIL[c.key], (A, k) => ({ key: k }), () => [],
    () => ({ yes: 3, vetoedBy: [], adopted: true }), () => false, (r) => (r ? [r.dossierId].filter(Boolean) : []), () => {}, () => {}, () => { log.recompute++; },
    Object.freeze(['fin_assetfreeze', 'trade_arms']), () => [], (c) => !!c && MEMBERS.has(c.key), () => false, zK, Mut,
    (A, c) => RESERVE.has(c.key), () => true, () => 1, () => true, () => `s${++seq}`, () => false,
    (A, regime, key) => (regime.initiatorKey === key ? 'standard' : 'lax'), () => 0,
    (A, from, to, why) => log.grudges.push(`${from.key}>${to.key}:${why}`), () => ({ ok: true, satisfied: false }), K,
    () => false, () => [], () => false, () => false, () => {}, log);
  const A = { day: 50, playerKey, countries: new Map(KEYS.map(k => [k, { key: k }])), sanctions: [],
    conflicts: new Map([['w1', { id: 'w1', status: 'active' }]]), aiWars: new Map(), wars: new Map(),
    un: { resolutions: [{ id: 'r1', status: 'draft', type, targetKey: '364', sponsorKey: '840', dossierId: dossier?.id, decisionIds: {} }], dossiers: dossier ? [dossier] : [] } };
  const out = api.syo(A, 'r1');
  return { A, out, log, api, regime: A.sanctions.find(r => r.sourceTypeId === 'un_resolution') };
};
const parts = r => (r?.participants || []).map(p => `${p.countryKey}:${p.instrumentIds.join('+')}:${p.enforcementId}`).sort();

{
  const v = run(withoutFix), p = run(patched);
  check(JSON.stringify(parts(v.regime)) === JSON.stringify(['250:fin_assetfreeze+trade_arms:standard', '826:fin_assetfreeze+trade_arms:lax', '840:fin_assetfreeze+trade_arms:lax']),
    'without the fix: the three yes voters, and the first in key order (250) becomes the initiator', JSON.stringify(parts(v.regime)));
  check(JSON.stringify(parts(p.regime)) === JSON.stringify(['156:fin_assetfreeze+trade_arms:lax', '250:fin_assetfreeze+trade_arms:lax', '392:fin_assetfreeze+trade_arms:lax', '643:trade_arms:lax', '826:fin_assetfreeze+trade_arms:lax', '840:fin_assetfreeze+trade_arms:standard']),
    'patched: every member but the target, the abstaining player and the observer; the asset freeze only for reserve issuers; the sponsor (840) is the initiator', JSON.stringify(parts(p.regime)));
  check(p.regime.initiatorKey === '840' && v.regime.initiatorKey === '250', 'initiator: sponsor (patched) vs first participant (without the fix)', `${p.regime.initiatorKey} / ${v.regime.initiatorKey}`);
  check(!parts(p.regime).some(x => x.startsWith('275:')), 'observer state (275) not bound');
  check(p.log.recompute === 1 && p.out === true, 'one deferred recompute, resolution adopted');
  check(p.log.grudges.length === 6 && p.log.grudges.every(g => g.endsWith('>364:sanction')), 'each participant records the game\'s sanction grudge', JSON.stringify(p.log.grudges));
}
{
  check(parts(run(patched, { playerKey: '840' }).regime).some(x => x.startsWith('840:')), 'player who voted yes joins');
  const q = run(patched, { playerKey: '643' });
  check(!parts(q.regime).some(x => x.startsWith('643:')) && parts(q.regime).some(x => x.startsWith('276:')), 'player who voted no is not bound; the other members are');
  check(!run(patched, { type: 'condemnation' }).regime, 'condemnation: no regime');
}
{
  // Release: the aggression war ends -> the enrolled countries leave, the yes voters stay.
  const p = run(patched);
  p.api.Zg(p.A);
  check(parts(p.regime).length === 6, 'war still active: nobody released');
  p.A.conflicts.get('w1').status = 'ended';
  const changed = p.api.Zg(p.A);
  check(changed === true && JSON.stringify(parts(p.regime).map(x => x.split(':')[0])) === JSON.stringify(['250', '826', '840']) && p.regime.statusId === 'active',
    'war ended: the enrolled countries leave, the yes voters stay, the regime stays', JSON.stringify(parts(p.regime)));
  check(p.api.Zg(p.A) === false, 'second review: nothing more to release');
  const g = run(patched); g.A.conflicts.delete('w1');
  g.api.Zg(g.A);
  check(parts(g.regime).length === 3, 'war record gone (AI war deleted at peace): released');
  const pl = run(patched, { dossier: { id: 'd1', kind: 'aggression', warId: 'player:276' } });
  pl.A.wars.set('276', { participants: {} }); pl.api.Zg(pl.A);
  check(parts(pl.regime).length === 6, 'player war still in e.wars: nobody released');
  pl.A.wars.clear(); pl.api.Zg(pl.A);
  check(parts(pl.regime).length === 3, 'player war over: released');
  const an = run(patched, { dossier: { id: 'd1', kind: 'annexation', warId: 'w1' } });
  an.A.conflicts.get('w1').status = 'ended'; an.api.Zg(an.A);
  check(parts(an.regime).length === 6, 'annexation dossier: everyone stays, as the game keeps its yes voters');
  const v = run(withoutFix); v.A.conflicts.get('w1').status = 'ended';
  check(v.api.Zg(v.A) === false && parts(v.regime).length === 3, 'without the fix: Zg leaves a UN aggression regime as it is');
}

console.log(failures ? `${failures} of ${checks} checks FAILED` : `${checks}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
