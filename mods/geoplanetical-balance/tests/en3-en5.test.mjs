// EN3 and EN5 function test. EN3: the field and mine speed-up divisor is 2 (was 5), so build and ramp months are 2.5
// times the game's and the shortest build is 6 months. EN5: the AI extraction need adds the next 24 months of decline
// of the owner's oil and gas fields, less output still to come from ramping fields (netted against pending projects
// like the other terms), and the AI project score charges payback over the field's own profile instead of interest
// only. Code is taken from both bundles; the field helper ple is the game's own; the rest is stubbed. Negative
// control: the original code gives the old numbers. Usage: node mods/geoplanetical-balance/tests/en3-en5.test.mjs
// (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}${detail ? `: ${detail}` : ''}`); } else console.log(`ok ${what}${detail ? ` (${detail})` : ''}`); };
const fnSrc = (text, name) => {
  const s = text.indexOf(`function ${name}(`);
  if (s < 0 || text.indexOf(`function ${name}(`, s + 1) >= 0) throw new Error(`${name}: not found once`);
  let depth = 0, i = text.indexOf('){', s) + 1;
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break; }
  return text.slice(s, i + 1);
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

// ---- EN3: evaluate the profile table and divisors from each bundle.
const profiles = (text) => {
  const s = text.indexOf('={conventional:{build:30,');
  const start = text.lastIndexOf('var ', s);
  const e = text.indexOf(';', text.indexOf('Math.ceil(12/', s));
  const m = /var (\w+)=\{conventional/.exec(text.slice(start, s + 20));
  const bx = /,(\w+)=Object\.freeze\(Object\.fromEntries\(Object\.entries\(/.exec(text.slice(start, e));
  const blo = /,(\w+)=Math\.ceil\(12\/(\w+)\)$/.exec(text.slice(start, e));
  if (!m || !bx || !blo) throw new Error('profile block not recognised');
  return new Function(`${text.slice(start, e)};return {Bx:${bx[1]},Blo:${blo[1]},F:${blo[2]}};`)();
};
const P3 = profiles(patched), O3 = profiles(original);
check(O3.F === 5 && O3.Bx.deepwater.build === 72 / 5 && O3.Blo === 3, 'original: divisor 5, deepwater 14.4 months, shortest build 3', `${O3.Bx.deepwater.build}`);
check(P3.F === 2 && P3.Bx.deepwater.build === 36 && P3.Bx.conventional.build === 15 && P3.Blo === 6, 'patched: divisor 2, deepwater 36 months, conventional 15, shortest 6');
check(P3.Bx.deepwater.ramp === 18 && P3.Bx.mine.ramp === 30 / 4 && O3.Bx.mine.ramp === 30 / 10, 'ramps: fields /2, mines /4 (were /5 and /10)');
check(P3.Bx.deepwater.decline === O3.Bx.deepwater.decline && P3.Bx.deepwater.plateau === O3.Bx.deepwater.plateau, 'plateau and decline unchanged');

// ---- EN5: the sustaining need.
check(!original.includes('__geobalWellDecline') && !original.includes('__geobalCapitalRecovery'), 'original has neither helper (negative control)');
const ple = new Function(`${fnSrc(original, 'ple')};return ple;`)();
const Dd = (e) => Math.max(0, Number.isFinite(e) ? e : 0);
const Xr = (f) => (!f || f.online === false || f.phase === 'depleted' ? 0 : Math.max(0, f.flow || 0));
const ym = () => 1, tE = (e, s, a) => Math.max(0, a || 0) * 2; // 2 prod units per flow unit
const qmt = new Set(['oil', 'gas']), Kc = new Set(['oil', 'gas', 'coal', 'lithium']);
const IDX = { oil: 0, gas: 1, coal: 2, lithium: 3 }, Jt = (s) => IDX[s], Sna = [1, 0.93, 1, 1];
const h0e = (we, i) => we.cap[i];
const loadNeed = (text) => new Function('qmt', 'Xr', 'ple', 'ym', 'tE', 'Dd', 'pot', 'Cse', 'uar', 'OMo', 'Jt', 'h0e', 'Sna', 'Kc', 'Pna',
  `${text.includes('__geobalWellDecline') ? fnSrc(text, '__geobalWellDecline') : 'function __geobalWellDecline(){return 0}'};${fnSrc(text, 'GMo')};return {W:__geobalWellDecline,G:GMo};`)(
  qmt, Xr, ple, ym, tE, Dd, () => 0, () => 0, 0.12 / 0.88, 0.25, Jt, h0e, Sna, Kc, (i) => (i >= 2 ? 0.88 : 1));
const PN = loadNeed(patched), ON = loadNeed(original);
const field = (o) => ({ id: o.id, owner: 'A', resource: 'oil', flow: 10, capacityFlow: 10, reserveInitial: 1000, reserveLeft: 900, seeded: true, ...o });
const world = (fs) => ({ fields: new Map(fs.map((f) => [f.id, f])) });
const ctry = (fs, util) => ({ key: 'A', _fields: fs.map((f) => f.id), we: { cap: [100, 100, 100, 100], prod: [100 * util, 100 * util, 100 * util, 100 * util] } });
const need = (fs, s = 'oil', util = 1) => PN.W(world(fs), ctry(fs, util), s);
check(need([field({ id: 1 })]) === 0, 'seeded field above 60% of its reserve: no need (as the game: flat output)');
const half = field({ id: 2, reserveLeft: 500, flow: 10 * ple({ reserveInitial: 1000, reserveLeft: 500 }) });
const depl = (u) => half.flow * (1 - ple({ reserveInitial: 1000, reserveLeft: 500 - 2 * half.flow * u }) / ple(half)) * 2;
check(near(need([half]), depl(1)) && depl(1) > 0, 'seeded field past 40% depletion: two years of the depletion curve at full output', need([half]).toFixed(4));
check(near(need([half], 'oil', 0.5), depl(0.5)) && depl(0.5) < depl(1), 'depletion follows the country actual output (half used: smaller loss)', need([half], 'oil', 0.5).toFixed(4));
const dec = field({ id: 3, seeded: false, phase: 'decline', ageMonths: 200, rampMonths: 9, plateauMonths: 48, declineRate: 0.06, reserveLeft: 900 });
const decNeed = 10 * (1 - (1 - 0.06 / 12) ** 24) * 2;
check(near(need([dec]), decNeed), 'new field in decline: 24 months at its decline rate', need([dec]).toFixed(4));
const soon = field({ id: 4, seeded: false, phase: 'plateau', ageMonths: 51, rampMonths: 9, plateauMonths: 48, declineRate: 0.06 });
check(near(need([soon]), 10 * (1 - (1 - 0.06 / 12) ** 18) * 2), 'plateau ending in 6 months: 18 months of decline counted', need([soon]).toFixed(4));
check(need([field({ id: 5, seeded: false, phase: 'plateau', ageMonths: 10, rampMonths: 9, plateauMonths: 48, declineRate: 0.06 })]) === 0, 'plateau with more than 24 months left: none');
check(need([{ ...dec, owner: 'B' }]) === 0 && need([{ ...dec, resource: 'gas' }]) === 0 && need([{ ...dec, online: false }]) === 0, 'other owner, other resource, offline: excluded');
check(near(need([{ ...dec, resource: 'gas' }], 'gas'), 0.93 * decNeed), 'gas counted in saleable units (7% own use)');
check(need([{ ...dec, resource: 'coal' }], 'coal') === 0, 'coal and mines: no decline term (the game keeps its 13.6%)');
// Ramping project fields: the output still to come counts against the need, for every resource.
const ramp = (o) => field({ id: 6, seeded: false, phase: 'ramp', ageMonths: 2, rampMonths: 9, plateauMonths: 48, declineRate: 0.06, flow: 4, capacityFlow: 10, reserveLeft: 900, ...o });
check(near(need([ramp({})]), -12), 'ramping field: 6 flow units still to come are netted', need([ramp({})]));
check(near(need([ramp({ resource: 'lithium' })], 'lithium'), -12 / 0.88), 'ramping mine counted too, in capacity units (game mine factor 0.88)');
check(near(need([dec, ramp({})]), decNeed - 12), 'decline and ramp net against each other', need([dec, ramp({})]).toFixed(4));
// GMo: the term is inside the netting against spare and pending; a negative term (ramping) lowers the need.
const we = { prod: [100], unmet: [0], imp: [0], exp: [0] };
const goods = (pending, mine = false) => ({ index: 0, mine, tension: 1, consumerPipeline: new Map(), byOwner: new Map([['A', pending]]) });
const c = { key: 'A', we };
check(PN.G(c, goods(0), 5) === 5 && ON.G(c, goods(0), 5) === 0, 'GMo: the sustaining term adds to the need (original ignores it)');
check(PN.G(c, goods(3), 5) === 2 && PN.G(c, goods(8), 5) === 0, 'GMo: pending projects are netted against it');
const short = { ...c, we: { ...we, unmet: [10] } };
check(PN.G(short, goods(0), -6) === 4 && ON.G(short, goods(0), -6) === 10, 'GMo: output still ramping reduces a shortage-driven need (10 - 6)');
check(PN.G(c, goods(0)) === ON.G(c, goods(0)) && PN.G(c, goods(0, true)) === ON.G(c, goods(0, true)), 'GMo without the term: same as the game (wells and mines)');

// ---- EN5: payback over the field's own profile.
const CR = new Function(`${fnSrc(patched, '__geobalCapitalRecovery')};return __geobalCapitalRecovery;`)();
const ref = (r, p) => {
  let A = 0; const n = Math.round(12 * p.life), ra = Math.max(1, p.ramp);
  for (let m = 1; m <= n; m++) { const o = m <= ra ? m / ra : m <= ra + p.plateau ? 1 : (1 - p.decline / 12) ** (m - ra - p.plateau); A += o / 12 / (1 + r) ** (m / 12); }
  return 1 / A;
};
const conv = P3.Bx.conventional, cv = CR(0.05, conv);
check(near(cv, ref(0.05, conv)) && Math.abs(cv - 0.083) < 0.001, 'conventional field at 5%: about 8.3% of cost a year', cv.toFixed(4));
check(Math.abs(CR(0.05, P3.Bx.shale) - 0.235) < 0.001, 'shale well (28%/yr decline) at 5%: about 23.5% a year', CR(0.05, P3.Bx.shale).toFixed(4));
check(CR(0.1, P3.Bx.deepwater) > CR(0.02, P3.Bx.deepwater) && CR(0, P3.Bx.deepwater) > 1 / P3.Bx.deepwater.life, 'rises with the rate; at zero interest above 1/life (ramp and decline)');
check(CR(0.05, {}) > 0 && Number.isFinite(CR(0.05, null)), 'missing profile: finite fallback (25 years flat)');
const loadPick = (text) => new Function('tE', 'Dd', 'Wbt', 'Nx',
  `${text.includes('__geobalCapitalRecovery') ? fnSrc(text, '__geobalCapitalRecovery') : ''};${fnSrc(text, 'LMo')};return LMo;`);
const quote = (cost, profile) => () => ({ viable: true, annualValue: 10, operatingCost: 5, cost, months: 24, profile });
const pick = (text, cost, profile) => loadPick(text)((e, a, f) => f, Dd, 1, quote(cost, profile))(
  { finance: {} }, { bondRate: 5, provs: [{ __provKey: 'p', __rw: { oil: [1] } }] }, 'oil', 1, 1, null);
check(pick(original, 80, conv) && near(pick(original, 80, conv).score, (5 - 80 * 0.05) / 3), 'original: cost 80 at 5% approved on interest only (margin 5 > 4)');
check(pick(patched, 80, conv) === null, `patched: cost 80 does not pay back (charge ${(80 * cv).toFixed(2)} > margin 5): rejected`);
check(near(pick(patched, 50, conv).score, (5 - 50 * cv) / 3), 'patched: cost 50 approved with the payback charge', (50 * cv).toFixed(2));
check(pick(original, 30, P3.Bx.shale) && pick(patched, 30, P3.Bx.shale) === null,
  `shale: margin 5 on cost 30 passes on interest, fails on payback (${(30 * CR(0.05, P3.Bx.shale)).toFixed(2)})`);

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
