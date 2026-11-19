// UI4 and UI5 wording test: the security verdict says it compares with the country's start, and the cleared-cases label
// says it includes protest arrests. Built with the loader's own rules on the game's real interface bundle (the loader
// refuses an app.bundle.js edit outside a text entry, so a pass also shows the edits are text-only). Checks each new
// entry appears once in English and French, the old text is gone, nothing else in the bundle moved, and the panel code
// still reads the same keys.
// Usage: node mods/geoplanetical-balance-wording/tests/ui4-ui5.test.mjs (from the repo root)
import { readFileSync } from 'node:fs';
import { workspaceBuild as pinnedBuild, buildAll, bundlePath, MODS_DIR } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';

const build = pinnedBuild();
const APP = 'app.bundle.js';
const original = readFileSync(bundlePath(build, APP), 'utf8');
const mods = loadMods(MODS_DIR);
const wording = mods.find(m => m.id === 'geoplanetical-balance-wording');
const patched = buildAll(build, mods).get(APP).text;
let failures = 0, checks = 0;
const check = (ok, what, detail = '') => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`); if (!ok) failures++; };
const read = s => new Function(`return "${s}"`)();

const ids = ['ui4-security-verdict', 'ui4-security-verdict-help', 'ui5-cleared-with-arrests'];
const mine = wording.patches.filter(p => ids.includes(p.id));
check(mine.length === 3, 'the three patches are in the wording mod', mine.map(p => p.id).join(','));
const want = {
  'security.verdict.balanced': ['No stage much busier than at the start', 'Aucun maillon nettement plus charg\xE9 qu\'au d\xE9part'],
  'security.verdict.balanced.help': ['No stage of the chain carries much more work than at the start of the game. The alerts below use fixed limits and can still appear.',
    'Aucun maillon de la cha\xEEne n\'est nettement plus charg\xE9 qu\'au d\xE9but de la partie. Les alertes ci-dessous suivent des seuils fixes et peuvent tout de m\xEAme appara\xEEtre.'],
  'security.police.cleared': ['Cases cleared this month (incl. protest arrests)', 'Affaires \xE9lucid\xE9es ce mois (dont interpellations)'],
};
const entries = text => [...text.matchAll(/"(security\.(?:verdict\.balanced(?:\.help)?|police\.cleared))":"((?:[^"\\]|\\.)*)"/g)].map(m => [m[1], read(m[2])]);
const got = entries(patched), was = entries(original);
for (const [key, [en, fr]] of Object.entries(want)) {
  const vals = got.filter(([k]) => k === key).map(([, v]) => v);
  check(vals.length === 2, `${key}: two entries (EN and FR)`, String(vals.length));
  check(vals.includes(en), `${key}: English text`, vals.join(' | '));
  check(vals.includes(fr), `${key}: French text`);
  check(!was.filter(([k]) => k === key).some(([, v]) => vals.includes(v)), `${key}: old text gone`);
}
for (const p of mine) for (const e of p.edits) {
  const t = read(e.replace.slice(e.replace.indexOf(':"') + 2, -1));
  check(!/[<"]|\$\{|&#|&\w+;/.test(t), `${p.id}: no markup or quote`, t.slice(0, 40));
}
// Nothing else moved: undo exactly these edits and the wording mod's others, then compare.
let restored = patched;
for (const p of wording.patches) for (const e of p.edits) restored = restored.replace(e.replace, () => e.find);
check(restored.includes(original), 'undoing the wording edits gives back the original bundle');
// The panel still reads the same keys (no code change).
for (const k of ['o("security.verdict.balanced")', 'o("security.verdict.balanced.help")', 'q2(r.crime.clearedLastMonthPer100k)'])
  check(patched.includes(k) && original.includes(k), `panel code unchanged: ${k}`);

console.log(failures ? `${failures} of ${checks} checks failed` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
