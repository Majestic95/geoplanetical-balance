# Geoplanetical construction system: review for a realism mod

Status: first pass (2026-10-30), static analysis of build **26318758** (`simulation-worker.bundle.js`). IDs K1–K10.
Prompted by community feedback (construction as a development driver; a construction-material shortage the
industrial adviser does not see). Tags: **read** = a first reader read the cited code; **read+checked** =
re-read by a second reader; **inferred** = reasoning from read code. Offsets are UTF-16 offsets in 26318758.
No determinism hazard found (no `Math.random`/`Date.now`/`performance.now` in the construction ranges; launch-month
gating uses a seeded hash of `rngSeed0`; iteration over arrays or sorted keys).

## How it works

- **State.** The save part `construction` is `A.construction`, one array of projects: `kind` (plant, storage,
  interco, transport, publicFacility, housingSocial, housingPrivatePortfolio, productionRoute, baseFacility, ...),
  `owner`/`host`, `totalCost`, `monthsTotal`/`monthsLeft`, `paid`, `phase` (construction, delayed, supply_hold, or a
  financing/legal/occupation/diplomatic/delivery hold), `inputBasket`, `materials{good:{required, received,
  consumed}}`, `purchaseFunding{sourceAccountId, reserveAccountId, wipAccountId, assetAccountId, ...}`.
- **Call order.** Monthly phase `MONTHLY_ENERGY_MILITARY` -> `sim._tickConstruction` -> `OeQ@93321189` (one pass over
  all projects). Materials are bought earlier in the month inside the world trade/CGE settlement through the
  `constructionDemand` channel (@95893316), classed as investment final demand in GDP (`iJB@25068508`).
- **Money flow.** Open (`Mr@11331248` -> `mG@11329814`): three ledger accounts per project (cash, WIP, completed
  asset); required quantities = cost x share / quoted price (`VK@11321585`). Monthly (`C6A@11332798`, `aaB@11334147`):
  cash reserved, orders sized to the remaining schedule; order price capped at 2x the budgeted unit price (`FSQ=2`,
  `bW@11323167`), 3x after 6 stalled months (`JSQ@11326886`); treasury owners can top up through automatic
  financing (`br@11758750`) unless defaulted. Receipts booked into WIP at the budgeted value, price differences to
  the payer's variance expense (@95828483). Progress = delivered share of the month's core materials (`tc@11327107`,
  `OW@11325154`); short deliveries set delayed or supply_hold. Completion (`Tw@11335078`): WIP -> asset, unspent
  reserve returned, treasury assets merged into `public-works:<owner>:<ccy>` (`uaB@11337709`), then the domain
  handler (plant GW, facility units `FuB@15101773`, social dwellings `C4B`, route capacity). Cancellation: WIP
  expensed (`construction_abandoned`). Projects without `purchaseFunding` use a pay-as-you-go path
  (`B9A@93320503`).
- **Who builds.** "construction" is a CGE good and sector (labour-intensive, 5% tradable; inputs cement, aggregates,
  water, steel, wood, logistics...); payments reach construction producers through the settlement (payee not
  traced: inferred). Business structures are a separate perpetual-inventory stock (`jLB@24927009`,
  `RLB@24927358`: 40-year life). Day-0 investment is scaled by the construction the country can supply
  (`constructionAccess0`, `O2g@24924421`).
- **Capacity.** `KeQ@93317943`: yearly room = construction capacity x 1.1 - non-project use - the open order book.
  `NPA@93318402`: a project that does not fit is stretched up to 3x, else refused (`construction_backlog`).
  `ZZA@93318810`: the AI pauses new starts when 25% of its projects lack materials, when there is no room, or outside
  its launch month.
- **Technology and scale.** Route projects pass a `technologyGate` (`xMg@92782337`) and pilot -> first commercial ->
  series staging (pilot 3x cost, first commercial 1.65x); yearly orders capped near 6% of existing capacity
  (`RMg@92783098`). Plants need a technology node; their design factor shortens build time (`ex@93308627`).

## What looks wrong

