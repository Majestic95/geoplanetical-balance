// Fix-coverage counter for headless test runs (never shipped: the loader builds players' bundles from the patches, not
// from this). Instruments a built simulation text so each patch edit counts when its code runs:
//   - an edit that defines mod helpers (function __geobal*) counts at the start of each helper's body;
//   - otherwise, the smallest expression holding the whole edit, in a position where wrapping keeps its value and
//     `this`, becomes (globalThis.__geobalHits[i]++,EXPR);
//   - otherwise a counting statement goes in front of the first statement the edit touches.
// The array is written, never read, by the game. Read it back with the worker message {type:'__geobalHits'}
// (headless/prototype/bootstrap.mjs).
import { readFileSync } from 'node:fs';
import { buildBundle } from 'geoplanetical-modloader/patcher/patch-engine.mjs';
import { bundlePath } from 'geoplanetical-modloader/patcher/build.mjs';
import { parse, editRanges } from '../tools/scope.mjs';

const STATEMENT_LISTS = new Set(['Program', 'BlockStatement', 'StaticBlock']);
// Parent/child positions where `(count, EXPR)` would change meaning or not parse.
function unsafeSlot(parent, key, node, grand) {
  if (!parent) return true;
  const t = parent.type;
  if (t === 'MethodDefinition' || t === 'BreakStatement' || t === 'ContinueStatement') return true;
  if (t === 'TaggedTemplateExpression') return true; // tag or quasi: either wrap changes the call
  if (t === 'Property' && grand?.type === 'ObjectPattern') return true; // a destructuring target
  if (t === 'AssignmentExpression' && key === 'left') return true;
  if (t === 'AssignmentPattern' && key === 'left') return true;
  if (t === 'UpdateExpression') return true;
  if (t === 'UnaryExpression' && (parent.operator === 'delete' || parent.operator === 'typeof')) return true;
  if ((t === 'ForInStatement' || t === 'ForOfStatement') && key === 'left') return true;
  if (t === 'VariableDeclarator' && key === 'id') return true;
  if ((t === 'Property' || t === 'PropertyDefinition' || t === 'MethodDefinition') && key !== 'value') return true;
  if (t === 'Property' && (parent.shorthand || parent.kind !== 'init' || parent.method)) return true;
  if (t === 'MemberExpression' && key === 'property' && !parent.computed) return true;
  if ((t === 'CallExpression' || t === 'NewExpression') && key === 'callee' && (node.type === 'MemberExpression' || node.type === 'ChainExpression')) return true;
  if (t === 'TaggedTemplateExpression' && key === 'tag') return true;
  if (t === 'ExportSpecifier' || t === 'ImportSpecifier' || t === 'LabeledStatement' || t === 'RestElement') return true;
  if (/Pattern$/.test(t)) return true;
  // Binding names: function and class names, parameters, catch parameters.
  if (node.type === 'Identifier' && (/Function|Class/.test(t) && (key === 'id' || key === 'params') || t === 'CatchClause')) return true;
  // An anonymous function or class takes its name from where it is assigned; a wrapper would drop that name.
  if (/^(FunctionExpression|ArrowFunctionExpression|ClassExpression)$/.test(node.type) && !node.id &&
    ((t === 'VariableDeclarator' && key === 'init') || (t === 'AssignmentExpression' && key === 'right') ||
     (t === 'AssignmentPattern' && key === 'right') || ((t === 'Property' || t === 'PropertyDefinition') && key === 'value'))) return true;
  return false;
}
const isExpression = n => /Expression$|^Literal$|^Identifier$|^TemplateLiteral$/.test(n.type) && n.type !== 'ExpressionStatement';

// Finds, for range [s,e), the chain of nodes containing it (outermost first) with each node's parent and key.
function containing(ast, s, e) {
  const chain = [];
  let node = ast, parent = null, key = null, guard = 0;
  for (;;) {
    chain.push({ node, parent, key });
    let next = null;
    for (const k of Object.keys(node)) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      const v = node[k];
      const kids = Array.isArray(v) ? v : [v];
      for (const c of kids) if (c && typeof c.type === 'string' && c.start <= s && c.end >= e) { next = { node: c, parent: node, key: k }; break; }
      if (next) break;
    }
    if (!next || ++guard > 10000) return chain;
    ({ node, parent, key } = next);
  }
}
// Helper function declarations lying wholly inside [s,e).
function helpersIn(ast, s, e) {
  const out = [];
  const visit = n => {
    if (!n || typeof n.type !== 'string' || n.end <= s || n.start >= e) return;
    if ((n.type === 'FunctionDeclaration') && n.id?.name?.startsWith('__geobal') && n.start >= s && n.end <= e) { out.push(n); return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v.type === 'string') visit(v); }
  };
  visit(ast);
  return out;
}

