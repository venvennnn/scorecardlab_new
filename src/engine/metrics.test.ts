import { describe, expect, it } from "vitest"
import { autoRanges, projectRanges, segmentOf } from "./binning"
import { buildDemoDataset } from "./demo"
import { allocatePoints, factorOf, offsetOf, woeAndIv } from "./stats"
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
  })

  it("gives a riskier bin more points when WoE falls", () => {
    const safe = allocatePoints(1.2, 6, scaling)
    const risky = allocatePoints(-0.4, 6, scaling)
    expect(risky.points).toBeGreaterThan(safe.points)
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
