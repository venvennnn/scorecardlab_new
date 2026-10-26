---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

The learner asked for the questions to be answered and the app to be built, and not to stop for approval. Fast mode verifies each slice with a command or a browser check and commits it. Hands-on evidence is that browser pass, not a pause to ask them to try a slice.

Approved by the learner's instruction: "answer all the qns from the skills with the best of ur knowledge and build the app please," together with the supplied specification and Binning Studio screen.

## Slices

- [x] **1. The studio opens on a computed scorecard**
  Becomes usable: A running Binning Studio, laid out like the screen, filled from the seeded demo, with real WoE, IV, and points on the active variable.
  Why now: The kernel needs a visible scorecard before a drag can mean anything. Scaffold, demo data, and the engine land inside this slice.
  PRD ref: `prd.md > The Core Journey` (steps 1-3), `prd.md > Screens and Layout`, `prd.md > Binning Studio`
  Spec ref: `spec.md > Studio shell`, `spec.md > Binning engine`, `spec.md > File Structure`
  Build: Scaffold Vite, React, TypeScript, and Tailwind with the reference tokens. Seed the demo dataset. Pre-bin, run isotonic binning, and render the header, variable band, IV list, chart, ledger, separation summary, points strip, and footer from those results. Switching the active variable loads its bins.
  Verify (mechanical): `npm test` for WoE, IV, and points. Dev server at `http://localhost:5173/` renders `revolving_utilization_pct` with computed IV 0.346 and no page error. Engine chip reads JS and a measured millisecond count.
  Learner check: Open the app and see Binning Studio populated, then choose another variable and see its ledger replace the center. Agent browser pass: switching to `debt_to_income_ratio` replaced the active name.
  Commit: `Add the binning engine and seeded demo`

- [x] **2. A dragged cut stays monotonic**
  Becomes usable: Drag, merge, split, isotonic, and auto-bin update the ledger and the points, and the event rates stay strictly monotonic.
  Why now: This is the kernel. It should land as soon as there is a scorecard to edit.
  PRD ref: `prd.md > Binning Studio`
  Spec ref: `spec.md > Binning engine`, `spec.md > WoE chart`, `spec.md > Partition ledger`
  Build: Project a dragged cut onto the nearest feasible partition. Wire merge, split, isotonic PAV, and auto-bin through the same constraints. Refresh points and KS.
  Verify (mechanical): `npm test` covers monotonic projection, minimum bin size, and a demo drag under 150 ms. Browser: drag changed the ledger; merge 5 → 4; split 4 → 5; auto-bin 5 rows; isotonic 6 rows. Event-rate sequence stayed increasing. KS moved (0.343 → 0.337 on the sampled drag).
  Learner check: Drag an interior cut and confirm the curve does not break; merge or split and watch the ledger change.
  Commit: `Add the studio, constrained edits, and the other sections`

- [x] **3. Scaling, diagnostics, and the economic view**
  Becomes usable: Constraint and scaling edits rescore the card. Model Diagnostics, Scorecard Points, and Frontier & Economic Impact show the same model.
  Why now: The drag already refreshes KS. These sections give that number room, and scaling has to be real before export.
  PRD ref: `prd.md > Constraints and scaling`, `prd.md > Model Diagnostics`, `prd.md > Scorecard Points`, `prd.md > Frontier and Economic Impact`
  Spec ref: `spec.md > Scorecard scaling`, `spec.md > Model diagnostics`, `spec.md > Economic frontier`
  Build: Editable constraints and scaling. Diagnostics curve and silhouette. Full points table. Frontier thresholds, approval, accepted event rate, and profit.
  Verify (mechanical): Points unit test. Browser: diagnostics KS matched the studio figure; PDO 20 → 40 changed the points table; threshold move changed approval from 70.0% to 64.8% and profit from 101,800 to 177,000.
  Learner check: Change PDO and see points move, then open Frontier and move the threshold.
  Commit: `Add the studio, constrained edits, and the other sections`

- [x] **4. CSV, presets, and exports**
  Becomes usable: A CSV can replace the demo, presets recall the two constraint sets, and the export controls download real files.
  Why now: The loop is already visible; this slice closes ingest and the way out.
  PRD ref: `prd.md > CSV ingest`, `prd.md > Presets`, `prd.md > Export`
  Spec ref: `spec.md > CSV ingest`, `spec.md > Presets and local recall`, `spec.md > Exports`
  Build: CSV validation, target choice, numeric-only binning, the two presets, local recall of demo cuts, and the five downloads. The session record states that it is not a regulatory certification.
  Verify (mechanical): Browser pass uploaded a 400-row CSV, warned that `city` is not numeric, rejected an empty file and kept `german_credit_25k`, applied the 10% preset, and downloaded `scorecard-ok-session-record.json` containing “Not a regulatory certification.”
  Learner check: Upload a CSV, apply the stricter preset, and download the points table.
  Commit: `Add the studio, constrained edits, and the other sections`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 2, by the agent browser pass. The learner instructed the build not to stop and ask. The pass is recorded above; the learner did not click through.
- [ ] Final kick-the-tires exploration and feedback completed — agent browser pass across the core journey after slice 4. The learner was not asked to click through.

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

The learner's instruction was not to stop for a confirmation. This box stays open until they say so. Agent verification is not their sign-off.

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: not a live tour. Desired learning outcome is not established, and the learner said not to interview. The map is a reference route only.
Route and stops: reference only — `src/ui/WoeChart.tsx` `startDrag`, `src/engine/binning.ts` `projectRanges`, `src/engine/scorecard.ts` `dragCut`. Not walked with the learner.
Edit outcome: not applicable
Reflection: not offered — the instruction was not to ask
Activity mode: reference map, not a live tour

## Revisions

- Drag-to-update on the 25,000-row demo stays under the 100 ms aim. A unit drag measured under 150 ms, and the header chip showed about 9–46 ms for a rescore. Pre-bin aggregates are built once; a drag only re-projects cuts and rescores.
- The supplied `ui-reference.html` body is a short marker. The studio follows section 3-prd of the skill answers and the Tailwind tokens in that file, not a second visual system.
- Slices 2–4 share one interface commit. The engine and the seeded demo are the commit before it. Each slice’s behavior was still verified on its own before the checklist was ticked.
- Offset is split across the variables in the card so a row sums to `offset − factor × Σ WoE`. The spec’s per-bin formula is the sum, not an offset repeated on every variable.
- Higher points are riskier, so Frontier accepts scores at or below the threshold. The page says so.
