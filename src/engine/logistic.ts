/** Newton/IRLS logistic regression. y is 0/1. X is n×p, row-major, no intercept column. */

export type LogitFit = {
  intercept: number
  coef: Float64Array
}

function solve(a: Float64Array, b: Float64Array, dim: number): Float64Array | null {
  const m = a.slice()
  const x = b.slice()
  for (let k = 0; k < dim; k++) {
    let pivot = k
    let best = Math.abs(m[k * dim + k])
    for (let i = k + 1; i < dim; i++) {
      const value = Math.abs(m[i * dim + k])
      if (value > best) {
        best = value
        pivot = i
      }
    }
    if (best < 1e-12) return null
    if (pivot !== k) {
      for (let j = k; j < dim; j++) {
        const tmp = m[k * dim + j]
        m[k * dim + j] = m[pivot * dim + j]
        m[pivot * dim + j] = tmp
      }
      const tb = x[k]
      x[k] = x[pivot]
      x[pivot] = tb
    }
    const diag = m[k * dim + k]
    for (let i = k + 1; i < dim; i++) {
      const f = m[i * dim + k] / diag
      x[i] -= f * x[k]
      for (let j = k; j < dim; j++) m[i * dim + j] -= f * m[k * dim + j]
    }
  }
  for (let i = dim - 1; i >= 0; i--) {
    let sum = x[i]
    for (let j = i + 1; j < dim; j++) sum -= m[i * dim + j] * x[j]
    const diag = m[i * dim + i]
    if (Math.abs(diag) < 1e-12) return null
    x[i] = sum / diag
  }
  return x
}

export function fitLogistic(X: Float64Array, n: number, p: number, y: ArrayLike<number>): LogitFit {
  const dim = p + 1
  const beta = new Float64Array(dim)
  if (n === 0 || p === 0) return { intercept: 0, coef: new Float64Array(0) }

  let events = 0
  for (let i = 0; i < n; i++) events += y[i] === 1 ? 1 : 0
  const rate = Math.min(0.99, Math.max(0.01, events / n))
  beta[0] = Math.log(rate / (1 - rate))
  for (let j = 1; j < dim; j++) beta[j] = -0.4

  const xtwx = new Float64Array(dim * dim)
  const xtwz = new Float64Array(dim)

  for (let iter = 0; iter < 18; iter++) {
    xtwx.fill(0)
    xtwz.fill(0)
    for (let i = 0; i < n; i++) {
      let eta = beta[0]
      const row = i * p
      for (let j = 0; j < p; j++) eta += beta[j + 1] * X[row + j]
      const clipped = Math.min(20, Math.max(-20, eta))
      const pHat = 1 / (1 + Math.exp(-clipped))
      const w = Math.max(1e-6, pHat * (1 - pHat))
      const z = eta + (y[i] - pHat) / w
      xtwx[0] += w
      xtwz[0] += w * z
      for (let j = 0; j < p; j++) {
        const xj = X[row + j]
        const jj = j + 1
        xtwx[jj] += w * xj
        xtwx[jj * dim] += w * xj
        xtwz[jj] += w * z * xj
        for (let k = 0; k < p; k++) {
          xtwx[jj * dim + (k + 1)] += w * xj * X[row + k]
        }
      }
    }
    for (let d = 0; d < dim; d++) xtwx[d * dim + d] += 1e-4
    const next = solve(xtwx, xtwz, dim)
    if (!next) break
    let delta = 0
    for (let d = 0; d < dim; d++) {
      delta += Math.abs(next[d] - beta[d])
      beta[d] = next[d]
    }
    if (delta < 1e-6) break
  }

  if (![...beta].every((value) => Number.isFinite(value))) {
    const coef = new Float64Array(p)
    coef.fill(-1)
    return { intercept: 0, coef }
  }
  return { intercept: beta[0], coef: beta.slice(1) }
}
