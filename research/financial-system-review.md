# Geoplanetical domestic financial system: review for a fix mod

Status: complete first pass (2026-10-29). All five areas are covered. Start with section 1.5 (the cross-cutting
problem), then the per-area tables.

**Corrections (2026-10-29, `research/economy-systems-review.md` section 1):** F1 is narrower than stated (ledger
taxes and appropriated spending do flow through household and company accounts), F5 is resolved (no double count:
`TeQ` subtracts every ledger-collected tax), F4 is partly wrong, and F2 is qualified. Read that section before
building on 1.5, F1, F2, F4 or F5.

Purpose: a map of how the game models domestic finance, and a list of what looks wrong from a finance or economics
point of view. It is the starting brief for a mod that corrects some of these models.

Scope: read-only static analysis of the game code. No game runs, so nothing here is measured in play. Every claim
names the function and the bundle offset it was read from, and has a confidence tag:
- **[read]**: read in the code directly.
- **[checked]**: found on a first read, then confirmed by reading the cited code.
- **[first read]**: found on a first read and not yet re-checked. Verify before building on it.
- **[inferred]**: reasoning from code that was read, not a direct read of the behaviour.

---

## 1. Where the code is and how to read it

- Game: Geoplanetical (Steam app 940230), Electron/JavaScript. Analysed build: **26296134**.
- Simulation code: `renderer/simulation-worker.bundle.js` inside the game's asar archive. It is one minified line of
  about 97 MB. Extract it with the loader's `tools/asar_extract.py`
  into `.modding/decompiled/app-26296134/renderer/` (not committed).
- UI strings: `renderer/locales/en.json`. The relevant key namespaces are `finance.*`, `budget.*`, `fiscal.*`,
  `currency.*` and `econ.*`.
- Query tool, from this repository's root with the loader cloned next to it (read-only, reads `.modding/decompiled/app-<build>`):
  `node --max-old-space-size=8000 ../geoplanetical-modloader/tools/bq.mjs --max N def|src|find|at|in|refs <arg>`.
  `src <name>` prints a whole function, `find <text>` lists occurrences with the function that contains each one, and
  `refs <name>` lists callers. Each call takes about 3 s. Never `grep -o` or print wide spans of the bundle.
- **Minified names (`Fp`, `rjB`, …) and offsets change with every game build.** Anchor patches on stable text:
  - error strings, e.g. `"sovereign-bonds:auction-rate"` and `"sovereign-spreads:scale"`;
  - event ids, e.g. `"finance.debt_issued"` and `"finance.sovereign_defaulted"`;
  - config keys, e.g. `spreadPctByRating` and `_bondRequiredYield`.

  Re-locate the functions in each new build. The porting helper `../geoplanetical-modloader/tools/rename-map.py <old bundle> <new bundle> NAME…`
  maps old names to new.
- Many config objects carry `_doc` and `_sources` fields in French that state the designer's intent and data source.
  Read them before deciding something is a bug.
- Data model: an actual double-entry ledger in `A.finance`, holding `accounts` (`balanceBn`), `instruments`
  (bonds, loans), `positions` (who holds each instrument), `banks`, `sovereigns` and `households`. Postings go through
  journal helpers such as `A6(C,{kind,entries:[{accountId,debitBn|creditBn}]})`. The country object carries cached
  scalars such as `B.debt`, `B.debtAvgRate`, `B.bondRate`, `B.rating` and `B.treasury`, refreshed from the ledger
  by `fr` and `fB`.
- The game's own mod system (the locale file's `mods` namespace) is presentation-only; see
  `research/economy-systems-review.md` section 0.

---

## 1.5 The cross-cutting problem: the public sector is not connected to the private ledger

**Most important finding.** `anB@11712757` is the daily fiscal posting [read].
- Tax revenue is booked Dr treasury cash / Cr a `revenue` income account. Primary spending is booked Dr an `expense`
  account / Cr treasury cash. Any unpaid part goes to a "funding need" liability.
- No household, company or bank account is on the other side. Revenue amounts are computed as a % of GDP by
  formula (`TeQ`), not collected from anyone. Spending is paid to no one.
- The postings balance as double entry, but the treasury is not linked to the private sector. Taxes create
  treasury cash out of nothing, and spending destroys it.

Consequences [inferred from the above plus the monetary model]:
- Deficits do not add to private deposits, and surpluses do not drain them. The money stock that drives inflation
  (bank deposits, `LV@15067701`) does not respond to fiscal policy.
- Fiscal policy affects the private economy only through whatever the macro model (`_tickMacro`) does with spending
  and tax shares, not through balance sheets. Not traced.
- **Corporate profit tax may be counted twice** [suspicion, not verified]:
  - Company closing `x3Q@94678832` really pays tax from company cash to treasury cash.
  - The revenue formula `TeQ` (tax `is`) also uses those `operatingTaxReceipts` for its rate.
  - `anB` then credits treasury cash again.
  - Verify with a runtime ledger check: treasury cash change vs posted entries for one month.
