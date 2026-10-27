import { useEffect, useRef, useState } from "react"
import { useLab } from "../state/lab"
import type { Section } from "../state/useScorecard"

const NAV: { id: Section; label: string; test: string }[] = [
  { id: "studio", label: "Binning Studio", test: "nav-studio" },
  { id: "diagnostics", label: "Diagnostics", test: "nav-diagnostics" },
  { id: "points", label: "Points", test: "nav-points" },
  { id: "frontier", label: "Frontier", test: "nav-frontier" },
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

  if (!lab.dataset || !lab.model) return null
  const ms = lab.model.ms < 1 ? "<1 ms" : `${Math.round(lab.model.ms)} ms`

  return (
    <header className="z-30 shrink-0 border-b border-outline-variant bg-surface-container-lowest/95 backdrop-blur-md">
      <div className="mx-auto max-w-[1440px] px-gutter">
        <div className="flex h-11 items-center gap-3">
          <div className="grid h-5 w-5 shrink-0 place-items-center border border-on-surface">
            <span className="h-2 w-2 bg-on-surface" />
          </div>
          <span className="shrink-0 font-label-caps text-[12px] tracking-[0.18em] text-on-surface">SCORECARDLAB</span>
          <span className="h-4 w-px shrink-0 bg-outline-variant" />
          <div className="flex min-w-0 flex-1 items-center gap-2 font-numeric-data text-[11px] text-secondary">
            <button
              type="button"
              data-testid="dataset-button"
              className="inline-flex min-w-0 items-center gap-1 border border-outline-variant px-1.5 py-0.5 hover:bg-surface-container"
              onClick={() => fileRef.current?.click()}
              title="Upload a UTF-8 CSV"
            >
              <span className="material-symbols-outlined text-[14px] text-primary">upload</span>
              <span className="truncate">
                DATA <span className="text-on-surface">{lab.dataset?.name ?? "—"}</span>
              </span>
            </button>
            <span aria-hidden className="hidden sm:inline">
              ·
            </span>
            <span className="hidden shrink-0 sm:inline">
              TARGET{" "}
              {lab.candidates.length > 1 ? (
                <select
                  data-testid="target-select"
                  value={lab.dataset?.target ?? ""}
                  onChange={(event) => lab.onTarget(event.target.value)}
                  className="bg-transparent font-numeric-data text-[11px] text-on-surface outline-none"
                >
                  {lab.candidates.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              ) : (
                <span data-testid="target-name" className="text-on-surface">
                  {lab.dataset?.target}
                </span>
              )}
            </span>
            <span aria-hidden className="hidden md:inline">
              ·
            </span>
            <span data-testid="engine-chip" className="hidden shrink-0 md:inline" title="JavaScript engine. Timing is measured in this browser.">
              ENGINE <span className="text-primary">JS</span> {lab.slow ? "recalculating" : ms}
            </span>
          </div>
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
          <div className="flex shrink-0 items-center gap-3" ref={menuRef}>
            <button
              type="button"
              data-testid="change-data"
              className="font-body-sm text-[13px] text-secondary hover:text-on-surface"
              onClick={lab.openSetup}
            >
              Change data
            </button>
            <button
              type="button"
              data-testid="upload-csv"
              className="inline-flex items-center gap-1 font-body-sm text-[13px] text-secondary hover:text-on-surface"
              title="Upload a UTF-8 CSV. Numeric columns are binned; pick a binary target."
              onClick={() => fileRef.current?.click()}
            >
              <span className="material-symbols-outlined text-[16px]">upload</span>
              Upload CSV
            </button>
            {lab.dataset?.id !== "german_credit_25k" && (
              <button
                type="button"
                data-testid="restore-demo"
                className="font-body-sm text-[13px] text-secondary hover:text-on-surface"
                onClick={lab.restoreDemo}
              >
                Restore demo
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                data-testid="preset-btn"
                className="font-body-sm text-[13px] text-secondary hover:text-on-surface"
                onClick={() => {
                  setPresetsOpen((open) => !open)
                  setExportOpen(false)
                }}
              >
                Presets
              </button>
              {presetsOpen && (
                <div className="absolute right-0 z-20 mt-2 w-64 border border-outline-variant bg-surface-container-lowest">
                  <button
                    type="button"
                    data-testid="preset-defaults"
                    className="block w-full px-3 py-2 text-left hover:bg-surface-container"
                    onClick={() => {
                      lab.applyPreset("defaults")
                      setPresetsOpen(false)
                    }}
                  >
                    <div className="font-body-sm text-on-surface">Spec defaults</div>
                    <div className="font-numeric-data text-[11px] text-secondary">Min bin 5% · PDO 20 · 600 · 50:1</div>
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
                    <div className="font-body-sm text-on-surface">Stricter minimum bin</div>
                    <div className="font-numeric-data text-[11px] text-secondary">Min bin 10% · at most 4 bins</div>
                  </button>
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                data-testid="export-btn"
                className="font-body-sm text-[13px] text-secondary hover:text-on-surface"
                onClick={() => {
                  setExportOpen((open) => !open)
                  setPresetsOpen(false)
                }}
              >
                Export
              </button>
              {exportOpen && (
                <div className="absolute right-0 z-20 mt-2 w-56 border border-outline-variant bg-surface-container-lowest">
                  <ExportItem testId="export-json" label="Cut-points JSON" onClick={lab.exportJson} />
                  <ExportItem testId="export-cuts-csv" label="Cut-points CSV" onClick={lab.exportCutsCsv} />
                  <ExportItem testId="export-points" label="Points CSV" onClick={lab.exportPoints} />
                  <ExportItem testId="export-python" label="Python snippet" onClick={lab.exportPython} />
                  <ExportItem testId="export-dossier" label="Session record" onClick={lab.exportDossier} />
                </div>
              )}
            </div>
            <span className="h-4 w-px bg-outline-variant" />
            <div className="grid h-8 w-8 place-items-center rounded-[999px] bg-primary text-on-primary" title="Local session">
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
          </div>
        </div>
        <nav className="flex h-10 items-center gap-1 border-t border-outline-variant">
          {NAV.map((item, index) => {
            const on = lab.section === item.id
            return (
              <button
                key={item.id}
                type="button"
                data-testid={item.test}
                onClick={() => lab.setSection(item.id)}
                className={`whitespace-nowrap rounded px-3 py-1 font-body-sm text-[13px] ${
                  on ? "bg-surface-container-highest text-on-surface" : "text-secondary hover:bg-surface-container"
                }`}
              >
                {String(index + 1).padStart(2, "0")} / {item.label}
              </button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

function ExportItem({ testId, label, onClick }: { testId: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid={testId}
      className="block w-full border-b border-outline-variant px-3 py-2 text-left font-body-sm last:border-b-0 hover:bg-surface-container"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export function Footer() {
  const lab = useLab()
  return (
    <footer className="shrink-0 border-t border-outline-variant bg-surface">
      <div className="mx-auto flex h-10 max-w-[1440px] items-center justify-between gap-4 px-gutter font-body-sm text-[12px] text-secondary">
        <span>ScorecardLab Precision Framework</span>
        <span className="hidden sm:inline">Architecture: Swiss Modern Functionalist</span>
        <span className="inline-flex items-center gap-2 font-numeric-data text-[11px] text-on-surface">
          <i className="h-1.5 w-1.5 rounded-[999px] bg-primary" />
          {lab.dataset?.name}
        </span>
      </div>
    </footer>
  )
}
