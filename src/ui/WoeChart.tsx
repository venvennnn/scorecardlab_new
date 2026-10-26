import { useRef, type PointerEvent as ReactPointerEvent } from "react"
import type { VariableModel } from "../engine/scorecard"
import { fmtCut } from "../format"

const VB_W = 760
const VB_H = 320
const TAG_W = 52

export function WoeChart({
  variable,
  onDrag,
}: {
  variable: VariableModel
  onDrag: (index: number, value: number) => void
}) {
  const ref = useRef<SVGSVGElement>(null)
  const bins = variable.bins
  if (bins.length === 0) return null

  const totalCount = bins.reduce((sum, bin) => sum + bin.count, 0) || 1
  const edges = [0]
  let acc = 0
  for (const bin of bins) {
    acc += bin.count
    edges.push(acc / totalCount)
  }

  const woes = bins.map((bin) => bin.woe)
  let wMin = Math.min(0, ...woes)
  let wMax = Math.max(0, ...woes)
  const wPad = Math.max(0.08, (wMax - wMin) * 0.18)
  wMin -= wPad
  wMax += wPad
  const rateMax = Math.max(...bins.map((bin) => bin.eventRate), 0.01) * 1.15

  const margin = { l: 28, r: 36, t: 44, b: 36 }
  const innerW = VB_W - margin.l - margin.r
  const innerH = VB_H - margin.t - margin.b
  const xPop = (p: number) => margin.l + p * innerW
  const yWoe = (value: number) => margin.t + ((wMax - value) / (wMax - wMin)) * innerH
  const yRate = (value: number) => margin.t + (1 - value / rateMax) * innerH
  const baseY = margin.t + innerH

  let step = ""
  bins.forEach((bin, index) => {
    const xL = xPop(edges[index])
    const xR = xPop(edges[index + 1])
    const y = yWoe(bin.woe)
    step += index === 0 ? `M ${xL} ${y}` : ` L ${xL} ${y}`
    step += ` L ${xR} ${y}`
  })
  const ratePath = bins
    .map((bin, index) => {
      const x = xPop((edges[index] + edges[index + 1]) / 2)
      const y = yRate(bin.eventRate)
      return `${index === 0 ? "M" : "L"} ${x} ${y}`
    })
    .join(" ")

  const tags = placeTags(
    bins.slice(0, -1).map((bin, index) => ({
      index,
      x: xPop(edges[index + 1]),
      label: fmtCut(bin.hi),
    })),
  )

  function valueFromClient(clientX: number): number {
    const svg = ref.current
    if (!svg) return bins[0]?.lo ?? 0
    const rect = svg.getBoundingClientRect()
    const px = ((clientX - rect.left) / rect.width) * VB_W
    const p = Math.min(1, Math.max(0, (px - margin.l) / innerW))
    for (let i = 0; i < bins.length; i++) {
      const loP = edges[i]
      const hiP = edges[i + 1]
      if (p <= hiP + 1e-9 || i === bins.length - 1) {
        const span = hiP - loP
        const t = span > 1e-9 ? (p - loP) / span : 0
        const lo = i === 0 ? bins[0].lo : bins[i - 1].hi
        const hi = bins[i].hi
        return lo + t * (hi - lo)
      }
    }
    return bins[bins.length - 1].hi
  }

  function startDrag(event: ReactPointerEvent<SVGGElement>, index: number) {
    event.preventDefault()
    let frame = 0
    let pending = valueFromClient(event.clientX)
    const move = (ev: PointerEvent) => {
      pending = valueFromClient(ev.clientX)
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        onDrag(index, pending)
      })
    }
    const up = () => {
      if (frame) window.cancelAnimationFrame(frame)
      onDrag(index, pending)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  return (
    <svg
      ref={ref}
      data-testid="woe-chart"
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="h-[248px] w-full touch-none select-none"
      role="img"
      aria-label="Weight of evidence versus population"
    >
      <line x1={margin.l} x2={VB_W - margin.r} y1={yWoe(0)} y2={yWoe(0)} stroke="#c4c5d7" strokeDasharray="2 3" />
      {bins.map((_bin, index) => {
        const x = xPop(edges[index]) + 1
        const width = Math.max(2, xPop(edges[index + 1]) - x - 1)
        return <rect key={`pop-${index}`} x={x} y={margin.t} width={width} height={innerH} fill="#dce1ff" opacity={0.55} />
      })}
      <path d={ratePath} fill="none" stroke="#a83300" strokeWidth="1.4" strokeDasharray="4 3" />
      {bins.map((bin, index) => {
        const cx = xPop((edges[index] + edges[index + 1]) / 2)
        const cy = yRate(bin.eventRate)
        return <circle key={`bad-${index}`} cx={cx} cy={cy} r="3.2" fill="#f9f9ff" stroke="#802500" strokeWidth="1.4" />
      })}
      <path d={step} fill="none" stroke="#0037b0" strokeWidth="1.8" />
      {bins.map((bin, index) => {
        const cx = xPop((edges[index] + edges[index + 1]) / 2)
        const cy = yWoe(bin.woe)
        return <rect key={`mk-${index}`} x={cx - 3} y={cy - 3} width="6" height="6" fill="#0037b0" />
      })}
      {bins.slice(0, -1).map((_bin, index) => {
        const x = xPop(edges[index + 1])
        const tag = tags.find((item) => item.index === index)
        return (
          <g key={`cut-${index}`} data-testid={`cut-handle-${index}`} onPointerDown={(event) => startDrag(event, index)} className="cursor-ew-resize">
            <line x1={x} x2={x} y1={8} y2={baseY} stroke="transparent" strokeWidth="14" />
            <line x1={x} x2={x} y1={margin.t} y2={baseY} stroke="#747686" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x} cy={margin.t} r="5" fill="#f9f9ff" stroke="#0037b0" strokeWidth="1.6" />
            {tag && (
              <g>
                <rect x={tag.x - TAG_W / 2} y={tag.row === 0 ? 4 : 20} width={TAG_W} height="14" fill="#0037b0" />
                <text
                  x={tag.x}
                  y={tag.row === 0 ? 14 : 30}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontFamily="JetBrains Mono, ui-monospace, monospace"
                  fontSize="9"
                >
                  {tag.label}
                </text>
              </g>
            )}
          </g>
        )
      })}
      {bins.map((bin, index) => {
        const xL = xPop(edges[index])
        const xR = xPop(edges[index + 1])
        if (xR - xL < 56) return null
        const label = index === bins.length - 1 ? `${fmtCut(index === 0 ? bins[0].lo : bins[index - 1].hi)}+` : fmtCut(bin.hi)
        return (
          <text
            key={`lab-${index}`}
            x={(xL + xR) / 2}
            y={baseY + 16}
            textAnchor="middle"
            fill="#434655"
            fontFamily="JetBrains Mono, ui-monospace, monospace"
            fontSize="10"
          >
            {label}
          </text>
        )
      })}
      <text x={VB_W - 4} y={Math.max(margin.t + 8, yWoe(Math.max(...woes)))} textAnchor="end" fill="#0037b0" fontFamily="JetBrains Mono, ui-monospace, monospace" fontSize="10">
        {Math.max(...woes).toFixed(2)}
      </text>
      <text x={VB_W - 4} y={Math.min(baseY, yWoe(Math.min(...woes)) + 4)} textAnchor="end" fill="#0037b0" fontFamily="JetBrains Mono, ui-monospace, monospace" fontSize="10">
        {Math.min(...woes).toFixed(2)}
      </text>
    </svg>
  )
}

function placeTags(items: { index: number; x: number; label: string }[]): { index: number; x: number; label: string; row: number }[] {
  const placed: { index: number; x: number; label: string; row: number }[] = []
  for (const item of items) {
    const x = Math.min(VB_W - TAG_W / 2 - 4, Math.max(TAG_W / 2 + 4, item.x))
    let row = 0
    const overlaps = (lane: number) =>
      placed.some((other) => other.row === lane && Math.abs(other.x - x) < TAG_W + 6)
    if (overlaps(0)) row = 1
    if (overlaps(row)) continue
    placed.push({ ...item, x, row })
  }
  return placed
}
