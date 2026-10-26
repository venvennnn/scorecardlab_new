# ScorecardLab

ScorecardLab is a browser-based tool for building a monotonic Weight-of-Evidence scorecard. Load a binary dataset, adjust numeric cut-points by hand, and export the points table.

## What it does

The app runs entirely in the browser. It opens on a seeded demo dataset, bins numeric features, and lets you drag cuts, merge, split, or auto-bin while keeping event rates strictly monotonic. Four sections share the same scorecard: Binning Studio, Model Diagnostics, Scorecard Points, and Frontier & Economic Impact. You can replace the demo with a UTF-8 CSV (binary target, numeric columns) and download cut-points, the points table, a Python snippet, or a session record.

## Prerequisites

- Node.js
- npm

## Install and run

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173). The studio is populated immediately.

```bash
npm run build
npm test
```

`npm run build` typechecks and builds the production bundle. `npm test` runs the engine unit tests.

## Planning documents

`scope.md`, `prd.md`, and `spec.md` live in the `devpost/` folder.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
