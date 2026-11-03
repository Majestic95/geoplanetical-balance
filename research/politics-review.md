# Geoplanetical politics and governance: review for a realism mod

Status: first pass (2026-10-30), static analysis of build **26318758** (`simulation-worker.bundle.js`). Companion to
`research/economy-systems-review.md`; IDs P1–P14. Same lens: does the institution behave like its real-world
counterpart? Tags as in the economy review: **read** = a first reader read the cited code (a strong lead, not a
second-reader check); **read+checked** = re-read by a second reader; **inferred** = reasoning from read code.
Offsets are UTF-16 offsets in 26318758; names change every build. No determinism hazard found in this area.

## How it works

- **Daily.** `cKQ@96258255` increments the day, then `h2C` runs per country `_tickMacro` then `_tickSociety`
  (`lpQ@96101248` -> `F6Q@93735300`: approval and stability move toward target + anchor). `sim._tickProcedures` ->
  `RaQ` resolves bills, reforms and confidence motions on their vote day.
- **Weekly (`WEEKLY_POLITICS`).** `_tickPolitics` = `H4Q@94109260`: caretaker formation (`M4Q`), party support
  drift 5.5 % of the gap per week (`XTA@25593732`, `1-(1-.008)^7`, half-life ~12 weeks), chamber and presidential
  contests on their `nextDay`, campaign AI and polls (`gtQ`), parliamentary AI (`E4Q@94089400`, tables
  no-confidence motions). Military: `EaQ@94018468` (loyalty `W3B@15249156`, coup plots `rPB`).
- **Monthly.** `TpQ@96120142`: fiscal reference drifts 2.3 %/month toward current settings (`c5A`), law habituation
  +2.3 %/month (`hEQ`, `b$A=.023`, half-life ~30 months). `U4Q@94111815`: salience, coalition-strain decay x0.9,
  party landscape (mergers and new parties after day 365).
- **Approval and stability.** Breakdown `Y5A@93734640`; approval target `F5A@93730600`, stability target
  `JwA@93732800`. Approval moves at 0.06/day toward target + `_apprAnchor` (half-life ~11 days), stability at
  0.008/day (~86 days). Anchors are fixed once at genesis (`G6Q@93735040`), so every driver acts as a change from
  day 0. Negative economic terms are multiplied by the grievance factor `oh@14568083` (0.4–1.8).
  - Approval drivers (constants @93727270): base 52, growth (A1, patched), inflation `-(infl-3)x0.9`,
    unemployment `-(u-6)`, popular satisfaction `(group sat-52)x0.9`, culture spending, inequality, energy price
    `-clamp((relPrice-1)x12,-6,18)`, power shortage `-45 x unserved`, war `-7/war - exhaustion x0.1`, default `-12`,
    forced austerity, laws `x0.8`, fiscal policy `x0.8`, security/justice, movements, reform fatigue (<=15),
    epidemic, minority government, transition shocks.
  - Stability drivers: base 34, approval `x0.42`, power shortage `-30x`, war `-5/war`, default `-10`, inflation
    above 15, inequality above 38, austerity, unrest, movements, hospital saturation, constitutional strain, crown,
    fiscal, transitions.
  - Pop-group satisfaction (@93725946): `52 + realIncomeΔ x130 - inflation - housing - unemployment - energy -
    consumption tax + education + public jobs + health`, smoothed x0.12.
- **Laws.** Submission `$7@94059000`: at most 2 pending bills (unlimited by decree), debate
  `min(56, 21+10 x ceil(|Δ|/20))` days; decree applies for regulations, executive decrees or no sovereign
  legislature (`e6@11820589`). A government bill gives an immediate approval "deposit" `clamp(0.45 x Δ, ±7)` (`tAB`).
  Resolution `hrA@94061400`: pass = adoption shock `clamp(0.7 x Δ, ±12)` + fatigue when Δ < 0; fail = -3 approval
  and a 180-day `lawCooldown`. Withdrawal `NaQ@94061053`: -2. Law approval `EI`/`j8@93647840`: share-weighted,
  losses x2.1, importance x (1 - habituation).
- **Elections.** Party targets `c8A@25581529` from voter blocs (bloc satisfaction, ideology distance, salience,
  ruling multiplier). Vote at election `uJ@93872281` -> `aBB`: `support x exp(clamp((campaign+promises+(cred-.5)x12)/100,
  ±.35))`. Seats `pi@25588727`. Polls hashed Box-Muller (n = 1000). Snap election `aS@94002779`.
- **Confidence.** AI motions when `approval < 38` and no contest within 90 days; `o4Q@94084600` resolves (fail: +1
  approval, 140-day cooldown; pass: alternative government, caretaker or election).
