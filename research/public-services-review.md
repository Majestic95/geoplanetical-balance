# Geoplanetical public services: health, education, administration and technology, review for a realism mod

Status: first in-depth pass (2026-10-31), static analysis of build **26335289** (`simulation-worker.bundle.js`).
Companion to `research/economy-systems-review.md` (A, T, E, H, C), `research/financial-system-review.md` (D, F, M,
B), `research/politics-review.md` (P) and `research/war-review.md` (W). IDs: **L** health care (L1–L15) and epidemics
and behavioural health (L20–L28), **S** education (S1–S15), **G** public administration (G1–G13), **R** technology
and research (R1–R12). Free: L16–L19, L29–L39, S16–S19, G14–G19, R13–R19.

**Lens.** As in the other reviews: does the institution behave like its real-world counterpart? A fix is worth
making when it moves the game toward real behaviour, and safe when it leaves day-0 numbers alone and stays
deterministic. Pure difficulty tweaks need a real-world reason; exploits a player can farm are in scope.

**Method and confidence.** Each area was read separately with a light bundle lookup; nothing was run.
Tags:
- **read**: a first reader read the cited code. A strong lead, not yet a second-reader check.
- **read+checked**: also re-read by a second reader in this pass (the claims each section's first reader was least
  sure of, plus every High row).
- **inferred**: reasoning from read code (arithmetic on read constants included). Effect sizes in this file are
  inferred unless a row says measured; none was measured.

Offsets are UTF-16 offsets in 26335289; minified names change with every build. Stable
text anchors are given for every function a fix would touch.

---

## 1. Synthesis

### 1.1 Corrections to earlier reviews (also written in place there)
- **Administration and education do not reach output only through technology.** `economy-systems-review.md`
  section 3 said so for build 26296134. On 26335289, administration's `collectionRatio` multiplies tax collection
  efficiency (`YBA@26073648` inside `cr@93790155`), pension contributions, the welfare value of transfers and health
  access (G section); education's workforce skill shares set labour supply by skill tier and constrain sector
  employment (`anA@24244076` -> `WFB@24240562`, S section). [read]
- **A13's pace.** A13 is still true on 26335289 (no generation cap; the only bound is the 50x clamp
  `muA=Object.freeze({min:.25,max:50})`), but a new generation can start only once the newest one has diffused to 90%
  of its ceiling (`ytA@15626257`, `KpA=.9`), which takes 14–33 years per generation. The runaway is a
  centuries-scale risk concentrated in heavily stacked service goods (R1, R2). [read+checked]

### 1.2 What the four systems have in common
- **Built well underneath.** Each system is a detailed stock-and-flow model seeded from real data (WHO health
  systems, UNESCO/World Bank education, WGI governance, GERD), with diminishing returns, hiring lags, payroll charged
  to the budget (`"spending:public_payroll"`), doctrine transitions with cooldowns, and every downstream effect taken
  as a ratio to day 0, so a new game starts neutral. No determinism hazard was found in any of the four areas.
- **Stocks that never move.** Administrative capital (G3), the workforce skill stock at unchanged policy (S1),
  business R&D (R4), the absorption frontier (R10) and health-satisfaction expectations (L6) are fixed at day 0, so
  the long-run drift real countries show (digitalisation, rising attainment, procyclical R&D) is missing.
- **Levers that cost nothing.** Universal health coverage (L1), health and administration doctrines (L9, G8),
  free tertiary education (S7) and technology licences (R5) move outcomes with no budget or transition cost.
- **Channels that exist but do nothing.** Health's effect on hours worked is about 1e-5 (L2, a units slip),
  compulsory schooling is masked by the default free-education law (S3), and `capital.registry`,
  `Jcg.flexibility` and the education `accessFloor` table are computed and never read (G12, S3).
- **Exploits.** A three-month administration "fiscal pulse" raises tax collection permanently, by up to 25% in
  low-income countries (G1); with pandemics switched on, a country that never locks down gets voluntary distancing
  with no output loss (L20); free licences from any non-hostile country (R5); free capacity from health doctrines
  (L9).

### 1.3 Fix shortlist, ranked by realism gained against risk

Tier 1: data-only `{find, replace}` edits, day-0 neutral, no new saved state.

| Rank | ID | Change | Gain | Risk / test |
|---|---|---|---|---|
| 1 | G1 + G9 | Cap the fiscal delay bonus (`Math.pow(C("fiscal"),.18)` -> `Math.min(C("fiscal"),1.05)`); make the admin-cost term one-sided | Closes the largest exploit found (up to +25% revenue) | Read+checked; pulse test in a headless run before and after |
| 2 | ~~L4~~ | Not confirmed on re-read (queued patients are charged at entry); dropped | | |
| 3 | L2 | Measure the rise in untreated illness against all day-0 illness (built 2026-10-31 as `1-.06*(s-epi-s0)/N0`, epidemic hospital part left out; the ratio form `1-.035*(s/s0-1)` first proposed penalised countries with little untreated care and double-counted epidemic absence) | Restores the designed health -> labour channel | Read+checked; check it does not stack with the epidemic presence term |
| 4 | S3 | Compulsory schooling adds to the free-education term instead of being masked by it | A visible law starts working | Read+checked; capacity still binds, so effects are gradual |
| 5 | L21 | Emergent coronavirus severity to SARS-CoV-2 levels | Pandemics kill on a realistic scale | Read+checked constants; only new pathogens change |
| 6 | R2 | Lower the 50x technology clamp (2–3x, or per sector) | Removes the long-run runaway in service goods | Measure monthly research points first |
| 7 | G6, G8, S5, S6, L5 (L27 first half dropped: not a bug) | Cap social delivery at 1.05; longer civil-service transitions; class size into learning; learning into skills; health in every group's satisfaction | Each a small realism gain | Each day-0 neutral; short headless check of approval |

Tier 2: small code patches, day-0 neutral.
- **L20** prudence also lowers sector demand (closes the no-lockdown free ride); **L1** coverage raises the funded
  health envelope (universal coverage gets its real cost); **S4** deflate school "means" by prices and pupils (stops
  inflation raising school quality); **S2** students leave the labour force (H11); **G2** triage drain for the
  fiscal backlog (measure the drift first); **G4** lagged, symmetric cabinet-corruption effect; **L22** AI locks down
  before hospitals saturate; **L23** approval blames own deaths, restrictions cost by fatigue; **R5** licences cost a
  royalty and need the source's relation.

Tier 3: larger patches or feature work.
- **G3** administrative capital that moves (digital government, reform, erosion); **S1** cohort turnover in the
  skill stock; **L3** mortality response scaled by the amenable share; **R3** frontier research scaling with
  absolute R&D; **R7** generation frontier and catch-up; **S7** fees and private schooling; **L24** mental health
  beyond substance use; **L8** health-workforce pipeline.

Shift day-0 numbers, so they wait for a calibration pass: **L7** (health spending bucketed at 1.6/3/6% of GDP),
**G5** (collection efficiency from income tier only), **L26** (same epidemic imports everywhere), **S14** (modelled
learning indices), **G13**.

### 1.4 Measure before building
- G1 pulse and G2 drift: log `administration.queues.fiscal.{backlog,delayMonths}` and `outcomes.collectionRatio`
  for a growing (Nigeria), a shrinking (Japan) and a lower-middle country, with and without a priority pulse.
- R2 and R3: `technology.capacity.monthlyPoints` and slot counts per country at day 0 and month 12.
- L2: `health.laborHoursIndex` with health care cut hard.
- L20: GDP cost of a tier-3 month (sector shares were not read).
- Save/reload: whether the tourism flow matrix (`_tourFlow`, `_tourCs`) exists before the first daily epidemic step
  after a load. `OPA` (rebuilds `_tourCs`) is called from `zOQ@96886226`; if the flow is missing for a day, that day
  has no cross-border mixing and a reloaded run would differ (section 3, Not yet read). Endemic flu and measles mix
  through tourism too, so this matters with pandemics off. Not settled in this pass.

---


## 2. Health care (L1–L15)
### How it works
- **Cadence.** Monthly: `EJQ@96455772` (tickHealthWorldPhases) loops over countries and runs `iJ` (lazy init), `y6Q(B,1)` -> one `hGg` step, `uJ` (social projection), nutrition `v5`/`krC`, and player alerts `"health.alert_started"`/`"health.alert_resolved"`. [read]
- **State `B.health`** (`iJ@94041032`): `seed` (WHO-style data from `health-systems.json` via `qGg@94035185`: quality, uhc, oop, publicFinancingShare, density, bedsPer1000, maternal deaths, vaccination, physicians/nurses, plus day-0 anchors deliveredSpendGDP, agePressure0, workers0, avoidableDeaths0, sickDays0); `policy` (4 doctrines access/delivery/priority/prevention from `health-doctrines.json`, `fGg@94036115`); `lines` (primary/hospital/emergency/maternal queues, `pGg@94040244`); physical/functional beds; prevention coverage; fatigue; workers; unmet care rate; mortality/infant/maternal risk indices; sick days; laborHoursIndex; persistentMonths; alerts; nutrition. Not loaded from a checkpoint: built on first use from data if `A.health` is missing. [read]
- **Day-0 is an equilibrium.** `pGg` sets `capacity0 = treated0`, `pending0 = treated0 * wait0`, so the first `hGg` step gives the same numbers again. Renouncement rate0 comes from data (`mGg@94039836`: e.g. primary `.025+oop*.43+(1-uhc)*.1`), wait0 from `LGg@94040035`, avoidable deaths from `JGg@94040953`: `28+(1-uhc)*420+MMR*.08` per 100k per year, clamped [18,720]. [read]
- **Need** (`pd@11541902`), per 100k per month: primary `285*(.72+.28*age)`, hospital `7.8*(.48+.52*age)`, emergency `13.5*(.78+.22*age)*(1+.42*war)`, maternal `births*1.35`. Age pressure `Ld` uses weights by age band (`lnB` near @11542300: <5 1.35, 5–17 .58, 18–44 .85, 45–64 1.25, 65–79 2.25, 80+ 3.6). Absolute add-ons: injuries `DO(A,"injuriesM")`, the epidemic hospital need, behavioural and drug needs `G6Q`, transplant `n9B`, gambling `QdB`. [read]
- **Capacity** (`L6Q@94038663`): `common` is a weighted harmonic mean (`m6Q@94038575`, each input floored at .08) of staff (workers per resident vs day 0, divided by age pressure, clamp [.15,2.2], weight .34), public headcount `jr` (.14), operating `FGg@94037873` = `nonPayrollBn/nonPayroll0Bn` clamp [.12,2.2] (.18), qualifications `YGg` (education skill shares, .14), supplies `sqrt(pharma*devices fill)` (.2). That is multiplied by presence `1-fatigue*.18` x epidemic clinical presence. Per line, `KGg@94043226` = common x facilities^.45 x delivery/priority doctrine x beds^(.38 for hospital, .18 for emergency), clamp [.08,2.3]. [read]
- **Money.** The budget envelope is `nIA@16105714` = sum of `vb(spend.sante|prev)` x delivery. `vb@11543301` scales the % of GDP by `xG(A,"sante")` = care need per worker vs day 0 (`ub` @11542407, `gYA` "care"), so health spending in Bn rises with ageing on its own. Non-payroll moves with the envelope at once (`JlB@16110391`: `nonPayrollBn=nonPayroll0Bn*envelope/envelope0`). Payroll is `headcount*wage`, and any payroll above the budget-scaled payroll (`mb@11924895`) is charged as `"spending:public_payroll"` in the primary budget (`sIA@16115613`, `j9A@93799593`). So the money is paid through the budget, not only computed as a share-of-GDP formula. [read]
- **Staff.** Public health headcount only moves toward a target set by the player or the AI (`NlB@16117999`, `setPublicHeadcountTarget`). Hiring speed per year is `TlB@16116000`: `(.9-.65*highSkillShare)` (.575 for health) x wage attractiveness^1.5 [.25,1.5] x unemployment [.45,1.25] x administration [.55,1.15] x skills [.55,1.35]; cuts happen at .7/yr; each month `1-exp(-P/12)` of the gap closes. Private staff = private workers0 x the ratio of CGE `firms.health.emp` [.25,2.5] (`vAB@94038284`). The AI only ever raises staff, by 3/5/8% at most once a year, when fatigue ≥ .08 and pressure ≥ 1.18 (`qDC` near @96503200, constants @96500893). [read]
- **Queues** (`hGg@94044661`): renouncement `M = renouncementRate0 * accessDoctrine / adminDelivery * F2A(coverage law)`. Queued patients abandon via `m=f*(1-exp(-(wait-wait0)/wait0))`. Treated `K=min(queue, capacity)`. Complication rate rises with wait (`*(1+max(0,p-wait0)*.22)`). Complications `V=(h+y*.12)*b` with `h=q+L+max(0,H-K-L-x)`. Fatigue rises at .11 and falls at .045 per month. [read]
- **Coverage law** `health_coverage_entitlement` (catalogue @12606832; options none…universal, score map 0/20/45/72/100, `material` group preferences). Its only effect on the health model is `F2A@14707911`: `coverage(laws0)/coverage(laws)` with `{none:.08,emergency_only:.22,targeted:.42,contributory:.68,universal:.92}`, clamped [.35,2.2], multiplying renouncement (`Bg@14704389` = current law, `Re@14704477` = day-0 law). The AI uses it in law scoring at @95605530 (`35+g*45+unmetCareRate*80`). [read]
- **Doctrines** (`GGg@94036537`, `K6Q@94049670`): every value is divided by the country's own baseline doctrine. Transition takes access 36 months, delivery 18, priority 3, prevention 12 (`Sx`); cooldown is 2920/1825/180/730 days (`kGg`); there is no money cost. [read]
- **Outputs.**
  - Mortality: `mortalityRiskIndex = complications/complications0 x (1+behavioural deltas+transplant)` clamp [.55,2.8]. Demography (`iTA@25480133`) applies `q=clamp(1+(M-1)*.22,.86,1.4)` to all age bands' hazards. Infant: `imr0*(gdp0/gdp)^.7*infantRisk^.42` (via `I0B@96450799`). [read]
  - Labour: `laborHoursIndex = clamp(1-(sickDays-sickDays0)/(260*1e5)-…, .94, 1.015)` -> `we.healthLaborFactor` (`p6Q@94039449`, x epidemic presence, clamp `Qk` = [.5,1.03], section 3). [read]
  - Satisfaction: `uJ@94063297` puts need, renouncement, treatment and waiting into each group and computes `satisfactionDelta=clamp((experience0-experience)*42,-14,14)` (`VGg@94063124` weights .48/.18/.26/.08). It is read in `LAB@94071311` as `sat.health x delta`. Only `soig` (.4, @15260722) and `retr` (.5, @15263375) have a `health` weight. Health workers also get `publicJob x clamp(-fatigue*12,-12,2)` (`X6Q`). [read]
  - Politics: the `public_services` issue = mean of `1-unmetCareRate`, education access and admin delivery, vs baseline (`_Z@15899544`, `Pgg`). Exit/migration publicDelivery `S5B@15878594`. Stability `"hospital_saturation"` is `-4` only when `Q.epidemic?.saturated` (@94081206). [read]
  - Others: transplant surgical capacity reads `hospital.treatedRate` and `healthWorkerAttendance` (`$pA` near @15649865). Public facilities read `physicalBedsPer100k` (`H3B` near @15251885). [read]
- **Epidemic bridge** `xMQ@95321552`: excess severe patient-days divided by (beds x 100 x .75 occupancy x days) x hospital need0, so epidemic load is scaled against the model's own baseline. [read]

