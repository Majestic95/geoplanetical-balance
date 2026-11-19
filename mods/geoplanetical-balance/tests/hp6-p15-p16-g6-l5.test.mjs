// HP6, P15, P16, G6 and L5 function test (HP7 retired on 26519199): code cut from the patched and the original bundle, run with stubs.
// Usage: node --max-old-space-size=4000 mods/geoplanetical-balance/tests/hp6-p15-p16-g6-l5.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const between = (text, from, to, max = 6000) => {
  const i = text.indexOf(from), j = text.indexOf(to, i);
  if (i < 0 || j < 0 || j - i > max) throw new Error(`${from} not found`);
  return text.slice(i, j + to.length);
};

// HP7 is retired: the game subtracts route demand itself since 1.1.0 (build 26519199), so the patch was dropped.

// HP6: the game's own HcA and the call in Sj.
{
  check(between(patched, 'function nve(e,t,a,r,o=null,', 's&&tJe(e,t,a,r,o)}') === between(original, 'function nve(e,t,a,r,o=null,', 's&&tJe(e,t,a,r,o)}'), 'HP6: the group move itself is not patched');
  // Sj's own code, with the helper and a stand-in for HcA that moves a tenth of the baseline.
  const SjSrc = `const KLr={membership:!0,moveWealthReference:!1};${between(patched, 'function __geobalMigSum(A,B){', 'return{transfers:s,movedPeopleM:l}}')}; return r$;`;
  const Sj = new Function('ala', 'OLr', 'xLr', 'ove', 'Wy', 'it', 'lVe', 'nve', SjSrc);
  const HcA = (n, s) => { const m = n.baselineDisposableIncomeBnY * 0.1; n.baselineDisposableIncomeBnY -= m; s.baselineDisposableIncomeBnY += m; };
  const run = Sj(() => ({ 1: { g: 10 }, 2: { g: 10 } }), m => m, null, x => x, x => x, () => {}, () => ({ allocationRange: null }), HcA);
  const go = movements => {
    const hh = { 'group:1:g': { baselineDisposableIncomeBnY: 100 }, 'group:2:g': { baselineDisposableIncomeBnY: 100 }, 'group:1:h': { baselineDisposableIncomeBnY: 100 } };
    // Each country has one more group, so emptying one does not empty the country.
    hh['group:1:k'] = { baselineDisposableIncomeBnY: 100 }; hh['group:2:k'] = { baselineDisposableIncomeBnY: 100 };
    const gr = k => ({ pops: { groups: Object.keys(hh).filter(id => id.startsWith(`group:${k}:`)).map(id => ({ financeId: id })) } });
    const countries = new Map([['1', gr(1)], ['2', gr(2)]]);
    run({ finance: { households: hh }, countries }, { countryKey: '1', movements });
    return { hh, c1: countries.get('1'), c2: countries.get('2') };
  };
  const across = go([{ fromCountryKey: '1', toCountryKey: '2', fromGroupId: 'g', toGroupId: 'g', amountM: 1 }]);
  check(near(across.hh['group:1:g'].baselineDisposableIncomeBnY, 90) && near(across.hh['group:2:g'].baselineDisposableIncomeBnY, 110), 'HP6: across a border the groups still move their baseline');
  // Country 1 started with g+h+k = 300, country 2 with g+k = 200; ten crossed.
  check(near(across.c1.geobalMigBaseFactor, 300 / 290) && near(across.c2.geobalMigBaseFactor, 200 / 210), 'HP6: origin and destination multipliers keep each total where it was', `${across.c1.geobalMigBaseFactor} ${across.c2.geobalMigBaseFactor}`);
  const inside = go([{ fromCountryKey: '1', toCountryKey: '1', fromGroupId: 'g', toGroupId: 'h', amountM: 1 }]);
  check(inside.c1.geobalMigBaseFactor === undefined, 'HP6: a move inside a country writes no multiplier');
  const noDest = (() => { const hh = { 'group:1:g': { baselineDisposableIncomeBnY: 100 }, 'group:2:g': { baselineDisposableIncomeBnY: 100 } }; const c = new Map([['1', { pops: { groups: [{ financeId: 'group:1:g' }] } }]]); run({ finance: { households: hh }, countries: c }, { countryKey: '1', movements: [{ fromCountryKey: '1', toCountryKey: '2', fromGroupId: 'g', toGroupId: 'g', amountM: 1 }] }); return c.get('1').geobalMigBaseFactor; })();
  check(near(noDest, 100 / 90), 'HP6: a destination with no country row does not throw');
  {
    const Whole = Sj(() => ({ 1: { g: 10 }, 2: { g: 10 } }), m => m, null, x => x, x => x, () => {}, () => ({ allocationRange: null }), (n, s) => { s.baselineDisposableIncomeBnY += n.baselineDisposableIncomeBnY; n.baselineDisposableIncomeBnY = 0; });
    const hh = { 'group:1:g': { baselineDisposableIncomeBnY: 100 }, 'group:2:g': { baselineDisposableIncomeBnY: 0 } };
    const c = new Map([['1', { geobalMigBaseFactor: 1e4, pops: { groups: [{ financeId: 'group:1:g' }] } }], ['2', { geobalMigBaseFactor: 1e4, pops: { groups: [{ financeId: 'group:2:g' }] } }]]);
    Whole({ finance: { households: hh }, countries: c }, { countryKey: '1', movements: [{ fromCountryKey: '1', toCountryKey: '2', fromGroupId: 'g', toGroupId: 'g', amountM: 1 }] });
    check(c.get('1').geobalMigBaseFactor === 1, 'HP6: a country whose baseline empties resets its multiplier');
    check(c.get('2').geobalMigBaseFactor === 1, 'HP6: a country refilled from empty starts again at 1');
  }
  // AaC's baseline total, in the game's own text, then the game's own LYB.
  const total = text => { const expr = between(text, 'f=d.reduce((A,E)=>A+Math.max(0,Number(e.finance.households[E.financeId]?.baselineDisposableIncomeBnY)||0)', ',y=d.reduce(').slice(2, -12); return (t, A, B) => new Function('d', 'e', 't', `return ${expr}`)(t, A, B); };
  const LYB = new Function(`${between(patched, 'function XYt({', ':0:1}')}; return XYt;`)();
  const groups = v => ({ households: Object.fromEntries(v.map((b, i) => [`f${i}`, { baselineDisposableIncomeBnY: b }])) });
  const pops = v => v.map((_, i) => ({ financeId: `f${i}` }));
  check(total(patched)(pops([100]), { finance: groups([100]) }, {}) === 100 && total(original)(pops([100]), { finance: groups([100]) }, {}) === 100, 'HP6: no multiplier, same total as the game (day 0)');
  // A review case: two groups, the emigrating one emptied and dropped by the game's filter. The total must not jump.
  const before = total(patched)(pops([90, 10]), { finance: groups([90, 10]) }, { geobalMigBaseFactor: 2 });
  const after = total(patched)(pops([90]), { finance: groups([90]) }, { geobalMigBaseFactor: 2 * 100 / 90 });
  check(near(before, 200) && near(after, 200), 'HP6: a group emptied by emigration leaves the total where it was', `${before} ${after}`);
  const dest = LYB({ expectedIncomeBn: 110, baselineIncomeBn: total(patched)(pops([110]), { finance: groups([110]) }, { geobalMigBaseFactor: 100 / 110 }), demandScale: 1.1 }) * 1.1;
  const origin = LYB({ expectedIncomeBn: 90, baselineIncomeBn: total(patched)(pops([90]), { finance: groups([90]) }, { geobalMigBaseFactor: 100 / 90 }), demandScale: 0.9 }) * 0.9;
  check(near(dest, 1.1) && near(origin, 0.9), 'HP6: destination budget x1.1, origin x0.9', `${dest} ${origin}`);
  const oldTotal = total(original)(pops([110]), { finance: groups([110]) }, {});
  check(near(LYB({ expectedIncomeBn: 110, baselineIncomeBn: oldTotal, demandScale: 1.1 }) * 1.1, 1), 'HP6 original: the same case stays at 1 (the bug)');
  // A review case: a territory transfer scales baseline and income by the share kept. The ratio must not move.
  for (const f of [100 / 110, 100 / 90]) for (const kept of [0.5, 0.11, 0.01]) {
    const r0 = LYB({ expectedIncomeBn: 110, baselineIncomeBn: total(patched)(pops([110]), { finance: groups([110]) }, { geobalMigBaseFactor: f }), demandScale: 1 });
    const r1 = LYB({ expectedIncomeBn: 110 * kept, baselineIncomeBn: total(patched)(pops([110 * kept]), { finance: groups([110 * kept]) }, { geobalMigBaseFactor: f }), demandScale: 1 });
    check(near(r0, r1, 1e-9), `HP6: multiplier ${f.toFixed(3)}, a territory loss keeping ${kept} leaves the ratio alone`, `${r0} ${r1}`);
  }
  check(LYB({ expectedIncomeBn: 50, baselineIncomeBn: total(patched)([], { finance: groups([]) }, { geobalMigBaseFactor: 2 }), demandScale: 1 }) === 1, 'HP6: a country with no groups reads 1, no division error');
}