- **Coups.** Plot possible when `loyalty < 25 && stab < 40` (`gtA@15252659`, `YD@15246340`); loyalty target `KmA`
  = 70 + pay + budget + insurgency + defeat + repression + betrayal + pride + junta + cooption (`vh@15247583`).

## What looks wrong

| ID | What looks wrong (real-world behaviour it departs from) | Code | Conf. | Suggested fix |
|---|---|---|---|---|
| P1 | **Bill-deposit farming (High).** Submitting a popular government bill adds `clamp(0.45 x Δ, ±7)` approval at once (`l&&(B.approval=nS(B.approval+tAB(l),0,100))`); withdrawing costs a flat 2 and sets no cooldown, so submit -> withdraw -> resubmit nets up to +5 a cycle, which also lifts stability (x0.42) and keeps approval above the 38 no-confidence line. Voters do not reward a withdrawn announcement. | `$7@94059000` (deposit @94060792), `NaQ@94061053`, `tAB` | read+checked | On withdrawal reverse the deposit and add a short cooldown; or credit the deposit only at passage. Partly addressed upstream in build 26346311: withdrawal (`VnQ`) now takes back max(0, the deposit recomputed at withdrawal) in full and undecayed, with no cooldown, so the farming loop is closed but a late withdrawal of a popular bill costs up to about 7 points more than the boost left, and an unpopular bill keeps its penalty. The mod keeps P1 re-based on that (decayed recorded deposit, 30-day hold). |
| P2 | **Habituation reset (Medium-High).** Law effects fade (half-life ~30 months), but any commit deletes the law's habituation (`B.lawHabituation&&delete B.lawHabituation[w.id]`), so a small amendment to a popular law restores its full approval effect. Gratitude does not reset on amendment. | `$Lg` (@94058175), `j8@93647840`, `hEQ` | read+checked (exploit inferred) | Keep habituation through a change, scaled by how far the value moved. |
| P3 | **Snap elections on demand (Medium-High).** Where the constitution grants the player a `dissolve` power (`uE(B,"dissolve")`), `aS` is guarded only by the post-reform freeze (`IS`), and the vote is computed the same day (`uJ` inside `aS`) with no campaign. AI dissolution is barred within 365 days of a mandate, within 180 days of term end, and when unaccountable (`K1C=365`, `O1C`). Real snap elections take 3–6 weeks of campaign and are costly. Cost to the player: 3 approval. | `aS@94002779`, `j1C@96158255` | read+checked (the authority check exists; the first read missed it) | Apply the AI's mandate and term guards to the player; schedule the vote after a campaign period. |
| P4 | **Minority-government cliff; support parties ignored (Medium).** `-(5+(.5-pct)x12)` when no majority: 50.1 % -> 49.9 % of seats costs 5 approval permanently; `rP` counts only `coalitionPartyIds`, not `supportPartyIds`, so confidence-and-supply governments are penalised. | `F5A@93730600`, `rP@15708168` | read | Count support parties; make the term small and smooth, or move it to stability. |
| P5 | **Flat per-war penalty (Medium).** `-count x7 - exhaustion x0.1` approval and -5 stability per war, whatever the role or scale; no rally for defensive wars. | `F5A`, `JwA`, `SUg@93727380` | read | Drive by exhaustion and casualties per head; add a short decaying rally when defending. |
| P6 | **Approval barely reaches elections (Medium-High).** Party targets (`c8A`) use bloc satisfaction and the growth gain; approval reaches elections only through the regional pattern (`hag` -> `A.perf` -> `RTA`). War, default, energy, epidemics and the minority penalty move approval but not votes. Real incumbents are punished at the polls for wars, defaults and crises. | `H4Q@94109260`, `XTA@25593732`, `c8A`, `RTA@25591400` | read (path); inferred (no national effect) | Feed approval relative to its anchor into the ruling multiplier, or move the non-economic drivers into bloc satisfaction. |
| P7 | **Shocks counted twice in approval (Medium).** Group satisfaction already subtracts inflation, unemployment and energy and adds real income; `popular_satisfaction` passes it through at x0.9 while separate inflation, unemployment, energy, power-shortage and growth drivers count the same shocks again. Booms also lift approval through real income outside the A1-patched growth term. | group sat @93725946, `M6Q@93726958`, `F5A` | read | One channel per shock: drop the duplicates from `F5A`, or from the satisfaction feeding `popular_satisfaction`. |
| P8 | **The election channel still rewards gains more than small losses (Medium; extends A1).** Ruling multiplier `n>=0 ? clamp(1+n x .012, 1, 1.7) : clamp(1/(1+(-n/30)^2.4), .12, 1)`: ±10 satisfaction gives +12 % / -7 %, with a convex collapse below -20. A1 patched only `growthGainPct`. | `c8A@25581529` | read | Linear, loss-weighted for n < 0, e.g. `max(.3, 1+n x .015)`. |
| P9 | **Stability tied to government approval (Medium).** Stability target includes `approval x0.42`: 60 -> 20 approval costs 16.8 stability, opening coups (stab < 40) and regime crises (< 15). Unpopular governments are routine in consolidated democracies. | `JwA@93732800` | read | Scale the term by `(1 - electoralIntegrity)` or regime family. |
| P10 | **Coups ignore regime and income (Medium).** Loyalty and the plot trigger have no democracy, civilian-control or income term; a rich democracy that cuts defence pay at low stability can face a plot. | `vh@15247583`, `gtA@15252659`, `rPB` | read | Add democracy and income terms, or require low electoral integrity for plots to progress. |
| P11 | **Default penalty never fades (Low-Medium).** Flat -12 approval / -10 stability while defaulted, on top of the one-off hits. Anger peaks and fades in reality. | `F5A`, `JwA` | read | A decaying shock with a small persistent residue. |
| P12 | **Campaigns swing vote shares a lot (Medium).** `support x exp(clamp(C/100, ±.35))`: 30 % can become ~46 %. Measured campaign effects are a few points. Attainable campaign scores (`S6Q`, `tBB`) not read. | `aBB@93872112` | read (formula) | Narrow the clamp to about ±0.08. |
| P13 | **Culture spending counted twice, never habituates (Low).** `(spend.cult - fiscal0.spend.cult) x0.6` against day 0 while the fiscal driver uses a drifting reference that already includes culture. | `F5A`, `n5A@93648950` | read (units inferred) | Drop it or measure against the fiscal reference. |
| P14 | **Not a bug (re-checked 2026-10-30).** The world-growth reference `U6Q@93730098` is cached per day at its first use, inside the first country's `_tickSociety` (`lpQ` via `F6Q`/`L5A`), after only that country's `_tickMacro` (`s2Q@93774640`). But the daily macro tick never changes what the snapshot reads (`gdpVol`, `_gdp1yAgo`, `pop`; `s2Q` zeroes `gdpVol` only for a country with no population, which `U6Q` skips), so every country sees the same consistent figures. | `U6Q@93730098`, `s2Q@93774640`, loop in `h2C@96258955` | read+checked | None. |
| P15 | **A government with no seats counts as holding half (Low).** The minority-government approval term is `-(5+(.5-clamp(t.pct\|\|.5,0,.5))*12)`: a seat share of exactly 0 falls back to 0.5, so a government with no seats in the confidence chamber gets the smallest penalty (-5) instead of the largest (-11). | `F5A@93730779` (`t.pct\|\|.5`), seat share `rP@15708168` | read+checked | Use `t.pct??.5`. |
| P16 | **AI governments cannot dissolve parliament in the game's first year (Low).** `T1C@96157802` dates the last election as the next chamber election minus the term (`Fg`), and the day conversion `Ts@11830900` floors dates before the game start at day 0. `j1C@96158255` refuses dissolution within 365 days of the last election (`K1C`, `recent_mandate`), so every AI government reads its pre-game election as day 0 and is blocked until day 365, whenever it was really elected. The term-end check (`b1C=180`) also runs from the clamped date. P3 gave the player the same 365-day rule, measured from real dates. | `T1C@96157802`, `Ts@11830900`, `j1C@96158255` (`K1C=365`) | read+checked | Keep the unclamped (negative) last-election day for the mandate checks. |