### What looks wrong
| ID | What looks wrong (real-world behaviour it departs from) | Code | Conf. | Suggested fix |
|---|---|---|---|---|
| L1 | **Coverage expansion is fiscally free (High).** `health_coverage_entitlement` only scales renouncement (`F2A`: contributory->universal = x.74; none->universal hits the .35 clamp). The access doctrine "universal" (.58 vs regulatedMixed .92) stacks on top, and `K6Q` charges nothing. Public health spending in Bn and the OOP share (`seed.oop`, read only at init in `mGg`) never respond. In reality, extending entitlement is the largest health-budget decision: Thailand's UCS and US Medicaid expansion raised public spending, and the public financing share rises while OOP falls. In the game the only "price" is longer queues. | `F2A@14707911`, `hGg@94044661` (renouncement `M=`), `K6Q@94049670`, `GGg@94036537`, `mGg@94039836` | read | Make coverage raise the funded envelope: in `gYA` `case"care":return dnB(J6A(A),A?.health?.seed?.careNeedPerWorker0)`, multiply by `(coverage/coverage0)^0.5` (the `s$Q` table vs `laws0`). The same % of GDP then costs more Bn, paid through the budget like ageing. Ratio is 1 at day 0, so no day-0 shift. Code patch, small. That `vb` feeds the appropriation is inferred (see Not yet read). |
| L2 | **The health -> labour supply channel is numerically dead (High).** `laborHoursIndex=1-(s-s0)/(260*1e5)`, where `s` is a weighted sum of monthly cases per 100k (primary need ≈285, hospital ≈7.8, weights 5/3/2.5/1.4). Even all need unmet moves the index by about 1e-4, far from the [.94,1.015] clamp. In the OECD, sickness absence is about 3–5% of working time, and untreated illness and long waits raise it measurably. | `hGg@94044661` (`B.laborHoursIndex=qC(1-(s-B.seed.sickDays0Per100kYear)/(260*1e5)`), `p6Q@94039449` | read+checked (constants); magnitude inferred | Built 2026-10-31 (not the ratio form first proposed here): `1-.06*(s - epidemic hospital part - s0)/N0`, N0 the day-0 need of the four lines with the same weights, clamp kept; a collapse costs about 6%, +10 points of untreated illness about 0.6%. Day-0 value stays 1. Data-only {find,replace} on the `/(260*1e5)` expression. |
| L3 | **The mortality effect ignores how much mortality is amenable (Medium-High).** Demography multiplies all-cause hazards by `1+(M-1)*.22` with the same elasticity everywhere. The model's own `avoidableDeaths0` ranges from 28 (uhc=1) to 448/100k/yr. For M=2, the displayed avoidable deaths rise by about +28/100k in a high-coverage country, but the applied rise is ~22% of all deaths (about +150–200/100k at typical crude death rates); a low-coverage country gets about +450 displayed vs a similar applied rise. Real treatable mortality is ~3–5% of deaths in high-income countries and much more in low-UHC ones (Kruk 2018). | `iTA@25480133` (`q=Xo(1+(M-1)*.22,.86,1.4)`), `hGg` (`avoidableDeathsPer100kYear=…*mortalityRiskIndex`), `JGg@94040953` | read (code); size inferred | Replace the .22 with the country's amenable share: `avoidable0/crudeDeathRate0` (or add `avoidable0*(M-1)/1e5` as an extra hazard spread by age). M=1 at day 0, so no day-0 shift. Code patch in demography (coordinate with the demography reviewer). |
| L4 | **[Not confirmed 2026-10-31, re-read before building: a patient who presents and is not treated is already charged the full complication rate that month (`h` includes `max(0,H-K-L-x)`, the untreated new presenters, and `V=(h+y*.12)*b`), and queued patients add `.12` a month after that. So abandoning the queue later is not free, and adding `m` to `h` would count the same patients twice (unmetRate, alerts and satisfaction too). No fix. (read+checked)]** **Patients who give up after long waits have no complications (Medium).** Queue abandonment `m=f*(1-exp(-(wait-wait0)/wait0))` is excluded from `h=q+L+max(0,H-K-L-x)`. Queued patients count only `y*.12`. So moving people from "renounced" to a long waiting list (the coverage law or access doctrine with fixed capacity) cuts complications and mortality without any treatment. In reality, waiting-list drop-outs and long waits raise adverse outcomes (NHS RTT harm reviews). | `hGg@94044661` | read+checked | Find `let h=q+L+Math.max(0,H-K-L-x)`, replace with `let h=q+L+m+Math.max(0,H-K-L-x)`. At day 0 wait=wait0, so m=0: no day-0 shift. Data-only {find,replace}. |
| L5 | **Only retirees and health workers care about health care (Medium).** `sat.health` exists only for `soig` (.4) and `retr` (.5). `marg`/`agri`/`ouvr`, who have the worst access (`RGg`/`XGg` need and distance factors, income gradient), get no satisfaction term. In polls, health care is a top-three concern across classes (Ipsos "What worries the world"). | `LAB@94071311` (`J=(q.health||0)*R6Q(A,M.id)`), groups @15260722, @15263375 | read+checked | Add `health:.25` to the other groups' `sat` objects (anchor on the `{id:"marg",incBase:.35` … `sat:{housing:.4}` text and each group's `sat:{}`). The delta is 0 at day 0, so no day-0 shift. Data-only edits (watch anchor uniqueness: there are many `sat:{}`). |
| L6 | **Health satisfaction never adapts to a new normal (Low-Medium).** `experience0` is frozen at the first projection (`G.experience0=Su(g[H.id]?.experience0,G.experience)`), so a reform 20 years ago is still a permanent ±14. Every other reference in `LAB` (`satRef`) adapts at .03 per month. Expectations adapt in reality: satisfaction tracks recent change and level. | `uJ@94063297` | read | `G.experience0+=(G.experience-G.experience0)*.02` after the read (deterministic, once per revision). No day-0 shift. Small code patch. |
| L7 | **Day-0 public health spending is bucketed, not data (Medium).** `spend.sante` comes from `econ.json` `healthSpend` (`VHg@93802967`). Of 237 `healthSpend:` matches in the bundle, 225 are exactly 1.6, 3 or 6 (the count may include duplicate copies of the table). Meanwhile `health-systems.json` carries WHO `currentHealthSpendGDP`, which `iJ` does not keep. Because effects are relative to the envelope, +1 pp of GDP buys +62% operating money in a 1.6 country and +17% in a 6 country, set by the bucket and not the real system. Real public health spending spans about 0.5 to 10% of GDP. | `VHg@93802967`, `ISQ@10962943`, data `oGA@9182751`, `qGg@94035185` | read | Data: fill `healthSpend` from WHO GGHE-D (≈ `currentHealthSpendGDP*govtFinancingShare`). This **shifts day-0 fiscal balances** and needs re-calibration; defer to a data pass. |
| L8 | **No health-workforce pipeline (Medium).** Public health hiring draws from the general labour pool at 0.3–2.5 per year (`TlB`), so a pay rise plus high unemployment closes most of a doubling of staff within 1–2 years. Real physician supply needs 6–10 years of training (nurses 3–4); short-run supply is inelastic and comes from the private sector or abroad. | `TlB@16116000`, `JlB@16110391`, `JyA@16117035` | read (rates); feasibility of doubling inferred | For `B.id==="health"`, cap net growth of public health headcount (e.g. ≤6%/yr plus the private health headcount you can poach), or scale `P` by a health-graduate stock. No day-0 shift. Code patch in a shared function (role-gated). |
| L9 | **Free doctrines that always win (Medium).** Weighted by line shares (.42/.3/.18/.1), "integrated" delivery gives ≈1.09x capacity vs a balanced baseline, about +13% coming from hospitalCentred, and "primaryMaternal" priority ≈1.04x. Access "universal" lowers renouncement more than any other option on both lines. Nothing costs money; the only limits are a transition lag and cooldown. Real integrated-care reforms show small, uncertain efficiency gains and transition costs. | `GGg@94036537`, `KGg@94043226`, `K6Q@94049670` | read (constants); weighted sums inferred | Rebalance so each option's weighted mean ≈1 (trade-offs, not a free gain), or add a temporary capacity dip during `transitionMonthsLeft` (e.g. x.97). No day-0 shift. Data-only edits of the `GGg` constant objects. |
| L10 | **Long-run life expectancy ignores the health system (Low-Medium).** `mortalityLevel += ((E-level)*.05+.12)*dt` with `E=e00+1.3*ln(gdp/gdp0)`. The drift settles 2.4 years above the GDP target whatever happens to health care; health only moves the short-run hazard x[.90,1.40]. Real LE gains are partly due to health systems and public health (shifts of the Preston curve). | `iTA@25480133` | read | Scale the `.12` drift by health-system state (e.g. `.12*clamp(2-mortalityRiskIndex,.5,1.2)`). No day-0 shift. Demography code patch (shared area). |
| L11 | **A health-system collapse alone gives no stability penalty (Low).** `"hospital_saturation"` is a binary -4, only during an epidemic. Budget-driven collapse (emergency pressure, accessCrisis) reaches stability only through the `public_services` issue and retiree satisfaction. Medicine shortages and hospital collapse fed unrest in Sri Lanka 2022 and Lebanon. | stability @94081206, `_Z@15899544` | read | After L5, consider a graded term from `lines.emergency.pressure` vs pressure0. Check for double counting with L5. No day-0 shift. |
| L12 | **The financial-barrier gradient uses day-0 income (Low).** `WGg` uses `income: inc0` first, so a recession or income loss never raises renouncement among the poor. Unmet need for cost reasons rose sharply in Greece after 2010 (EU-SILC). | `WGg@94062796`, `uJ@94063297` | read | Use `inc/inc0` relative to the group's day-0 level: `Su(g.inc,1)/Su(g.inc0,1)*…`. No day-0 shift. Small code patch. |
| L13 | **No out-of-pocket cash flow (Low).** OOP share only seeds day-0 renouncement. Households never pay for care, so there is no catastrophic health expenditure, and coverage changes do not move household budgets. | `mGg@94039836`, `qGg@94035185` | inferred (searched `seed.oop`, `.oop*`, `outOfPocket*`, `publicFinancingShare` reads: none outside init) | Large; defer. If L1 lands, at least drop renouncement in line with OOP. |
| L14 | **Unsafe-abortion deaths ignore the health system (Low).** `maternalDeathsM=unsafeM*.0018` is uniform. WHO case fatality is about 30/100k in developed regions and 220–520/100k in sub-Saharan Africa. | `pFg@94107848`, `HLA@14708099` | read | Scale by `health.maternalRiskIndex` or seed MMR. Shifts day-0 deaths slightly. Small code patch. |
| L15 | **The coverage law acts at once (Low).** `F2A` reads the current law every month: a switch changes renouncement the next month, while the equivalent access doctrine takes 36 months. Real coverage expansions phase in over years (enrolment, provider contracting). | `F2A@14707911`, `Sx` @94035037 | read (no lag in F2A); law-passage delay not read | Smooth F2A through a stored lagged ratio in `B.health` (e.g. 1/24 per month). Needs a new persisted field, so save-compatibility review. |

### Fix candidates
- **L4**: realism +, risk very low (m=0 at day 0, deterministic, no new state). One data-only {find,replace} in `hGg`. Do first.
- **L2**: realism + (restores a designed but dead channel); risk low (day 0 =1, existing clamp keeps it bounded; check it does not stack with the epidemic `healthLaborFactor`). Data-only {find,replace}.
- **L5**: realism + (the poor react to access); risk low (0 at day 0). Data-only edits on group `sat` objects; check anchor uniqueness.
- **L1**: realism ++ (coverage gets its real cost); risk medium (raises spending in Bn for countries that expand coverage; check the deficit path in a headless run). Small code patch in `gYA` "care".
- **L3**: realism ++; risk medium (changes mortality response size for every country, though not at day 0). Code patch in demography `iTA`; coordinate with the population model (economy review section 6).
- **L8**: realism +; risk low-medium (shared `TlB`, gate on role). Code patch.
- **L9**: realism +, closes a farmable free gain; risk low (day 0 unchanged because values are divided by baseline). Data-only edits of `GGg` constants.
- **L6, L12**: small realism gains; low risk; small code patches.
- **L7**: realism + but shifts day-0 fiscal numbers, so it needs re-calibration; data pass later.
- **L10, L11, L13, L14, L15**: lower priority or larger; defer.

**Determinism:** The read functions (`EJQ`, `iJ`, `hGg`, `L6Q`, `GGg`, `KGg`, `uJ`, `K6Q`, `F2A`, `TlB`, `JlB`, `xMQ`) contain no `Math.random`, `Date.now` or UI state. Iteration is over frozen arrays (`pn`, `xx`) or object keys built in a fixed order. Group sorting in `uJ` breaks ties by id (`Y(H.id,k.id)`). Time comes from `A.day`. The `uJ` cache is keyed on `B.revision`; the save loader (@96723062) recomputes it inside `try{}catch{}` and then throws if it still mismatches, which is deterministic. No hazards found in this area. [read]

**Looks right:** The weighted harmonic mean capacity gives diminishing returns and bottlenecks: operating x2.2 gives ≈+11%, x.12 gives ≈-57%. Queues have wait-driven abandonment and wait-dependent complication rates. Payroll and non-payroll are paid through the budget (`"spending:public_payroll"`). Hiring has a lag, and the AI never fires health staff. Doctrine transitions have lags and cooldowns. Prevention works slowly (burden index adjusts .018 per month, about 55 months). The epidemic hospital load is scaled against the model's own beds and occupancy (.75). Spending in Bn auto-scales with care need from ageing. Hospitals cost money, take 30 months to build and carry maintenance (`Sa` @15250856, `IHg@93694379`). Health ownership efficiency is 0 (`CWQ` @11821480), which is defensible (public and private hospital efficiency differences are small in the literature). Satisfaction and mortality are calibrated to 0 / 1 at day 0.

### Not yet read
- `vb`/`xG` as an input to the fiscal appropriation. **Scope:** read `vb`, `xG`, `nIA`, `mb`, `sIA` and the `"spending:public_payroll"` entry in `j9A`. Did not trace the `sante` program line through `Gn@93809281` to confirm the Bn spent is `vb x GDP`. L1's fix relies on this.
- Facilities chain `_yB@25387905` -> `VyB`/`wTA`/`CTA` (deliveredCoverage) and the facility price factor `aHg`. **Scope:** read the `Sa` hospital/clinic entries and the maintenance formula `IHg` only.
- Private health market: household demand and price for the CGE `health` good, and whether coverage or OOP touches it. **Scope:** read only `vAB` (private staff from `firms.health.emp`) and `ct`/`b5A` (pharma/device fill).
- War casualties as hospital/emergency need. **Scope:** found only domestic `injuriesM` (`DO@15935801`) and the famine-at-war hook in `EJQ`; did not search war-damage modules.
- `lAB` alert thresholds in full, `J5A`, `z5A`/`T6Q` validation and repair on load, `R7` bottleneck diagnosis, and the full AI doctrine chooser `dDC`. **Scope:** read fragments of `lAB` (alert conditions) and of the AI chooser near @96502900.
- `Qk` (the `healthLaborFactor` clamp) and the consumer of `gYA` "sickness" (`sicknessClaimsIndex`). **Scope:** not read.
- `Q.epidemic.saturated` source (section 3). **Scope:** only the stability line @94081206.
- Why untreated care roughly doubles within six months in some countries with no health shock (unmodified game, seed 12345: Germany `sickDaysPer100kYear` 79.5 -> 153.4, also Malawi, Bermuda, Isle of Man, Central African Republic; measured 2026-10-31 by `mods/geoplanetical-balance/tests/l2.headless.mjs`). With L2 this now costs those countries 0.5-0.7% of working hours. **Scope:** measured the index in every country at months 1 and 6; did not trace the cause (seasonal need, staffing, fatigue or supplies).
- Whether law changes have a passage or implementation delay before `A.laws` changes (affects L15). **Scope:** not read.

---

## 3. Epidemics and behavioural health (L20–L28)


### How it works

**Cadence and state**
- The daily step is `NMQ@95311714`, called under the label `"tickEpidemiologyDaily"` after `"tickAiDisasterResponses"`, `"tickDailyEnergyService"` and `"settleDailyBuildingEnergy"`, then `yield"epidemiology"` (@96609598) [read]. The monthly seal is `xMQ@95321552`, called under `"sealEpidemiologyMonth"` just before `GA.MONTHLY_PRETRADE` (@96582901) [read].
- All parameters live in one config object `Z1` (aliased `te`), whose stable anchor is `_doc:"Catalogue \xE9pid\xE9miologique V1 (docs/plan-epidemiologie-v1.md)` (@~87493000). It defines four endemic diseases (`influenza`, `covid`, `measles`, `rsv`), three age bands (child 0-19, adult 20-64, senior 65+) and a POLYMOD contact matrix `contacts.perDay` [read]. Emergent-pathogen config is `F1=Z1.emergence` (anchor `annualProbability:.04,seedPersons:20`, @87498201) [read].
- Per country, per disease and per band there are six compartment fractions in `x` [read]. My reading of the names, from the transition code in `WRA@87529634`, is [inferred]: `an` exposed, `G2` infectious, `io` severe, `F7` recovered, `dH` vaccinated but not yet protected, `au` vaccine-protected. Susceptible is the remainder: 1 − all compartments − pending dead − anyone acutely ill with any disease (`zRA`) [read].

**Model: discrete-time, age-structured SEIR with waning (SEIRS + V)**
- The model has a daily force of infection (`VRA@87531853`) [read]:
  - λ[d,band] = β_d · (1 + seasonAmplitude_d · season) · Σ_j (contacts[band,j] · effect[band,j]) · (I_j + severeContagion · Severe_j)
  - `season = egA(lat, day)` (@87527863) [read].
  - Infection probability is 1 − e^(−λ) (`WRA`) [read].
- Transition probabilities are `SN(d)=1−exp(−1/d)` for latent, infectious, severe, immunity, vaccine-protection and protection-lag (14 days) durations (`m7g@87525997`) [read]. Immunity wanes back to S at rate `pR` when `immunityDays` is set; measles, henipavirus and filovirus have `immunityDays:null`, so immunity is lifelong [read].
- Infection fatality ratio = `severeShare[band] × fatality[band] × a`, with `a = t + (1−t)·untreatedFatalityMultiplier(2.5)` and `t = clamp(freeBedsPer100k / severePer100k, 0, 1)` (`h7g@87529301`, `L7g@87526287`) [read]. Child fatality is also multiplied by a nutrition factor `foodChild` [read].
- Free beds = `health.functionalBedsPer100k × (1 − ordinaryBedOccupancy .75)` (`_t@87550809`, `Q9g@87550731`). Beds therefore follow the health system's staff and devices [read].
- Small outbreaks (under 100 acute persons, `smallOutbreakAcutePersons`) switch to Poisson draws (`RN@87529417`, `RRA@87528818`). Under one acute person in a band, the remainder is moved to R, so fade-out and extinction exist [read].

**Endemic diseases: constants [read]**
- `influenza`: r0 1.12, imports 3/yr, immunity 300 d, seasonal senior vaccine.
- `covid`: r0 1.15, immunity 240 d.
- `rsv`: r0 1.08.
- `measles`: r0 12, lifelong immunity, birth vaccination at the DTP3 coverage of `health.seed.vaccination` × prevention ratio (`WMQ@95323541`, `GH@87551244`).
- These r0 values are effective reproduction numbers in a population with waning immunity [inferred].

