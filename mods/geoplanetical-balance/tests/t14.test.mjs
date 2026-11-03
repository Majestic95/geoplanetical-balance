// T14 function test: the bond-rate write at the end of the sovereign issue step (Xi), patched vs original, for
// domestic, foreign-currency and bilateral issues at extreme rates; plus a syntax-tree check that the C the patched
// test reads is Xi's sovereign record (g.sovereigns[B.key]) and that Xi marks bonds foreign with the same comparison.
// Minified names are those of build 26318758. Usage: node mods/geoplanetical-balance/tests/t14.test.mjs
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const original = readFileSync(bundlePath(build, 'simulation-worker.bundle.js'), 'utf8');
const patched = buildAll(build, loadMods(MODS_DIR, { only: ['geoplanetical-balance'] })).get('simulation-worker.bundle.js').text;
const xi = text => {
  const a = text.indexOf('function D3('), b = text.indexOf('function _ZB(', a);
  if (a < 0 || b < 0) throw new Error('w3 not found');
  return text.slice(a, b);
};
// The statement between the ledger refresh and the projection at the end of Xi.
const write = text => {
  const f = xi(text), a = f.indexOf('YB(A,B),') + 8, b = f.indexOf(';let a=kr(A,B)', a);
  if (a < 8 || b < 0) throw new Error('bond-rate write not found');
  return new Function('Q', 'B', 'C', `${f.slice(a, b)};return B.bondRate`);
};
const P = write(patched), O = write(original);

let failures = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failures++; console.log(`FAIL ${what}`); } };
const sov = { currencyCode: 'CHF' };
const issue = (currencyCode, clearingRatePct, bilateral) => ({ currencyCode, clearingRatePct, ...(bilateral ? { bilateral: true } : {}) });

for (const rate of [0, 0.01, 4.5, 99, 1e6]) {
  check(P(issue('CHF', rate), { bondRate: 1 }, sov) === rate && O(issue('CHF', rate), { bondRate: 1 }, sov) === rate, `domestic issue at ${rate}%: sets the bond rate in both`);
  check(O(issue('EUR', rate), { bondRate: 1 }, sov) === rate, `original: a EUR issue at ${rate}% overwrites the domestic rate (the bug)`);
  check(P(issue('EUR', rate), { bondRate: 1 }, sov) === 1, `patched: a EUR issue at ${rate}% leaves the domestic rate`);
  check(P(issue('CHF', rate, true), { bondRate: 1 }, sov) === 1 && O(issue('CHF', rate, true), { bondRate: 1 }, sov) === 1, `bilateral loan at ${rate}%: never sets the rate`);
}
check(P(issue('USD', 7), { bondRate: undefined }, sov) === undefined, 'foreign issue with no rate yet: still not written');
check(P(issue(undefined, 7), { bondRate: 2 }, sov) === 2, 'issue without a currency code: treated as foreign, as the game\'s own fx flag would');

// Syntax tree of the patched Xi: exactly one binding named C, its initialiser g.sovereigns[B.key] with g = A.finance.
{
  const ast = parse(xi(patched), { ecmaVersion: 'latest' });
  // Every binding named C anywhere in Xi: declarations (incl. destructuring), parameters of Xi and of nested
  // functions, catch parameters. Xi's own parameters are (A,B,Q), so any second binding would be a shadow.
  const bindings = [];
  const names = (p, owner) => {
    if (!p) return;
    if (p.type === 'Identifier') { if (p.name === 'C') bindings.push(owner || p); }
    else if (p.type === 'ObjectPattern') p.properties.forEach(x => names(x.type === 'RestElement' ? x.argument : x.value));
    else if (p.type === 'ArrayPattern') p.elements.forEach(x => names(x));
    else if (p.type === 'AssignmentPattern') names(p.left);
    else if (p.type === 'RestElement') names(p.argument);
  };
  const walk = n => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'VariableDeclarator') names(n.id, n.id.type === 'Identifier' ? n : null);
    if (/Function/.test(n.type)) n.params.forEach(p => names(p));
    if (n.type === 'CatchClause') names(n.param);
    for (const [k, v] of Object.entries(n)) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v);
    }
  };
  walk(ast);
  const src = b => xi(patched).slice(b.init?.start ?? b.start, b.init?.end ?? b.end);
  check(bindings.length === 1 && src(bindings[0]) === 'g.sovereigns[B.key]', `C is bound once, to the sovereign record: ${bindings.map(src).join(' | ')}`);
  check(/let g=A\.finance,C=g\.sovereigns\[B\.key\]/.test(xi(patched)), 'g is A.finance');
  check(xi(patched).includes('fx:Q.currencyCode!==C.currencyCode') && xi(original).includes('fx:Q.currencyCode!==C.currencyCode'),
    'w3 flags the bond foreign (terms.fx) with the same comparison the fix uses');
}

console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
