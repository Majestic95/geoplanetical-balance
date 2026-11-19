# Headless simulation: running the game's simulation worker in Node

Investigated 2026-10-29 on build 26296134 (goal: test without the game open). Prototype in
`headless/prototype/`. Everything below was run, not inferred, unless tagged otherwise.

## Result
The unmodified `simulation-worker.bundle.js` runs in Node 24 inside a worker thread, with no game, no rendering
and no Steam. It boots a new game, advances days, serves views, saves and reloads. [measured]

| Check | Result |
|---|---|
| Boot a new game (Switzerland, seed 12345) | 24-26 s [measured] |
| Day-0 figures vs the real game | match: GDP $969.9 bn ("$970 bn"), growth 1.39, inflation 0.3, unemployment 4.34, debt 38.0, approval 56, stability 92 [measured] |
| Determinism | two runs, same seed, 365 days: identical 200.9 MB state, same SHA-256 [measured] |
| Speed | about 42 s per in-game month (the month-end settlement dominates), about 8.5 min per year; two runs in parallel cost little extra (37-52 s per month each) [measured] |
| Memory | about 3.7 GB per run; the worker starts a pool of 6 world-market threads [measured] |
| Save then reload, vs straight run (61 days) | **[Corrected 2026-10-31, build 26335289: no longer holds. All 8 parts differ, unmodded too (about 1e-6 relative, tourism settlement rows and epidemic state among the largest groups; economy review T18), so the save check now compares the size of the divergence with and without the mod instead of expecting identity.]** On 26296134: 7 of 8 state parts identical; `finance` differs in 31 numbers, all one reporting ratio (`revenueGdpPct`), last 1-2 significant digits [measured] |

Speed is close to the game's own fast speed (about 25 s for the first month, month-end not timed), so headless does
not make long runs fast. Its value: no game needed, runs unattended, exact full-state comparison, repeatable seeds.

## How it works (prototype `headless/prototype/`)
- `bootstrap.mjs`: runs one game worker bundle in a Node worker thread under `vm.runInThisContext`, after defining
  what a Web Worker has and Node lacks: `self`, `postMessage`/`onmessage` bridged to the thread port,
  `location.href` (the bundle's file URL), `fetch` for `file:` URLs, and a `Worker` class on worker threads (the
  simulation starts 6 `world-market-worker` threads and a `save-codec-worker`). Node 24 already has everything
  else the bundle uses: `structuredClone`, `TextDecoder`, `crypto.subtle`, `Blob`, `DecompressionStream`,
  `Response`, `BigInt`, `Intl.Collator`. The bundle uses no DOM (`window`/`document` occur only as object keys).
- Protocol (`HbQ`, `aHA`): messages `{protocolVersion: 2, type: "request", requestId, sessionEpoch, command,
  payload}`; replies `{type: "response", ok, payload | error}`; events `{type: "event", eventId, payload}`.
  Commands (`U9`): `session.boot`, `clock.pulse`, `clock.setSpeed`, `clock.advanceDays`, `domain.call`,
  `view.snapshot`, `view.subscribe`, `save.snapshot`, `session.shutdown`.
- New game: `session.boot {playerKey, seed}` (country keys are ISO numeric strings, Switzerland `"756"`). The page
  draws the seed from `Math.random` (`Tm`) unless the setup screen's seed field is used (`setup-seed-input`,
  hex `XXXX-XXXX`); headless passes it explicitly.
- Reload: `session.boot {playerKey, savePayload: {formatVersion: 3, meta, parts}}` with every part uncompressed
  (`compression: "identity"`, `rawBytes`). `save.snapshot` returns `{artifact: {parts}, meta}` where each part has
  `source: "raw" | "encoded"` and the codec to apply on write; Electron's main process writes the file and, on
  load, hands the page identity bytes (`electron/save-io.js:36-38`, `:141-171`). The prototype does the same with
  Node's zlib (`zstdDecompressSync`, `inflateSync`).

## Traps
- If `fetch` or `location` is missing, the climate and weather data (`thermal-climate-v1.bin`,
  `thermal-province-map-v1.bin`, `weather-climate-v1.bin`, loaded by `V4C`) silently load as `null` and the run
  diverges from the game with no error. Check a boot loaded them. [read]
