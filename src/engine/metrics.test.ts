import { describe, expect, it } from "vitest"
import { autoRanges, projectRanges, segmentOf } from "./binning"
import { buildDemoDataset } from "./demo"
import { fitLogistic } from "./logistic"
import { allocatePoints, economicsAtRate, factorOf, offsetOf, profitCurve, woeAndIv } from "./stats"
import { buildScorecard, dragCut } from "./scorecard"
import type { FineCell } from "./types"
import { DEFAULT_SETTINGS } from "./types"

function cell(events: number, index: number, count = 100): FineCell {
  return {
    lo: index,
    hi: index + 1,
    events,
    nonEvents: count - events,
    count,
  }
}

function rates(fine: FineCell[], ranges: { l: number; r: number }[]): number[] {
  return ranges.map((range) => segmentOf(fine, range).rate)
}

describe("WoE and IV", () => {
  it("matches the Laplace formula and signs with the non-event share", () => {
    const rows = woeAndIv(
      [
        { events: 10, nonEvents: 90 },
        { events: 40, nonEvents: 10 },
      ],
      0.5,
    )
    const totalE = 51
    const totalNE = 101
    const woe0 = Math.log(90.5 / totalNE / (10.5 / totalE))
    const woe1 = Math.log(10.5 / totalNE / (40.5 / totalE))
    expect(rows[0].woe).toBeCloseTo(woe0, 10)
    expect(rows[1].woe).toBeCloseTo(woe1, 10)
    expect(rows[0].woe).toBeGreaterThan(0)
    expect(rows[1].woe).toBeLessThan(0)
    const iv = rows.reduce((sum, row) => sum + row.iv, 0)
    const hand =
      (90.5 / totalNE - 10.5 / totalE) * woe0 + (10.5 / totalNE - 40.5 / totalE) * woe1
    expect(iv).toBeCloseTo(hand, 10)
    expect(iv).toBeGreaterThan(0)
  })

  it("stays finite when a bin has no events", () => {
    const rows = woeAndIv(
      [
        { events: 0, nonEvents: 20 },
        { events: 10, nonEvents: 10 },
      ],
      0.5,
    )
    expect(rows.every((row) => Number.isFinite(row.woe) && Number.isFinite(row.iv))).toBe(true)
  })
})

describe("monotonic projection", () => {
  const fine = [10, 40, 15, 60, 80].map((events, index) => cell(events, index))

  it("moves an infeasible cut onto a strictly increasing partition", () => {
    const projected = projectRanges(fine, [2, 3], 1, 100)
    expect(projected).not.toBeNull()
    const got = rates(fine, projected!)
    for (let i = 1; i < got.length; i++) expect(got[i]).toBeGreaterThan(got[i - 1])
    for (const range of projected!) expect(segmentOf(fine, range).count).toBeGreaterThanOrEqual(100)
    expect(projected).toHaveLength(3)
  })

  it("keeps a partition that is already feasible", () => {
    const projected = projectRanges(fine, [1, 3], 1, 100)
    expect(projected).toEqual([
      { l: 0, r: 0 },
      { l: 1, r: 2 },
      { l: 3, r: 4 },
    ])
  })
})

describe("minimum bin size", () => {
  it("merges fine cells until every bin meets the minimum count", () => {
    const fine = Array.from({ length: 10 }, (_, index) => cell(8 + index, index, 30))
    const ranges = autoRanges(fine, 1, 50, 6, 2, 4)
    expect(ranges.length).toBeGreaterThan(0)
    expect(ranges.length).toBeLessThanOrEqual(6)
    for (const range of ranges) expect(segmentOf(fine, range).count).toBeGreaterThanOrEqual(50)
    const got = rates(fine, ranges)
    for (let i = 1; i < got.length; i++) expect(got[i]).toBeGreaterThan(got[i - 1])
  })
})