**Determinism:** none found. No `Math.random` in the bundle; `Date.now`/`performance.now` in politics only for
profiling; randomness is hashed (`rQ(key^day…)`, `DYg` from `rngSeed0`). Cheat paths (`lockLove`, `set_stability`,
`autoAdopt`) change state in the simulation: fine single player, multiplayer should block them.

**Looks right:** law and fiscal effects fade; reform fatigue only from unpopular laws; capped decaying transition
shocks; no-confidence at an absolute 38 with an election-proximity guard; AI and player share the bill path.

## Not yet read
- Domestic movements beyond `dIA@15783474` / `rQg@15742000` (mobilisation, repression, forced exit `Rh`->`VIQ`).
- Presidential elections, runoffs, term limits, resignations (`WIQ`), succession, coalition formation (`bQB`).
- Each law's economic effect (sampled only: working time and leave scale labour supply 0.72–1.12 `D0A@14551285`;
  retirement age moves exit age 0.65/yr with no phase-in `U7B@15607040`; unemployment insurance `$tA`; unions `hF`).
- Which laws are regulations or decrees (instant, outside the 2-bill limit); vote thresholds, referendums
  (`lkQ`), amendment rules, the electoral-reform integrity grab (@95240400).
- Day-0 approval seeding (whether governments start below 38), `security_justice.approvalModifier`, epidemic drags,
  `_austerityForced`, AI regime drift (@95295695), campaign scores (`S6Q`, `tBB`).
