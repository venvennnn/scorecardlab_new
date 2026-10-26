import { useEffect, useRef, useState } from "react"
import { fmtInt } from "../format"
import { useLab } from "../state/lab"
import type { Section } from "../state/useScorecard"

const NAV: { id: Section; label: string; test: string }[] = [
  { id: "studio", label: "Binning Studio", test: "nav-studio" },
  { id: "diagnostics", label: "Model Diagnostics", test: "nav-diagnostics" },
  { id: "points", label: "Scorecard Points", test: "nav-points" },
  { id: "frontier", label: "Frontier & Economic Impact", test: "nav-frontier" },
]

export function Header() {
  const lab = useLab()
  const fileRef = useRef<HTMLInputElement>(null)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setPresetsOpen(false)
        setExportOpen(false)
      }
    }
    window.addEventListener("mousedown", onDown)
    return () => window.removeEventListener("mousedown", onDown)
  }, [])

  const ms = lab.model.ms < 1 ? "<1 ms" : `${Math.round(lab.model.ms)} ms`

  return (
    <header className="shrink-0 border-b border-outline-variant bg-surface">
      <div className="flex h-12 items-center gap-4 px-4">
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 bg-primary" />
          <span className="font-display text-[1.45rem] leading-none tracking-tight">ScorecardLab</span>
        </div>
        <span className="h-6 w-px bg-outline-variant" />
        <button
          type="button"
          data-testid="dataset-button"
          className="text-left"
          onClick={() => fileRef.current?.click()}
          title="Upload a UTF-8 CSV"
        >
          <div className="font-label-caps text-[10px] tracking-[0.12em] text-secondary">Dataset</div>
          <div className="font-numeric-data text-[12px] leading-none">{lab.dataset.name}</div>
        </button>
        <input
          ref={fileRef}
          data-testid="file-input"
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) lab.onFile(file)
            event.target.value = ""
          }}
        />
        <div>
          <div className="font-label-caps text-[10px] tracking-[0.12em] text-secondary">Target</div>
          {lab.candidates.length > 1 ? (
            <select
              data-testid="target-select"
              value={lab.dataset.target}
              onChange={(event) => lab.onTarget(event.target.value)}
              className="bg-transparent font-numeric-data text-[12px] leading-none outline-none"
            >
              {lab.candidates.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          ) : (
            <div data-testid="target-name" className="font-numeric-data text-[12px] leading-none">
              {lab.dataset.target}
            </div>
          )}
        </div>
        <div
          data-testid="engine-chip"
          className="flex items-center gap-2 border border-outline-variant px-2 py-1"
          title="JavaScript engine. Timing is measured in this browser."
        >
          <span className={`h-1.5 w-1.5 ${lab.slow ? "bg-tertiary" : "bg-primary"}`} />
          <span className="font-label-caps text-[10px] tracking-[0.14em] text-primary">JS</span>
          <span className="font-numeric-data text-[12px]">{lab.slow ? "Recalculating" : ms}</span>
        </div>
        <div className="ml-auto flex items-center gap-2" ref={menuRef}>
          <span className="hidden font-numeric-data text-[11px] text-secondary xl:inline">
            {fmtInt(lab.dataset.rowCount)} rows
          </span>
          <div className="relative">
            <button
              type="button"
              data-testid="preset-btn"
              className="inline-flex items-center gap-1 border border-outline-variant px-2.5 py-1.5 font-label-caps text-[10px] tracking-[0.12em]"
              onClick={() => {
                setPresetsOpen((open) => !open)
                setExportOpen(false)
              }}
            >
              <span className="material-symbols-outlined">tune</span>
              Presets
            </button>
            {presetsOpen && (
              <div className="absolute right-0 z-20 mt-1 w-64 border border-outline-variant bg-surface-container-lowest shadow-none">
                <button
                  type="button"
                  data-testid="preset-defaults"
                  className="block w-full px-3 py-2 text-left hover:bg-surface-container"
                  onClick={() => {
                    lab.applyPreset("defaults")
                    setPresetsOpen(false)
                  }}
                >
                  <div className="font-headline-sm text-[13px]">Spec defaults</div>
                  <div className="text-body-sm text-secondary">Min bin 5%, PDO 20, score 600, odds 50:1</div>
                </button>
                <button
                  type="button"
                  data-testid="preset-strict"
                  className="block w-full border-t border-outline-variant px-3 py-2 text-left hover:bg-surface-container"
                  onClick={() => {
                    lab.applyPreset("strict")
                    setPresetsOpen(false)
                  }}
                >
                  <div className="font-headline-sm text-[13px]">Stricter minimum bin</div>
                  <div className="text-body-sm text-secondary">Min bin 10%, at most 4 bins</div>
                </button>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              data-testid="export-btn"
              className="inline-flex items-center gap-1 bg-primary px-2.5 py-1.5 font-label-caps text-[10px] tracking-[0.12em] text-on-primary"
              onClick={() => {
                setExportOpen((open) => !open)
                setPresetsOpen(false)
              }}
            >
              <span className="material-symbols-outlined">download</span>
              Export
            </button>
            {exportOpen && (
              <div className="absolute right-0 z-20 mt-1 w-56 border border-outline-variant bg-surface-container-lowest">
                <ExportItem testId="export-json" label="Cut-points JSON" onClick={lab.exportJson} />
                <ExportItem testId="export-cuts-csv" label="Cut-points CSV" onClick={lab.exportCutsCsv} />
                <ExportItem testId="export-points" label="Points CSV" onClick={lab.exportPoints} />
                <ExportItem testId="export-python" label="Python snippet" onClick={lab.exportPython} />
                <ExportItem testId="export-dossier" label="Dossier · session record" onClick={lab.exportDossier} />
              </div>
            )}
          </div>
          <div
            className="grid h-8 w-8 place-items-center bg-inverse-surface font-display text-[13px] text-inverse-on-surface"
            title="Local session"
          >
            SL
          </div>
        </div>
      </div>
      <nav className="flex h-9 items-end gap-1 px-2">
        {NAV.map((item, index) => {
          const on = lab.section === item.id
          return (
            <button
              key={item.id}
              type="button"
              data-testid={item.test}
              onClick={() => lab.setSection(item.id)}
              className={`border-b-2 px-3 pb-2 font-label-caps text-[11px] tracking-[0.08em] ${
                on ? "border-primary text-primary" : "border-transparent text-secondary"
              }`}
            >
              <span className="font-numeric-data text-[11px]">{String(index + 1).padStart(2, "0")}</span> {item.label}
            </button>
          )
        })}
      </nav>
    </header>
  )
}

function ExportItem({ testId, label, onClick }: { testId: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid={testId}
      className="block w-full border-b border-outline-variant px-3 py-2 text-left text-body-sm last:border-b-0 hover:bg-surface-container"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export function Footer() {
  const lab = useLab()
  return (
    <footer className="flex h-7 shrink-0 items-center justify-between gap-4 bg-inverse-surface px-4 text-inverse-on-surface">
      <span className="font-label-caps text-[10px] tracking-[0.16em]">ScorecardLab</span>
      <span className="truncate font-body-sm text-[11px] text-inverse-primary">
        Client-side monotonic scorecard · The dossier file is a session record, not a certification
      </span>
      <span className="font-numeric-data text-[11px]">
        {lab.dataset.name} · {fmtInt(lab.dataset.rowCount)}
      </span>
    </footer>
  )
}