describe("points scaling", () => {
  const scaling = { pdo: 20, baseScore: 600, odds: 50 }

  it("uses PDO, base score, and odds", () => {
    const factor = 20 / Math.log(2)
    const offset = 600 - factor * Math.log(50)
    expect(factorOf(20)).toBeCloseTo(factor, 10)
    expect(offsetOf(scaling)).toBeCloseTo(offset, 10)
    const neutral = allocatePoints(0, 1, scaling)
    expect(neutral.points).toBeCloseTo(offset, 8)
    expect(neutral.contribution).toBeCloseTo(0, 8)
    const loaded = allocatePoints(1, 4, scaling)
    expect(loaded.contribution).toBeCloseTo(-factor, 8)
    expect(loaded.points).toBeCloseTo(offset / 4 - factor, 8)
    const shrunk = allocatePoints(1, 4, scaling, -0.5)
    expect(shrunk.contribution).toBeCloseTo(-0.5 * factor, 8)
  })

  it("gives a riskier bin more points when WoE falls", () => {
    const safe = allocatePoints(1.2, 6, scaling)
    const risky = allocatePoints(-0.4, 6, scaling)
    expect(risky.points).toBeGreaterThan(safe.points)
  })
})

describe("row score identity", () => {
  it("equals the sum of the matched bin points, which is offset + factor × Σ (β × WoE)", () => {
    const dataset = buildDemoDataset()
    const model = buildScorecard(dataset, DEFAULT_SETTINGS)
    const offset = offsetOf(DEFAULT_SETTINGS)
    const factor = factorOf(DEFAULT_SETTINGS.pdo)
    const row = 17
    let points = 0
    let weighted = 0
    for (const variable of model.variables) {
      const value = variable.values[row]
      let bin = variable.bins[variable.bins.length - 1]
      if (Number.isNaN(value)) {
        bin = variable.missingBin
          ? { ...variable.bins[0], ...variable.missingBin }
          : variable.bins[variable.foldedInto ?? variable.bins.length - 1]
      } else {
        let index = 0
        while (index < variable.bins.length - 1 && value > variable.bins[index].hi) index += 1
        bin = variable.bins[index]
      }
      points += bin.points
      weighted += variable.beta * bin.woe
    }
    expect(model.scores[row]).toBeCloseTo(points, 8)
    expect(points).toBeCloseTo(offset + factor * weighted, 5)
    expect(Number.isFinite(model.intercept)).toBe(true)
    expect(model.variables.every((variable) => Number.isFinite(variable.beta))).toBe(true)
  })
})

describe("acceptance economics", () => {
  it("accepts the requested share of the safest accounts", () => {
    const scores = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    const y = new Uint8Array([0, 0, 0, 0, 0, 1, 1, 1, 1, 1])
    const got = economicsAtRate(scores, y, 0.4, 100, 500)
    expect(got.accepted).toBe(4)
    expect(got.approval).toBeCloseTo(0.4)
    expect(got.events).toBe(0)
    expect(got.nonEvents).toBe(4)
    expect(got.profit).toBe(400)
    expect(got.randomProfit).toBeCloseTo(0.4 * (5 * 100 - 5 * 500))
    expect(got.delta).toBeGreaterThan(0)
  })

  it("profit at a fixed acceptance rate falls when ranking (AUC) gets worse", () => {
    const n = 200
    const y = new Uint8Array(n)
    const ranked = new Float64Array(n)
    const scrambled = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      y[i] = i >= 100 ? 1 : 0
      ranked[i] = i
      scrambled[i] = i < 100 ? i + 100 : i - 100
    }
    const good = economicsAtRate(ranked, y, 0.5, 100, 500)
    const bad = economicsAtRate(scrambled, y, 0.5, 100, 500)
    expect(good.approval).toBeCloseTo(0.5)
    expect(bad.approval).toBeCloseTo(0.5)
    expect(good.eventRate).toBeLessThan(bad.eventRate)
    expect(good.profit).toBeGreaterThan(bad.profit)
    expect(good.delta).toBeGreaterThan(bad.delta)
  })

  it("beats a random book on the demo scorecard at the same acceptance rate", () => {
    const dataset = buildDemoDataset()
    const model = buildScorecard(dataset, DEFAULT_SETTINGS)
    const got = economicsAtRate(model.scores, dataset.y, 0.7, 100, 500)
    expect(got.approval).toBeCloseTo(0.7, 3)
    expect(got.profit).toBeGreaterThan(got.randomProfit)
    const curve = profitCurve(model.scores, dataset.y, 100, 500)
    expect(curve).toHaveLength(21)
    const mid = curve[14]
    expect(mid.rate).toBeCloseTo(0.7)
    expect(mid.profit).toBeGreaterThan(mid.randomProfit)
  })
})

