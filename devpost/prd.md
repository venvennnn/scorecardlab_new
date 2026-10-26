---
doc: prd
status: approved
---

# ScorecardLab — Product Requirements

A local browser studio where a credit-risk analyst, medical-risk modeler, or data scientist turns a binary dataset into a monotonic Weight-of-Evidence scorecard and exports the points.

Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`, `scope.md > The Core Loop`.

## The Core Journey

1. They open the app and see Binning Studio already populated from the demo dataset `german_credit_25k`, target `default_flag`, laid out like the Binning Studio screen.
2. The left rail ranks variables by Information Value. The strongest variable is open: its chart, partition ledger, and points are on screen, and every IV, WoE, rate, and point was computed.
3. They choose another variable. Its bins, chart, and ledger replace the center.
4. They drag an interior cut. The curve stays strictly monotonic. WoE, event rate, counts, IV, points, and the KS summary refresh together.
5. They use Merge Adjacent, Split Cutpoint, Isotonic PAV, or Auto-Bin. Bins change and still respect minimum size and monotonicity.
6. They change PDO, base score, or odds. Points rescale.
7. They open Model Diagnostics and read the KS curve, AUC, Gini, and score distribution.
8. They open Scorecard Points and read the full table: variable, interval, WoE, points, contribution.
9. They open Frontier & Economic Impact, move a threshold, and read approval rate, accepted event rate, and profit from the profit-per-good and loss-per-bad figures they supplied.
10. They export cut-points, the points table, a Python snippet, or the session record, or they upload a CSV and repeat the loop.

Source: `scope.md > What "Working" Looks Like`.

## Screens and Layout

One chrome, four sections. The first screen is Binning Studio.

Fixed header: ScorecardLab mark, dataset `german_credit_25k`, target `default_flag`, engine timing, navigation `01 Binning Studio` / `02 Model Diagnostics` / `03 Scorecard Points` / `04 Frontier & Economic Impact`, Presets, Export, profile mark.

Editorial header for the active variable with IV, Gini, monotonicity, and max divergence. Actions: Merge Adjacent, Split Cutpoint, Isotonic PAV, Auto-Bin.

Left: IV-ranked variables and mathematical constraints. Center: WoE versus population chart with draggable cuts, then the partition ledger. Right: model separation, KS, score silhouette, export artifacts. Bottom: points allocation for the six variables. Footer as a quiet closing bar in the same type and color.

The other three sections keep that header and footer.

- Model Diagnostics gives the KS curve, AUC, Gini, and score distribution room of their own.
- Scorecard Points is the full points table.
- Frontier & Economic Impact is the score histogram or cumulative distribution, one or more thresholds, approval rate, expected event rate in the accepted population, and profit.

No other screens. CSV problems and the target choice appear inside this chrome.

## Look and Feel

The Binning Studio screen is the look. Hanken Grotesk for interface text, Newsreader for the mark and the variable name, JetBrains Mono for figures, Material Symbols for icons. The Tailwind color, type, radius, and spacing tokens in the visual reference. Sharp corners, hairline rules, cobalt and coral used the way the screen uses them. Dense and editorial, not a generic card dashboard. Do not restyle it. Sample figures in the reference are structure, not numbers to copy.

## Features and Behavior

### Binning Studio

The studio opens on computed bins for the active variable. The chart plots population and Weight of Evidence with interior cuts the user can drag. On drag, cuts project to the nearest feasible partition whose event rates stay strictly monotonic and whose bins meet the minimum size. The ledger shows each bin's interval, count, events, event rate, WoE, IV, and points. The bottom strip shows points for the six variables.

- [ ] Opening the app shows the studio populated from the demo dataset, in this layout.
- [ ] Choosing a variable loads its bins, chart, and ledger.
- [ ] Dragging a cut updates WoE, event rate, counts, IV, points, and the KS summary.
- [ ] After a drag, the event-rate sequence is strictly monotonic.
- [ ] Merge, split, isotonic, and auto-bin change the bins and respect minimum size and monotonicity.

Source: `scope.md > The Unique Kernel`.

### Constraints and scaling

The constraint panel holds minimum bin size (default 5 percent), maximum bins, Laplace smoothing (default 0.5), PDO (default 20), base score (default 600), and odds (default 50:1). Changing PDO, base score, or odds rescales points. Changing size or bin limits rebuilds feasible bins.

- [ ] Changing PDO, base score, or odds changes the points.
- [ ] Bins shown after a constraint change still meet the minimum size.

### Model Diagnostics

A dedicated view of the KS curve, AUC, Gini, and the score distribution for the current scorecard.

- [ ] The diagnostics figures match the separation summary on the studio for the same bins.

### Scorecard Points

The full table lists variable, interval, WoE, points, and contribution to the total score.

- [ ] Every bin from the six variables appears, with the points produced by the current scaling.

### Frontier and Economic Impact

A score histogram with one or more thresholds. The user supplies profit per good account and loss per bad account. The view shows approval rate, event rate in the accepted population, and profit. Higher points mean a riskier bin, because points fall as Weight of Evidence rises, so acceptance is the safer side of the threshold: scores at or below it.

- [ ] Moving a threshold changes approval rate, accepted event rate, and profit.

### Presets

The header control stores and recalls constraint and scaling presets in the browser: the spec defaults, plus a stricter minimum-bin preset. No preset library beyond that.

- [ ] Choosing the stricter preset changes the minimum bin size and the bins honor it.
- [ ] Choosing the spec defaults restores PDO 20, base score 600, odds 50:1, and a 5 percent minimum bin.

### Export

Cut-points download as JSON and as CSV. The points table downloads as CSV. A small Python snippet applies the same cuts and points. The dossier control stays on the screen and downloads a plain session record of the actual bins and metrics. The file is not described as a regulatory certification.

- [ ] Each export downloads a file built from the current bins.
- [ ] The session record does not call itself a regulatory certification.

### CSV ingest

The user can replace the demo with a UTF-8 CSV, pick the binary target, and bin numeric columns only. The app warns on missingness, constant columns, and extreme skew.

- [ ] A valid numeric binary file replaces the demo and the studio fills from computed bins.
- [ ] An empty file, an unreadable file, a non-binary target, or a file past the size limit is rejected with a visible reason and does not pretend to bin.

## States and Boundaries

- **First use** — the demo dataset is loaded, about 25,000 rows, target `default_flag`, features `revolving_utilization_pct`, `debt_to_income_ratio`, `delinquency_2yr_count`, `inquiries_last_6m`, `annual_income_log`, and `total_credit_lines`, with a positive default relationship on utilization. The studio is never an empty shell on first paint.
- **Normal use** — six variables, one active, charts and tables showing computed values.
- **Empty or unreadable CSV** — a clear error in the chrome; the previous dataset stays.
- **Target not binary** — refused, with the reason.
- **Constant or all-missing columns** — skipped, with a warning.
- **Extreme skew** — binned anyway, with a warning.
- **File past the stated size** — refused. The stated size is about 50,000 rows and 30 columns.
- **Drag that would break monotonicity or the minimum bin size** — projected to the nearest feasible partition. The curve on screen is never left broken.
- **Slow calculation** — a short recalculating state only if a calculation takes longer than 150 ms.
- **What persists** — optional local recall of constraints, scaling, and, for the demo dataset, the last cuts. Uploaded rows are not written to a server. No accounts.
- **What disappears** — an uploaded file's rows disappear when the tab's memory does, unless the user exports.

## Product Decisions

- The Binning Studio screen is the layout and the visual system — it was supplied, so the build does not invent a different one.
- React with the screen's Tailwind tokens — the specification allowed React or Svelte; React keeps the utility-markup structure. Recorded in the skill answers.
- Client-side TypeScript binning, not a Python service and not Pyodide — the specification allowed a server or WASM path; this version stays in the browser. The engine chip shows the real runtime and must not say WASM.
- Top six variables by univariate IV — from the specification.
- Defaults: minimum bin 5 percent, Laplace 0.5, PDO 20, base score 600, odds 50:1 — from the specification.
- Two presets only: those defaults, and a stricter minimum-bin preset — do not invent a library.
- The dossier control downloads a session record and is not a certification — from the skill answers, because regulatory documentation is cut.
- Higher points are riskier, and the economic view accepts scores at or below the threshold — this follows the specification formula `Points = offset − factor × WoE` with WoE defined as `ln(% non-events / % events)`.
- Personal background was not invented. Where the specification left a choice, the skill answers are the decision.

## What We're Building

Everything in `scope.md > The POC Boundary`: CSV ingest, numeric monotonic binning, top six variables, drag with projection, merge and split, scaling, KS and Gini, one economic view, exports, a seeded demo, and small local recall.

## Deferred From the POC

A server path for files that do not fit in the browser. Source: `scope.md > Later`. It is out because the proof is the in-browser loop on a file that fits.

## Possible Later Enhancements

Categorical grouping once the numeric loop is the habit. A heavier optimal solver for users who ask for it. Neither is part of this proof.

## Non-Goals

From `scope.md > Explicitly Cut`: categorical grouping, multi-class targets, population stability, correlation pruning, a logistic regression inside the app, multi-user collaboration, audit logging, and regulatory documentation. Also out: PMML as a compliance artifact, accounts, and hosting. A public repository and a demo video are not part of this build.

## Open Questions

None that block the spec. They did not name an uncertainty. Drag-to-update time on the demo set is measured during the build; if a 25,000-row drag exceeds 100 ms, pre-bin first and only rescore affected aggregates. That investigation can happen during the build.

## Approval

Approved by the learner's instruction: "answer all the qns from the skills with the best of ur knowledge and build the app please," together with the supplied specification and Binning Studio screen. No further sign-off.