- The household side may model income tax and VAT in its own income accounting (fields `householdIncomeTaxPaidBn`,
  `householdVat`) without ledger postings. Not traced.

For a mod this is the root fix, but also the most invasive. Debit taxes from household and company accounts, and
credit spending to payees (households for transfers and wages, companies for purchases). Everything downstream
(bank deposits, money stock, inflation, bond auction capacity) would then react to fiscal policy. Expect a large
re-calibration.

---

## 2. Budget, taxes and spending

### 2.1 How it works [first read; items marked read were re-read]

- **Cadence:**
  - **Daily:** `qEC@96187047` → `_tickSovereign@96272721` → `J1Q@93439811`, with `dt=1` per country [first read; `J1Q`
    read]. Steps:
    1. Required yield `Fp`.
    2. Debt refresh `fr`.
    3. `JKB@25397761`, which converts `revenueGdpPct = TeQ(...)` and
       `primaryExpenseGdpPct = max(0, KCA − ZVB − EU contribution − military aid given) × delivery` into
       `pct × gdpNom × dt/365/100`.
    4. Posting by `anB`.
  - **Monthly:** `l6B@96160580` → `EJQ` → `NoC@96154499`. Coupons, maturities, auto-borrowing (`M1Q→Ckg`) and
    auto-printing (see 3.1).
  - **Yearly:** `nJQ@96170853` → `A1Q@93398275` sets `budgetGdpReferenceBn = gdpNom` for every country
    [`A1Q` read].
- **Revenue** `TeQ@93388973` → `OeQ` → `OZA@93390751` [first read]:
  - The total is the sum over taxes of `xf@93384929`, rate × base × efficiency.
  - Bases (`c0A@15628575`, `To@15627574`) are fixed GDP shares that vary by income tier: labour 0.45–0.55,
    consumption 0.22–0.36, profits 0.11–0.13.
  - Efficiency `or@93383189` adjusts for stability, corruption, tax burden and inflation, clamped to [0.15, 0.99].
  - Some taxes use flows instead: tariffs use real trade flows and VAT uses `_tvaFlow`. Ledger receipts replace the
    formula where they exist (corporate tax).
  - Filler lines: `other_structural = max(0, 2.5 − public dividends)` % of GDP (`zeQ@93388426`), `other_historical =
    revAdjust` (a calibration residual), and an `accounting_floor` of 0.25% of GDP.
- **Spending** `Pn@93401908`, `T7A@93392222` [first read]:
  - Programs are `X2(spend[p] × demographic factor)`. `X2@10974310` = pct/100 × `budgetGdpReferenceBn`, i.e. last
    year-end's GDP [read].
  - Pensions (`TPB@15554631`) = beneficiaries × average pension × benefit index × generosity. The electricity
    subsidy is a 0–1 lever.
- **Treasury cash management** [read]:
  - `gkg@93428600` keeps one month of appropriations in budget cash.
  - `Ckg@93428997` borrows when the funding need is above 0 or cash is below 0.5% of GDP, targeting the funding need
    or 1.5% of GDP.
- **Default spending** [first read]: `v1Q@93427400` limits delivery to receipts + cash months, scaled by arrears.
  `FCA@93397857` cuts unprotected programmes first; pensions (`retr`), unemployment (`chom`) and military (`mil`)
  are protected.
- **Budget reform** `Fa@93378702` [first read]: replaces taxes, spending and fiscal policy in one step, with preview and
  rollback. It takes effect immediately.
- **AI** [first read]:
  - `O1Q@93443213` and `iRg@95181096` classify a monthly mode:
    - support if GDP fell or growth < −0.5%;
    - consolidate if the primary deficit is > 2% of GDP and debt pressure is rising;
    - crisis on the crisis flag.
  - Reform packages are applied via `T2@95181913` with fatigue windows.
  - `_dQ@95228852` steers only the defence budget continuously.
  - There is no explicit debt-sustainability target.

### 2.2 What looks wrong