// P15: the term in the game's own text.
{
  const term = text => {
    const expr = between(text, 'c=l&&!l.hasMajority?', ':0,u=0').slice(2, -4);
    return t => new Function('l', 'Cd', `return ${expr}`)(t, (A, B, Q) => Math.max(B, Math.min(Q, A)));
  };
  const P = term(patched), V = term(original);
  check(near(P({ hasMajority: false, pct: 0 }), -11), 'P15 patched: no seats, the largest penalty', String(P({ hasMajority: false, pct: 0 })));
  check(near(V({ hasMajority: false, pct: 0 }), -5), 'P15 original: no seats, the smallest penalty (the bug)');
  for (const pct of [0.01, 0.3, 0.49, 0.5]) check(near(P({ hasMajority: false, pct }), V({ hasMajority: false, pct })), `P15: seat share ${pct} unchanged`);
  check(near(P({ hasMajority: false }), -5), 'P15: a missing share still reads as one half');
  check(P({ hasMajority: true, pct: 0.6 }) === 0, 'P15: a majority pays nothing');
}

// P16: the helper and the game's own date functions.
{
  const LEsrc = patched.match(/[,;\s]o1=(Date\.UTC\([^)]*\))/)?.[1], Ezsrc = patched.match(/[,;\s]Cj=(\d+e\d+)/)?.[1];
  if (!LEsrc || !Ezsrc) throw new Error('date constants not found');
  const env = new Function(`const o1=${LEsrc},Cj=${Ezsrc};return {LE:o1,Ez:Cj};`)();
  const raw = new Function('o1', 'Cj', `${between(patched, 'function __geobalMonthsRaw(A,B){', '-o1)/Cj)}')}; return __geobalMonthsRaw;`)(env.LE, env.Ez);
  // The game's own month helper, with its own floor.
  const ng = new Function('o1', 'Cj', `const kj=e=>Math.max(0,Math.trunc(Number(e)||0));${between(patched, 'function J1(e){', 'return new Date(o1+kj(e)*Cj)}')}${between(patched, 'function i7(e){', 'Math.floor((t-o1)/Cj))}')}${between(patched, 'function fr(e,t){', 'Math.min(r.getUTCDate(),i)))}')}; return fr;`)(env.LE, env.Ez);
  check(patched.includes(',kj=e=>Math.max(0,Math.trunc(Number(e)||0));function J1(e)'), 'P16: the game date helper is the one this test copies');
  let same = true;
  for (const d of [0, 1, 30, 31, 59, 365, 1000, 3650]) for (const m of [0, 1, 12, 48, 60]) if (raw(d, m) !== ng(d, m)) same = false;
  check(same, 'P16: for dates after the start the helper equals the game month arithmetic');
  check(raw(100, -60) < 0 && ng(100, -60) === 0, 'P16: before the start the helper goes negative and the game floors at 0', String(raw(100, -60)));
  check(Math.abs(raw(raw(100, -60), 60) - 100) <= 3, 'P16: the round trip to the next election lands on it', String(raw(raw(100, -60), 60)));
  check(raw(2500, -60) === ng(2500, -60) && raw(2500, -60) > 0, 'P16: an election inside the game keeps its date');

  const cut = text => between(text, 'function EWo(e,t){', 'return{dissolve:!1,reason:"term_ending"}');
  const mk = (text, nextDay) => {
    const quc = between(text, 'function AWo(e,t){', ':null}');
    const helper = text === patched ? between(patched, 'function __geobalMonthsRaw(A,B){', '-o1)/Cj)}') : '';
    const body = cut(text).replace(/return\{dissolve:!1,reason:"term_ending"\}$/, 'return{dissolve:!1,reason:"term_ending"};return{dissolve:!0,reason:"passes"}}');
    const f = new Function('o1', 'Cj', 'fr', 'st', 'VD', 'kWo', 'xee', 'xn', '_f', 'CWo', 'IWo', '_Wo', 'wWo', 'hI',
      `${helper}${quc}${body}; return EWo;`)(env.LE, env.Ez, ng, () => ({ contests: { c: { type: 'chamber', targetOrganId: 'chamber:a', nextDay } } }), (x, d = 0) => x ?? d,
      () => ({ id: 'a', termYears: 5 }), () => false, () => ({ status: 'in_office' }), () => 1, 0, 365, 180, 90, x => Math.round((x.termYears || 5) * 12));
    return f;
  };
  const country = { pol: {}, brain: {} };
  // An AI elected four years before the start, next election in a year: the game blocks it at day 10, the patch does not.
  const nextDay = 365, day = 10;
  check(mk(original, nextDay)({ day }, country).reason === 'recent_mandate', 'P16 original: elected long ago, day 10, refused as a recent mandate (the bug)');
  check(mk(patched, nextDay)({ day }, country).reason === 'passes', 'P16 patched: elected long ago, day 10, not a recent mandate');
  check(mk(patched, 100)({ day }, country).reason === 'term_ending', 'P16 patched: next election in 90 days, the end-of-term rule applies');
  check(mk(original, 100)({ day }, country).reason === 'recent_mandate', 'P16 original: the same case read as a recent mandate');
  // Elected 100 days before the start, next election far off: still a recent mandate.
  const fresh = 60 * 30.4375 - 100;
  check(mk(patched, Math.round(fresh))({ day }, country).reason === 'recent_mandate', 'P16 patched: really elected last spring, still a recent mandate');
  for (const [next, d] of [[3900, 2000], [2200, 2000], [3700, 2000], [3700, 3650]]) {
    const a = mk(patched, next)({ day: d }, country).reason, b = mk(original, next)({ day: d }, country).reason;
    check(a === b, `P16: last election inside the game (next ${next}, day ${d}), same answer as the game`, `${a} ${b}`);
  }
}