- The economic T0 checkpoint (`economic-t0-checkpoint.meta.json` + `.json.gz`) is checked with SHA-256 against a
  build-generation id (`qEB`); it must come from the same build as the bundle. [read]
- Wall clock: the simulation's `Date` uses are calendar arithmetic from the game day (`Date.UTC(2026,0,1)` +
  day); the one real-clock read is `realDate` in the save's metadata, outside the state. `performance.now` is
  profiling only. [read]
- Collation: `Intl.Collator("en")` sorts some keys. Node's ICU and Chromium 148's could order unusual strings
  differently; ASCII keys are safe. Not checked against the game. [inferred]
- Validated against the game (2026-10-29) [measured]: in-game new game, Switzerland, seed `0000-3039`, saved at
  day 32 (`geobal-validate-d32`), decoded with the game's own `electron/save-io.js` (`readSavePayloadFileAsync`, no
  Electron dependency), against a headless run booted with the exact message the page sent (recorded by wrapping
  `Worker.prototype.postMessage`). 6 of 8 state parts byte-identical (all of `finance`, 108 MB). `core` differs only
  in UI clock fields (`sim.speedIdx`, `sim._acc`, `sim._playtimeSec`). `countries` differs in 3 numbers in the last
  binary digit (`forces.aiBudgetAnchor.desireGdpPct` for 300, 364, 031).
- Engine: the game runs V8 with `--no-use-libm-trig-functions` (`electron/main.js:98`) on Electron 42.4.0
  (Chromium 148, V8 14.x); Node 24 ships V8 13.6, which lacks that flag. That explains last-digit maths
  differences [inferred]. For bit-exact runs, use the official Electron 42.4.0 binary in Node mode
  (`ELECTRON_RUN_AS_NODE=1`, downloaded from Electron's releases, not the game's exe, whose RunAsNode fuse is off).
  Modded-vs-unmodded comparisons are unaffected: both sides run on the same engine.
- The page's boot message carries more than the seed: `gameplayRules` (`aiNuclearFirstUse`,
  `newPandemicEmergence`, `naturalDisasters`, `aiWarDeclarations`, `worldBellicosity`), `playerControl.partyId`
  (Switzerland: `"SVP"`) and `viewSubscriptions`. A headless run must send the same to match a game.

## Stress levers
- Developer console (`domain.call executeDevConsoleCommand`; registry `y6B`): `inflation_shock` (-50% to +1000%
  price level), `money`, `set_stability`, `disaster`, `pandemic`, `outbreak`, `dry_earth`, `wet_earth`,
  `world_peace`, `annex_country`, `kill_leader` and others. No interest-rate or debt command; those are player
  actions sent through `domain.call` like the UI. [read]

## Use for testing fixes (no 10-year run per fix; at most one long run per version)
1. Function tests at extreme inputs (seconds).
2. Modded vs unmodded from the same seed, a few months to a year, both in parallel (about 9 min per year): compare
   every country, and flag gaps that widen month on month (compounding) even while small.
3. Monthly invariants (ledger balances, finite numbers, bounded quantities).
4. Stressed starts via the console or player actions instead of waiting years.
5. Save check: straight run vs save-then-reload; anything beyond the known `revenueGdpPct` float noise is a mod
   that loses state on save. **[Since 26335289 the unmodded game diverges on reload too (T18): compare modded and
   unmodded divergence sizes per part (`headless/prototype/jdiff.mjs`) until T18 is fixed.]**
6. One long run per release, unattended.

## Findings from headless experiments
- **H3 confirmed (2026-10-29)** [measured]: seed 12345, page boot message, one 31-day month, plug patched to 0 vs
  unmodified. The plug paid 1,401 bn worldwide that month (annual baseline sum 16,455 bn; US 774 bn, China 88 bn,
  Germany 45 bn, UK 44 bn, India 41 bn). Against the plug-off run it adds +1,403 bn to household deposits and to
  bank deposits, +1,260 bn to bank reserves and central-bank reserves, and +1,370 bn to central-bank
  `monetary-backing`. The plug is paid by central banks creating reserves with no counterparty. Script:
  `headless/prototype/probe.mjs`.
