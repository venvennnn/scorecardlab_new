import { useEffect, useRef, useState } from "react"
import { factorOf, offsetOf } from "../engine/stats"
import { fmt, fmtInt, intervalOf } from "../format"
import { useLab } from "../state/lab"
import { PageWrap, SectionKicker } from "./chrome"

export function PointsView() {
  const lab = useLab()
  const offset = offsetOf(lab.settings)
  const factor = factorOf(lab.settings.pdo)
  const n = Math.max(1, lab.model.variables.length)
  const scoreMin = lab.model.histogram.min
  const scoreMax = lab.model.histogram.max
  return (
    <PageWrap>
      <SectionKicker index="03" label="SCORECARD POINTS" meta={`PDO ${fmtInt(lab.settings.pdo)} · base ${fmtInt(lab.settings.baseScore)} · odds ${fmtInt(lab.settings.odds)}:1`} />
      <h1 className="mt-1 font-display text-[2.25rem] font-normal italic leading-none tracking-tight">Points table</h1>
      <p className="mt-2 max-w-3xl font-body-sm text-[13px] text-secondary">
        Each account takes one bin from each variable. Those points sum to offset − factor × Σ WoE, where factor is PDO / ln 2 and offset is the base score minus factor × ln(odds). Higher points are riskier. Bins of one variable are alternatives, so they are not added down the ledger.
      </p>
      <dl className="mt-4 grid grid-cols-4 gap-3 border border-outline-variant bg-surface-container-lowest px-3 py-3" data-testid="points-identity">
        <div>
          <dt className="font-label-caps text-[10px] tracking-[0.12em] text-secondary">Offset</dt>
          <dd className="font-numeric-data text-[1.15rem]">{fmtInt(offset)}</dd>
        </div>
        <div>
          <dt className="font-label-caps text-[10px] tracking-[0.12em] text-secondary">Offset / variables</dt>
          <dd className="font-numeric-data text-[1.15rem]">{fmtInt(offset / n)}</dd>
        </div>
        <div>
          <dt className="font-label-caps text-[10px] tracking-[0.12em] text-secondary">Factor</dt>
          <dd className="font-numeric-data text-[1.15rem]">{fmt(factor, 2)}</dd>
        </div>
        <div>
          <dt className="font-label-caps text-[10px] tracking-[0.12em] text-secondary">Row score range</dt>
          <dd className="font-numeric-data text-[1.15rem]" data-testid="score-range">
            {fmtInt(scoreMin)}–{fmtInt(scoreMax)}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-6 border border-outline-variant bg-surface-container-lowest px-3 py-3">
        <Scale label="PDO" testId="points-pdo" value={lab.settings.pdo} onCommit={(value) => lab.updateSetting("pdo", value)} />
        <Scale label="Base score" testId="points-base" value={lab.settings.baseScore} onCommit={(value) => lab.updateSetting("baseScore", value)} />
        <Scale label="Odds" testId="points-odds" value={lab.settings.odds} onCommit={(value) => lab.updateSetting("odds", value)} />
      </div>
      <table className="mt-3 w-full border-collapse border border-outline-variant bg-surface-container-lowest text-left" data-testid="points-table">
        <thead>
          <tr className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">
            {["Variable", "Interval", "WoE", "Points", "Contribution"].map((label) => (
              <th key={label} className="border-b border-outline-variant px-2 py-2 font-semibold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lab.model.variables.map((variable) =>
            variable.bins.map((bin, index) => (
              <tr key={`${variable.name}-${index}`} className="border-b border-outline-variant/70">
                <td className="px-2 py-1.5 text-body-sm">{index === 0 ? variable.name : ""}</td>
                <td className="px-2 py-1.5 font-numeric-data text-[12px]">{intervalOf(variable, index)}</td>
                <td className="px-2 py-1.5 font-numeric-data text-[12px] font-bold text-primary">{fmt(bin.woe, 3)}</td>
                <td className="px-2 py-1.5 font-numeric-data text-[12px]">{fmtInt(bin.points)}</td>
                <td className="px-2 py-1.5 font-numeric-data text-[12px]">{fmt(bin.contribution, 2)}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </PageWrap>
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
        className="w-24 border border-outline-variant bg-surface px-2 py-1 text-right font-numeric-data text-[13px] outline-none"
      />
    </label>
  )
}
