import { fmtInt, fmtPct } from "../format"
import { useLab } from "../state/lab"
import { PageWrap, SectionKicker } from "./chrome"
import { Silhouette } from "./figures"

export function Frontier() {
  const lab = useLab()
  const min = lab.model.histogram.min
  const max = lab.model.histogram.max
  const span = Math.max(1e-6, max - min)
  const profit = (stats: { nonEvents: number; events: number }) => stats.nonEvents * lab.profitGood - stats.events * lab.lossBad

  return (
    <PageWrap>
      <div data-testid="frontier">
        <SectionKicker index="04" label="FRONTIER & ECONOMIC IMPACT" meta={`${fmtInt(lab.dataset.rowCount)} observations`} />
        <h1 className="mt-1 font-display text-[2.25rem] font-normal italic leading-none tracking-tight">Accept the safer side of the score</h1>
        <p className="mt-2 max-w-3xl font-body-sm text-[13px] text-secondary">
          Higher points are riskier, because points fall as Weight of Evidence rises. Accounts with a score at or below the threshold are accepted.
        </p>
        <div className="relative mt-4 h-64 border border-outline-variant bg-surface-container-lowest">
          <Silhouette bins={lab.model.histogram.bins} tall />
          <Marker value={lab.t1} min={min} span={span} label="A" />
          <Marker value={lab.t2} min={min} span={span} label="B" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <ThresholdCard
            title="Threshold A"
            testPrefix="a"
            value={lab.t1}
            min={min}
            max={max}
            onChange={lab.setThreshold1}
            stats={lab.stats1}
            profit={profit(lab.stats1)}
          />
          <ThresholdCard
            title="Threshold B"
            testPrefix="b"
            value={lab.t2}
            min={min}
            max={max}
            onChange={lab.setThreshold2}
            stats={lab.stats2}
            profit={profit(lab.stats2)}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-6 border border-outline-variant bg-surface-container-lowest px-3 py-3">
          <Money label="Profit per good" testId="profit-good" value={lab.profitGood} onChange={lab.setProfitGood} />
          <Money label="Loss per bad" testId="loss-bad" value={lab.lossBad} onChange={lab.setLossBad} />
        </div>
      </div>
    </PageWrap>
  )
}

function Marker({ value, min, span, label }: { value: number; min: number; span: number; label: string }) {
  const left = `${Math.min(98, Math.max(1, ((value - min) / span) * 100))}%`
  return (
    <div className="pointer-events-none absolute bottom-0 top-0 border-l border-dashed border-primary" style={{ left }}>
      <span className="absolute left-1 top-1 font-label-caps text-[10px] tracking-[0.12em] text-primary">{label}</span>
    </div>
  )
}

function ThresholdCard({
  title,
  testPrefix,
  value,
  min,
  max,
  onChange,
  stats,
  profit,
}: {
  title: string
  testPrefix: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  stats: { approval: number; eventRate: number; accepted: number }
  profit: number
}) {
  return (
    <div className="border border-outline-variant bg-surface-container-lowest p-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-label-caps text-[10px] tracking-[0.14em]">{title}</h2>
        <span className="font-numeric-data text-[13px]" data-testid={`threshold-value-${testPrefix}`}>
          {fmtInt(value)}
        </span>
      </div>
      <input
        data-testid={`threshold-${testPrefix}`}
        type="range"
        min={min}
        max={max}
        step={(max - min) / 200}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full"
      />
      <dl className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <dt className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">Approval</dt>
          <dd data-testid={`approval-${testPrefix}`} className="font-numeric-data text-[1.15rem]">
            {fmtPct(stats.approval)}
          </dd>
        </div>
        <div>
          <dt className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">Accepted event rate</dt>
          <dd data-testid={`event-rate-${testPrefix}`} className="font-numeric-data text-[1.15rem] text-tertiary">
            {fmtPct(stats.eventRate)}
          </dd>
        </div>
        <div>
          <dt className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">Profit</dt>
          <dd data-testid={`profit-${testPrefix}`} className="font-numeric-data text-[1.15rem]">
            {fmtInt(profit)}
          </dd>
        </div>
      </dl>
      <p className="mt-2 font-numeric-data text-[12px] text-secondary">{fmtInt(stats.accepted)} accounts accepted.</p>
    </div>
  )
}

function Money({
  label,
  testId,
  value,
  onChange,
}: {
  label: string
  testId: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="font-label-caps text-[10px] tracking-[0.12em] text-secondary">{label}</span>
      <input
        data-testid={testId}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-28 border border-outline-variant bg-surface px-2 py-1 text-right font-numeric-data outline-none"
      />
    </label>
  )
}