**Day-0 calibration**
- `C3A@87551924` → `KVB@87535039` runs a deterministic 3-year warm-up (`TRA=1`, `NRA=2`, @87534075). It uses expected imports with no RNG, snapshots the state at the start day, and averages 2 years into `anchors.deathRatePerYear`, `severePer100k`, `adultAcute` and habitual weekly incidence [read].
- Every downstream effect is taken relative to these anchors [read].

**Seeding and emergence**
- The endemic diseases are imported at `externalImportsPerYear` (flu 3, measles 2, covid and rsv 0, emergent 0). The draw is Poisson per country per day into the adult band (`NMQ`, `WRA`) [read].
- New pathogens come only from the campaign rule `newPandemicEmergence`. Its default is `"off"`; the values off/rare/normal/frequent map to 0/.5/1/2 (`mv@25787080`, `png`, `PT@25787638`) [read].
- When the rule is on, `mMQ@95300373` makes one draw on day 1 of each month with p = 1 − exp(−(−ln(1−.04)·mult)/12). `P1B@95299671` then:
  - draws the family by weight: coronavirus .35, influenza .35, henipavirus .15, filovirus .15;
  - draws traits uniformly within the family bounds;
  - picks the origin country weighted by population;
  - seeds 20 adults (`seedPersons`) [read].

**Spread between countries: tourism only [read]**
- `fSg@95314167`, `GSg@95316291` and `FSg@95316846` mix only the adult band through the tourism visitor matrix.
- Visitors carry their home prevalence into the destination's mixing, and residents abroad take the destination's λ. Residents away are capped at 50% of adults.
- The visitor stock = annual flow × stay days/365 × entry-regime factor (`olg@88218553`). This is a stock, which is correct [read].
- No other cross-border channel exists: no trade, business travel or migration [read: these are the only cross-country terms in `NMQ`].

**Surveillance, reporting and bands**
- Declared cases = onset × reporting share, with a delay. Deaths are reported at `deathReportingFloor(.5) + .5 × surveillance0` (`LSg@95318338`) [read].
- Band rules (`ySg@95320090`, `bandRules`) [read]:
  - 1 = outbreak;
  - 2 = estimated incidence ≥ the epidemic threshold, or excess severe > 50% of free beds;
  - 3 = excess severe > 90% of free beds;
  - a band falls only after 21 days below it.
- `saturated` turns on at bedRatio > .9 and off below .6 [read].
- Pandemic declaration, naming and extinction (`LMQ@95300918`) [read]: a pandemic is declared when 10 countries are above the alert threshold for 14 days, and ends after 60 quiet days.

**Player and AI levers [read]**
- NPI tiers 0-3 (`measures.tiers`): `bandContact` [1,1,1] / [.9,.9,.9] / [.9,.75,.85] / [.4,.45,.5].
- The effective contact multiplier per band is `1 − adherence·(1−bandContact)`, and the matrix uses sqrt(C_i·C_j) (`ZRA@87532465`).
- Adherence = clamp(.55 + .35·approval/100 − fatigue, .2, .95) (`ap@87537405`). Fatigue rises .01/week at tier ≥ 2 and falls .01/week otherwise, capped at .5 (`LSg`).
- Spontaneous prudence (only for deaths from emergent pathogens) multiplies all contacts by `1/(1 + D/8)`, where D = declared deaths per 100k over 14 days (`hVB@87537609`, `deathsPer100k14dHalf:8`).
- Tier 2 and 3 also set sector availability:
  - tier 3: hospitality .35, leisure .3, services .5, trade .8, education .5;
  - this is averaged over the month in `LSg`, sealed in `xMQ`, and written to `we.publicHealthSectorAvailability` (`SMQ@95322295`);
  - it multiplies sector supply capacity in `pAA@25201039` (`L=...publicHealthSectorAvailability`).
- Admin costs are .01/.05/.15 % of GDP per year by tier, plus .03 for surveillance and the vaccine doses (`_uA@87538138`).
- Campaigns: workforce 1/3/6 % × 15 doses/worker/day (`YSg@95317430`). Campaign workforce is subtracted from clinical presence (`ZuA@87537911`).
- Emergent vaccines need a research race; others can buy them 180 days after the first discovery (`cp@87572711`).
- Border rule: `controls` → tourism regime `selective` (.48), `suspended` → `closed` (.03), applied to "at risk" countries judged from published numbers (`KMQ@95307027`, `yPA@88192808`).
- AI decisions run through the capability `epidemicResponse` (anchor `"no_health_competence"`, @96567542) → `ClQ@95328400`:
  - the tier comes from `f1B@95328146`: band 2 → tier 1; band 3 → tier 2; tier 3 only after 14 days at band 3 with tier ≥ 2 (`H1B@95327913`, `KSg=14`), with a regime class or approval ≥ 30 (`TSg@95328056`), and a gain of at least 10 contact points from tier 3 over tier 2 (`bSg=10`);
  - border level: controls if any partner is at risk, suspended if any partner is in band 3 for an identified emergent pathogen (`elQ@95330406`);
  - it also launches vaccine campaigns and sets the research share for the race [read].

**Outputs**
- Labour [read]:
  - `presence = clamp((1 − adultAcute_month)/(1 − anchor.adultAcute), .5, 1.05)` (`xMQ`) → `health.epidemicPresence` (clamp .3-1.1, `J6Q@94039563`);
  - `healthLaborFactor = clamp(clamp(laborHoursIndex,.94,1.015) × epidemicPresence, .5, 1.03)` (`p6Q@94039449`, `Qk@12588278`);
  - this multiplies all sector supply (`pAA`, `q=...healthLaborFactor`).
  - adultAcute counts only adult I + severe (`WRA`) [read].
- Hospitals: `epidemicHospitalNeedPer100k = need0Per100k(hospital) × (Σ_days severePer100k − anchor·days) / (bedsPer1000·100·.75·days)` (`xMQ`). It is added to the hospital line's need (`hGg`, @94045963) [read].
- Mortality [read]:
  - SEIR deaths → `pendingDeathsM` (`LSg`);
  - spread over cohorts by the life-table weight `VAA`, capped at .9 (`XMQ@95323044`) → `infectiousDeathShareByCohort`;
  - in demography `iTA@25480133`, the base rate is `max(0, nTA·v − infectiousAnchorRate)` (`RMQ@95322723`), plus the actual infectious share;
  - so only excess over the calm-year anchor changes deaths. There is no day-0 double count.
- Approval (`X5A@94078156`) [read]:
  - `epidemic_deaths` = `band>=2 ? −clamp(1.5 × (deathsPer100k30d − world pop-weighted mean), 0, 12) : 0` (`vXA@87576607`, `a0Q@94077475`);
  - `epidemic_restrictions` = −restrictionDrag: tier 2 → 1 + 10·f(fatigue), tier 3 → 3 + 10·f(fatigue), with f capped at .5 (`vXA`).
- Stability: `hospital_saturation` = −4 when `saturated` (`bwA@94080184`) [read].
- Civil liberties: tier 3 → .5 + fatigue, tier 2 → .15 + fatigue/2 (`AXA@87537738`). This is subtracted ×.6 from the perceived `civil_liberties` (`XJA@15898846`, `ai@15898928`), which feeds the liberties grievance of domestic movements [read].

**Behavioural health (`U6Q@94030590`, monthly, label `"tickBehavioralHealth"`)**
- It models **substance harmful use and dependency only**, per pop group [read].
- Inputs [read]:
  - `withdrawal01` from `iY@15848856`, built from socialMind deltas (`trustGovDelta`, `hopeDelta`, `injusticeDelta`), so it is 0 at day 0;
  - availability `w = clamp(.58 + .08·drug-market harmfulUseDelta − .1·acc tax, .32, .82)` (`lGg@94029735`);
  - care capacity `r = .45·clamp(prevSpend/prev0,.25,2)/2 + .3·preventionCoverage + .25·(1−unmetCareRate)` (`dGg@94029847`);
  - group weights `MGg` (marginal 1.34, soldiers 1.12, workers 1.1, ...).
- Formulas [read]:
  - `target_use = clamp(withdrawal·w·E − .16·r, 0, 1)`, smoothed with half-lives of 5 months up and 14 down (`H6Q@94029653`);
  - `target_dep = clamp(use·(.46+.3w) − .1r, 0, 1)`, half-lives 12 and 30.
- Outputs (`f6Q@94030095`) [read]:
  - primary care need +145·use + 210·dep per 100k/month, and emergency +18·use + 42·dep;
  - these reach the health lines through `G6Q@94031402`;
  - `mortalityRiskDelta = clamp(.12·dep, 0, .12)` → `health.mortalityRiskIndex` (@94047560) → demography through `q = 1 + (M−1)·.22`;
  - `laborHoursDelta = clamp(.004·use + .009·dep, 0, .013)`, subtracted from `laborHoursIndex` (@94048259) → `healthLaborFactor`.
- Drug-market deltas (`tbB@25527369`) pass straight through to care need and mortality [read].
- The socialMind inputs (`SQg@15880039`) are growth, unemployment, stability, inequality, public delivery, coercion (protest deaths, arrests, deployments, `R5B@15878966`) and real income per group [read].
- No epidemic, lockdown, bereavement or isolation term exists [read].

### What looks wrong
| ID | What looks wrong (real-world behaviour it departs from) | Code | Conf. | Suggested fix |
|---|---|---|---|---|
| L20 | **Voluntary distancing is free: an epidemic without a decree costs the economy almost nothing (High when emergence is on).**<br>Mechanism: prudence `d = 1/(1+D/8)` multiplies only the contact matrix (`if(d<1)for(...)s.effect[M]*=d`). Sector availability comes only from the decreed tier (`OVB` → `G0[tier].sectors`), tourism only from border regimes, and labour only from sick adults. A player or AI that never locks down gets the transmission cut of prudence (half of contacts at 8 deaths/100k/14 d) with no output loss: a farmable choice.<br>Real-world contrast: the game's own doc cites Goolsbee & Syverson (2021), who found most of the 2020 fall in consumer traffic was voluntary. Sweden, with light NPIs, still lost about 2-3% of GDP in 2020, and international arrivals fell 73% in 2020 (UNWTO), not only through closures. | `NMQ@95311714` (prudence block), `hVB@87537609`, `LSg@95318338` (`u=PSg(OVB(w,g))`), `OVB@87537693`, `pAA@25201039` | read+checked (mechanism); inferred (size) | In `LSg`, scale the sector array accumulated into `w.month.sectors` by the row's `B.effectPrudence`: availability_s × (1 − α_s·(1 − d)), e.g. α = hospitality .8, leisure .8, services .3, trade .2, education 0. Anchor: the text `deathReportingFloor+(1-te.deathReportingFloor)` in the same function. Optionally apply the same factor to tourism. d = 1 unless emergent deaths exist, so **no day-0 shift**. Small code patch (one replace). |
| L21 | **Emergent coronavirus is 5-20× less lethal than SARS-CoV-2 in 2020 (Medium-High; emergence is off by default).**<br>Mechanism: family traits `severeShare:[[5e-4,.002],[.003,.01],[.02,.06]],fatality:[[.005,.01],[.01,.03],[.05,.12]]`, so IFR = share × fatality: senior .1-.72%, adult .003-.03%, child ≤ .002%. Hospital saturation (×2.5) raises the senior figure to at most 1.8%.<br>Real-world contrast: ancestral SARS-CoV-2 IFR was about 1% at 65-69, 3% at 75-79 and 8%+ at 80+ (O'Driscoll 2021, Levin 2020), so roughly 3-4% averaged over 65+, and about 0.1% for 20-64. In-game a COVID-like wave kills on the order of 30-60 per 100k, against about 190 per 100k real excess deaths in 2020-21 (WHO, 14.9 M) [inferred arithmetic]. Even the in-game endemic "covid" (senior .075%) is close to the emergent lower bound. | `Z1.emergence.families.coronavirus.traits` (anchor `naming:{virus:"SARS-CoV-{n}"`, @~87501300), `WRA@87529634` (`R=N*U[G]`, `j=Z*_`) | read+checked (constants, IFR formula); inferred (death totals) | Data-only edit of the literal: senior severeShare [.08,.12] × fatality [.25,.35] (≈2-4% IFR), adult [.01,.02] × [.04,.08] (≈.04-.16%), child unchanged. Consider the same check for the henipavirus adult range (9-25% vs Nipah's 40-75% CFR). **No day-0 shift**: traits are drawn only at emergence, and saves keep the traits already drawn. Deterministic. |
| L22 | **AI locks down only after hospitals are overwhelmed (Medium).**<br>Mechanism: `f1B`: `A.band===2 ... ?1 : A.band<3?0 : ... ?2:3`. Band 2 (epidemic incidence, or excess severe > 50% of free beds) gives only tier 1 (10% contact cut). Tier 2 needs band 3 (> 90% of free beds), and tier 3 needs 14 more days at band 3 (`KSg=14`). The response therefore comes about 2-4 weeks after saturation, while fatality is already ×2.5.<br>Real-world contrast: in March 2020 most OECD governments imposed stay-at-home orders while deaths were in single digits per million per day, before ICU saturation (Oxford OxCGRT stringency peaked before hospital peaks). | `f1B@95328146`, `H1B@95327913`, `ClQ@95328400` (anchor the literal `hSg=Object.freeze({influenza:"senior",covid:"senior",measles:"child",rsv:"senior"})` beside it) | read | When the top disease is an identified emergent pathogen, band 2 → tier 2, and band 3 → tier 3 after 7 days. Seasonal diseases keep the current rule. **No day-0 shift**: band thresholds sit above seasonal peaks (catalogue `_doc`). Small code patch. |
| L23 | **The approval incentive punishes lockdowns and not deaths in a global pandemic (Medium).**<br>Mechanism: the deaths penalty counts only the excess over the *world* pop-weighted mean and only at band ≥ 2. In a worldwide wave the average country therefore loses ~0, while restrictions always cost −3 (tier 3, day 1), rising to −8 with fatigue.<br>Real-world contrast: early 2020 lockdowns came with a rally effect, raising trust in government and incumbent vote intention by a few points (Bol et al. 2021, EJPR 60). Blame later tracked a country's own deaths and duration. | `X5A@94078156` (`"epidemic_deaths"`, `"epidemic_restrictions"`), `vXA@87576607`, `a0Q@94077475` | read (formula); inferred (incentive) | Make the restriction drag fatigue-only: replace `(e>=3?3:1)+...` with a fatigue term. Measure deaths against the country's own anchor (`anchors.deathRatePerYear`) blended with the world mean. Anchors `"epidemic_restrictions"` and `"epidemic_deaths"`. **No day-0 shift** (tier 0, band 0 at start). Small patch. |
| L24 | **Behavioural health covers substance use only: no depression or anxiety, no suicide, and epidemics do not touch it (Medium, feature-sized).**<br>Mechanism: `U6Q` and `f6Q` track only `harmfulUseDelta01` and `dependencyDelta01`. The socialMind drivers (`SQg`) have no term for epidemic deaths, NPI restriction or isolation; lockdown reaches the mind only through growth, unemployment and income.<br>Real-world contrast: depressive and anxiety disorders are the larger labour cost (WHO: about 12 bn working days a year lost). COVID-19 raised their prevalence by about 28% and 26% in 2020 (COVID-19 Mental Disorders Collaborators, Lancet 2021). | `U6Q@94030590`, `f6Q@94030095`, `SQg@15880039`, `iY@15848856` | read | Minimal step: add `restrictionDrag`/`AXA` and the excess epidemic deaths per 100k to the `prospects` (or `hope`) signal in `SQg`. This is zero at day 0, so **no day-0 shift**. A full mental-health block is feature work, not a patch. Code patch. |
| L25 | **Behavioural health can only get worse than day 0 (Low).**<br>Mechanism: `t=bI(withdrawal·w·E − r·.16, 0, 1)` floors at 0. Downstream clamps are `[0,.12]` and `[0,.013]`, and `cJ@94033021` throws when an output is < 0. More prevention spending, higher alcohol excise or better conditions cannot cut use below the day-0 level.<br>Real-world contrast: alcohol taxes and treatment do lower prevalence (WHO SAFER, "best buys"). | `U6Q@94030590`, `f6Q@94030095`, `cJ@94033021` | read (clamps); inferred (effect) | Allow a bounded negative delta, e.g. [−.3, 1], and change the output clamps and the `cJ` validator to accept negatives. **No day-0 shift** (0 at start). Medium code patch touching save validation (`F6Q@94031633` repair), so it carries save-compatibility risk. |
| L26 | **Importation is the same for every country (Low).**<br>Mechanism: flu 3/yr and measles 2/yr per country whatever its population or arrivals; China and Tuvalu are equal.<br>Real-world contrast: importation scales with traveller volume, and small isolated islands see measles only sporadically. | `Z1.diseases.*.externalImportsPerYear`, `NMQ` (`RRA(g,P/365)`), `KVB@87535039` | read | Scale by `tour.arrivals` relative to the world median. **Shifts day-0**: the anchors are computed with imports in `KVB`. Needs re-calibration; low priority. |
| L27 | **[First half not a bug, 2026-10-31, re-read before building: the anchor is a two-year mean of severe cases including seasonal peaks, so months below it lowering hospital need are the other half of winter months raising it; flooring the excess at 0 would push the long-run hospital load above calibration. The second half (epidemic severe cases also raising general complications) stands as stated, unconfirmed. (read+checked)]** **Hospital-need coupling: negative in calm months, and epidemic deaths partly counted twice (Low).**<br>Mechanism: `t = Σsevere − anchor·days` is not floored, so calm months lower hospital need below baseline. Epidemic severe cases die in the SEIR (with saturation ×2.5) and also raise hospital-line complications, which feed `mortalityRiskIndex` and then general deaths (elasticity .22).<br>Real-world contrast: care displacement was real (excess non-COVID deaths), but the COVID patients themselves should not be counted again. | `xMQ@95321552`, `hGg` (@94045963), @94047560 | read (formula); inferred (double count) | Floor `t` at 0 (`w>0?g.month.severePer100k-g.anchors.severePer100k*w:0` → `Math.max(0,...)`). Optionally exclude the epidemic need from complications. Near-zero day-0 shift. Data-only replace. |
| L28 | **Lockdown sector closures ignore adherence, and school closure has no parental-labour or learning cost (Low).**<br>Mechanism: `OVB` uses the raw tier sectors while contacts scale with adherence; education .5 only reduces education-sector supply.<br>Real-world contrast: school closures kept parents out of work and caused learning losses of about 0.3-0.6 school years (World Bank 2021). | `OVB@87537693`, `ZRA@87532465`, `LSg` | read (mechanism) | Optional: scale the closure depth by adherence, and add a small labour-presence hit when education < 1. Day-0 neutral. Code patch; lower priority. |

