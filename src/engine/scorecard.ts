import {
  autoRanges,
  buildFine,
  chooseDirection,
  isotonicRanges,
  mergeOnce,
  projectRanges,
  segmentOf,
  splitOnce,
} from "./binning"
import { fitLogistic } from "./logistic"
import { allocatePoints, giniFromGroups, histogram, separation, woeAndIv, type HistBin } from "./stats"
import type { Dataset, FineCell, Range, Settings } from "./types"

export type NumericBin = {
  lo: number
  hi: number
  events: number
  nonEvents: number
  count: number
  eventRate: number
  woe: number
  iv: number
  points: number
  contribution: number
  foldedMissing: number
}

export type MissingBin = {
  events: number
  nonEvents: number
  count: number
  eventRate: number
  woe: number
  iv: number
  points: number
  contribution: number
}

export type VariableModel = {
  name: string
  values: Float64Array
  direction: 1 | -1
  monotonicity: "Strictly increasing" | "Strictly decreasing"
  fine: FineCell[]
  missing: { events: number; nonEvents: number; count: number }
  ranges: Range[]
  bins: NumericBin[]
  missingBin: MissingBin | null
  foldedInto: number | null
  iv: number
  gini: number
  maxDivergence: number
  beta: number
}

export type KsPoint = { t: number; events: number; nonEvents: number }

export type ScorecardModel = {
  variables: VariableModel[]
  scores: Float64Array
  ks: number
  auc: number
  gini: number
  ksAt: number
  curve: KsPoint[]
  histogram: { min: number; max: number; bins: HistBin[] }
  intercept: number
  ms: number
}

type Prepared = {
  name: string
  values: Float64Array
  fine: FineCell[]
  missing: { events: number; nonEvents: number; count: number }
  direction: 1 | -1
}

function minCountOf(rowCount: number, settings: Settings): number {
  return Math.max(1, Math.ceil(settings.minBinPct * rowCount))
}

function targetBins(settings: Settings): number {
  const preferred = 5
  return Math.min(settings.maxBins, Math.max(settings.minBins, preferred))
}

