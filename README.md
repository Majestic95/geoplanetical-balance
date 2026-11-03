# Geoplanetical Balance

A mod for [Geoplanetical](https://store.steampowered.com/app/940230/) that corrects parts of the game's economic,
financial, political and public-service models that are inaccurate, exploitable or broken. Each change follows how
the real institution behaves, keeps the game's starting numbers unchanged, and is tested against the unmodded game.

- **Version:** 0.2.0 (playtest)
- **Game build:** 26391432 (Steam). After a game update the mod waits for an updated version.
- **Single player only.** It needs the [Geoplanetical Mod Loader](https://github.com/Majestic95/geoplanetical-modloader), which applies mods to the game's code in
  memory when the game starts; the game's files are never changed.

Not affiliated with the developers of Geoplanetical.

## Installing

1. Download the Geoplanetical Mod Loader and unzip it anywhere.
2. Copy the `mods/geoplanetical-balance` folder from this repository (or from a release) into the loader's `mods`
   folder.
3. Run `GeoplaneticalModLoader.exe`, check that Geoplanetical Balance is switched on, and click **Play with mods**.

A save made with the mod needs the mod to load correctly: load it through the loader with the mod switched on. Start
a new game for testing and save it under a new name, since Steam Cloud syncs saves.

## What it changes

### Economy and business

- The state can no longer order private firms into loss-making investments, and each private firm takes one ordered expansion at a time.
- After the first year, business investment follows firms' own borrowing cost rather than only the government's; in a sovereign debt crisis firms' costs rise almost as much as the government's.
- Privatising a state-owned sector can make it more productive than it was at the start.
- A sector's purchase or sale price never falls below 35% of its capital, so it no longer costs next to nothing when profits are near zero (some low-earning sectors cost more).
- Large unpaid bills are no longer written off just because many small bills are open elsewhere: only trivial amounts are, and larger debts stay owed until paid or two years overdue (a much higher safety limit remains for extreme cases).
- The industrial adviser and AI governments now count orders that go unfilled: a good in short supply at home scores higher, and is no longer called a poor fit for replacing imports when more than 2% of its demand goes unfilled.
- Your public works, industrial projects, power plants and transport works now count against your country's construction capacity: a programme too large for your builders is slowed (up to three times its normal schedule) rather than refused; a coal plant stretched past the coal deadline is still refused. AI power plants are slowed the same way, and AI transport works that would need more than three times their schedule are not started.

### Money, debt and currency

- Your manual foreign-currency borrowing is limited to once a month, with a yearly cap set by your credit rating.
- Foreign-currency borrowing no longer replaces your country's domestic bond rate with the foreign rate.
- Exchange rates drift on changes in a country's trade balance since the start, not on its starting surplus or deficit.
- Private foreign investment fades gradually as a credit rating falls, instead of stopping all at once.
- After the first year, recessions, inflation (sharply above 10%) and high debt lower credit ratings and booms raise them; debt counts from 60% of GDP, or 90% for reserve-currency and currency-union countries; the sudden debt-crisis trigger at 170% of GDP is gone.
- Devaluing your pegged currency now costs monetary credibility, more for each repeat within three years, and you must wait 180 days between devaluations.
- After the government takes control of the central bank, even for a day, its credibility ceiling returns over three years once independence is restored, instead of at once.

### Taxes and energy

- Tax bases change smoothly as income per head grows, instead of jumping at fixed thresholds.
- A growing shadow economy now reduces how much tax is collected.
- Every country's carbon tax base now follows its power-sector emissions, so cleaner power means less carbon revenue.
- Raising the electricity subsidy now lowers industry's production costs, and cutting it raises them; before, firms only gained or lost cash while their costs, prices and output ignored the subsidy.

### Households and population

- Households in debt now feel interest rates: rate rises cost them and rate cuts help them, where the game used to cancel the effect out quietly.
- Birth rates fall with rising income mainly in countries still having large families; in low-fertility countries income barely moves them.

### Government and politics

- Approval reacts more to downturns than to booms (about twice as much in a typical country), within realistic limits, and after the first year elections punish recessions.
- Withdrawing a bill takes back only the part of its announcement boost that is still in effect (the game took back the full boost even weeks later), and the law cannot be proposed again for 30 days.
- A small amendment to a law no longer restores its full effect on approval; voters stay used to it unless the change is large.
- You can no longer call a snap legislative election within a year of the last one or in the final six months of a term, and a caretaker government must wait 60 days, timing rules AI governments already follow.

### War

- War and sabotage damage to power plants must now be paid for by the owner's treasury; unpaid repairs take longer.
- Conquering a whole country now hands its government debt and its unpaid bills to other countries to the conquerors along with its treasury, instead of wiping them out at the creditors' expense.

### Public services

- Clearing a tax office's backlog of returns no longer raises tax collection by up to a quarter for good; a fast tax office now adds under 1%.
- Better tax collection no longer cuts the administration budget.
- When sick people go untreated, the economy now loses working hours, up to about 6% if health care collapses.
- Raising the school leaving age now raises secondary school enrolment as teachers, money and schools allow (about 12% more for 16 to 18; more where compulsory schooling was short).
- With new pandemics switched on, a coronavirus pandemic is now about as deadly as COVID-19 was in 2020.

Each patch file in `mods/geoplanetical-balance/patches/` describes its change in full in its `effect` text.

## Research

The findings behind each change, traced in the game's code with the function and offset each claim was read from
and a confidence tag (read, checked by a second reader, or inferred), are in [research/](research/):
[financial system](research/financial-system-review.md) (D, F, M, B), [economy](research/economy-systems-review.md)
(A, T, E, H, C), [politics](research/politics-review.md) (P), [war](research/war-review.md) (W),
[construction](research/construction-review.md) (K) and [public services](research/public-services-review.md)
(L, S, G, R). Each patch's `finding` field names the row it fixes. Offsets are for the game build each review states;
the game's minified names and offsets change with every update.

## How it is tested

- **Function tests** (`mods/geoplanetical-balance/tests/*.test.mjs`): each change's code, cut from the patched game
  code, checked at extreme inputs against the unmodded code.
- **Headless simulation** (`headless/`): the game's simulation runs without its window, modded and unmodded from the
  same seed, comparing every country month by month and flagging gaps that keep widening; per-change scenarios in
  `tests/*.headless.mjs`. Method and traps: [docs/headless-simulation.md](docs/headless-simulation.md).
- **Save carry-over:** a save is loaded, played, saved and reloaded with the mod, and the mod's state must survive.

## Working on the mod

Requires Windows, Node.js 22.15 or later, Python 3 and the game installed through Steam.

1. Clone this repository and the [mod loader](https://github.com/Majestic95/geoplanetical-modloader) side by side (this repository's `package.json` refers to
   `../geoplanetical-modloader`), then run `npm install` here and `npm ci` in the loader.
2. Extract the game's code for the build in `tools/GAME_BUILD` into `.modding/decompiled/app-<build>/` with the
   loader's `tools/asar_extract.py` (see the loader's `docs/authoring.md`). Extracted game files are never committed.
3. Run the tests from this repository's root, for example
   `node --max-old-space-size=4000 mods/geoplanetical-balance/tests/h2.test.mjs`, or the whole-mod headless
   comparison `node --max-old-space-size=6000 headless/run.mjs`.

The mod format, and how to port the mod to a new game build, are documented in the loader repository.

## License

Dedicated to the public domain under [CC0 1.0 Universal](LICENSE). You may copy, change and distribute it, including
in your own mods, for any purpose, without asking permission or giving credit. This does not cover Geoplanetical
itself or anything taken from it: the short pieces of game code in the patch files belong to the game's developer.