| # | Finding | Evidence | Conf. | Mod angle |
|---|---|---|---|---|
| F1 | **Taxes and spending are not linked to any private payer or payee** (section 1.5). | `anB@11712757` | read | Root fix; invasive. |
| F2 | **Spending is indexed to last year-end's GDP, revenue to today's.** Within a year, inflation or growth raise revenue but not programme spending, so deficits improve automatically. In a contraction they worsen, then spending jumps at the yearly rebase. High inflation therefore cuts real spending for free until 1 January. | `X2@10974310` uses `budgetGdpReferenceBn`; `A1Q@93398275` rebases it yearly; `JKB` revenue uses current `gdpNom` | read (cadence of `A1Q` from the first read) | Index spending continuously to a smoothed nominal GDP or a price index, or set spending in nominal terms with explicit indexation rules. |
| F3 | **Not confirmed (re-checked 2026-10-30 on 26318758).** The cited names (`TPB`, `Vr`, `X2`) came from an older build and the claim was never read. Pensions do not scale with current nominal GDP: `O7B@15611486` indexes them through a cumulative benefit index under the country's `pension_indexation` policy (wages, prices, their geometric mean, or money). Other programmes not re-read. | `O7B@15611486` | read | None for pensions. |
| F4 | **Taxes are rate × fixed GDP share × efficiency, not a real base.** The labour base is 45–55% of GDP whatever unemployment or wages do, and the profit base is 11–13% whatever profits do (except corporate tax via ledger receipts). There is no progressivity and no Laffer response beyond the efficiency term. | first read: `xf@93384929`, `c0A@15628575`, `To@15627574` | first read | Derive bases from the simulation's wage bill, household consumption and company profits. |
| F5 | **Possible double count of corporate tax** (section 1.5). | suspicion | unverified | Runtime ledger check first. |
| F6 | **Revenue filler lines:** 2.5% of GDP of "other structural" revenue, a calibration residual `revAdjust` and a 0.25% floor. About 3% of GDP of revenue does not respond to policy or the economy. | first read: `zeQ@93388426` | first read | Keep as calibration, or model the underlying items (fees, property income). |
| F7 | **Reforms take effect at once.** No legislative or implementation lag, so tax and spending changes hit the next daily posting. | first read: `Fa@93378702` | first read | Phase-in over months; partial collection in year 1. |
| F8 | **Default is only liquidity-driven.** It happens on a failed coupon, maturity or auction, never on debt/GDP. With auto-borrowing and fixed-price auctions (D3), a country can stack debt while capacity lasts. | `NoC@96154499` | read | Pair with D2/D3. |
| F9 | **The AI has no debt anchor.** It consolidates only when the primary deficit is > 2% and pressure is rising, and otherwise drifts. It continuously tunes only defence. | first read: `O1Q@93443213`, `_dQ@95228852` | first read | Add a debt-target fiscal rule to the AI. |

---

## 3. Sovereign debt, credit rating and bond market

### 3.1 How it works

**Credit rating** (0 = AAA … 18 = worst non-default, 19 = default):
- The target score comes from `hCA@93432673`, which is `c1Q(RZA(A,B,C_A(A,B)))` capped at 18, or 19 if in default
  [read].
  - `RZA@93424560` builds the inputs: `income` = log of GDP per head, `size` = log of nominal GDP, `interest` =
    projected debt × average rate / revenue as a share of GDP, `debt` = 3-year projected debt ratio excluding
    central-bank holdings, `deficit`, `inflation`, `growth`, `stability`, `default_history`, `fx_debt`, `external`
    (current account), `reserves`, `reserve_currency`, plus `stability_shock` and `credibility_shock` [read].
  - `c1Q@93425558` scores them as `intercept + Σ weight·input + 5·stability_shock + 8·credibility_shock`, clamped to
    0–19 [read].
  - The weights are a single cross-sectional regression on agency ratings from June 2026 (`var Gp`, @93421927;
    n=154, r²=0.916, RMSE 1.54) [read]:
    - `income −.323`, `size −.663`, `interest +.0875`, `debt +.0135`, `deficit +.134`, `inflation −.0015`,
      `growth +.0595`;
    - `stability +16.77`, `default_history +4.69`, `fx_debt +2.33`, `external +.045`, `reserves +.283`,
      `reserve_currency −1.09`;
    - intercept 4.056.
- The debt projection `t1Q@93424348` steps forward 3 years: `e = e + deficit − e·(avgRate−cashRate) − e·g/(1+g)`
  [read].
- Moving the rating (`A9A@93434057`, facade `_tickRatings`) [read]:
  - `ratingScore` moves 25% toward the target each tick (`WZA=.25`).
  - The rating changes only on a review day, every 150 + (hash % 90) days, by `u1Q@93426559`: 1 notch, or 2 when the
    gap is 3 or more (`VZA=2`).
  - A downgrade gap of 3 or more triggers an immediate extraordinary review that moves the full `trunc(gap)`.
  - The outlook flips at |gap| ≥ 0.7.

**Bond yield** (`Fp@93433650`) [read]:
```
yield = inflExp + 0.55·(policyRate − inflExp) + 0.4 + spreadPctByRating[rating]
        + 12·max(0, anchor0 − anchor)            // lost central-bank credibility (r_A=12)
        + 0.12·max(0, deficit − 6)               // only deficits over 6% of GDP count
        + (fxStress ? 2.5 : 0) + worldRisk − 1.5·glut
in default: inflExp + 26
```
`spreadPctByRating` (@93421834) is `[0,.1,.15,.25,.35,.5,.65,.9,1.2,1.6,2.1,2.7,3.4,4.3,5.3,6.6,8.5,11,15,20]`. If
policy is unset it defaults to inflExp + 1.5 (`UD`). Constants: `q1Q=.55`, `f1Q=.4`, `rkg=26`.

