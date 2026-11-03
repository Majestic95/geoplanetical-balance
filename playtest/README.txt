GEOPLANETICAL BALANCE - PLAYTEST
================================

(This README ships inside the playtest zip, which bundles the mod loader with the mod.)

Thank you for testing. This mod corrects parts of Geoplanetical's economic, political and public-service
models that are inaccurate, exploitable or broken. It is single player only.

This folder holds the Geoplanetical Mod Loader with the Geoplanetical Balance mod already in its mods folder.


WHAT YOU NEED
-------------
- Windows, Steam, and Geoplanetical installed through Steam.
- The game version this mod was made for. If the game has updated since, the loader says so and will
  not start the mod until an updated mod is released.


HOW TO PLAY
-----------
1. Unzip this folder anywhere (for example your Desktop). Keep the files together.
2. Double-click GeoplaneticalModLoader.exe.
   Windows may warn that the program is from an unknown publisher (it is not code-signed). Choose
   "More info" and then "Run anyway". Some antivirus programs may ask too.
3. The loader opens in its own window. It shows your game and the Geoplanetical Balance mod with a
   switch. Make sure the switch is on, then click "Play with mods".
4. The game starts through Steam. You can minimise the loader window while you play. If you close
   it, the loader keeps the mod active in the background and closes itself after you quit the game;
   leave it open to see its end-of-session report. If the window ever shows a red warning during
   play, the mod is not active: quit the game without saving and report it with launcher.log.
   "Open log" shows what it did; "Quit" closes it (do not quit while the game is running).

The loader reads the game's own code, applies the mod's changes in memory, and starts the game
through Steam. It never changes any game file. Starting the game from Steam as usual plays the
normal game.


SAVES - PLEASE READ
-------------------
- Start a NEW game for testing and save it under a new name (for example "playtest-1"). Steam Cloud
  syncs your saves, so do not overwrite a campaign you care about.
- A save made with the mod needs the mod to load correctly: always load it through the loader.
- Saving, quitting and loading again through the loader should continue the game exactly. If it
  does not, please report it as a bug.


WHAT THE MOD CHANGES
--------------------
The loader window lists every change, grouped by area: click "What it changes" under the mod.


WHAT TO WATCH FOR
-----------------
These are tuned by judgement, not yet by long play. Please report it if any of these look wrong over
several in-game years:
- Approval: some countries' approval swings much more than in the unmodded game. Too much? Too little?
- Credit ratings: do they fall sensibly in recessions and wars, or spiral?
- Household savings drifting slowly away from the unmodded game over many years.
- Investment, growth, ratings and elections after the first year (several changes switch on around
  day 365).
- Countries at war: repair bills, debts and ratings together, and the debt and unpaid bills a
  conqueror takes on when it annexes a whole country.
- Construction: large building programmes being slowed rather than refused.
- Note: the in-game rating breakdown still shows the game's original rating terms.


REPORTING A PROBLEM
-------------------
Report problems on the project's GitHub issue tracker. Please include:
- What happened and what you expected, and roughly which in-game date.
- The country you play.
- The file launcher.log from this folder.
- If you can, the save file.


IF THE GAME IS NOT FOUND OR MOVES
---------------------------------
The loader finds the game through Steam. If it cannot, its window asks for the game folder (type it
or click "Browse...") and remembers it in launcher-settings.json. If you later move or reinstall the
game, delete launcher-settings.json and start the loader again. While Steam is updating the game, the
loader waits for the update to finish.


UPDATING
--------
Unzip the new version over this folder. Your settings stay.


REMOVING IT
-----------
Delete this folder. Nothing else was installed or changed. Saves you made with the mod stay in your
normal save list; load them only through the loader.