function materialize(prep: Prepared, ranges: Range[], settings: Settings, variableCount: number, rowCount: number): VariableModel {
  const minCount = minCountOf(rowCount, settings)
  const segments = ranges.map((range) => segmentOf(prep.fine, range))
  let foldedInto: number | null = null
  let missingBinRaw: { events: number; nonEvents: number; count: number } | null = null
  const foldedMissing = segments.map(() => 0)

  if (prep.missing.count >= minCount && prep.missing.count > 0) {
    missingBinRaw = { ...prep.missing }
  } else if (prep.missing.count > 0 && segments.length > 0) {
    const mRate = prep.missing.events / prep.missing.count
    let best = 0
    let bestDist = Infinity
    let fallback = 0
    let fallbackDist = Infinity
    for (let i = 0; i < segments.length; i++) {
      const dist = Math.abs(segments[i].rate - mRate)
      if (dist < fallbackDist) {
        fallbackDist = dist
        fallback = i
      }
      const rate = (segments[i].events + prep.missing.events) / (segments[i].count + prep.missing.count)
      const rates = segments.map((segment, j) => (j === i ? rate : segment.rate))
      let ok = true
      for (let j = 1; j < rates.length; j++) {
        const ordered = prep.direction === 1 ? rates[j] > rates[j - 1] : rates[j] < rates[j - 1]
        if (!ordered) {
          ok = false
          break
        }
      }
      if (ok && dist < bestDist) {
        bestDist = dist
        best = i
      }
    }
    const index = bestDist < Infinity ? best : fallback
    segments[index] = {
      ...segments[index],
      events: segments[index].events + prep.missing.events,
      nonEvents: segments[index].nonEvents + prep.missing.nonEvents,
      count: segments[index].count + prep.missing.count,
      rate:
        (segments[index].events + prep.missing.events) /
        (segments[index].count + prep.missing.count),
    }
    foldedMissing[index] = prep.missing.count
    foldedInto = index
  }

  const pieces = [
    ...segments.map((segment) => ({ events: segment.events, nonEvents: segment.nonEvents })),
    ...(missingBinRaw ? [missingBinRaw] : []),
  ]
  const woeRows = woeAndIv(pieces, settings.laplace)
  const bins: NumericBin[] = segments.map((segment, i) => {
    const stats = woeRows[i]
    const allocated = allocatePoints(stats.woe, variableCount, settings)
    return {
      lo: prep.fine[segment.l].lo,
      hi: prep.fine[segment.r].hi,
      events: segment.events,
      nonEvents: segment.nonEvents,
      count: segment.count,
      eventRate: stats.eventRate,
      woe: stats.woe,
      iv: stats.iv,
      points: allocated.points,
      contribution: allocated.contribution,
      foldedMissing: foldedMissing[i],
    }
  })
  let missingBin: MissingBin | null = null
  if (missingBinRaw) {
    const stats = woeRows[woeRows.length - 1]
    const allocated = allocatePoints(stats.woe, variableCount, settings)
    missingBin = {
      events: missingBinRaw.events,
      nonEvents: missingBinRaw.nonEvents,
      count: missingBinRaw.count,
      eventRate: stats.eventRate,
      woe: stats.woe,
      iv: stats.iv,
      points: allocated.points,
      contribution: allocated.contribution,
    }
  }
  const groups = bins.map((bin) => ({ score: bin.points, events: bin.events, nonEvents: bin.nonEvents }))
  if (missingBin) {
    groups.push({ score: missingBin.points, events: missingBin.events, nonEvents: missingBin.nonEvents })
  }
  const uni = giniFromGroups(groups)
  const woes = [...bins.map((bin) => bin.woe), ...(missingBin ? [missingBin.woe] : [])]
  const iv = woeRows.reduce((sum, row) => sum + row.iv, 0)
  return {
    name: prep.name,
    values: prep.values,
    direction: prep.direction,
    monotonicity: prep.direction === 1 ? "Strictly increasing" : "Strictly decreasing",
    fine: prep.fine,
    missing: prep.missing,
    ranges,
    bins,
    missingBin,
    foldedInto,
    iv,
    gini: uni.gini,
    maxDivergence: woes.length ? Math.max(...woes) - Math.min(...woes) : 0,
    beta: -1,
  }
}

function prepareAll(dataset: Dataset): Prepared[] {
  const prepared: Prepared[] = []
  for (const feature of dataset.features) {
    const built = buildFine(feature.values, dataset.y)
    if (built.cells.length === 0) continue
    prepared.push({
      name: feature.name,
      values: feature.values,
      fine: built.cells,
      missing: built.missing,
      direction: chooseDirection(built.cells),
    })
  }
  return prepared
}

function binPrepared(
  prep: Prepared,
  settings: Settings,
  variableCount: number,
  rowCount: number,
  want?: number[],
): VariableModel {
  const minCount = minCountOf(rowCount, settings)
  let ranges: Range[] | null
  if (want && want.length > 0) {
    ranges = projectRanges(prep.fine, want, prep.direction, minCount)
  } else {
    ranges = null
  }
  if (!ranges) {
    ranges = autoRanges(prep.fine, prep.direction, minCount, settings.maxBins, settings.minBins, targetBins(settings))
  }
  return materialize(prep, ranges, settings, variableCount, rowCount)
}

function scoreOf(variables: VariableModel[], rowCount: number): Float64Array {
  const scores = new Float64Array(rowCount)
  for (const variable of variables) {
    const cuts = variable.bins.slice(0, -1).map((bin) => bin.hi)
    const points = variable.bins.map((bin) => bin.points)
    const missingPoints =
      variable.missingBin != null
        ? variable.missingBin.points
        : variable.foldedInto != null
          ? points[variable.foldedInto]
          : points[points.length - 1] ?? 0
    const values = variable.values
    for (let i = 0; i < rowCount; i++) {
      const value = values[i]
      if (Number.isNaN(value)) {
        scores[i] += missingPoints
        continue
      }
      let lo = 0
      let hi = cuts.length
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (cuts[mid] >= value) hi = mid
        else lo = mid + 1
      }
      scores[i] += points[lo] ?? 0
    }
  }
  return scores
}

