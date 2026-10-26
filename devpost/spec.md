---
doc: spec
status: approved
---

# ScorecardLab — Technical Spec

## How This Works, In Plain Language

The page is a React app that runs entirely in the browser. A small TypeScript engine turns each numeric column into bins. It first slices the column into fine pre-bins, runs pool-adjacent-violators so the event rate only moves one way, then merges bins that are too small or too numerous. Dragging a cut asks that same engine for the nearest legal partition, so the curve cannot end up non-monotonic or full of tiny bins.

Statistics the page shows — Weight of Evidence, Information Value, points, KS, Gini, AUC — are computed from those bins and from the row scores. Nothing on screen is a pasted sample figure.

There is no server, no account, and no Python process. A server or a WASM module would keep the same math for larger files, and this version does not need either for a file that fits in the tab. The header chip says JS and the measured milliseconds so it does not claim a runtime it is not using.

## The Core Journey Through the System

PRD ref: `prd.md > The Core Journey`.

1. The app starts → `demo.ts` builds about 25,000 seeded rows → `scorecard.ts` pre-bins six features, auto-bins them, and scores every row → Binning Studio renders the winner.
2. The user picks a name in the IV list → React stores the active feature → the chart and ledger read that feature's bins.
3. The user drags a cut → the chart sends the requested edge → `binning.ts` projects it → points and KS are recomputed → the ledger, the strip, and the separation panel render the new model.
4. Merge, split, isotonic, or auto-bin → the same projection and merge functions → the same render path.
5. The user edits PDO, base score, or odds → `stats.ts` rescales points on the existing bins → row scores and KS refresh. Cuts stay put.
6. The user opens Diagnostics, Points, or Frontier → the same model, a different view. Frontier applies the threshold to the score array.
7. Export → `export.ts` serializes the current bins and downloads a file.
8. CSV upload → `csv.ts` checks encoding limits, the target, and the columns → on success the demo model is replaced; on failure a message shows and the current model stays.

## Stack

- TypeScript — the language of the UI and the engine. https://www.typescriptlang.org/docs/
- React 18 — the screen is a component tree over one in-memory model. https://react.dev/
- Vite — dev server and build. https://vite.dev/guide/
- Tailwind CSS 3 — the visual reference is Tailwind utility tokens, so the same class names can be used. https://v3.tailwindcss.com/docs/configuration
- Vitest — unit tests for the engine. https://vitest.dev/guide/

React is the choice recorded for this build. Svelte was the other option in the specification. The tradeoff accepted: a React tree is a little more ceremony than Svelte, and it matches the utility-markup screen without introducing a second chart library.

Charts are custom SVG, the same kind of drawing as the reference screen. Plotly and Vega are not used. The tradeoff: more drawing code, one visual language.

No Pyodide, no WASM binning module, no FastAPI service. Unverified until the build runs it: drag time on 25,000 rows. The build measures it.

## Where It Runs and How Someone Tries It

The app runs in the user's browser on their machine. Requirements: Node.js and npm. No API keys.

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`). The studio is populated immediately. Drag a cut on the chart, then use the header to open the other three sections.

`npm test` runs the engine unit tests.

Submission requires a short demo video and a public GitHub repository. Neither is part of this build. Deployment is not chosen. `6-ship` is out of scope for this task: no GitHub push and no video script.

## Look and Feel

Carried from `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`.

Palette from the reference tokens: surface `#f9f9ff`, ink `#141b2b`, cobalt `#0037b0` and `#1d4ed8`, coral `#802500` and `#a83300`, hairline `#c4c5d7`, secondary ink `#515f74`. Population marks use cobalt. The WoE step uses coral. No extra accent colors.

Type: Newsreader for the mark and the active variable, Hanken Grotesk for UI, JetBrains Mono for numbers. Labels are small, wide-tracked capitals. Radius stays at the token values (2px, 4px, 8px); the studio uses the sharp end. Density is a full-viewport editorial tool: fixed masthead, three columns, ledger, points strip, footer. Copy is short and literal. Interface text does not call the session record a certification and does not call the engine WASM.

