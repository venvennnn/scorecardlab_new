import type { VariableModel } from "./engine/scorecard"

export function fmt(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return "—"
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return "—"
  return Math.round(n).toLocaleString("en-US")
}

export function fmtPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—"
  return `${(n * 100).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`
}

export function fmtCut(n: number): string {
  if (!Number.isFinite(n)) return "—"
  const abs = Math.abs(n)
  const digits = abs >= 100 ? 1 : abs >= 10 ? 2 : abs >= 1 ? 3 : 4
  return n.toLocaleString("en-US", { maximumFractionDigits: digits })
}

export function intervalOf(variable: VariableModel, index: number, missing = false): string {
  if (missing) return "missing"
  const bin = variable.bins[index]
  const left = index === 0 ? "−∞" : fmtCut(variable.bins[index - 1].hi)
  const right = index === variable.bins.length - 1 ? "+∞" : fmtCut(bin.hi)
  return index === variable.bins.length - 1 ? `(${left}, ${right})` : `(${left}, ${right}]`
}

export const DECKS: Record<string, string> = {
  revolving_utilization_pct: "Share of revolving credit currently in use.",
  debt_to_income_ratio: "Debt payments set against income.",
  delinquency_2yr_count: "Times past due in the last two years.",
  inquiries_last_6m: "Credit pulls in the last six months.",
  annual_income_log: "Log of annual income.",
  total_credit_lines: "Count of open and closed credit lines.",
}
