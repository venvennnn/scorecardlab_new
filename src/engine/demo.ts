import type { Dataset } from "./types"

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randn(rng: () => number): number {
  const u = Math.max(1e-12, rng())
  const v = Math.max(1e-12, rng())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function poisson(rng: () => number, lambda: number): number {
  const limit = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rng()
  } while (p > limit && k < 40)
  return k - 1
}

const ROWS = 25000

export function buildDemoDataset(): Dataset {
  const rng = mulberry32(20261026)
  const util = new Float64Array(ROWS)
  const dti = new Float64Array(ROWS)
  const delinq = new Float64Array(ROWS)
  const inq = new Float64Array(ROWS)
  const income = new Float64Array(ROWS)
  const lines = new Float64Array(ROWS)
  const y = new Uint8Array(ROWS)
  let events = 0

  for (let i = 0; i < ROWS; i++) {
    const u = Math.min(1.85, Math.exp(randn(rng) * 0.55 - 1.15))
    const d = Math.min(0.95, Math.exp(randn(rng) * 0.32 - 1.25))
    const dq = poisson(rng, 0.42)
    const iq = poisson(rng, 0.85)
    const inc = 10.85 + randn(rng) * 0.42
    const ln = Math.max(1, Math.round(10 + randn(rng) * 4.2))
    const z =
      -2.15 +
      3.1 * (u - 0.28) +
      2.2 * (d - 0.28) +
      0.62 * dq +
      0.34 * iq -
      0.95 * (inc - 10.85) +
      0.035 * (ln - 10)
    const p = 1 / (1 + Math.exp(-z))
    const bad = rng() < p ? 1 : 0
    util[i] = u
    dti[i] = d
    delinq[i] = dq
    inq[i] = rng() < 0.03 ? Number.NaN : iq
    income[i] = inc
    lines[i] = ln
    y[i] = bad
    events += bad
  }

  return {
    id: "german_credit_25k",
    name: "german_credit_25k",
    target: "default_flag",
    rowCount: ROWS,
    y,
    features: [
      { name: "revolving_utilization_pct", values: util },
      { name: "debt_to_income_ratio", values: dti },
      { name: "delinquency_2yr_count", values: delinq },
      { name: "inquiries_last_6m", values: inq },
      { name: "annual_income_log", values: income },
      { name: "total_credit_lines", values: lines },
    ],
    issues: [
      {
        level: "warning",
        message: `inquiries_last_6m is about 3% missing — below the minimum bin, so those rows join the nearest bin. Demo default rate ${(events / ROWS).toFixed(3)}.`,
      },
    ],
  }
}