Tailwind can honor these tokens directly. It cannot load the fonts by itself; the page links Hanken Grotesk, Newsreader, JetBrains Mono, and Material Symbols, with system stacks behind them if the request fails.

## Components

### Studio shell

Header, editorial variable band, three columns, points strip, and footer. Switches the four sections without leaving the chrome.

PRD ref: `prd.md > Screens and Layout`.

### Binning engine

Pre-bin, pool-adjacent-violators, merge for minimum size and maximum bin count, and projection of a dragged cut onto the nearest strictly monotonic feasible partition. Chooses increasing or decreasing from the feature's own association and keeps that direction.

PRD ref: `prd.md > Binning Studio`.

### WoE chart

SVG population bars and a WoE step, with draggable interior cuts. While a drag is in progress, the parent projects and redraws. The handle shows the projected cut, not an illegal one.

PRD ref: `prd.md > Binning Studio`.

### Partition ledger

Renders the active feature's bins, including a missing bin when missing values are common enough to stand alone.

PRD ref: `prd.md > Binning Studio`.

### Scorecard scaling

`factor = PDO / ln(2)`. `offset = baseScore − factor × ln(odds)`. Each bin's points are `offset / n − factor × WoE`, where `n` is the number of variables in the card, so a row's points sum to `offset − factor × Σ WoE`. Contribution is the `−factor × WoE` term. Defaults: PDO 20, base score 600, odds 50:1.

PRD ref: `prd.md > Constraints and scaling` and `prd.md > Scorecard Points`.

### Model diagnostics

KS, AUC, and Gini on the summed points, plus the KS curve and the score silhouette. KS is the maximum gap between the cumulative event and non-event distributions. Gini is `2 × AUC − 1` from the ROC area, with ties scored as half.

PRD ref: `prd.md > Model Diagnostics`.

### Economic frontier

Histogram of the summed score, threshold controls, approval rate, accepted event rate, and profit. Accepted rows are those with score at or below the threshold.

PRD ref: `prd.md > Frontier and Economic Impact`.

### CSV ingest

UTF-8 text, up to 50,000 data rows and 30 columns. The user designates a binary target (0/1 or two distinct labels). Only numeric features are binned. Warnings for missingness, constant columns, and extreme skew. Empty, unreadable, non-binary, and oversize files fail visibly.

PRD ref: `prd.md > CSV ingest`.

### Presets and local recall

Two presets in `localStorage`: spec defaults, and a stricter minimum bin (10 percent, maximum 4 bins). Last constraints and, for the demo dataset, last cuts are recalled locally. Uploaded row data is not stored.

PRD ref: `prd.md > Presets` and `prd.md > States and Boundaries`.

### Exports

Downloads: cut-points JSON, cut-points CSV, points CSV, a Python snippet that applies the same cuts and points, and a session record JSON with an explicit notice that it is not a regulatory certification.

PRD ref: `prd.md > Export`.

## Data Model

In-memory columnar state. No server session.

- **Dataset** — name, target name, `Uint8Array` of 0/1 outcomes, and one `Float64Array` per numeric feature (`NaN` = missing). Lives for the tab session. Replaced on a successful upload. The demo is regenerated from a fixed seed, so it is the same every load.
- **Prepared feature** — fine cells (counts of events and non-events between edges) and the chosen direction. Rebuilt when the dataset changes, not on each drag.
- **Bin definition** — ordered numeric bins plus an optional missing bin. A missing bin is kept when missing rows are at least the minimum bin size; otherwise those rows join the nearest numeric bin whose rate still leaves the sequence strictly monotonic.
- **Scaling and constraints** — the numbers in the constraint panel. Updated by inputs and presets. Recalled from `localStorage`.
- **Scorecard** — for each of the top six features, bins with WoE, IV, and points; the row score array; KS, AUC, Gini; histogram and KS curve. Replaced as a whole after each edit.
- **Economic inputs** — thresholds, profit per good, loss per bad. Not part of the scorecard math. Lost on refresh except where the small session blob includes the thresholds.

Leaving and coming back: demo rows are recreated; saved demo cuts are reapplied if present. Uploaded rows are gone unless the user still has the file.

## File Structure