// G6: the game's own reader and the writer's clamp.
{
  const nC = (A, B, Q) => Math.max(B, Math.min(Q, A)), wC = (A, B = 0) => (Number.isFinite(A) ? A : B);
  const IeQ = text => new Function('Po', 'yo', `${between(text, 'function U1a(e){', '}')}; return U1a;`)(nC, wC);
  const s = v => ({ administration: { outcomes: { socialDeliveryRatio: v } } });
  check(IeQ(patched)(s(1.3)) === 1.05 && IeQ(original)(s(1.3)) === 1.3, 'G6: a stored 1.3 now reads 1.05');
  check(IeQ(patched)(s(1)) === 1, 'G6: day 0, ratio 1 unchanged');
  check(IeQ(patched)(s(0.1)) === 0.4, 'G6: the lower bound stays .4');
  check(IeQ(patched)({}) === 1, 'G6: no data reads 1');
  check(patched.includes('socialDeliveryRatio:Po(hd(c,t.baselines.socialCorrect),.4,1.05)'), 'G6: the writer is capped too');
  const others = /Po\(yo\(t\.outcomes\?\.socialDeliveryRatio,1\)\*Math\.pow\(a,\.28\),\.35,1\.3\)/;
  check(others.test(patched), 'G6: the aid term with its integrity factor keeps its own bound');
}

