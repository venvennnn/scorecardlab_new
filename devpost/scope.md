---
doc: scope
status: approved
---

# ScorecardLab

A single-user browser tool for building a monotonic Weight-of-Evidence scorecard: load a binary dataset, adjust numeric cut-points by hand, and export the points table.

Source: the specification's overview, users, and the Binning Studio screen.

## The Unique Kernel

Drag an interior cut-point and the app projects the partition back to a strictly monotonic Weight-of-Evidence curve, then refreshes bin statistics, the points table, and KS, Gini, and AUC together. That live, constrained edit is the thing a reviewer should remember.

## Who It's For

Credit-risk analysts, medical-risk modelers, and data scientists iterating binning outside a notebook. The session they described: load a hospital-readmission or SME-default file, accept or tweak the top six variables, export the points table and cut-points.

## The Core Loop

They open the studio on a binary dataset, look at the strongest numeric variables, drag or merge a cut until the bins read the way they want, watch separation move, and export cuts and points. They come back the next time a file needs a first scorecard without a notebook.

## Inspiration & Identity

The Binning Studio screen is the identity. Sharp, editorial, Swiss-modern. Hanken Grotesk, Newsreader, JetBrains Mono, and Material Symbols. Cobalt and coral only the way that screen uses them. Hairline rules, sharp corners. The Tailwind tokens in `ui-reference.html` are the palette. No second visual language.

## Why This Matters to the Learner

Not established. The stated aim is to get ScorecardLab working. No personal stake was given, and none is invented.

## What "Working" Looks Like

Load a realistic binary dataset, obtain monotonic bins for the top variables, manually improve at least one variable by dragging, watch KS move, and export a usable points table, inside a five-minute session, without leaving the browser.

The moment that shows it: a cut moves, the event-rate sequence stays strictly monotonic, and the points and KS change with it.

## The POC Boundary

CSV ingest, numeric-only monotonic binning, top six variables, drag with monotonic projection, merge and split, scorecard scaling, KS and Gini, one decision and economic view, export of cut-points, the points table, and a small Python snippet. A seeded demo dataset so the studio is populated on first load. Optional local recall of the last session, kept small.

## Later

A server path for files that do not fit in the browser.

## Explicitly Cut

Named from the specification's section 8:

- Categorical grouping — v1 bins numeric features only.
- Multi-class targets — the scorecard is binary.
- Population stability — not needed to prove the drag-and-project loop.
- Correlation pruning — ranking is univariate IV only.
- Fitting a full logistic regression inside the app — points come from the WoE scaling formula, then leave via export.
- Multi-user collaboration — one person, one browser.
- Audit logging — no model-risk platform.
- Regulatory documentation generation — the dossier control downloads a plain session record and is not a certification.

## Approval

Approved by the learner's instruction: "answer all the qns from the skills with the best of ur knowledge and build the app please," together with the supplied specification and Binning Studio screen. No further sign-off.
