import { useEffect, useRef, useState } from "react"
import { DECKS, fmt, fmtInt, fmtPct, intervalOf } from "../format"
import { useLab } from "../state/lab"
import { KsFigure, Silhouette } from "./figures"
import { WoeChart } from "./WoeChart"

export function BinningStudio() {
  const lab = useLab()
  const variable = lab.activeVariable
  const maxIv = Math.max(...lab.model.variables.map((item) => item.iv), 0.0001)
  if (!variable) return null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section className="shrink-0 border-b border-outline-variant bg-surface-container-low px-4 py-3">
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="font-label-caps text-[10px] tracking-[0.14em] text-secondary">Active variable</div>
            <h1 data-testid="active-name" className="truncate font-display text-[2rem] leading-none tracking-tight">
              {variable.name}
            </h1>
            <p className="mt-1 text-body-sm text-secondary">{DECKS[variable.name] ?? "Numeric feature, binned to a strictly monotonic event rate."}</p>
          </div>
          <div className="flex shrink-0 items-end gap-5">
            <Metric testId="metric-iv" label="IV" value={fmt(variable.iv, 3)} />
            <Metric testId="metric-gini" label="Gini" value={fmt(variable.gini, 3)} />
            <Metric testId="metric-mono" label="Monotonicity" value={variable.direction === 1 ? "Increasing" : "Decreasing"} />
            <Metric testId="metric-div" label="Max divergence" value={fmt(variable.maxDivergence, 2)} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Action testId="btn-merge" icon="call_merge" label="Merge Adjacent" onClick={lab.merge} />
          <Action testId="btn-split" icon="call_split" label="Split Cutpoint" onClick={lab.split} />
          <Action testId="btn-isotonic" icon="timeline" label="Isotonic PAV" onClick={lab.isotonic} />
          <Action testId="btn-autobin" icon="auto_fix_high" label="Auto-Bin" onClick={lab.autoBin} />
          <span data-testid="action-status" className="font-body-sm text-tertiary">
            {lab.status}
          </span>
        </div>
      </section>
      {lab.dataset.issues.length > 0 && (
        <div data-testid="warning-line" className="shrink-0 truncate border-b border-outline-variant px-4 py-1 text-body-sm text-on-tertiary-fixed-variant">
          {lab.dataset.issues.map((issue) => issue.message).join("  ·  ")}
        </div>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_300px] grid-rows-[minmax(0,1fr)_112px]">
        <aside className="flex min-h-0 flex-col border-r border-outline-variant bg-surface-container-lowest">
          <div className="flex items-baseline justify-between px-3 pt-3">
            <h2 className="font-label-caps text-[10px] tracking-[0.14em]">IV rank</h2>
            <span className="font-numeric-data text-[10px] text-secondary">top {lab.model.variables.length}</span>
          </div>
          <ol className="min-h-0 flex-1 overflow-auto">
            {lab.model.variables.map((item, index) => {
              const on = item.name === variable.name
              return (
                <li key={item.name}>
                  <button
                    type="button"
                    data-testid={`var-${item.name}`}
                    onClick={() => lab.setActive(item.name)}
                    className={`flex w-full items-start gap-2 border-l-2 px-3 py-2 text-left ${
                      on ? "border-primary bg-surface-container" : "border-transparent hover:bg-surface-container-low"
                    }`}
                  >
                    <span className="font-numeric-data text-[11px] text-secondary">{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-body-sm text-[12px]">{item.name}</span>
                      <span className="mt-1 block h-1 bg-surface-container-high">
                        <span className="block h-1 bg-primary" style={{ width: `${Math.max(4, (item.iv / maxIv) * 100)}%` }} />
                      </span>
                    </span>
                    <span className="font-numeric-data text-[11px]">{fmt(item.iv, 3)}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          <div className="border-t border-outline-variant px-3 py-2">
            <h2 className="font-label-caps text-[10px] tracking-[0.14em]">Constraints</h2>
            <p className="mt-1 text-[11px] leading-snug text-secondary">Event rate stays strictly monotonic. Higher points are riskier.</p>
            <Field testId="min-bin" label="Min bin %" value={lab.settings.minBinPct * 100} onCommit={(value) => lab.updateSetting("minBinPct", value / 100)} />
            <Field testId="max-bins" label="Max bins" value={lab.settings.maxBins} onCommit={(value) => lab.updateSetting("maxBins", value)} />
            <Field testId="laplace" label="Laplace" value={lab.settings.laplace} onCommit={(value) => lab.updateSetting("laplace", value)} />
            <Field testId="pdo" label="PDO" value={lab.settings.pdo} onCommit={(value) => lab.updateSetting("pdo", value)} />
            <Field testId="base-score" label="Base score" value={lab.settings.baseScore} onCommit={(value) => lab.updateSetting("baseScore", value)} />
            <Field testId="odds" label="Odds" value={lab.settings.odds} onCommit={(value) => lab.updateSetting("odds", value)} />
          </div>
        </aside>
        <section className="flex min-h-0 flex-col border-r border-outline-variant">
          <div className="flex items-center justify-between px-3 pt-2">
            <h2 className="font-label-caps text-[10px] tracking-[0.14em]">WoE versus population</h2>
            <div className="flex items-center gap-3 text-[11px] text-secondary">
              <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-3 bg-primary-container" /> Population</span>
              <span className="inline-flex items-center gap-1"><i className="inline-block h-0.5 w-3 bg-tertiary-container" /> WoE</span>
            </div>
          </div>
          <div className="min-h-0 flex-1 px-1">
            <WoeChart variable={variable} onDrag={lab.drag} />
          </div>
          <div className="min-h-0 max-h-[46%] overflow-auto border-t border-outline-variant" data-testid="ledger">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-surface">
                <tr className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">
                  {["Bin", "Interval", "N", "Events", "Event rate", "WoE", "IV", "Points"].map((label) => (
                    <th key={label} className="border-b border-outline-variant px-2 py-1 font-label-caps font-semibold">
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
                    <td className="px-2 py-1">{fmtInt(bin.events)}</td>
                    <td className="px-2 py-1">{fmtPct(bin.eventRate)}</td>
                    <td className="px-2 py-1">{fmt(bin.woe, 3)}</td>
                    <td className="px-2 py-1">{fmt(bin.iv, 3)}</td>
                    <td className="px-2 py-1">{fmtInt(bin.points)}</td>
                  </tr>
                ))}
                {variable.missingBin && (
                  <tr data-testid="ledger-missing">
                    <td className="px-2 py-1">—</td>
                    <td className="px-2 py-1">missing</td>
                    <td className="px-2 py-1">{fmtInt(variable.missingBin.count)}</td>
                    <td className="px-2 py-1">{fmtInt(variable.missingBin.events)}</td>
                    <td className="px-2 py-1">{fmtPct(variable.missingBin.eventRate)}</td>
                    <td className="px-2 py-1">{fmt(variable.missingBin.woe, 3)}</td>
                    <td className="px-2 py-1">{fmt(variable.missingBin.iv, 3)}</td>
                    <td className="px-2 py-1">{fmtInt(variable.missingBin.points)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="flex min-h-0 flex-col overflow-auto bg-surface-container-lowest">
          <div className="px-3 pt-3">
            <h2 className="font-label-caps text-[10px] tracking-[0.14em]">Model separation</h2>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Big testId="model-ks" label="KS" value={fmt(lab.model.ks, 3)} />
              <Big testId="model-gini" label="Gini" value={fmt(lab.model.gini, 3)} />
              <Big testId="model-auc" label="AUC" value={fmt(lab.model.auc, 3)} />
            </div>
          </div>
          <div className="mt-2 h-28 px-2">
            <KsFigure curve={lab.model.curve} ksAt={lab.model.ksAt} />
          </div>
          <div className="px-3 pt-2">
            <h2 className="font-label-caps text-[10px] tracking-[0.14em]">Score silhouette</h2>
            <p className="text-[11px] text-secondary">Cobalt non-event, coral event. Higher score is riskier.</p>
          </div>
          <div className="h-20 px-2">
            <Silhouette bins={lab.model.histogram.bins} />
          </div>
          <div className="mt-auto border-t border-outline-variant px-3 py-2">
            <h2 className="font-label-caps text-[10px] tracking-[0.14em]">Export artifacts</h2>
            <div className="mt-1 grid grid-cols-1">
              <SideExport testId="side-json" label="Cut-points JSON" onClick={lab.exportJson} />
              <SideExport testId="side-cuts" label="Cut-points CSV" onClick={lab.exportCutsCsv} />
              <SideExport testId="side-points" label="Points CSV" onClick={lab.exportPoints} />
              <SideExport testId="side-python" label="Python snippet" onClick={lab.exportPython} />
              <SideExport testId="side-dossier" label="Dossier · session record" onClick={lab.exportDossier} />
            </div>
          </div>
        </aside>
        <div className="col-span-3 flex min-h-0 border-t border-outline-variant bg-surface">
          <div className="flex w-[88px] shrink-0 items-center px-3">
            <h2 className="font-label-caps text-[10px] leading-tight tracking-[0.12em]">Points allocation</h2>
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-6">
            {lab.model.variables.map((item) => {
              const on = item.name === variable.name
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => lab.setActive(item.name)}
                  className={`min-w-0 border-l border-outline-variant px-2 py-2 text-left ${on ? "bg-surface-container" : ""}`}
                >
                  <div className="truncate font-body-sm text-[11px]">{item.name}</div>
                  <div className="font-numeric-data text-[11px] text-secondary">{fmt(item.iv, 3)} IV</div>
                  <div className="mt-1 flex flex-wrap gap-x-1.5 font-numeric-data text-[11px] text-primary">
                    {item.bins.map((bin, index) => (
                      <span key={index}>{fmtInt(bin.points)}</span>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ testId, label, value }: { testId: string; label: string; value: string }) {
  return (
    <div data-testid={testId}>
      <div className="font-label-caps text-[10px] tracking-[0.12em] text-secondary">{label}</div>
      <div className="font-numeric-data text-[1.35rem] leading-none tracking-tight">{value}</div>
    </div>
  )
}

function Action({ testId, icon, label, onClick }: { testId: string; icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-body-sm hover:bg-surface-container"
    >
      <span className="material-symbols-outlined">{icon}</span>
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
        className="w-[4.5rem] border border-outline-variant bg-surface px-1.5 py-0.5 text-right font-numeric-data text-[12px] outline-none"
      />
    </label>
  )
}

function Big({ testId, label, value }: { testId: string; label: string; value: string }) {
  return (
    <div data-testid={testId}>
      <div className="font-label-caps text-[10px] tracking-[0.1em] text-secondary">{label}</div>
      <div className="font-numeric-metric text-[1.35rem] leading-none">{value}</div>
    </div>
  )
}

function SideExport({ testId, label, onClick }: { testId: string; label: string; onClick: () => void }) {
  return (
    <button type="button" data-testid={testId} onClick={onClick} className="flex items-center justify-between py-1 text-left text-body-sm hover:text-primary">
      <span>{label}</span>
      <span className="material-symbols-outlined text-secondary">arrow_downward</span>
    </button>
  )
}
