import type { ScorecardModel, VariableModel } from "./scorecard"
import type { Dataset, Settings } from "./types"

function interval(variable: VariableModel, index: number): string {
  const bin = variable.bins[index]
  const left = index === 0 ? "-inf" : String(variable.bins[index - 1].hi)
  const right = index === variable.bins.length - 1 ? "inf" : String(bin.hi)
  return index === variable.bins.length - 1 ? `(${left}, ${right})` : `(${left}, ${right}]`
}

function variablePayload(variable: VariableModel) {
  return {
    name: variable.name,
    direction: variable.direction === 1 ? "increasing" : "decreasing",
    monotonicity: variable.monotonicity,
    iv: variable.iv,
    gini: variable.gini,
    beta: variable.beta,
    maxDivergence: variable.maxDivergence,
    cuts: variable.bins.slice(0, -1).map((bin) => bin.hi),
    bins: variable.bins.map((bin, index) => ({
      interval: interval(variable, index),
      lo: index === 0 ? null : variable.bins[index - 1].hi,
      hi: index === variable.bins.length - 1 ? null : bin.hi,
      count: bin.count,
      events: bin.events,
      eventRate: bin.eventRate,
      woe: bin.woe,
      iv: bin.iv,
      points: bin.points,
      contribution: bin.contribution,
    })),
    missingBin: variable.missingBin,
  }
}

export function cutsJson(dataset: Dataset, settings: Settings, model: ScorecardModel): string {
  return JSON.stringify(
    {
      dataset: dataset.name,
      target: dataset.target,
      engine: "javascript",
      scaling: { pdo: settings.pdo, baseScore: settings.baseScore, odds: settings.odds },
      constraints: {
        minBinPct: settings.minBinPct,
        maxBins: settings.maxBins,
        laplace: settings.laplace,
      },
      metrics: { ks: model.ks, auc: model.auc, gini: model.gini },
      intercept: model.intercept,
      variables: model.variables.map(variablePayload),
    },
    null,
    2,
  )
}

export function cutsCsv(model: ScorecardModel): string {
  const lines = ["variable,bin_index,lo,hi,count,events,event_rate,woe,points"]
  for (const variable of model.variables) {
    variable.bins.forEach((bin, index) => {
      const lo = index === 0 ? "" : String(variable.bins[index - 1].hi)
      const hi = index === variable.bins.length - 1 ? "" : String(bin.hi)
      lines.push(
        [variable.name, index, lo, hi, bin.count, bin.events, bin.eventRate, bin.woe, bin.points].join(","),
      )
    })
  }
  return lines.join("\n") + "\n"
}

export function pointsCsv(model: ScorecardModel): string {
  const lines = ["variable,interval,woe,points,contribution"]
  for (const variable of model.variables) {
    variable.bins.forEach((bin, index) => {
      lines.push([variable.name, interval(variable, index), bin.woe, bin.points, bin.contribution].join(","))
    })
    if (variable.missingBin) {
      lines.push(
        [variable.name, "missing", variable.missingBin.woe, variable.missingBin.points, variable.missingBin.contribution].join(","),
      )
    }
  }
  return lines.join("\n") + "\n"
}

export function pythonSnippet(dataset: Dataset, model: ScorecardModel): string {
  const cuts: Record<string, number[]> = {}
  const points: Record<string, number[]> = {}
  const missing: Record<string, number> = {}
  for (const variable of model.variables) {
    cuts[variable.name] = variable.bins.slice(0, -1).map((bin) => bin.hi)
    points[variable.name] = variable.bins.map((bin) => bin.points)
    if (variable.missingBin) missing[variable.name] = variable.missingBin.points
    else if (variable.foldedInto != null) missing[variable.name] = variable.bins[variable.foldedInto].points
  }
  return `"""Apply ScorecardLab cuts and points for ${dataset.name}.

Higher points are riskier: points = offset/n + factor * beta * WoE.
Logistic beta is fit on the selected WoE bins. This snippet is not a certification.
"""

CUTS = ${JSON.stringify(cuts, null, 2)}
BIN_POINTS = ${JSON.stringify(points, null, 2)}
MISSING_POINTS = ${JSON.stringify(missing, null, 2)}


def bin_points(feature, value):
    pts = BIN_POINTS[feature]
    cuts = CUTS[feature]
    if value is None:
        return MISSING_POINTS.get(feature, pts[-1])
    for cut, point in zip(cuts, pts):
        if value <= cut:
            return point
    return pts[-1]


def score(row):
    return sum(bin_points(feature, row.get(feature)) for feature in BIN_POINTS)
`
}

export function sessionRecord(dataset: Dataset, settings: Settings, model: ScorecardModel): string {
  return JSON.stringify(
    {
      notice: "Working session record of bins and metrics. Not a regulatory certification.",
      dataset: dataset.name,
      target: dataset.target,
      engine: "javascript",
      rows: dataset.rowCount,
      scaling: { pdo: settings.pdo, baseScore: settings.baseScore, odds: settings.odds },
      constraints: {
        minBinPct: settings.minBinPct,
        maxBins: settings.maxBins,
        minBins: settings.minBins,
        laplace: settings.laplace,
      },
      metrics: { ks: model.ks, auc: model.auc, gini: model.gini },
      intercept: model.intercept,
      variables: model.variables.map(variablePayload),
    },
    null,
    2,
  )
}
