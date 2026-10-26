import { skewness } from "./stats"
import type { Dataset, Issue } from "./types"

const POSITIVE = new Set(["1", "true", "yes", "y", "bad", "default", "event"])

export function parseCsv(text: string): { headers: string[]; rows: string[][] } | { error: string } {
  if (text.includes("\u0000")) return { error: "The file is not readable as UTF-8 text." }
  let src = text
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1)
  if (!src.trim()) return { error: "The file is empty." }

  const table: string[][] = []
  let row: string[] = []
  let cur = ""
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"'
          i++
        } else quoted = false
      } else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ",") {
      row.push(cur)
      cur = ""
    } else if (ch === "\n") {
      row.push(cur)
      cur = ""
      table.push(row)
      row = []
    } else if (ch !== "\r") cur += ch
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur)
    table.push(row)
  }
  while (table.length > 0 && table[table.length - 1].every((cell) => cell.trim() === "")) table.pop()
  if (table.length < 2) return { error: "The file has headers but no data rows." }

  const headers = table[0].map((cell) => cell.trim())
  if (headers.some((header) => header === "")) return { error: "The file has an empty column name." }
  const seen = new Set<string>()
  for (const header of headers) {
    if (seen.has(header)) return { error: `Duplicate column “${header}”.` }
    seen.add(header)
  }
  if (headers.length > 30) {
    return { error: `The file has ${headers.length} columns. ScorecardLab accepts up to 30.` }
  }
  const rows = table.slice(1)
  if (rows.length > 50000) {
    return { error: `The file has ${rows.length.toLocaleString("en-US")} rows. ScorecardLab accepts up to 50,000.` }
  }
  return { headers, rows }
}

function numericValue(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === "") return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

export function ingestCsv(text: string, datasetName: string, targetName?: string): { ok: true; dataset: Dataset; binaryCandidates: string[] } | { ok: false; issues: Issue[] } {
  const parsed = parseCsv(text)
  if ("error" in parsed) return { ok: false, issues: [{ level: "error", message: parsed.error }] }

  const { headers, rows } = parsed
  const columns = headers.map(() => [] as string[])
  for (const row of rows) {
    for (let c = 0; c < headers.length; c++) columns[c].push(row[c] ?? "")
  }

  const binaryCandidates: string[] = []
  headers.forEach((header, index) => {
    const labels = new Set<string>()
    for (const cell of columns[index]) {
      const trimmed = cell.trim()
      if (trimmed) labels.add(trimmed)
      if (labels.size > 2) break
    }
    if (labels.size === 2) binaryCandidates.push(header)
  })

  if (binaryCandidates.length === 0) {
    return { ok: false, issues: [{ level: "error", message: "No binary target column. A target needs exactly two distinct values." }] }
  }

  const target = targetName && headers.includes(targetName) ? targetName : binaryCandidates[0]
  const targetIndex = headers.indexOf(target)
  const labels = new Set<string>()
  for (const cell of columns[targetIndex]) {
    const trimmed = cell.trim()
    if (trimmed) labels.add(trimmed)
  }
  if (labels.size !== 2) {
    return {
      ok: false,
      issues: [{ level: "error", message: `Target “${target}” is not binary. It needs exactly two distinct values.` }],
    }
  }
  const ordered = [...labels].sort()
  const positive = ordered.find((label) => POSITIVE.has(label.toLowerCase())) ?? ordered[1]
  const issues: Issue[] = []
  if (!POSITIVE.has(positive.toLowerCase())) {
    issues.push({
      level: "warning",
      message: `Positive class for “${target}” is assumed to be “${positive}”.`,
    })
  }

  const y = new Uint8Array(rows.length)
  for (let i = 0; i < rows.length; i++) {
    y[i] = columns[targetIndex][i].trim() === positive ? 1 : 0
  }
  const events = y.reduce((sum, bit) => sum + bit, 0)
  if (events === 0 || events === y.length) {
    return { ok: false, issues: [{ level: "error", message: "The target is constant, so it cannot be scored." }] }
  }

  const features: { name: string; values: Float64Array }[] = []
  const skipped: string[] = []
  headers.forEach((header, index) => {
    if (index === targetIndex) return
    let numeric = true
    let nonMissing = 0
    const uniq = new Set<number>()
    for (const cell of columns[index]) {
      const trimmed = cell.trim()
      if (!trimmed) continue
      const value = numericValue(trimmed)
      if (value == null) {
        numeric = false
        break
      }
      nonMissing++
      uniq.add(value)
    }
    if (!numeric) {
      skipped.push(header)
      return
    }
    if (nonMissing === 0) {
      issues.push({ level: "warning", message: `${header} is entirely missing and was skipped.` })
      return
    }
    if (uniq.size <= 1) {
      issues.push({ level: "warning", message: `${header} is constant and was skipped.` })
      return
    }
    const values = new Float64Array(rows.length)
    let missing = 0
    for (let r = 0; r < rows.length; r++) {
      const value = numericValue(columns[index][r])
      if (value == null) {
        values[r] = Number.NaN
        missing++
      } else values[r] = value
    }
    const missingRate = missing / rows.length
    if (missingRate >= 0.02) {
      issues.push({
        level: "warning",
        message: `${header} is ${(missingRate * 100).toFixed(1)}% missing.${missingRate >= 0.2 ? " That is high enough to treat with care." : ""}`,
      })
    }
    const skew = skewness(values)
    if (Math.abs(skew) > 2) {
      issues.push({
        level: "warning",
        message: `${header} is extremely skewed (skew ${skew.toFixed(2)}). It is still binned.`,
      })
    }
    features.push({ name: header, values })
  })

  if (skipped.length > 0) {
    issues.push({
      level: "warning",
      message: `Not numeric, so not binned: ${skipped.join(", ")}.`,
    })
  }
  if (features.length === 0) {
    return { ok: false, issues: [...issues, { level: "error", message: "No numeric feature columns to bin." }] }
  }

  return {
    ok: true,
    binaryCandidates,
    dataset: {
      id: `csv:${datasetName}`,
      name: datasetName,
      target,
      rowCount: rows.length,
      y,
      features,
      issues,
    },
  }
}
