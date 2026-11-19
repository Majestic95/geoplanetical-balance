GEOPLANETICAL BALANCE - PLAYTEST
================================

(This README ships inside the playtest zip, which bundles the mod loader with the mod.)

Thank you for testing. This mod corrects parts of Geoplanetical's economic, political and public-service
models that are inaccurate, exploitable or broken. It is single player only.

This folder holds the Geoplanetical Mod Loader with two mods already in its mods folder: Geoplanetical
Balance and Geoplanetical Balance: wording (corrected game text). Both are made for game version 1.1.5.


WHAT YOU NEED
-------------
- Windows, Steam, and Geoplanetical bought on Steam.
- About 4 GB of free space for the frozen game (below).


THE FROZEN GAME (SET UP ONCE)
-----------------------------
Steam updates Geoplanetical often, and every update would stop the mod until it is updated. So the loader
plays one version of the game, 1.1.5, from its own copy, which Steam never updates: the frozen game.
Set it up once, in the loader's window, in one of these ways:
- "Copy from your Steam game": possible while your Steam game is version 1.1.5.
- "Download with Steam": the loader opens Steam's console and copies a command; click in the console,
  press Ctrl+V, then Enter. Steam downloads version 1.1.5 (from your own account), and the loader moves
  it into its folder when Steam is done.
- "Copy from a folder...": a copy of version 1.1.5 you already have.
The loader checks the copy before it uses it. If you tested an earlier playtest build, its frozen game
was version 1.1.0 or older: the new copy replaces it, and the old playtest build no longer plays.


HOW TO PLAY
-----------
1. Unzip this folder anywhere (for example your Desktop). Keep the files together.
2. Double-click GeoplaneticalModLoader.exe.
   Windows may warn that the program is from an unknown publisher (it is not code-signed). Choose
   "More info" and then "Run anyway". Some antivirus programs may ask too.
3. The loader opens in its own window. Set up the frozen game if it asks (above). Make sure the switches
   beside both mods are on, then click "Play with mods".
4. The first time, the loader asks you to confirm the Balance mod. It changes the game's simulation
   (economy, politics, war), which runs in a background process of its own, and such a mod's code runs
   with the same access to your PC as any program you install. The loader asks again whenever the mod's
   version or code changes.
5. The game starts (Steam must be running and signed in). You can minimise the loader window while you
   play. If you close it, the loader keeps the mods active in the background and closes itself after you
   quit the game; leave it open to see its end-of-session report. If the window ever shows a red warning
   during play, the mod is not active: quit the game without saving and send us launcher.log.
   "Open log" shows what it did; "Quit" closes it (do not quit while the game is running).

While you play, the mod is written into the frozen game's folder, and the loader puts the game's own
file back when the game closes (or, if the PC or the loader stopped first, the next time the loader
opens). Your Steam game's files are never changed: starting the game from Steam as usual plays the
normal game.


SAVES - PLEASE READ
-------------------
- The frozen game keeps its own saves, apart from your Steam game's. Steam Cloud does NOT back them up:
  "Open its saves" in the loader's window shows where they are, if you want to back them up yourself.
- Start a NEW game for testing and save it under a new name (for example "playtest-1"). Saves from
  earlier playtest builds (game 1.1.0 or older) may not load correctly in 1.1.5; the game warns about that too.
- A save made with the mod needs the mod to load correctly: always load it through the loader with both
  mods switched on.
- Saving, quitting and loading again through the loader should continue the game exactly. If it does
  not, that is a bug we want to hear about.


WHAT THE MOD CHANGES
--------------------
The loader window lists every change, grouped by area: click "What it changes" under the mod.


WHAT TO WATCH FOR
-----------------
These are tuned by judgement, not yet by long play. Please tell us if any of these look wrong over
several in-game years:
- Approval: some countries' approval swings much more than in the unmodded game. Too much? Too little?
- Credit ratings: do they fall sensibly in recessions and wars, or spiral?
- Household savings drifting slowly away from the unmodded game over many years.
- Investment, growth, ratings and elections after the first year (several changes switch on around
  day 365).
- Countries at war: repair bills, debts and ratings together, and the debt and unpaid bills a
  conqueror takes on when it annexes a whole country.
- Construction: large building programmes, including roads, railways, ports and airports, being
  slowed rather than refused.
- Falling prices: the game replaces the currency of a country stuck for a year with falling prices
  and zero interest rates, and wipes out much of its households' savings (with the mod, its household
  loans shrink by the same share). Tell us if that happens to any country, and when.
- Alliances: AI countries now accept a defensive alliance at relations of 40 instead of 60. Do new
  alliances form later in the game, and are there too many or too few? Note which countries sign.
- War crimes: in your wars, sustained strikes that black out a country's electricity now open a
  war-crimes case at the UN. Tell us if a country (or you) is charged when that seems wrong, or never
  charged when it seems deserved.
- Expulsions: the harshest occupying regimes can now expel an occupied population. It should be
  very rare; tell us if you see it, and where.
- Note: the in-game rating breakdown still shows the game's original rating terms.


REPORTING A PROBLEM
-------------------
Report problems on the project's GitHub issue tracker. Please include:
- What happened and what you expected, and roughly which in-game date.
- The country you play.
- The file launcher.log from this folder.
- If you can, the save file.


UPDATING
--------
Unzip the new version over this folder. Your settings stay. Earlier playtest builds started with
GeoplaneticalModLauncher.exe: delete that file and use GeoplaneticalModLoader.exe.


REMOVING IT
-----------
Delete this folder, and %LOCALAPPDATA%\GeoplaneticalModLauncher (the frozen game, its saves and the
window's settings): back up the saves in its game-data\saves folder first if you want to keep them.
Nothing else was installed or changed.