- **Unmodified money growth (2026-10-29)** [measured]: same run, 12 months of 31 days. World central-bank reserves
  12.2 -> 26.0 T (x2.1), central-bank `monetary-backing` 5.5 -> 19.8 T (x3.6), household deposits 89.9 -> 107.2 T
  (+19%), household financial income 5.8 -> 11.9 T a year (x2.0; the day-0 baseline stays 5.8), world nominal GDP
  111.6 -> 117.5 T (+5.3%). The plug's money creation (H3) compounds through interest in the unmodified game; the
  H2 clawback hides it from household income (world plug falls 1,401 -> 1,054 bn a month as it claws back).
- **H2 option D without H3 compounds (2026-10-29)** [measured]: D (plug = Q*g, no netting) vs unmodified, 12 months.
  D's extra plug money grows every month: +0, +48, +97, ... +436 bn a month (+41% over unmodified) by month 12.
  World household deposits gap +0.05% (month 2) -> +2.4% (month 12), financial income +1.0%, world GDP +2.2%,
  accelerating. 883 of 1,272 country-metric series show a gap rising and speeding up; household deposits +11 to
  +14% in 288 Ghana, 180 DR Congo, 072 Botswana, 760 Syria. Approval gaps up to 37 points (Japan) mix this with
  ordinary divergence (elections, events), so per-country approval is not a clean signal. Conclusion: D needs H3.
- **H2 option C (the v0.1 patch) vs unmodified, 12 months (2026-10-29)** [measured]: extra plug money +2 bn a
  month at month 1, +23 bn (+2.2%) at month 12 (D: +436 bn, +41%). World household deposits +0.13% (D: +2.4%),
  financial income +0.28% (D: +1.0%), world GDP +0.57% (noisy). Bounded by design (at most `max(0,w)*g` top-up per
  saver, `|w|*g` per borrower). Still rising slowly: re-check in the release long run. Save then reload with the
  mod: same 31 float-noise numbers as unmodified, nothing else.
- **Gap detector caveat** [measured]: the "rising and speeding up" test flagged 805 of 1,272 series for C, mostly
  approval swings (up to 11 points) and single-country GDP jumps (832 -9%, 792 +6%). The simulation is chaotic: a
  tiny early difference changes elections and AI choices. The detector needs a chaos floor, measured with a null
  patch (a 1e-12 nudge to an unrelated value), before per-country gaps mean anything. Aggregates (world deposits,
  plug, financial income) are the reliable compounding signal.
- **Runner (2026-10-29)** [measured]: `headless/run.mjs`. Early stop projects each world aggregate's gap
  (plug, household deposits, central-bank reserves, world GDP) linearly from the last 3 months to month 12; fail when
  a projection passes its limit (10%, 1%, 2%, 2%) from month 4, pass when all stay under half their limit from month
  6. Replayed on the recorded runs: D fails at month 4, C passes at month 6. Live, cold cache: C passed at month 6 in
  310 s, same monthly figures as the prototype run. Chaos floor (null run, plug x (1+1e-12)): per-country flags fell
  from 805 to 4: 104 Myanmar household deposits +4.2% (floor 0.015%), 242 Fiji deposits +0.96%, 417 Kyrgyzstan GDP
  +0.58%, 760 Syria inflation +0.33 pt. Myanmar is worth a look in the release run (likely H2's saver top-up).
- **Runner rule after review (2026-10-29)** [measured on recorded series]: fail needs a projected gap over its limit
  three months running (one trend window), so a one-time step does not fail a fix; projection is the larger of
  linear and geometric (accelerating gaps); a run that runs out between half the limit and the limit is `review`
  (exit 3); errors exit 2. Replay: C pass at month 6, D fail at month 4, convex 0.01 x 1.6^t fail at month 4, a
  bounded 0.6% step runs out as review. The runner never takes player actions: action-path fixes (T1) need their
  own end-to-end test.
- **Save trap (2026-10-29)** [measured]: the save writes currency objects with a fixed list of 32 fields (even the
  game's own `caPct` is dropped), so new state put on a currency vanishes at save and resets at load. Sovereign
  records (`finance.sovereigns[key]`) keep unknown fields (T1 list, T2 map: both survive save and reload). Every
  fix that stores state needs an end-to-end save/reload test: the function test cannot see this.
