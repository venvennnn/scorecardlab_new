import { fmt, fmtInt } from "../format"
import { useLab } from "../state/lab"
import { PageWrap, SectionKicker } from "./chrome"
import { KsFigure, Silhouette } from "./figures"

export function Diagnostics() {
  const lab = useLab()
  return (
    <PageWrap>
      <SectionKicker index="02" label="MODEL DIAGNOSTICS" meta={`${fmtInt(lab.dataset.rowCount)} observations`} />
      <h1 className="mt-1 font-display text-[2.25rem] font-normal italic leading-none tracking-tight">Separation of the summed score</h1>
      <p className="mt-2 max-w-3xl font-numeric-data text-[12px] text-secondary">
        KS is the widest gap between the cumulative event and non-event curves. Gini is twice the ROC area, minus one. Higher points rank the riskier accounts.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="KS" value={fmt(lab.model.ks, 3)} testId="diag-ks" />
        <Stat label="AUC" value={fmt(lab.model.auc, 3)} testId="diag-auc" />
        <Stat label="Gini" value={fmt(lab.model.gini, 3)} testId="diag-gini" />
      </div>
      <div className="mt-4 grid grid-cols-12 gap-3">
        <section className="col-span-7 border border-outline-variant bg-surface-container-lowest p-3">
          <h2 className="font-label-caps text-[10px] tracking-[0.14em]">KS curve</h2>
          <p className="font-body-sm text-[12px] text-secondary">Cobalt cumulative goods, coral cumulative bads. The dashed line marks the KS gap.</p>
          <div className="h-72">
            <KsFigure curve={lab.model.curve} ksAt={lab.model.ksAt} tall />
          </div>
        </section>
        <section className="col-span-5 border border-outline-variant bg-surface-container-lowest p-3">
          <h2 className="font-label-caps text-[10px] tracking-[0.14em]">Score silhouette</h2>
          <p className="font-numeric-data text-[12px] text-secondary">
            {fmtInt(lab.model.histogram.min)} to {fmtInt(lab.model.histogram.max)}
          </p>
          <div className="h-40">
            <Silhouette bins={lab.model.histogram.bins} tall cutoff={lab.t1} />
          </div>
          <table className="mt-3 w-full text-left">
            <thead>
              <tr className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">
                <th className="border-b border-outline-variant py-1 font-semibold">Variable</th>
                <th className="border-b border-outline-variant py-1 font-semibold">IV</th>
                <th className="border-b border-outline-variant py-1 font-semibold">Gini</th>
              </tr>
            </thead>
            <tbody className="font-numeric-data text-[12px]">
              {lab.model.variables.map((variable) => (
                <tr key={variable.name} className="border-b border-outline-variant/70">
                  <td className="py-1 pr-2 font-body-sm text-[12px]">{variable.name}</td>
                  <td className="text-primary">{fmt(variable.iv, 3)}</td>
                  <td>{fmt(variable.gini, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </PageWrap>
  )
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div data-testid={testId} className="border border-outline-variant bg-surface-container-lowest px-3 py-2">
      <div className="font-label-caps text-[10px] tracking-[0.14em] text-secondary">{label}</div>
      <div className="font-display text-[2.25rem] font-normal italic leading-none">{value}</div>
    </div>
  )
}