```
scorecardlab/
├── index.html                 # fonts, root node
├── package.json
├── vite.config.ts
├── tailwind.config.js         # tokens from the visual reference
├── postcss.config.js
├── tsconfig.json
├── .gitignore                 # ignores devpost/learner-profile.md and .env
├── devpost/
│   ├── learner-profile.md     # local only, gitignored
│   ├── scope.md
│   ├── prd.md
│   ├── spec.md
│   └── checklist.md
├── scripts/
│   └── browser-pass.mjs       # load, drag, sections, upload, export
└── src/
    ├── main.tsx
    ├── App.tsx                # chrome and section switch
    ├── index.css
    ├── engine/
    │   ├── types.ts
    │   ├── stats.ts           # WoE, IV, points, KS, AUC
    │   ├── binning.ts         # pre-bin, PAV, merge, projection
    │   ├── demo.ts
    │   ├── csv.ts
    │   ├── scorecard.ts       # dataset to model
    │   ├── export.ts
    │   └── metrics.test.ts
    └── ui/
        ├── Header.tsx
        ├── BinningStudio.tsx
        ├── WoeChart.tsx
        ├── Diagnostics.tsx
        ├── PointsView.tsx
        └── Frontier.tsx
```

## External Services and Dependencies

None for data. Fonts and Material Symbols are requested from Google Fonts at page load. If they fail, the stacks in the Tailwind config still render. No API keys, no database, no hosting, no rate limit.

- Google Fonts CSS: `https://fonts.googleapis.com` — display only, no payload of user data beyond the font request itself.

## Important Failure Modes

- **The drag lands on an illegal partition** → projection returns the nearest feasible cuts, or the previous bins if nothing feasible exists. The user never sees a non-monotonic ledger.
- **The CSV cannot be used** → an error in the studio chrome; the dataset already on screen stays.
- **A calculation exceeds 150 ms** → the engine chip shows a short recalculating label. Under that, it only shows JS and the milliseconds.

## What Was Simplified and Why

- **TypeScript in the page** instead of a Python service or Pyodide — the proof is the interactive loop on a file that fits, and a second runtime would hide that loop behind a startup cost. The fuller version would add a server path for larger files.
- **Univariate points, offset split across variables** instead of a fitted logistic regression — regression is explicitly cut. The formula still uses the specification's PDO, base score, and odds.
- **Custom SVG** instead of Plotly or Vega — the screen already has one visual language.
- **Two built-in presets** instead of a preset library — the product decision was not to invent one.
- **Session record JSON** instead of a regulatory dossier or PMML — those were cut. The control can still say Dossier because that is the screen's control; the file says it is a session record.

Sample data is seeded and then run through the real engine. The kernel is not faked.

## Decisions and Open Issues

- React, Vite, TypeScript, Tailwind — learner-side materials allowed React or Svelte; the skill answers choose React. Tradeoff: more familiar component structure, more boilerplate than Svelte.
- Client-side TypeScript engine — the specification preferred client-side binning and also mentioned WASM or Pyodide. This build uses plain TypeScript. Tradeoff: no native solver, easier tests, and an honest engine label.
- Charts are custom SVG — implementation detail that follows the "one visual language" decision.
- Points use `offset / n − factor × WoE` so the row sum matches `offset − factor × Σ WoE`. The offset is applied once across the card, not once per bin. Tradeoff: a single variable's points are not themselves equal to the full offset; the total score is the quantity the formula names.
- Acceptance is `score <= threshold` because the minus sign makes higher points riskier. Tradeoff: the economic view must say so, or a reader will assume a FICO-style high score is safer.
- Missing values become their own bin only when they meet the minimum size; otherwise they join the nearest bin that preserves strict monotonicity. Implementation of the specification's special-value rule.

They did not name an uncertainty. None is invented as a learning exercise. The open build risk is drag latency: measure a 25,000-row drag, and if it exceeds 100 ms, pre-bin once and rescore from those aggregates. Evidence lives in the engine timing chip and the build notes under `checklist.md > Revisions`.

No open product questions are carried from `prd.md > Open Questions`.

## Approval

Approved by the learner's instruction: "answer all the qns from the skills with the best of ur knowledge and build the app please," together with the supplied specification and Binning Studio screen. No further sign-off.
