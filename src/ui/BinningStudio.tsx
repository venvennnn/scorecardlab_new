import { useEffect, useRef, useState } from "react"
import { fmt, fmtDelta, fmtInt, fmtPct, intervalOf } from "../format"
import type { VariableModel } from "../engine/scorecard"
import { useLab } from "../state/lab"
import { KsFigure, Silhouette } from "./figures"
import { PageWrap, SectionKicker } from "./chrome"
import { WoeChart } from "./WoeChart"

export function BinningStudio() {
  const lab = useLab()
  const variable = lab.activeVariable
  if (!variable) return null

  const minCount = Math.max(1, Math.ceil(lab.settings.minBinPct * lab.dataset.rowCount))
  const totalN = variable.bins.reduce((sum, bin) => sum + bin.count, 0) + (variable.missingBin?.count ?? 0)
  const totalEvents = variable.bins.reduce((sum, bin) => sum + bin.events, 0) + (variable.missingBin?.events ?? 0)
  const totalIv = variable.bins.reduce((sum, bin) => sum + bin.iv, 0) + (variable.missingBin?.iv ?? 0)
  const pointValues = [...variable.bins.map((bin) => bin.points), ...(variable.missingBin ? [variable.missingBin.points] : [])]
  const pointSpread = pointValues.length ? Math.max(...pointValues) - Math.min(...pointValues) : 0
  const violations = countViolations(variable)
  const degenerate =
    variable.bins.filter((bin) => bin.count < minCount).length + (variable.missingBin && variable.missingBin.count < minCount ? 1 : 0)
  const aggregateIv = lab.model.variables.reduce((sum, item) => sum + item.iv, 0)
  const maxIv = Math.max(...lab.model.variables.map((item) => item.iv), 0.0001)
  const ms = lab.model.ms < 1 ? "<1 ms" : `${Math.round(lab.model.ms)} ms`

  return (
    <PageWrap>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <SectionKicker index="01" label="FEATURE PARTITION STUDIO" meta={`${fmtInt(lab.dataset.rowCount)} observations`} />
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 data-testid="active-name" className="font-display text-[2.25rem] font-normal italic leading-none tracking-tight text-on-surface">
              {variable.name}
            </h1>
            <p className="font-numeric-data text-[12px] text-secondary">
              type: continuous · {variable.direction === 1 ? "increasing" : "decreasing"} · {variable.bins.length} bins
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-end gap-5">
            <Metric testId="metric-iv" label="Univariate IV" value={fmt(variable.iv, 3)} />
            <Metric testId="metric-gini" label="Gini" value={fmt(variable.gini, 3)} />
            <Metric
              testId="metric-mono"
              label="Monotonicity"
              value={variable.direction === 1 ? "Increasing" : "Decreasing"}
              icon={variable.direction === 1 ? "trending_up" : "trending_down"}
            />
            <Metric testId="metric-div" label="Max divergence" value={fmt(variable.maxDivergence, 2)} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Action testId="btn-merge" icon="call_merge" label="Merge Adjacent" onClick={lab.merge} />
            <Action testId="btn-split" icon="call_split" label="Split Cutpoint" onClick={lab.split} />
            <Action testId="btn-isotonic" icon="timeline" label="Isotonic PAV" onClick={lab.isotonic} />
            <Action testId="btn-autobin" icon="auto_fix_high" label="Auto-Bin" onClick={lab.autoBin} filled />
            <span data-testid="action-status" className="font-numeric-data text-[11px] text-tertiary">
              {lab.status}
            </span>
          </div>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-12 items-start gap-3">
        <div className="col-span-3 flex flex-col gap-3">
          <section className="border border-outline-variant bg-surface-container-lowest">
            <h2 className="border-b border-outline-variant px-3 py-2 font-label-caps text-[10px] tracking-[0.14em]">Predictive index (IV rank)</h2>
            <ol>
              {lab.model.variables.map((item, index) => {
                const on = item.name === variable.name
                return (
                  <li key={item.name}>
                    <button
                      type="button"
                      data-testid={`var-${item.name}`}
                      onClick={() => lab.setActive(item.name)}
                      className={`flex w-full items-center gap-2 border-l-2 px-3 py-1.5 text-left ${
                        on ? "border-primary bg-surface-container-low" : "border-transparent hover:bg-surface-container-low"
                      }`}
                    >
                      <span className="w-5 font-numeric-data text-[11px] text-secondary">{String(index + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-body-sm text-[12px]">{item.name}</span>
                        <span className="mt-0.5 block h-1 bg-surface-container-high">
                          <span className="block h-1 bg-primary" style={{ width: `${Math.max(4, (item.iv / maxIv) * 100)}%` }} />
                        </span>
                      </span>
                      {on && <Spark rates={item.bins.map((bin) => bin.eventRate)} />}
                      <span className="font-numeric-data text-[11px]">{fmt(item.iv, 3)}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>
          <section className="border border-outline-variant bg-surface-container-lowest px-3 py-2">
            <h2 className="font-label-caps text-[10px] tracking-[0.14em]">Mathematical constraints</h2>
            <Field testId="min-bin" label="Min bin %" value={lab.settings.minBinPct * 100} onCommit={(value) => lab.updateSetting("minBinPct", value / 100)} />
            <Field testId="laplace" label="Laplace" value={lab.settings.laplace} onCommit={(value) => lab.updateSetting("laplace", value)} />
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">Monotonicity</span>
              <span className="font-numeric-data text-[12px]">{variable.direction === 1 ? "Increasing" : "Decreasing"}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">Pre-bin cardinality</span>
              <span className="font-numeric-data text-[12px]">{fmtInt(variable.fine.length)}</span>
            </div>
            <Field testId="max-bins" label="Max bins" value={lab.settings.maxBins} onCommit={(value) => lab.updateSetting("maxBins", value)} />
            <Field testId="pdo" label="PDO" value={lab.settings.pdo} onCommit={(value) => lab.updateSetting("pdo", value)} />
            <Field testId="base-score" label="Base score" value={lab.settings.baseScore} onCommit={(value) => lab.updateSetting("baseScore", value)} />
            <Field testId="odds" label="Odds" value={lab.settings.odds} onCommit={(value) => lab.updateSetting("odds", value)} />
          </section>
        </div>

        <section className="col-span-6 border border-outline-variant bg-surface-container-lowest">
          <div className="flex items-center justify-between gap-3 px-3 pt-2">
            <h2 className="font-label-caps text-[10px] tracking-[0.14em]">WoE vs. Population Distribution</h2>
            <div className="flex items-center gap-3 font-body-sm text-[11px] text-secondary">
              <span className="inline-flex items-center gap-1">
                <i className="inline-block h-2 w-2.5 bg-primary-fixed" /> Pop
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="inline-block h-0.5 w-3 bg-primary" /> WoE
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="inline-block h-1.5 w-1.5 rounded-[999px] border border-tertiary-container" /> Bad rate
              </span>
            </div>
          </div>
          <div className="px-1">
            <WoeChart variable={variable} onDrag={lab.drag} />
          </div>
          <div className="border-t border-outline-variant" data-testid="ledger">
            <div className="px-3 pt-2 font-label-caps text-[10px] tracking-[0.14em]">Partition Ledger</div>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">
                  {["Bin", "Range", "N", "Pop %", "Event rate", "WoE", "Marginal IV", "Points"].map((label) => (
                    <th key={label} className="border-b border-outline-variant px-2 py-1 font-semibold">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-numeric-data text-[12px]">
                {variable.bins.map((bin, index) => (
                  <tr key={index} className="border-b border-outline-variant/70" data-testid={`ledger-row-${index}`}>
                    <td className="px-2 py-1">{String(index + 1).padStart(2, "0")}</td>
                    <td className="px-2 py-1">{intervalOf(variable, index)}</td>
                    <td className="px-2 py-1">{fmtInt(bin.count)}</td>
                    <td className="px-2 py-1">{fmtPct(bin.count / lab.dataset.rowCount)}</td>
                    <td className="px-2 py-1 text-tertiary">{fmtPct(bin.eventRate)}</td>
                    <td className="px-2 py-1 font-bold text-primary">{fmt(bin.woe, 3)}</td>
                    <td className="px-2 py-1">{fmt(bin.iv, 3)}</td>
                    <td className="px-2 py-1">{fmtInt(bin.points)}</td>
                  </tr>
                ))}
                {variable.missingBin && (
                  <tr data-testid="ledger-missing" className="border-b border-outline-variant/70">
                    <td className="px-2 py-1">—</td>
                    <td className="px-2 py-1">missing</td>
                    <td className="px-2 py-1">{fmtInt(variable.missingBin.count)}</td>
                    <td className="px-2 py-1">{fmtPct(variable.missingBin.count / lab.dataset.rowCount)}</td>
                    <td className="px-2 py-1 text-tertiary">{fmtPct(variable.missingBin.eventRate)}</td>
                    <td className="px-2 py-1 font-bold text-primary">{fmt(variable.missingBin.woe, 3)}</td>
                    <td className="px-2 py-1">{fmt(variable.missingBin.iv, 3)}</td>
                    <td className="px-2 py-1">{fmtInt(variable.missingBin.points)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="font-numeric-data text-[12px]">
                  <td className="px-2 py-1 font-label-caps text-[10px] tracking-[0.08em] text-secondary">Sum</td>
                  <td className="px-2 py-1" />
                  <td className="px-2 py-1">{fmtInt(totalN)}</td>
                  <td className="px-2 py-1">{fmtPct(totalN / lab.dataset.rowCount)}</td>
                  <td className="px-2 py-1 text-tertiary">{fmtPct(totalN ? totalEvents / totalN : 0)}</td>
                  <td className="px-2 py-1" />
                  <td className="px-2 py-1">{fmt(totalIv, 3)}</td>
                  <td className="px-2 py-1">{fmtInt(pointSpread)}</td>
                </tr>
              </tfoot>
            </table>
            <p
              className="truncate border-t border-outline-variant px-3 py-1.5 font-numeric-data text-[11px] text-secondary"
              title={lab.dataset.issues.map((issue) => issue.message).join(" · ")}
            >
              {ms} · {violations} violation{violations === 1 ? "" : "s"} · {degenerate} degenerate · PDO {fmtInt(lab.settings.pdo)} / base {fmtInt(lab.settings.baseScore)} / odds {fmtInt(lab.settings.odds)}:1
              {lab.dataset.issues.length > 0 && (
                <span data-testid="warning-line"> · {lab.dataset.issues.map((issue) => issue.message).join(" · ")}</span>
              )}
            </p>
          </div>
        </section>

        <div className="col-span-3 flex flex-col gap-3">
          <section className="border border-outline-variant bg-surface-container-lowest px-3 py-2">
            <h2 className="font-label-caps text-[10px] tracking-[0.14em]">Model separation</h2>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div data-testid="model-auc">
                <div className="font-label-caps text-[10px] tracking-[0.1em] text-secondary">AUC</div>
                <div className="font-numeric-data text-[1.15rem] leading-none">{fmt(lab.model.auc, 3)}</div>
              </div>
              <div data-testid="model-ks">
                <div className="font-label-caps text-[10px] tracking-[0.1em] text-secondary">KS</div>
                <div className="font-numeric-data text-[1.15rem] leading-none">{fmt(lab.model.ks, 3)}</div>
              </div>
              <div data-testid="model-gini">
                <div className="font-label-caps text-[10px] tracking-[0.1em] text-secondary">Gini</div>
                <div className="font-numeric-data text-[1.15rem] leading-none">{fmt(lab.model.gini, 3)}</div>
              </div>
            </div>
            <div className="mt-2">
              <div className="font-label-caps text-[10px] tracking-[0.1em] text-secondary">Aggregate IV</div>
              <div className="font-display text-[2.5rem] font-normal italic leading-none tracking-tight">{fmt(aggregateIv, 3)}</div>
            </div>
            <div className="mt-2 h-24">
              <KsFigure curve={lab.model.curve} ksAt={lab.model.ksAt} />
            </div>
            <div className="mt-1 h-16">
              <Silhouette bins={lab.model.histogram.bins} cutoff={lab.t1} />
            </div>
            <div className="mt-2 border-t border-outline-variant pt-2" data-testid="studio-economics">
              <div className="font-label-caps text-[10px] tracking-[0.1em] text-secondary">
                At {fmtPct(lab.accept1)} accept
              </div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <div>
                  <div className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">Profit</div>
                  <div data-testid="studio-profit" className="font-numeric-data text-[1.05rem] leading-none">
                    {fmtInt(lab.stats1.profit)}
                  </div>
                </div>
                <div>
                  <div className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">Δ vs random</div>
                  <div
                    data-testid="studio-profit-delta"
                    className={`font-numeric-data text-[1.05rem] leading-none ${lab.stats1.delta >= 0 ? "text-primary" : "text-tertiary"}`}
                  >
                    {fmtDelta(lab.stats1.delta)}
                  </div>
                </div>
              </div>
              <p className="mt-1 font-body-sm text-[11px] text-secondary">Same acceptance rate. Weaker AUC lowers both figures.</p>
            </div>
          </section>
          <section className="border border-outline-variant bg-surface-container-lowest px-3 py-2">
            <h2 className="font-label-caps text-[10px] tracking-[0.14em]">Export model artifacts</h2>
            <div className="mt-1">
              <SideExport testId="side-points" label="Points CSV" onClick={lab.exportPoints} />
              <SideExport testId="side-python" label="Python snippet" onClick={lab.exportPython} />
              <SideExport testId="side-json" label="Cut-points JSON" onClick={lab.exportJson} />
              <SideExport
                testId="side-dossier"
                label="Session record"
                hint="Not a regulatory certification."
                onClick={lab.exportDossier}
              />
            </div>
          </section>
        </div>
      </div>

      <section className="mt-3 border border-outline-variant bg-surface-container-lowest">
        <h2 className="border-b border-outline-variant px-3 py-2 font-label-caps text-[10px] tracking-[0.14em]">Integrated Scorecard Points Allocation</h2>
        <div className="grid grid-cols-6">
          {lab.model.variables.map((item) => {
            const on = item.name === variable.name
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => lab.setActive(item.name)}
                className={`min-w-0 border-t-2 px-2 py-2 text-left ${on ? "border-primary" : "border-outline-variant"}`}
              >
                <div className="truncate font-body-sm text-[11px]">{item.name}</div>
                <div className="font-numeric-data text-[11px] text-secondary">{fmt(item.iv, 3)} IV</div>
                <div className="mt-1 space-y-0.5">
                  {item.bins.slice(0, 4).map((bin, index) => (
                    <div key={index} className="flex justify-between font-numeric-data text-[11px]">
                      <span className="text-secondary">{String(index + 1).padStart(2, "0")}</span>
                      <span className="text-primary">{fmtInt(bin.points)}</span>
                    </div>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </PageWrap>
  )
}

function countViolations(variable: VariableModel): number {
  let count = 0
  for (let index = 1; index < variable.bins.length; index += 1) {
    const previous = variable.bins[index - 1].eventRate
    const current = variable.bins[index].eventRate
    const holds = variable.direction === 1 ? current > previous : current < previous
    if (!holds) count += 1
  }
  return count
}

function Spark({ rates }: { rates: number[] }) {
  if (rates.length < 2) return null
  const w = 44
  const h = 16
  const min = Math.min(...rates)
  const max = Math.max(...rates)
  const span = max - min || 1
  const d = rates
    .map((rate, index) => {
      const x = (index / (rates.length - 1)) * w
      const y = h - ((rate - min) / span) * (h - 2) - 1
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(" ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-4 w-11 shrink-0" aria-hidden>
      <path d={d} fill="none" stroke="#0037b0" strokeWidth="1.4" />
    </svg>
  )
}

function Metric({ testId, label, value, icon }: { testId: string; label: string; value: string; icon?: string }) {
  return (
    <div data-testid={testId}>
      <div className="font-label-caps text-[10px] tracking-[0.12em] text-secondary">{label}</div>
      <div className="flex items-center gap-1 font-numeric-data text-[1.25rem] leading-none tracking-tight">
        {icon && <span className="material-symbols-outlined text-primary">{icon}</span>}
        {value}
      </div>
    </div>
  )
}

function Action({
  testId,
  icon,
  label,
  onClick,
  filled = false,
}: {
  testId: string
  icon: string
  label: string
  onClick: () => void
  filled?: boolean
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`inline-flex items-center gap-1 border px-2 py-1 text-[12px] ${
        filled
          ? "border-on-surface bg-on-surface text-inverse-on-surface"
          : "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container"
      }`}
    >
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
      {label}
    </button>
  )
}

function formatField(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000)
}

function Field({
  testId,
  label,
  value,
  onCommit,
}: {
  testId: string
  label: string
  value: number
  onCommit: (value: number) => void
}) {
  const [text, setText] = useState(() => formatField(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(formatField(value))
  }, [value])
  return (
    <label className="mt-1 flex items-center justify-between gap-2">
      <span className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">{label}</span>
      <input
        data-testid={testId}
        value={text}
        onFocus={() => {
          focused.current = true
        }}
        onBlur={() => {
          focused.current = false
          setText(formatField(value))
        }}
        onChange={(event) => {
          setText(event.target.value)
          const next = Number(event.target.value)
          if (event.target.value.trim() !== "" && Number.isFinite(next)) onCommit(next)
        }}
        className="w-16 border border-outline-variant bg-surface px-1.5 py-0.5 text-right font-numeric-data text-[12px] outline-none"
      />
    </label>
  )
}

function SideExport({ testId, label, hint, onClick }: { testId: string; label: string; hint?: string; onClick: () => void }) {
  return (
    <button type="button" data-testid={testId} onClick={onClick} className="flex w-full items-center justify-between gap-2 border-b border-outline-variant py-1.5 text-left last:border-b-0 hover:text-primary">
      <span>
        <span className="block font-body-sm text-[12px]">{label}</span>
        {hint && <span className="block font-body-sm text-[11px] text-secondary">{hint}</span>}
      </span>
      <span className="material-symbols-outlined text-[16px] text-secondary">arrow_downward</span>
    </button>
  )
}
