// Builds every mod in mods/ for a headless run with the mod loader's own build, and checks that the bundles under
// comparison come from the same extraction the mods were built from (else a modded-vs-unmodded run would measure the
// build difference). Returns the worker data for the simulation worker and the loaded mods, for labelling results.
import { resolve } from 'node:path';
import { buildAll, workspaceBuild as pinnedBuild, MODS_DIR, WORKSPACE as ROOT } from 'geoplanetical-modloader/patcher/build.mjs';
import { loadMods } from 'geoplanetical-modloader/patcher/mods.mjs';
import { SIM } from 'geoplanetical-modloader/patcher/session.mjs';

export function moddedWorkerData(appDir) {
  const build = pinnedBuild();
  const expected = resolve(ROOT, '.modding', 'decompiled', `app-${build}`);
  if (resolve(appDir) !== expected) throw new Error(`appDir ${appDir} is not the pinned build's extraction ${expected}`);
  const built = buildAll(build, loadMods(MODS_DIR));
  if (!built.has(SIM)) throw new Error('no mod patches the simulation worker');
  const overrides = Object.fromEntries([...built].filter(([b]) => b !== SIM).map(([b, r]) => [b, r.text]));
  return { sourceText: built.get(SIM).text, overrides, loaded: built.get(SIM).loaded };
}
