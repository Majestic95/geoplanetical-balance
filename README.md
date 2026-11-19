# Geoplanetical Balance

A mod for [Geoplanetical](https://store.steampowered.com/app/940230/) that corrects parts of the game's economic,
financial, political, military and public-service models that are inaccurate, exploitable or broken. Each change
follows how the real institution behaves, keeps the game's starting numbers unchanged, and is tested against the
unmodded game.

This repository holds two mods:

- **Geoplanetical Balance** (`mods/geoplanetical-balance`, version 0.4.0): the simulation changes.
- **Geoplanetical Balance: wording** (`mods/geoplanetical-balance-wording`, version 0.3.0): corrections to the game's
  own English and French text where it misdescribes what the game does. It requires the balance mod.

- **Status:** public playtest. Please report what you see (below).
- **Game version:** 1.1.5 (build 26734764), the version with Mars.
- **Single player only.** Both mods need the [Geoplanetical Mod Loader](https://github.com/Majestic95/geoplanetical-modloader)
  0.9.0 or later, which plays game 1.1.5 from its own frozen copy of the game (Steam updates never break it) and
  applies the mods when the game starts. Your Steam game's files are never changed.

Not affiliated with the developers of Geoplanetical.

## Installing

1. Download the Geoplanetical Mod Loader (0.9.0 or later) and unzip it anywhere.
2. Copy both folders from this repository's `mods` folder (`geoplanetical-balance` and
   `geoplanetical-balance-wording`) into the loader's `mods` folder.
3. Run `GeoplaneticalModLoader.exe`. The first time, it sets up its copy of game 1.1.5 (it explains each step and
   asks first). Check that both mods are switched on, and click **Play**.
4. The loader asks you to confirm the balance mod the first time: it changes the game's simulation, and such a mod's
   code runs with the same access to your PC as any program you install.

The frozen game keeps its own saves, apart from your Steam game's, and Steam Cloud does not back them up. A save made
with the mods needs them to load correctly: load it through the loader with both mods switched on. Saves from game
1.1.0 or earlier are not supported in 1.1.5.

## Playtesting

[playtest/README.txt](playtest/README.txt) is the guide for testers: what to watch for (approval swings, credit
ratings, savings, investment after the first year, war debts, construction, currency reforms, alliances, war crimes,
expulsions) and what to include in a report. Please report problems and impressions on this repository's
[issue tracker](https://github.com/Majestic95/geoplanetical-balance/issues), with the in-game date, the country you
play, the loader's `launcher.log` and, if you can, the save.

## What it changes

### New in this version

- Ported to game 1.1.5.
- Three fixes are dropped because the game now makes them itself: students leaving the labour force when schooling expands (S2), the school leaving age raising enrolment under free schooling (S3), and single road and rail projects, airports, ports and their upgrades paid over their months rather than from cash on hand (K11; the game now does it for every country).

### Economy and business

- The state can no longer order private firms into loss-making investments, and each private firm takes one ordered expansion at a time.
- After the first year, business investment follows firms' own borrowing cost rather than only the government's; in a sovereign debt crisis firms' costs rise almost as much as the government's.
- Privatising a state-owned sector can make it more productive than it was at the start.
- A sector's purchase or sale price never falls below 35% of its capital, so it no longer costs next to nothing when profits are near zero (some low-earning sectors cost more).
- Large unpaid bills are no longer written off just because many small bills are open elsewhere: only trivial amounts are, and larger debts stay owed until paid or two years overdue (a much higher safety limit remains for extreme cases).
- The industrial adviser and AI governments now count orders that go unfilled: a good in short supply at home scores higher, and is no longer called a poor fit for replacing imports when more than 2% of its demand goes unfilled.
- Your public works, industrial projects, power plants and transport works now count against your country's construction capacity: a programme too large for your builders is slowed (up to three times its normal schedule) rather than refused; a coal plant stretched past the coal deadline is still refused. AI power plants are slowed the same way, and AI transport works that would need more than three times their schedule are not started.
- Disasters now cut output by about 40% of the share of capital destroyed, more in industry, energy, mining, utilities and construction (oil fields and mines included) than in farming, services and finance.
- Large volcanic eruptions (VEI 5 to 7) now happen about as often as the historical record shows, including Pinatubo-sized eruptions that cool the climate.

### Money, debt and currency

- Your manual foreign-currency borrowing is limited to once a month, with a yearly cap set by your credit rating.
- Foreign-currency borrowing no longer replaces your country's domestic bond rate with the foreign rate.
- Trade retaliation now lasts as long as the tariff it answers, rather than ending after two years.
- Exchange rates drift on changes in a country's trade balance since the start, not on its starting surplus or deficit.
- Private foreign investment fades gradually as a credit rating falls, instead of stopping all at once.
- After the first year, recessions, inflation (sharply above 10%) and high debt lower credit ratings and booms raise them; debt counts from 60% of GDP, or 90% for reserve-currency and currency-union countries; the sudden debt-crisis trigger at 170% of GDP is gone.
- Devaluing your pegged currency now costs monetary credibility, more for each repeat within three years, and you must wait 180 days between devaluations.
- After the government takes control of the central bank, even for a day, its credibility ceiling returns over three years once independence is restored, instead of at once.
- Prices can no longer slide into endless deflation: expected inflation stops at -5% a year. Before, some countries fell towards -99% a year.
- A ban on investing in a country no longer withholds the dividends its companies are owed; it only stops new share purchases.
- A currency reform now cuts household loans, and their monthly repayments, by the same share as household savings, instead of leaving debts whole and handing the difference to banks.

### Taxes and energy

- Tax bases change smoothly as income per head grows, instead of jumping at fixed thresholds.
- A growing shadow economy now reduces how much tax is collected.
- Every country's carbon tax base now follows its power-sector emissions, so cleaner power means less carbon revenue.
- Raising the electricity subsidy now lowers industry's production costs, and cutting it raises them; before, firms only gained or lost cash while their costs, prices and output ignored the subsidy.
- Iran is exempt from OPEC+ production quotas, as in reality, so cartel cuts fall on the other members (new games).
- Opening the Energy screen no longer changes what a new well costs or where a plant goes; the screen shows each province's power as of the last update, which runs monthly and whenever territory changes hands.
- Taxing legal drugs now cuts legal sales and sends buyers to illegal sellers, as the gambling levy already does; cutting the levy brings them back.

### Households and population

- Richer countries without a state religion now slowly become less religious over the years, as surveys show; before, income had no effect on religious change.
- Households in debt now feel interest rates: rate rises cost them and rate cuts help them, where the game used to cancel the effect out quietly.
- Birth rates fall with rising income mainly in countries still having large families; in low-fertility countries income barely moves them.
- Migrants' spending now moves with them: a country that gains people gains their spending, and one that loses people loses it.
- A rare population-accounting error during migration no longer stops the game; the move is capped at the people actually there.

### Government and politics

- Approval reacts more to downturns than to booms (about twice as much in a typical country), within realistic limits, and after the first year elections punish recessions.
- Withdrawing a bill takes back only the part of its announcement boost that is still in effect (the game took back the full boost even weeks later), and the law cannot be proposed again for 30 days.
- A small amendment to a law no longer restores its full effect on approval; voters stay used to it unless the change is large.
- You can no longer call a snap legislative election within a year of the last one or in the final six months of a term, and a caretaker government must wait 60 days, timing rules AI governments already follow.
- After an election that changes the government, the winning party's top-ranked figure becomes head of government, instead of an arbitrary party member.
- After the first year, an unpopular government loses votes for it, whatever the cause, and a popular one gains some.
- Employers judge a minimum wage against local income, so a small rise in a weak-currency country no longer sets off an investment strike.
- Religion laws now need the majority your constitution sets for amendments, not 60% everywhere.
- Anger over a sovereign default fades over the years, though some remains until the default ends.
- Election campaigns now move a party's vote by a few points rather than by up to two-fifths of its share.
- A peace appeal can now be accepted: a close partner in a long, tiring war may listen.
- A party answers once when you ask for its support on a law; you can no longer ask again through each of its members.
- A country that promised to vote with you at the UN is released if you then vote differently, at no cost to it.
- A territory that wins independence becomes a UN member.
- A territory's anger now follows its own unemployment and civil liberties, not those of the country that governs it.
- A government with no powers left to offer a region can no longer calm a referendum petition with a counter-offer: it must accept or refuse.
- A government with no seats in parliament now pays the full minority penalty, not the smallest one.
- AI governments now judge early elections from the real date of the last election, so the first year of a game no longer blocks them all.
- AI countries can now retaliate in a trade dispute against a partner that sells them services as well as goods; before, the attempt failed silently when it picked only services.
- If your government is left caretaker with a hung parliament within a year of a dissolution (after losing a no-confidence vote, or after a snap election that gives no majority), you can call an election once it has been caretaker for 60 days, as AI countries can, instead of waiting out the year. The date the refusal notice gives can be up to a month early while the 60 days have not started counting (they start at the next monthly review).
- You cannot call a snap presidential election in your mandate's first year or in the six months before the scheduled vote, the same rule as for parliament; the first year counts from when you took office, even if the term is lengthened later.
- Multilateral aid no longer goes to countries the donor is at war with or sanctions; that share goes to other countries in need.
- AI countries accept a defensive alliance at relations of 40 instead of 60. Relations settle near 45 even between close friends, so new AI alliances had stopped forming within a year; closely aligned countries facing a threat can now still sign later in the game.

### War

- War and sabotage damage to power plants must now be paid for by the owner's treasury; unpaid repairs take longer.
- A war's cost in public opinion now depends on your role: attackers pay most, and a country attacked during play gets a rally that fades over months.
- AI countries in active fighting raise defence spending faster, and further when their people are under occupation; the extra effort fades over a long war.
- An insurgency that spreads now costs its country output, after the first year.
- An ally that attacks another ally is no longer attacked by the rest of the alliance; other members stay out, or at most give access, at no cost to their treaty standing. A member that also has its own defence pact with the victim still honours it.
- A state that lacks control of its own defence or foreign policy can no longer declare war on you, as it already could not on other countries; a nuclear strike already launched still starts a war.
- Conquering a whole country now hands its government debt and its unpaid bills to other countries to the conquerors along with its treasury, instead of wiping them out at the creditors' expense.
- The world's leading powers are now worked out from the current economy each day, so opening a screen or reloading a save no longer changes which AI countries may join a war or how they weigh military support.
- Nuclear warheads now do damage by their size and reliability: a first-generation 15-kiloton bomb kills far fewer people than a 300-kiloton thermonuclear warhead, and some warheads fail.
- Beach landings now need real superiority: about 2.5 times the defenders without air control and about 1.4 times with full air superiority, instead of sometimes winning while outnumbered.
- The harshest AI occupiers (unaccountable one-party or military regimes with brutal leaders, under no sanctions coalition, facing open hostility) can expel the occupied population; it remains exceedingly rare.
- In your wars (the only ones where the game resolves individual strikes), sustained strikes on power plants or oil, gas, coal and uranium fields count as a war crime when they leave more than a fifth of the target country's electricity demand unserved beyond where it stood when the strike campaign began; this applies to you, your enemy and either side's allies in that war, and the case goes to the UN like other war crimes.

### Intelligence and space

- An intelligence service can no longer run more agents on missions than it has by moving its branch allocation after launching them.
- A joint operation to dismantle a foreign cell now uses the covert branch, as the same mission does when run alone.
- A lunar site concession that runs past its deadline now hands the site back, as it already did when fulfilled or cancelled.
- Adopted UN Security Council sanctions bind every UN member except the target, not only the Council members that voted for them; your country joins only if you voted yes. Countries bound only because of this rule (every member that did not vote yes) are released when the war behind an aggression resolution ends.
- Refined lunar metal brought back to Earth counts as worth an Earth commodity price (about USD 10 000 a tonne, not USD 80 million) when the AI decides whether a return flight pays; using the metal in module orders keeps the game's value.
- Lunar solar output is capped by latitude: about half of rated power away from the poles, more near them.
- A lunar helium-3 mine now yields about 5.5 kg a month, the output of real mining designs, instead of 40 kg.

### Public services

- Clearing a tax office's backlog of returns no longer raises tax collection by up to a quarter for good; a fast tax office now adds under 1%.
- Better tax collection no longer cuts the administration budget.
- When sick people go untreated, the economy now loses working hours, up to about 6% if health care collapses.
- A small shortage of care no longer nearly doubles the sick-pay bill in a rich country: the bill now follows how much illness goes untreated compared with all illness, and there better access no longer cuts it sharply for free.
- With new pandemics switched on, a coronavirus pandemic is now about as deadly as COVID-19 was in 2020.
- Social benefits can no longer be delivered far above what the budget pays for them (cap 105%).
- Every social group now cares about health care, not only retirees and health workers.

### Game text (wording mod)

- The Moon's power screen says how to build lunar power, instead of that it is coming.
- The prevention panel's budget error no longer mentions wildfire for every hazard.
- Two refusals in correspondence no longer name a wrong reason.
- A country with no food imports is no longer told it grows everything it eats.
- The Rules screen no longer says other countries have the same options as you.
- The research guide no longer describes a priorities setting that does not exist; it says how projects share research capacity.
- The security screen's verdict now says it compares each stage with where it started, so it no longer reads 'under control' beside a court-backlog alert.
- The police panel's cleared-cases count now says it includes protest arrests.

Each patch file in `mods/*/patches/` describes its change in full in its `effect` text and names the finding it fixes
in its `finding` field.

## Research

The findings behind each change, traced in the game's code with the function and offset each claim was read from
and a confidence tag (read, checked by a second reader, or inferred), are in [research/](research/):
[financial system](research/financial-system-review.md) (D, F, M, B), [economy](research/economy-systems-review.md)
(A, T, E, H, C), [politics](research/politics-review.md) (P), [war](research/war-review.md) (W),
[construction](research/construction-review.md) (K) and [public services](research/public-services-review.md)
(L, S, G, R). These files hold the first findings, on earlier game builds; later fixes (diplomacy, combat, space,
migration, climate and others) are documented in their patch's `effect` text. Each patch's `finding` field names the
row it fixes. Offsets are for the game build each review states; the game's minified names and offsets change with
every update.

## How it is tested

- **Function tests** (`mods/geoplanetical-balance/tests/*.test.mjs`): each change's code, cut from the patched game
  code, checked at extreme inputs against the unmodded code.
- **Headless simulation** (`headless/`): the game's simulation runs without its window, modded and unmodded from the
  same seed, comparing every country month by month and flagging gaps that keep widening; per-change scenarios in
  `tests/*.headless.mjs`. Method and traps: [docs/headless-simulation.md](docs/headless-simulation.md).
- **Probes** (`tests/*.probes.mjs`, run by `headless/prototype/probe-edits.mjs`): changes that a plain run never
  reaches are driven through the game's own functions in a booted world; each probe must fail with its change removed.
- **Save and reload:** a run saved and reloaded part-way must end on exactly the same state as a straight run
  (`headless/prototype/run-reload.mjs`).

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