| ID | What looks wrong (real-world behaviour it departs from) | Code | Conf. | Suggested fix |
|---|---|---|---|---|
| K1 | **The player is exempt from construction capacity (Medium).** The backlog refusal and the schedule stretch apply only when `source==="ai"`; the player can order up to 500 facility units per call, and `Xy` computes `committedMonthlyBn` but never checks it. The player's surge is rationed through fill rates and slows AI projects too. Absorption capacity binds governments in reality. | `hqA@95399390`, `Xy@95398342`, `WQQ@92789501`, `ZZA@93318810` | read+checked (`hqA`) | Fixed by the mod (patch `k1-k2-construction-capacity`): the player's orders are stretched, at most 3x, never refused. |
| K2 | **Power plants, storage, interconnectors and transport skip construction capacity (Medium).** Their only limit is monthly spend <= GDP x the investment share / 1200, the country's entire gross investment; `NPA` is never called. A small economy can run a nuclear programme at a large one's pace. | `Z7A@93313356`, `feQ`/`em@26360643` | read | Fixed by the mod (patch `k1-k2-construction-capacity`): plants (never refused), transport and programmes checked with their civil-works quantity; the investment gate is unchanged. |
| K3 | **Not confirmed (measured 2026-10-30): exports are not served before home demand.** The settlement does take home supply as production - exports + imports with exports fixed (`gtg@25053918` in `etg@25057414`), but the trade solve that fixes them (`CJB@25036295`) already enters each country's own demand: the non-tradable share is reserved for home producers (`PHB@23821523`) and the rest bids in the world pool beside foreign buyers, without freight or border cost. Measured, unmodified, seed 12345: at month 3, of 2,003 country-goods more than 1% short only 128 also export the good (about 3% of unmet value), filled 98.5-99% like non-exporters, all services; no steel, cement or construction shortage alongside exports. Playing Japan with 1,000 hospitals ordered at day 0, steel (38), cement (46) and construction (73) never show unmet demand in 4 months, yet the 30-month hospitals advance about 0.75 month per month: the market clears construction to what the builders supply, so the shortfall is construction capacity, which K1 turns into a stretched schedule (54 months, most projects in construction by month 3). | `gtg`, `etg`, `CJB`, `PHB`; probes in the 2026-10-30 session | measured | None; K1/K2. |
| K4 | **The industrial adviser is blind to unmet demand (Medium; the player report).** `IoB` reads `we.cons`, which after settlement is delivered quantity only (the shortfall is in `we.unmet`); unmet project orders vanish from domestic need, import dependence and the `already_net_exporter` test ("already exports more X than it imports"). The AI's sector choice (`CyQ`) uses the same function. | `IoB@95384833` (`D=Math.max(0,sC(B.we.cons?.[r]))` @95384984), `F_g@95382854`, `CyQ@96191521`, settlement @25059627 | read+checked (`IoB` reads cons, never unmet or fillRate) | Fixed by the mod (patch `k4-adviser-unmet-demand`): `IoB` counts `cons + unmet`; the poor-fit verdicts are skipped above 2% unmet. |
| K5 | **Projects never fail (Low-Medium).** Holds last indefinitely; a stalled project only raises its price cap; no cancellation, write-off or carrying cost for chronic delay. Real megaprojects overrun and some are abandoned (sunk-cost write-off, busts). | `OeQ@93321189`, `JSQ@11326886` | read | AI cancellation after N months on hold through the existing abandonment path. Contained, AI only. |
| K6 | **Overruns follow prices only, never scope (Low).** The quoted cost is fixed; there is no size- or complexity-related time or cost overrun, a well-documented megaproject pattern. Overruns are paid by the right payer. | `bW@11323167`, `yW`, @95828483 | read | New design: seeded overrun draw by size and complexity. |
| K7 | **Route projects quoted at world prices, bought at local prices (Low-Medium).** Cheap economies get a favourable variance; expensive ones hit the 2x cap and stall; local cost conditions are invisible at launch. Plants and facilities already quote local prices. | `WQQ`, `TSQ`, vs `C6A` | read (variance inferred) | Quote the construction share at the local price. Contained; shifts AI costs. |
| K8 | **Completed public works never depreciate (Low-Medium).** `public-works:*` is only credited; facility units are lost only through damage (`G0A@15100719`); underfunded maintenance degrades nothing (overlaps E3, C19). | `uaB@11337709`, `G0A@15100719` | read (absence by search) | Depreciate the account and erode units when maintenance coverage stays below 1. New design, small. |
| K9 | **Better designs are both cheaper and faster (Low).** Cost scales with `1/max(.8,design)`, months with `1/sqrt(design)`; no first-of-a-kind penalty for plants (routes have one). First-of-a-kind and advanced designs usually overrun. | `ex@93308627` | read | First-of-a-kind multiplier on a country's first plant of a source. Contained. |
| K10 | **Business structures and projects may overlap (unverified).** Structures demand (40-year life) runs alongside project demand on the same good; whether public projects add on top of a still-running baseline public investment (double counting) is not verified. | `RLB@24927358`, genesis @24054192 | inferred | Verify before acting. |

## Community suggestion against the code
- Capacity limiting construction: exists (`KeQ`, `NPA`, `ZZA`) but binds only the AI and the route and facility
  paths (K1, K2).
- Capacity that must be invested in: partial (construction is an ordinary CGE sector; no construction-specific
  workforce or skills constraint).
- Payment over the project's life: exists (monthly reserve and purchases, WIP, completed asset). Realistic.
- Booms and busts: booms appear (investment in GDP, sector output, material prices, overheating through fill rates
  and the 2x cap); busts and failure are missing (K5, K6), and K3 lets exports starve domestic projects.
- Technology limiting complexity: exists (route gates, pilot staging, plant technology nodes, nuclear licensing).

## Not yet read
- The settlement's payee for `constructionDemand` purchases; construction wages and employment attribution.
- Whether the treasury's financing top-up posts debt or only resizes orders.
- Whether AI corporate investment (`BPQ`) expands construction capacity under a backlog (does `productionDemand`
  include unmet demand?).
- Possible double count of route projects' construction use in `KeQ`; the post-day-0 baseline public investment
  (K10); facility maintenance effects; housing starts against `KeQ`.
