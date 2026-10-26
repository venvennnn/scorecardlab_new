import { useRef, type PointerEvent as ReactPointerEvent } from "react"
import type { VariableModel } from "../engine/scorecard"
import { fmt, fmtCut } from "../format"

const VB_W = 820
const VB_H = 360

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
  const pad = (max - min) * 0.04
  const x0 = min - pad
  const x1 = max + pad
  const woes = bins.map((bin) => bin.woe)
  let wMin = Math.min(0, ...woes)
  let wMax = Math.max(0, ...woes)
  const wPad = Math.max(0.08, (wMax - wMin) * 0.16)
  wMin -= wPad
  wMax += wPad

  const margin = { l: 36, r: 48, t: 12, b: 36 }
  const innerW = VB_W - margin.l - margin.r
  const innerH = VB_H - margin.t - margin.b
  const xOf = (value: number) => margin.l + ((value - x0) / (x1 - x0)) * innerW
  const yWoe = (value: number) => margin.t + ((wMax - value) / (wMax - wMin)) * innerH

  const spans = bins.map((bin, index) => {
    const left = index === 0 ? min : bins[index - 1].hi
    const right = Math.max(bin.hi, left)
    return { left, right, width: Math.max(right - left, (x1 - x0) * 0.012) }
  })
  const densities = bins.map((bin, index) => bin.count / spans[index].width)
  const maxDensity = Math.max(...densities, 1)
  const baseY = margin.t + innerH

  let step = ""
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
    const target = event.currentTarget as Element
    target.setPointerCapture?.(event.pointerId)
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
      className="h-full w-full touch-none select-none"
      role="img"
      aria-label="Weight of evidence versus population"
    >
      {[0.25, 0.5, 0.75, 1].map((tick) => (
        <line
          key={tick}
          x1={margin.l}
          x2={VB_W - margin.r}
          y1={baseY - tick * innerH * 0.92}
          y2={baseY - tick * innerH * 0.92}
          stroke="#c4c5d7"
          strokeWidth="1"
        />
      ))}
      <line
        x1={margin.l}
        x2={VB_W - margin.r}
        y1={yWoe(0)}
        y2={yWoe(0)}
        stroke="#747686"
        strokeDasharray="3 3"
        strokeWidth="1"
      />
      {bins.map((bin, index) => {
        const x = xOf(spans[index].left)
        const width = Math.max(2, xOf(spans[index].left + spans[index].width) - x - 3)
        const height = (densities[index] / maxDensity) * innerH * 0.92
        return (
          <rect
            key={`${bin.hi}-${index}`}
            x={x}
            y={baseY - height}
            width={width}
            height={height}
            fill="#1d4ed8"
            opacity="0.88"
          />
        )
      })}
      <path d={step} fill="none" stroke="#a83300" strokeWidth="2.25" />
      {bins.map((bin, index) => (
        <circle key={`dot-${index}`} cx={xOf((spans[index].left + spans[index].left + spans[index].width) / 2)} cy={yWoe(bin.woe)} r="3.2" fill="#802500" />
      ))}
      {(() => {
        let lastLabel = -999
        return bins.slice(0, -1).map((bin, index) => {
          const x = xOf(bin.hi)
          const label = fmtCut(bin.hi)
          const showLabel = x - lastLabel > 54
          if (showLabel) lastLabel = x
          return (
            <g key={`cut-${index}`} data-testid={`cut-handle-${index}`} onPointerDown={(event) => startDrag(event, index)} className="cursor-ew-resize">
              <line x1={x} x2={x} y1={margin.t} y2={baseY} stroke="transparent" strokeWidth="14" />
              <line x1={x} x2={x} y1={margin.t} y2={baseY} stroke="#141b2b" strokeWidth="1.4" />
              <rect x={x - 4.5} y={margin.t} width="9" height="9" fill="#141b2b" />
              {showLabel && (
                <text x={x} y={baseY + 18} textAnchor="middle" fill="#434655" fontFamily="JetBrains Mono, ui-monospace, monospace" fontSize="11">
                  {label}
                </text>
              )}
            </g>
          )
        })
      })()}
      <text x={VB_W - 8} y={Math.max(margin.t + 10, yWoe(Math.max(...woes)))} textAnchor="end" fill="#802500" fontFamily="JetBrains Mono, ui-monospace, monospace" fontSize="10">
        {fmt(Math.max(...woes), 2)}
      </text>
      <text x={VB_W - 8} y={yWoe(0) + 4} textAnchor="end" fill="#802500" fontFamily="JetBrains Mono, ui-monospace, monospace" fontSize="10">
        0
      </text>
      <text x={VB_W - 8} y={Math.min(baseY, yWoe(Math.min(...woes)) + 4)} textAnchor="end" fill="#802500" fontFamily="JetBrains Mono, ui-monospace, monospace" fontSize="10">
        {fmt(Math.min(...woes), 2)}
      </text>
    </svg>
  )
}
