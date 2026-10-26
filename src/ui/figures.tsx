import type { HistBin } from "../engine/stats"
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
  const h = tall ? 360 : 120
  const m = { l: 28, r: 8, t: 8, b: 18 }
  const iw = w - m.l - m.r
  const ih = h - m.t - m.b
  const x = (t: number) => m.l + t * iw
  const y = (v: number) => m.t + (1 - v) * ih
  const path = (key: "events" | "nonEvents") =>
    curve.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.t)} ${y(point[key])}`).join(" ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" data-testid={tall ? "ks-curve" : "ks-mini"}>
      <line x1={m.l} x2={w - m.r} y1={y(0)} y2={y(0)} stroke="#c4c5d7" />
      <line x1={m.l} x2={m.l} y1={m.t} y2={y(0)} stroke="#c4c5d7" />
      <path d={path("nonEvents")} fill="none" stroke="#0037b0" strokeWidth="1.8" />
      <path d={path("events")} fill="none" stroke="#a83300" strokeWidth="1.8" />
      <line x1={x(ksAt)} x2={x(ksAt)} y1={m.t} y2={y(0)} stroke="#141b2b" strokeDasharray="3 3" />
    </svg>
  )
}

export function Silhouette({
  bins,
  tall = false,
}: {
  bins: HistBin[]
  tall?: boolean
}) {
  const w = 640
  const h = tall ? 220 : 88
  const m = { l: 8, r: 8, t: 8, b: 8 }
  const iw = w - m.l - m.r
  const ih = h - m.t - m.b
  const max = Math.max(...bins.map((bin) => Math.max(bin.events, bin.nonEvents)), 1)
  const step = iw / bins.length
  const area = (key: "events" | "nonEvents") => {
    const pts = bins.map((bin, index) => {
      const px = m.l + index * step + step / 2
      const py = m.t + ih - (bin[key] / max) * ih
      return `${px} ${py}`
    })
    return `M ${m.l} ${m.t + ih} L ${pts.join(" L ")} L ${m.l + iw} ${m.t + ih} Z`
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" data-testid={tall ? "score-histogram" : "score-silhouette"}>
      <path d={area("nonEvents")} fill="#1d4ed8" opacity="0.45" />
      <path d={area("events")} fill="#a83300" opacity="0.55" />
    </svg>
  )
}