### Fix candidates
1. **L20, prudence → sector demand.** Biggest realism gain; it closes the "never lock down" free ride. Day-0 neutral (d = 1). Deterministic: it reads the row's state-derived `effectPrudence`. No new saved field: sector values are already saved under `sealed.sectors`. Patch size: one `{find,replace}` in `LSg` (minified-name dependent; anchor `deathReportingFloor`).
2. **L21, coronavirus family severity.** Large gain for any pandemic game. Zero day-0 risk; only newly drawn pathogens change. Data-only literal edit, anchored on `"SARS-CoV-{n}"`.
3. **L22, AI response timing.** Medium gain. Day-0 neutral. Changes AI pandemic outcomes, so it needs a headless run with emergence set to "frequent". Small code edit in `f1B`, anchored on the `hSg` literal.
4. **L23, approval incentive.** Medium gain. Day-0 neutral. Small edit in `vXA` / `X5A`, anchored on `"epidemic_restrictions"`.
5. **L27, floor on the excess hospital need.** Small gain, near-zero risk, one data-only replace.
6. **L24 and L25, behavioural health.** Feature-scale. L25 touches the save validators, so it carries save-compatibility risk.
7. **L26, imports.** Shifts day-0 anchors; leave until a calibration pass.

**Determinism:**
- The epidemic RNG is a xorshift (`Y7@87528696`). Its state `epidemiology.rngState` is seeded from `rngSeed0` (`EZB@87550731`, `IXA@87554452`), saved, and repaired on load (`nZB@87560463`) [read].
- Draws happen in a fixed order: countries come from `Iu@87567015` (sorted keys), diseases by index [read].
- The warm-up uses no RNG [read].
- `KMQ` iterates the `Map` directly, but each step is per-country and order-independent [read].
- The caches (`lVB`, `kVB`, `zMQ`, `KBQ`, `oZB`, the `hWA` border revision) are WeakMaps holding state-derived values that are recomputed after load [read].
- `new Date(e6+B*fVB)` in the season calendar is computed from the sim day [read].
- No `Math.random`, `Date.now` or `performance.now` call sits inside 15.84-15.90 M, 87.48-87.58 M, 94.02-94.06 M or 95.29-95.35 M [read]. That was a bundle-wide search with 59 hits, none in those ranges.
- `tQQ@88219000` (tourism, outside this area) runs `for…in` over `committedPairAccess`. Its order is insertion order of saved state, so it is deterministic if the save keeps key order [inferred].
- All proposed fixes read only sim state.

**Looks right:**
- The model is age-structured SEIRS with waning immunity, waning vaccine protection, a 14-day protection lag, POLYMOD contacts, latitude seasonality, and stochastic fade-out for small outbreaks [read].
- Day-0 anchoring is careful: presence, hospital need and mortality all use the excess over a calm-year warm-up, and the demography base rate subtracts the anchor infectious rate, so there is no double count at day 0 [read].
- Hospital saturation raises fatality ×2.5 and uses functional beds, so health-system strikes and budgets matter [read].
- Reported numbers lag and under-count by surveillance; border risk uses *published* data scaled by press freedom [read].
- Border closure leaks at 3% (`closed:.03`); travel mixing uses visitor stock, not annual arrivals [read].
- Adherence falls with fatigue, and spontaneous prudence follows Weitz et al. [read].
- Measles herd immunity comes from DTP3 birth coverage [read].
- The emergence rate (4%/yr at "normal") matches roughly 5 severe pandemics per century [inferred].
- Vaccination campaigns pull clinical workers [read].
- The behavioural-health inputs are day-0 deltas, and the mortality and labour outputs are bounded and small [read].

### Not yet read
- Pathogen creation `BZB`, family and trait draws `ZVB`/`_VB`, identification `tSg`, extinction `aSg`. **Scope:** seen only as call sites in `P1B` and `LMQ`.
- Vaccine race: research-share setter `y1A`/`_R`, discovery cost and the `followerSpeedup` path, campaign validation `VMQ`, and who pays `_uA` (budget line). **Scope:** read `cp` and `YSg` only.
- Band computation `pSg`/`JSg` (exact estimated-incidence rule), reporting share and delay `mSg`, `deathsReceding`, the fatigue mapping `iXA`/`e3A`. **Scope:** read `ySg` and `vXA`, which consume them.
- Routine senior campaign `$RA`, births `pVB`, initial state `S7g`, and whether the 1-year burn-in brings measles to equilibrium in low-coverage countries. **Scope:** read `KVB` and `WMQ` only.
- When `A._tourCs` exists after a save load. If it is rebuilt after the first daily epidemic tick, `fSg` returns null and that day has no cross-border mixing, which would be a save/reload divergence. **Scope:** found the setters `@88202262` (genesis) and `OPA@88207114` (sorted rebuild), and a call of `OPA` from `zOQ@96886226` when a transport network exists [read+checked]. Not read: whether `zOQ` runs on load before the first daily tick, and when `_tourFlow` (which `fSg@95314167` also requires) is rebuilt.
- How often the AI `epidemicResponse` capability runs. **Scope:** found only its registration @96567542.
- Sector GDP shares for "services", "trade" and the others, needed to put a GDP number on a tier-3 month. **Scope:** read the `pAA` multiplier only; L20 and L28 sizes are inferred.

---

## 4. Education (S1–S15)


### How it works
- **Cadence.** The monthly `tickEducationWorld` runs `aJQ@96458272`. For each country it calls `lY` (state, created lazily) and then `QMB@15954094`. `QMB` does four things in order: doctrine transition countdown `BMB@15953932`, per-level update `ZvB@15950362` for `Nr@15940766 = ["foundation","secondary","higher"]`, skill-stock update `_vB@15951455`, and aggregation `MY`→`AMB@15953050`. Alerts `education.alert_started` / `education.alert_resolved` go to the player only. [read]
- **Day-0 seed.** `NvB@15945174` reads `education.json` through `hvB@15941945`. The fields are primary out-of-school, secondary and tertiary enrolment %, primary and lower-secondary completion %, youth and adult literacy, primary and secondary pupil-teacher ratio, learning poverty, and trained primary teachers %. [read]
  - Access: foundation = 1 − primaryOutOfSchool; secondary = secondaryEnrollment (clamp .12–.995); higher = tertiaryEnrollment (clamp .01–.92).
  - Completion: foundation = primaryCompletion; secondary = lowerSecondaryCompletion; higher = `.45+.43*lowerSecCompl+.08*tertiaryEnrol` (clamp .42–.91). The higher-education figure is modelled, not data.
  - Learning: foundation = `.5*literacy+.35*(1-learningPoverty)+.15*trainedTeachers`; secondary = `.35*literacy+.65*lowerSecCompl`; higher = `.3*lit+.4*higherCompl+.3*secLearning`. No assessment (PISA-type) data is used.
  - Pupil-teacher ratio: higher = secondary PTR × .72.
  - [read `NvB@15945174`]
- **Eligible cohorts.** Eligibility comes from fixed demographic bands `O8@11540747`: foundation = cohorts [1,3), secondary = [3,4), higher = [4,5) (`OvB@15942331`, `ib@11541023`). With 5-year cohorts these are ages 5–14, 15–19 and 20–24. They do not depend on the compulsory-schooling ages. [read; the age widths are inferred from `O8` (children [0,3], elderly [13,17])]
- **Level state** (`_JA@15944708`). Fields: eligibleM, enrolledM, outOfSchoolM, capacityM, entrants, completions, dropouts and otherExits (last month), accessRate, completionRate, learningIndex, pupilTeacher, inequalityIndex, and a frozen `baseline{...}` copy. Durations `pvB@15940993`: foundation 10, secondary 5, higher 5 years. [read]
- **Teachers.** There is one public "education" role, `employment.public.education.headcountM`, scaled by strike availability `xc(A,"education")` (`jaA@15942551`). The staffing ratio is headcount ÷ day-0 headcount and is the same for all three levels (`Kgg@15948877`). Each level's teachers = baseline share × that ratio. [read]
  - The headcount moves toward a player- or AI-set `targetHeadcountM` (`NlB@16118149`, `JyA@16117035`) through `TlB@16116000`. Hiring speed is `1-exp(-P/12)` per month, where `P = (.9-.65*highSkillShareOfRole)*wageAttractiveness^1.5*unemploymentTerm*adminTerm*skillFit^.65`. For education that is about 40% of the gap per year. [read]
  - Payroll above the spending-scaled envelope is charged to the budget as `spending:public_payroll` (`sIA@16115613` in `j9A@93799593`). [read]
- **Means (money).** `ygg@15948750`: `means = Lgg/pgg`, clamped .2–2.5. "edu" covers foundation and secondary; "sup" covers higher.
  - `Lgg@15942820 = B6(vb(spend)*delivery)`. `B6` = %GDP × `rFA` = `budgetGdpReferenceBn`. [read]
  - `vb@11543301` multiplies the slider by `gYA(...,"school"|"higher")`, the school-age (or 20–24) population per working-age person relative to day 0 (`dnB@11542932`, `NG@11541159`). [read]
  - `pgg@15942868` = the day-0 envelope share in Bn. Day-0 envelopes are set only at init (`ylB` via `jDQ@93803536` from `YLQ`). [read]
  - `budgetGdpReferenceBn` is rebased every year to nominal GDP (`WDQ@93805762`, stable id `"rebaseBudgetGdpReferences"` in `GKQ@96590463`). [read]
  - So means = nominal total education spend ÷ day-0 nominal spend. [inferred from the read pieces]
- **Facilities.** `eyA@15949147` uses facility units ÷ baseline units: `NF@15254244`, clamp .05–3, keys `"schoolFoundation"`, `"schoolSecondary"`, `"universityCampus"`. Facilities = 0 if every unit is gone. [read]
- **Capacity.** In `ZvB`: `a = clamp(min(staffing, means^.55, facilities) × doctrineCapacity, 0, 1.65)` and `capacityM = baseline.enrolledM × a`. At day 0 every factor is 1, so capacity equals day-0 enrolment and every system starts exactly full. [read the code; "exactly full" is inferred]
- **Access target.** `XvB@15949488`: `baseline.accessRate × doctrineAccess × G2A(laws)`, clamp .01–.999. Target seats = `min(eligible×target, capacity)`. Entrants refill exits plus 1/12 of the gap each month. [read `ZvB`]
- **The two laws.** They are read only in `G2A@14707340` (via `$uB@14706970`), plus an AI desirability score at @95605439. [read; searched `"compulsory_schooling"|"free_public_education"`, `$uB` refs, `G2A` refs]
  - Per level: `max(C(law), e(law)) / max(C(baselineLaw), e(baselineLaw))`, clamp .65–1.35.
  - Compulsory term `C`: foundation `.82+duration*.014` (clamp .82–.995); secondary `.35+(endAge-12)*.09` (clamp .35–.96); higher .15.
  - Free-level term `e`: ≥ level → .96; one step below → .78; otherwise .45.
  - `accessFloor` is computed in `$uB` but never read (the only `accessFloor` hit is its definition). [read]
- **Learning** (`ZvB`): `baseline.learningIndex × clamp(staffing,.25,1.6)^.22 × means^.28 × doctrine.learning × doctrine.accessLearning`, clamp .08–.995. [read]
- **Completion** (`ZvB`): `baseline.completionRate × (capacity/enrolled clamp .15–1)^.2 × means^.12 × doctrine × (.82+.18×learning/baselineLearning)`, clamp .05–.998. Each month `enrolled/(duration×12)` pupils exit; the completionRate share of them completes. [read]
- **Doctrines.** Two branches, `_a@15940820`: allocation {fundamentals, balanced, vocational, higherResearch} and access {universal, targeted, merit}. Day-0 values come from `education-doctrines.json`. Multiplier tables are `NaA@15941119` and `yvB@15941623`.
  - Every effect is taken as a ratio to the country's own baseline doctrine (`xaA@15943436`).
  - A change (`oyA@15954273`, events `education.policy_changed` / `education.policy_rejected`) is free, ramps linearly over `Fk=12` months and has a cooldown `ByA=730` days. [read]
- **Skill stock.** `_vB@15951455`. `skills.shares` = workforce shares (low, mid, high).
  - Day 0: taken from pop-group skill mixes (`Jgg@15944421`), not from education data.
  - Each month: excess = completions − baseline completions scaled to eligible. Mid gains `(exFound*.35 + exSec*.65*midYield)/laborForce`; high gains `exHigher*highYield/laborForce`. The per-month clamp is ±1% of the source share. [read]
  - Migration changes the shares by proper stock accounting (`$vB@15952134`, `"education:migration:dtYears"`). [read]
- **Outputs (readers of `education`).** [read each cited reader unless noted]
  - **Labour matching.** `anA@24244076` splits the private pool into tiers by `skills.shares`, which feed `tYB@24248449` → `WFB@24240562`. Supply by tier versus vacancies, with substitution (subDown .9, subUp .75), sets sector employment and `B.outputFactor[K]`. **So education also reaches output through labour matching, not only technology (correction 1.1).** [read]
  - **Tier unemployment and wages.** `HhA@24244787`. The tier wage index is wage bill per worker by tier against day 0 (@24254029). No scarcity premium was found. [read fragment; "no premium" is inferred]
  - **Technology.** `iBC@96104805`: `human = .55*higher.accessRate + .25*higher.learningIndex + .2*highSkillShare`. `FrC@96460410` / `Rh@15628500`: researchers = `.45*higher.learning + .35*higher.completion + .2*highShare`. [read; their use is in section 6]
  - **Satisfaction.** `LAB@94071311` adds `x5A@94074457 = (access-1)*4 + (learning-1)*3 - max(0,ineq-1)*2` points to every group's target, and satisfaction moves 12% per month toward the target. [read]
  - **Social mood.** `S5B@15878585` averages health, access, learning and admin delivery into `publicDelivery` for `socialMind` (`SQg@15880039`). [read]
  - **Other readers.** Public-role hiring speed (`TlB`, skill fit); health-worker factor `YGg@94038070`; unemployment-insurance tier mix `P5B@15841298`; emigration profile `JMB`/`iyA@16059224`; migration report `yMB@16070001`; AI doctrine choice `RDC@96504793`; law AI score `TVg`. [read]
  - **Labour participation.** `qP@16105115 = s_ (.6 + family-spend term) + participationAnchor`. It is used by `_participationOf` (@96670176). It reads no education field. Working age `Tc@15761329` = cohorts 3+ (15+) minus retirees. [read]
  - **Fertility.** Not found (regex `education…tfr|tfr…education`; the list of `.education` readers has no demography caller). [read search]
- **Saves.** State `version:2` is persisted. `oMB@15960124` repairs shares, rates ≤1, outOfSchool and alerts on load. The `XaA` validator throws if any rate or `learningIndex` exceeds 1 (@15958448). [read]

