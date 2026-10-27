import type { Scaling } from "./types"

export type CountBin = { events: number; nonEvents: number }

export type WoeRow = {
  woe: number
  iv: number
  eventRate: number
}

/** Laplace-smoothed WoE and IV. WoE = ln(% non-events / % events). */
export function woeAndIv(bins: CountBin[], laplace: number): WoeRow[] {
  const lap = Number.isFinite(laplace) && laplace > 0 ? laplace : 0
  let totalE = 0
  let totalNE = 0
  for (const bin of bins) {
    totalE += bin.events + lap
    totalNE += bin.nonEvents + lap
  }
  if (totalE <= 0 || totalNE <= 0) {
    return bins.map((bin) => ({
      woe: 0,
      iv: 0,
      eventRate: rateOf(bin.events, bin.nonEvents),
    }))
  }
  return bins.map((bin) => {
    const pctE = (bin.events + lap) / totalE
    const pctNE = (bin.nonEvents + lap) / totalNE
    const woe = Math.log(pctNE / pctE)
    return {
      woe,
      iv: (pctNE - pctE) * woe,
      eventRate: rateOf(bin.events, bin.nonEvents),
    }
  })
}

function rateOf(events: number, nonEvents: number): number {
  const n = events + nonEvents
  return n > 0 ? events / n : 0
}

export function factorOf(pdo: number): number {
  return pdo / Math.log(2)
}

export function offsetOf(scaling: Scaling): number {
  return scaling.baseScore - factorOf(scaling.pdo) * Math.log(scaling.odds)
}

/**
 * Points = offset/n + factor × β × WoE.
 * Univariate scorecards use β = −1, so this is offset/n − factor × WoE.
 * Logistic β (usually negative) reweights each variable so the row sum
 * tracks the fitted log-odds of the event.
 */
export function allocatePoints(
  woe: number,
  variableCount: number,
  scaling: Scaling,
  beta = -1,
): { points: number; contribution: number } {
  const n = Math.max(1, variableCount)
  const factor = factorOf(scaling.pdo)
  const weight = Number.isFinite(beta) ? beta : -1
  const contribution = factor * weight * woe
  const points = offsetOf(scaling) / n + contribution
  return { points, contribution }
}

export type Separation = {
  ks: number
  auc: number
  gini: number
  ksAt: number
}

export type KsPoint = { t: number; events: number; nonEvents: number }

/** Higher score means a higher rank for the event class. Ties count as half. */
export function separation(scores: ArrayLike<number>, y: ArrayLike<number>): {
  metrics: Separation
  curve: KsPoint[]
} {
  const n = scores.length
  const order = new Array<number>(n)
  for (let i = 0; i < n; i++) order[i] = i
  order.sort((a, b) => scores[a] - scores[b] || a - b)

  let totalE = 0
  let totalN = 0
  for (let i = 0; i < n; i++) {
    if (y[i] === 1) totalE++
    else totalN++
  }

  let cumE = 0
  let cumN = 0
  let aucAcc = 0
  let ks = 0
  let ksAt = 0
  const curve: KsPoint[] = [{ t: 0, events: 0, nonEvents: 0 }]
  const stride = Math.max(1, Math.floor(n / 160))

  let i = 0
  while (i < n) {
    const score = scores[order[i]]
    let ge = 0
    let gn = 0
    let j = i
    while (j < n && scores[order[j]] === score) {
      if (y[order[j]] === 1) ge++
      else gn++
      j++
    }
    aucAcc += ge * (cumN + gn * 0.5)
    cumE += ge
    cumN += gn
    const gap = totalE > 0 && totalN > 0 ? Math.abs(cumE / totalE - cumN / totalN) : 0
    if (gap >= ks) {
      ks = gap
      ksAt = j / n
    }
    if (j === n || j % stride === 0) {
      curve.push({
        t: j / n,
        events: totalE > 0 ? cumE / totalE : 0,
        nonEvents: totalN > 0 ? cumN / totalN : 0,
      })
    }
    i = j
  }

  const auc = totalE > 0 && totalN > 0 ? aucAcc / (totalE * totalN) : 0.5
  return { metrics: { ks, auc, gini: 2 * auc - 1, ksAt }, curve }
}

export function giniFromGroups(groups: { score: number; events: number; nonEvents: number }[]): {
  auc: number
  gini: number
} {
  const sorted = groups.slice().sort((a, b) => a.score - b.score)
  let totalE = 0
  let totalN = 0
  for (const group of sorted) {
    totalE += group.events
    totalN += group.nonEvents
  }
  let cumN = 0
  let aucAcc = 0
  for (const group of sorted) {
    aucAcc += group.events * (cumN + group.nonEvents * 0.5)
    cumN += group.nonEvents
  }
  const auc = totalE > 0 && totalN > 0 ? aucAcc / (totalE * totalN) : 0.5
  return { auc, gini: 2 * auc - 1 }
}

export type HistBin = { lo: number; hi: number; events: number; nonEvents: number }