describe("logistic on selected WoE bins", () => {
  it("fits a negative coefficient when high WoE marks the non-event class", () => {
    const n = 400
    const X = new Float64Array(n)
    const y = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
      X[i] = i < 200 ? 1.2 : -1.1
      y[i] = i < 200 ? 0 : 1
    }
    const fit = fitLogistic(X, n, 1, y)
    expect(Number.isFinite(fit.intercept)).toBe(true)
    expect(fit.coef[0]).toBeLessThan(-0.2)
  })

  it("fits finite coefficients and keeps the requested feature subset", () => {
    const dataset = buildDemoDataset()
    const names = dataset.features.map((feature) => feature.name)
    const full = buildScorecard(dataset, DEFAULT_SETTINGS, undefined, names)
    expect(full.variables.map((variable) => variable.name)).toEqual(names)
    expect(full.auc).toBeGreaterThan(0.6)
    const dropped = names.filter((name) => name !== "total_credit_lines")
    const subset = buildScorecard(dataset, DEFAULT_SETTINGS, undefined, dropped)
    expect(subset.variables.map((variable) => variable.name)).toEqual(dropped)
    expect(subset.variables).toHaveLength(5)
    expect(Number.isFinite(subset.intercept)).toBe(true)
    expect(subset.variables.every((variable) => Number.isFinite(variable.beta))).toBe(true)
  })
})

describe("demo scorecard", () => {
  it("loads 25k rows and ranks utilization first, strictly increasing", () => {
    const dataset = buildDemoDataset()
    expect(dataset.rowCount).toBe(25000)
    expect(dataset.name).toBe("german_credit_25k")
    expect(dataset.target).toBe("default_flag")
    expect(dataset.features.map((feature) => feature.name)).toEqual([
      "revolving_utilization_pct",
      "debt_to_income_ratio",
      "delinquency_2yr_count",
      "inquiries_last_6m",
      "annual_income_log",
      "total_credit_lines",
    ])
    const model = buildScorecard(dataset, DEFAULT_SETTINGS)
    expect(model.variables[0].name).toBe("revolving_utilization_pct")
    expect(model.variables[0].direction).toBe(1)
    const eventRates = model.variables[0].bins.map((bin) => bin.eventRate)
    for (let i = 1; i < eventRates.length; i++) expect(eventRates[i]).toBeGreaterThan(eventRates[i - 1])
    expect(model.variables[0].iv).toBeGreaterThan(0)
    expect(model.auc).toBeGreaterThan(0.6)
    for (const variable of model.variables) {
      for (const bin of variable.bins) {
        expect(bin.count).toBeGreaterThanOrEqual(Math.ceil(0.05 * dataset.rowCount))
      }
    }
    const name = model.variables[0].name
    const before = model.variables[0].bins.map((bin) => bin.hi).join("|")
    const moved = dragCut(model, dataset, DEFAULT_SETTINGS, name, 0, model.variables[0].bins[0].hi * 0.45)
    const variable = moved.variables.find((item) => item.name === name)!
    const movedRates = variable.bins.map((bin) => bin.eventRate)
    for (let i = 1; i < movedRates.length; i++) expect(movedRates[i]).toBeGreaterThan(movedRates[i - 1])
    expect(variable.bins.map((bin) => bin.hi).join("|")).not.toBe(before)
    expect(moved.ms).toBeLessThan(150)
  })
})