### What looks wrong
| ID | What looks wrong (real-world behaviour it departs from) | Code | Conf. | Suggested fix |
|---|---|---|---|---|
| S1 | **The workforce skill stock is frozen at day 0; there is no cohort replacement (High).** `_vB` moves shares only by completions *above* `baseline.completionsM×eligible/baseline.eligibleM`, so day-0 completion rates add exactly zero skill. There is no retirement or death flow that would let less-educated old cohorts be replaced by more-educated young ones, and no age structure. Day-0 shares come from pop-group mixes (`Jgg`), not from attainment data, so stock and flows are not tied together. Real world: workforce attainment rises steadily as cohorts turn over (OECD 25–64 tertiary share went from about 22% to 40% between 2000 and 2020 with stable policies). Rising school completion reaches the workforce over 10–40 years through cohorts. | `_vB@15951455`, `Jgg@15944421`, `lY@15946282` | read+checked (the missing upgrading is inferred from the formula) | In `_vB`, add a slow pull of `shares` toward the stock implied by current flows, at about 1/40 per year. The flow-implied stock can use the existing `TvB@15943973` formula on live completions. Anchor `skills.monthlyShift=[-n,n-c,c]`. Day 0 is unchanged, but every trajectory moves and the result needs a headless check (data gaps between `Jgg` and the flows could cause drift). Code patch. |
| S2 | **Students stay in the labour force (Medium-High).** Participation `qP = .6 + family term + anchor` reads no enrolment. Working age includes 15–24, so a 30% rise in higher enrolment, or compulsory schooling to 20, removes nobody from the labour force. Tertiary expansion therefore has no opportunity cost (no lost earnings or output while studying). Real world: youth participation falls as enrolment rises, and OECD 15–24 participation is about 45–50%, mostly because of schooling. This is finding H11 confirmed on this build. | `qP@16105115`, `s_@16104996`, `Tc@15761329`, `_participationOf@96670176` | read | Subtract enrolment above baseline (secondary and higher, times a student non-participation share of about .7) from the labour force, through `s_`. Anchor `spend.fam||0)-(A.fiscal0.spend.fam||0))*.02`. It is day-0 neutral (the excess is 0 at day 0). Check `participationAnchor` re-derivation in `u_@16123888` / `LyA` so the anchor does not absorb the term. Small code patch. |
| S3 | **Compulsory schooling is inert under the default free-education level, and its ages change nothing (Medium).** `G2A` takes `max(C(compulsory), e(free))`. With `free_public_education=secondary` (the law default), secondary `e=.96` while `C(endAge)=.35+(endAge-12)*.09`, which is ≤ .96 for every endAge (16→.71, 20→1.07 clamped to .96). Raising the leaving age to 20 therefore does nothing. For foundation the maximum gain is .995/.96 = +3.6%. The age fields never change the eligible cohorts (fixed 5–14 and 15–19), there is no enforcement cost, and there is no labour effect (S2). The `accessFloor` table in `$uB` is dead code. Real world: raising the leaving age (UK 1972, many OECD reforms) sharply raises enrolment at the affected ages and needs more teachers. | `G2A@14707340`, `$uB@14706970` | read+checked | Make the two terms add up: for example `access = e + (1-e)*compulsoryCoverage(endAge)` at the levels the age covers, with a ratio against the baseline law as now. Anchor `tertiary_partial:4,tertiary_full:5}` in `G2A`. Day-0 neutral (it is a ratio to the baseline law). Data-only {find, replace}. Capacity still binds (S11 note), so enrolment rises only with teachers, money and facilities, which is realistic. |
| S4 | **"Means" is nominal total spend, so inflation and cohort size raise school quality (Medium).** `ygg = Lgg/pgg`: the numerator is %GDP × `budgetGdpReferenceBn`, rebased every year to **nominal** GDP (`WDQ`), and also × the school-age/working-age ratio (`vb`→`gYA`). The denominator is the day-0 Bn. Neither is deflated or taken per pupil. Ten years of 5% nominal growth at a constant slider gives means 1.63: learning ×1.15 (`^.28`), capacity ×1.31 (`^.55`), completion ×1.06. A growing child cohort raises means and learning even though spending per pupil is flat, and an ageing country loses learning. Real world: outcomes track real resources per pupil, and teacher costs rise with wages (Baumol). | `ygg@15948750`, `Lgg@15942820`, `vb@11543301`, `gYA@11542968`, `WDQ@93805762` | read (the effect sizes are inferred arithmetic) | Divide `means` by (price or wage index ÷ day 0) and by (enrolledM ÷ baseline.enrolledM) for the learning and completion terms. Keep the total (not per pupil) for capacity. Anchor `Q==="higher"?"sup":"edu"`. Day-0 neutral (all ratios = 1). Data-only edit. |
| S5 | **Learning ignores class size (Medium).** In `ZvB` learning uses `staffing = headcount/day-0 headcount`, which is the same for all levels. `pupilTeacher` is computed but read by no formula. If enrolment rises (population growth, a higher access target that capacity allows), learning does not fall. Pupils queue as out-of-school instead, because capacity binds first. Real world: crowded systems absorb pupils into larger classes, and learning falls with pupil-teacher ratio (modest effect, larger at high ratios). | `ZvB@15950362`, `Kgg@15948877` | read | Replace `D` in the learning term with `D × baseline.enrolledM/enrolledM` (staffing per pupil). Anchor `Math.pow(dg(D,.25,1.6),.22)`, where `.25,1.6),.22` is the stable constant text. Day-0 neutral. Data-only edit. |
| S6 | **Learning quality never becomes human capital (Medium).** `_vB` converts only completion counts into skill shares. `learningIndex` reaches the workforce only through the `.82+.18×learning` completion factor. Otherwise it feeds satisfaction, `publicDelivery` and the research indices. A country with half the learning but equal completion has the same workforce. Real world: cognitive skills (test scores) predict wages and growth better than years of schooling (Hanushek and Woessmann). | `_vB@15951455`, `ZvB@15950362` | read | Weight each level's completions by `learningIndex/baseline.learningIndex` before subtracting the baseline in `_vB` (the `o=s=>s.completionsLastMonthM-(...)` helper). Day-0 neutral. Data-only edit. |
| S7 | **Free or paid schooling has no money flow and there is no private schooling (Medium).** The `free_public_education` choices move only the access multiplier. `"none"` saves no public money and raises no fee revenue; `"tertiary_full"` costs nothing. Every pupil is in one public system capped by public teachers. The CGE good `education` (hh .3, fd 3e3) is not connected to the education state. Real world: private provision is 10–30% of secondary and up to 50–80% of tertiary in Korea, Japan, Chile and Brazil. Free tertiary (Chile 2016) moved roughly 0.5% of GDP of tuition onto the budget. | `G2A@14707340`, law defs @12602654, good @11401478 | read (that the CGE good is disconnected is inferred; no CGE reader was found in `lY`/`QMB`/`ZvB`/`eyA`/`_vB`) | Minimum: add a fiscal line or a `sup` envelope requirement scaled by the free level (fee share × higher enrolment × cost per student). Larger: a private seat pool funded by household `education` demand. Anchor `"free_public_education")||"primary"`. Shifts day 0 unless the cost is taken relative to the baseline law. Code patch; touches the fiscal side. |
| S8 | **Technology and research read current students, not the graduate stock (Medium).** `iBC` `human` puts weight .55 on `higher.accessRate`, the current 20–24 enrolment rate. `Rh` researchers use current-student learning and completion (.8 of the weight). An enrolment push raises absorption and research the same month, decades before graduates exist. Real world: research capacity is the stock of graduates and researchers, and it builds over 5–15 years. | `iBC@96104805`, `Rh@15628500`, `FrC@96460410` | read (formulas); inferred (downstream size; section 6) | Move weight toward `skills.shares[2]` (the stock), or lag `accessRate` through an EMA with a half-life of about 5 years kept in state (save-compatibility default needed). Anchor `highSkillShare:w`. Day-0 neutral if the EMA seeds at day 0. Coordinate with the tech findings. |
| S9 | **Learning and completion respond instantly (Low).** A rise in teachers or money changes every enrolled pupil's learning and completion the same month. Secondary learning does not depend on the foundation learning of the incoming cohort. Completion boosts apply at once to the current leavers. Only doctrines ramp (12 months) and hiring is gradual (`TlB`). Real world: quality reforms show up over a school cycle, and secondary outcomes inherit primary learning. | `ZvB@15950362` | read | Smooth `learningIndex` toward its target (for example 1/24 per month), or carry a cohort learning state from foundation to secondary. Day-0 neutral. Code patch (new state field needs a load default). |
| S10 | **One teacher pool and one staffing ratio for every level (Low).** Hiring any teacher raises university capacity as much as primary capacity. Higher-education staff are seeded from secondary PTR × .72. There is no training pipeline: a hire counts in full at once (hiring speed is the only lag). Real world: university staff, and teachers for specific subjects or levels, are separate labour markets, and teacher training takes 3–5 years. | `Kgg@15948877`, `NvB@15945174`, `TlB@16116000` | read | Low priority. Could add a hire "experience" ramp in `Kgg` (staffing counted at 50% for 24 months). Code patch with state. |
| S11 | **Doctrine effects depend on the starting doctrine, cost nothing, and the AI treats them as costly (Low).** The multipliers are ratios to the country's own baseline, so `merit→universal` gives secondary access 1.12/.88 = 1.27, while `targeted→universal` gives 1.12. Switching is free. The AI's crisis rule `SDC` drops `higherResearch` and `universal` in a fiscal crisis even though they have no fiscal effect. Note: day-0 capacity binds everywhere (capacity = baseline enrolment), so access-raising doctrines and laws raise enrolment only after capacity grows. That is realistic, but nothing tells the player. | `xaA@15943436`, `NaA@15941119`, `yvB@15941623`, `oyA@15954273`, `SDC`/`RDC@96504793` | read | Mostly design. A realism fix is to give doctrine changes a transition cost (for example a temporary means ×.97 during the 12-month ramp). Low value. |
| S12 | **The satisfaction effect is tiny and the same for every group (Low).** `x5A`: access +10% gives +0.4 points, learning +10% gives +0.3, with no group weighting (education matters more to young families and middle classes). Equity gains below 1 give no bonus. | `x5A@94074457`, `LAB@94071311` | read | Weight by group (for example use `material` weights or a group education salience). Anchor `(A.accessIndex-1)*4+(A.learningIndex-1)*3`. Shifts no day-0 numbers (index = 1 at day 0). Data-only. |
| S13 | **Skill timing and yield artefacts (Low).** An extra foundation completer (age about 14) counts as .35 of a mid-skill worker in the labour force at once. Doctrine yields make one extra graduate count as 1.18 (vocational, mid) or 1.2 (higherResearch, high) workers. At baseline, yields have no effect at all, because they multiply only the excess. | `_vB@15951455`, `NaA@15941119` | read | Drop the yields (set them to 1) or apply them to learning, not head count. Count foundation excess only through secondary entry. Data-only. Small realism gain. |
| S14 | **Day-0 learning and higher-education values are modelled, not measured (Low).** The learning indices come from literacy and completion only; learning poverty is used for foundation only. Higher completion is a formula. Gross enrolment above 100% is clamped onto a 5-year cohort that does not match each country's official school ages. These numbers drive day-0 baselines only (all effects are relative), so mis-calibration mostly affects the absolute values shown and the AI thresholds (`RDC`: absoluteAccessRate .68, learningAbsolute .52). | `NvB@15945174`, `RDC@96504793` | read | Optional: add harmonised test scores (World Bank HLO) to `education.json` for learning. Shifts day-0 absolute values (not the ratios). Data change. |
| S15 | **Day-0 skill shares are disconnected from education data (Low).** `Jgg` builds the shares from pop-group compositions, while `TvB` (the fallback) treats flow rates (tertiary enrolment × completion) as the stock. Together with S1, a country whose young cohorts are far more educated than its workforce never converges. | `Jgg@15944421`, `TvB@15943973` | read | Covered by the S1 fix (the convergence target). No separate patch. |

### Fix candidates
1. **S3** (compulsory schooling masked). High realism gain for a law the player sees; low risk (day-0 neutral because it is a ratio to the baseline law; deterministic; no state). Data-only {find, replace} in `G2A`. Its visible effect is small until capacity is expanded.
2. **S4** (nominal means). Medium-high realism gain. It removes an automatic drift in every country (learning and capacity rising with inflation and nominal growth). Day-0 neutral, deterministic, no state. Data-only in `ygg`. It needs a stable price or wage index read; one candidate is the public-wage `priceLogHigh` path in `nMB@15964840`, not yet chosen.
3. **S5** (class size) and **S6** (learning into skills). Medium gain each, day-0 neutral, data-only edits in `ZvB` and `_vB`. A headless run should confirm the drift stays small.
4. **S2** (students in the labour force). Medium-high gain and an exploit closer (free tertiary expansion). Day-0 neutral, deterministic, but it touches the employment and pensions anchor arithmetic (`u_`, `LyA`), so it needs a breakage analysis. Small code patch.
5. **S1** (cohort turnover). Highest realism gain, highest risk: every country's trajectory moves and `Jgg`-versus-flow data gaps may cause drift. Day 0 is unchanged. It may need a state field (a load default for old saves). Code patch. Research the target formula first.
6. **S8** (tech flow versus stock). Medium gain; coordinate with the technology findings. A state field (EMA) needs a save default.
7. **S7** (fees and private schooling). Real gain but a larger design (fiscal line, private pool). Day-0 shift unless baseline-relative. Code patch.
8. **S9–S15**. Low priority.

**Determinism:** Every education function read uses only country state, cohorts, laws, spend and facility counts. None reads `Math.random`, `Date` or UI state. Iteration is over frozen arrays (`Nr`), `Object.keys`/`Object.values` of fixed-shape objects (`policy`, `alerts`, `byProvince`) and the `countries` Map, all deterministic in insertion order. `CMB@15955070` (the doctrine preview) runs on a JSON clone and does not mutate the live country. That is read, but `eyA`'s callee `NF`/`wP` was read only shallowly. `JyA` simulates hiring on locals only. No hazard found. [read]

**Looks right:**
- Stock-flow enrolment with entrants, exits, completion and dropout, plus a monthly conservation error (`ZvB`).
- Leontief capacity: teachers, money and buildings are all required (`min(staffing, means^.55, facilities)`).
- Gradual teacher hiring, linked to wage attractiveness and unemployment, with payroll charged to the budget (`TlB`, `sIA`).
- Teacher strikes cut available teachers (`xc`).
- Migration moves the skill stock with real stock accounting (`$vB`).
- Doctrines are real tradeoffs (seats move between levels, merit trades access for learning and inequality) with a 12-month ramp and a 2-year cooldown.
- The school budget auto-scales with the size of the school-age cohort (`vb`→`gYA`); the fault is only in how "means" reads it (S4).
- Skill supply really constrains sector employment through tier matching (`anA`→`WFB`).

### Not yet read
- **Monthly labour-force update path.** **Scope:** read `qP`, `s_`, `LyA`, `FlB` (init), `j5`, `rwg` and `_participationOf→qP`. Not read: the monthly caller that sets `laborForceM` from `qP` (likely in the employment tick). S2's claim that participation ignores education rests on `qP`/`s_`, which have no education term.
- **`WFB` substitution weights `SFB`/`RFB`/`g0Q` and the `outputFactor` consumer.** **Scope:** read `WFB` and `tYB`. Not read: how strongly a tier shortage cuts CGE sector output, or the size of the `subDown`/`subUp` penalties. Unknown how much skill drift moves GDP.
- **Tier wages.** **Scope:** read the fragment @24254029 (wage per worker by tier versus day 0). Not read: the full function, or whether any wage-setting term uses tier scarcity.
- **`iBC`/`Rh` consumers (absorption and research points).** **Scope:** formulas read; the downstream weights `NUQ@96108674`, `OtA` were covered in section 6.
- **`Yk@15956000`, `XaA@15957618` (validation in full), `a4C@96910584` (UI), `OF@14720331` (immigration selection by skill), `@93910125` (index using `shares[2]`), `L6Q@94038663` (health use of `YGg`).** **Scope:** opening fragments only.
- **`ub`→`gYA` program link for `sup`.** **Scope:** `ub` maps `edu→"school"` and `sup→"higher"` (read); the `higherPerWorker0` anchor seeding was not read. (`Dw@14704310` was checked: the tool cut its text at `Dw=(A,B,Q)=>Math.max(B`, so it being a clamp is inferred, which the S3 arithmetic depends on.)
- **Facility construction cost and AI building of schools.** **Scope:** `NF`/`wP` read; the facility budget line `Zp` (`spending:public_facilities`) and the build actions were not read.

---

## 5. Public administration (G1–G13)

below is worked out by hand from constants I read.

### How it works

**Cadence and entry**
- Monthly `tickAdministrationWorld` -> `IJQ@96459425` [read]. For each country it calls `DL(B)` (lazy init),
  `ETB(B)` (the update) and stamps `lastTickDay`. For the player only, it emits `"administration.alert_started"` /
  `"administration.alert_resolved"`.
  - The scheduler entry is `HA("tickAdministrationWorld",…)` in `b0B@96585507`, in the `MONTHLY_PUBLIC_SERVICES`
    phase [read].

**State: `DL@26070615`** [read]. Stable anchors: `"administration.json"`, `"administration-doctrines.json"`,
`"Administration incompatible pour"`.
- `seed`: a copy of `administration.json` per country (`bcg@~26065600`). It holds the WGI-2025 absolute scores
  `institutions.{governmentEffectiveness, regulatoryQuality, ruleOfLaw, controlOfCorruption}` (0–1), WDI `internetUse`,
  Lowy `missionsAbroad`, and `territorialPressure0 = sjA()` [read].
- `capital`, set once at init [read]:
  - `process = clamp(.2 + .72·GE, .12, .96)`
  - `digital = clamp(.15 + .68·internet + .17·GE, .1, .98)`
  - `registry = clamp(.12 + .52·internet + .28·RQ, .08, .96)`
  - `integrity = clamp(CoC, .05, .98)`
  - `foreignNetwork = max(1, missions)`
  - `baselineCapital` is a deep copy of `capital`.
- `policy`: 5 doctrine branches, read from `administration-doctrines.json`. Table `eL@26063625` [read]:

  | Branch | Transition | Cooldown |
  |---|---|---|
  | `serviceModel` (career / agencies / appointments) | 18 mo | 4 y |
  | `territorialModel` | 24 mo | 5 y |
  | `domesticPriority` (balanced / civil / fiscal) | 3 mo | 180 d |
  | `socialAccess` | 12 mo | 2 y |
  | `foreignPosture` | 12 mo | 2 y |

  Factor tables [read]:
  - `Jcg`: career `{throughput 1, integrity 1.08}`, agencies `{1.09, .98}`, appointments `{1.05, .86}`.
  - `ycg`: reach and coordination.
  - `CTB`: fiscal priority gives `{civil .76, fiscal 1.24}`.
  - `wTB`, `rTB`: social access and foreign posture.
