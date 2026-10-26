import { useEffect, useRef, useState } from "react"
import { fmt, fmtInt, intervalOf } from "../format"
import { useLab } from "../state/lab"

export function PointsView() {
  const lab = useLab()
  return (
    <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
      <p className="font-label-caps text-[10px] tracking-[0.14em] text-secondary">03 — Scorecard points</p>
      <h1 className="font-display text-headline-lg">Points table</h1>
      <p className="max-w-3xl text-body-md text-secondary">
        Points = offset / variables − factor × WoE. Factor is PDO / ln 2. Offset is the base score minus factor × ln(odds). A row’s points sum to offset − factor × the sum of its WoE values. Higher points are riskier.
      </p>
      <div className="mt-4 flex flex-wrap gap-6 border-y border-outline-variant py-3">
        <Scale label="PDO" testId="points-pdo" value={lab.settings.pdo} onCommit={(value) => lab.updateSetting("pdo", value)} />
        <Scale label="Base score" testId="points-base" value={lab.settings.baseScore} onCommit={(value) => lab.updateSetting("baseScore", value)} />
        <Scale label="Odds" testId="points-odds" value={lab.settings.odds} onCommit={(value) => lab.updateSetting("odds", value)} />
      </div>
      <table className="mt-4 w-full border-collapse text-left" data-testid="points-table">
        <thead>
          <tr className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">
            {["Variable", "Interval", "WoE", "Points", "Contribution"].map((label) => (
              <th key={label} className="border-b border-on-surface px-2 py-2 font-semibold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lab.model.variables.map((variable) =>
            variable.bins.map((bin, index) => (
              <tr key={`${variable.name}-${index}`} className="border-b border-outline-variant">
                <td className="px-2 py-1.5 text-body-sm">{index === 0 ? variable.name : ""}</td>
                <td className="px-2 py-1.5 font-numeric-data text-[12px]">{intervalOf(variable, index)}</td>
                <td className="px-2 py-1.5 font-numeric-data text-[12px]">{fmt(bin.woe, 3)}</td>
                <td className="px-2 py-1.5 font-numeric-data text-[12px]">{fmtInt(bin.points)}</td>
                <td className="px-2 py-1.5 font-numeric-data text-[12px]">{fmt(bin.contribution, 2)}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  )
}

function Scale({
  label,
  testId,
  value,
  onCommit,
}: {
  label: string
  testId: string
  value: number
  onCommit: (value: number) => void
}) {
  const [text, setText] = useState(String(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(String(value))
  }, [value])
  return (
    <label className="flex items-center gap-2">
      <span className="font-label-caps text-[10px] tracking-[0.12em] text-secondary">{label}</span>
      <input
        data-testid={testId}
        value={text}
        onFocus={() => {
          focused.current = true
        }}
        onBlur={() => {
          focused.current = false
          setText(String(value))
        }}
        onChange={(event) => {
          setText(event.target.value)
          const next = Number(event.target.value)
          if (event.target.value.trim() !== "" && Number.isFinite(next)) onCommit(next)
        }}
        className="w-24 border border-outline-variant bg-surface-container-lowest px-2 py-1 text-right font-numeric-data text-[13px] outline-none"
      />
    </label>
  )
}