function woeAt(variable: VariableModel, value: number): number {
  if (Number.isNaN(value)) {
    if (variable.missingBin) return variable.missingBin.woe
    if (variable.foldedInto != null) return variable.bins[variable.foldedInto]?.woe ?? 0
    return variable.bins[variable.bins.length - 1]?.woe ?? 0
  }
  const cuts = variable.bins.slice(0, -1).map((bin) => bin.hi)
  let lo = 0
  let hi = cuts.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cuts[mid] >= value) hi = mid
    else lo = mid + 1
  }
  return variable.bins[lo]?.woe ?? 0
}

function remapPoints(variable: VariableModel, settings: Settings, variableCount: number, beta: number): VariableModel {
  const bins = variable.bins.map((bin) => {
    const allocated = allocatePoints(bin.woe, variableCount, settings, beta)
    return { ...bin, points: allocated.points, contribution: allocated.contribution }
  })
  let missingBin = variable.missingBin
  if (missingBin) {
    const allocated = allocatePoints(missingBin.woe, variableCount, settings, beta)
    missingBin = { ...missingBin, points: allocated.points, contribution: allocated.contribution }
  }
  return { ...variable, bins, missingBin, beta }
}

function withLogistic(
  variables: VariableModel[],
  dataset: Dataset,
  settings: Settings,
): { variables: VariableModel[]; intercept: number } {
  const n = dataset.rowCount
  const p = variables.length
  if (p === 0 || n === 0) return { variables, intercept: 0 }
  const X = new Float64Array(n * p)
  for (let j = 0; j < p; j++) {
    const values = variables[j].values
    for (let i = 0; i < n; i++) X[i * p + j] = woeAt(variables[j], values[i])
  }
  const fit = fitLogistic(X, n, p, dataset.y)
  return {
    intercept: fit.intercept,
    variables: variables.map((variable, j) => remapPoints(variable, settings, p, fit.coef[j] ?? -1)),
  }
}

function finish(dataset: Dataset, variables: VariableModel[], settings: Settings, started: number): ScorecardModel {
  const fitted = withLogistic(variables, dataset, settings)
  const scores = scoreOf(fitted.variables, dataset.rowCount)
  const sep = separation(scores, dataset.y)
  const hist = histogram(scores, dataset.y)
  return {
    variables: fitted.variables,
    scores,
    ks: sep.metrics.ks,
    auc: sep.metrics.auc,
    gini: sep.metrics.gini,
    ksAt: sep.metrics.ksAt,
    curve: sep.curve,
    histogram: hist,
    intercept: fitted.intercept,
    ms: performance.now() - started,
  }
}

export function buildScorecard(
  dataset: Dataset,
  settings: Settings,
  cuts?: Record<string, number[]>,
  selected?: string[],
): ScorecardModel {
  const started = performance.now()
  const prepared = prepareAll(dataset)
  const byName = new Map(prepared.map((prep) => [prep.name, prep]))
  let pool: Prepared[]
  if (selected && selected.length > 0) {
    pool = selected.map((name) => byName.get(name)).filter((prep): prep is Prepared => Boolean(prep))
  } else {
    pool = prepared
      .map((prep) => binPrepared(prep, settings, Math.min(6, prepared.length), dataset.rowCount, cuts?.[prep.name]))
      .sort((a, b) => b.iv - a.iv || a.name.localeCompare(b.name))
      .slice(0, 6)
      .map((variable) => ({
        name: variable.name,
        values: variable.values,
        fine: variable.fine,
        missing: variable.missing,
        direction: variable.direction,
      }))
  }
  if (pool.length === 0) pool = prepared.slice(0, 1)
  const variableCount = pool.length
  const variables = pool.map((prep) => binPrepared(prep, settings, variableCount, dataset.rowCount, cuts?.[prep.name]))
  if (!selected) variables.sort((a, b) => b.iv - a.iv || a.name.localeCompare(b.name))
  return finish(dataset, variables, settings, started)
}