- `queues` `civil|fiscal|social|foreign` (`FBA`): `{inflow, backlog, processed, capacity, delayMonths, baseline}`,
  initialised in `Ocg`.
  - Inflow comes from `DTB@26066212` [read]:
    - civil = pop·(.014 + .008(1−internet))
    - fiscal = laborForce·(.055 + .025(1−RQ))
    - social = (pensioners + unemployed + .16·pop)/12 + .045·unemployed
    - foreign = .75·missions + 12 + 4·aid partners + 18 if at war
  - Baseline delays come from `hcg@26066657` [read]. For example, fiscal =
    `clamp(.3 + 1.15(1−GE) + .55(1−RQ), .2, 3.6)` months.
- `baselineFactors` (`Tcg@26067849`), `baselineRoleProductivity` (`ijA@26067159` for administration, socialServices and
  diplomacy), `baselinePolicyFactors`, `baselines`, `outcomes` and `alerts`. Everything downstream is a ratio to these
  day-0 anchors, so day 0 is neutral by construction [read].

**Monthly update `ETB@26072211`** [read]
- `Ncg@26071802` advances each doctrine transition linearly. `Nq@26065748` blends the from/to factors by `progress`.
- Inflow is recomputed from `DTB`.
- Capacity: `n = baseline.inflow · g[queue] · popScale`, where `g = ujA@26068119` [read]:
  - `civil = I(adm)·offices^.25·throughput·reach·coord·priority.civil`, clamped [.12, 1.75]
  - `fiscal = I(adm)·offices^.18·throughput·(integrity/integrity0)·priority.fiscal`, clamped [.12, 1.75]
  - social and foreign follow the same pattern.
  - `I(role) = ijA/ijA0`, with `ijA = clamp(jr^.58 · wageAttractiveness^.18, .15, 1.45)`.
  - `jr@16115271 = (headcount/headcount0)/(pop/pop0) · strike availability (xc@15934975)` [read].
  - `offices = NF("administrationOffice") = units/baselineUnits`, clamped [.05, 3] (`NF@15254244`) [read].
  - `oTB@26067334`: `throughput = serviceModel.throughput · (process/process0)^.35 · (digital/digital0)^.2`, and
    `integrity = serviceModel.integrity · (integ/integ0)^.45` [read].
- Queue step: `processed = min(backlog + inflow, capacity)`, then `backlog += inflow − processed` and
  `delay = backlog/processed` [read].
- `PjA@26068910` builds the outcomes [read]:
  - `collectionRatio D = clamp(g_f^.55 · ((d0+.25)/(d+.25))^.18 · (integrity/integrity0)^.3, .55, 1.25)`, where
    `g_f = processed/inflow` (≤ 1.35).
  - `socialDeliveryRatio = clamp(socialCorrect/socialCorrect0, .4, 1.3)`.
  - `territorialReach`, `foreignSupervisionRatio`, `integrity = clamp(CoC·org.integrity/org.integrity0, .05, .98)`,
    `civilCompletion = g_civil`.
  - `uncollectedGDP` and the four `*Backlog` alerts fire at delay > 1.45·baseline + .25.

**Inputs that move capacity** [read unless tagged]
- **Admin headcount target.** The player or AI sets it (`JyA@16117035`, `NlB`). The ceiling is `ewg@16116729`:
  15 % of the labour force per role, 35 % for all roles together.
