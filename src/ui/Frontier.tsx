import { fmt, fmtDelta, fmtInt, fmtPct } from "../format"
import { useLab } from "../state/lab"
import { PageWrap, SectionKicker } from "./chrome"
import { ProfitCurve, Silhouette } from "./figures"

export function Frontier() {
  const lab = useLab()
  if (!lab.dataset || !lab.model) return null
  const min = lab.model.histogram.min
  const max = lab.model.histogram.max
  const span = Math.max(1e-6, max - min)
  const shift = lab.stats2.profit - lab.stats1.profit

  return (
    <PageWrap>
      <div data-testid="frontier">
        <SectionKicker index="04" label="FRONTIER & ECONOMIC IMPACT" meta={`${fmtInt(lab.dataset.rowCount)} observations · AUC ${fmt(lab.model.auc, 3)}`} />
        <h1 className="mt-1 font-display text-[2.25rem] font-normal italic leading-none tracking-tight">Pin the acceptance rate, then read the profit</h1>
        <p className="mt-2 max-w-3xl font-body-sm text-[13px] text-secondary">
          Higher points are riskier, so the safest share of the book is accepted first. Hold the acceptance rate fixed.
          If AUC falls, more bads enter that same share and profit falls. Δ vs random is the extra profit from ranking
          instead of taking that share of the book at random.
        </p>
        <div className="relative mt-4 h-64 border border-outline-variant bg-surface-container-lowest">
          <Silhouette bins={lab.model.histogram.bins} tall />
          <ThresholdMarkers a={lab.t1} b={lab.t2} min={min} span={span} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <PolicyCard
            title="Policy A"
            testPrefix="a"
            rate={lab.accept1}
            onChange={lab.setAccept1}
            stats={lab.stats1}
          />
          <PolicyCard
            title="Policy B"
            testPrefix="b"
            rate={lab.accept2}
            onChange={lab.setAccept2}
            stats={lab.stats2}
          />
        </div>
        <div
          data-testid="profit-shift"
          className="mt-3 border border-outline-variant bg-surface-container-lowest px-3 py-3"
        >
          <div className="font-label-caps text-[10px] tracking-[0.14em] text-secondary">Profit change A → B</div>
          <p className="mt-1 font-body-sm text-[13px] text-on-surface">
            At {fmtPct(lab.stats2.approval)} acceptance instead of {fmtPct(lab.stats1.approval)}, profit{" "}
            <span className={shift >= 0 ? "text-primary" : "text-tertiary"} data-testid="profit-shift-value">
              {fmtDelta(shift)}
            </span>
            . Bad rate moves from {fmtPct(lab.stats1.eventRate)} to {fmtPct(lab.stats2.eventRate)}.
          </p>
        </div>
        <section className="mt-3 border border-outline-variant bg-surface-container-lowest p-3">
          <h2 className="font-label-caps text-[10px] tracking-[0.14em]">Profit versus acceptance rate</h2>
          <p className="font-body-sm text-[12px] text-secondary">
            Cobalt is the scorecard. The dashed line is a random book at the same rate. A weaker AUC pulls cobalt toward the dash.
          </p>
          <div className="mt-1 h-44">
            <ProfitCurve
              points={lab.curve}
              a={{ rate: lab.stats1.approval, profit: lab.stats1.profit }}
              b={{ rate: lab.stats2.approval, profit: lab.stats2.profit }}
            />
          </div>
        </section>
        <div className="mt-3 flex flex-wrap gap-6 border border-outline-variant bg-surface-container-lowest px-3 py-3">
          <Money label="Profit per good" testId="profit-good" value={lab.profitGood} onChange={lab.setProfitGood} />
          <Money label="Loss per bad" testId="loss-bad" value={lab.lossBad} onChange={lab.setLossBad} />
        </div>
      </div>
    </PageWrap>
  )
}

function ThresholdMarkers({ a, b, min, span }: { a: number; b: number; min: number; span: number }) {
  const pos = (value: number) => Math.min(98, Math.max(1, ((value - min) / span) * 100))
  const leftA = pos(a)
  const leftB = pos(b)
  const close = Math.abs(leftA - leftB) < 8
  return (
    <>
      <Marker left={leftA} label="A" offsetTop={false} flip={close && leftA > leftB} />
      <Marker left={leftB} label="B" offsetTop={close} flip={close && leftB > leftA} />
    </>
  )
}

function Marker({ left, label, offsetTop, flip }: { left: number; label: string; offsetTop: boolean; flip: boolean }) {
  return (
    <div className="pointer-events-none absolute bottom-0 top-0 border-l border-dashed border-primary" style={{ left: `${left}%` }}>
      <span
        className={`absolute font-label-caps text-[10px] tracking-[0.12em] text-primary ${
          offsetTop ? "top-5" : "top-1"
        } ${flip ? "right-1" : "left-1"}`}
      >
        {label}
      </span>
    </div>
  )
}

function PolicyCard({
  title,
  testPrefix,
  rate,
  onChange,
  stats,
}: {
  title: string
  testPrefix: string
  rate: number
  onChange: (value: number) => void
  stats: {
    approval: number
    eventRate: number
    accepted: number
    threshold: number
    profit: number
    randomProfit: number
    delta: number
  }
}) {
  return (
    <div className="border border-outline-variant bg-surface-container-lowest p-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-label-caps text-[10px] tracking-[0.14em]">{title}</h2>
        <span className="font-numeric-data text-[13px]" data-testid={`acceptance-value-${testPrefix}`}>
          {fmtPct(rate)}
        </span>
      </div>
      <label className="mt-2 block">
        <span className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">Acceptance rate</span>
        <input
          data-testid={`acceptance-${testPrefix}`}
          type="range"
          min={0}
          max={1}
          step={0.005}
          value={rate}
          onChange={(event) => onChange(Number(event.target.value))}
          className="mt-1 w-full"
        />
      </label>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <dt className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">Approval</dt>
          <dd data-testid={`approval-${testPrefix}`} className="font-numeric-data text-[1.15rem]">
            {fmtPct(stats.approval)}
          </dd>
        </div>
        <div>
          <dt className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">Profit</dt>
          <dd data-testid={`profit-${testPrefix}`} className="font-numeric-data text-[1.15rem]">
            {fmtInt(stats.profit)}
          </dd>
        </div>
        <div>
          <dt className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">Bad rate</dt>
          <dd data-testid={`bad-rate-${testPrefix}`} className="font-numeric-data text-[1.15rem] text-tertiary">
            {fmtPct(stats.eventRate)}
          </dd>
        </div>
      </dl>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        <div>
          <dt className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">Score cutoff</dt>
          <dd data-testid={`threshold-value-${testPrefix}`} className="font-numeric-data text-[13px]">
            {fmtInt(stats.threshold)}
          </dd>
        </div>
        <div>
          <dt className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">Random-book profit</dt>
          <dd data-testid={`random-profit-${testPrefix}`} className="font-numeric-data text-[13px] text-secondary">
            {fmtInt(stats.randomProfit)}
          </dd>
        </div>
        <div>
          <dt className="font-label-caps text-[10px] tracking-[0.08em] text-secondary">Δ vs random</dt>
          <dd
            data-testid={`profit-delta-${testPrefix}`}
            className={`font-numeric-data text-[13px] ${stats.delta >= 0 ? "text-primary" : "text-tertiary"}`}
          >
            {fmtDelta(stats.delta)}
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