**Borrowing**:
- Player issuance quote `bCA@93430197` [read]:
  - Per-issue capacity `wkg` = GDP × (3 + 15·q²)/100/12, where q = clamp((17 − rating)/15, 0, 1) (`g_A`). A AAA
    country can issue about 1.5% of GDP per issue; a rating-17 country about 0.25%.
  - Suggested amount: `min(capacity, 3% GDP − treasury)` (`yG=.03`).
  - 30-day cooldown between issues (`Vdg=30`).
  - Closed when in default or distress, i.e. `P7@93429343`: rating ≥ 18, or (debt excl. central bank > 170% and
    rating ≥ 16), or debt > 400%.
- Auction `Tq@86999694` and demand `rjB@86998825` [read]:
  - Every issue is a single 10-year bond (`maturityDays: q8`, `q8=3650` @86974314).
  - Bidders and their limits:
    - Domestic banks at the required yield. Each bank's limit is `min(reserves − minLiquidity·deposits,
      equity/minCapital − assets)`.
    - Domestic households at yield + 0.25, with 2.5% of their cash balance (`QB(D,25,1e3)` is a per-mille portion).
    - The "rest of world" holder at yield + 0.45, with its whole cash balance in that currency.
  - The clearing rate is the highest required rate among the tranches used. If total capacity < amount, the auction
    is short ("demand").
- Settlement and automatic financing (`NoC@96154499`, run for each country by `EJQ`) [read]:
  - Pays coupons and maturities, and defaults on shortfall (`maturity_default` and `coupon_default`).
  - Otherwise covers the funding need: automatic borrowing via `M1Q→Ckg`, or automatic money printing.
  - It prints (`Rj`) when the country is distressed (`P7`) and controls its central bank (`B9A = P7 && Zf`, where
    `NM@93435410` allows only "reserve"/"control" regimes and no IMF programme).
  - Union, peg and board members cannot print, so they default (`funding_auction_default` when the need is over
    0.5% of GDP).
- Repayment `F1Q@93436802` → `D_A@93436191` (quote) → `PjB@87018429` → `HsA@87016635` [read]:
  - Redeems at **face value**, oldest maturity first.
  - Each lot's redemption is split across all holders in proportion to their holdings. Holders book the gain or loss
    against book value.
- Default `_f@93437233` [read]:
  - Haircut `ZZA` = clamp((debtRatio − 70)/debtRatio, 0.2, 0.95). That brings debt to about 70% of GDP, with a
    20% minimum haircut.
  - Market exclusion `Z7A` = 730 + 2940·0.5 = about 2200 days by default (`P1Q=.5`).
  - Stability and approval shocks.
  - Primary spending is cut by "delivery" `v1Q@93427400`: spending is limited to receipts plus cash, scaled down by
    arrears.
  - Monetized lots are exempt from the haircut.
- Monetization (player `finance.monetizeDebt`, quote `Hy@95295427`; execution `e_A@93434803`; sizing
  `$2A@15067973`) [read]:
  - Printing `nominal` buys only `real` value: `D = printed/base + need/stock`, `nominal = (D·base − printed)/(1 − D)`.
    This is an inflation-tax ceiling: you can't raise more than the money stock.
  - Each print cuts the credibility anchor: `anchor ← anchor·exp(−0.219·nominal%GDP)` (`x7A`), floor 0.02. That raises
    yields (12 pts per unit lost) and the rating (8 notches per unit).
  - Print memory decays with a 15-year half-life (`xZA`).

### 3.2 What looks wrong

| # | Finding | Evidence | Conf. | Mod angle |
|---|---|---|---|---|
| D1 | **Growth worsens the rating and inflation slightly improves it.** The weights were fitted across countries (fast-growing emerging economies have worse ratings) but are applied within one country over time, so a boom raises the rating index (worse) and inflation is effectively free. | `Gp.weights.growth=+.0595`, `inflation=−.0015` @93421927; used in `c1Q` | read | Flip or zero the growth weight for the within-country part, give inflation a positive weight, or score the rating as day-0 calibration + a within-country change model. |
| D2 | **Debt level barely moves the rating.** +0.0135 notch per point of debt/GDP, so 60% → 120% is about 0.8 notch. Pressure comes only through the interest/revenue term and the hard cliffs in `P7` (170%/400%), so it is a cliff, not a slope. | `Gp.weights.debt`; `P7@93429343` | read | Smooth penalty above a threshold (e.g. +1 notch per 20 pts above 90%), and soften the `P7` cliffs. |
| D3 | **Issuance size does not move the yield.** Each bidder class takes bonds at a fixed premium (0 / +0.25 / +0.45) up to its limit, then the auction fails. There is no supply curve, so issuing 0.1% or 3% of GDP costs the same rate until the hard wall. | `rjB@86998825`, `Tq@86999694` | read | Add an upward-sloping demand curve per bidder (required yield rising with the share of capacity taken), or a yield term in debt growth. |
| D4 | **Repayment is a forced buyback at face value from everyone.** When market yield > coupon, bonds trade below par and the state overpays; when yields fall, holders lose their premium without consent. Real buybacks are at market price and voluntary. | `HsA@87016635` (debits debt liability by face E, pays holders pro rata) | read | Price the buyback at the bond's market price (the game already tracks `domesticBondPriceIndex`), or limit repayment to maturing lots. |
| D5 | **One maturity for everything.** Every new bond is 10 years. The "maturity wall", "refinancing profile" and "average maturity" UI therefore show a profile the player cannot shape, and there is no term-premium choice (short = cheaper but rollover risk). | `Tq … maturityDays:q8`, `q8=3650` @86974314 | read | Add a tenor choice (e.g. 1/3/10/30 years) with a term-premium curve. |
| D6 | **The rating's debt measure excludes central-bank-held debt**, so monetization flatters the debt input. The credibility penalty (8 notches per unit of anchor lost) is heavy and offsets it, so this is a smaller issue. | `Xf@93404452` used for `debt` in `RZA` | read | Minor; leave unless play shows printing improves ratings. |
| D7 | **The deficit hits the yield only above 6% of GDP**, at 0.12 pt per point. A 5% deficit adds nothing; the deficit works mostly through the rating. | `Fp@93433650` | read | Make it continuous from 0, or drop it and rely on the rating. |
| D8 | **Default haircut always targets about 70% debt/GDP**, whatever the debt mix, the holders or the negotiation. Real haircuts vary widely (Greece 2012 ~53% NPV, Argentina 2005 ~70%). | `ZZA@93426866` | read | Acceptable simplification; could scale with foreign-held share. |
| D9 | **Rating moves are asymmetric:** downgrades of 3+ notches happen at once, upgrades only at reviews (max 2 notches). This mirrors agency behaviour and is probably intended. | `u1Q@93426559` | read | Leave. |
| D10 | **Distressed countries that control their central bank print automatically** when the market won't fund the deficit, without a player choice. This is realistic in outcome, but it is silent policy. | `NoC` → `oJQ`/`Rj`, `B9A` | read | Possibly a player-facing choice (print vs default vs IMF), which the code already offers manually (`wHQ` monetize/imf/default). |

---

## 4. Monetary policy, inflation and currency

### 4.1 How it works [first read; items marked read were re-read]

- **Two copies of the inflation module** exist in the bundle: one with names `Td/js/fD/TiB`, the other with
  `Sd/xs/UD/c4` around @15063937. The constants are identical. A patch must cover both [first read].
- **Inflation** `TiB`/`ViB` (~@15070452) is the sum of six annualised log drivers (`sVQ` ~@15068800) [first read]:
  - expectations = ln(1 + inflExp);
  - demand = −0.25 × (unemployment − day-0 unemployment);
  - policy = −sign(t)·ln(1 + 0.35·|t|/(1 + inflExp)), where t = real policy gap over neutral;
  - money and flight = decayed impulses (τ = 0.25 years);
  - currency = 0.5 × import share × (depreciation − core inflation + world inflation).

  These accumulate into `moneyLog`, the price level, which is clamped at ±600.
- **Inflation expectations** adapt toward actual inflation at speed 0.5 + 2.5·(1 − anchor) per year, plus a pull to
  target proportional to the anchor [first read].
- **Policy rate:**
  - Player (`m1Q@93439198`) [read]: any rate in [0, max(40, min(150, 2·inflExp))]. Only allowed when the country
    controls its central bank (`MwA`: no peg, board or union without a seat, and a government-controlled central
    bank by law). Setting it turns `cbAuto` off. `restoreCbIndependence` (`p1Q`) turns it back on.
  - AI and autopilot (`f6Q` ~@93744318) [first read]: a Taylor rule `inflation + infResp·(inflation − target) −
    empResp·unemployment gap + neutral`, moved toward at speed 0.02–0.4. Pegs follow the anchor's rate, +4.5 under
    FX stress.
- **Credibility anchor** (`w6Q@93713406`) [first read]:
  - The anchor moves daily toward a ceiling = anchor0 × s × exp(−3·printMemory), where
    s = (cbAuto ? 1 : 0.55) × (0.55 + 0.3·inflation-vs-target + 0.15·real-rate term) × (0.7 + 0.3·deficit term).
  - It recovers 0.3 per year and decays 0.9 per year. There is no recovery within 180 days of a monetization.
- **Monetization** (read in 3.1) [read]:
  - `tjB@87005648` books Dr treasury cash / Cr central-bank reserve liability, and Dr central-bank sovereign asset /
    Cr debt liability.
  - The bond is 10-year and called with coupon 0 by `e_A`.
  - Only `realBn` is minted in the ledger. The price-level effect uses the full nominal amount (`BtA`).
- **Sterilization** (`Uy`/`hkQ` @95296944) [first read]: the treasury repays central-bank-held bonds, destroying money.
  The first read checked algebraically that the round trip is neutral.
- **FX** [first read]:
  - A float moves by a PPP differential − 0.5·real-rate gap − 0.45·current account + 14·(REER − 1) (`f6Q`).
  - A peg is hard-set to anchor × ratio. It breaks to a float (18–55% depreciation) when the reserve runway runs out
    and there is no guarantor (`L6Q@93750516`).
  - Devaluation `lLQ@96016822` [read]: default 15%, capped at 90%; costs approval −3 and stability −2.
  - Adopting a strong currency `Y1Q@93437856` [read]: currency board, 90% dollarisation, `cbAuto` back on.
  - Foreign-currency borrowing (`MLQ`) is capped at 3% of GDP per call, into reserves [first read].

### 4.2 What looks wrong

| # | Finding | Evidence | Conf. | Mod angle |
|---|---|---|---|---|
| M1 | **Paying FX debt "from reserves" doesn't use the reserves.** In monthly settlement, when FX-denominated debt falls due and treasury cash is short, `oJQ` covers up to the size of FX reserves with a *sterilized* monetization. `U1Q` calls `e_A(…,{sterilized:true})`, which returns before the inflation and anchor effects. `tjB` then credits treasury cash and books a zero-coupon central-bank bond. **Nothing debits the reserves.** The country keeps its reserves and gets free central-bank financing with no inflation or credibility cost. | `oJQ@96154142`, `U1Q@93435836`, `e_A@93434803` (`if(!r.ok\|\|w)return` before `BtA`), `tjB@87005648` (no reserve entry) | read+checked: **finding overstated** (2026-10-29) | **Correction:** "nothing debits the reserves" is false. The monthly reserve flow `VBA@87028032` (via `F6Q@93748717`, `XM`) = [current account (`Em@87027337`, net of external interest) + private financing − (FX principal due within a year, `WBA`/`gjB@86997502`, minus the day-0 rollover level `principalRolloverBnY` while the market is open) + FDI] × a regime factor `kjB` (`Q8g@87025669`: peg 0.9, board 0.95, managed 0.45, union 0.15, float 0.12). So pegs and boards draw reserves for FX principal above the day-0 level; floats and managed currencies let the exchange rate absorb most of it. `oJQ`/`U1Q` covers the treasury's local-currency shortfall. A reserve debit in `oJQ` would double count for pegs; for floats, how far FX debt payments should hit reserves is a modelling question, not this bug. No v0.1 fix. |
| M2 | **Central-bank lending to banks creates reserves with no monetary effect.** Liquidity loans (`nFA`) and rescues expand the central-bank balance sheet, but only monetization, repayment and flight feed the money impulse. | first read: `refs sLA` → `RiB`, `BtA`, `XiB` only | first read | Usually fine (short-term liquidity), but large or permanent rescues could feed the impulse. |
| M3 | **Ledger money and model money diverge.** The price level moves by the nominal print, but the ledger mints only `realBn`. The "dissolved" part has no ledger counterpart, so the next print's money stock (bank deposits) is understated. | `e_A` → `tjB(A,B,Q.realBn,0)`; `$2A`/`LV` | read (consequence inferred) | Mint the nominal amount and let prices erode it, or document it as a deliberate abstraction. |
| M4 | **Taking control of the central bank cuts credibility by about 45% at once, however well you run it.** `cbAuto=false` multiplies the anchor ceiling by 0.55. That is up to +5 pts of yield (12 × loss) and up to −3.6 notches of rating (8 × loss) as the anchor converges. `restoreCbIndependence` undoes it instantly and for free, so the player can toggle it. | first read: `w6Q@93713406`; `m1Q` / `p1Q` read | first read (`w6Q` not re-read) | Scale the penalty by policy deviation from the Taylor rule, add a cooldown on restoring, and grow credibility slowly after restoring. |
| M5 | **Adopting a strong currency erases printing memory** (`mCA(Q,0)`). Because a board can no longer print, this is mostly harmless, but it resets the ceiling term exp(−3·printMemory) too. | `Y1Q@93437856` | read | Minor. |
| M6 | **Devaluation has no cooldown.** Repeated calls compound for approval −3 and stability −2 each, with no credibility or rating hit. | `lLQ@96016822` | read | Cooldown, anchor hit and peg-credibility damage; consider FX-debt revaluation (not checked whether it already happens). |
| M7 | **Weak rate transmission.** The policy channel moves inflation about 3.4 pts/yr per 10 pts of real-rate gap. The demand channel is 0.25 × the unemployment gap. Rates don't reach credit spreads (B5) or equity values (B9), and there is a hard zero lower bound with no QE tool except monetization. | first read: `sVQ`; `QFA` read | first read | Link to B5/B9, and add a credit channel (loan demand vs lending rate). |
| M8 | **The bond-yield Fisher effect is partial.** With the player holding the policy rate fixed, the yield moves only 0.45 per point of expected inflation (`1 − 0.55`); the rest must come via the rating, which has no inflation weight (D1). High inflation with a fixed policy rate therefore gives cheap nominal debt. | `Fp@93433650` | read | Yield = inflExp + real term (full pass-through), with the policy rate affecting only the short end. |
| M9 | **Duplicate inflation module.** Fixing one copy may leave the other active. | first read | first read | Find which copy each caller uses before patching. |

---

## 5. Banks, companies, households, stock market, sovereign wealth fund

### 5.1 How it works [first read; items marked checked were re-read]

- **Bank balance sheet** `ke@11653305` [read]:
  - Assets = loans + reserves + sovereign bonds + other.
  - Liabilities = deposits + funding + central-bank liquidity.
  - Equity = the equity account + accumulated income − interest, central-bank, credit-loss and guarantee expenses.
  - `capitalRatio = equity/assets` (unweighted), `liquidityRatio = reserves/deposits`, `solvent = equity ≥ 0`.
  - Minimums are 7% capital and 5% liquidity (`u4B`, `P4B` @11615933) [first read].
- **Lending** `jK@11659105`/`D6A` [first read]:
  - A loan is refused if it would push the capital ratio below 7% or reserves below 5% of deposits.
  - A loan books Dr loan / Cr deposit (lending creates deposits).
  - Interbank payments settle in reserves, and a shortfall auto-borrows from the central bank (`DFA`).
- **Rates** `QFA@11616038` [checked]: lending = max(0.25, policy + 2.4), deposit = max(0, policy − 0.8).
- **Monthly order** `l6B@96160580` [first read]:
  1. Company debt service (`IFA`).
  2. Household banking (`T4B`).
  3. Central-bank liquidity settlement.
  4. Equity markets (`ElQ`).
  5. Sovereign funds.
  6. Household accounting.
- **Automatic interventions** `Sxg@95061748` [first read]:
  - An illiquid but solvent bank gets a 3-month central-bank loan at policy + 1.0.
  - An insolvent bank gets a public recapitalisation, enough to restore the minimum (`S4B@11679371`).
  - The recap is funded first from the deposit guarantee fund (target 2% of covered deposits, levy 0.1% per year,
    `MHg@93699742`), then treasury or SWF, then new debt.
- **Companies** [first read]:
  - Health check `HU@95040985`: liquid if there are no arrears and cash covers payables; solvent if assets ≥
    liabilities.
  - Distress lasts up to 3 months, then a bridge loan or rescue plan, then reorganise or liquidate according to
    the insolvency-law policy.
  - Creditor order is set by `VeB` (banks first, or wages and state first).
  - Tax with loss carry-forward, then dividends (`x3Q@94678832`).
- **Stock prices** `nuA@87432401` [first read]:
  - Price = valueMultiple × max(smoothed after-tax earnings, 3% of fixed capital) × war factor + net cash.
  - Market premium (`rSg@95078482`): premium^0.93 × (cap + buys)/(cap + sells), i.e. order flow moves the price and
    the premium decays 7% per month.
  - The config note says no interest rate enters the value (`_valueNote@87392229`).
- **SWF** [first read]:
  - Treasury ↔ fund transfers (`dVB`, `luA`), capped by treasury cash minus protected obligations (`UN`).
  - Capital injection at the quoted price (`XkQ`).
  - Sell orders queued to month end (`xkQ`), refused while autopilot is on.
- **Ledger integrity** [first read]: every path read (write-offs, recap, deposit "dust", deposit haircut, guarantee fund)
  is balanced. The bank balance self-check is `LW` (`balanceGapBn`). No money leak was found *within the private
  sector*. The fiscal side is a different matter: see section 1.5.

### 5.2 What looks wrong

| # | Finding | Evidence | Conf. | Mod angle |
|---|---|---|---|---|
| B1 | **Capital ratio uses unweighted assets.** Sovereign bonds, mortgages and corporate loans all weigh 100%. Basel risk weights would be 0% for own-currency sovereigns, ~35% for mortgages and ~100% for corporates. Banks are over-constrained on safe assets and under-constrained on risky ones, and the sovereign auction capacity (`rjB`) uses the same gate. | `ke@11653305` (`I=S([C,w,r,e])`, `capitalRatio=t/I`) | read | Risk-weight the denominator in `ke` (separately for each asset account). |
| B2 | **No loan-loss provisioning.** Credit losses reach equity only on write-off, so banks look healthy until a cliff. | `creditLossExpense` is debited only in `I6A@11673803`, `E4A@24029684` and sovereign haircuts; no "provision" code exists | first read | Expected-loss provisions from arrears or delinquency (an IFRS 9-like stage 2/3 charge). |
| B3 | **Household loans never default to the bank.** Arrears only set `delinquent` and accumulate (`IFA`, `E6A`). The only paths to bank losses are company liquidation (`ReB`) and dust clean-up (`XLQ`). A mortgage or housing crisis cannot hurt banks. | `refs I6A` → only `ReB`, `XLQ`; `delinquent` hits @11662457, @11669208 | checked | Charge off household loans after N months of arrears, with collateral recovery from housing value. |
| B4 | **NPL ratio is seed data only**, not a live risk measure. | `nplRatio`: all hits are config or seed | first read | Derive NPLs from delinquent instruments; drive provisions and lending spreads from them. |
| B5 | **Flat lending and deposit spreads, no credit risk pricing.** Every borrower pays policy + 2.4 whatever its leverage, sector or arrears, and bank stress doesn't widen spreads. | `QFA@11616038` | checked | Spread = f(borrower coverage/leverage, bank capital ratio, country rating). |
| B6 | **No deposit runs.** Deposits never move between banks or out to cash, and the central bank lends without limit at policy + 1. A bank fails only through equity < 0, never through liquidity. | no `bank_run`/`deposit_flight` code; `nFA@11674124`, `DFA` | first read | Deposit outflow as a function of capital ratio, rating, deposit-insurance coverage and contagion. |
| B7 | **Bank bail-outs cost no private party.** Banks have no shareholder instrument, so recap or "nationalize" (an ownership flag) wipes out or dilutes nobody. There is no moral hazard and no bail-in of uninsured creditors (except the currency-reform deposit haircut). | `S4B@11679371` (equity credit only); no bank dividend or equity instrument | first read (the "no owner" part is inferred) | Give banks an equity holder (households or SWF); recap dilutes or wipes them; optional bail-in. |
| B8 | **Auto-recap only at equity < 0, and only back to 7%.** A rescued bank sits at the minimum, one shock from the next rescue. Undercapitalised but solvent banks get nothing automatic. | `Sxg@95061748`; `s1A` needs `capitalGapBn>0` | first read | Recap to the minimum + buffer (e.g. 10%); restructuring conditions. |
| B9 | **Stock prices ignore interest rates.** The valuation multiple is fixed at calibration, so rate hikes do not lower equity prices (no discounting). | `_valueNote@87392229`, `nuA@87432401` | first read | Multiple = f(1/(real yield + equity premium − growth)), anchored to day 0. |
| B10 | **The exchange transaction tax is dead.** It is initialised to 0, read for display, and nothing sets it. | `transactionTaxRatePct`: 3 hits (`BVB@87425496` init 0, `uFQ@95921032` display) | checked | Either wire a setter (policy lever) or remove the UI line. |
| B11 | **Exchange closure freezes prices** for 30–180 days with no cost beyond the cooldown. | `ElQ`, `wVB@87431213` | first read | Accumulate a price gap while closed and release it on reopening. |
| B12 | **The SWF is a frictionless treasury account.** Contribute and withdraw are instant and free. Autopilot buying may push the market premium up (unverified). | `dVB`, `luA`, `UN`; `rSg` premium formula | first read (pump effect inferred) | Low priority. |
| B13 | **The currency-reform deposit haircut credits bank resolution income**, so a currency reform can recapitalise banks for free. | `E4B@11405481` ← `u2Q@93791714` | first read | Check intent; possibly route to a resolution fund. |

Not yet read (first read): investment financing split (`pgA`/`$3Q`); household credit origination; whether household
net worth feeds consumption; stock-market flow drivers (`ASg`/`BSg`/`QSg`); SWF autopilot logic.

---

## 6. Suggested mod priorities

Ordered by impact, with the size of each change. "Contained" means one function or config object.

1. **M1 reserve-backed printing is free** (bug, contained: `oJQ`/`U1Q`). Debit the reserves. Small change, clear
   correctness gain.
2. **D1/D2 rating model** (contained: config `Gp` + `c1Q`). Remove the wrong-sign growth and inflation effects and
   add a real debt slope. Highest player-visible impact; may be doable by data alone if the mod system can
   override config.
3. **F2 spending indexed to last year's GDP** (contained: `X2`/`A1Q`). Removes the "inflation balances the budget
   until January" effect.
4. **D3 auction supply curve, D4 buyback at market price, D5 tenor choice** (contained: `rjB`/`Tq`, `HsA`, `Ti`).
5. **M4/M6 central-bank control and devaluation exploits** (contained: `w6Q`, `p1Q`, `lLQ`). Cooldowns and scaled
   penalties.
6. **B1 risk weights, B2/B3 provisioning and household default** (broad). These change bank dynamics; calibrate so
   day-0 banks don't start in distress.
7. **B5/B9/M7 rate transmission** (broad): credit spreads, equity discounting, credit channel.
8. **F1 linking the public sector to the private ledger** (very broad). The root fix, but it touches everything
   downstream and needs a full re-calibration. Treat it as a separate, later project.

Also check before release: F5 (corporate tax double count) with a runtime ledger check, and which copy of the
inflation module is live (M9).

Every change to these systems alters the simulation path. Test a long run (e.g. 10 years at full speed) against an
unmodded run for runaway defaults, bank cascades or flat-lining before release.
