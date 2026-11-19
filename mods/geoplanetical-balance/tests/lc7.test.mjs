// LC7 function test: the monthly multilateral aid split (wit) gives no weight to a recipient the donor is at war with
// (the game's belligerency test M7: an active conflict in its hostilities phase, principal or co-belligerent on opposite
// sides) or sanctions (an active regime with the donor as sender), and the donor's budget goes to the other recipients
// by the same split. wit, the patch's helper, M7, n_ and QGt and the armed-recipient factor (Jr.aid.nukeAidMult) are
// taken from the bundles; the budget, need, relations, rounding and split helpers are stubbed.
// Usage: node mods/geoplanetical-balance/tests/lc7.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

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
const zDecl = (text) => { const a = text.indexOf('z$e=new Set(['); if (a < 0) throw new Error('z$e missing'); return text.slice(a, text.indexOf('])', a) + 2); };
const src = (text) => `const ${zDecl(text)};` + fnSrc(text, 'n_') + fnSrc(text, 'QGt') + fnSrc(text, 'M7') +
  (text.includes('function __geobalAidSanctionMap(') ? fnSrc(text, '__geobalAidSanctionMap') : '') + fnSrc(text, 'wit');
const NUKE = Number((/nukeAidMult:([\d.]+)/.exec(original) || [])[1]);
check(NUKE > 0 && NUKE < 1, 'the game reduces aid to nuclear-armed recipients', String(NUKE));
const load = (text) => new Function('Jr', 'TIe', 'zG', 'At', 'Rua', 'ae', 'Pt', 'wi', 'St', 'LB', `${src(text)};return wit;`)(
  { aid: { nukeAidMult: NUKE } },
  (c) => c.budget || 0,
  (c) => c.need || 0,
  (e, a, b) => e.rel?.[`${a.key}>${b.key}`] ?? 0,
  (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
  (x) => Math.floor(x * 1e6) / 1e6,
  (total, w) => { const s = w.reduce((a, b) => a + b, 0); return w.map((x) => (s > 0 ? total * x / s : 0)); },
  (c) => !!c.armed,
  (a, b, c) => a * b / c,
  (e) => e.sanctions || [],
);
const P = load(patched), O = load(original);
check(original.includes('function wit(') && !original.includes('__geobalAidExcluded'), 'original has the split without the exclusion');
const world = (opts = {}) => {
  const c = (key, extra) => ({ key, gdp: 100, need: 1, budget: 0, ...extra });
  const countries = new Map([['A', c('A', { budget: 10, need: 0 })], ['B', c('B')], ['C', c('C')], ['D', c('D')]]);
  if (opts.armed) countries.get(opts.armed).armed = true;
  countries.set('E', c('E'));
  const war = { id: 'w1', status: opts.warStatus || 'active', ...(opts.phase ? { settlement: { phase: opts.phase } } : {}),
    participants: { A: { side: 'A', role: 'principal' }, C: { side: 'B', role: opts.cRole || 'principal' }, E: { side: 'B', role: 'support' } } };
  return {
    countries,
    conflicts: new Map([['w1', war]]),
    sanctions: opts.noSanctions ? [] : [{ sender: opts.reverse ? 'D' : 'A', target: opts.reverse ? 'A' : 'D' }],
    rel: { 'A>B': 0, 'A>C': -100, 'A>D': 0, 'A>E': 0 },
  };
};
const run = (impl, w) => { const out = {}; impl(w, 1, (d, r, amt) => { if (d.key === 'A') out[r.key] = (out[r.key] || 0) + amt; }); return out; };
{
  const o = run(O, world()), p = run(P, world());
  check(o.C > 0 && o.D > 0, 'unmodded: the enemy and the sanctioned country receive aid', JSON.stringify(o));
  check(!(p.C > 0) && !(p.D > 0), 'patched: no aid to the enemy at war or the sanctioned country', JSON.stringify(p));
  const tot = (x) => Object.values(x).reduce((a, b) => a + b, 0);
  check(Math.abs(tot(p) - 10) < 1e-6 && Math.abs(tot(o) - 10) < 1e-6, 'with no armed recipient the budget is fully spent in both', `${tot(o)} ${tot(p)}`);
  check(p.E > 0, 'a country that only grants military access (role support) still receives aid', JSON.stringify(p));
  check(p.B > o.B, 'the remaining recipient gets the redistributed share', `${o.B} -> ${p.B}`);
}
{
  const p = run(P, world({ warStatus: 'suspended' }));
  check(p.C > 0, 'a suspended war does not exclude the recipient', JSON.stringify(p));
  const cf = run(P, world({ phase: 'ceasefire' }));
  check(cf.C > 0, 'a war in a ceasefire phase does not exclude the recipient', JSON.stringify(cf));
  const co = run(P, world({ cRole: 'cobelligerent' }));
  check(!(co.C > 0), 'a co-belligerent on the other side is excluded', JSON.stringify(co));
  const ar = run(P, world({ armed: 'B' })), aro = run(O, world({ armed: 'B' }));
  check(ar.B > 0 && aro.B > 0, 'an armed recipient still gets its reduced share in both', JSON.stringify(ar));
  check(ar.B < run(P, world()).B, 'the armed-recipient reduction still applies after the exclusions', `${ar.B} < ${run(P, world()).B}`);
  const r = run(P, world({ reverse: true }));
  check(r.D > 0, 'sanctions imposed on the donor by the recipient do not exclude it', JSON.stringify(r));
  const n = run(P, world({ noSanctions: true, warStatus: 'ended' }));
  const o2 = run(O, world({ noSanctions: true, warStatus: 'ended' }));
  check(JSON.stringify(n) === JSON.stringify(o2), 'no war and no sanctions: identical split to the unmodded game', `${JSON.stringify(o2)} vs ${JSON.stringify(n)}`);
}
console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
