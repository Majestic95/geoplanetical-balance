# Geoplanetical economy systems: review for a realism mod

Status: complete first pass (2026-10-29). Companion to `research/financial-system-review.md` (the finance review,
cited by its IDs D, F, M, B). This file covers the rest of the economy: macro and production (A), trade and the
external sector (T), energy and resources (E), households, labour, population and housing (H), and the corporate
sector, investment, ownership and shadow economies (C). Section 0 says how a mod could ship at all. Read section 1
first.

**Lens.** Every finding is judged by one question: does the game's institution or market behave like its real-world
counterpart? A fix is worth making when it moves the game toward real behaviour, and it is safe when it leaves day-0
numbers alone and stays deterministic. Gameplay balance follows from realism; a pure difficulty tweak needs a
real-world reason.

**Method and confidence.** Read-only static analysis of build **26296134** (`simulation-worker.bundle.js`, plus the
Electron main process for section 0). No game was run, so nothing is measured in play. Each area was
read separately. Their sections below keep their tags, with one change of meaning against the finance review:
- **read**: a first reader read the cited code. Treat it as a strong lead, not yet a second-reader check.
- **read+checked**: also re-read by a second reader in this pass (the code quoted in section 1 or 2).
- **inferred**: reasoning from read code, not a direct read of the behaviour.
- **ckpt**: a day-0 value sampled from `renderer/economic-t0-checkpoint.json.gz`.

Offsets are UTF-16 offsets from the loader's `tools/bq.mjs`; minified names and offsets change with each build.

---

## 0. How a rules mod can ship: not through the game's own mod system in this build