- **Hiring and firing speed.** `TlB@16116000`: the monthly fraction of the gap closed is `1 − exp(−P/12)`.
  - Hiring: `P = (.9 − .65·skill_hi[.43]) · wageAttr^1.5 · f(unemployment) · f(capital, stab) · skill match`,
    about 5 %/month.
  - Firing: `P = .7`/yr, about 5.7 %/month.
  - Hires come only from the free labour pool (`JlB@~16110750`).
  - Payroll is `headcount × wage`. The excess over the day-0 payroll is the budget line `spending:public_payroll`
    (`sIA@16115613`, `j9A@93799593`). It is paid from the primary budget [read]; ledger settlement [inferred, from the
    earlier economy review's `nUQ`].
- **Public wages.** `wageAttractiveness` enters capacity (^.18) and hiring speed (^1.5) [read]. How it is computed was
  not read.
- **Offices.** `administrationOffice`: 1 per 100k residents, `costBn .022`, 14 months to build (`Sa@~15251266`). War
  damage reduces units [read for the facility spec; damage inferred from `damageCarry`].
- **Doctrines.** Through `setAdministrationPolicy` -> `ooA@96458872` -> `tTB@26072770`. They have no money cost [read].
- **AI** (`uyQ@96510452`, `koC@96510099`) [read]:
  - When a queue's `(d+.25)/(d0+.25) ≥ ~1.25`, it switches priority to that queue or raises headcount 3–5 %, at most
    once a year.
  - It returns `domesticPriority` to balanced after 365 days once every ratio is below 1.08.
- **Not inputs.** `spending:administration` (`gwA@93796910`), laws, regime, technology and corruption policy are not
  read by `DL`/`ETB`/`ujA` [read: none of them is referenced in those functions].
  - The `capital.*` fields are never written after init. The only writer is `cTB` (`foreignNetwork` on a split).
  - The regex `capital\.(process|digital|integrity|registry)` hits only `oTB` [read].

**Outputs (every reader found)** [read]
- **Tax collection.** `YBA@26073648 = clamp(collectionRatio, .55, 1.25)` is multiplied into collection efficiency
  `cr@93790155`:
  - `Q = eff + .001·Δstab`
  - `× economy-minister competency (N_A, ±15 %)`
  - `− .15·max(0, cabinetCorruption − corr0)` (`YDQ@93789872`)
  - `− .0012·max(0, Δburden)`
  - `÷ (1 + inflation/200)`
  - `× YBA`
  - then (C10 patch) `× (1 − Δshadow)`, clamped [.15, .99].
  - Callers of `cr` include VAT, wealth, property and tariff lines (`@93793523`), corporate profit tax (`@95095549`),
    CGE taxes (`collectionEfficiencyByCountry`, `@96240136`) and payroll collection (`@96246050`).
  - `eff` is set by income tier only (`xDQ@93803663`): rich .97, upper .92, lower .85, other .75.
  - Day-0 revenue is calibrated by `revAdjust` (`TDQ@93803053`).
- **Pension contributions.** `T9B(…, {collectionEfficiency: (eff ?? .55)·YBA})` in `vrC@~96451256`.
- **Admin spending line.** `gwA@93796910 = adminGDP0 · clamp(1 + (1−YBA)·.4 + (pop0/pop − 1)·.5, .8, 1.3)` + migration
  law cost.
  - `adminGDP0 = c5B@15838101` = `3 + 1.5(ln25 − ln pop) + .12(rev − 30) + .035(45 − stab)`, clamped [1.2, 22] % of GDP,
    set in `Z_A@93802236`.
- **Social transfers.** `aTB(socialDeliveryRatio)` scales the welfare value of `chom`, `minima`, `fam` and `logt` in
  household welfare `A0Q@94067928`.
  - It also enters health renunciation (`@94046106`, clamp .55–1.25), the "public services" issue (`@15899624`) and
    socialMind `publicDelivery` (`S5B@15878585` -> `SQg@15880039`, relative to day 0).
- **Technology absorption** (weights `ppA` .45 / .35 / .2, `@15623552`). In `FrC@96460410`:
  - `digital = capital.digital`
  - `institutions = .45·capital.process + .35·outcomes.integrity + .2·civilCompletion`
- **Aid soft power.** `ITB` and `nTB@26073916` in `Z_B@~87694141`.
- **Illicit-market enforcement.** `zxg@95275091`: `integrity` is weighted .30 in investigation and .32 in adjudication.
  `Txg@95275579`: tax capture is `.55 + .75·integrity`.
- **War-target evaluation.** `territorialReach` in `o1A@95020832`.
- **Facility AI.** `Q6C@96533564`, `hag@25386577` (office demand).
- **Not found as readers.** Elections, coups, legitimacy, construction/permits and informality. Searched
  `administration\??\.(outcomes|queues|policy|capital|seed)`, `outcomes\??\.(…all fields)`,
  `queues\??\.(civil|fiscal|social)` and the `informal…administration` / `electoral|coup…administration` proximity
  regexes.

**Correction to the economy review (section 1.1).** `economy-systems-review.md:264` says administration reaches output "only
through technology diffusion". The code also routes it into tax collection (`YBA` in `cr`), pension contributions,
welfare from transfers, and health access [read].

### What looks wrong

| ID | What looks wrong (real-world behaviour it departs from) | Code | Conf. | Suggested fix |
|---|---|---|---|---|
| G1 | **Clearing a small fiscal backlog permanently raises tax collection by up to 25 % (High).** In `D`, the delay term `((d0+.25)/(d+.25))^.18` reaches its maximum once the backlog hits 0, and the backlog hits 0 whenever capacity exceeds inflow by any margin for long enough. With fiscal `d0 = .3+1.15(1−GE)+.55(1−RQ)`, a zero backlog gives a term of 1.25 (GE .85), 1.36 (GE .5) or 1.43 (GE .2). That is clamped to `YBA` 1.25 and then multiplies `eff`, which is capped at .99. Revenue gain by tier: rich +2 %, upper-middle +7.6 %, lower-middle +16.5 %, low income +25 %. The cheapest route is a pulse, and the AI's return-to-balanced rule does the same thing: (1) set `domesticPriority` to fiscal (×1.24, 3-month ramp); (2) the backlog drains in about 6 months; (3) switch back to balanced at the 180-day cooldown. Capacity then equals inflow and the backlog stays at 0, so the gain persists at no lasting cost (see G7). Offices (`n^.18`), a few % more staff, or the `agencies` model work the same way. In practice, a tax administration that processes returns faster does not lift collection by a quarter. Revenue-administration reforms (e-filing, LTOs, Rwanda, Georgia) add 1–3 % of GDP over 5–10 years, mostly in low-capacity states, and the gains are not step functions of a queue length. | `PjA@26068910` (`C=a=>qE(…baseline.delayMonths+.25,…delayMonths+.25)`, `collectionRatio:D`); `YBA@26073648`; `cr@93790155`; `CTB@26064659`; `eL@26063625` (`cooldownDays:180`) | read+checked (mechanism and constants); inferred (the pulse sequence and % gains are hand-computed, not run) | Cap the upside of the delay term. Data-only edit in `PjA`: find `Math.pow(C("fiscal"),.18)`, replace `Math.pow(Math.min(C("fiscal"),1.05),.18)`. Optionally narrow `YBA`'s clamp `.55,1.25` to `.55,1.1`. Anchors: `"administration.alert_started"`, `collectionRatio:`. Day 0 unchanged (C = 1). Saves are safe: outcomes are recomputed every month. |
| G2 | **The backlog is a pure integrator, so tax collection drifts to a clamp from demographics alone (Medium).** Capacity scales as `(headcount/h0)^.58·(pop/pop0)^.42` (through `jr`, `ijA` and `popScale`). Fiscal inflow scales with the labour force. Any steady mismatch accumulates without limit, because the backlog has no triage, write-off or behavioural response. Growing country with fixed admin staff, pop and labour force +2 %/yr: about 7 extra months of backlog after 10 years, so `D` ≈ .66 and collection falls about 34 %. A shrinking or ageing country, where the labour force falls faster than population, drains to zero backlog and gets the G1 cap for free. The AI partly offsets this by switching priority or hiring 3–5 % a year; the player gets nothing automatic. Real tax agencies triage arrears, write off stale cases and run amnesties, so backlogs stabilise. Budgets also track the economy, and revenue/GDP does not decay 30 % in a decade from population growth. | `ETB@26072211` (`backlog=max(0,t+(a−c))`); `DTB@26066212` (fiscal = `laborForceM·…`); `jr@16115271`; `ijA@26067159`; `uyQ@96510452` | read (mechanism); inferred (magnitudes; needs a headless series of `administration.queues.fiscal.delayMonths` and `outcomes.collectionRatio` for a fast-growing and a shrinking country) | Code patch in `ETB`: drain the excess backlog each month with `backlog −= .03·max(0, backlog − baseline.backlog·popScale)` (triage). Optionally scale fiscal capacity by labour-force ratio instead of population. Day-0 neutral (the excess is 0). Deterministic. The save validator allows it (all fields finite and ≥ 0, `n8A@26076823`). |
| G3 | **Administrative capital never changes: no digital government, no reform, no erosion (High for realism, Medium for play).** `capital.process`, `digital`, `registry` and `integrity` are set once from WGI and WDI at init and never written again; the only writers are `DL` and `cTB`. So `throughput` (process^.35, digital^.2) and technology inputs stay frozen at day-0 values: `digital` (weight .2) and `.45·process` inside `institutions` (weight .35). About 36 % of absorption capacity is a constant. Internet use (`seed.internetUse`) is also frozen, so the civil inflow `.008(1−internet)` never falls. Hiring speed (`TlB`) uses the frozen capital too. In the real world, e-government indices (UN EGDI) and internet use move a lot within a decade (Estonia, India, Rwanda). WGI government effectiveness and control of corruption move slowly with sustained reform and fall with conflict or state capture. | `DL@26070615` (`capital:C`, `baselineCapital:mT(C)`); `oTB@26067334`; `FrC@96460410`; `TlB@16116000`; regex `capital\.(process\|digital\|integrity\|registry)` hits only `oTB` | read | Code patch in `ETB`: each month move `capital.x += (target − x)/120`, a half-life of about 7 years. Targets: process from admin staffing and wage attractiveness (`I("administration")`), offices and stability; digital from internet growth and digital technology deployment; integrity from the service model, cabinet corruption (G5) and war. Each target equals the day-0 value at day 0, so day 0 is unchanged. Use existing fields (no schema change). Deterministic. |
| G4 | **Two corruption systems that never meet, one of them one-sided and instant (Medium).** (a) Revenue loss from corruption comes only from the head of government and cabinet `traits.corruption` (`YDQ`: .6 head + .4 cabinet mean), as `Q −= .15·max(0, g − corr0)`. It applies at once on appointment and reverses at once on dismissal. A cabinet cleaner than at day 0 gives nothing. (b) Institutional integrity (WGI CoC) moves only through the `serviceModel` factor (career 1.08 vs appointments .86, ×1.256 in 18 months). Neither reads the other, and there is no anti-corruption lever (no agency, law or audit body). The IMF Fiscal Monitor (2019) finds the least corrupt countries collect about 4 % of GDP more than the most corrupt at the same income. That effect works through compliance norms that erode and recover over years, and it outlasts the individuals involved. | `YDQ@93789872`; `cr@93790155` (`Q-=Math.max(0,g-C)*.15`); `j_A@93790442` (`_corr0`); `PjA@26068910` (`integrity:QC(…controlOfCorruption*Q.org.integrity/…)`); `Jcg@26064366` | read | Lag and symmetry: replace `Math.max(0,g-C)*.15` with `(B._corrEMA=(B._corrEMA??C)+(g-(B._corrEMA??C))/24)-C` times .15. This is a code-like `{find,replace}` in `cr`, about a 2-year EMA, symmetric. `cr` is called many times per tick, so move the EMA update into `IJQ` (monthly) and only read it in `cr`, or the result depends on call count. Feed `YDQ` into the G3 integrity target. Day-0 neutral (EMA = corr0). Old saves fall back through `??`. |
| G5 | **Collection efficiency ignores state capacity data already loaded (Medium).** `eff` comes from the income tier only (.97 / .92 / .85 / .75). Somalia and Rwanda, or Nigeria and Vietnam, get the same marginal collection rate on a tax rise. WGI GE and CoC sit in `administration.seed` but are not used for the level, and `YBA` is only a ratio to day 0. Day-0 totals are fixed by `revAdjust`, so the error shows in marginal revenue from rate changes and in CGE tax and payroll collection. Within an income group, tax effort and VAT C-efficiency vary by a factor of 2 or more and correlate with government effectiveness. | `xDQ@93803663` (`B.eff=Q.rich?.97:Q.upper?.92:Q.lower?.85:.75`); `TDQ@93803053`; `cr` callers `@96240136`, `@96246050` | read | Blend in governance: `eff = tier·(.9 + .2·GE)` or similar. This shifts day-0 CGE collections, which use `cr` at genesis, and the `revAdjust` split, so it needs re-calibration and a headless day-0 diff. Lowest priority of the revenue fixes. |
| G6 | **Social delivery can exceed 100 % and its leakage vanishes (Medium).** `socialDeliveryRatio` (clamp .4–1.3) scales the welfare value of unemployment, minimum-income, family and housing transfers in `A0Q`. The budget pays the transfer in full either way. Above 1, recipients get more welfare than was paid. Below 1, the undelivered part is spent and benefits no one: no recipient, no official, no saving. The ratio exceeds 1 from doctrine factors (`automatic`: coverage 1.14 × accuracy .92) or while a backlog drains (`g_social` ≤ 1.35). In practice, delivery is capped at the entitlement (arrears aside). Leakage is either an error (the money still reaches someone) or fraud (it reaches officials or intermediaries). | `PjA@26068910` (`socialDeliveryRatio:QC(…,.4,1.3)`); `aTB@26073734`; `A0Q@94067928` (`$Gg.has(n)?aTB(B):1`); `wTB@~26064800` | read (welfare scaling); inferred (that the money is still paid in full: the spending line uses `C[n]`, read, but the settlement was not traced) | Data-only: in `PjA`, find `socialDeliveryRatio:QC(qE(o,B.baselines.socialCorrect),.4,1.3)` and change `1.3` to `1.05`. Also change the `aTB` clamp `.4,1.3)` to `.4,1.05)`. Day-0 neutral. Routing leakage to a recipient is a larger code patch. |
| G7 | **The civil backlog (permits, registries, IDs) has no economic cost (Medium).** The only outside readers of civil-queue state are tech `civilCompletion` (weight .2·.35 ≈ 7 % of absorption, and only while capacity < inflow), the AI and the alerts. A permanently long civil delay (for example after the G1 pulse) costs nothing once completion is back to 1: there is no construction-permit lag, no business-entry friction, no informality push. Registry and permit delays raise construction time and informality (Doing Business, de Soto) and reduce investment. | regex `queues\??\.(civil\|fiscal\|social)` and `civilDelayMonths` outside the admin module: no hits; `FrC@96460410`; `hag@25386577`; `Q6C@96533564` | read (absence: regex searches over the whole bundle) | Code patch, cross-module: multiply construction-project duration or private investment by `((d+.25)/(d0+.25))^.1` for the civil queue. Day-0 neutral. Size it after reading the construction module (K1/K2 patches touch it). |
| G8 | **Deep civil-service reforms are fast and free (Medium).** Patronage to merit (`appointments`→`career`) completes in 18 months, centralisation in 24. There is no budget cost and no transition dip, and `agencies` gives +9 % throughput on every queue at no cost. Real civil-service and territorial reforms take 5–15 years, cost money (training, severance, IT), and often lower performance during the transition. | `eL@26063625` (`transitionMonths:18`, `24`); `Jcg@26064366`; `tTB@26072770` (no cost); `Nq@26065748` (linear blend) | read | Data-only edits in `eL`: `serviceModel` `transitionMonths:18` → `60`, `territorialModel` `24` → `48`. Increases are save-safe, because `n8A` checks `transitionMonthsLeft ≤ transitionMonths`; a decrease would invalidate saves in mid-transition. Day-0 neutral. A dip or money cost needs a code patch. |
| G9 | **Better collection cuts the admin budget (Low–Medium).** `gwA` scales the admin spending line by `1 + (1−YBA)·.4`. Reaching `YBA` 1.25 (G1) cuts admin spending by 10 %, about 0.1–2 % of GDP depending on `adminGDP0`. That is a second reward on top of the revenue gain. The line also buys no capacity, because `DL` never reads it. Raising revenue-administration performance costs money first (IT, audit staff); the cost of collection does not fall as collection improves. | `gwA@93796910`; `c5B@15838101`; `Z_A@93802236` | read | Data-only: in `gwA`, find `Ou(1+(1-B)*.4+` and replace it with `Ou(1+Math.max(0,1-B)*.4+`. Day-0 neutral. |
| G10 | **New or more complex taxes add no administrative load (Low).** Fiscal inflow is `laborForce·(.055 + .025(1−RQ))`, with RQ frozen at seed. Adding a wealth tax, a carbon tax or more VAT rates leaves the fiscal queue unchanged. Compliance and administration costs rise with the number and complexity of taxes (PwC/World Bank Paying Taxes). | `DTB@26066212` | read | Code patch: add `+ k·(active tax lines − day-0 active lines)` to fiscal inflow. Day-0 neutral. |
| G11 | **Integrity is counted twice in tax collection (Low).** The integrity ratio multiplies fiscal capacity (`·Q.integrity/g.integrity` in `ujA`) and multiplies `D` again (`^.3` in `PjA`). With G1 in place, the capacity path also feeds the delay bonus. | `ujA@26068119`; `PjA@26068910` | read | Remove one of the two, for example the `(…)**.3` term in `D`. Data-only. Day-0 neutral. Fine-tune after G1. |
| G12 | **Dead fields (Low).** `capital.registry` is computed and validated but never read. `Jcg.flexibility` (career .92, agencies 1.12, appointments 1.18) is never read either, because `oTB` returns only throughput, integrity, reach and coordination. The UI may present a tradeoff that does not exist. | `DL@26070615`; `Jcg@26064366`; `oTB@26067334` | read (UI not checked) | Either wire `registry` into G7 or G10 (fiscal/civil inflow) and flexibility into hiring speed, or report them to the developer. |
| G13 | **Pension contributions use a different collection efficiency (Low).** `T9B` receives `(eff ?? .55)·YBA`, clamped [0, 1]. It skips `cr`'s stability, corruption, burden, inflation and C10 shadow terms, so a corruption or inflation shock hits taxes but not contributions. | `vrC@~96451256` (`collectionEfficiency:ifA((r.eff??.55)*YBA(r),0,1)`) | read | Pass `cr(A,r)` instead. Data-only, but it shifts day 0 if `cr ≠ eff·YBA` at day 0 (the inflation term `÷(1+infl/200)` is non-zero at day 0). Needs a day-0 diff. |

### Fix candidates
1. **G1, cap the delay bonus.** Removes a 3-month exploit worth up to 25 % of tax revenue for low- and middle-income
   players, which the AI also triggers by accident.
   - Risk: none at day 0. Deterministic. Save-safe.
   - Size: one data-only `{find,replace}` in `PjA`, optionally a second in `YBA`.
   - Test: pulse `domesticPriority` and check that `collectionRatio` stays ≤ ~1.01.
2. **G9, one-sided admin-cost term.** Data-only, day-0 neutral, trivial. Removes the second reward from G1.
3. **G6, cap social delivery at 1.05.** Data-only (two edits), day-0 neutral. It touches welfare, health and
   socialMind, so run a short headless check of approval and stability.
4. **G8, longer service-model and territorial transitions.** Data-only, day-0 neutral, save-safe (increases only).
5. **G2, triage drain on excess backlog.** A small code patch in `ETB`, day-0 neutral. Needs a headless series first to
   confirm the drift is real and how large.
6. **G4, lagged, symmetric cabinet-corruption effect.**
   - Size: a code patch (EMA updated monthly in `IJQ`, read in `cr`).
   - Risk: a new country field read through a `??` fallback. Old saves are fine.
   - Determinism: the EMA must not update inside `cr`, which runs many times per tick.
7. **G3, slow-moving administrative capital.** The largest realism gain (digital government, reform, erosion).
   - Size: a medium code patch.
   - Risk: day-0 neutral if targets are anchored to baseline; it changes tech absorption and hiring speed over time.
   - Needs a long-run check (one per version).
8. **G7, civil backlog cost.** Cross-module (construction), sized after reading the construction code.
9. **G5, governance-based `eff`.** Shifts day-0 CGE calibration; last.
10. **G10, G11, G12, G13.** Low; not planned.

**Determinism:** No hazards in the administration module.
- `IJQ`, `DL`, `ETB`, `ujA`, `PjA`, `tTB` and the AI (`uyQ`, `koC`) use only Math, state and `A.day`.
- They iterate `A.countries.values()` (insertion order), frozen `FBA` arrays and `Object.values(policy)`.
- The AI sorts queues with a key tiebreak (`MoC`).
- `performance.now()` appears only in genesis timing (`mLQ@~96388616`), outside this area.
- The proposed G4 EMA must be updated once a month, not inside `cr`.

**Looks right:**
- A queue model whose inflows come from population, labour force, pensioners, unemployment, aid partners and war.
- Capacity from staff with diminishing returns (^.58), wage attractiveness, offices, strikes (`xc`) and territorial
  pressure after annexation (`sjA`, reach^.35).
- Hiring limited by the free labour pool, skills match and unemployment, at about 5 %/month. Staff cuts are also gradual.
- Real doctrine tradeoffs: career (integrity) vs appointments (throughput); automatic vs means-tested (coverage vs
  accuracy); priority shifts that move capacity between civil and fiscal.
- Cooldowns; AI that responds to backlogs.
- Integrity feeding illicit-money enforcement.
- Everything normalised to day-0 anchors, and a strict save validator (`n8A`).
- The C10 anchor `Q*=YBA(B),Ou(Q,.15,.99)}` still matches `cr` in this build.

### Not yet read
- **Office upkeep and capex settlement.** **Scope:** read the `administrationOffice` spec (`costBn .022`, 14 months)
  and `NF`/`wP`. Not read: whether offices have running costs, staff needs, or a ledger-settled capex path. This bears
  on G1's "cheap capacity" route.
- **Severance and separation cost of cutting public headcount.** **Scope:** read `TlB` (cut speed) and that
  `publicSeparationsM` flows from `gJQ` into `JlB`. Not read: `gJQ` and whether separations pay severance or raise
  unemployment benefits. This decides whether cutting admin staff has a cost beyond lost capacity.
- **`wageAttractiveness` and public wage setting** (`iMB@~15967695` area). **Scope:** read only where it enters
  capacity and hiring.
- **Settlement of `spending:administration` and `spending:public_payroll`.** **Scope:** read that both are
  `primary_budget` lines in `j9A`. Not traced into the ledger. Not checked whether the admin role's day-0 payroll is
  inside `adminGDP0` or `spendOther` (`Z_A` residual).
- **AI threshold `gE(A,B)`** in `uyQ` (`cf(roC 1.25, gE, eoC .1)`). Not read, so the exact trigger for the AI pulse is
  approximate.
- **Headless magnitudes for G1 and G2.** None measured (no runs in this pass). Series to log:
  `administration.queues.fiscal.{backlog,delayMonths}`, `outcomes.collectionRatio` and `cr` for a growing (e.g.
  Nigeria), a shrinking (e.g. Japan) and a lower-middle country under the fiscal pulse.
- **UI.** Whether `flexibility` and `registry` are shown to the player (G12). **Scope:** simulation bundle only.
- **Security-justice's own WGI copy** (`ruleOfLawIndex`, `governmentEffectivenessIndex` at `@25299686`). Out of scope;
  also frozen [inferred], not read.

---

## 6. Technology and research (R1–R12)

Build 26335289, simulation-worker bundle. Offsets are UTF-16. IDs used: R1–R12 (R13–R19 left free).

### How it works
- **Cadence.** Monthly `uJQ@96465154` (stable anchor: `w.lastSettlementDay=Math.max(0,Math.trunc(jw(A.day)))` and `B.frontierByNode[C.id]=g.reduce`). It walks countries sorted by key. For each one it refreshes capacity (`FrC@96460410`), sets programme allocations to equal shares (`KtA@15626446`, allocation = 1/n), updates licence status (`YrC@96461249`, anchor `"technology.agreement_expired"`), sets programme status (`mrC`), shares points out (`TtA@15630049`), advances each active programme (`LrC@96462320`, anchor `"fastResearch"`), completes it (`P0B@96463060`, anchor `"technology.capability_mastered"`), then moves every discovered node's deployment one month along the diffusion curve (`JpA@15623932`) using `cJQ@96459862`. [read]
- **State** (`pQ@15626643`, `technology.schemaVersion===2`). Per country: `capacity{researchers,laboratories,institutions,digital,researchDelivery,energy,monthlyPoints}`; `nodes[id]{progress 0-100, deployment, baselineDeployment, generation, generationProgress, generationDeployment, matureDeployment}`; `programs[]{id,nodeId,pathId,sourceCountryKey,allocation,statusId,lastProgress}`; `licenses[]`; `domainCredits` (19 domains, capped at 100); optional `capacityReserve` (0-0.5). Global: `frontierByNode`, `firstMasteryByNode`, `frontierAbsorption`, `programSeq`, `agreementSeq`. [read: `NUQ@96108674`, `jtA@15639698` validator]
- **Catalogue.** 265 nodes in 19 domains (`tw`, from inline `ZF.nodes`, anchor `nodes:[{id:"agriculture.irrigation"`). Effect channels: 119 `supply`, 70 `labor`, 51 `equipmentModel`, 20 `researchCapability`, 7 `energyDesign`. Supply and labour `max` values run from 0.09 to 0.45. Cost runs from 35 to 760 (median by stage: stage 0 = 35, 1 = 88, 2 = 185, 3 = 360). 189 nodes carry supply or labour effects and are the only ones that can have generations. [read: catalogue parsed out of the bundle text]
- **Day 0** (`NUQ@96108674`, `OUQ`, `zUQ`, `O7B@15623496`). Which nodes a country starts with comes from its seed profile stage per domain (`M3`), plus nodes implied by real assets (oil-field types, nuclear plants, warheads, launch sites: `vBC`), with prerequisites closed. A discovered node starts at `deployment = clamp(readiness[domain] x Bass(years), .01, 1)`, where years by stage is `[50,30,15,6]` (`h7B`) and readiness comes from `KUQ.byCountry[key].domains`. `baselineDeployment` is set to the same value and there is no generation, so every technology factor is exactly 1 at day 0. `frontierAbsorption` is the 90th percentile of country absorption (`LtA`), fixed at day 0. Research capacity is seeded with `researchDelivery: 1` (`E=1`). [read]
- **Research points per month** (`OtA@15628627`, anchor `researchPct:B,researchers:Q,institutions:g,digital:C,laboratories:w,delivery:r,energy:e`): `max(.02, (clamp(rdPct,0,6)+.15) x (.35+researchers) x (.55+institutions) x (.75+.25 x digital) x max(.1,labs)^.08 x delivery x energy x (GDP/100)^.16)`. Inputs: `researchers = Rh(...)` (education learning index, completion and high-skill share, [.05,1.2]); `institutions` from the administration review; `labs` = university campuses; `delivery = GrC@96460249`, the fill rate of the `scientific_research` good in [.15,1.15]; `energy` = power availability. [read]
- **R&D intensity** `C2@15837931` = `rdIntensity + spend.rech as % of GDP`. `rdIntensity` is written once, at setup, from data `rdSpend` ("Dépense intérieure brute de R&D (DIRD), toutes sources de financement, % du PIB"): `xDQ@93804152`, `B.rdIntensity=Math.max(0,C(Q.rdSpend,1))`, and no other writer turned up in `refs rdIntensity`. `spend.rech` is the "Recherche publique" budget line, 0-3% of GDP in 0.1 steps, described as "Crédits de recherche votés en plus de la R&D nationale observée" (anchor `{id:"rech",group:"educ"`, near 15832452). It starts at 0 (`VHg@93802778`, `rech:0`) and buys the `scientific_research` good (anchor `rech:Object.freeze({scientific_research:1})`, near 93806524). So public research is paid through the budget as a purchase of a good. [read] Whether the base `rdIntensity` costs anyone anything [inferred: no; it is a constant input to a formula].
- **Programme progress** (`LrC@96462320`). Each month the progress gained (in % points) is `(points x share + credits) x catchup x pathMult x cheat / node.cost x 100`. Terms: `share` = `(1-capacityReserve) x allocation` (equal shares); `catchup = jpA@15630867 = clamp(1+(frontierProgress-ownProgress)/80, 1, 2.25)`, used only before discovery (for generations it is 1, `a=D?1:jpA(t,o)`); `pathMult = JtA {sovereign:1, license:1.25, joint_venture:1.31, cooperation:1.28}`; `cheat` = 10 under the `fastResearch` cheat (`Kw@11433661`, which needs `A.cheats`). Progress over 100 is clamped away. `domainCredits` come only from space (`Q9B@15638937`, called by `HPA@87829333` with `"space"`). [read]
- **Programme slots** `Xh@15628885`: `clamp(1+floor(labs^.35 + researchers x 2.2), 1, 6)` (`qBg=6`). [read]
- **Generations.** A discovered node can be re-researched along the sovereign path only (`IP@15631301`), and only when `ytA@15626257` passes: the node has a supply or labour effect, and the newest generation's deployment `Sh` is at least `0.9 x ceiling` (`KpA=.9`, anchor `KpA=.9,fBg=new Set(["supply","labor"])`). The cost is the node's full `cost` again (`YBg@15630751`). When it completes, `hpA@15625921` (anchor `A.generationProgress=0,A.generationDeployment=0`) sets `generation+1`, resets the newest deployment to 0 and sets `matureDeployment` to the average of the older generations' deployment. There is no cap on `generation` in `hpA`, `IP`, `ytA` or `L5`. [read]
- **Diffusion** `JpA@15623932`. The ceiling is `E = clamp(sqrt(absorption/frontierAbsorption), 0, 1)` (`mtA@15623833`, `ceilingElasticity:.5`). Each month `o' = E-(E-o) x exp(-s/12)`, with `s = (p x transferOpenness + q x relAbs^1 x o/E) x capitalRenewal x energy`. Bass p and q per domain (`vBg`, anchor `telecom_cyber:{p:.02,q:.35}`): telecom and computing .02/.35; AI .01/.25; health and biotech .015/.25; industry, materials and electronics .01/.2; agriculture, food, construction, energy, grid and transport .008/.15; the rest .01/.15. Here `absorption = rY = .45 researchers + .35 institutions + .2 digital`, `relAbs = absorption/frontierAbsorption` (no upper clamp), `capitalRenewal = (equipment orderedAnnual/stock x lifetime)^.5` (`yLB@25063011`, `UrC=.5`), and `transferOpenness = 1+.5 x clamp(Δ technology_transfer policy vs day 0, -1, 1)` (`z7B@15624367`, `q2A@14704874`, `tZ@14704501`). Deployment never falls (`o>=E` returns `o`). Nodes without a supply, labour or energyDesign channel (`xh@15625562`) are set straight to `deployment=1`. [read]
- **Diffusion time** (computed from the read formulas with c = 1, relAbs = 1, E = 1). Going from 0 to 0.9 takes 13.8 years for telecom and computing, 19.2 for health and biotech, 21.0 for AI, 25.0 for industry, materials and electronics, 31.1 for the .01/.15 domains and 32.8 for agriculture, energy, construction and transport. At day 0, stage-0 nodes are at ~0.99 x readiness, while stage-3 agriculture is at 0.074 and stage-3 telecom at 0.31. [inferred: arithmetic on the read constants]
- **Effects** (`PH@87460090`, `applyTechnologyEffects`). `technologySupplyFactor[good] = LRA(supply) x y2A(absorption factor, [.35,1.25]) x $dB(learning by doing)`, and `technologyLaborFactor = LRA(labor) x $dB`. `LRA@87459790` divides the current node product by the day-0 product (`B7g`: baselineDeployment, generation 0) and clamps the ratio to [0.25, 50] (`muA`, anchor `muA=Object.freeze({min:.25,max:50})`). Inside it, `pWB@87459275` multiplies the effects of every node that touches a good, and `Q7g@87459155` gives one node's effect: `(1+m x deployment) x [(1+m x mature)^(G-1) x (1+m x newest) if G>0]`. A13 holds on this build under these new names (A13's `Z3g`, `VXB`, `nuA` and `wpA` are `Q7g`, `pWB`, `LRA` and `hpA` here). `energyDesign` gives a product of `(1+max x deployment)` per energy source (`JWB`), clamped to [0.8, 1.3] (`ggA`). Uses of the supply factor: production capacity (`pAA@25201039`, `k=technologySupplyFactor x capitalCapacityFactor`), the world production share (`O6g@24210157`, clamped to [.75,1.5] then raised to a power), and the cost share of a factor (`dzA@25120958`, `Q/(Q+g(1-Q))`). [read]
- **Goods most stacked** (product of `1+max` over all nodes at full deployment): scientific_research 33.3x (16 nodes), health 19.4x (16), software 13.2x (12), aero_parts 10.5x (11), elec_components 9.7x (14). Single-node goods such as tobacco and sugar top out near 1.1-1.2. [read: catalogue parse]
- **AI.** `L0B@96538510` (strategy `"strategy.technology"`, anchors `"technology.program.start"` and `"technology.emptyPortfolio"`) fills empty slots up to `Xh`. It ranks eligible nodes by `m0B@96537459` (domain need, plus remaining work divided by `max(30, cost x 4) x (1+generation)`, minus a stage penalty) and also signs free licences (`$7B`). The research budget AI `hyQ@96537861` (anchor `researchBudgetAnchor`) moves `spend.rech` 7-13% per quarter toward `anchor + (max rival C2 − own C2) − anchoredDesire`. Because it is anchored at first call, this is neutral at day 0. [read]
- **Licences** (`aP@15633636`, `Z7B@15634899`, anchor `tech-agreement:`; terms `ptA`: licence relation ≥ -10 for 10 years, JV ≥ 20 for 8 years, cooperation ≥ 45 for 6 years). Signing needs only a relation threshold, no embargo, the partner owning the node, and the node not yet owned. There is no payment and no consent step for the source country. [read]

