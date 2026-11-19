// Builds every mod in mods/ for a headless run with the mod loader's own build, and checks that the bundles under
// comparison come from the same extraction the mods were built from (else a modded-vs-unmodded run would measure the
// build difference). Returns the worker data for the simulation worker and the loaded mods, for labelling results.
import { resolve, join } from 'node:path';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { instrumentedSim } from '../coverage.mjs';
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
  // Test runs only: GEOBAL_COVERAGE=<folder> runs the instrumented build (headless/coverage.mjs); bootstrap.mjs writes
  // the counters there and headless/coverage-merge.mjs reports them.
  const out = process.env.GEOBAL_COVERAGE;
  if (out) {
    const cov = instrumentedSim(loadMods(MODS_DIR), build);
    mkdirSync(out, { recursive: true });
    // Written only when missing or different, so several scripts can share one folder (coverage-merge.mjs rejects hit
    // files older than points.json, i.e. left from a different edit list).
    const pts = JSON.stringify(cov.points), pf = join(out, 'points.json');
    if (!existsSync(pf) || readFileSync(pf, 'utf8') !== pts) writeFileSync(pf, pts);
    return { sourceText: cov.sourceText, overrides, loaded: built.get(SIM).loaded };
  }
  return { sourceText: built.get(SIM).text, overrides, loaded: built.get(SIM).loaded };
}
