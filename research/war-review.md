# Geoplanetical war and the military economy: review for a realism mod

Status: first pass (2026-10-30), static analysis of build **26318758** (`simulation-worker.bundle.js`,
`war-theatre-worker.bundle.js`). Companion to `research/economy-systems-review.md`; IDs W1–W13. Tags as there:
**read** = a first reader read the cited code; **read+checked** = re-read by a second reader; **inferred** =
reasoning from read code. Offsets are UTF-16 offsets in 26318758. The v0.1 mod already books a treasury repair bill
for war damage to power plants and fields (E4).

## How it works

- **Daily tick** (labels passed to `qA` near @96259000): `tickFormationMovement` (`dXB`) -> `tickFormationMaintenance`
  (`fRB`) -> `tickFormationPersonnel` (`sKB@~25369600`: wounded return, AI auto-mobilisation, reinforcement) ->
  `tickConflictTerminations` (`_sQ`) -> `reconcileSubjectWarParticipation` -> `tickNuclearStrikeFlights` (`p9Q`) ->
  `requestWarTheatreBakes` (`VyQ@96243843`, the tick waits for the war-theatre worker) -> `tickWarPhases` (`NwB`;
  strategic wars `hsQ@~94428900`, the player's operational war `whg@94519731`) -> `settleWarCivilianDay`
  (`GuQ@~94589850`: `ygB@94276344` turns combat into civilian deaths and internal displacement; `Jhg` applies the
  occupier's repression or expulsion; `MvB` monthly roll).
- **Exhaustion and opinion.** `KsQ@94427976` = side weight (aggressor 1, other 0.5) x (duration `flA` +
  casualties/pop x 900 + occupied-population share), 0–100. Approval `F5A@93730779` and stability `JwA@93732807` read
  `SUg@93727440` (war count, mean exhaustion).
- **Defence budget (AI, monthly).** `"jour.budgetMilitaire"` (@96220895) -> `fqQ@~95298360`: desire from
  `bZg@95297618`, baseline anchored once in `forces.aiBudgetAnchor`, applied through the `defense` budget lever; line
  `t6.mil` 0–50 % of GDP.
- **Defence money.** `EcB@~11771930` (monthly fiscal loop @95827215) moves `earmarkedBnY x period` from budget cash to
  `treasury-military-cash`. Arms orders are paid from military cash or escrow; wartime munition and missile demand
  (`T3g@87312641`, `gPg@87336253`) creates arms-industry orders. Funding ratio `E4@11769128` =
  `clamp(allocation/_milCost, 0.2, 2)` drives readiness (`vTB@25996429`), repair and army loyalty.
- **Mobilisation.** `$zA@~25365200`, `iKB@25370928` move reservists to active duty, removing workers from private,
  public and informal employment in proportion; military deaths go through `z4` (`war_military`).
- **Occupation.** `HDB@95286132` returns 0 for a province held by another country: the owner loses that province's
  day-0 sector capacity.
- **Peace.** `nU@94475512` accepts three terms: territorial transfer, disarmament (-8 stability), status change.
  Territory moves with `w9@95216878` / `gWg` (companies, households, housing, inventories, external balance sheet).
  A country wiped out: `VXg@95203021` hands its treasury cash, reserves and SWF to conquerors by population; the
  retirement step `"finance:sovereign-debt"` (@95105869) runs `oxB@87053115`, writing all its debt down.
- **Refugees.** `pJA@15897349` feeds last month's displaced into the migration model (@15911466); `vvB` flushes to
  `warAftermath` at war end.
- **Trade.** Countries at war with each other cannot trade (`z5`/`vaA` near @16254900, `"active_hostilities"`); arms
  orders between them go to `war_hold` (@87337026).
- **Strikes.** Conventional `rCB@~94328640` (plants, fields, units only); plant damage `YTB@26349545`, field damage
  `THB@23835458`. Nuclear `KTg@94765369`, `bTg@94766328`, `c7Q@94752045`.

## What looks wrong

| ID | What looks wrong (real-world behaviour it departs from) | Code | Conf. | Suggested fix |
|---|---|---|---|---|
| W1 | **Conventional war destroys no civilian capital (High).** Strikes resolve only against `plant`, `field` or formations; fighting kills and displaces civilians (`ygB`) but damages no housing, factories, transport or company capital and leaves no reconstruction bill. Housing damage (`c6A`) and facility destruction (`G0A`) are reached only from nuclear strikes and disasters. Real wars destroy housing and industry on a vast scale (Ukraine: hundreds of $bn) and leave years of rebuilding. | `rCB@~94328640`, `ygB@94276344`; `c6A`/`G0A` callers only `bTg`, `FR`, `C4B`, `Bk` | read+checked (dispatch); read (callers) | Reuse the disaster damage-claim machinery, sized by daily combat intensity per province, and impair company capital in that province. |
| W2 | **No reparations in peace terms (Medium).** `nU` handles only territory, disarmament and status; no indemnity or asset transfer term exists. | `nU@94475512` | read+checked (no "reparation" outside unrelated words) | A `reparations` term: annual payment (share of the loser's GDP for N years) as a ledger obligation between treasuries, weighed by the AI. |
| W3 | **Conquest takes the assets, writes off the debt (Medium-High, exploitable).** `VXg` seizes cash, reserves and SWF by population (`conquered_treasury_seized`, `external_reserve_conquest`); the retirement step then runs `oxB`, writing down every bond (`sovereign_retirement_write_down`), so creditors (including the conquered country's banks, now the conqueror's) take the loss. State-succession practice passes an equitable share of debt with territory. | `VXg@95203021`, `oxB@87053115`, step @95105869 | read+checked | Move debt to conquerors in the same shares as the assets, as secession already does (`QxB@87045700`, `sovereign_debt_succession`). |
| W4 | **Partial annexation moves no debt (Low).** `WXg@95198587` moves companies, households and the external position, not debt; the rump keeps all its debt (often realistic). | `WXg@95198587`, `gWg` | inferred (helpers not read) | Optionally move a debt share with `movedGdp` for negotiated cessions. |
| W5 | **War is not a rating factor (Medium).** The rating factors (income, size, interest, debt, deficit, inflation, growth, stability, default history, FX debt, external, reserves, reserve currency) have no war or occupation term; war reaches them only through stability (-5 per war). Agencies downgrade at the outbreak of war (Ukraine 2022, Israel 2024). | factor list near `lDQ@93484617`, weights @93484072 | read (list); inferred (size) | A factor for active hostilities and occupied-population share, neutral at day 0 for countries already at war. |
| W6 | **Flat per-war opinion hit (Medium; same as P5).** -7 approval / -5 stability per war for every participant, no rally for defenders. | `F5A`, `JwA`, `SUg@93727440` | read | Scale by commitment (casualties per head, mobilised share, homeland occupied); short decaying rally for the attacked side. |
| W7 | **Exhaustion ignores the economy (Low-Medium).** Duration + casualties + occupied share; no GDP loss, inflation, rationing or mobilised share. Military KIA+WIA is added to civilian `deathsM` (millions): if `kia` is a raw count, civilian deaths weigh ~1000x less. | `KsQ@94427976`, `cY@15897032`, `nY@15896930` | read (formula); inferred (units) | Add growth-gap, inflation and mobilisation terms; check `personnel.kia` units against `civilianHarm.deathsM`. |
| W8 | **AI barely ramps defence spending at war (Medium).** The anchor is set once (`||=`); the budget closes 2.4–4.5 % of the gap a month (`1-(1-n)^(30/91)`, `n=.07+competence x .06`, half-life 15–28 months), and desire is a small sum of terms. An invaded state drifts up a few points of GDP over years; Ukraine went from ~3 % to ~30 % of GDP within a year. | `fqQ@~95298360`, `bZg@95297618` | read (formula); inferred (sizes) | Faster adjustment at war and a survival desire term driven by homeland occupation and the score gap. |
| W9 | **AI ignores its finances at war (Low-Medium).** `bZg` drops the fiscal-pressure term at war and the consolidation block is skipped; with W5 there is no warning before an AI default. | `bZg`, `fqQ`, lever @95250650 | read | Keep a reduced fiscal term at war once debt or the rating crosses a threshold. |
| W10 | **Not confirmed (re-checked 2026-10-30): naval blockades do cut trade.** Every active conflict's `navalBlock` is turned into a sea-capacity factor `max(floor, 1-\|navalBlock\|)` on the blockaded side's port assets (`fsQ@94420235` -> `ANB@26368200`, `blockadeFactorByMode.sea`), which the transport routing reads (`trg@16322778`), so a blockaded country's sea trade loses capacity, neutrals included. The first pass counted only the `navalBlock` references inside the war code and missed this one. | `fsQ@94420235`, `ANB@26368200`, `trg@16322778` | read+checked | None. |
| W11 | **Nuclear damage uniform, no aftermath (Low-Medium; was A12).** `c7Q` impairs every company in the country by the national death share whatever the target; `KTg` scales GDP likewise; the stability hit uses the province's death share; no fallout or exclusion zone. | `KTg@94765369`, `bTg@94766328`, `c7Q@94752045` | read | Scope capital loss to the struck province, add a decaying contamination factor, scale stability by the national death share. |
| W12 | **Occupation is a switch (Low-Medium).** `HDB` is 0 or 1: the owner loses the province's day-0 capacity, the occupier gains nothing, a contested front province loses no output. Tax-base and labour treatment of occupied people not read. | `HDB@95286132`, `sqQ` | read (supply); inferred (tax base) | Gradual output loss by combat intensity; partial requisition share for the occupier. |
| W13 | **Not confirmed (re-checked 2026-10-30): the war-theatre fallback cannot desynchronise.** On a worker failure or the 12 s timeout, `VyQ@96243843` falls back to `ECB(w.spec)`. `ECB` is the same algorithm as the war-theatre worker's bake: with identifiers normalised the whole function matches the worker bundle character for character (1,293/1,293), with the same constants (`cellDeg .08`, `maxGrid 1100`, `margin 1.5`, `attackerBand 12`). The tick waits for either result, so both peers apply the same theatre on the same day. | `VyQ@96243843`, `ECB@94346815`, `war-theatre-worker.bundle.js` | read+checked (helper functions not compared) | None. |
| W14 | **A country divided between two or more winners crashes the game (High; fixed by the developers in build 26346311).** The route-capacity move `ivQ@94920998` (per recipient, from `WXg@95198587`) snaps a remainder at or below `1e-9*max(1,capacity)` to the recipient being served, which then takes the whole asset. Many route assets are smaller than that (Slovenia's civil-ship assets about 2e-9), so the next recipient finds the asset gone and the game throws `production-route:transfer-capacity`. | `ivQ@94920998`, `WXg@95198587`, `gWg@95217306` | measured (705, 008, 499, 703, 051, 498 crash in the unmodified game) | Skip a missing asset whose share is within the tolerance (patch `w14-split-conquest-route-fault`, retired at 26346311: the game's tolerance is now `1e-9*capacity`, relative, so a tiny asset is no longer snapped whole to the first recipient). |

## Not yet read
- The strategic war step `hsQ` in full; peace acceptance and AI war declaration (`_CB`, @94725486).
- The player's mobilisation cost (AI's first costs -4 approval) and whether demobilised reservists return to work.
- Whether `_milCost` operating cost is actually paid from military cash, and whether unspent military cash piles up.
- Sanctions creation and bite (`vZ`, `fe`), arms embargoes, military support payments (`military_support` @87630529).
- `WXg` helpers for banks and deposits on partial annexation; the retirement plan (`bkA`, `AqA`) for banks, the
  deposit-guarantee fund and the IMF.
- Occupied population in the owner's tax and labour accounts.
