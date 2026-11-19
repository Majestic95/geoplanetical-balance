// Wording mod test: built with the loader's own rules, on the game's real interface bundle. Each changed entry reads the new
// text in both languages, placeholders survive, and nothing else in the bundle moved.
// Usage: node mods/geoplanetical-balance-wording/tests/wording.test.mjs
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const APP = 'app.bundle.js', SIM = 'simulation-worker.bundle.js';
const original = readFileSync(bundlePath(build, APP), 'utf8');
const mods = loadMods(MODS_DIR);
const wording = mods.find(m => m.id === 'geoplanetical-balance-wording');
const built = buildAll(build, mods);
const patched = built.get(APP).text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const read = s => new Function(`return "${s}"`)();
const braces = s => (s.match(/\{[^{}]*\}/g) || []).sort().join();

check(wording?.format === 3, 'the wording mod is format 3');
check(wording?.requires?.includes('geoplanetical-balance'), 'it requires the balance mod');
const balance = mods.find(m => m.id === 'geoplanetical-balance');
check((balance?.format ?? 1) < 3 && balance.patches.every(p => p.bundle !== APP), 'the balance mod stays below format 3 and has no page patch');
check(wording.patches.every(p => p.bundle === APP), 'every wording patch is on the interface bundle');
check(built.has(SIM) && built.get(SIM).text !== readFileSync(bundlePath(build, SIM), 'utf8'), 'the simulation bundle still builds with the balance patches');

const edits = wording.patches.flatMap(p => p.edits.map(e => ({ ...e, id: p.id })));
check(edits.length === 20, 'ten entries, two languages each', String(edits.length));
let restored = patched;
for (const e of edits) {
  check(patched.split(e.replace).length === 2, `${e.id}: new text appears once`, e.replace.slice(0, 40));
  check(!patched.includes(e.find), `${e.id}: old text is gone`);
  const body = t => t.slice(t.indexOf(':"') + 2, -1);
  const oldT = read(body(e.find)), newT = read(body(e.replace));
  check(braces(oldT) === braces(newT), `${e.id}: placeholders kept`);
  check(!/[<"]|\$\{|&#|&\w+;/.test(newT), `${e.id}: no markup or quote`);
  check(newT !== oldT && newT.length > 5 && newT.length < 400, `${e.id}: a real change of sensible length`, `${newT.length} characters`);
  restored = restored.replace(e.replace, () => e.find);
}
// The loader wraps every bundle it serves with its own marker, so the original sits inside.
check(restored.includes(original) && restored.length - original.length < 1000, 'undoing the edits gives back the original bundle, plus only the loader\'s marker', `${restored.length - original.length} characters`);
for (const p of wording.patches) check(p.edits.length === 2 && p.edits[0].find.split(':"')[0] === p.edits[1].find.split(':"')[0], `${p.id}: one key, two languages`);
const said = k => { const pat = `"${k}":"`; const a = patched.indexOf(pat), b = patched.indexOf(pat, a + 1); const end = i => { let e = i + pat.length; while (patched[e] !== '"' || patched[e - 1] === '\\') e++; return read(patched.slice(i + pat.length, e)); }; return [end(a), end(b)]; };
check(said('enr.moon.note')[1].includes('Outposts') && said('enr.moon.note')[0].includes('Implantations'), 'X8: names the same screen as the game\'s own resource text');
check(said('food.suppliers.none')[1].includes('Grown at home') && said('food.suppliers.none')[0].includes('Produit lui-même'), 'SC14: points to the game\'s own label');

console.log(failures ? `${failures} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
