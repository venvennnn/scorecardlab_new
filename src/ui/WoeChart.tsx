import { useRef, type PointerEvent as ReactPointerEvent } from "react"
import type { VariableModel } from "../engine/scorecard"
import { fmtCut } from "../format"

const VB_W = 760
const VB_H = 300

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

  let min = Math.min(...bins.map((bin) => bin.lo))
  let max = Math.max(...bins.map((bin) => bin.hi))
  if (!(max > min)) {
    min -= 1
    max += 1
  }
  const pad = (max - min) * 0.03
  const x0 = min - pad
  const x1 = max + pad
  const woes = bins.map((bin) => bin.woe)
  let wMin = Math.min(0, ...woes)
  let wMax = Math.max(0, ...woes)
  const wPad = Math.max(0.08, (wMax - wMin) * 0.18)
  wMin -= wPad
  wMax += wPad
  const rateMax = Math.max(...bins.map((bin) => bin.eventRate), 0.01) * 1.15

  const margin = { l: 28, r: 36, t: 28, b: 36 }
  const innerW = VB_W - margin.l - margin.r
  const innerH = VB_H - margin.t - margin.b
  const xOf = (value: number) => margin.l + ((value - x0) / (x1 - x0)) * innerW
  const yWoe = (value: number) => margin.t + ((wMax - value) / (wMax - wMin)) * innerH
  const yRate = (value: number) => margin.t + (1 - value / rateMax) * innerH
  const baseY = margin.t + innerH

  const spans = bins.map((bin, index) => {
    const left = index === 0 ? min : bins[index - 1].hi
    const right = Math.max(bin.hi, left)
    return { left, right, width: Math.max(right - left, (x1 - x0) * 0.012) }
  })
  const maxCount = Math.max(...bins.map((bin) => bin.count), 1)

  let step = ""
  const ratePath = bins
    .map((bin, index) => {
      const x = xOf(spans[index].left + spans[index].width / 2)
      const y = yRate(bin.eventRate)
      return `${index === 0 ? "M" : "L"} ${x} ${y}`
    })
    .join(" ")
  bins.forEach((bin, index) => {
    const xL = xOf(spans[index].left)
    const xR = xOf(spans[index].left + spans[index].width)
    const y = yWoe(bin.woe)
    step += index === 0 ? `M ${xL} ${y}` : ` L ${xL} ${y}`
    step += ` L ${xR} ${y}`
  })

  function valueFromClient(clientX: number): number {
    const svg = ref.current
    if (!svg) return min
    const rect = svg.getBoundingClientRect()
    const px = ((clientX - rect.left) / rect.width) * VB_W
    return x0 + ((px - margin.l) / innerW) * (x1 - x0)
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

  let lastTag = -999

  return (
    <svg
      ref={ref}
      data-testid="woe-chart"
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="h-[220px] w-full touch-none select-none"
      role="img"
      aria-label="Weight of evidence versus population"
    >
      <line x1={margin.l} x2={VB_W - margin.r} y1={yWoe(0)} y2={yWoe(0)} stroke="#c4c5d7" strokeDasharray="2 3" />
      {bins.map((bin, index) => {
        const x = xOf(spans[index].left) + 1
        const width = Math.max(2, xOf(spans[index].left + spans[index].width) - x - 2)
        const height = Math.max(4, (bin.count / maxCount) * innerH * 0.92)
        return <rect key={`pop-${index}`} x={x} y={baseY - height} width={width} height={height} fill="#dce1ff" />
      })}
      <path d={ratePath} fill="none" stroke="#a83300" strokeWidth="1.4" strokeDasharray="4 3" />
      {bins.map((bin, index) => {
        const cx = xOf(spans[index].left + spans[index].width / 2)
        const cy = yRate(bin.eventRate)
        return <circle key={`bad-${index}`} cx={cx} cy={cy} r="3.2" fill="#f9f9ff" stroke="#802500" strokeWidth="1.4" />
      })}
      <path d={step} fill="none" stroke="#0037b0" strokeWidth="1.8" />
      {bins.map((bin, index) => {
        const cx = xOf(spans[index].left + spans[index].width / 2)
        const cy = yWoe(bin.woe)
        return <rect key={`mk-${index}`} x={cx - 3} y={cy - 3} width="6" height="6" fill="#0037b0" />
      })}
      {bins.slice(0, -1).map((bin, index) => {
        const x = xOf(bin.hi)
        const showTag = x - lastTag > 48
        if (showTag) lastTag = x
        return (
          <g key={`cut-${index}`} data-testid={`cut-handle-${index}`} onPointerDown={(event) => startDrag(event, index)} className="cursor-ew-resize">
            <line x1={x} x2={x} y1={margin.t} y2={baseY} stroke="transparent" strokeWidth="14" />
            <line x1={x} x2={x} y1={margin.t + 8} y2={baseY} stroke="#747686" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x} cy={margin.t + 16} r="5" fill="#f9f9ff" stroke="#0037b0" strokeWidth="1.6" />
            {showTag && (
              <g>
                <rect x={x - 22} y={4} width="44" height="14" fill="#0037b0" />
                <text x={x} y={14} textAnchor="middle" fill="#ffffff" fontFamily="JetBrains Mono, ui-monospace, monospace" fontSize="9">
                  {fmtCut(bin.hi)}
                </text>
              </g>
            )}
          </g>
        )
      })}
      {bins.map((bin, index) => {
        const left = spans[index].left
        const right = spans[index].left + spans[index].width
        const xL = xOf(left)
        const xR = xOf(right)
        if (xR - xL < 52) return null
        const label = index === bins.length - 1 ? `${fmtCut(index === 0 ? min : bins[index - 1].hi)}+` : fmtCut(bin.hi)
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
      <text x={VB_W - 4} y={yWoe(Math.max(...woes))} textAnchor="end" fill="#0037b0" fontFamily="JetBrains Mono, ui-monospace, monospace" fontSize="10">
        {Math.max(...woes).toFixed(2)}
      </text>
      <text x={VB_W - 4} y={Math.min(baseY, yWoe(Math.min(...woes)) + 4)} textAnchor="end" fill="#0037b0" fontFamily="JetBrains Mono, ui-monospace, monospace" fontSize="10">
        {Math.min(...woes).toFixed(2)}
      </text>
    </svg>
  )
}
