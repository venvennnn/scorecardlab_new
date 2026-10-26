import type { CurvePoint, HistBin } from "../engine/stats"
import type { KsPoint } from "../engine/scorecard"

export function KsFigure({
  curve,
  ksAt,
  tall = false,
}: {
  curve: KsPoint[]
  ksAt: number
  tall?: boolean
}) {
  const w = 640
  const h = tall ? 320 : 132
  const m = { l: 28, r: 10, t: 8, b: 16 }
  const iw = w - m.l - m.r
  const ih = h - m.t - m.b
  const x = (t: number) => m.l + t * iw
  const y = (v: number) => m.t + (1 - v) * ih
  const path = (key: "events" | "nonEvents") =>
    curve.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.t)} ${y(point[key])}`).join(" ")
  const at = curve.reduce((best, point) => (Math.abs(point.t - ksAt) < Math.abs(best.t - ksAt) ? point : best), curve[0])
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" data-testid={tall ? "ks-curve" : "ks-mini"}>
      <line x1={m.l} x2={w - m.r} y1={y(0)} y2={y(0)} stroke="#c4c5d7" />
      <path d={path("nonEvents")} fill="none" stroke="#0037b0" strokeWidth="1.6" />
      <path d={path("events")} fill="none" stroke="#a83300" strokeWidth="1.6" />
      {at && (
        <line
          x1={x(at.t)}
          x2={x(at.t)}
          y1={y(at.nonEvents)}
          y2={y(at.events)}
          stroke="#141b2b"
          strokeDasharray="3 2"
        />
      )}
    </svg>
  )
}

export function Silhouette({
  bins,
  tall = false,
  cutoff,
}: {
  bins: HistBin[]
  tall?: boolean
  cutoff?: number
}) {
  const w = 640
  const h = tall ? 200 : 72
  const m = { l: 4, r: 4, t: 6, b: 4 }
  const iw = w - m.l - m.r
  const ih = h - m.t - m.b
  const max = Math.max(...bins.map((bin) => Math.max(bin.events, bin.nonEvents)), 1)
  const step = iw / Math.max(1, bins.length)
  const area = (key: "events" | "nonEvents") => {
    const pts = bins.map((bin, index) => {
      const px = m.l + index * step + step / 2
      const py = m.t + ih - (bin[key] / max) * ih
      return `${px} ${py}`
    })
    return `M ${m.l} ${m.t + ih} L ${pts.join(" L ")} L ${m.l + iw} ${m.t + ih} Z`
  }
  const span = bins.length ? bins[bins.length - 1].hi - bins[0].lo : 1
  const cutX =
    cutoff == null || !bins.length ? null : m.l + Math.min(1, Math.max(0, (cutoff - bins[0].lo) / (span || 1))) * iw
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" data-testid={tall ? "score-histogram" : "score-silhouette"}>
      <path d={area("nonEvents")} fill="#dce1ff" />
      <path d={area("events")} fill="#a83300" opacity="0.45" />
      {cutX != null && <line x1={cutX} x2={cutX} y1={m.t} y2={m.t + ih} stroke="#0037b0" strokeDasharray="3 2" />}
    </svg>
  )
}

export function ProfitCurve({
  points,
  a,
  b,
}: {
  points: CurvePoint[]
  a: { rate: number; profit: number }
  b: { rate: number; profit: number }
}) {
  const w = 640
  const h = 180
  const m = { l: 44, r: 12, t: 10, b: 22 }
  const iw = w - m.l - m.r
  const ih = h - m.t - m.b
  const values = points.flatMap((point) => [point.profit, point.randomProfit])
  let min = Math.min(...values, a.profit, b.profit, 0)
  let max = Math.max(...values, a.profit, b.profit, 0)
  if (max - min < 1) {
    min -= 1
    max += 1
  }
  const x = (rate: number) => m.l + rate * iw
  const y = (value: number) => m.t + (1 - (value - min) / (max - min)) * ih
  const path = (key: "profit" | "randomProfit") =>
    points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.rate)} ${y(point[key])}`).join(" ")
  const zero = min < 0 && max > 0 ? y(0) : null
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" data-testid="profit-curve">
      <line x1={m.l} x2={w - m.r} y1={y(min)} y2={y(min)} stroke="#c4c5d7" />
      {zero != null && <line x1={m.l} x2={w - m.r} y1={zero} y2={zero} stroke="#c4c5d7" strokeDasharray="2 3" />}
      <path d={path("randomProfit")} fill="none" stroke="#747686" strokeWidth="1.2" strokeDasharray="4 3" />
      <path d={path("profit")} fill="none" stroke="#0037b0" strokeWidth="1.8" />
      <Marker x={x(a.rate)} y={y(a.profit)} label="A" />
      <Marker x={x(b.rate)} y={y(b.profit)} label="B" />
      <text x={m.l} y={h - 6} fill="#515f74" fontSize="10" fontFamily="JetBrains Mono, ui-monospace, monospace">
        0%
      </text>
      <text x={w - m.r} y={h - 6} textAnchor="end" fill="#515f74" fontSize="10" fontFamily="JetBrains Mono, ui-monospace, monospace">
        100% accept
      </text>
    </svg>
  )
}

function Marker({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="3.5" fill="#0037b0" />
      <text x={x + 6} y={y - 6} fill="#0037b0" fontSize="10" fontFamily="Hanken Grotesk, sans-serif">
        {label}
      </text>
    </g>
  )
}