// Returns { text, points: [{ id, kind }] } with one counter per range (index = position in `ranges`).
export function instrument(text, ranges) {
  const ast = parse(text);
  const inserts = []; // { at, str }
  const points = ranges.map((r, i) => {
    const counter = `globalThis.__geobalHits[${i}]++`;
    const helpers = helpersIn(ast, r.s, r.e);
    if (helpers.length) {
      for (const h of helpers) {
        // After any directive ("use strict"), which must stay first in the body.
        const dirs = h.body.body.filter((st, k, all) => st.directive !== undefined && all.slice(0, k).every(x => x.directive !== undefined));
        inserts.push({ at: dirs.length ? dirs[dirs.length - 1].end : h.body.start + 1, str: `;${counter};`, rank: 1 });
      }
      return { id: r.id, kind: 'helper' };
    }
    const chain = containing(ast, r.s, r.e);
    for (let j = chain.length - 1; j >= 0; j--) {
      const { node, parent, key } = chain[j];
      if (/Function/.test(node.type) && j < chain.length - 1) break; // do not count a whole function for a piece of it
      if (isExpression(node) && !unsafeSlot(parent, key, node, chain[j - 2]?.node)) {
        if (chain.slice(0, j).some(c => c.node.type === 'ChainExpression')) continue; // inside an optional chain
        // At the very start of a statement in a statement list, a leading ';' keeps a '(' from joining the line before.
        const lead = chain.slice(0, j).some((c, q) => c.node.start === node.start && /Statement$|Declaration$/.test(c.node.type) &&
          chain[q - 1] && (STATEMENT_LISTS.has(chain[q - 1].node.type) || chain[q - 1].node.type === 'SwitchCase')) ? ';' : '';
        inserts.push({ at: node.start, str: `${lead}(${counter},`, rank: 0 }, { at: node.end, str: ')', rank: 2 });
        return { id: r.id, kind: 'expression' };
      }
      if (STATEMENT_LISTS.has(node.type) || (node.type === 'SwitchCase')) {
        const list = node.type === 'SwitchCase' ? node.consequent : node.body;
        const first = list.find(st => st.end > r.s);
        if (first && first.type !== 'FunctionDeclaration' && first.directive === undefined) { inserts.push({ at: first.start, str: `;${counter};`, rank: 1 }); return { id: r.id, kind: 'statement' }; }
        break;
      }
    }
    return { id: r.id, kind: 'none' };
  }).map((p, i) => (ranges[i].overlapped ? { ...p, kind: `${p.kind}, approximate (partly overlapped edit)` } : p));
  // From the end backwards; at one position, inserting '(' then a statement then ')' leaves them as ') stmt (' in the text.
  inserts.sort((a, b) => b.at - a.at || a.rank - b.rank);
  // Nested wrappers opening at one position: only the one that ends up first in the text (the last processed) keeps
  // the leading ';' it may carry; inside an expression a ';' would not parse.
  const opensAt = new Map();
  for (const x of inserts) if (x.rank === 0) opensAt.set(x.at, [...(opensAt.get(x.at) || []), x]);
  for (const group of opensAt.values()) {
    const lead = group.some(x => x.str.startsWith(';'));
    group.forEach((x, k) => { x.str = (lead && k === group.length - 1 ? ';' : '') + x.str.replace(/^;/, ''); });
  }
  let out = text;
  for (const x of inserts) out = out.slice(0, x.at) + x.str + out.slice(x.at);
  return { text: `globalThis.__geobalHits=new Array(${ranges.length}).fill(0);\n${out}`, points };
}

// Builds `mods` for the simulation bundle and instruments it: { sourceText, points }.
export function instrumentedSim(mods, build, bundle = 'simulation-worker.bundle.js') {
  const original = readFileSync(bundlePath(build, bundle), 'utf8');
  const r = buildBundle(original, mods, { build, bundle });
  const byKey = new Map(mods.flatMap(m => m.patches.filter(p => p.bundle === bundle).flatMap(p => p.edits.map((e, k) => [`${p.id}#${k + 1}`, e]))));
  const edits = r.report.map(x => ({ id: `${x.patch}#${x.edit + 1}`, ...byKey.get(`${x.patch}#${x.edit + 1}`) }));
  const { text, points } = instrument(r.text, editRanges(r.text, original, r.report, edits));
  return { sourceText: text, points };
}

// A short report: how many edits ran, and which never did, grouped by patch.
// Counter kinds: 'expression' counts each evaluation of the smallest safe expression holding the edit (an edit inside a
// short-circuit or ternary operand counts when that expression runs); 'statement' counts the statement holding it;
// 'helper' counts entries into the edit's own helpers only (game code the same edit rewrites is not counted
// separately); 'none' has no counter (edits to function headers).
export function coverageReport(points, hits) {
  if (!hits) return 'coverage: no counters came back';
  const never = points.map((p, i) => ({ ...p, n: hits[i] })).filter(p => !p.n);
  const byPatch = new Map();
  for (const p of never) { const [patch, edit] = p.id.split('#'); byPatch.set(patch, [...(byPatch.get(patch) || []), edit + (p.kind === 'none' ? '(no counter)' : '')]); }
  return `coverage: ${points.length - never.length} of ${points.length} edits ran` +
    (never.length ? `; never ran: ${[...byPatch].map(([p, e]) => `${p} ${e.join(',')}`).join('; ')}` : '');
}