function replaceVariable(
  model: ScorecardModel,
  next: VariableModel,
  dataset: Dataset,
  settings: Settings,
  started: number,
): ScorecardModel {
  const variables = model.variables.map((variable) => (variable.name === next.name ? next : variable))
  return finish(dataset, variables, settings, started)
}

function prepOf(variable: VariableModel): Prepared {
  return {
    name: variable.name,
    values: variable.values,
    fine: variable.fine,
    missing: variable.missing,
    direction: variable.direction,
  }
}

export function dragCut(
  model: ScorecardModel,
  dataset: Dataset,
  settings: Settings,
  name: string,
  cutIndex: number,
  value: number,
): ScorecardModel {
  const started = performance.now()
  const variable = model.variables.find((item) => item.name === name)
  if (!variable) return model
  const cuts = variable.bins.slice(0, -1).map((bin) => bin.hi)
  if (cutIndex < 0 || cutIndex >= cuts.length) return model
  cuts[cutIndex] = value
  const minCount = minCountOf(dataset.rowCount, settings)
  const ranges = projectRanges(variable.fine, cuts, variable.direction, minCount)
  if (!ranges) return { ...model, ms: performance.now() - started }
  const next = materialize(prepOf(variable), ranges, settings, model.variables.length, dataset.rowCount)
  return replaceVariable(model, next, dataset, settings, started)
}

export function applyMerge(model: ScorecardModel, dataset: Dataset, settings: Settings, name: string): ScorecardModel | null {
  const variable = model.variables.find((item) => item.name === name)
  if (!variable) return null
  const ranges = mergeOnce(variable.fine, variable.ranges)
  if (!ranges) return null
  const started = performance.now()
  const next = materialize(prepOf(variable), ranges, settings, model.variables.length, dataset.rowCount)
  return replaceVariable(model, next, dataset, settings, started)
}

export function applySplit(model: ScorecardModel, dataset: Dataset, settings: Settings, name: string): ScorecardModel | null {
  const variable = model.variables.find((item) => item.name === name)
  if (!variable) return null
  const ranges = splitOnce(
    variable.fine,
    variable.ranges,
    variable.direction,
    minCountOf(dataset.rowCount, settings),
    settings.maxBins,
  )
  if (!ranges) return null
  const started = performance.now()
  const next = materialize(prepOf(variable), ranges, settings, model.variables.length, dataset.rowCount)
  return replaceVariable(model, next, dataset, settings, started)
}

export function applyIsotonic(model: ScorecardModel, dataset: Dataset, settings: Settings, name: string): ScorecardModel {
  const variable = model.variables.find((item) => item.name === name)
  if (!variable) return model
  const started = performance.now()
  const ranges = isotonicRanges(
    variable.fine,
    variable.direction,
    minCountOf(dataset.rowCount, settings),
    settings.maxBins,
  )
  const next = materialize(prepOf(variable), ranges, settings, model.variables.length, dataset.rowCount)
  return replaceVariable(model, next, dataset, settings, started)
}

export function applyAuto(model: ScorecardModel, dataset: Dataset, settings: Settings, name: string): ScorecardModel {
  const variable = model.variables.find((item) => item.name === name)
  if (!variable) return model
  const started = performance.now()
  const ranges = autoRanges(
    variable.fine,
    variable.direction,
    minCountOf(dataset.rowCount, settings),
    settings.maxBins,
    settings.minBins,
    targetBins(settings),
  )
  const next = materialize(prepOf(variable), ranges, settings, model.variables.length, dataset.rowCount)
  return replaceVariable(model, next, dataset, settings, started)
}

export function rescale(model: ScorecardModel, dataset: Dataset, settings: Settings): ScorecardModel {
  const started = performance.now()
  const variables = model.variables.map((variable) =>
    materialize(prepOf(variable), variable.ranges, settings, model.variables.length, dataset.rowCount),
  )
  return finish(dataset, variables, settings, started)
}