// L5: the game's own group table.
{
  const table = text => {
    const i = text.indexOf('{id:"marg",incBase:.35'), j = text.lastIndexOf('groups:[', i), k = text.indexOf('}}]}', i);
    return new Function(`return [${text.slice(j + 8, k + 2)}]`)();
  };
  const P = table(patched), V = table(original);
  check(P.length === V.length && P.length === 17, 'L5: seventeen groups', String(P.length));
  const hp = Object.fromEntries(P.map(g => [g.id, g.sat.health]));
  check(hp.retr === 0.5 && hp.soig === 0.4, 'L5: retirees and health workers keep their weights');
  check(P.filter(g => !['retr', 'soig'].includes(g.id)).every(g => g.sat.health === 0.25), 'L5: every other group has .25');
  const strip = g => { const c = JSON.parse(JSON.stringify(g)); if (!['retr', 'soig'].includes(g.id)) delete c.sat.health; return JSON.stringify(c); };
  check(P.every((g, i) => strip(g) === JSON.stringify(V[i])), 'L5: nothing else in the table moved');
  check(P.find(g => g.id === 'fonc').sat.publicJob === 0.6 && P.find(g => g.id === 'marg').sat.housing === 0.4, 'L5: other weights stay');
  // The term in satisfaction: the game's delta is clamped to +/-14, so .25 gives at most 3.5 points.
  check(patched.includes('A.satisfactionDelta=ame((A.experience0-A.experience)*42,-14,14)'), 'L5: the health delta is still clamped to 14');
  check(patched.includes('U=(C.health||0)*Nxa(e,M.id)'), 'L5: the weight is still applied once, to that delta');
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
