// Unit test for headless/coverage.mjs on small synthetic programs (no game code): instrumented code returns the same
// values with the same `this`, and each edit's counter counts the times its code ran. Also instruments the real built
// mod and checks it still parses and how many edits got a counter. Usage (repo root):
//   node --max-old-space-size=8000 headless/coverage.test.mjs
import vm from 'node:vm';
import { instrument, instrumentedSim } from './coverage.mjs';
import { parse } from '../tools/scope.mjs';
import { workspaceBuild, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
// Marks the edits in a source written with ⟦ ⟧ around each edit's text; returns the clean text and ranges.
const mark = src => {
  const ranges = []; let text = '', i = 0, open = [];
  for (const ch of src) {
    if (ch === '⟦') { open.push(text.length); continue; }
    if (ch === '⟧') { ranges.push({ id: `e${++i}`, s: open.pop(), e: text.length }); continue; }
    text += ch;
  }
  return { text, ranges: ranges.sort((a, b) => a.s - b.s) };
};
const runBoth = (src, expr) => {
  const { text, ranges } = mark(src);
  const plain = vm.runInNewContext(`${text};${expr}`, {});
  const inst = instrument(text, ranges);
  const ctx = {}; ctx.globalThis = ctx;
  const value = vm.runInNewContext(`${inst.text};${expr}`, ctx);
  return { plain, value, hits: Array.from(ctx.__geobalHits || []), points: inst.points, ranges };
};

// 1. Expression edits: value kept, counts per evaluation, untaken branch not counted.
{
  const r = runBoth('function f(x){return x>0?⟦x*2+1⟧:⟦-x⟧}var out=[f(3),f(4),f(-1)]', 'JSON.stringify(out)');
  check(r.value === r.plain, 'conditional branches: same values', r.value);
  check(r.points.every(p => p.kind === 'expression'), 'both edits counted as expressions', r.points.map(p => p.kind).join());
  check(r.hits[0] === 2 && r.hits[1] === 1, 'each branch counts only when taken', r.hits.join());
}
// 2. `this` kept: an edit that is a method call; and a callee member is never wrapped alone.
{
  const r = runBoth('var o={v:7,m(){return this.v}};function g(){return ⟦o.m()⟧+⟦o.m⟧.call(o)}var out=g()', 'out');
  check(r.value === r.plain && r.value === 14, 'method calls keep this', String(r.value));
  check(r.hits[0] === 1 && r.hits[1] === 1, 'both counted once', r.hits.join());
}
// 3. Statement edit inside a function, never-run edit, and a loop.
{
  const r = runBoth('var n=0;function h(k){for(let i=0;i<k;i++){⟦n+=i;⟧}return n}function never(){⟦n=-1;⟧}var out=h(4)', 'out');
  check(r.value === r.plain && r.value === 6, 'loop statement keeps its effect', String(r.value));
  check(r.hits[0] === 4 && r.hits[1] === 0, 'loop counted per pass, never-called edit 0', r.hits.join());
}
// 4. Helper definitions count at each call; assignment targets and shorthand properties are not wrapped.
{
  const r = runBoth('⟦function __geobalAdd(a,b){return a+b}⟧var x={y:1};function p(){⟦x.y=__geobalAdd(x.y,2)⟧;let y=x.y;return {y}}var out=JSON.stringify([p(),p()])', 'out');
  check(r.value === r.plain, 'helpers and assignments keep values', r.value);
  check(r.points[0].kind === 'helper' && r.hits[0] === 2, 'helper counted per call', `${r.points[0].kind} ${r.hits[0]}`);
  check(r.hits[1] === 2, 'assignment edit counted per call', String(r.hits[1]));
}
// 5. Optional chains are not split.
{
  const r = runBoth('var q=null,w={a:{b:5}};function z(o){return ⟦o?.a⟧?.b??-1}var out=[z(q),z(w)].join()', 'out');
  check(r.value === r.plain && r.value === '-1,5', 'optional chain short-circuits as before', r.value);
}
// Review regressions (code review, 2026-11-09): each must keep values and parse.
{
  const cases = [
    ['a parameter name', 'function f(⟦x⟧){return x+1}var out=f(1)', 'out'],
    ['a catch parameter', 'var out;try{throw 3}catch(⟦e⟧){out=e}', 'out'],
    ['a break label', 'var out=0;a:for(;;){out++;break ⟦a⟧}', 'out'],
    ['a destructuring target', 'var {p:⟦q⟧}={p:4};var out=q', 'out'],
    ['a tagged template quasi', 'function t(s){return s[0]}var out=t⟦`x`⟧', 'out'],
    ['an anonymous function name', 'var f=⟦function(){}⟧;var out=f.name', 'out'],
    ['an ASI boundary before a wrapped statement', 'var n=0;function f(){n++;return ()=>n+=10}f()\n⟦n++⟧;var out=n', 'out'],
    ['a strict helper', '⟦function __geobalS(){"use strict";return this===undefined}⟧var out=__geobalS()', 'out'],
    ['nested wrappers at one position', 'var a=1,b=2;function g(){return 0}g()\n⟦⟦a⟧+b⟧;var out=a+b', 'out'],
  ];
  for (const [what, src, expr] of cases) {
    let r, err = null;
    try { r = runBoth(src, expr); } catch (e) { err = e.message; }
    check(!err && r.value === r.plain, `${what}: same value`, err || `${r.plain} -> ${r.value}`);
  }
}
// 6. The real mod: instrumented bundle parses, and how many edits have a counter.
{
  const mods = loadMods(MODS_DIR, { only: ['geoplanetical-balance'] });
  const { sourceText, points } = instrumentedSim(mods, workspaceBuild());
  let parsed = true; try { parse(sourceText); } catch (e) { parsed = false; console.log(e.message); }
  check(parsed, 'the instrumented real mod parses');
  const none = points.filter(p => p.kind === 'none');
  const kinds = ['expression', 'statement', 'helper', 'none'].map(k => `${k} ${points.filter(p => p.kind === k).length}`).join(', ');
  check(none.length <= points.length * 0.1, 'at least 90% of edits have a counter', `${kinds}; none: ${none.map(p => p.id).join(' ')}`);
}
console.log(`${failures ? 'FAIL' : 'PASS'}: ${checks - failures} of ${checks} checks`);
process.exit(failures ? 1 : 0);
