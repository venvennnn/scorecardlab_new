export type FineCell = {
  lo: number
  hi: number
  events: number
  nonEvents: number
  count: number
}

export type Range = { l: number; r: number }

export type Scaling = {
  pdo: number
  baseScore: number
  odds: number
}

export type Constraints = {
  minBinPct: number
  maxBins: number
  minBins: number
  laplace: number
}

export type Settings = Constraints & Scaling

export type Issue = {
  level: "error" | "warning"
  message: string
}

export type Dataset = {
  id: string
  name: string
  target: string
  rowCount: number
  y: Uint8Array
  features: { name: string; values: Float64Array }[]
  issues: Issue[]
}

export const DEFAULT_SETTINGS: Settings = {
  minBinPct: 0.05,
  maxBins: 6,
  minBins: 3,
  laplace: 0.5,
  pdo: 20,
  baseScore: 600,
  odds: 50,
}

export const STRICT_SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  minBinPct: 0.1,
  maxBins: 4,
  minBins: 2,
}
