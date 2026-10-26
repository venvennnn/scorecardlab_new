import { fmt, fmtInt } from "../format"
import { useLab } from "../state/lab"
import { KsFigure, Silhouette } from "./figures"

export function Diagnostics() {
  const lab = useLab()
  return (
    <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
      <p className="font-label-caps text-[10px] tracking-[0.14em] text-secondary">02 — Model diagnostics</p>
      <h1 className="font-display text-headline-lg">Separation of the summed score</h1>
      <p className="max-w-3xl text-body-md text-secondary">
        KS is the widest gap between the cumulative event and non-event curves. Gini is twice the ROC area, minus one. Higher points rank the riskier accounts.
      </p>
      <div className="mt-5 grid grid-cols-3 gap-6 border-y border-outline-variant py-4">
        <Stat label="KS" value={fmt(lab.model.ks, 3)} testId="diag-ks" />
        <Stat label="AUC" value={fmt(lab.model.auc, 3)} testId="diag-auc" />
        <Stat label="Gini" value={fmt(lab.model.gini, 3)} testId="diag-gini" />
      </div>
      <div className="mt-5 grid grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] gap-6">
        <div className="border border-outline-variant bg-surface-container-lowest p-3">
          <h2 className="font-label-caps text-[10px] tracking-[0.14em]">KS curve</h2>
          <p className="text-body-sm text-secondary">Cobalt non-events, coral events. The dashed line marks the KS.</p>
          <div className="h-80">
            <KsFigure curve={lab.model.curve} ksAt={lab.model.ksAt} tall />
          </div>
        </div>
        <div className="border border-outline-variant bg-surface-container-lowest p-3">
          <h2 className="font-label-caps text-[10px] tracking-[0.14em]">Score distribution</h2>
          <p className="text-body-sm text-secondary">
            {fmtInt(lab.model.histogram.min)} to {fmtInt(lab.model.histogram.max)}
          </p>
          <div className="h-52">
            <Silhouette bins={lab.model.histogram.bins} tall />
          </div>
          <table className="mt-4 w-full text-left">
            <thead>
              <tr className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">
                <th className="py-1 font-semibold">Variable</th>
                <th className="py-1 font-semibold">IV</th>
                <th className="py-1 font-semibold">Gini</th>
              </tr>
            </thead>
            <tbody className="font-numeric-data text-[12px]">
              {lab.model.variables.map((variable) => (
                <tr key={variable.name} className="border-t border-outline-variant">
                  <td className="py-1 pr-2 font-body-sm text-[12px]">{variable.name}</td>
                  <td>{fmt(variable.iv, 3)}</td>
                  <td>{fmt(variable.gini, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div data-testid={testId}>
      <div className="font-label-caps text-[10px] tracking-[0.14em] text-secondary">{label}</div>
      <div className="font-numeric-metric text-numeric-metric">{value}</div>
    </div>
  )
}