export function histogram(scores: ArrayLike<number>, y: ArrayLike<number>, buckets = 28): {
  min: number
  max: number
  bins: HistBin[]
} {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i]
    if (s < min) min = s
    if (s > max) max = s
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0
    max = 1
  }
  if (max - min < 1e-9) max = min + 1
  const width = (max - min) / buckets
  const bins: HistBin[] = []
  for (let i = 0; i < buckets; i++) {
    bins.push({ lo: min + i * width, hi: min + (i + 1) * width, events: 0, nonEvents: 0 })
  }
  for (let i = 0; i < scores.length; i++) {
    let b = Math.floor((scores[i] - min) / width)
    if (b < 0) b = 0
    if (b >= buckets) b = buckets - 1
    if (y[i] === 1) bins[b].events++
    else bins[b].nonEvents++
  }
  return { min, max, bins }
}

export function quantile(sorted: ArrayLike<number>, q: number): number {
  if (sorted.length === 0) return 0
  const pos = Math.min(sorted.length - 1, Math.max(0, q * (sorted.length - 1)))
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] * (hi - pos) + sorted[hi] * (pos - lo)
}

export function thresholdStats(
  scores: ArrayLike<number>,
  y: ArrayLike<number>,
  threshold: number,
): { approval: number; eventRate: number; accepted: number; events: number; nonEvents: number } {
  let accepted = 0
  let events = 0
  let nonEvents = 0
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] <= threshold) {
      accepted++
      if (y[i] === 1) events++
      else nonEvents++
    }
  }
  return {
    approval: scores.length ? accepted / scores.length : 0,
    eventRate: accepted ? events / accepted : 0,
    accepted,
    events,
    nonEvents,
  }
}

export type BookCounts = { n: number; events: number; nonEvents: number }

export function bookCounts(y: ArrayLike<number>): BookCounts {
  let events = 0
  const n = y.length
  for (let i = 0; i < n; i++) if (y[i] === 1) events++
  return { n, events, nonEvents: n - events }
}

/** Indices of accounts from safest (lowest score) to riskiest. */
export function rankByScore(scores: ArrayLike<number>): number[] {
  const n = scores.length
  const order = new Array<number>(n)
  for (let i = 0; i < n; i++) order[i] = i
  order.sort((a, b) => scores[a] - scores[b] || a - b)
  return order
}

export type BookEconomics = {
  approval: number
  eventRate: number
  accepted: number
  events: number
  nonEvents: number
  threshold: number
  profit: number
  randomProfit: number
  delta: number
}

/**
 * Accept the safest `rate` share of the book (lowest scores first).
 * Random-book profit is the same share drawn without ranking.
 * If AUC falls, more bads land in that safest share, so profit and Δ fall.
 */
export function economicsAtRate(
  scores: ArrayLike<number>,
  y: ArrayLike<number>,
  rate: number,
  profitGood: number,
  lossBad: number,
  order?: number[],
  counts?: BookCounts,
): BookEconomics {
  const ranked = order ?? rankByScore(scores)
  const book = counts ?? bookCounts(y)
  const { n, events: bookEvents, nonEvents: bookNon } = book
  const clamped = Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : 0
  const k = n === 0 ? 0 : Math.round(clamped * n)
  let events = 0
  let nonEvents = 0
  for (let i = 0; i < k; i++) {
    if (y[ranked[i]] === 1) events++
    else nonEvents++
  }
  const threshold = n === 0 ? 0 : scores[ranked[Math.max(0, k - 1)]]
  const approval = n ? k / n : 0
  const profit = nonEvents * profitGood - events * lossBad
  const randomProfit = approval * (bookNon * profitGood - bookEvents * lossBad)
  return {
    approval,
    eventRate: k ? events / k : 0,
    accepted: k,
    events,
    nonEvents,
    threshold,
    profit,
    randomProfit,
    delta: profit - randomProfit,
  }
}

export type CurvePoint = { rate: number; profit: number; randomProfit: number }

export function profitCurve(
  scores: ArrayLike<number>,
  y: ArrayLike<number>,
  profitGood: number,
  lossBad: number,
  order?: number[],
  counts?: BookCounts,
  steps = 20,
): CurvePoint[] {
  const ranked = order ?? rankByScore(scores)
  const book = counts ?? bookCounts(y)
  const { n, events: bookEvents, nonEvents: bookNon } = book
  const acceptAll = bookNon * profitGood - bookEvents * lossBad
  const prefix = new Array<number>(n + 1)
  prefix[0] = 0
  let profit = 0
  for (let i = 0; i < n; i++) {
    if (y[ranked[i]] === 1) profit -= lossBad
    else profit += profitGood
    prefix[i + 1] = profit
  }
  const out: CurvePoint[] = []
  const count = Math.max(1, Math.round(steps))
  for (let s = 0; s <= count; s++) {
    const rate = s / count
    const k = Math.round(rate * n)
    out.push({
      rate,
      profit: prefix[k] ?? 0,
      randomProfit: (n ? k / n : 0) * acceptAll,
    })
  }
  return out
}

export function skewness(values: ArrayLike<number>): number {
  let n = 0
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (Number.isNaN(v)) continue
    n++
    sum += v
  }
  if (n < 3) return 0
  const mean = sum / n
  let m2 = 0
  let m3 = 0
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (Number.isNaN(v)) continue
    const d = v - mean
    m2 += d * d
    m3 += d * d * d
  }
  m2 /= n
  m3 /= n
  const s = Math.sqrt(m2)
  if (s === 0) return 0
  return m3 / (s * s * s)
}