### What looks wrong
| ID | What looks wrong (real-world behaviour it departs from) | Code | Conf. | Suggested fix |
|---|---|---|---|---|
| R1 | **A13 corrected: generations are gated by diffusion, so compounding is real but slow (Medium; corrects A13's pace).** A new sovereign generation can start only when the newest generation's deployment reaches `0.9 x ceiling` (`ytA`, `KpA=.9`), and `hpA` resets that deployment to 0 at every upgrade. So the cycle per node is the research time plus 13.8 to 32.8 years of Bass diffusion. A13's "4.7x after 10 generations" (m = .15, agriculture) takes roughly 10 x (33 + research) ≈ 350+ years, not a decade. There is still no `generation` cap in `hpA`, `IP`, `ytA` or `L5`, and the 50x clamp is the only bound. Contrast: real frontier TFP grows ~1%/yr; this design looks like that in the medium run but has no ceiling over very long games. | `ytA@15626257`, `hpA@15625921`, `IP@15631301`, `Q7g@87459155`, `LRA@87459790` | read+checked (gate, no cap); inferred (years) | Add diminishing returns per generation: in `Q7g` use `m_G = m x 0.5^(G-1)` for the newest term, or cap `generation` at 4 in `IP` (anchor `reason:"already_mastered"`). Day-0 neutral (no generations at day 0). Data-only find/replace in `Q7g` or `IP`. Low priority given R2's numbers. |
| R2 | **Estimated 10-year reach is modest; the A13 risk is long-run and concentrated in service goods (Medium).** Upper bound per good (generation 1 or a new discovery on the six best nodes, starting month 0, c = 1, including research time at 2 points per slot per month): grain 1.08x, machinery 1.08x, semiconductors 1.07x, scientific_research 1.26x, health 1.28x, software 1.36x. With instant research it is 1.20 / 1.42 / 1.84 / 2.67 / 2.17 / 2.70. In steady state (every node cycling, research time ignored) supply-factor growth would be 15.7%/yr for health, 19.6%/yr for scientific_research and 17.4%/yr for software, against 0.3-0.5%/yr for single-node crops. Contrast: health and research services have the slowest real productivity growth (Baumol, ~0-1%/yr), yet the catalogue gives them the most node stacking (16 nodes each, product 19-33x). | `pWB@87459275`, catalogue `ZF.nodes` (`"health.regenerative_medicine"` max .42, `"computing_data.self_improving_ai"` max .45) | read+checked (catalogue, formulas); inferred (pace: points per slot not measured) | Cap the product of node effects per good relative to day 0, e.g. `muA.max` 50 → 3, or a per-good cap scaled by sector (services ≤ 2x). Day-0 neutral. Data-only (`muA=Object.freeze({min:.25,max:50})`). Combine with A4d's cap on trend TFP x technology. Measure the real points per slot first (see Not yet read). |
| R3 | **Research speed barely depends on economy size (Medium).** Points scale with `(GDP/100)^.16` and node costs are the same for every country. Israel (GDP 542, rdSpend 6.76, clamped to 6) gets `6.15 x 1.31 = 8.1` against the US's (GDP 29,298, rdSpend 3.5) `3.65 x 2.48 = 9.1`, about 89% of the US rate, with other inputs equal. That is on about 4% of the US's R&D money. China (2.69%) gets ~72%, Germany ~66%, Malta (0.61%) ~7%. Contrast: frontier innovation scales with absolute R&D (researcher count, dollars). Adoption is cheaper, and that part is already modelled by catch-up and licences. | `OtA@15628627` | read+checked (formula, data); inferred (other inputs assumed equal) | Make generation (frontier) research scale with absolute R&D, e.g. use `(GDP/100)^.5` when the node is already discovered (in `LrC`, the `a=D?1:...` branch), and keep `.16` for first discovery (adoption). Day-0 economy neutral (only changes research pace). Code patch in `LrC`/`OtA`. |
| R4 | **Business R&D is frozen at its 2010-2025 observed share forever (Medium).** `rdIntensity` (total GERD % GDP, all funders) is set once at setup and never written again. Only the public line `spend.rech` (0-3%) changes it. Recessions, profits, firm scale, tax credits and sector mix have no effect on private R&D. Contrast: business R&D is ~70% of OECD GERD and procyclical. | `C2@15837931`, `xDQ@93804152` | read (single writer found by `refs rdIntensity`) | Let the business part track the business cycle, e.g. `rdIntensity x (profits or real GDP / day-0 value)^ε`, with ε ~ 1 for the business share. Day-0 neutral by construction. Code patch. Medium value; needs the profit series owner (economy review). |
| R5 | **Technology licences are free and need no consent from the source (Medium; exploit).** `Z7B` pushes the licence after `aP` checks only relation (≥ -10 for a 10-year licence), embargo and that the partner owns the node. No royalty is paid, the source gains nothing and is not asked, and the licence speeds research 1.25-1.31x on top of catch-up (up to 2.25x). A player can license every node from any non-hostile owner. Contrast: licences cost royalties (world IP receipts ~0.4% of world GDP) and need the owner's agreement. Technology theft is not modelled. | `aP@15633636`, `Z7B@15634899`, `JtA`, `ptA` | read+checked | Charge a royalty: a one-off or yearly transfer from licensee to source (e.g. node cost x k in $bn through the ledger), or require the source's relation to the licensee ≥ the threshold (both directions). Day-0 neutral. Code patch (ledger transfer); a data-only interim raises `relationMin` (`relationMin:-10,durationDays:3650`). |
| R6 | **No diminishing returns to R&D intensity, and Israel is silently clamped (Low).** Points are linear in `rdPct+.15` up to a hard clamp at 6 (`z1(tg(B),0,6)`). Doubling the research budget doubles every programme's speed. Israel's 6.76 is cut to 6. Contrast: research productivity falls as effort rises ("ideas are getting harder to find", Bloom et al. 2020). The diffusion gate (R1) already damps the effect on generation pace. | `OtA@15628627` | read | Concave term, e.g. `(rdPct+.15)^.75`. This changes research pace for every country from day 0 but not day-0 economic numbers. Data-only edit in `OtA`. |
| R7 | **Followers get no catch-up on generations, and there is no world frontier for generations (Low-Medium).** `frontierByNode` holds the maximum of `progress` (0-100), not `generation`. In `LrC` the catch-up factor is 1 once a node is discovered (`a=D?1:jpA(t,o)`). A follower re-researching generation 1 that the leader already deployed pays full cost, and a leader at generation 10 is not marked as ahead of anyone. Contrast: the advantage of backwardness. Followers imitate improvements at ~50-65% of the innovator's cost (Mansfield 1981), and leaders advance at the frontier rate. | `uJQ@96465154` (frontier update), `LrC@96462320`, `jpA@15630867` | read | Track `frontierGenerationByNode` (max of `Mk`) and apply `jpA`-style catch-up to generation research when own generation < frontier. Optionally slow research beyond the frontier. Adds saved state (save/reload test). Code patch. |
| R8 | **No international spillovers through trade, FDI or partners' deployment (Low).** The diffusion speed uses own deployment only (`q x relAbs x o/E`). The innovation term `p` moves only with the change since day 0 in the `technology_transfer` policy. Trade with, or FDI from, high-deployment countries does not speed diffusion. Contrast: foreign R&D spills over through imports and FDI (Coe-Helpman 1995; Keller 2004). Day-0 readiness data bakes in today's differences, so this matters only for how the world evolves. | `JpA@15623932`, `z7B@15624367`, `tZ@14704501` | read | Add a trade-weighted partner-deployment term to `p` (e.g. `p x (1 + w x Σ importShare_j x deployment_j)`), normalised to day 0. Code patch; needs the trade-share accessor (not read). |
| R9 | **Research points are lost in three places (Low).** A country with no active programme banks nothing. Progress over 100 at completion is clamped away (`u=rG(o+i,0,100)`). `capacityReserve` (up to 50%) is withheld from all programmes; on this build it feeds the vaccine race (`pMQ@95304065`, `_R@95304702`). Contrast: R&D capacity carries over (staff, labs). The cost is a few months per country per year at most. | `LrC@96462320`, `TtA@15630049`, `Wh@15630343` | read | Carry overflow and idle points into `domainCredits` for the node's domain (the mechanism already exists, capped at 100). Day-0 neutral. Code patch. |
| R10 | **`frontierAbsorption` is frozen at day 0 and `relativeAbsorption` has no upper clamp (Low).** As education and institutions improve worldwide, every country's `relAbs` rises above 1, so diffusion speeds up everywhere, and ceilings hit 1, so there is no relative constraint. Contrast: absorptive capacity is relative to the moving frontier. | `cJQ@96459862`, `NUQ@96108674`, `r9B@15644505` | read (frozen, no clamp); inferred (drift size: the absorption inputs belong to the education and administration reviews) | Recompute `frontierAbsorption` each month as the 90th percentile (order-independent, deterministic), or clamp `relAbs` to [0, 1.25]. Day-0 neutral. Small code patch. |
| R11 | **Non-economic nodes deploy instantly (Low; intended).** For nodes without a supply, labour or energyDesign effect (`xh`=0: `equipmentModel`, `researchCapability`), `uJQ` sets `deployment=1` the month they are discovered. These unlock capabilities (equipment models, extraction methods), and procurement or fielding is modelled elsewhere, so this is reasonable. It is listed so nobody "fixes" it by mistake. | `uJQ@96465154` (`n=!(xh(E)>0)`), `xh@15625562` | read (instant); inferred (fielding elsewhere: not read) | None, unless the war review finds fielding is also instant. |
| R12 | **"First in the world" ties go to the lowest country key (Low, cosmetic).** At day 0 `firstMasteryByNode` takes the lowest string key among holders (`String(w.key)<String(C)`). Within a tick, the first country in key order that completes a node is "first world" (`P0B`). This is deterministic but arbitrary. | `NUQ@96108674`, `P0B@96463060` | read | Leave it (journal flavour only). |

### Fix candidates
1. **R2 + R1: cap technology factors per good** (`muA` max 50 → 2-3, or a per-good or sector cap), and optionally diminish each generation's `m`. Gain: removes the long-run runaway in service goods and lines up with A4d's cap. Risk: none at day 0 (factors are 1), deterministic, no new state. Patch: data-only `{find,replace}` on `muA=Object.freeze({min:.25,max:50})`. A per-good cap or a generation decay in `Q7g` is a small replace too. Measure first (points per slot, Not yet read) to choose the cap.
2. **R5: price licences** (royalty through the ledger, plus the source's consent or relation in both directions). Gain: closes a farmable free speed-up and adds a real IP flow. Risk: day-0 neutral; the ledger transfer must use the treasury's ledger entry point; no save change unless agreements store terms. Patch: code; an interim data-only raise of `relationMin`.
3. **R3: scale frontier (generation) research with absolute R&D.** Gain: big R&D spenders lead on generations while small countries catch up through adoption. Risk: changes research pace for every country from day 0, but not the day-0 economy; deterministic. Patch: code (branch in `LrC`) or data-only on the `.16` exponent (affects discovery too).
4. **R7: generation frontier and catch-up.** Gain: the advantage of backwardness and a moving frontier. Risk: new saved field (save/reload test), deterministic. Patch: code.
5. **R4: business R&D responding to the cycle.** Gain: procyclical R&D. Risk: needs a profit series from the corporate model (economy review section 7); day-0 neutral if normalised. Patch: code.
6. **R6: concave R&D returns.** Small realism gain, data-only. It changes every country's research pace, so it goes with R3.
7. R8, R9, R10: low gain, each a small code patch. R11 and R12: no change.

**Determinism:** `uJQ` sorts countries by key and programmes by id. `YrC` sorts licences. `L0B` sorts candidates by score with an id tie-break. `hyQ` and `c6C` sort rival keys. `frontierByNode` is a max, so order-free. `PH` and `NUQ` iterate `A.countries.values()` unsorted, but each country's computation is independent (the `NUQ` mastery tie uses a string compare). `R7B` iterates the frozen catalogue and stored arrays. I searched for `Math.random|Date.now|performance.now|new Date(` in the technology ranges (15.40-15.66M, 96.10-96.12M, 96.455-96.47M, 96.53-96.545M, 87.455-87.462M) and found nothing. The only player-specific branch is the `fastResearch` cheat (`Kw`, `A.cheats`), which is simulation state, not UI. [read]

**Looks right:** Catch-up for first discovery (`jpA`: 2.25x at zero progress falling linearly, about 1.54x averaged over a programme, plus 1.25-1.31x for a licence) is in line with imitation costing about 50-65% of innovation. Bass diffusion with domain-specific p and q (fast for ICT, slow for agriculture and energy, 14-33 years to 90%) is realistic. Generation gating on 90% diffusion of the previous generation is realistic. Deployment depends on capital renewal (equipment orders against stock), which is realistic embodied technical change. Day-0 neutrality is exact: factors are relative to `baselineDeployment`, and `spend.rech` starts at 0. The public research budget is a real purchase of the `scientific_research` good, and delivery falls if that good is short. The AI research budget is anchored at day 0 and tracks changes in the rival gap.

### Not yet read
- **Actual monthly points per country** (`capacity.monthlyPoints`, `researchers`, `laboratories`, `Xh` slots). **Scope:** I read the formula and the GDP and R&D data for 5 countries. I did not read the education, administration or campus inputs, so the "2 points per slot per month" figure in R2 and the US-against-Israel ratio in R3 assume equal other inputs. A live probe of `capacity.monthlyPoints` and of the programme lists at day 0 and month 12 would settle both.
- **Seed profiles and readiness** (`M3` profiles and stages, `KUQ.byCountry[key].domains`). **Scope:** I read how they are used (`OUQ`, `zUQ`, `O7B`), not their values. So the built-in, research-free drift from day 0 is not measured: stage-2 and stage-3 nodes seeded at 0.07-0.93 keep diffusing toward the ceiling, and where readiness is below the ceiling, deployment converges up to it.
- **Learning by doing** `$dB@16195379` (`(experience/(prod0 x UIA))^zwg[good]`) and the absorption factor `y2A@14722114` / `mLA@14721652` / `k2A`. **Scope:** I read the formulas only, not `zwg`, `UIA`, the experience update or `k2A`. Absorption inputs are covered in sections 4 and 5.
- **AI licence choice `$7B`, need weights `n6C`, the goal map `E6C`.** **Scope:** I read `L0B`, `m0B` and `E6C`. I did not read `$7B` or `n6C`, so how often AI countries take free licences (R5's scale in AI play) is unknown.
- **Military `equipmentModel` effects** (`vH`, `l8A`, `baseline.equipmentModels`) and the space `domainCredits` source `HPA@87829333`. **Scope:** I saw the call sites only, not the bodies.
- **Whether the fixed base `rdIntensity` has any economic cost** (for example a GDP share withheld from firms). **Scope:** `refs rdIntensity` shows only the setup write, `C2`, `c6C` and a UI panel. I did not search the CGE for an R&D cost line.
