import { useRef } from "react"
import { fmt, fmtInt } from "../format"
import { useLab } from "../state/lab"

export function Setup() {
  const lab = useLab()
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div data-testid="setup" className="flex h-full min-h-0 flex-col bg-surface">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-gutter py-10">
        <p className="font-label-caps text-[10px] tracking-[0.18em] text-secondary">SCORECARDLAB</p>
        <h1 className="mt-2 font-display text-[2.5rem] font-normal italic leading-none">Load a book, then pick the card</h1>
        <p className="mt-3 max-w-2xl font-body-sm text-[13px] text-secondary">
          Upload a UTF-8 CSV or use the seeded demo. Choose a binary target and the numeric features to keep. The
          scorecard fits logistic regression on the WoE bins and shows AUC, Gini, and KS as you change the set.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            data-testid="upload-csv"
            className="border border-outline-variant bg-surface-container-lowest px-4 py-5 text-left hover:bg-surface-container"
            onClick={() => fileRef.current?.click()}
          >
            <span className="material-symbols-outlined text-primary">upload</span>
            <div className="mt-2 font-body-sm text-[15px] text-on-surface">Upload CSV</div>
            <div className="mt-1 font-body-sm text-[12px] text-secondary">UTF-8, binary target, numeric features. Up to 50,000 rows.</div>
          </button>
          <button
            type="button"
            data-testid="use-demo"
            className="border border-on-surface bg-on-surface px-4 py-5 text-left text-inverse-on-surface"
            onClick={lab.loadDemo}
          >
            <span className="material-symbols-outlined">science</span>
            <div className="mt-2 font-body-sm text-[15px]">Use demo data</div>
            <div className="mt-1 font-body-sm text-[12px] text-inverse-on-surface/80">german_credit_25k · default_flag · 25,000 rows</div>
          </button>
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

        {lab.error && (
          <div data-testid="error-banner" className="mt-4 border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
            {lab.error}
          </div>
        )}

        {lab.dataset && lab.model && (
          <div className="mt-8 border border-outline-variant bg-surface-container-lowest p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="font-label-caps text-[10px] tracking-[0.14em] text-secondary">Dataset</div>
                <div className="font-numeric-data text-[15px]">{lab.dataset.name}</div>
              </div>
              <label className="flex items-center gap-2">
                <span className="font-label-caps text-[10px] tracking-[0.12em] text-secondary">Target</span>
                {lab.candidates.length > 1 ? (
                  <select
                    data-testid="target-select"
                    value={lab.dataset.target}
                    onChange={(event) => lab.onTarget(event.target.value)}
                    className="border border-outline-variant bg-surface px-2 py-1 font-numeric-data text-[13px] outline-none"
                  >
                    {lab.candidates.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                ) : (
                  <span data-testid="target-name" className="font-numeric-data text-[13px]">
                    {lab.dataset.target}
                  </span>
                )}
              </label>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3" data-testid="setup-performance">
              <Metric label="AUC" value={fmt(lab.model.auc, 3)} testId="setup-auc" />
              <Metric label="Gini" value={fmt(lab.model.gini, 3)} testId="setup-gini" />
              <Metric label="KS" value={fmt(lab.model.ks, 3)} testId="setup-ks" />
            </div>
            <p className="mt-2 font-body-sm text-[12px] text-secondary">
              Logistic regression on the selected WoE bins. Uncheck a feature to drop it and refit.
            </p>

            <h2 className="mt-4 font-label-caps text-[10px] tracking-[0.14em]">Features</h2>
            <ul className="mt-2 divide-y divide-outline-variant border border-outline-variant">
              {lab.dataset.features.map((feature) => {
                const on = lab.selected.includes(feature.name)
                const variable = lab.model?.variables.find((item) => item.name === feature.name)
                return (
                  <li key={feature.name}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-container-low">
                      <input
                        type="checkbox"
                        data-testid={`feature-toggle-${feature.name}`}
                        checked={on}
                        onChange={() => lab.toggleFeature(feature.name)}
                      />
                      <span className="min-w-0 flex-1 truncate font-body-sm text-[13px]">{feature.name}</span>
                      <span className="font-numeric-data text-[11px] text-secondary">
                        {variable ? `IV ${fmt(variable.iv, 3)} · β ${fmt(variable.beta, 2)}` : "off"}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="font-numeric-data text-[12px] text-secondary">
                {fmtInt(lab.selected.length)} of {fmtInt(lab.dataset.features.length)} in the card · {fmtInt(lab.dataset.rowCount)} rows
              </span>
              <button
                type="button"
                data-testid="setup-continue"
                disabled={lab.selected.length === 0}
                onClick={lab.enterLab}
                className="border border-on-surface bg-on-surface px-4 py-2 font-body-sm text-[13px] text-inverse-on-surface disabled:opacity-40"
              >
                Open Binning Studio
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div data-testid={testId} className="border border-outline-variant px-3 py-2">
      <div className="font-label-caps text-[10px] tracking-[0.12em] text-secondary">{label}</div>
      <div className="font-numeric-data text-[1.35rem] leading-none">{value}</div>
    </div>
  )
}