Read in `electron/` (extracted from the game's asar into `.modding/decompiled/app-26296134/electron/`, not committed):
- **The native mod system is presentation-only** [read+checked]. `mods/mod-manifest.js:19` rejects any `tier`
  other than `"presentation"` (`unsupported-tier`), `contentApi` must be `1`, unknown manifest fields are errors,
  and `provides` accepts only four families (`mods/families/`: `flags`, `flag-library`, `political-identities`,
  `presentation-values`). Module headers state the intent: "packs de présentation … sans règle de simulation". The
  locale agrees (`mods.atelier.homeBody`: "It never touches the game rules."). The simulation worker contains no
  mod, pack or `geomod` code, and the renderer-to-simulation message types have no mod channel.
- **A patched `app.asar` is blocked by the exe** [read+checked]. The Electron fuses in `Geoplanetical.exe` have
  `EnableEmbeddedAsarIntegrityValidation` ON and `OnlyLoadAppFromAsar` ON. A changed asar fails the integrity check
  unless the exe is patched too; Steam "verify files" restores both; neither is a Workshop item.
- **Node injection is closed**: `RunAsNode`, `EnableNodeOptionsEnvironmentVariable` and
  `EnableNodeCliInspectArguments` are OFF.
- **Not ruled out, untested**: Chromium's own remote-debugging switch, which nothing in `main.js` disables. An
  external launcher could patch the simulation worker at runtime. It would not be a Workshop item, and every
  multiplayer peer would need identical patches (the simulation must stay deterministic). This is the route the Geoplanetical Mod Loader
  later took.
- **The code is built for more tiers.** The manifest is versioned (`contentApi`) and tiered. A rules/data tier could be
  added by the developer; until then, rules mods ship through the Geoplanetical Mod Loader.

Consequence: mods that change the rules are delivered by the Geoplanetical Mod Loader; the findings below hold either way.
The findings below hold whichever route is chosen.

---

## 1. Corrections to the finance review (verified this pass)

| Finance ID | Correction | Evidence | Conf. |
|---|---|---|---|
| F1 | **Narrower than stated.** Taxes collected through the ledger are really paid by households and companies, and most programme spending really reaches payees. `l7A` books income tax and contributions as obligations from household and company accounts to the treasury (`jg`); recognition is Dr receivable / Cr revenue, payment Dr cash / Cr receivable (`RNQ@10823741`, `i6A@11699505`). `anB` moves the appropriated share (`reservedExpenseBn`) into budget cash, and the operating settlement pays public wages, transfers (`v7A@93270844`) and purchases (`nUQ@95756024`) from it. **What remains true:** the formula revenue lines outside `y0` (excises `acc`, carbon `co2`, gambling `jeux`, property, financial turnover, `other_structural`, `revAdjust`, the accounting floor) still credit treasury cash with no payer, and the unappropriated part of expense is still paid to no one. | `anB@11712757`, `TeQ@93388973`, `y0` @25409976, `J1Q` near @93440300 | read+checked |
| F5 | **Resolved: no double count.** `TeQ` subtracts every ledger-collected tax (`y0` = `ir, cotis, tva, tvaReduit, tarif, nrjElectricity, is, fort, succ, sejour`) from the revenue that `anB` books, so corporate tax `is` reaches the treasury once, through the settlement. The runtime ledger check is no longer needed for F5. | `TeQ@93388973`: `max(0, g − Σ y0 − grants − KZA − dividends)` | read+checked |
| F4 | **Partly wrong.** The labour, consumption and profit bases scale with factor shares relative to day 0 (`_wageMul`, `_consoMul`, `_profitMul` from `ipB`). The real problem is the step tiers by GDP per head (A6). | `To@15627574` | read+checked |
| F2 | **Qualified.** Nominal GDP excludes the monetary price level (`TiB` enters only the deflator `CtA`), so monetary inflation does not raise revenue as a share of `gdpNom`. F2 holds for real growth and CGE relative-price moves, not for "high inflation cuts real spending until 1 January". | A8 below (`CtA@15074518`, `refs TiB`) | read |
| M7 | **A missing channel.** Monetary policy reaches business investment through the sovereign yield (A3/C17). | `bYB@24870100`, `FhA@24870365` | read |

---

## 2. Synthesis: what makes the economy unlike the real one

Eight patterns recur across all five areas and the finance review. Each one names the real-world behaviour it
departs from.

1. **Money and income from nowhere.** Real money has a payer. Here: the household "unrepresented income" plug, 21%
   of world household disposable income, paid by no one and spread by net worth (H1, H3); formula tax lines with no
   payer (F1 remnant, C13); seized criminal cash (C11); electricity trade paid twice (E1); state-built plants that
   lower tariffs while their capital is never recovered (E2); decommissioning paid to no one (E14).
2. **Cross-country slopes applied over time.** A regression across countries is not a law of motion within one
   country. Here: the rating's growth and inflation weights (D1), tax bases that jump at GDP-per-head tiers (A6),
   fertility falling 1.05 children per log unit of income growth (H12).
3. **Levels where changes belong.** Here: the exchange rate drifts on the current-account level, so every day-0
   imbalance becomes permanent drift (T2); house prices grow on the income level and the rate gap forever (H6, H7).
4. **Cliffs where markets have slopes.** Real markets reprice gradually. Here: capital inflows stop at one rating
   notch (T4), debt barely moves the rating then market access closes at 170%/400% (D2, `P7`), auctions clear at a
   fixed premium then fail (D3), a defaulter's power imports go to zero (E12), the nationalisation price jumps at
   zero profit (C6).
5. **Infinite counterparties.** Real buyers run out of money and appetite. Here: the "rest of world" FX buyer is
   refilled forever, so foreign-currency borrowing is unlimited with no cooldown (T1); households must buy every
   equity issue (C4) and every privatisation (C7).
6. **Asymmetries with the wrong sign.** Here: booms buy three times the approval that busts cost (A1), while voters
   are in fact loss-averse; interest-rate rises can never raise household income (H2), while savers do gain from
   higher rates.
7. **Missing cycles.** Here: households never borrow, so there is no credit or housing cycle (H4, B3); plants never
   age (E3); day-0 oil and gas fields don't decline (E5); firms never retire capacity (C16); inflation never erodes
   debt (A7).
8. **Decorative numbers.** The player sees values that drive nothing: potential growth and the output gap (A2,
   A14), the blackout cost and "recoverable" output (E8), the sanctions "bite" and self-cost (T9), the
   terms-of-trade variable (E15).

### 2.1 v0.1 shortlist, ranked by realism gained against risk

Every item is contained (one function or one config object), deterministic, and day-0 neutral unless the Risk
column says otherwise. Conf. uses the tags above: read+checked means a second reader re-read the cited code.

**Tier 1: bugs and exploits (clear wins).**

| ID | Fix | Real-world behaviour it restores | Risk | Conf. |
|---|---|---|---|---|
| M1 | ~~Debit FX reserves when "paying from reserves"~~ Overstated (2026-10-29): reserves already fall with FX principal due above the day-0 rollover level via the monthly reserve flow (`VBA`/`gjB`), scaled by regime (peg 0.9 … float 0.12); a debit in `oJQ` would double count for pegs. No v0.1 fix; float-regime reserve use is a later modelling question (finance review M1 row) | Paying foreign debt draws reserves down (the reserve-runway crises of Sri Lanka 2022, Egypt 2023): the game does this | — | read+checked |
| T1 | Cooldown and annual cap on foreign-currency borrowing; refill the foreign buyer only at genesis | Market access is finite; issuance needs investor demand, and sudden stops happen | Low (player action) | read+checked |
| C1 | Private firms ordered to invest must pass the profitability test, one expansion project at a time | Governments can't order private firms to invest at a loss with the firm's own money | Low (player action) | read+checked (validator); UI not read |
| E4 | War damage to plants and fields costs money and materials to repair | Reconstruction costs money (Ukraine's grid repairs) | Low | read |
| A1 | Make approval loss-averse: a bust costs more than an equal boom gains; elections see the signed gap | Voters punish downturns more than they reward booms (grievance asymmetry) | Low (approval anchored at day 0) | read+checked |
| H2 | Stop rate changes cutting household income one way only (variant to choose: neutral or pass-through, see H2 row in section 6) | Higher rates raise savers' interest income, a channel central banks track | Low (neutral) / Medium (pass-through) | read+checked |

**Tier 2: model realism, contained.**

| ID | Fix | Real-world behaviour it restores | Risk | Conf. |
|---|---|---|---|---|
| D1/D2 | Rating: drop the wrong-sign growth and inflation effects; add a debt slope above a threshold | Agency methods (S&P, Moody's) reward growth, penalise inflation, and weigh debt/GDP as a core pillar | Medium: ratings move, so check spreads over 10 years | read (finance review) |
| T2 | Exchange rate reacts to the current account's change since day 0, not its level | Structural surpluses (Switzerland) and deficits (US) persist for decades without forced drift | Low | read |
| T4 | Capital inflows fall smoothly with the rating and real-rate gap instead of stopping at notch 17 | Flows respond to rate differentials and risk, and dry up as risk rises | Low | read |
| H6/H7 | House prices error-correct toward income and financing cost | Prices revert toward price-to-income and price-to-rent norms; rate changes shift the level once | Low | read; fixed by the developers in build 26311815 (rent and price error-correct toward income and user cost; our patch retired) |
| A3/C17 | Price business investment off firms' borrowing rate, with partial pass-through from the sovereign yield | Firms borrow at bank and bond rates linked to, but not equal to, the sovereign rate (the sovereign-bank nexus) | Medium: the investment path changes | read |
| A6 | Smooth the tax-base tiers by GDP per head | A tax base grows gradually with development; it doesn't jump on one day | Low if day-0 values are kept exact | read+checked |
| E13 | Carbon tax base fully tracks emissions (`n7B` 0.35 → 1) | A carbon tax shrinks as emissions fall; that is its purpose | Low | read+checked |
| E7 | Let better-than-day-0 power supply raise output | Fixing chronic shortages raises output (South Africa's load-shedding costs) | Low | read |
| A5/C9 | Let privatisation raise efficiency above the day-0 level, symmetrically | Ownership effects run both ways (the privatisation evidence is mixed but two-sided) | Low | read |
| C6 | Nationalisation price = max(multiple × smoothed profit, asset floor) − net debt | Takeover valuations price enterprise value net of debt and don't collapse at break-even | Low | read |
| C10 | A larger shadow economy lowers tax collection | Informality erodes the tax base (IMF shadow-economy work) | Low | read |
| H12 | Cut fertility's within-country income elasticity to about −0.3 | Fertility responds to income slowly within a country, and pro-cyclically in the short run | Low (slow effect; check over 30 years) | read |
| F2 | Index programme spending to a smoothed nominal GDP (qualified by A8) | Budgets are set in nominal terms with explicit indexation | Medium | read (qualified by A8) |

**Tier 3: structural, later projects.** F1 remnant (formula revenue with real payers), H1/H3 (replace the plug with
modelled flows), H4 (household credit origination, with B3 defaults), E1 done properly (utility-to-utility
settlement), E3 (plant ageing), E5 (field decline with AI reinvestment), T3 (exchange-rate pass-through into the
CGE), T5/T6 (reserves linked to money; a world current account that sums to zero), B1–B4 (risk weights,
provisioning), H5 (wealth effect on consumption), C16 (capacity retirement).

### 2.2 Open checks before building

- Runtime: H3 (does the plug create central-bank reserves? one-month reserve diff), T6 (world current-account sum),
  A4 (trend growth over 10 years against `growthObserved0`), A13 (technology factor range), E1 (who receives
  electricity sales revenue).
- Static: C1 (whether the game UI sets `requireProfitable`), M9 (which inflation-module copy is live), A10 (CGE
  price rule `iGB`), T14 (whether `Fp` rewrites `bondRate` daily).

---
## 3. Macro core and production (A)

Scope: how GDP, growth, potential output, unemployment, wages and capacity are produced, and how war, disasters,
climate, energy, health, education, technology, fiscal and monetary policy reach output. Build 26296134, read-only
static analysis, no game runs. Tags: **[read]** read in the code; **[inferred]** reasoning from read code. Finance
findings (D, F, M, B) are cited, not re-reviewed.

### How it works

**Cadence**
- Daily `qEC@96187047` runs, per country, `_tickMacro` → `w6Q@93713406` and `_tickSociety` → `xLQ@96031200`. It then
  runs `_sectorDrift` → `g6Q@93711968` and the sovereign tick. `tickDomesticWorldDay` (`FqQ@95359263`) comes after the
  `"macro"` yield [read].
- Weekly: `tickDomesticWorldWeek` (`YqQ@95360221`) handles employer stance (lockout, disinvestment, capital flight)
  and social movements [read].
- Monthly `l6B@96160580` [read], in this order:
  1. `sealDomesticWorldOperatingWindow` (`LqQ@95360967`) turns strikes and lockouts into sector availability (`p9B`,
     `SEQ`).
  2. `tickMonthlyWorldTradePhases` (`xUQ@95828730`) runs the **CGE** (computable general equilibrium) world economy.
  3. `commitMonthlyGdpHistory` (`r6Q@93714713`).
  4. Later in the month: health, population, administration (`_LQ`), education (`ZLQ`), technology (`gmQ`, `Qf`),
     then the finance block, `tickMonthlyCountryEconomyPhases` (`tmQ@96049995`) and corporate investment (`BPQ`).

**GDP is a CGE value-added sum, not a growth-rate random walk or a demand formula** [read]
- `xUQ` → `jUQ@95826471` → `cpB@25020643`, the world-economy generator. It solves goods prices and trade, fixes output
  per good, then calls `ipB@25032481` per country.
- `ipB` computes nominal and volume GDP:
  - nominal `i` = Σ over goods of (sold × producer price + export rent − realised input cost), + electricity value
    added (VA), + public-service VA `x$@24911418`;
  - volume `u` = Σ (base price × output − base-price input cost), i.e. double deflation, + electricity reference VA
    + public reference VA.
- Both are scaled to the observed day-0 GDP by `wmB@25032391` (`gdpObserved0 × x / x0`). `cpB` then sets
  `gdpVol = gdp = gdpVolumeShadow` and `gdpNom` (@25031354).
- Public-service VA (`x$`) is nominal = payroll and volume = headcount × day-0 comparable wage (`comparable0K`). Hiring
  public staff therefore adds real GDP one-for-one at the day-0 wage, with no productivity growth (the SNA convention
  for non-market output) [read].
- `ipB` also sets the factor-share multipliers `_wageMul`, `_profitMul` and `_consoMul` (share ÷ day-0 share), which
  tax bases use (see A7) [read].
- **Units.** CGE prices and the finance ledger are in constant-money units. The monetary price level
  `TiB = exp(ccy.moneyLog)` (@15064284) enters only the deflator `CtA = vr × TiB` (@15074518). `CtA` is used in `w6Q`
  (REER) and `jUQ` (measured inflation) and nowhere in `gdpNom` [read: `refs TiB`, `refs CtA`].
  - Nominal contracts are eroded explicitly: private contract wages via `moneyErosion` in `DGB@24039119`/`jUB@24030197`,
    public wages via `s5B@15755717`, "frozen" pensions via `XPB`/`euB`.
  - Sovereign coupons are paid in real terms: `fD@10973252 = max(0, (1+i)/(1+π_money) − 1)` (`YjQ@10973164`) [read].

**Growth and the 12-month ring** [read]
- `r6Q` pushes `gdpVol` into a 12-slot ring each month. Growth = `gdpVol / _gdp1yAgo − 1`, recomputed daily in `w6Q`
  from the same ring.
- At day 0, `@95831250` back-fills the ring along `growthObserved0`. That is its only reader: no later term pulls
  growth toward the observed rate.
- `cpB` also keeps `_gdpGrowth` (smoothed, annualised). Its only reader is the snapshot (@24957962), so it is
  decorative.

**Supply side: per-good capacity × multiplicative availability factors** (`_$@25007980`) [read]
- Offer = `cap × extractMult × throttle × exoSupply × provinceSupplyFactor × powerAvailability × healthLaborFactor
  × weatherLaborFactor × technologySupplyFactor × capitalCapacityFactor × domesticSectorAvailability
  × ownershipSectorEfficiency × employerLockoutAvailability × publicHealthSectorAvailability × laborStaffing`.
- The result is then bounded by inputs (`m6g`) and labour clearing.
- Where each factor comes from:

  | Factor | Source | Range / note |
  |---|---|---|
  | `provinceSupplyFactor` | `NdQ@95217779`: capacity-weighted mean over provinces of `y1B@95216593` | 0 if the province is occupied or not controlled, else `__disasterAvailability`. Crops also × `cropClimateYieldFactor`, fish × a climate factor. |
  | `__disasterAvailability` | `wR@94822115`: `1 − remaining damage / province capital` | Floor 0.15. The national `disasterSupplyFactor` is only a fallback once province factors exist. |
  | `healthLaborFactor` | `boQ@93631076`: labour hours [0.94, 1.015] × epidemic presence | Clamped to `bd=[.5,1.03]` |
  | `weatherLaborFactor` | `F$@24772115` | [0.9, 1] |
  | `ownershipSectorEfficiency` | `IbA@24064174` (see A5) | — |
  | `employerLockoutAvailability` | `SEQ@93704630` | ≥ 0.6 |
  | `technologySupplyFactor` | `Qf@87264211` = node effects relative to day 0 (`fSA`, clamped [0.25, 50]) × absorption `h2A` [0.35, 1.25] × learning-by-doing `AlB@15986130` | See technology bullet |
  | `capitalCapacityFactor` | `W1A@95725406`/`I_g@95724899` = (capital index `R4A` ÷ capacity index)^α | α per sector 0.2–0.55 (`vmB`) |

- The same capital and technology factors also cut labour needed per unit (`I4A@24035146`). That is consistent
  with Hicks-neutral / Cobb-Douglas productivity, not a double count [inferred].

**Capacity and capital: demand-led expansion plus a sealed day-0 capital target** [read]
- `we.cap` per good = base capacity × (Σ company `capacityBnY` − routes) ÷ Σ `capacity0BnY`, rewritten monthly by
  `QrB@94687748`.
- Company capacity grows only through corporate expansion `BPQ@94692017`:
  - It needs ≥ 2 consecutive months of expansion pressure (`S3Q@94683238`) and a profitable quote (`requireProfitable`).
  - It adds at most 10% of capacity per month (`tOg=.1`), × `REQ@93705125` (an employer-stance brake, [0.4, 1]).
- When a route completes, `PWA@92713266` scales the business capital stock up in proportion (`ZYB@24873419`). There
  is no second investment bill for the same capacity [read].
- Business capital (structures 40-year life, equipment 8-year; `fhA` config @24820000, `_doc` = "plan-croissance
  phase 4"):
  - Orders = `stock/L + (target × capacityIndex × userCost − stock)/adjustmentYears` (`jYB`).
  - The target is sealed at day 0 as `stock × (1 + gT)` (PWT 2014–19 net capital growth). The `_doc` says the observed
    net investment is "a capital gap the country closes over T years, never a rate that pushes capital afterwards".
  - User cost `FhA@24870365` = `[((r0+δ)/(r+δ)) × relPrice0/relPrice × realWage/realWage0]^0.5`.
  - Its real rate is `bYB@24870100`: `max(0, bondRate − inflExp)`. **`bondRate` is the sovereign market yield**
    (`Ti`@87005470, `ijB`, `Fp`).
  - The orders become CGE investment demand (`E$g@95822541` → `HhA`/`UhA`).
- Learning-by-doing (`AlB`): experience is seeded at 20 years of day-0 output (`GIA=20`) and accumulates monthly
  output (`$MB`). The factor is (E/E0)^b, with b = 0.15 intermediate, 0.2 finished, 0.08 services. That is about
  +0.4–0.8%/yr at first, decaying as 1/(20+t).

**Potential output and output gap are display values** [read]
- `B.potential = 0.35·_capitalGrowthPctY + 0.65·_gLab` (`S$A@93710108`). There is no TFP, technology or learning
  term. It is written only.
- `B._gap` = capacity-weighted firm utilisation − 1, clamped ±12 (`mHg@93710227`). `potentialGdp = gdpVol/(1+gap)`
  (`pHg@93710448`).
- In the sim, `_gap` is read only as a fallback in `To` (unused once `_wageMul` exists) and in `_countryDeficit`
  (@96272466), which has no caller (one occurrence: its definition).
- The UI shows all three ("Potential growth", "Potential GDP", "Output gap") and labels "stagflation"/"overheating"
  from them (app bundle `GfA`@20066403).

**Labour** [read]
- Unemployment (`U5@15902923`) = labour force − private − public − military − informal.
- Public headcount moves toward its budget envelope and hires only from the unemployed pool (`KvB@15901269`).
- Contract wages (`jUB`) move toward a bargaining target (`gog`: union freedom and strike right, outside option,
  productivity) × CGE price level^pb × an expected-inflation drift. Raises are funded only up to 10% of operating
  surplus (or cash/period); wages are rigid downward in real CGE units.

**Technology, education, administration** [read]
- Monthly `gmQ@96045912` diffuses each node's deployment by a Bass curve (`EmA@15416089`) toward a ceiling.
- Absorption capacity `yF` = 0.45·researchers + 0.35·institutions + 0.2·digital (`wgC@96041168`):
  - researchers come from higher-education learning/completion and skill shares (`oh`);
  - institutions from administration process, integrity and civil completion;
  - digital from administration digital capital.
- **Corrected 2026-10-31 (build 26335289, `research/public-services-review.md` 1.1): no longer holds as written.**
  Administration also reaches output and revenue directly: its `collectionRatio` multiplies tax collection efficiency
  (`YBA` inside `cr`), pension contributions, the welfare value of transfers and health access. Education also
  reaches output through labour matching: workforce skill shares set labour supply by skill tier and constrain
  sector employment (`anA` -> `WFB`). Original text, for build 26296134:
- So education and administration reach output only through technology diffusion. Education outcomes otherwise feed
  satisfaction (`P$A`) and legitimacy indices.

**Fiscal and monetary channels to output**
- Government purchases are CGE final demand: `nUQ@95756024` builds `public_operating_budget` purchases from the
  programme budget (`Pn` → `LCA`), paid from the budget cash account (`payer: jg(..., {budgeted:true})`) [read].
- Public payroll is public VA (above). Transfers reach households' disposable income (`P$A` uses `NX(household)`)
  [read; posting path not traced].
- Monetary policy reaches output through:
  - bank rates (`QFA`, B5) on loans [finance review];
  - the inflation module (M7);
  - **business investment via the sovereign yield**: policy passes 0.55 into `Fp`, then `bYB` → `FhA` → capital
    target. This channel is missing from M7 [read].

**Society links** [read]
- `xLQ`: the poverty factor `_povF` = 1 + 0.05·Δunemployment + 0.015·Δinequality vs day 0.
- Approval target `d$A@93669672` adds, in points:
  - growth vs world growth: **+5.4 per point above**, **−1.8·Tb per point below** (`zfg=5.4`, `Tfg=1.8` @93666227;
    `Tb@14514344` ∈ [0.4, 1.8]);
  - −0.9 per point of inflation above 3%;
  - −1 per point of unemployment above 6%;
  - energy prices, shortage, war, default and others.
- An anchor fixes day-0 approval, and approval closes 6% of the gap per day (`x9A`, `nEQ=.06`).
- Elections get `growthGainPct = max(0, growthGap − growthGap0)` (`ewA@93669404` → `naQ@94046525`).

**Other ticks in scope** [read]
- `g6Q` rescales the agri/industry/services shares by sector VA.
- `tmQ` handles fiscal-reference habituation (`Y9A`), law habituation, VAT incidence (`Tf`), group satisfaction and
  militancy (`P$A`), tax-reform drift (`FZA`) and the budget refresh (`Sf`).
- A missile/nuclear strike (`UOg@94697504` → `W3Q@94684308`) destroys a share of every company's capacity and capital
  equal to deaths/population, and cuts `gdpVol` directly until the next solve.

### What looks wrong

| # | Finding | Evidence | Conf. | Mod angle |
|---|---|---|---|---|
| A1 | **Booms are rewarded about 3× more than equal busts are punished, and elections ignore busts.** Approval gives +5.4 per point of growth above world growth but only −1.8·Tb (0.7–3.2) per point below; the election channel is `max(0, …)`. Growth is y/y, so any temporary level shock (strike, lockout, disaster, short war, self-inflicted contraction) produces a year of negative growth and then a year of positive base-effect growth. *Scenario:* a −3% shock and full recovery gives −5.4·Tb then +16.2 approval-points of target; with Tb=1 the two-year net is +10.8, and the incumbent's vote share sees only the rebound. Real voters are loss-averse (recessions cost more than booms gain), so the sign of the asymmetry is wrong. It is farmable before elections. | `d$A@93669672`, constants `zfg=5.4,Tfg=1.8` @93666227, `Tb@14514344`, `ewA@93669404`, `naQ@94046525` | read+checked (net-gain arithmetic inferred) | Make it symmetric or loss-averse (e.g. +2.5 above, −3.5·Tb below); feed elections the signed gap, clamped. |
| A2 | **"Potential growth" shown to the player has no TFP term and drives nothing.** `0.35·capital growth + 0.65·labour growth` omits technology diffusion, learning-by-doing and capacity expansion, which are the model's actual growth sources. Output gap and potential GDP are only utilisation-derived displays. The `_gap`-based cyclical deficit `_countryDeficit` is dead code. The UI's "overheating"/"stagflation" labels come from these numbers. | `S$A@93710108` (write-only `B.potential`), `mHg@93710227`, `pHg@93710448`, `_countryDeficit`@96272466 (no caller), app `GfA`@20066403 | read | Compute potential from the CGE at full utilisation (or add the technology/learning factor growth). Drop or wire `_countryDeficit`. Display-only, so low calibration risk. |
| A3 | **Firms' investment prices off the sovereign yield, not their own borrowing cost.** `bYB` uses `bondRate − inflExp`. The sovereign spread (rating table up to +20 pts; default = inflExp+26), the deficit term and the credibility penalty (D7, M4) therefore pass straight into the private capital target. Firms actually borrow at `policy+2.4` (B5). *Scenario:* in default, real r ≈ 26% gives a structures target × ((r0+.025)/(.285))^0.5 ≈ 0.4 and equipment ≈ 0.6, a decade-long capital collapse. A growth boom that worsens the rating (D1) also cuts investment slightly. The floor `max(0, …)` removes any boost from negative real rates. | `bYB@24870100`, `FhA@24870365`, `bondRate` set from auction/secondary yield `Ti`@87005470, `ijB`@87016272 | read | Use a corporate rate: real lending rate (`QFA`) + a spread linked to the sovereign at a pass-through < 1 (e.g. 0.3). Allow mildly negative real rates (floor −2%). The sovereign-bank nexus can stay through the spread. |
| A4 | **No exogenous trend: long-run growth needs demand to outrun capacity.** The capital target is sealed at day 0 (a one-off catch-up), and capital afterwards only follows installed capacity. Capacity grows only after ≥ 2 months of excess-demand pressure plus a profitable quote. Learning-by-doing decays (∝ 1/(20+t)). Technology diffusion saturates at the ceiling. `growthObserved0` only seeds the ring. Whether a 10-year run reproduces observed trend growth (e.g. India ~6%, Japan ~1%) is open. If it doesn't, the D1-style rating effect of growth, approval (A1, relative to world) and revenue all drift. | `fhA._doc`@24820596, `jYB`, `BPQ@94692017`, `S3Q@94683238`, `AlB@15986130`, `EmA@15416089`, ring seed @95831250 | read (mechanics); inferred (whether growth stalls) | Measure first: log per-country y/y growth over 10 years vs `growthObserved0`. If it stalls, add a slow TFP drift per country calibrated to observed growth minus the model's endogenous part. |
| A4d | **A4 design draft (2026-10-30; build after player feedback).** Goal: each country's multi-year real growth tends toward a plausible trend without overriding cycles. (1) A per-country trend productivity factor `trendTfp` (one saved number, 1 at day 0) multiplies every good's `technologySupplyFactor` in `If@87324207` (the monthly `technology` stage of `sBC@95889475`), next to the technology and province factors it already multiplies, so supply capacity drifts and demand follows through incomes in the CGE. (2) Target growth `gT(t) = gLR + (g0 - gLR) x exp(-t / 15 years)`, where `g0` is the day-0 observed growth (`growthObserved0`, also the GDP ring seed in `fFQ@95900334`) and `gLR` a long-run rate set by income per head (about 1.5% for rich countries, higher for poor ones, converging). (3) Each month, `trendTfp *= exp(k x (gT - gModel) / 12)`, with `gModel` the 36-month average of simulated growth (a new ring, saved) and `k = 0.25`, the drift clamped to [-1%, +4%] a year, so the factor corrects persistent gaps slowly and leaves recessions and booms alone. (4) Cap the product of `trendTfp` and the technology factor per good (A13), so the two do not compound. Deterministic (simulation state only); day-0 neutral; adds saved state, so it needs a save-then-reload test. Validation: the version's one long run, per-country trend growth against `gT`, plus approval (A1 compares growth with world growth) and ratings (D1). | `If@87324207`, `sBC@95889475`, `fFQ@95900334` | read (hook points); inferred (calibration) | Build after playtest feedback, as its own patch. |
| A5 | **Privatisation can never raise efficiency; nationalisation costs up to 22%.** Efficiency = min(1, (1 − f·share²)/(1 − f·share0²)) with f = 0.22 for tech/ict/knowledge, 0.16 trade/services, 0.12 industry. Selling a sector that was state-owned at day 0 gives the cap of 1, so no gain. Re-nationalising what you privatised costs again. The only lasting effect of privatising is the sale revenue (and dividends lost). | `IbA@24064174`, `lGB`/`uog`/`sog` @24063400–24064276; `qaQ@94060232` | read | Let efficiency rise toward the private level: `min(lGB(0)/lGB(share0), lGB(share)/lGB(share0))`. Contained, but it shifts output upward for privatisers (AI too). |
| A6 | **`gdpCap` tiers make the tax bases jump** (cross-sectional calibration applied over time, like D1). `To` picks base shares by GDP per head ≥ 3/10/25 k$. Crossing 10k: formal labour base 0.18 → 0.28 (+56%), consumption 0.26 → 0.30, property 0.8 → 1.6 (×2). Crossing 25k: labour 0.50 → 0.55, consumption 0.30 → 0.36, profits 0.13 → 0.11, property ×1.6, financial turnover 0.08 → 0.18. Day-0 `revAdjust` absorbs the day-0 tier, not later crossings. Revenue therefore steps by a share of GDP on the day of crossing, either way. War or epidemic deaths raise `gdpCap` and can trigger an upward step. | `To@15627574` | read+checked (revenue size inferred) | Interpolate the shares smoothly in log(gdpCap) (e.g. a logistic between tiers), keeping day-0 values exact so calibration holds. This qualifies F4: bases do scale with CGE factor shares (`_wageMul`, `_consoMul`, `_profitMul`), but the tiers are cliffs. |
| A7 | **Real coupon floored at zero: inflation can never erode debt.** The ledger is in constant-money units, and coupons are paid at `max(0, (1+i)/(1+π) − 1)`. A real nominal bond's holder loses π − i per year when π > i; here the real return is clamped at 0, with no principal erosion. Financial repression or "inflating the debt away" is impossible, and debt/GDP does not fall in high inflation. The same `fD` serves bank loans and households (`t6A`, `T4B`, `LSQ`). | `fD@10973252`, `YjQ@10973164`, `FjQ@10973099`; `refs fD` (12 callers) | read+checked (macro consequence inferred) | Allow a negative real coupon (book principal erosion as holder loss / issuer gain), or erode face value by money inflation for nominal instruments. Finance-area change; pairs with M8. |
| A8 | **Corrections to F1/F2.** (a) `gdpNom` excludes the monetary price level (`TiB` enters only `CtA`), so *monetary* inflation does not raise revenue as a share of `gdpNom`. F2's "high inflation cuts real spending until 1 January" therefore does not hold for monetary inflation; it holds for real growth and CGE relative-price moves. Within-year real growth improving the balance until the rebase is in effect an automatic stabiliser. (b) Government goods purchases are paid to producers through the operating-purchase ledger (`nUQ` `public_operating_budget`, `paymentRequired`), so F1's "spending paid to no one" is at least partly superseded. They are not paid twice: `anB` books expense only on the unreserved part and moves the reserved part (`reservedExpenseBn`) into budget cash, which pays these purchases (`anB@11712757`, read+checked; section 1). | `w6Q@93713406`, `CtA@15074518`, `refs TiB`; `nUQ@95756024`, `LCA@93400021`, `O_g@95755871` | read (a mechanism, b purchase path); inferred (F1/F2 consequences) | Re-verify F1/F2 with a runtime ledger check of one month's budget-cash flows before building on them. |
| A9 | **Public hiring is a cheap measured-growth lever.** Public VA volume = headcount × day-0 wage, and hires come from the unemployed. Raising a programme envelope therefore raises real GDP one-for-one with payroll (multiplier ≈ 1 by accounting, before demand effects), cuts unemployment and, through A1, buys approval: +5.4 per point of growth above world, +1 per point of unemployment. *Scenario:* hiring 1% of the labour force at a public wage ≈ 0.5 × GDP per worker gives +0.5% GDP, i.e. about +2.7 (growth) + 1 (unemployment) approval for a payroll of about 0.5% of GDP, with no productivity cost modelled. The convention itself is national-accounts standard; the issue is the interaction with A1. | `x$@24911418`, `KvB@15901269`, `U5@15902923`, `d$A` | read (mechanism); inferred (magnitudes) | Mostly fixed by A1. Optionally tie public VA volume to service outcomes (staffing ratio / delivery) rather than raw headcount. |
| A10 | **Demand pressure may count twice in inflation.** Excess demand raises CGE prices (shortage pricing in `cpB` → `vr`), and the monetary layer adds `−0.25·(u − u0)` to `moneyLog`. Measured inflation is Δlog(`vr`·`TiB`), so a boom with low unemployment pushes both. | `C6Q@93712756` (inflation from `CtA` = `vr`·`TiB`), `vr@15074312`; M-section `sVQ` demand driver | inferred (CGE price rule `iGB`/`nGB` not read) | Read `iGB` first. If confirmed, drop the unemployment driver for CGE countries or net out the CGE real-price change. |
| A11 | **Climate only ever lowers crop yields.** `cropClimateYieldFactor` targets `min(1, current/baseline)`, so warming cannot raise yields anywhere (no high-latitude gains, no CO₂ fertilisation). Probably intended for gameplay, but it biases climate damage upward. | `NdQ@95217779` (`Fl(I/baseline,0,1)`) | read | Allow up to e.g. 1.1, or leave and document. |
| A12 | **Strike damage is uniform across the economy.** A strike's capacity and capital destruction equals deaths/population and hits every company in the country, whatever province or sector was struck. The direct `gdpVol *= 1−t` is then overwritten at the next CGE solve (double-hit for at most one month). | `UOg@94697504`, `W3Q@94684308` | read | Scale destruction by the struck province's capacity share (`__sectorCapacityBn0`). Low priority. |
| A13 | **[Corrected 2026-10-31, build 26335289: the pace below is wrong. A new generation can start only when the newest one has diffused to 90% of its ceiling (`ytA`, `KpA=.9`), which takes 14–33 years per generation, so "4.7x after 10 generations" is centuries away, not a decade. Still true: no generation cap, and the 50x clamp is the only bound; the long-run risk sits in heavily stacked service goods (health, scientific research, software). See `research/public-services-review.md` R1, R2 (read+checked).]** **Technology effects compound without a generation limit (read 2026-10-30, build 26318758).** Each node's effect on a good is `Z3g`: `(1+m*deployment)`, and once the node has generations `x (1+m*mature)^(G-1) x (1+m*newest)`, with `m` the node's `max` (0.12-0.27 for the agriculture nodes read, e.g. irrigation 0.15). The effects of all nodes on a good multiply (`VXB@87323392`, `D[E]=(D[E]\|\|1)*o`), relative to the day-0 baseline (`tRA`), clamped only to [0.25, 50] (`nuA@87322921`). A researched node keeps being researched: each completed round starts a new generation (`uwC@96113216` -> `wpA@15471934`, `generation+1`), with no cap on `generation` in the code read. So one node with m = 0.15 at full deployment gives 1.15^(G+1): about 4.7x after 10 generations, 50x (the clamp) after about 27. The pace is limited by research points (one generation per programme per tick at most, cost = the node's `cost`) and by deployment: `matureDeployment` averages the generations' deployment at each upgrade, so rushing generations lowers it. Pace in play not measured. | `Z3g`, `VXB@87323392`, `tRA`, `nuA@87322921`, `uwC@96113216`, `wpA@15471934`, `LpQ@96114760` | read | Cap generations (e.g. 3-5) or let each new generation add less (diminishing returns); measure AI research allocation over a long run first. |
| A14 | **Decorative macro variables (corrected 2026-10-30).** `B.potential` (`s2Q`, `xgC`) and `_gLab` (feeds only `potential`, via `mAB@93771342`) reach only the Economy panel's view (`SOQ@96582061`); `_gdpGrowth` is smoothed and saved (`vJB`, `Yz`, `ocA`) but never read. Not decorative: `_growthGap0` is the day-0 baseline of the approval term comparing growth with world growth (`mwA@93730511`, `F6Q`, `G6Q`). | readers of `.potential`, `._gLab`, `._gdpGrowth`, `._growthGap0` on 26318758 | read+checked | Clean up together with A2. |

### v0.1 candidates

Contained (one function or one config object), deterministic, and low risk for day-0 calibration:

1. **A1 approval asymmetry.** Change the two constants in `d$A`'s growth term and sign the election input in `ewA`.
   - Anchors: the term ids `"approval.base"` and `"popular_satisfaction"` in `d$A`, and the call-site key
     `growthGainPct:` in `naQ`.
   - Day-0 approval is anchored (`_apprAnchor`), so calibration is unaffected. Expect approval to fall in
     recessions and rise less in booms.
2. **A2 potential growth display.** Add the technology and learning growth to `S$A` (or derive it from capacity), and
   delete the dead `_countryDeficit`.
   - Anchors: `"sim._tickMacro"` (facade `_tickMacro(B,Q){return w6Q(...)}`) and the UI key
     `econ.syn.eng.potential`.
   - Display only.
3. **A5 privatisation efficiency.** Change the `min(1, …)` cap in `IbA`.
   - Anchor: the error string `company-ownership:sum:` right after it, and the `sog` object
     (`tech:.22,ict:.22,knowledge:.22`).
   - Day 0 is unchanged (share = share0 gives 1).
4. **A6 smooth tax-base tiers.** In `To`, replace the step tiers with a curve that equals the current values at each
   country's day-0 `gdpCap`, or interpolate and let `revAdjust` re-absorb the difference at genesis.
   - Anchors: the returned object keys `laborFormal`, `finTurn`, `gamblingGgr`, `drugLegal`.
   - Check that `revAdjust` is computed after `To` at genesis, so day-0 revenue is exact.
5. **A3 investment real rate** (contained in `bYB`, but it moves calibration: `realRate0` is captured at genesis from
   the same function, so day 0 stays neutral; the dynamics change).
   - Anchors: the error string `business-capital:` and the config keys `userCostElasticity` and `realRate0`.

Not v0.1 (broader): A4 (measure first), A7 (finance ledger semantics), A8 (verification task), A10 (needs `iGB`),
A13 (measure first).

### Not yet read

- CGE price formation (`iGB`, `nGB`, `ebA`, `sGB`), the input constraint `m6g`, household consumption and taste
  (`finalUseByKind.household`, `demandScale`), and labour matching (`CbA`, `EGB` internals, `Q0A`/`g0A` wage
  adjustment speeds, `pb`).
- How public payroll and transfers are posted to household income. (Whether `anB` duplicates `nUQ` purchases is settled: it does not, section 1.)
- Administration `_LQ` and education `ZLQ` internals: what moves `capital.process`, `integrity`, `learningIndex`,
  `completionRate`, and at what cost.
- Technology node effect sizes (`ow[].effects[].max`) and `DmA` Bass p/q per domain (A13).
- War: `oiQ` (civilian day), `DiQ` (civilian month), plant damage/repair `UzB`, mobilisation effects on the labour
  force. Energy: how `powerAvailability` and `unservedSinceT0Share` are set (`_UQ`, `tR`).
- Domestic sector availability magnitudes (`p9B` → `Y9B`) and employer-stance transitions (`xEQ`).
- Readers of `B.agri`/`B.industry`/`B.services` after `g6Q`.
- `Tb`/`H2A`/`UV` (the cultural factor behind the bust weight in A1).
- No 10-year runtime run: A1 net-gain magnitudes, A4 trend growth and A13 factor ranges are unmeasured.

---

## 4. Trade and external sector (T)

Scope: monthly world trade (CGE, flow allocation, transport), tariffs and trade policy, sanctions and freezes, the
balance of payments (current account, reserves, private financing, FDI, NIIP valuation), the currency tick as it
touches the external side, and international money flows (aid, IMF, EU, tolls, OPEC, AI last resort). Build
26296134, read-only static analysis. Out of scope and cited by ID: finance review items D*, M*, F*, B*.

Tags: **[read]** read in the code; **[inferred]** reasoning from code that was read.

### How it works

**Monthly cadence and phases**
- `l6B@96160580` runs `wD("tickMonthlyWorldTradePhases", xUQ(A,{periodYears,periodMonths}))` after
  `MONTHLY_PRETRADE` [read].
- `xUQ@95828730` order [read]:
  1. tourism opening `rAQ`;
  2. the CGE solve `u$g → jUQ@95826471 → cpB@25020643` (settlement mode);
  3. the transport candidate adopted, if a network exists;
  4. `TUQ` writes each country's trade aggregates;
  5. `N0 → Jcg@86968747` builds partner lists and currency exposure (display/exposure only);
  6. `IUQ@95751254` closes commodity markets (a projection of CGE world prices; not authoritative);
  7. `gBQ@92654667` settles canal/strait tolls;
  8. `t2Q` monetary reform;
  9. `F6Q@93748717` balance of payments.
- `jUQ` then settles operating flows, field extraction, strategic stockpiles and CGE consumer-price inflation
  (`C6Q@93712756` writes `A.inflation` from a 12-month ring of the CGE price level `CtA = vr × TiB`) [read].

**Goods, prices and the trade solve (`cpB@25020643`, `rOA@24986326`)** [read]
- Prices live in a world numeraire per good (`LB` = base price). A producer price comes from unit cost `EpB@25005679`
  (materials at buyer prices × input border multiplier, electricity, employer cost, environment levy) and a
  supply/demand term (`nGB`, `iGB`), capped at `LB × g2g` (`g2g=20`, `V$@24995010`).
- A buyer price is the quantity-weighted average of the domestic producer price and each import's (exporter producer
  price + freight per unit) (`cpB`, buyer loop). After a transport solve, `Q2g@24991714` reprices for freight deltas.
- Flow allocation per good: `V6g@24983032` builds exporter offers and importer needs; `QpB@24981328` builds links
  with a border rate; `kgg@16225966` ranks them by delivered cost; `r_@16231722` (or the identical worker
  `world-market-worker.bundle.js`, `Ue` called by the message handler @32488) brokers per good.
  - Delivered cost of a new link = `exporterPrice × (1 + tariff/100) + freight`. Freight is
    `cY(baseValue, freightRate, greatCircleKm/1e4)`; a link is dropped when freight exceeds the exporter price.
  - Domestic supply is ranked at `price/(1+_JA)`, `_JA=.05` (5% home bias) (@16220811).
  - **Anchored relations** (trade remembered from calibration) are ranked at
    `price × (1 + (tariff − anchorTariff)/100) + freight − anchorFreight`: incumbents pay only the *change* in tariff
    and freight since the anchor, new partners pay the full amounts.
- If the async market pool rejects, the month re-runs the broker locally (`rOA`, "courtage rejoué en local") [read].
- World price per good = sold-weighted producer price plus export rent (end of `cpB`) [read].

**Tariffs**
- MFN rate per country = `taxes.tarif` (lever 0–100%, `uiMax 25`, `_doc`: "Assis sur les importations réelles.
  Protège l'industrie domestique, renchérit les exportations, irrite les partenaires." @15620338) [read].
- `ZZ@16175487` compiles: customs unions with an exclusive authority impose a common external tariff
  (trade-weighted, split agriculture/non-agriculture); agreements in force give a preference depth per pair and good;
  active act clauses (not `tariff_raise`, `EY@16168514`) add surcharges, summed and clamped to 0–100 [read].
- `Agg@16178556` / `bIA@16178508`: `rate = clamp(MFN × (1 − depth) + surcharge, 0, 100)`; services (`tertiaire`,
  `quaternaire`) are never tariffed [read].
- **Price effect**: `$LB@24993976` sets `_inputBorderMult[g] = clamp(1 + (effectiveRate − dayZeroRate)/100 ×
  importShare, .05, 3)`. It multiplies input costs (`sz@25003311`), household demand prices (`UnA`/`YOA`), the CPI
  basket (`VVQ@15073909` in `MLA`) and VAT bases [read]. So tariffs raise prices by the change since day 0 times the
  import share. Day-0 tariffs are part of the calibration.
- **Revenue**: the operating settlement (`HUQ@95801646` → `vUQ@95763228`) charges each buyer its share of the flow's
  `dutyValue = FOB × rate` and pays it to the importer's government (`resolveTariffPayee`) [read]. `tarif` is in the
  ledger-collected list `y0@25409976`, so `TeQ` (finance review 2.1) removes it from the formula revenue: no double
  count [read]. Customs value = FOB (`MnA@24942669`) [read].
- Disputes: `elB@16162981` moves consultations to `action_due` when the source act still targets the complainant
  (`rlB`); retaliation acts close the dispute as `retaliated` (`yIA@16161254`) [read]. Agreements (`mkQ@95281241`):
  mandate → negotiate → sign → ratify (per-country votes) → scheduled `+30` days → active; an FTA with < 2 parties
  lapses [read]. `pkQ@95284329` only garbage-collects old records [read].

**Sanctions and freezes**
- Monthly `NjB@87038297` → `pNB` (enforcement level per participant, minimum hold days) and `TjB@87037261` [read].
- Trade effect: `jV@15405564` compiles instruments into blocked exporter>importer pairs: `trade_embargo` both ways;
  `trade_arms`, `tech_export`, `trade_luxury` sender → target; `trade_metals`, `energy_embargo`,
  `import_embargo`, `import_forced_labour` target → sender [read]. `_Z@16198027` turns them into the CGE's blocked
  and per-good scoped matrices; war pairs (`fQ`) are blocked outright [read]. Leakage `TJA@16196632`: the enforcement
  level's leak share, multiplied by `landBorderLeakFactor` when the importer borders the exporter (`gmA@15403620`);
  leaked flows pay the importer's normal tariff and are capacity-limited [read].
- The "bite" index `mjB@87035755` / `LsA@87036553` (coalition share of world GDP × exposure × instrument severity) is
  stored in `_sanc` [read]. Its only simulation consumer is the shadow economy (`qzA@25347624` → `WyB`, `VyB`,
  `AKB@25350483`) [read]; elsewhere it is UI (`$AC@95946226`, `J0C`, `HhQ`).
- Sender's estimated cost `msA@87037040` = Σ severity × selfCost × sender's exposure to the target, written to
  `_sancSelfCost` [read].
- Asset freeze `VVB@87486082`: freezes positions in instruments issued in the sender's country and held by holders
  that `Fr@11354793` maps to the target country (households, companies, banks, SWFs, vehicles, treasury) [read].
  Frozen equity distributions go to a `blockedDividends` escrow (`baB@11362310`) [read].
- `_YQ@96002523`: AI democracies above a threshold join forced-labour import bans automatically [read].

**Balance of payments (`F6Q@93748717`)** [read]
- Current account `Em@87027337` = trade balance (FOB, from bilateral flows) + `externalBalanceAnchorPct` × GDP
  + aid received − aid given − external interest (coupons on externally held sovereign debt, net of IMF interest
  `toQ@93570657`) + FDI income delta vs day 0.
- `externalBalanceAnchorPct` (`exA@87027180`) is set once: data `exports0 − imports0` minus the model trade balance,
  as % of GDP, fixed thereafter [read].
- Reserve change `VBA@87028032` = (CA + private financing − (external principal due − rollover) + FDI inflow delta)
  × regime share `Q8g@87025670` {float .12, managed .45, peg .9, board .95, union .15} [read].
- Private financing `oxA@87027904` = `privateFinancingPct` × GDP, where `privateFinancingPct = −CA₀/GDP₀`
  (`DxA@87027707`, set once so day-0 reserves are flat). Inflows count only while `Ni` (not defaulted and rating
  < 17, `e8g=17` @87027643); outflows always count [read].
- Unions with shared reserves pool shortfalls (`_Hg@93748316`); reserves are floored at 0 [read].
- Posting `XM@93564202`: Dr official reserve asset / Cr `external_current_account_surplus` (or the reverse with
  a deficit account). The accounts belong to a separate `external-reserves:<country>` "central bank" entity
  (`G9A@93563002`), in USD [read].
- `U6Q@93747918` writes `caPctGdp` and `reserveMonths = reserves / (imports/12)` [read].
- Exports/imports (`YnA@25042521`) add a calibration "intra-industry" term `_intraScale × Σ min(prod, cons) × price`
  to both sides. `zUQ@95819258` fits `_intraScale` (0–4) so day-0 openness matches data [read].
- FDI `u6Q@93737079`: bilateral source→host flows reallocated by a logit on host score, chill and access; access is
  cut by sanctions and capital controls (`I6Q`) [read].
- NIIP `KVB@87468556` (monthly, from `l6B`): revalues portfolio equity and debt assets/liabilities by world vs
  domestic equity and bond indices (each step clamped to ×0.75–1.25), tops up from ledger-observed positions
  (`BPg`), and records valuation vs other changes [read].

**Currency (external side of `f6Q@93745327`, called by `_tickCurrencies`)** [read]
- Float/managed: `perUnit *= exp(f)`, `f = max(−25, PPP gap × v + l + k)`, with
  `l = clamp(−0.5 × realRateGap − 0.45 × clamp(caPct, ±12), ±12)` (× .45 when managed) and
  `k = clamp(14 × (REER − 1), ±10)`; FX orders from cross-border portfolio trades (`WVB@87485460`) move it by up to
  ±2% per day.
- `caPct` of a currency is the GDP-weighted *level* of its members' CA/GDP (`IH@93743032`).
- `reerC = deflator × perUnit0/perUnit / worldDeflator` (`w6Q@93713406`). Its consumers are the FX equation and
  tourism demand `AAQ@88005378` (`(reer0/reer)^Y9g`) only.
- Pegs break when reserve runway < 1 month without a guarantor (`L6Q@93750516`, finance review 4.1).

**International money flows** [read]
- Aid `rZB@87497826`: multilateral (donor `aide` budget × `intakeFrac .71`, split by poverty × (0.4 + affinity))
  and bilateral commitments. Treasury-to-treasury via `Co@11711622`/`PFA@11710554`; `_aidBn` and `_aidGivenBn` are
  booked symmetrically. Aid is netted out of donors' primary spending (`ZVB@87487298` = `SQA + xQA`).
- IMF (`soQ@93581130`, config `Fu`/`LC` @93567692): stand-by, rate SDR 2.904 + 0.6, grace 39 months, tranches
  25% + 6 × 12.5% at 3-monthly reviews. Commitment `Op@93571105` = min(external need, 5% of a size measure,
  free capacity). Disbursements credit **reserves** (`noQ@93574719`); interest and principal are paid **from
  reserves** (`$qg@93579370`). A failed review suspends the programme and retries monthly (`_qg@93578393`).
  Compliance (`S_A@93572474`) re-projects the signed budget package but substitutes the *current* tariff.
- EU funding `fHQ@95711172`: members pay `contributionGdpPct` monthly; the whole pot goes out as cohesion. ECB
  `OtQ@93891547` reviews on schedule.
- OPEC `r0Q@93909834`: entitlements drift to live capacity; quotas, compliance and "flood" mode (`e0Q@93911489`).
- Tolls `gBQ@92654667`: `tollTransfers` are paid treasury-to-treasury via `Co`.
- AI last resort `FLQ@96021491` → `TQC@96021334`: an AI country that is distressed and printing defaults
  strategically when its inflation and money impulse pass a threshold.
- Foreign-currency borrowing (player `borrowForeignCurrency` → `MLQ@96016316` → `iLQ@96015048` →
  `DjB@87000512` → `Ti@87001682`, then `PLQ@96015656` moves the proceeds into reserves): up to 3% of GDP per call
  while rating < 17. The only bidder is `rest-of-world:<country>:<ccy>`, whose cash `xNB@86981140` refills to
  max(1, 0.3 × GDP) bn from a net-worth account whenever it reaches ~0 ("foreign_opening_liquidity").

**Is world trade balanced?**
- Goods and services: yes at FOB. `MnA`/`vnA@24942140` credit `tradeValue = deliveredQty × fob` to the exporter and
  debit the same to the importer; the intra term is added to both sides of each country, so it nets out [read].
- Current account: no [inferred from `Em` read]. External interest is paid to anonymous `rest-of-world` holders,
  not credited to any country; reserves earn nothing; `externalBalanceAnchorPct` is a fixed per-country % of GDP
  with no global constraint; tolls, EU flows and cross-border freight are outside `Em`.

**Supplier choice and how politics reaches it (build 26335289, 2026-10-31)**

Traced from a player question ("how does Germany secure manganese-chromium from Russia?"). Names below are build
26335289. Live checks used a probe harness that booted the simulation worker with an eval hook (not included); [measured] means checked on a running game.
- **No supply contracts on Earth.** The only contract system ("delivery", "offtake", "concession") is the space
  colonies' (`l7A@93074508`, `A.space.contracts`, `earth-space-stock:` locations) [read]. Every Earth good is
  bought through the monthly market below.
- **Offers and needs** (`yzA@25170732`): a country first serves a protected share of its own use from its own output
  (`MUB`), then offers what is left to the world as one number per exporter. An exporter cannot favour or refuse a
  buyer [read].
- **Links and border rate** (`zJB`, `bIA@16409322`, `kkB`). Every exporter-importer pair is a link. It is closed
  when the two are on opposite sides of a war not marked `ended` (`d7B@15598887`; principals and co-belligerents only,
  supporters keep trading; a ceasefire or settlement phase still blocks) [read+measured], or under a full or
  good-scoped sanction (`y_`, `fe`). A sanctioned link leaks a share by the sender's enforcement: strict 2%,
  standard 10%, lax 35%, doubled across a land border (`IKA`, `AY.levels`) [measured]. The duty is
  `KIA = MFN × (1 − agreement depth) + act surcharges` (`J_@16384737`, `wrg`, `rrg`): MFN is the country's tariff or,
  for a customs union with exclusive competence (EU, Eurasian union), the bloc's WTO profile by division (T17);
  depth comes from agreements in force with their phase-in; surcharges from tariff acts and retaliation [read].
- **Landed cost** (`Grg@16435170`): price × (1 + duty) + freight, freight = base value × freight rate × route cost
  index (transport routes for routed goods, great-circle otherwise); home output gets a 5% preference (`z_`). A
  supplier already in the importer's trade memory is priced net of the duty and freight it had when it started
  (anchors carried by every flow, `ypB`), so only later changes count against it (T10) [read+measured].
- **Incumbency** (`qrg`, `OkB`, `mEg@23976764`): an incumbent's previous volume, scaled to the market, is split into
  a committed part and a renewal part; the renewal part is ranked at cost ÷ 1.15 (`O_`). The renewal share per month
  is 1 − (1 − g)^months with g = 25% for raw and lunar goods, 10% intermediate, 8% finished, 6% services, 5% gas and
  uranium. The opening pass competes; the execution pass (renewal 0) locks the opening result (`y=ypB(lA)`) [read].
- **Allocation** (`N_`, `hkB`): min-cost flow, maximum volume first (large negative return arc), committed tranches
  at cost 0, every other tranche at N+1 + normalised rank [read]. Controlled run on the game's own solver, Germany
  buying from Turkey (anchored) with a South African newcomer at real prices and route costs: the newcomer wins the
  renewal volume below 1,193.5 (22.4% under Turkey's 1,537.8), 18.6% without the anchor; it takes at most 25% in
  month one; at 30% cheaper its share runs 25, 44, 58, 68, 76, 82% over six months (1 − 0.75ⁿ) [measured].
- **Where relations and alliances enter.** A call-graph walk from the settlement entry (`IzA`, 157 functions, 8 levels)
  finds no read of relations, alignment (`F0`/`_alignment`), alliances (`Cg`), camps (`YI`) or grudges [read]. They
  act only through:
  1. war blocks (above);
  2. passage control: a canal owner, or a strait owner with naval superiority within 120 km, can deny one country,
     its camp (`YI`: Germany's camp is NATO, 32 countries) or everyone outside its own camp (`uPA`, `MWA`, written to
     `commercialAccess.denyActorIds`). Suez closed to Germany reroutes India→Germany ore round the Cape (13,615 →
     26,481 km, route cost +34%), Saudi oil +129%, Chinese electronics via Panama +16%; a strait closure with no fleet
     closes nothing [measured];
  3. trade-deal acceptance: each member's utility is the economic gain plus alignment × 0.006, accepted at ≥ −0.003
     weighted by GDP, refused outright when the sides are at war or under a full embargo (`iaQ@94273576`,
     `saQ`) [read]. Germany–Russia alignment is −0.574 at day 0 (relation −45.9 = alignment × 80) [measured];
  4. sanction enforcement: alignment with the target above 0.25 gives lax, at or below −0.25 strict, with a 0.1
     hysteresis and a one-year hold (`PxB@87163894`) [measured];
  5. coalitions: when the player sanctions, the largest economies aligned with the leader and against the target join
     (`Y3A`, `S_B`), with instrument willingness rising with the alignment gap (`m3A`) [read]. Other AI sanctions come
     from events (nuclear programme, UN resolution, security crisis, war backlash, expropriation, passage closures),
     not from relations [read].

  The relations score itself (−100 to 100, drifting to alignment × scale + aid + an ally floor − a sanctions penalty)
  is read by none of these; alignment is `F0@87684731`: 0.7 × product of bloc positions + 0.3 × ideology closeness +
  domestic-policy similarity − 0.6 rivals + 0.5 partners + ½ gratitude (military support) − ½ grudges [read].
- **Tariff acts.** An MFN tariff above the country's WTO binding creates an automatic all-goods act against every
  partner it harms (`F$g` → `UHQ`), which opens disputes and retaliation (`Z1C`); customs-union members are skipped
  [read]. The world event string "Export restrictions on rare earths" has no code behind it in any bundle [read].
- **Day-0 facts on 26335289** [measured]: Russia has no manganese-chromium capacity (four undeveloped deposits) and
  imports twice Germany's volume, all from Kazakhstan; Germany buys from Turkey (71%) and Finland (29%), both
  duty-free, and has no deposit; South Africa supplies duty-free under the EU–South Africa and EU–SADC agreements;
  Russia, Kazakhstan and Gabon pay 8.7%. Real world: Russia imports most of its chromium (about 70% from Kazakhstan
  and South Africa until 2022) and nearly all its manganese ore, so the game's day 0 matches.
- **Turnover** (same seed, day 0 to 186, 81 goods): freight share and supplier turnover are uncorrelated (Spearman
  −0.00; +0.46 among the 19 raw goods) [measured].

### What looks wrong

| # | Finding | Evidence | Conf. | Mod angle |
|---|---|---|---|---|
| T1 | **Foreign-currency borrowing is unlimited and always fully covered.** No cooldown (`MLQ`, `Ti` and the facade have none, unlike the 30-day domestic cooldown in D-section), and the only bidder's cash refills to 0.3 × GDP whenever it is drained. Scenario: a rating-16 country clicks "borrow" ten times in one day and adds 30% of GDP of USD debt at the anchor-currency rate + spread (`w_A@93433425`), with no auction failure and no yield response (D3 applies, without even the capacity wall). | `MLQ@96016316`, `DjB@87000512`, `xNB@86981140` (`WjA(...,"foreign_opening_liquidity")`), facade @96273300 | read+checked | Cooldown (e.g. 30 days) and an annual cap scaled by rating; refill the pool only at genesis or at a slow rate tied to world savings; reuse the D3 supply curve. |
| T2 | **The exchange rate reacts to the level of the current account, not its deviation from equilibrium.** Every structural deficit or surplus present on day 0 becomes a permanent drift: −0.45 × CA% per year until the REER term offsets it at REER − 1 ≈ 0.032 × CA%. Scenario: a floating currency with a day-0 CA of +8% (CHF-like) drifts ~26% into real overvaluation, one with −4% (USD/GBP-like) ~13% into undervaluation, with nothing having changed. The rest of the BoP is calibrated to day 0 (`exA`, `DxA`), so this term is the odd one out. | `f6Q@93745327` (`P=mu(a.caPct||0,-12,12)*.45`), `IH@93743032` (`caPct` = weighted level), `U6Q@93747918` | read (drift size inferred) | Use `caPct − caPct₀` (store day-0 per currency), or CA minus a norm. Day-0 neutral by construction. |
| T3 | **The nominal exchange rate barely reaches goods trade.** CGE producer and buyer prices are in a world numeraire; exporter prices in link ranking are `producerPrice` (`kgg`). A depreciation acts only through (a) the inflation module's currency driver (finance review 4.1) and (b) sticky local wages being eroded by the money log (`DGB@24039119` `moneyErosion`, `jUB@24030197`), which cuts unit labour cost in world units until wages catch up. Tourism is the only good with a direct REER elasticity (`AAQ@88005378`). Scenario: a 30% devaluation (`lLQ`, M6) leaves import prices in the CGE unchanged and improves export competitiveness only as fast as wages lag. Combined with T2, deficits do not self-correct through prices, so the FX drift does not close. | `kgg@16225966`, `JD@24995986`, `DGB`, `jUB`, `reerC` consumers (only `f6Q` and tourism) | read (mechanism) / inferred (strength) | Add an explicit pass-through: scale exporter offer prices by a short-run real-exchange-rate factor, or raise import buyer prices by (1 + depreciation × pass-through) in local terms. Broad: touches the CGE and calibration. |
| T4 | **Private capital flows are a fixed % of GDP with a cliff at rating 17.** `privateFinancingPct = −CA₀/GDP₀` forever: it ignores interest differentials, the rating (until the cliff), war or default risk elsewhere. At rating 17 or default, all inflows stop at once while outflows continue (`Ni`). Scenario: a rating-16 peg with a 5% CA deficit is fully financed; one notch later it loses 5% of GDP a year of inflows, and 90% of that hits reserves (`Q8g.peg=.9`), triggering the peg break within months. | `oxA@87027904`, `DxA@87027707`, `Ni@87027650`, `e8g=17` @87027643, `VBA@87028032` | read | Scale inflows smoothly by rating and real-rate gap (e.g. logistic around day-0 values = 1 at day-0 state). Day-0 neutral if the factor is 1 at the day-0 rating. |
| T5 | **Reserves earn nothing and are not linked to money.** `Em` has no investment income on reserves, so large reserve holders lose a primary-income line that the day-0 anchor freezes at its day-0 level. FX borrowing into reserves (T1) therefore has pure negative carry. Reserve changes post against the reserve entity's own CA surplus/deficit accounts (`G9A`), not the domestic central bank or deposits, so defending a peg or board never contracts domestic money and a surplus never expands it (no automatic "rules of the game"). | `Em@87027337`, `XM@93564202`, `G9A@93563002` | read | Add reserve income (world short rate × reserves) to `Em`; longer term, book reserve changes against central-bank reserves/deposits. The second part is broad (ties into F1/M3). |
| T6 | **The world current account does not sum to zero.** External coupons go to anonymous `rest-of-world` holders and no country receives them; reserves earn nothing (T5); anchors are fixed per-country shares with no global constraint; tolls, EU transfers and cross-border freight are outside `Em`. World reserves therefore drift with world debt and GDP mix, not with any counterparty. | `Em`, `BxA@86980296` holder ids, `gBQ@92654667`, `fHQ@95711172` | inferred | Diagnostic first: log Σ CA and Σ Δreserves monthly in a test run. Then credit external interest to holder countries where known, or to a modeled "rest of world" that does balance. |
| T7 | **A float can run reserves to zero with no consequence.** Reserves are floored at 0 and the unfunded part of the BoP gap is dropped. Only pegs/boards check runway (`L6Q`). The FX equation ignores reserves and the BoP gap. | `F6Q@93748717` (`$(Math.max(0,r))`), `L6Q@93750516` | read (no float effect found in these two functions) | Feed the unfinanced gap into float depreciation (or a stress flag) instead of dropping it. |
| T8 | **Asset freezes cannot touch central-bank reserves.** Reserves are a plain account of `external-reserves:<country>`, not a position in a sender's instrument, and `Fr` maps no central-bank or reserve holder id to a country. The defining 2022-style sanction (freezing a central bank's FX reserves) is impossible; freezes only reach private and treasury holders. | `VVB@87486082`, `Fr@11354793`, `G9A@93563002` | read | Add a reserve-freeze instrument that moves a share (by the reserve currency mix of the senders) into a frozen sub-account excluded from runway and IMF payments. |
| T9 | **The sanctions "bite" and "self-cost" numbers are display-only.** The real cost of sanctions comes from blocked CGE trade (good) and FDI access, but `_sanc.pressure/bite` only drives the shadow economy and UI, and `_sancSelfCost` (sender's cost) is computed, saved and shown but never read by the simulation. The AI and player see a cost estimate that does not correspond to any applied effect. | `TjB@87037261`, `msA@87037040`; consumers: `qzA@25347624` (shadow market), `$AC@95946226`, `J0C`, `HhQ` | read | Either label it as an estimate in the UI, or drop it. No simulation change needed; low priority. |
| T10 | **Incumbency bias in trade relations: real, but small for most goods (measured 2026-10-31, build 26335289).** Remembered (anchored) relations are ranked net of their anchor tariff and freight; new partners pay both in full, and the renewal share is ranked at cost ÷ 1.15. On the game's own solver, a South African newcomer must undercut Turkey by 22.4% to win Germany's manganese-chromium renewal volume; without the anchor 18.6%, so the anchor adds 3.8 points (Turkey's freight is 4.3% of its price). Freight is 9% of FOB value for manganese-chromium but 51% for bauxite, 39% timber, 25% iron ore, 17% coal, so the waiver is large only for bulk goods. Six-month same-seed turnover shows no freezing: freight share and supplier turnover are uncorrelated across 81 goods (Spearman −0.00, +0.46 among raw goods). Commodity ore really moves mostly on annual contracts, so stickiness itself is realistic; the permanent waiver of the incumbent's freight is not. | `Grg@16435170` (`s[z]=r[N]*(1+(I[z]-(cA?U[$]:0))/100)+X-(cA?m[$]:0)`), `ypB` (anchors carried by every flow), `qrg`, `O_=.15` | measured | Low priority. If touched: decay anchors over a few years so ranking converges to full delivered cost; check bulk goods in a long run. |
| T11 | **Reported imports include a fitted phantom "intra-industry" term**, so `reserveMonths`, peg runway (`YjB@87028804`) and the tariff-revenue fallback (`mZA@93382281`) use inflated imports. Its scale is fitted at day 0, so at day 0 this is a definition choice; later it grows with domestic output, not with real imports. | `YnA@25042521`, `zUQ@95819258`, `U6Q`, `YjB`, `mZA` | read | Use `imports − intra` for reserve cover and runway, and re-check the day-0 peg stress threshold (`W4=6`). |
| T12 | **NIIP valuation has no exchange-rate term.** Foreign assets and FX liabilities are revalued by equity and bond indices only, so a devaluation does not raise the local value of FX debt or foreign assets in the external position. | `KVB@87468556`, `duA@87467952` | read | Add an FX revaluation leg. NIIP consumers not traced, so impact unknown. |
| T13 | **Tolls are paid by governments, not by shippers, and outside the CA.** Canal/strait tolls move treasury cash country to country (`Co`); traders and buyers never see them in delivered cost. | `gBQ@92654667` | read (payer identity inferred) | Charge tolls through freight cost and the operating settlement. |
| T14 | **Foreign-currency issuance overwrites the domestic bond rate.** `Ti` sets `B.bondRate = clearingRatePct` for any non-bilateral issue, including USD issues priced off the anchor currency. | `Ti@87001682` (`Q.bilateral\|\|(B.bondRate=Q.clearingRatePct)`) | read (consequence depends on whether `Fp` overwrites it daily; not traced) | Skip the write when `Q.currencyCode !== sovereign currency`. |
| T17 | **Raw energy and mining goods pay a customs union's agricultural tariff (2026-10-31, build 26335289).** `si()` classes every raw good without its own division as `primaire`; for a customs territory the `primaire` rate is the WTO profile's agriculture trade-weighted average (EU: 8.7%) and `secondaire` the non-agriculture one (2.4%). All 19 raw energy and mining goods (oil, gas, coal, uranium, iron ore, bauxite, copper ore, manganese-chromium, lithium, cobalt, nickel and the rest) fall in `primaire`. Measured on live pairs into Germany: Saudi oil, Brazilian iron ore, US coal and Kazakh manganese-chromium 8.7%; Indian steel 2.4%. The same WTO profile the game cites puts EU petroleum at a 2.4% applied average with 97.2% of imports duty-free, and minerals and metals at 1.9% with 65.2% duty-free; crude oil and coal are 0% EU MFN (secondary tariff sites; TARIC not checked), and manganese ore is 0% to my knowledge (no primary source found). Only the EU profile is loaded (`JY.customsTerritories`), so only EU imports from non-agreement partners are affected, and the Eurasian union uses its members' average. Effect: EU raw-material imports from Russia (where not embargoed), Kazakhstan, Gabon, the Gulf, the US and Brazil carry a phantom 8.7% duty. | `si@16373678`, `J_@16384737` (`primaire:ii(n?.agricultureTradeWeighted,s)`), `DKA@16378431`, profile data `customsTerritories.eu` @~25.6M; WTO tariff profile 2025 (EU) | read+measured | Map raw non-agricultural goods to the non-agriculture rate (division by sector: `energy`/`mining` → `secondaire` rate, or a mineral rate near 0–2%). One-line data or function patch; shifts day-0 EU import prices for ores and fuels slightly (re-check day-0 trade and CGE prices). |
| T18 | **A reloaded save no longer continues like the unsaved game (Medium-High for multiplayer; measured 2026-10-31, build 26335289).** Unmodded, seed 12345, Switzerland: a straight run to day 61 and a run saved at day 31, reloaded in the same worker and run to day 61 (`headless/prototype/run-reload.mjs`) differ in all eight save parts (countries 256,335 values, finance 1.82 million, core 142,558, people 2), about 1e-6 relative: a small difference spread by chaos, not lost state. On 26296134 only `finance.revenueGdpPct` differed. The largest groups in `core` are tourism (`sim.tourismSettlement.rows.*`, including `originKey` and `destinationKey`, so the settlement rows themselves differ, and `_tourCommitted*`), operating inventories, the CGE commit and the epidemic compartments (`sat.epidemiology.countries.*.x`), which mix through tourism; this fits the open check in `public-services-review.md` 1.4 (tourism mixing on the first day after a load). The mod adds nothing measurable: the modded divergence is the same size (countries 259,692, finance 1.86 million). Multiplayer and any save-then-reload check depend on a reload being exact. | `run-reload.mjs` dumps; `OPA@88207114` (rebuilds `_tourCs` sorted), `zOQ@96886226`, `fSg@95314167` (needs `_tourCs` and `_tourFlow`) | measured (divergence); inferred (tourism as the first cause) | Trace first: diff day 32 straight vs reload part by part to find the first differing value, then fix the rebuild order on load. No mod change until traced. |

Checked and not a problem:
- Tariffs do raise prices (via `_inputBorderMult`, relative to day 0) and are not double-counted in revenue (`y0`).
- Aid is balanced between donors and recipients and netted out of donor spending.
- EU contributions equal cohesion payouts.
- Bilateral goods trade sums to zero at FOB.

### v0.1 candidates

Contained (one function or config object), day-0 neutral or nearly so, and deterministic (no clocks, no randomness):

1. **T2: FX on CA deviation** (`f6Q`). Store `caPct0` per currency at the first tick and use `caPct − caPct0` in the
   `.45` term. Day-0 neutral by construction. Anchors: method name `_tickCurrencies` (`_tickCurrencies(){return
   f6Q(this)}` @96264781) and the call label `"sim._tickCurrencies"` in `qEC@96187047`; inside `f6Q`, the regime
   string `"managed"` and the `.45` coefficient next to `caPct`. Expected effect: no FX drift from day-0 structural
   imbalances; FX still reacts to changes.
2. **T1: FX borrowing cooldown and cap** (`MLQ`). Add a `lastForeignBorrowDay` check (e.g. 30 days) and a rolling
   12-month cap (e.g. 3–6% of GDP by rating). Day-0 neutral (player action only; AI use not found). Anchors: event id
   `"finance.foreign_currency_borrowed"`, journal kind `"foreign_currency_bond_to_reserves"`, failure reason
   `"market"`. Optional second step: in `xNB`, refill `"foreign_opening_liquidity"` only when `A.day === 0`.
3. **T4: smooth the inflow cliff** (`oxA`/`Ni` use in `VBA`). Multiply inflows by a factor that is 1 at the day-0
   rating and falls smoothly to 0 by rating 18, instead of the `rating < 17` step. Anchors: journal kind
   `"external_current_account_reserve_change"` (in `F6Q`), config `Q8g` values `{float:.12,managed:.45,peg:.9,
   board:.95,union:.15}`, constant `e8g=17` next to `function Ni`. Expected effect: no single-notch sudden stop.
4. **T14: keep `bondRate` domestic** (`Ti`). One condition. Anchor: error string `"sovereign-bonds:auction-rate"`
   and journal kind `"sovereign_bond_issuance"`. Verify first whether `Fp` rewrites `bondRate` daily (if so, skip).
5. **T5 (first half): reserve income in `Em`.** Add `worldShortRate × reserves`. Because `DxA` sets
   `privateFinancingPct = −Em/GDP` on the first BoP tick, a new game absorbs the term at day 0; existing saves would
   see a step. Anchor: the `Em` formula shares the module with `"external-reserves:projection-mismatch"` (`XM`).
   Medium risk: shifts reserve paths for large holders; long-run test needed.

6. **T17: raw non-agricultural goods at the non-agriculture rate** (2026-10-31, build 26335289). In `J_`, give
   `energy` and `mining` raw goods the profile's `nonAgricultureTradeWeighted` (or a mineral rate) instead of the
   agriculture one; anchors: config key `agricultureTradeWeighted` and the division ids `"primaire"`/`"secondaire"`.
   Expected effect: EU duty on non-agreement oil, ores and coal falls from 8.7% to 2.4% (real applied averages 1.9–2.4%,
   mostly duty-free). Shifts EU import prices at day 0 slightly: check day-0 trade shares and CGE prices.

Not v0.1 (broad or calibration-sensitive): T3 (FX pass-through into the CGE), T5 second half (reserves ↔ money),
T6 (global CA closure), T8 (reserve freezes, new instrument), T10 (anchor decay), T11 (changes day-0 peg stress).

### Not yet read

- `vUQ@95763228` (36 KB operating settlement) beyond the tariff/freight rows: which currency cross-border payments
  are booked in, and whether exporter revenue and importer payments are converted at `perUnit`.
- `t2Q` (monetary reform in the trade settlement phase), `rAQ` tourism opening, `ZfB` field extraction, `VgQ`
  strategic stockpile settlement.
- Transport: `Z3A@92655852`, `V3A@92655478`, `qgA@92656146` (async solve queue), and `Y$B` called by the prewarm
  `doB@95825577`. `doB` loops on a wall-clock budget (`hUQ` = `performance.now`); it is deterministic only if `Y$B`
  is a pure cache. Not verified.
- How OPEC production (`e0Q`) reaches CGE oil supply and price.
- Resolved 2026-10-31: an MFN tariff above the WTO binding does trigger an automatic act, disputes and retaliation
  (`F$g` → `UHQ` → `Z1C`; see "Supplier choice" above).
- Remittance dataset (@10876486, `receivedGdpPct` by host): whether it feeds any income or CA line (not in `Em`).
- Sovereign bond coupons on frozen positions (equity escrow read; bond path not).
- Consumers of the NIIP record (T12) and of `reserveMonths`; the sign/meaning of the `reserves` rating input.
- The inflation module's import share used by the currency driver (finance review 4.1) and whether it includes the
  intra term (T11).
- IMF `Op` size measure `t` (assumed GDP) and `xqg` capacity accounting.
- `u6Q` FDI host score `V$A` and the FDI income model (`i6Q`).

---

## 5. Energy, resources and physical assets (E)

Scope: electricity (dispatch, pricing, trade, blackouts), fuel and mineral extraction (fields, depletion, OPEC),
plant construction, retirement and war repair, public facility maintenance. Read-only static analysis of build
26296134, `renderer/simulation-worker.bundle.js`. Tags as in the finance review: **[read]** = read in the code,
**[inferred]** = reasoning from code that was read. Finance findings are cited by ID (F1, F4, D…, M…, B…).

### How it works

**Cadence** [read]
- **Daily** (`qEC@96187047`): `prepareDailyBuildingEnergy` (`KHQ`→`G4A`), then `tickDailyEnergyService`
  (`_UQ@95833676`: `tR` climate, `st` dispatch per country, `ddA` delivers the month's electricity contracts,
  `pFB` burns the fuel reserve, `MhA@24809021` adds the day to the service ledger), then
  `settleDailyBuildingEnergy` (`bHQ`→`qFB@24769809`, a heat/cold exposure ledger for health).
- **Monthly** (`l6B@96160580`), in this order: `hLQ` extraction projects → `VfB` field lifecycle → `UzB` plant war
  repair → `RBQ` production routes → `oCQ` transitions → `hHQ`/`omQ` building energy → `m9Q` disaster
  reconstruction → `$UQ` seal the service window (`lhA`) → world trade/CGE (`xUQ`, inside it `jUQ@95826471` runs
  `ZfB` reserve depletion) → `_rQ` maintenance factor → `_tickConstruction` (`YrQ`) → `_tickEnergyRetirement`
  (`uIQ`) → `tR` → `tickEnergyMarketPhases` (`AGQ`) → … → `aggregateProvincePower` (`QT`, display only) → … →
  OPEC (`r0Q`) near the end.
- `AGQ@95834456` [read]: per country `yFB` (fuel-reserve deposit), `ZUQ`, `K$` (demand `YbA` + dispatch `st`);
  then AI builds (`p1B`); then `iy(A,false)` prices before trade, `ER` electricity trade (settles last month's
  contracts in treasury cash, opens new ones), `iy(A,true)` prices after trade and moves the retail contract,
  then `M$g`.

**Electricity demand and dispatch** [read]
- Demand `YbA@24102348` + `UbA@24100951`: formal employment × `overheadMWhPerWorkerYear` per sector, tertiary
  floor area, CGE production × `processTWhPerCgeUnit`, and residential/heating/cooling from the building model.
  No price term anywhere in these two functions.
- Dispatch `st@24795824`: one copper plate per country. Capability = capacity × weather (`_wxAvail`) × grid
  availability × a sector-capacity factor (`whA`/`cEg`), fuel-limited by the plant fuel reserve (`J4A@24781889`).
  It writes `gen`, `deficitTWh`, `deficitFrac`, `marginPct`, `co2Mt`. The player gets
  `energy.blackout_started` above 3 % unserved (`d5Q@94882167`, `Py=.03`).
- Fuel reserve: monthly deposit = CGE `powerFuelUsed` × dt (`yFB@24777699`), daily withdrawal = generation /
  `ZbA` (`pFB@24777251`). The config `_doc` (@15269400) says plants hold 1–36 months of normal burn and only a
  delivery block empties it.
- Climate `tR@94882051` sets `_wxAvail = {solar: _climSolar}` only. Wind, hydro and thermal plants are not affected.

**Electricity price** (`iy@94874794` → `EYB@24792717` → `s5Q@94874293`) [read]
```
systemCost   o = Σ gen_s × (O&M_s + fuel_s(CGE price index) + carbonPrice × co2_s)
supplyCost   s = max(0, o − tradeBalanceBn)                  // export revenue lowers it, import bill raises it
wholesale    i = s / domesticTWh
capital      u = Σ gen_s × VFB_s × fleetCapitalShare_s / domesticTWh × capexMult(GDP/cap, 0.45–1.35)
retail spot    = (70 $/MWh × gridMult(density, 0.8–1.4) + i + u + legacyCarbon) × (1 + nrj tax)
marginalCost   = max(most expensive running unit, import price) + 600 × clamp(4·deficitFrac) if deficit > 0.5 %
```
- `VFB_s = capex × 0.08 / (cf × 8.76)` $/MWh (`capitalChargeRate:.08`, @24785886). `fleetCapitalShare_s`
  (`qzB@26292213`) = `fleetCapitalRemaining` from config × the share of capacity that is **not**
  `stateFundedGW` (`Y8A@26292111`). The config `_doc` (@15269400): "the tariff only charges this remaining
  capital; a plant built by the Treasury is paid cash at the site and adds none".
- The retail contract moves toward spot each month by a share set by the `electricity_market` law: state monopoly
  0.04, single buyer 0.12, regulated competition 0.25, liberalized 0.5 (`retailAdjustmentByMarket`, `wYB`).
  `consumerRetail = contract × (1 − elecSubsidy)`; `relPrice = consumerRetail / _retail0`.
- Where the price goes [read]:
  - CPI: `vr@15074312` = (1 − w)·goods CPI + w·`relPrice`, with w = day-0 electricity share of CPI.
  - Satisfaction/approval: `P$A@93662827` (relPrice and unserved-since-day-0), `S9A`/`d$A` (`powerServiceShock`).
  - Sector costs in the CGE: `QmB@25004888` sets `powerCostUnit` = sector MWh per unit × (genCost − day-0 genCost),
    clamped to [−20 %, +150 %] of the base price. Industry sees unsubsidised **spot** `genCost`, not the contract.
  - Subsidy cost `A8@24794260` = `ohA@24790091` (all served TWh, intermediate uses included, × contract price) ×
    subsidy; booked as budget line `spending:electricity_subsidy` (`T7A` list @93393048).
  - Energy tax on electricity `IPA@92791257` = actual sales × t/(1+t): a real base, unlike F4.

**Blackout cost to output** [read]
- `lhA@24811127` seals the monthly window: per sector `serviceFactor = served/requested` and
  `relativeServiceFactor = serviceFactor / referenceServiceFactor`, clamped to [0, 1]. The reference is day-0
  demand by use served by day-0 grid supply (`dhA@24812450`, `pEg@24808018`).
- `FOA@25004479`: `we.powerAvailability[sector] = clamp(1 − (1 − relativeServiceFactor) × powerCritical, 0.02, 1)`,
  read by the CGE production functions (`_$@25007980`, `DAA@25006724`, `$aA@23988886`). Household
  `powerCritical` is 0.92 (config @24006420).
- `lhA` also computes `unservedCostBn = unservedTWh × 600/1000` (VoLL) and the config carries `recoverable`
  ("share of lost output that can be caught up").

**Electricity trade** (`ER@94878930`) [read]
- Country pairs sorted by marginal-cost gap; flow = min(exporter surplus line, importer line) × clamp(gap/25, 0, 1)
  for gaps ≥ 1 $/MWh. Price = midpoint of the two marginal costs (VoLL term included).
- Line capacity `ldA@94876036` = natural share × own demand + built `intercoExtraTWh`; **0 import capacity if the
  country is in default**.
- Settlement `yTg@94878241` → `JTg@94877346` → `Co`/`PFA@11710554`: importer **treasury** expense → exporter
  **treasury** revenue (`purposeId:"electricity_trade"`), with automatic financing for the importer, arrears if
  defaulted. The same `_eRevBn` becomes `tradeBalanceBn` (`QeB@94877239`) that enters `EYB`'s supply cost.

**Construction, capex and retirement** [read]
- Plants: quote `yj@93250223`: cost = capex($Bn/GW) × GW × material-price multiplier `t7A` / max(0.8, design),
  months = buildMonths / √design (+ nuclear licensing). `a7A@93254952` opens the project with
  `purchaseFunding` from the treasury cash account (`ir@11277140`/`lG@11275706`): materials are bought through the
  CGE and posted to `construction:<id>:*` accounts. Completion `LrQ@93265041` adds a plant (or GW to an existing
  one) with `stateFundedGW += gw`. Budget-funded programmes (public facilities, building energy, adoption,
  efficiency) buy from the **budget** cash account, which `J1Q` fills as `reservedExpenseBn` (@93440805).
- AI builds `p1B@95215872` → `dXg@95209114`: build when firm capacity < demand × (1 + day-0 margin, floored at 0).
  `zXg` tries plant expansion, then a new project. The only financial gate is `Fe` (defaulted and cash below a
  floor, `Fe@25888210`).
- Retirement `uIQ@93977313` runs **mandated** schedules only. `cIQ@93975755` pays `decom × GW` via `X6` (treasury
  expense, no payee) and does nothing if the payment fails. No plant lifetime or age field exists (searches for
  `lifeYears`, `builtYear`, `commissionYear`, `plant.age`: 0 hits).
- War damage `fzB@26292771` (plants), `NfB@23780089` (fields): repair date = today + 14 + 166 × damage days
  (`baA@23775617`). `UzB@26293480` and `VfB` restore capacity linearly / at the date. No payment anywhere
  (searches `repairCost`, `repairBn`: 0 hits). Disasters, by contrast, are paid: `m9Q@94828808` funds a recovery
  (`MrB`) and adds construction demand to the CGE.
- Public facilities: maintenance = 1 %/yr × facility capex × `_publicFacilityMaintenanceContractFactor`
  (output per head vs world × construction price index, smoothed over 12 months by `_rQ@93287114`), in budget
  line `spending:public_facilities` (`kp@93287444`, `Bdg@93287235`).

**Extraction, depletion, rents** [read]
- Projects `$PA@93139147`, quote `ip@93135543`: cost = unit cost × years × difficulty × local-income/power
  factors. Funded by a company if one can fund it (`fundingSource:"company"`), otherwise by the treasury.
  `foreignCost` is always 0. Viable if annual value > operating cost (`viable:…N>X`): no capex payback test.
  Progress `BwQ@93142635`/`ec@11272999` follows material deliveries.
- Field capacity enters the CGE as `we.extractCap` per owner country, summed over all its fields whoever paid
  (`inA@24933791`). OPEC members' oil is throttled by `prod/liveCapacity` (`qmB@24934693`).
- Lifecycle `VfB@23782834`: **new** fields ramp → plateau → decline (`capacityFlow *= 1 − declineRate/12`).
  **Seeded (day-0) fields skip that block** (`!B.seeded`) and start in "plateau" (`kKA@23778043`).
  All depleting resources (`D2`, every non-harvest extract good, @23771405) also have
  `flow = capacityFlow × haA`, where `haA@23782678` = min(1, (reserveLeft/reserveInitial / 0.6)^0.8):
  no decline until 40 % of the reserve is used.
- Depletion `ZfB@23784411` (after the CGE solve, `jUQ`) draws reserves down by the country's actual CGE production
  of that good, allocated to fields by flow.
- No royalty, severance or resource-rent tax exists for terrestrial extraction (the only `royalt` hits are space
  operators and technology licences; en.json has "Extraction royalty" only under `colonies.*`). Rents stay in the
  extracting sector's companies; the state gets corporate tax `is` and dividends on its `publicShare`
  (`qaQ@94060232`, `zeQ@93388426`).

**OPEC** (`r0Q@93909834`, review `yGg@93910081`, quotas `e0Q@93911489`) [read]
- Price `oBB` = CGE world oil price. Outside the band the members vote to cut or raise the target; quotas scale
  each member's entitlement; compliance drifts toward a cheat-adjusted level (state extraction share `extractOwnership`,
  default 0.4, alignment with the leader, `floodFear`). The leader swings to defend, or floods. The result throttles
  CGE oil output (`qmB`).

**Fossil fuel prices** [read]
- Fuel prices are the CGE's (`i1@11291109`: country price / base; `gxQ@11290683`: world price).
  `commodityMarkets` (`IUQ@95751254`) only records a projected history of the CGE price (`authoritative:false`).
  How the CGE clears oil, gas and coal was not read.

**Carbon tax** [read]
- `xf@93384929` → `c0A@15628575`: revenue = rate × `bases.carbon` × efficiency, with `bases.carbon` =
  (0.6 % rich / 1.1 % other of GDP) × `s$Q@15616237` = 0.65 + 0.35 × power CO₂ / day-0 power CO₂ (`n7B=.35`).
  The same price also enters the power system cost in `EYB`.

### What looks wrong

| # | Finding | Evidence | Conf. | Mod angle |
|---|---|---|---|---|
| E1 | **Electricity trade is paid twice.** The importer's treasury pays the exporter's treasury in cash, and the same bill is also added to the importer's tariff (supply cost `s = o − tradeBalance`). The exporter's treasury books the revenue while its consumers also get it as a lower tariff. Scenario: a hydro exporter selling 20 TWh at 80 $/MWh books $1.6 Bn of state revenue and also cuts its own retail price by $1.6 Bn worth; the importer's consumers and its state both pay. The generators that produced the power receive nothing. This is the F1 pattern applied to power. | `ER@94878930` (`_eRevBn`), `QeB@94877239`, `EYB@24792717` (`s=max(0,o-c)`), `JTg@94877346` → `PFA@11710554` (treasury expense/revenue) | read (double count inferred from the read pieces) | Keep one channel. Short term: settle in cash only, and drop `tradeBalanceBn` from the tariff, or keep the tariff and drop the treasury settlement. Root fix with F1: settle between utility accounts. |
| E1b | **E1 traced end to end (2026-10-30, build 26318758).** The tariff includes net imports (`aLB@24849007`: supply cost = own generation cost - the electricity trade balance; feeds `py@94943114`, then `bvQ`); consumers, firms and the state pay the tariff to the utility companies (`DgQ@92849833`, `electricity_service`), and nothing there makes utilities pay for imports; the cross-border bill is paid treasury to treasury (`jjg@94945666` -> `Co`/`EYA`, `electricity_trade`). So importer utilities keep the import bill as a windfall that their state pays, and exporter utilities never recover the cost of exported power, whose cash goes to their state. About $137 bn a year of treasury payments at month 3 (unmodified); Suriname pays about 25% of GDP for 4.6 TWh (about $480/MWh) because the bilateral price is the midpoint of marginal costs and a short country's includes the $600/MWh lost-load value. The utilities' accounting profit in `ncA@25098463` is net of imports but its cash line is 0 (not traced further). | `aLB`, `DgQ`, `jjg`, `ncA` | read (builder) | Deferred (2026-10-30): settle utility to utility, together with the price. |
| E2 | **Who pays for power capital is inconsistent.** The day-0 fleet charges `fleetCapitalRemaining` × 8 % × capex in the tariff **forever** (no amortization), while every GW the treasury builds charges nothing (by design, per the `_doc`). Building plants dilutes the capital share, so state construction lowers retail prices, the CPI (via `vr`) and lifts approval. Scenario: doubling a nuclear fleet with treasury money halves nuclear's capital component in the tariff. The capex is a treasury expense with no recovery, and the tariff's capital part is paid to no account. | `qzB@26292213`, `Y8A@26292111`, `LrQ@93265041` (`stateFundedGW`), `VFB` @24785886, config `_fleetCapitalRemainingDoc` @15269400, `vr@15074312` | read | Amortize the day-0 remaining capital over the remaining life in the `_doc` (hydro 35 yr, nuclear 25, coal 20, …). Optionally let state-built GW carry a capital charge that is paid to the treasury. |
| E3 | **Plants never age, wear out or need replacement.** Retirement only runs mandated schedules, and there is no lifetime or commissioning-date field. Capacity is a one-way ratchet (minus war, mandates, manual closure), so a 30-year game has no replacement-investment burden, and the day-0 fleet's capital charge (E2) runs forever on plants that would have retired. | `uIQ@93977313` (schedule only), `LrQ@93265041` (no age), searches for age fields: 0 hits | read (absence by search) | Add a build year (day-0 fleet: age from the `_doc` averages) and age-based derating or retirement with AI replacement. Larger change. |
| E4 | **War damage to plants and fields is repaired for free.** Repair takes 14–180 days with no payment, no materials and no construction demand. Disasters, by contrast, are paid and create CGE construction demand. Scenario: a fully destroyed 1.4 GW reactor (capex ≈ $8 Bn) is back in six months at zero cost; strategic bombing costs the victim only the downtime. | `fzB@26292771`, `NfB@23780089`, `baA@23775617`, `UzB@26293480`, `VfB@23782834`; contrast `m9Q@94828808` | read | Charge repair = damage × capex × material multiplier through the treasury (or the CGE construction good, like `m9Q`), and pause the repair while it is unpaid. |
| E5 | **Day-0 fields don't decline.** Seeded fields skip the ramp/plateau/decline block and produce flat until 40 % of their reserve is gone (`haA`). Real mature fields lose about 5–8 %/yr without investment. New fields get both the profile decline and `haA`, so they decline faster than day-0 ones. Result: world oil and gas supply needs no reinvestment for decades, so depletion never pressures prices or petrostate budgets in a normal game. | `VfB@23782834` (`!B.seeded` gate), `kKA@23778043` (seeded → "plateau"), `haA@23782678` | read+checked (magnitude not measured: fields are not in the economic checkpoint) | Give seeded fields a base decline (per resource, e.g. oil 6 %/yr) and drop the double decline for new fields (profile **or** `haA`, not both). Needs AI extraction investment to respond. |
| E6 | **Public capex, private rent.** Treasury-funded fields and plants add capacity to the country's sector (`extractCap` sums all fields), but the sales revenue goes to that sector's companies in proportion to ownership. The state gets no royalty, concession fee or equity for the asset it paid for. There is no resource-rent tax either, so a petrostate with a privately owned oil sector collects only corporate tax (F4/F5) on an oil boom. Extraction quotes are viable on operating margin alone, with no capex payback test. | `inA@24933791`, `ip@93135543` (`viable:…N>X`, `foreignCost:0`), `$PA@93139147`; `royalt` search (space and licences only) | read (revenue distribution inferred) | Add a royalty / rent tax (a tax id with a real base: extraction value from the CGE), or give the state an equity stake in the sector for public capex. Add a payback test to `ip`. |
| E7 | **Fixing a day-0 blackout problem gives no output gain.** The production penalty uses service relative to day 0, clamped at 1. Countries that start with chronic shortages (the checkpoint has `unservedShare` up to 0.20, and about 5 % or more unserved in a handful of countries) get nothing from building out their grid. Approval gains nothing either, since `P$A` uses `max(0, unservedSinceT0)`. | `lhA@24811127` (`relativeServiceFactor` clamp), `rhA@24784978`, `FOA@25004479`, `dhA@24812450`/`pEg@24808018` (reference), `P$A@93662827`; checkpoint sample | read | Let `relativeServiceFactor` rise above 1 up to 1/referenceServiceFactor (a productivity gain from better supply). Day-0 neutral (the ratio is 1 at day 0). |
| E8 | **Dead variables: VoLL cost and `recoverable`.** `unservedCostBn` (600 $/MWh) is computed and never read, in either bundle. `recoverable` (lost output that can be caught up) is copied into the ledger, but `FOA` uses only `powerCritical`. Blackout output loss is therefore permanent, and its cost appears only through the CGE. | `lhA@24811127` (only occurrence of `unservedCostBn`; none in `app.bundle.js`), `FOA@25004479`, `PhA`/`MhA` | read | Use `recoverable` to carry a share of the lost output into the next month, or remove the field. Use `unservedCostBn` in the UI/AI, or drop it. |
| E9 | **Electricity demand has no own-price elasticity.** Demand comes from employment, floor area, CGE output and weather. A price spike, a tax or a 100 % subsidy leaves consumption unchanged, except indirectly through CGE output. Subsidies therefore have no deadweight loss, and scarcity pricing does no demand response. | `YbA@24102348`, `UbA@24100951` (no price term); building model `G4A` not read | read (partial) | Multiply residential/tertiary demand by relPrice^ε (ε ≈ −0.1 short run, −0.3 long run). Day-0 neutral (relPrice = 1). |
| E10 | **The electricity subsidy lowers firms' cash bills but not their production costs (fixed by the mod).** The subsidy is charged on all served TWh, industrial use included, and firms pay the subsidised price in cash, but the sector cost model (`powerCostUnit` in `CpB@25061406`) uses the change in unsubsidised generation cost, so the industrial part of the subsidy raises firm profits without lowering production costs, prices or output decisions. | `CpB@25061406` (`powerCostUnit`), billing `DgQ@92849833`, `_hA@24846375`, `g8@24850550` (26318758) | read | Pass the change in support per MWh into `powerCostUnit` (patch `e10-power-subsidy`, 3fdbb31). |
| E11 | **Retail smoothing is unfunded.** Under a state monopoly the contract price catches up 4 %/month (half-life about 17 months). The gap between spot and contract × TWh is booked nowhere (the `_doc` says the producer margin carries it; no such posting exists). Households and the CPI are shielded from a fuel shock for free, while industry pays spot at once. | `s5Q@94874293`, `wYB@24790446`, `retailAdjustmentByMarket` @15269400; `retailSpot` read only by `s5Q`/`CYB`/`_eA` | inferred | Book the gap as a utility loss or a treasury "regulated tariff" cost (like the subsidy line), or tie the speed to a fiscal cost. |
| E12 | **Default cuts electricity imports to zero at once.** Import capacity is 0 when `defaulted`, a direct consequence of state-to-state settlement (E1). An import-dependent country that defaults falls into a blackout in the same month, on top of the default shocks (D8, `_f`). Real cross-border power keeps flowing on prepayment or collateral. | `ldA@94876036` (`importCapTWh:B.defaulted?0:…`), `JTg` (`allowPartial`) | read | Let a defaulted country import against cash (prepaid), capped by treasury cash. |
| E13 | **The carbon tax is mostly a GDP tax.** 65 % of the carbon base is a fixed GDP share that never shrinks with abatement, and only power-sector CO₂ moves the rest. Decarbonising to zero keeps 65 % of revenue, and industry and transport abatement has no effect. This is an F4 case. | `c0A@15628575` (`case"co2"`), `To@15627574` (`carbon:(B?.006:.011)*s$Q(A)`), `s$Q@15616237`, `n7B=.35` @15616229 | read+checked | Raise `n7B` to 1 (base fully proportional to power CO₂), or compute revenue = price × modelled emissions. Day-0 neutral (the ratio is 1 at day 0). |
| E14 | **Decommissioning is paid to nobody, and a failed payment silently skips a mandate.** `X6` books an expense against treasury cash with no counterparty (F1). If the payment fails, the scheduled plant just stays, with no arrears and no event. | `cIQ@93975755`, `X6@11707547`, `uIQ@93977313` | read | Minor. Pay the CGE construction sector; record arrears or retry. |
| E15 | **`_tot` "terms of trade" is not a price ratio.** It is (exports / real GDP − day-0 value) × 1.5, and it feeds the profit tax base (`To`, ×0.1). An oil price windfall moves it only through export value. `M$g` computes an energy price composite (0.6 oil + 0.25 gas + 0.15 coal) and returns it from the `AGQ` generator, where `for…of` discards it. | `M$g@95834186`, `AGQ@95834456`, `To@15627574`, `R$A@93712386` | read (units of `exports` vs `gdpVol` inferred) | Rename or redefine as export/import price ratio. Delete the dead composite. |
| E16 | **Climate touches only solar.** No hydro drought, no wind variability, no cooling-water derating of thermal plants in heatwaves, although the building model tracks heat and cold exposure. | `tR@94882051` | read | Add hydro availability from a precipitation anomaly, if the climate state carries one (not checked). |
| E17 | **Interconnection is a per-country pool, not a per-border line.** Capacity is natural share × own demand + own built GW, so a unilateral build is usable on every border up to the neighbour's pool. | `ldA@94876036`, `ER` | read | Low priority. |
| E18 | **The tariff's capital charge ignores what plants cost.** Capital in the tariff scales with GDP per head (`AeB`, 0.45–1.35), while actual construction cost scales with material and local building prices (`t7A`/`CT`). Network cost is a flat 70 $/MWh × density for every country. | `AeB@94873417`, `$rB@94872992`, `yj@93250223` | read | Low priority; tied to E2. |
| E19 | **Strategic reserves cannot cover critical minerals, and new reserve goods cannot be added by data (2026-10-31, build 26335289).** The reservable goods are a data table (`zm.goods`: oil, gas, coal, grain), and every reserve function is generic per good: government fill demand bought on the normal market, release when the good's fill rate drops below 98.5% or (stress rule) its price is 18% above reference (`Odg`), AI target management (`N_g`), units via `ZO` (non-zero for manganese-chromium), and the reserves screen lists whatever `stockpiles` holds. But reserves are created only by genesis (`lwQ` and the account opener `twQ` inside `W6B`), and a new game adopts the shipped day-0 checkpoint, where `W6B` returns early, so a good added to the table gets no reserve anywhere (measured: 0 countries). The player's reserve command refuses a good with no record (`YCA`, reason `reserve`). Prototype (measured): a reserve created after the checkpoint with the game's own account steps (two treasury accounts, book value 0) passes the accounting checks, the player command sets a 60-day target, filling buys about 0.0175 Mt a month (about 5.5 days of Germany's use, €23M in three months), and the save reloads identically; without the patch the save loads and plays, the reserve is dropped and its inventory value stays orphaned in the ledger. Release works (measured): a metals embargo on all 11 producers cut Germany's imports by about 85%; the fill rate read 0.96 in month one (the reserve still bought, since release reads the previous month) and 0.29 in month two, when the reserve released on "disruption" and drew from 0.068 to 0.0045 Mt over two months. The embargo also recruited coalition partners (US, UK, Spain, Japan, France, Australia joined some regimes). Real world: Japan's stockpile (JOGMEC) targets 60 days including chromium and manganese; the US National Defense Stockpile lists ferrochromium and ferromanganese; the EU's 2024 Critical Raw Materials Act plans joint purchasing and a stockpile pilot; Germany's KfW raw-materials fund (2024, €1bn) takes equity in mines with binding offtake. | `zm`@25586008, `xM`, `lwQ@93163551`, `twQ@93157562`, `W6B@96391323` (checkpoint branch), `AE@93156584`, `YCA@93171580`, `N_g@95642578`, `Odg@93172893`, `JwQ@93173600`, `kTQ@96986592` | read+measured | Candidate E19: a code patch that, at day 0 after the checkpoint (and once on loading an older save), adds empty fillable reserves for chosen minerals and opens their accounts as `twQ` does. Open design choice: sourced holders only (Japan, Korea, US, China) or every net importer. Day-0 neutral when empty. |

### v0.1 candidates

Contained (one function or config object), deterministic and day-0 neutral or nearly so:

1. **E13 carbon base** — change `n7B` from 0.35 to 1 in `s$Q`. Day-0 neutral, because power CO₂ / day-0 power CO₂ = 1.
   Anchor: the carbon tax entry `id:"co2"` with `name:"Taxe carbone"` (@15618654), and the `case"co2"` in
   `c0A`. Effect: carbon revenue falls as power decarbonises, so the carbon tax is no longer a free GDP tax.
2. **E4 war repair cost** — in `fzB`/`NfB` (or at repair start in `UzB`/`VfB`), charge
   `damage × capex × GW × t7A` through `X6` with a new `purposeId`, and hold the repair while unpaid. Anchors: event
   `intelligence.infrastructure_restored` (in both `UzB` and `VfB`), field `_warRepairDay`. Day-0 neutral.
3. **E7 blackout clamp** — in `lhA` allow `relativeServiceFactor` up to `1/referenceServiceFactor` (cap e.g.
   1.25). Anchors: error strings `serviceDeliveryBaseline` / `serviceDeliveryBaseline.gridSupplyTWh` (`XO`),
   config key `powerCritical`. Day-0 neutral; affects only countries that improve on day-0 supply.
4. **E10 subsidy scope** — in `ohA`/`A8` exclude `useKind==="intermediate"` from the subsidy cost, or document it.
   Anchor: budget line id `spending:electricity_subsidy`; error string `energy:fuel-price-index:` (`thA`, next to
   the pricing code). Day-0 neutral if `elecSubsidy` is 0 at start (`AfA` defaults it to 0; per-country data not checked).
5. **E1 double-counted trade** — the smallest patch is to stop `QeB` from feeding `tradeBalanceBn` into `EYB`,
   keeping treasury settlement. Anchors: error strings `electricity-trade:unsettled-delivery`,
   `electricity-trade:counterparty:`, purpose `electricity_trade`. **Not day-0 neutral**: exporters' and
   importers' tariffs move at once (`_retail0` is set at init in `ufQ`), so re-baseline `_retail0` or phase it in.
6. **E2 amortization** — in `qzB`, multiply `fleetCapitalRemaining` by max(0, 1 − years since start / remaining
   life). Config key `fleetCapitalRemaining`, `_fleetCapitalRemainingDoc`. Day-0 neutral; tariffs then drift down,
   so check CPI and approval over 10 years.
7. **E12 default import cliff** — in `ldA`, replace `B.defaulted?0` with a cap from treasury cash. No string in
   `ldA`; anchor on the `importCapTWh:` / `exportLineTWh:` keys. Small change; can shift day-0 flows for any
   country that starts in default.

Larger, not v0.1: E3 (plant ageing), E5 (field decline, needs AI reinvestment), E6 (royalties or state equity),
E9 (demand elasticity), E11 (funded smoothing), and E1 done properly with F1.

Fusion/He3 and space: not reviewed. The only related note is that space operators have royalties
(`Ep@92822772`) while terrestrial extraction does not (E6).

### Not yet read
- The CGE clearing of oil, gas and coal world prices (`cpB@25020643`, `qnA@24959297`), and whether a supply cost
  curve uses field grade or difficulty. Price formation for fuels in this area therefore rests on code not read.
- The dispatch merit order `DYB@24791787` / `m$@24786935` and the VRE integration cap `RO` (`vreBaseFirmShare`).
- The building-energy model (`G4A`, `hHQ`, `omQ`, `xHQ`): heating/cooling demand, carriers, AI building
  programmes, and whether it has a price response.
- Who receives the material purchases of `purchaseFunding` projects (`Qo`, `oZA`), and whether treasury cash can
  go negative during construction.
- AI source choice and fiscal check for power projects (`OXg`, called from `p1B`; `startPowerProject`), and AI extraction
  investment (whether it reacts to depletion).
- The strategic stockpile market (`O1B`→`vWg`, `VgQ` throws if plans exist; matched settlement not found).
- `KGB` (first call in `_UQ`), `ddA` (daily contract delivery), `v5Q`, `ECQ` (transition sync after the CGE),
  `jPA` (fusion), `W1A` (capital deepening).
- Whether the fuel-reserve deposit (`yFB`) is capped at the target, or can grow without limit if CGE fuel purchases
  exceed burn.
- Seeded field reserve sizes: fields are not in `economic-t0-checkpoint.json.gz` (a regex pass found none), so
  E5's time-to-decline is not measured.

---

## 6. Households, labour, population and housing (H)

Build 26296134, simulation bundle `renderer/simulation-worker.bundle.js`. Static read only; nothing measured in play.
Tags: **[read]** read in the code; **[inferred]** reasoning from read code; **[ckpt]** a day-0 value read from
`renderer/economic-t0-checkpoint.json.gz` with a small streaming script.

### How it works

**Monthly household cycle** (called from `l6B@96160580`)
- `o4B@11404898` zeroes each household's `currentFinancialIncomeBn` / `currentFinancialExpenseBn` [read]. Only the
  helper `ms@11405028` adds to these counters (deposit interest, loan interest and the like) [read].
- `T4B@11672406`, household banking [read]:
  - It pays deposit interest at the bank's `depositRatePct`: Dr bank interest expense / Cr bank deposit liability,
    and Dr household deposit / Cr household financial income.
  - It runs debt service `IFA@11668163` on every active household loan. Arrears only set `delinquent` (B3).
- `t4B@11407602` → `$xQ` → `_xQ@11406099`, monthly accounting per pop group [read]:
  - `savingBnY` = change in financial assets × 12. It is a report only and drives nothing (all 9 hits read).
  - `annualFinancialIncomeBn` is a smoothed net (income − expense) financial flow.
  - `expectedDisposableIncomeBnY` moves toward `NX(w).disposableBnY` with a 6-month half-life (`OxQ@11375396`,
    `XaB=6`).
  - Net worth is refreshed from the ledger (`Pd`), and `pops.group.wealth = netWorthIndex`.
- `XLQ@96033483`, dust: sweeps deposits below a threshold into bank resolution income, and writes off tiny
  non-mortgage loans through `I6A` [read].

**Household income is settled in the operating settlement** `Q$g@95812938`, not in `anB` [read]
- Payroll obligations `v7A@93270844`:
  - Private wages and mixed income are paid company → pop group. Each sector's wage bill is split over groups by
    `labor0` weight.
  - Public wages (`budget.payroll`) and public transfers (`budget.transfers`, by programme: `retr`, `chom`, ...) are
    paid from the treasury's **budget cash** account (`P6A@11703936`) to the pop groups.
  - The budget cash is funded by `anB`'s `reservedExpenseBn` = min(expense, appropriation × dt × delivery)
    (`J1Q@93439811`, text at @93440805; `anB@11712757`).
- Taxes `l7A@93277335`: households owe personal income tax (`ir`) and employee contributions (`cotis`) on wages,
  mixed income, public wages and pension transfers. Firms owe employer contributions. The payee is the treasury
  (`jg@11706604`).
- Income rows `FUQ@95806329` [read]:
  - `wagesBn` = private wage + mixed income + public wage (`Z_g`).
  - `transfersBn` plus `meansTestedTransfersBn`.
  - `taxesBn` = income tax + employee contribution + wealth tax + inheritance tax (`__g`).
  - `consumptionBn`.
  - **`unrepresentedIncomeBn`**, see the next block.
  - `YUQ@95807836` stores the rows as `household.operatingIncome`.
- Disposable income `BjQ@10902956` = (wages + transfers + unrepresented − taxes)/period + net financial income
  [read].

**The "unrepresented income" complement** [read]
- Day-0 calibration `WGA@11385304` / `$aB@11385994`: for each country, complement = baseline disposable income −
  represented (ledger) income. It is spread over groups **by their share of net worth**, and stored as
  `unrepresentedIncomeAnnualBn`.
- Each month `FUQ` books it as Dr household deposit / Cr household `realIncomeAccountId`. No payer is debited.
- Amount `$_g@95805532` = max(0, `unrepresentedIncomeAnnualBn` × idx − max(0, annualFinancialIncome −
  `ledgerNetFinancialIncome0BnY` × idx)). Here idx = `UUQ` = `gdpNom/gdpObserved0`, the country's nominal GDP
  against day 0 (text at ~@95805880).
- Day-0 size [ckpt]:
  - 16.4 T of 78.2 T world household disposable income (21%) over 3,570 groups in 210 countries.
  - USA 9.1 T of 24.3 T (37%); Germany 17%; France 13%; China 8.6%; Brazil 0.5%.
  - Up to about 50% in some small countries (`174`, `422`, `887`).
- The ledger's deposit linker `k0B@10912613` [read]: when a deposit-claim account moves with no matching bank
  liability entry, it adds the bank deposit liability and balances the bank. It does so by debiting
  central-bank backing or bank reserves (Cr central-bank reserve liability), or by repaying central-bank liquidity.
  That `FUQ`'s entries pass through it is [inferred] from the shared posting path (`p3`/`dA`).

**Consumption** `K_g@95753213` (inside `nUQ@95756024`) [read]
- Country basket budget = day-0 household basket value × `SMB` (`@15979776`) = Σ expected disposable income /
  Σ baseline disposable income / demandScale.
- `jZ@15980027` splits it over goods with relative-price substitution (`zMB`) and income-response terms
  (`MvB`, not read). VAT enters through gross prices (`1+un(...).rate` in `nUQ`).
- Per group, the share is that group's expected-income share. The budget is capped by `uJA@15982388`:
  - ordinary = min(free cash, ordinary basket);
  - extra = min((free cash − ordinary − 3 months of essentials) × (1 − 0.9^months), 25% of ordinary).
  - Free cash = deposit balance − reserved payments − loan interest and principal due − min(cash/2, 10% of income).
- So the average propensity to consume is fixed at day 0. The only wealth effect is liquid deposits above a
  3-month cushion, capped at +25%. Neither housing nor financial net worth, nor any interest rate, enters [read].
  Unemployment risk does not enter either.

**Household credit**
- Opening loans are created at genesis by `uSQ@11618842` (ids `loan:<bank>:opening:group:...`) [read]:
  - 44.3 T worldwide: 30.5 T mortgage principal (216- or 300-month linear amortisation) and 13.9 T consumer
    principal (84 months) [ckpt].
  - Repayment is `t6A@11667184` [read].
- **No new household credit is ever originated.** All three callers of the lending function `jK@11659105` are
  company paths (`XCQ@93131905` and `jxg@95060396` pass `type:"company"`; `qBQ@92707023` is a company project)
  [read].
  - `FW@11636650` only moves existing loans between groups when membership changes [read].
  - New private housing is paid from household cash (`zIB@11295407`, payer = household cash/WIP) [read].
- Mortgage refix `FSQ@11669439` resets the periodic rate to the bank lending rate. The `reset_capped` regime
  limits the reset to +2 pt (player lever `HqQ@95354802`, event `housing.mortgage_regime_changed`) [read].

**Labour market**
- Labour demand `oGB@24040516` [read]:
  - Required employment per sector = emp0 × output ratio / productivity / working-time factor `G2A` (40 h / legal
    weekly hours × leave days, 0.72–1.12).
  - Prison labour FTE (`o4A@24025741`) is subtracted from it.
  - Search and matching (`XUB`, `RUB`) gives vacancies, hires and a monthly job-finding rate.
  - The informal sector absorbs the unmatched.
- Wages `DGB@24039119` → `jUB@24030197` per sector [read]:
  - The contract wage is kept in money-deflated units. Its floor is the old nominal wage, so it never falls in
    nominal terms.
  - It moves toward a Nash-bargaining target `BGB@24035896`:
    1 + [workerShare·value0·(productivity − 1) + (1 − workerShare)·(outsideOption − outsideOption0)]/wage0,
    × CPI^(0.5, or 1 with automatic wage indexation `pb@14497326`) × an inflation-expectation term `g0A`.
  - The outside option `rGB@24037654` / `$UB@24035573` = finding-rate weight × wage + (1 − weight) × fallback
    income. Fallback `_Dg@24037327` = unemployment-insurance benefit per beneficiary and informal income.
    Unemployment therefore lowers the target [read].
  - Adjustment is upward only (`Q0A@15551766`, `max(0, target − current)`).
  - A rise above last period's real wage is allowed only if the firm can fund the extra cost from 10% of operating
    surplus or cash.
  - Worker share = base × clamp(1 + (union_freedom + strike_right)/2, 0.25, 2) (`gog@24038341`, `_UB`).
  - Union organisations (`P7Q@94751665`, `tradeUnions.*`) negotiate on social-movement claims (laws and budget). They
    do not enter wage setting [read `gog`; the role of agreements is inferred from `zuB`/`juB` names].
- Minimum wage `I4@14497164`: a floor on the **sector or company average** contract wage (`jUB` returns
  `max(I4/1e3, wage)`; `Z3Q@94686390`, `i5B@15757200`) [read].
- Unemployment insurance is a law-state flow model (beneficiaries, entries, exits, exhaustion; `costBnY` = `chom`
  spending via `jF@15629529`) [read]. Benefit generosity lowers search intensity (`l0A@15635891`) [read].

**Population** `SLQ@96031973` → `WQC@96032044` [read]
- Migration first (`kZ@15855771`):
  - Push = 1 − 0.45·ln(GDP per head) + instability.
  - Pull = (ln(GDP per head) − 0.5) × stability × (1 − destination-unemployment penalty) × openness.
  - Migrants carry an age, skill and group profile.
- Cohort demography `ezA@25286591`: 5-year cohorts, ageing 0.2 per year.
  - TFR target = tfr0 − 1.05·ln(GDPcap/GDPcap0) + 4 × family-policy delta (`Y2A`). The TFR moves 2.5% a year toward
    it.
  - Births = TFR × women 15–49 / 35 × abortion-law factor × famine factor.
  - Life expectancy target = e00 + 1.3·ln(GDPcap ratio), plus a fixed 0.12-year-per-year drift, capped at 88.
  - Mortality multipliers for health, climate, hunger, epidemics (`infectiousDeathShareByCohort`), executions and
    custody deaths.
  - `gdpCap` is real (`gdpVol/pop`, `w6Q@93713406`).
- Pensions `XPB@15557630`:
  - Retirement entry hazard by cohort from the legal retirement age (`yPB`). Beneficiaries depend on coverage.
  - The benefit index follows the `pension_indexation` law (wages / prices / discretionary = √(w·p)).
  - `TPB` = beneficiaries × average pension0 × index × generosity. So ageing does feed pension spending, and that
    spending is paid to groups as `public_transfer` `retr` [read].
- Labour force `TLQ@96029282`: working age `Fc@15553486` = population 15+ minus retired, × participation
  `wP@15895992` [read].
  - `wP` = `LZ` (0.6 + 0.02 × family-spending change, clamped −0.03/+0.06) + `participationAnchor`.
  - The anchor is calibrated at genesis (`DJA`, `pZ`).

**Housing** `lqQ@95340886` (prepare) and `kqQ@95349605` (settle) [read]
- Starts `KVg@95340014` = depreciation + household formation + habitable stock × supply elasticity ×
  (0.18·Δshortage + 0.1·Δvacancy + 0.012·ln price + 0.018·ln(rent/price) − 0.0025·Δrate − rent-control term −
  construction-cost term). They are capped.
- Stock and vacancy: `bVg@95341727`, `zVg@95344014`.
- Price and rent `NVg@95345313`. These are **growth rates** applied each month by `DqQ@95334291` (clamped ±2.5% a
  month; index clamped 0.15–8):
  - rent: 0.16·Δshortage + 0.11·Δvacancy + 0.006·ln income + ...
  - price: 0.13·Δshortage + 0.08·Δvacancy − 0.0018·Δmarginal mortgage rate (pt) + 0.012·ln(incomeIndex) +
    0.006·ln(construction-price index) + money laundering.
  - incomeIndex = groups' nominal disposable income per head / day 0 (`kDB@95335482`, `T1A@95335801`).
- Rent regulation `TVg@95344615`: `rentMode` free / indexed / capped sets the paid-rent index.
- Group housing-cost share `jVg@95346354` → `pressureDelta` (a social-pressure metric). Mortgage arrears are
  reported.
- `B4B@11387299` revalues owner housing: gains Cr net worth, losses Dr the household financial-expense account.
- Crises `RVg@95348603` (events `housing.crisis_started` / `housing.crisis_resolved`).

**Inequality** `u$A@93661676`: Gini from a lognormal mixture over group incomes (`BEQ`), and poverty = share below 50%
of the median (`QEQ`) [read]. It feeds the AI's law preferences (`dRg@95186346`, minimum wage) [read]; other uses
were not traced.

### What looks wrong

| # | Finding | Evidence | Conf. | Mod angle |
|---|---|---|---|---|
| H1 | **A fifth of household income comes from nothing and ignores the labour market.** The "unrepresented income" plug is 21% of world household disposable income (37% in the US). It is indexed to nominal GDP, not to employment, wages or policy, and has no payer. Scenario: in a US recession that cuts wages 10%, the plug keeps paying 9 T a year until GDP falls, so household income falls far less than the labour market. The plug is also spread by **net-worth share**, so wealthy groups get most of it: inequality rises in a slump and the plug works as a fixed transfer to the rich. GDP → plug → consumption → GDP is a feedback loop that amplifies demand shocks. | `FUQ@95806329` (Dr deposit / Cr realIncome), `$_g@95805532`, `UUQ` (gdpNom/gdpObserved0), `WGA@11385304`; sizes [ckpt] | read (amplification inferred) | Short term: index to nominal wage bill or GDP per head, and spread by income, not net worth. Real fix: map the plug to modelled flows (property income, imputed rent, remittances, informal income) with real payers. |
| H2 | **Interest-rate changes can only cut household income, never raise it.** The plug is reduced by net financial income *above* the day-0 path but never increased when it falls *below*. A saver whose deposit income rises with a rate hike loses the same amount of plug: net zero. A rate *cut* lowers the saver's income in full. A borrower whose interest bill falls with a cut has the saving clawed back. So both hikes and cuts are contractionary for consumption wherever the plug is large, and rate cuts cannot support demand through household cash flow. | `$_g@95805532`: `max(0, Q·g − max(0, C − w·g))`; `BjQ@10902956` adds net financial income | read+checked (behaviour inferred) | Correction 2026-10-29 [read+checked]: `BjQ@10903035` adds `max(0, C)` to disposable income, so the symmetric form (drop the inner `max`) makes plug + C = Q·g + w·g in both directions: rate changes become fully **neutral**, not income-raising. Only "stop netting" (plug = Q·g) passes rate changes through (hikes help savers), but it removes what may be a brake on plug-created deposits compounding interest (H3); needs the long-run test. Both day-0 neutral (C = w·g at t0). |
| H3 | **The plug is money creation outside banking and the inflation model.** The household deposit is debited with no payer. The deposit linker then books the bank liability against central-bank backing or reserves, so about 16 T a year of new reserves and deposits appear worldwide with no monetary-policy origin. This interacts with M2/M3 (central-bank money that does not feed the money impulse) and inflates the deposit stock (`LV`) that sizes monetization (`$2A`). | `k0B@10912613`; `FUQ` entries | measured 2026-10-29: headless plug-off vs unmodified, one month: plug 1,401 bn world; it lands as +1,403 bn household and bank deposits, +1,260 bn bank and central-bank reserves, +1,370 bn central-bank monetary backing (`docs/headless-simulation.md`) | Book the plug against a payer (e.g. rest of world for remittances, companies for property income) or as an explicit non-money transfer. Verify with a one-month ledger diff of central-bank reserves. |
| H4 | **Households never borrow.** There is no household credit origination: no new mortgages, no consumer credit. Of the 44.3 T opening debt, consumer credit (13.9 T, 84 months) is gone by year 7 and mortgages (30.5 T, 216–300 months) fall about 45% by year 10. Household debt/GDP falls by roughly 60% over a 10-year test whatever rates, house prices or policy do. Principal repayment of about 3.3 T a year destroys deposits and shrinks bank loan books, so bank capital ratios (B1) drift up for free. Mortgage-regime and macro-prudential choices lose meaning, and a housing boom cannot be credit-fuelled. Combined with B3 (no default), a household credit cycle is impossible. | refs `jK@11659105` → `XCQ`, `jxg`, `qBQ` (all company); `uSQ@11618842` opening only; `t6A@11667184`; `zIB@11295407` (housing paid from cash); sizes [ckpt] | read | Add origination: new mortgages as a share of housing purchases (config already has `mortgage.householdLoanShare`, `maturityYears`) and consumer credit at a target debt-service ratio, priced from `QFA`. Large change: calibrate so day-0 flows equal day-0 amortisation. |
| H5 | **Consumption ignores wealth, house prices, rates and job risk.** Spending = day-0 basket × (expected income / baseline income), plus a small liquid-cash buffer. A 30% house-price crash, a stock crash or a 10-point rate hike changes consumption only through current cash income. A rise in unemployment does not raise precautionary saving. | `K_g@95753213`, `SMB@15979776`, `uJA@15982388`, `jZ@15980027` | read | Add a wealth term (MPC ≈ 2–5% of net-worth change, `netWorthIndex` already exists) and a real-rate substitution term on the budget. Both are zero at day 0. |
| H6 | **House prices integrate income levels, so they drift without limit.** The price equation adds 0.012·ln(incomeIndex) per month. Any lasting rise in nominal income (inflation alone) gives a *permanent growth rate*, not a one-off level change. Scenario: 2% inflation + 1% real growth per head → incomeIndex 1.34 by year 10, so prices grow an extra ~4.3% a year from this term at that point, and faster each year. It never stops while income stays above day 0; the construction-cost term (0.006·ln) does the same. No price-to-income or price-to-rent anchor exists: `purchaseAffordabilityIndex` is computed in `T1A` but unused in `NVg`. The only brake is oversupply pushing vacancy up, so steady inflation implies a lasting building boom and rising vacancy. | `NVg@95345313`, `DqQ@95334291`, `T1A@95335801`, `kDB@95335482` | read (long-run path inferred) | Replace the level terms with an error-correction toward a fundamental: Δln P = a·(ln fundamental − ln P) + b·(shortage, vacancy), with fundamental = incomeIndex / financingCostIndex. Day-0 neutral (all indices = 1). |
| H7 | **Mortgage rates set the speed of the price change, not its level.** −0.0018 × (rate − day-0 rate) per month means a +3 pt rate gap makes prices fall about 6.3% a year *for as long as the gap lasts*, and a −3 pt gap inflates them 6.3% a year forever. Real rate changes shift the present value once. A player who holds rates low (M4 lets you take the central bank) gets an endless housing boom. | `NVg@95345313` (`-E*.0018`) | read | Fold into H6's fundamental via `financingCostIndex` (already computed in `T1A`). |
| H8 | **Rents and rent control are not cash flows.** The housing module's rent indices feed only starts, a housing-cost "pressure" metric and the UI. Tenants do not pay these rents and landlords do not earn them. Household rent spending is the CGE `real_estate` good, bought from companies. A rent cap therefore cuts tenants' pressure for free: no landlord income loss and no tenant cash gain, with only a small construction penalty. | `TVg@95344615`, `jVg@95346354`, `KVg@95340014`; all 28 `paidRentIndex` hits are housing-internal or UI | read | Link the CGE `real_estate` price for households to `paidRentIndex`, or book a rent transfer tenant → owner group. Medium size. |
| H9 | **Housing wealth is a dead end.** Revaluation moves owners' net worth, which nothing in consumption, credit (H4) or bank losses (B3) reads. Losses go to the financial-expense *account* but not to the `currentFinancialExpenseBn` counter that feeds income, so they are invisible to income too. A housing bust therefore has no macro effect beyond the "pressure" metric. | `B4B@11387299`; `ms@11405028` is the only writer of the counters; `K_g` does not read net worth | read | Covered by H5 (wealth effect), H4 (collateral) and B3 (charge-offs with housing recovery). |
| H10 | **The minimum wage is a floor on the sector average wage**, not on the wage distribution. Below the lowest sector average (almost always), any level costs and does nothing to wages, employment or inequality. Above it, the whole sector's average jumps to the minimum. The law gives the player a free approval lever with no economic trade-off. | `jUB@24030197` (`Math.max(t,P)`, `t=I4(A)/1e3`), `Z3Q@94686390`, `I4@14497164` | read | Model a bite: share of each tier below the floor (the Gini machinery in `u$A` has a within-group σ) raises that tier's wage and cuts its employment by an elasticity. Not contained. |
| H11 | **Labour-force participation is frozen at day 0.** It is 0.6 + a calibrated anchor, moved only by family spending (−3/+6 pt). It ignores wages, taxes, benefits, unemployment (discouraged workers) and education. Everyone aged 15+ and not retired counts at the same rate, so raising the retirement age adds older workers at prime-age participation and overstates the labour-supply gain. | `wP@15895992`, `LZ@15895873`, `Fc@15553486`, `TLQ@96029282` | read | Age-specific participation (lower for 15–24 and 60+) and a small elasticity to the net wage and to the unemployment gap. |
| H12 | **Fertility falls 1.05 children per log unit of real GDP per head within a country.** That is a cross-country slope applied over time, the same issue as D1. Ten years of 3% growth lowers the TFR target by about 0.31, and nothing in the economy pushes the other way (unemployment, housing cost, child benefits apart from the family term). Fast-growing players lose population growth, which feeds pensions (`TPB`) and labour supply decades later. | `ezA@25286591` (`r=-1.05*rzA(A)`), `rzA@25286383` | read | Cut the within-country elasticity (e.g. −0.3) and add a short-run pro-cyclical term (births dip with unemployment). Day-0 neutral. |
| H13 | **Real wages fall only through inflation.** Downward nominal rigidity is realistic, but raises are capped by 10% of operating surplus. In a low-inflation slump, real wages cannot adjust and unemployment persists. In high inflation, real wages are cut automatically unless wage indexation is "automatic" (elasticity 1). This is probably intended (Keynesian). Check in a long run that unemployment does not lock in after a shock. | `jUB@24030197`, `Q0A@15551766`, `pb@14497326` | read | Probably leave. If unemployment locks in, allow a slow real cut toward target. |
| H14 | **Extra prison labour displaces free workers one-for-one at no wage.** The change in convicted × work share above the day-0 law is subtracted from required private employment, so firms' wage bills fall with no change in output. Small (per 100k), but a harsh penal policy is a free cut to the wage bill and raises unemployment silently. | `o4A@24025741`, `oGB@24040516` (`X=max(0,T-s[J])`) | read | Add a productivity discount and a cost per prison worker. Low priority. |
| H15 | **Correction to finance F1/F4 (cross-area); the double count is resolved: there is none.** Spending *is* paid to households and companies for the appropriated part: `anB` moves `reservedExpenseBn` into treasury budget cash, and the operating settlement pays public wages, transfers and purchases from it. Households really pay income tax, contributions and wealth/inheritance tax from their cash (`l7A`, `FUQ`). The suspected second booking does not happen: `TeQ` subtracts every `y0` tax from the revenue `anB` posts (section 1). | `v7A@93270844`, `l7A@93277335`, `Q$g@95812938`, `anB@11712757`, `jg@11706604`, `TeQ@93388973`, `y0` @25409976 | read+checked | Revise F1/F4 wording in the finance review (done in section 1). |

### v0.1 candidates

Contained (one function or config), day-0 neutral (every changed term is 0 at t0), and deterministic (pure arithmetic
on existing state):

1. **H2: symmetric plug clawback** in `$_g@95805532`.
   - Change `max(0, C − w·g)` so that a fall in financial income below the day-0 path is added back, keeping the
     total ≥ 0.
   - Anchor: the error string `` `household-income:baseline:${...}` `` and the field names
     `unrepresentedIncomeAnnualBn`, `ledgerNetFinancialIncome0BnY`.
   - Expected effect: rate cuts stop being contractionary for savers. Day-0 values are unchanged.
2. **H6 + H7: error-correcting house price** in `NVg@95345313`.
   - Replace `s*.012 + i*.006 − E*.0018` with `k·(ln(incomeIndex/financingCostIndex) − ln priceIndex)`, with k ≈ 1–2%
     a month. Keep the shortage and vacancy terms.
   - `T1A` already returns `financingCostIndex`.
   - Anchors: `kqQ`'s `TypeError("housing:months")`, the keys `lastPriceChangePct` and
     `channels?.housing?.cleanedBnY`, and the event `housing.crisis_started`.
   - Expected effect: prices track income and rates in level, with no endless drift. Day-0 neutral.
3. **H12: fertility income elasticity** in `ezA@25286591`.
   - Scale `-1.05*rzA(A)` down to about −0.3.
   - Anchors: the nearby config keys `famineBirthFactor`, `hungerExcessDeathRate`, `massDeathsPendingM`.
   - Day-0 neutral (`rzA=0`). Slow effect, so a 10-year test shows little; check 30 years.
4. **H5 (partial): wealth effect** on the consumption budget in `K_g@95753213`.
   - Multiply `s` by `1 + m·(netWorthIndex − 1)`, with m ≈ 0.03, clamped.
   - Anchor: the error string `` `operating-purchases:expected-income:${...}` ``.
   - Day-0 neutral (index = 1). It gives housing (H9) and equity (B9) wealth a channel into demand.

Not v0.1, because each changes calibration or spans several modules: H1/H3 (plug redesign), H4 (credit origination),
H8 (rent cash flows), H10 (minimum-wage bite), H11 (participation). H15 needs a runtime check before anything is
built on F1.

### Not yet read

- `TlA` (the operating payment engine) internals. H15's double count is settled without it (section 1).
- `jZ` internals: `MvB` (income elasticities), `sMB` (essential bill); `WMB` (genesis consumption calibration);
  `xxQ` (represented income per group at genesis).
- The size of each income component per group (wages vs transfers vs plug) beyond the plug totals above.
- `pEA` (household formation), `xK` (mortgage arrears aggregation), `FSQ` refix details beyond the cap.
- Unemployment-insurance flows (`M0A`, `U7B`), public-wage policy (`OpA`/`c5B` read only in part), informal sector
  (`luB`, `mLA`).
- Migration allocation `L5B`, remittances (if any), and whether immigrants' labour-force entry matches `TLQ`'s
  fit.
- Health `WLQ` / `OoQ` and epidemiology `K5Q`/`h5Q` effects on labour supply or productivity (only their mortality
  inputs to `ezA` were read).
- Communities `CvB`, social psychology `A9B`: economic links not read. Uses of `A.ineq` beyond the AI were not
  traced.
- Education and skills → productivity; the `compulsory_schooling` effect on 15–19 participation.

---

## 7. Corporate sector, investment, ownership, crises and shadow economies (C)

Build 26296134, bundle `renderer/simulation-worker.bundle.js`. Read-only static analysis; nothing measured in play
except one day-0 count from `economic-t0-checkpoint.json.gz` (marked). Tags: **[read]** read in the code;
**[inferred]** reasoning from read code. Finance-review IDs (F1, D3, B9, ...) refer to
`research/financial-system-review.md`.

### How it works

**Monthly order** (`l6B@96160580`) [read]:
- Monthly pretrade: the non-state satellites in this order: drugs `dyB`, sex work `zyB`, gambling `BMB`, organs `PPB`,
  shadow market `AKB`, non-state actors `kKB`, money laundering `g5Q`, non-state international `aDQ`. Then, per country,
  sector ownership `qaQ` and ownership claims `q0Q`. Then the world trade/settlement phase `xUQ`.
- Monthly finance: `o4B` → corporate settlement `APQ` → IMF → sovereign settlement `EJQ` → ... → equities `ElQ` →
  household finance → country economy → crises `ZMQ` + `tJQ` → investment `QqQ` then `BPQ` → housekeeping (`GBQ`,
  `fIB`, `_MQ`, `wr` per country).

**Revenue, costs and profit** [read unless marked]:
- Operating revenue and costs are settled in the world-trade phase, not in `APQ`.
  - `Q$g@95812938` closes the journal `economic:<settlementId>`. It clears markets (`vUQ`), then builds obligations:
    payroll (`v7A@93270844`), income tax and social contributions (`l7A@93277335`), wealth and bequest tax
    (`d7A@93279274`) and tourism. It pays them through `TlA` with `requiredShortfallPolicy:"arrears"`.
  - Buyers are resolved by `HUQ@95801646`:
    - Intermediate and enterprise uses go to the companies of the country-sector, weighted by operating share
      (`voB@95799988`).
    - Household uses go to household groups.
    - Government `baseline_final` purchases are paid from the government's budgeted account (`paymentRequired:false`).
    - Enterprise capital purchases are debited to each company's `businessCapitalAsset`.
- `APQ@94690103` only does company debt service (`sOg@94689356` → `cOg`), the closing `x3Q` (tax and dividends,
  finance review), and `DLB@24879359` depreciation. It then sets `country.capital` = Σ company capital and
  `_capitalGrowthPctY`. `sOg` throws `corporate-finance:operating-closing-required` if the `economic:` journal is
  missing, so the order is enforced.
- The sector P&L comes from CGE accounting, `ipB@25032481`:
  - VA = sold value − intermediate cost; operating surplus = VA − employer cost − mixed income. GDP = Σ VA.
  - It also sets `_profitMul` (clamped 0.4–2.5), `_wageMul` and `_consoMul` (0.6–1.6) as factor shares relative to
    day 0. These scale the tax bases in `To@15627574`, so the finance review's F4 ("fixed GDP shares") is only partly
    right.
- A company's metrics come from `w6g@24898264`: it takes the sector's `opSurplus`, `va`, `wageBill`, revenue and
  employment times the company's share. Each pass re-weights `operatingShares` to `capacityBnY / sector capacity`.
  So every company in a country-sector has the same margin per unit of capacity.
  - Day 0: 6,272 companies; 1,052 of 4,898 country-sectors have more than one company (up to 8, e.g. US ICT)
    [checkpoint count].
- Depreciation `DLB@24879359` books `capital_depreciation` monthly: Dr impairment expense / Cr productive asset and
  business-capital asset. The rate is one per country, sealed on first use by `ZEg`/`wLB@24878704`: day-0
  replacement orders (enterprise capital final use × price × fill, plus fleets) / company capital.
- Unit production cost `A$g@95812258` = materials/prod + wage/max(prod, prod0).

**Two investment layers** [read]:
1. **Macro business capital** (`fhA` config @~24819119, French `_doc`):
   - Two stocks per country: structures (40-year life, 10-year catch-up) and equipment (8-year life, 8-year catch-up).
   - Orders = stock/L + (target − stock)/adjustmentYears (`jYB@24871042`). Target = sealed target × capacity index
     `LYB` × user cost `FhA@24870365`.
   - User cost = ((r0 + 1/L)/(r + 1/L))^0.5 × relative price × real wage, with real rate r = max(0, `bondRate` −
     `inflExp`) (`bYB@24870113`). That is the **sovereign** yield, not the corporate lending rate.
   - Stocks decay at 1/L (`zYB`). The capital/capacity ratio feeds `capitalLaborFactor` and `capitalCapacityFactor`
     as ratio^α (`I_g@95724899`, `W1A`).
2. **Company production-route projects**:
   - AI decision `BPQ@94692017`:
     - For each country and good, an opportunity (`S3Q@94683238` → `EOg@94682497`, inputs `$aA@23988886`) needs:
       high utilisation; input, power, labour and province feasibility; expansion pressure for 2 or more consecutive
       months; a gap of at least `e$`.
     - Expansion is capped at 10% of capacity (`EOg` `Math.min(a,.1)`; `tOg=.1`), times `REQ@93705125` (×0.4–1 under
       an employer disinvestment, lockout or capital-flight stance).
     - Only one pipeline per good per country (`if(i>Rt)continue`). Skipped while `EZA(...).paused`, unless the good
       is limiting.
   - Quote `pgA@92726157` → `op@92728089` → funding `Gf@92704423` → cost of capital `z5g@92702259`.
     - With `requireProfitable`, the project passes if capacity × utilisation × (price − unit cost) / total cost −
       weighted funding cost > 0. The unit cost (`oz@24940972`) counts materials, electricity, employer cost and
       environment. It has no capital charge, depreciation or tax.
     - Funding order: retained cash above a buffer (`E2`, `sWA × cashBufferScale`), then bank loans (`FgA`/`GgA`, which
       respect `D6A` bank constraints), then equity. "Expansion" profiles try equity before banks (`phA@24881081`:
       prudent, balanced or expansion by id hash).
     - Costs:
       - retained cash at the average bank deposit rate;
       - bank debt at its lending rate;
       - equity at the earnings yield, operating profit / market cap;
       - parent and public contributions at **0**.
   - Commit `$3Q@94688963` → `zBQ` → `TBQ@92731789`/`qBQ@92707023`:
     - Bank loans are 84-month `jK` loans.
     - Equity issues go through `cuA@87436367`, at the current share price, with dilution and ownership refreshed.
     - Cash is reserved in a project account. A `productionRoute` construction project then buys its input basket
       monthly through the settlement (`iIB`).
   - Delivery `PWA@92713266`:
     - Dr productive asset / Cr WIP; `capacityBnY += capacityAddedBnY`.
     - `ZYB@24873419` scales the macro business-capital stocks by the capacity added, so the capital/capacity ratio is
       unchanged.
     - Unspent reserve returns to the company (`UBQ@92712230`).
   - Investment therefore **does** respond to rates (through the funding cost), demand (utilisation) and profitability
     (the margin test). It does **not** respond to uncertainty. It is fully booked in the ledger.
- **Public productive programmes** (`QqQ@95324960` → `AqQ@95320981`):
  - The state pays the whole cost (`fBQ@92710001`): Dr company reserved cash / Cr treasury cash, against a
    treasury advance asset and a company advance liability.
  - At delivery, `UBQ` turns the advance into a **grant**: Dr treasury expense / Cr company retained earnings.
  - The company is picked by `Z4A@24893073`: any non-distressed company in the sector, whatever its ownership, or a new
    "private" one.
- **Player API**: `finance.startCorporateInvestment` (@95309195). `validate` checks that the company is headquartered
  in the country and that `pgA(A,Q)` passes. `apply` = `$3Q`. The game-side wrapper `startCorporateInvestment@96249570`
  passes `{companyId,costBn,...g}`; `requireProfitable` is set only by the AI caller `BPQ`.

**Ownership** [read]:
- Sector efficiency `qaQ@94060232`:
  - target = `IbA@24064174` = clamp(min(1, (1 − k·s²)/(1 − k·s0²)) − scar, floor, 1), where s is the public share,
    s0 the day-0 share, and k by sector (`sog`: tech/ict/knowledge .22, trade/services .16, industry/construction
    .12, energy/mining/agriculture .1, utilities .06, health/education/public 0). Floor = max(.55, 1 − 1.6k).
  - Efficiency moves 1/3 of the way to the target each month (`UYg=30/90`) and is exported as
    `we.ownershipSectorEfficiency`.
- Nationalise, privatise or make cooperative `aBB@93916925`:
  - Sector value `RGg@93915715` = operating profit × `qGB` (sector base multiple 3.5–6.5 ×
    clamp(0.11/(r + 0.06), 0.5, 1.4), r = sovereign bond rate clamped 2–18%). If operating profit ≤ 0, the value is
    0.35 × productive capital instead.
  - Unit rate: buy at market 1.0, negotiated 0.78, seize 0.15 (`OGg`), +0.12 control premium for crossing 50%
    (`zGg`). Privatise at 0.82 − 0.2 × instability (`TGg`, `NGg`). Cooperative = a treasury expense paid to worker
    groups.
  - Listed companies trade at the share price × rate. Seizure records `foreignHarmedBn` for foreign holders only.
  - Buyers of privatised stakes are domestic household groups in fixed weights (`xGg`: capi 5, cadr 2.4, retr 1.3,
    inde .8), at most 50% of each group's assets (`jGg`).
- Claims `q0Q@93930637`:
  - After 365 days of negotiation (`sVB`), a claim goes to arbitration, due = owed × min(1.5, 1 + 4%/year)
    (`lRA@87443606`). A missed instalment also sends it to arbitration.
  - `Wm` (floor 0.3) cuts FDI utility in `u6Q@93737079`. Repudiated claims weigh fully for 12 years, then fade over
    4 (`Xm`).
- FDI (`WHg@93734079`, `u6Q`) is a separate stock-flow model:
  - Logit allocation of inflows, with stocks decaying at a renewal rate.
  - Its deltas enter only the current account (`Em@87027337`, `fdiIncomeDeltaBnY`) and the reserve flow
    (`VBA@87028032`, `fdiInflowDeltaBnY`).

**Crises and clean-up** [read]:
- `ZMQ@95059509` = `Sxg@95061748` (company distress → resolve; bank liquidity/recap: finance review B6–B8) + an
  inventory sync. Crises come from balance sheets, not scripts. Liquidated companies' capacity is re-founded from
  "residual" companies (`Txg`).
- `tJQ@96156788` writes off open economic obligations (unpaid wages, taxes, supplier bills) in three cases: older than
  730 days (`joC`); dust older than 30 days and below 2e-6 Bn; or, oldest first, when the open count is above
  10 × (live companies + households + sovereigns) (`RoC`, `WoC@96156586`). Write-off: `vd@11699856`.
- `_MQ@95064675` dissolves fully settled liquidated companies (account and instrument housekeeping).
- `fIB@11283601` consolidates completed public construction into a treasury asset. That asset is never depreciated
  here.

**Non-state and shadow economies** [read]:
- Drugs (`dyB@25333366`, `btg`, `htg`), sex work (`zyB`→`KyB@25343807`), gambling (`BMB@15916573`→`tJA`), shadow
  market (`AKB@25350483`) and organs (`PPB`→`R_Q`, not read) are **satellite scalars** (`*BnY` fields), with their own
  conservation checks. No ledger postings: no `kind:"drug…"`; non-state actor cash is `actor.finance.cashBn`, a scalar.
- Formal-economy contacts:
  - Tax bases: `To` adds `drugLegal` (legal recreational sales/GDP) and `gamblingGgr`. `c0A@15628575` taxes them in
    excise `acc` (effective rate `ZtA` = 0.45 × rate, clamped 3–45%) and `jeux`.
  - AI weights: `_drugCriminalRevenueBnY` feeds AI scoring (`dRg`).
  - Shadow market `shareGDP` (clamped to [0.45 × share0, 8%]) feeds actor targeting (`leB@94972906`) and
    intelligence displays.
  - Laundering: cleaned funds in the housing channel push housing prices (`NVg@95345313`).
- Money laundering `g5Q@94861823`:
  - The actor launders `lTg` of its scalar cash. `MTg` splits it into cleaned, seized, blocked, friction and tax.
  - "Holdings" in target companies are a record in the laundering module only (`kTg@94860240`). Forfeitures are
    stats (`qTg@94860703`).
- Seizures that **do** reach the ledger: cell dismantling `D9A@93471877` (up to 72% of the cell's cash) and support
  interception `qKB@25384278`. Both go through `oc@11706894`: Dr treasury cash / Cr revenue.

### What looks wrong

| # | Finding | Evidence | Conf. | Mod angle |
|---|---|---|---|---|
| C1 | **The government can order any domestic company to invest, profitable or not, with the company's money.** The verb validates only HQ country and `pgA(A,Q)`. The player path never sets `requireProfitable`, so the project-return test is skipped. Funding comes from the company's retained cash, bank loans and forced equity from household groups. For "expansion"-purpose projects there is no limit on concurrent projects: the `active_project` check in `Gf` applies only to other purposes. For series routes `op` has no order cap unless `fitToBudget`. Scenario: in a recession the player pushes every large private firm into capacity projects. The input purchases add GDP and jobs at zero fiscal cost; the firms later sit at low utilisation with 84-month bank debt and drift into `HU` distress, and the banks carry the losses. | `rB("finance.startCorporateInvestment")`@95309195; `startCorporateInvestment@96249570`; `pgA@92726157` (`if(!B.requireProfitable)return o`); `Gf@92704423` | read (UI caller in `app.bundle.js` not read; effect inferred) | For non-state companies, require `requireProfitable` or a public contribution that covers the negative NPV, and allow one active expansion project per company. Player-only path, so day-0 neutral. |
| C2 | **The investment hurdle has no depreciation, tax or price response.** The return is gross margin / cost at today's price and today's utilisation, applied to the new capacity. The ledger depreciates capital (`DLB`) and taxes profit (`x3Q`), so a project returning gross 5% against a 4% funding cost passes but loses money after a ~4–5% depreciation charge. Adding up to 10% capacity also lowers price and utilisation, which the quote ignores. | `pgA@92726157` (`n=o.capacity*a*(t-I)`, `c=n/o.totalCost*100-weightedFundingCostPct`); `oz@24940972` unit cost; `DLB@24879359` | read (size inferred) | Subtract the country depreciation rate (`ZEg` `rateAnnual`) and the profit-tax rate, and use expected utilisation after the addition. One function; changes the AI path but not day-0 values. |
| C3 | **Cost of capital is mispriced by source.** Retained cash costs only the deposit rate (policy − 0.8), so cash-rich firms invest at near-zero hurdles, a floor of 0 under ZLB. Equity costs the earnings yield, so high-P/E listed firms raise equity almost free. Public and parent contributions add to the funded amount at 0% cost, which dilutes the weighted cost. | `z5g@92702259` (`a=retained×avg depositRate`; `D=operatingProfit/marketCap`; contributions in `n`, not in `c`) | read | Price retained cash at the firm's own lending rate or cost of equity; floor the equity cost at the real yield + premium; exclude grants from the average. |
| C4 | **Equity issues have guaranteed take-up.** Each domestic capi/cadr/retr household group buys up to 12% of its cash per issue, at the current market price, with no demand curve, risk appetite or discount. Retirees are forced buyers. Projects committed one after another in a month compound the effect: N issues leave 0.88^N of those groups' cash. This mirrors D3 for bonds. | `T5g@92703967` (`capi:4,cadr:2,retr:1`); `Gf@92704423` `QB(L,12,100)`; `cuA@87436367` (price = `terms.priceBn`) | read (compounding inferred) | Make take-up depend on the household portfolio's equity share vs a target and price the issue at a discount that rises with size. |
| C5 | **Public productive programmes are a 100% capex grant to whichever firm leads the sector, with no equity in return.** `Z4A` has no ownership filter (private, listed, partly foreign-held). At delivery the advance becomes Dr treasury expense / Cr company retained earnings. The asset's value goes to the firm's shareholders, including foreign holders through dividends and the price (`nuA` includes net cash and capital). | `Z4A@24893073`; `fBQ@92710001`; `UBQ@92712230` (`public_productive_project_settled`, `grantBn`) | read (leak to foreign holders inferred) | Book the grant as a public equity stake (raise `publicShare`/`publicBookBn`) or as a soft loan, or restrict it to state companies. |
| C6 | **Nationalisation price has a cliff at zero profit and ignores debt.** Sector value = operating profit × multiple, but 0.35 × productive capital when profit ≤ 0. A sector earning barely above zero is worth almost nothing, while a loss-making one is worth 35% of its capital. The value is an EBIT multiple applied as if it were equity, with no net-debt or cash adjustment. It uses the current, unsmoothed operating profit. Scenario: nationalise a sector during a demand dip, when its profit is just positive, for a fraction of its asset value. | `RGg@93915715`; `qGB` @~24063600; `aBB@93916925` (`vA=GA*MA*f`) | read | value = max(multiple × smoothed profit, 0.35·K) − share of net debt. One function; player and AI action only, so day-0 neutral. |
| C7 | **Privatisation is always a fire sale to forced buyers.** Price is 0.82 of value (down to 0.62 when unstable) whatever demand is. Buyers are household groups in fixed weights, up to 50% of their assets, so there is no choice. Combined with the 1.0 (+0.12 control) buy price, the state loses at least 18% per round trip (no arbitrage); households gain it. | `aBB` (`TGg=.82`, `NGg=.2`, `jGg=.5`, `xGg`) | read | A demand curve (discount rising with the stake sold relative to household assets), and allow failed or partial sales. |
| C8 | **Seizure is cheap and the claims are toothless.** Seize pays 15%. Domestic holders and unlisted firms (which have no foreign holders) get no claim. Foreign claims accrue at most +50% (4%/yr) and are never enforced beyond the FDI utility penalty (`Wm` ≥ 0.3), which fades after 12 + 4 years when repudiated. | `OGg.seize=.15` @93915420; `q0Q@93930637`; `lRA@87443606`; `Xm`/`Wm` @~87442900; `u6Q@93737079` | read (political costs in `i0Q` not read) | Add enforcement (freeze of the seizer's foreign assets via the sanctions freeze code, trade or rating hit), and compensation claims for domestic holders under property-law regimes. |
| C9 | **Privatising can't raise efficiency above the day-0 level.** The target is `min(1, f(s)/f(s0))`. A country that starts with a large state share (e.g. 60% of industry) gains nothing from privatising, while nationalising past day-0 levels costs up to k·s². The penalty is relative to day 0, so it is asymmetric. | `IbA@24064174`; `sog` @24063700 | read | Allow up to 1 + k·(s0² − s²) (bounded), so day-0 stays at 1 and privatisation helps. Config-adjacent, day-0 neutral. |
| C10 | **The shadow economy doesn't erode the tax base or GDP.** Shadow-market `shareGDP` can rise to 8% of GDP under instability and unemployment, but collection efficiency `or` reads only stability, corruption, burden, inflation and economy competency. Drug, sex-work and gambling spending is not debited from households or counted in GDP. Informality is cosmetic for the fiscal side. | `AKB@25350483` (`J0(...,share0·.45,.08)`); `or@93383189`; consumers of `shadowMarket.byCountry`: `MAA`, `Uu`, `leB` only | read | Multiply `or` by (1 − (shareGDP − share0)). Neutral at day 0. |
| C11 | **Seizures from non-state actors create treasury money.** Actor cash comes from off-ledger illegal markets (scalar `cashBn`). Cell dismantling and support interception book it as Dr treasury cash / Cr revenue. Repeated dismantling missions turn criminal "income" into fiscal revenue that no ledger account paid. Small on the scale of F1 but farmable. | `D9A@93471877`; `qKB@25384278`; `oc@11706894`; `lTg`/`ecA@25368185` (scalar cash) | read (repeatability and size inferred) | Cap seizures by a share of the host's actual illicit flows, or post them against a "proceeds of crime" counterpart. Low priority. |
| C12 | **Money laundering never touches the formal ledger.** Cleaned funds become "holdings" in companies without any posting. Seized, blocked and taxed amounts are statistics, never credited to the treasury. AML policy can't raise revenue, and laundered money never reaches the target companies. Only the housing-price channel is real. | `g5Q@94861823`; `kTg@94860240`; `qTg@94860703`; consumers `C5Q`, `NVg@95345313` | read | Either document it as a satellite, or route `taxBn`/`seizedBn` to the treasury with a matching debit (depends on F1). |
| C13 | **Legal drug and gambling taxes are formula revenue on a base nobody pays.** Legalising adds `ZtA(rate) × 100 × drugLegal` % of GDP of excise. The legal sales are not in the CGE GDP and not debited from households (section 1.5 / F1 extended). | `To@15627574` (`drugLegal`, `gamblingGgr`); `c0A@15628575` | read (whether legal demand reacts to the tax rate in `ptg` not read) | Keep, but cap the base, or derive it from household consumption so it crowds out other spending. |
| C14 | **Arrears are written off by count, not size.** Above 10 obligations per live entity, the oldest open obligations are written off whatever their amount, alongside the 2-year prescription. A big unpaid tax or wage bill can be wiped because many small bills exist elsewhere. Creditors (workers, suppliers, the treasury) lose silently. | `tJQ@96156788` (`RoC=10`, `WoC`, kind `economic_obligation_cap`); `joC=730` | read | Apply the cap to dust-sized rows only; send large old arrears through insolvency (`Sxg`) instead. |
| C15 | **Two unconnected foreign-ownership models.** FDI stocks, flows and income are a satellite: they move the current account and reserve flow but never create company capital, capacity or ledger ownership. Foreign ownership of companies exists only as ledger equity positions. Expropriation lowers FDI flows but not the FDI income term. FDI inflows create no productive capacity. | `WHg@93734079`, `u6Q@93737079`, `E6Q`; consumers `Em@87027337`, `VBA@87028032`, display `v6Q` | read (possible double count of foreign dividend income in `Em` not checked) | Longer-term: derive FDI income from foreign equity positions' dividends, and let FDI inflows fund `pgA` projects. |
| C16 | **Investment only goes one way.** The AI never retires or mothballs excess capacity. Capacity falls only through war or destruction (`W3Q`) or liquidation. In a demand slump, utilisation and margins fall, operating surplus is spread over the same capacity, and distress (`Sxg`) is the only exit. Capacity growth per good is limited to one ≤ 10% project at a time. | `BPQ@94692017` (expansion only; `if(i>Rt)continue`); `EOg@94682497`; `uUB@23991436` (route capacity has no decay) | read (macro effect inferred) | Add a mothball/retire step when utilisation stays below a threshold for N months (frees maintenance and labour cost). |
| C17 | **Business-capital user cost uses the sovereign yield, floored at a 0% real rate.** Corporate investment demand reacts to `bondRate − inflExp`, not to the corporate lending rate (`QFA`), and gets no boost from negative real rates. In a sovereign default (yield = inflExp + 26), desired equipment falls to about 0.6× and structures to about 0.4× of target (with r0 ≈ 2%), whatever the policy rate. The monetary channel to investment runs only through sovereign yields (M8). | `bYB@24870113` (`max(0,B-Q)`); `FhA@24870365`; config `fhA` (σ = 0.5) | read (multipliers computed from code with an assumed r0) | Use the corporate lending rate (or a blend), and allow negative real rates down to a floor. |
| C18 | **All firms in a sector share one margin.** Company profit = sector `opSurplus` × capacity share. Leverage is the only thing that differs between firms, so a state and a private firm in the same sector earn identically; ownership efficiency is sector-wide. Per-firm choices (privatise one firm, invest in one firm) don't change that firm's productivity. | `w6g@24898264`; `voB@95799988`; `qaQ@94060232` → `we.ownershipSectorEfficiency` | read | Design limit; note for the roadmap, not v0.1. |
| C19 | **Ledger depreciation and physical capacity diverge.** One sealed country rate depreciates both route assets and business capital. Route capacity itself never decays, while macro business capital decays at 1/L. The book value of route projects therefore drifts below the capacity they give. That understates `nuA`'s 3%-of-capital floor, `RGg`'s loss-case value (0.35 K) and `HU`'s asset test. | `DLB@24879359`; `ZEg`/`wLB@24878704`; `uUB@23991436` | read (effects inferred) | Low priority. |
| C20 | **Unit wage cost is understated below day-0 output.** wage / max(prod, prod0) spreads the wage bill over day-0 output, so when output falls, inventory is valued below cost. | `A$g@95812258` | read | Use `prod`. Minor. |
| C21 | **Privatising a listed sector's whole public stake faults the simulation.** The share sale splits the treasury's holding among the buying state groups in floating point; the last sale can exceed what is left by a few units in the 16th digit (Russia, energy to 0: 13,831,670.837230505 asked against 13,831,670.837230451 held), and the per-move check allows only an absolute 1e-9 shares (`Qu`), so the quote itself throws `financial-markets:ownership-quantity:treasury-equity:643` and the simulation host faults (also in the unmodified game). | `WWB@~87418000` (check), `Qu=1e-9`@87412075; plan in `aBB@93916925` (privatise split `eg*ng`) | measured (headless, unmodified game, diagnostic build) | Tolerance relative to the holding (1e-9 of it) and cap the move at the quantity held, so shares are conserved. Fixed by the developers in build 26346311 (the last buyer now takes the exact remaining quantity); patch `c21-privatisation-fault` retired. |
| C22 | **Money-laundering recoveries never reach the treasury (Low).** Laundering enforcement (`Fjg@94927318`) splits each laundered sum into cleaned, seized, blocked, friction and tax, and the player is told the seized funds, tax and forfeitures were recovered (`enforcementRecoveryBnY`), but none of it is paid to the treasury; the two other seizure paths (C11) do pay it. | `Fjg@94927318`, `pjg@94929023`, report near @94931749 | read+checked | Credit seized and tax amounts to the treasury. |

**Cross-area flags for the finance review** (not findings of this area, but read here):
- **F1 is narrower than stated; there is no double revenue** (resolved in section 1). The monthly settlement does collect personal income tax and
  employee/employer contributions (`l7A@93277335`) and wealth and bequest tax (`d7A@93279274`) from household and
  company accounts into the treasury. It does pay public wages and transfers to household groups (`v7A@93270844`)
  and government `baseline_final` purchases to companies (`HUQ@95801646`). These replace `anB`'s formula
  lines: `TeQ` subtracts every `y0` tax (`ir`, `cotis`, `fort`, `succ`, `is`, ...) from the revenue `anB` books.
- **F4 is partly wrong:** `To@15627574` multiplies the labour, consumption and profit bases by `_wageMul`,
  `_consoMul` and `_profitMul` from `ipB@25032481` (factor shares relative to day 0).

### v0.1 candidates

Contained (one function or one config object), day-0 neutral or nearly so, and deterministic (no RNG, clock or UI):

1. **C1 forced corporate investment.** Patch the validator of `finance.startCorporateInvestment`:
   - Force `requireProfitable:true` when the company status is not `"state"`, or require `publicContributionBn` ≥ the
     quote's negative NPV.
   - Allow one active `expansion` project per company.
   - Anchors: the verb string `"finance.startCorporateInvestment"`, the reason `"project_return"`, and
     `"corporate_market_signal"` (BPQ's own `decisionSource`, to leave the AI path alone).
   - Player-only, so no calibration impact.
2. **C6 nationalisation price cliff.** `RGg`: value = max(op profit × multiple, 0.35 × productive capital), minus the
   share of the sector's bank debt.
   - Anchors: `"sector_not_transferable"`, `"insufficient_treasury"` and the `valuationMultiple` key in `aBB`'s
     result.
   - Player and AI action only.
3. **C14 obligation cap.** `tJQ`: apply the count cap only to rows below a size threshold.
   - Anchor: the kind `"economic_obligation_cap"` (and `"obligation_endurance"`).
   - Only active once the open book exceeds 10 per entity, so day-0 neutral. Check that the cap still bounds memory.
4. **C9 privatisation efficiency.** `IbA`: drop the `min(1, …)` in favour of a bounded upside.
   - Anchor: the `sog` config literal (`health:0,education:0,public:0,utilities:.06`), next to `IbA`.
   - Efficiency stays 1 at day 0.
5. **C2 investment hurdle.** `pgA`: subtract the country depreciation rate and the profit-tax rate from the return.
   - Anchors: `"project_return"`, `projectReturnSpreadPct`.
   - Changes the AI investment path (fewer projects), not day-0 values. Needs the 10-year A/B test for supply
     shortages or price spikes before shipping. Medium risk.
6. **C10 informality in tax efficiency.** `or`: multiply by (1 − max(0, shareGDP − share0)).
   - Anchors: the `shadowMarket` state and `or`'s clamp `.15,.99`.
   - Neutral at day 0 because the term starts at 0. Low risk, but it changes revenue paths under instability.

Not v0.1: C5 (changes ownership accounting), C15 and C18 (structural), C11–C13 (depend on the F1 decision).

### Not yet read

- `iOg` (how BPQ splits a gap across candidate companies) and `EZA` (the investment pause and `limitingGoods`).
- Who creates route **renewal** projects (`_5g`, `renewalTargets`). No caller passing `renewalTargets` was found in the
  simulation bundle; it may be a UI or `app.bundle.js` action.
- `vUQ` market clearing (how prices are set) and `iIB` (monthly material purchases of route projects). `E2`/`sWA`
  (company cash buffer).
- `i0Q@93925831` (political and law consequences of nationalise, privatise and seize); the sanctions-freeze link.
- Drugs `ptg@25323550` (whether legal demand reacts to the `acc` rate); sex work `KyB` details; gambling `tJA`;
  organs `R_Q`; non-state international projects (`hkg`, `zkg`, `Nkg`); the sponsor-side debit for `fKB`/`HKB` support
  missions (caller of `nqg@93516610` not traced).
- `x3Q` foreign dividends vs `Em`'s `fdiIncomeDeltaBnY` (possible double count of foreign income).
- (Resolved: `anB`/`TeQ` against `l7A`/`d7A`, see section 1.)
- `GBQ` (project archive), `wr`'s `OhA`/`_4A` projection details, stock-market flow drivers `ASg`/`BSg`/`QSg`, SWF
  autopilot.

## 8. Approval swings against the unmodded game (2026-10-30, build 26318758)

Batch runs showed approval gaps of 15 to 36 points in a few countries (Guyana, Kyrgyzstan, Georgia, Bahamas, Congo,
Yemen, Palestine, Aruba, Belize). Method: a test-only call of `Y5A` (the approval breakdown) in every variant, seed
12345, playing 756, 8 months; unmodded, full mod, and the mod minus or with only single patches. Identical code gave
identical results (a 20 s pause between months changed nothing).

| ID | Finding | Evidence | Conf. | Action |
|---|---|---|---|---|
| A15 | **Most gaps are A1's growth slope applied to A4 convergence, and the unmodded game is the outlier.** Approval is anchored at day 0 (`_apprAnchor`), so its growth term (`F5A`, `gw(g,"growth",...)`) moves approval by slope x the change in the growth gap since day 0. Day-0 growth is partly seeded from observed data and converges to the model's own rate (A4). With the game's +5.4 per point that convergence collapses approval in fast-growing economies (Guyana 55 to 1, Kyrgyzstan 49 to 1, Georgia 53 to 7 in 8 months) and lifts it in recovering ones (Congo 49 to 80); the mod's +1.5 cuts these moves by about 70%. Growth paths are the same in both games (gap under 0.1 point). | Month 8: mean approval gap 4.19 pt, 17 countries above 10 pt; without A1 1.28 pt and 2 countries | measured | Not an A1 bug; root cause A4 (A4d design). |
| A16 | **A1's loss slope lifts approval far in a recovery from a deep slump.** Palestine starts at -22.9% growth; as growth recovers to -6%, approval rises from 60 to 93 in the mod (77 unmodded), since the loss slope applies to the whole recovery. | Palestine (275) series, mod vs unmodded | measured | Candidate: cap the growth term at +-10 points (`K6(...,-10,10)` in A1's replace; day-0 neutral through the anchor); root fix with A4. |
| T15 | **T2 removes a dollar-depreciation boom in dollar-pegged tourism economies.** Unmodded, the US day-0 current-account deficit keeps depreciating the dollar (REER 0.9974 at month 2 vs 1.0000 with T2); pegged currencies follow (BSD, BZD), their tourism gets cheaper and the Bahamas boom (growth 3.4% to 7.5%, approval 56 to 70). With T2 the Bahamas' tourism exports are 9% lower by month 2. Of the finance patches only T2 changes the Bahamas' growth. | Single-patch runs (T2 alone reproduces it; H2, T1, T4, D1/D2, M6, M4, T14, C14 alone match unmodded) | measured | Plausible; the unmodded boom is the drift T2 fixes. No change. |
| T16 | **Small dollar-pegged tourism economies sit near a tipping point.** Aruba's growth path flips (2.4% vs 8.6% at month 8) when A1 alone is removed, a patch that does not touch the economy, while the null run (1e-12 perturbation) does not flip it, so the chaos floor underestimates their sensitivity. | Aruba (533), mod vs mod minus A1 | measured (flip); inferred (cause in the tourism market) | Read the tourism market (`tHB`, `beforeGood` in `SOA`) before trusting single-country gaps for these economies. |
