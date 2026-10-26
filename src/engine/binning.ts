import type { FineCell, Range } from "./types"

export type Segment = Range & {
  events: number
  nonEvents: number
  count: number
  rate: number
}

type Prefix = {
  seg: (l: number, r: number) => Segment
}

function prefixes(fine: FineCell[]): Prefix {
  const events = [0]
  const nonEvents = [0]
  const count = [0]
  for (const cell of fine) {
    events.push(events[events.length - 1] + cell.events)
    nonEvents.push(nonEvents[nonEvents.length - 1] + cell.nonEvents)
    count.push(count[count.length - 1] + cell.count)
  }
  return {
    seg(l: number, r: number): Segment {
      const e = events[r + 1] - events[l]
      const ne = nonEvents[r + 1] - nonEvents[l]
      const c = count[r + 1] - count[l]
      return { l, r, events: e, nonEvents: ne, count: c, rate: c > 0 ? e / c : 0 }
    },
  }
}

export function buildFine(
  values: Float64Array,
  y: Uint8Array,
  maxCells = 36,
): { cells: FineCell[]; missing: { events: number; nonEvents: number; count: number } } {
  const pairs: { v: number; bad: number }[] = []
  let missingEvents = 0
  let missingNon = 0
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (Number.isNaN(v)) {
      if (y[i] === 1) missingEvents++
      else missingNon++
    } else {
      pairs.push({ v, bad: y[i] })
    }
  }
  pairs.sort((a, b) => a.v - b.v)

  const groups: { v: number; events: number; nonEvents: number; count: number }[] = []
  for (const pair of pairs) {
    const last = groups[groups.length - 1]
    if (last && last.v === pair.v) {
      last.count++
      if (pair.bad === 1) last.events++
      else last.nonEvents++
    } else {
      groups.push({
        v: pair.v,
        events: pair.bad === 1 ? 1 : 0,
        nonEvents: pair.bad === 1 ? 0 : 1,
        count: 1,
      })
    }
  }

  let cells: FineCell[] = []
  if (groups.length === 0) {
    return {
      cells,
      missing: { events: missingEvents, nonEvents: missingNon, count: missingEvents + missingNon },
    }
  }

  if (groups.length <= maxCells) {
    cells = groups.map((group) => ({
      lo: group.v,
      hi: group.v,
      events: group.events,
      nonEvents: group.nonEvents,
      count: group.count,
    }))
  } else {
    const total = pairs.length
    const target = total / maxCells
    let current: FineCell | null = null
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i]
      const slotsLeft = maxCells - cells.length
      const groupsLeft = groups.length - i
      if (!current) {
        current = {
          lo: group.v,
          hi: group.v,
          events: group.events,
          nonEvents: group.nonEvents,
          count: group.count,
        }
        continue
      }
      const wouldExceed = current.count >= target && groupsLeft >= slotsLeft && slotsLeft > 1
      if (wouldExceed) {
        cells.push(current)
        current = {
          lo: group.v,
          hi: group.v,
          events: group.events,
          nonEvents: group.nonEvents,
          count: group.count,
        }
      } else {
        current.hi = group.v
        current.events += group.events
        current.nonEvents += group.nonEvents
        current.count += group.count
      }
    }
    if (current) cells.push(current)
  }

  for (let i = 1; i < cells.length; i++) cells[i].lo = cells[i - 1].hi
  return {
    cells,
    missing: { events: missingEvents, nonEvents: missingNon, count: missingEvents + missingNon },
  }
}

export function chooseDirection(fine: FineCell[]): 1 | -1 {
  let weight = 0
  let sx = 0
  let sy = 0
  let sxy = 0
  for (const cell of fine) {
    if (cell.count === 0) continue
    const x = (cell.lo + cell.hi) / 2
    const rate = cell.events / cell.count
    weight += cell.count
    sx += cell.count * x
    sy += cell.count * rate
    sxy += cell.count * x * rate
  }
  if (weight === 0) return 1
  const cov = sxy - (sx * sy) / weight
  return cov >= 0 ? 1 : -1
}

function violates(prev: number, next: number, direction: 1 | -1): boolean {
  return direction === 1 ? next <= prev : next >= prev
}

export function pavBlocks(fine: FineCell[], direction: 1 | -1): Segment[] {
  if (fine.length === 0) return []
  const px = prefixes(fine)
  const blocks: Segment[] = []
  for (let i = 0; i < fine.length; i++) {
    blocks.push(px.seg(i, i))
    while (
      blocks.length >= 2 &&
      violates(blocks[blocks.length - 2].rate, blocks[blocks.length - 1].rate, direction)
    ) {
      const right = blocks.pop()!
      const left = blocks.pop()!
      blocks.push(px.seg(left.l, right.r))
    }
  }
  return blocks
}

function mergeClosest(blocks: Segment[], fine: FineCell[]): Segment[] {
  const px = prefixes(fine)
  let best = 0
  let gap = Infinity
  for (let i = 0; i < blocks.length - 1; i++) {
    const g = Math.abs(blocks[i].rate - blocks[i + 1].rate)
    if (g < gap) {
      gap = g
      best = i
    }
  }
  const next = blocks.slice()
  const merged = px.seg(next[best].l, next[best + 1].r)
  next.splice(best, 2, merged)
  return next
}

function mergeSmall(blocks: Segment[], fine: FineCell[], minCount: number): Segment[] {
  const px = prefixes(fine)
  const out = blocks.slice()
  let guard = 0
  while (out.length > 1 && out.some((block) => block.count < minCount) && guard++ < 64) {
    const idx = out.findIndex((block) => block.count < minCount)
    let withLeft = idx > 0
    if (idx > 0 && idx < out.length - 1) {
      const leftGap = Math.abs(out[idx].rate - out[idx - 1].rate)
      const rightGap = Math.abs(out[idx + 1].rate - out[idx].rate)
      withLeft = leftGap <= rightGap
    } else if (idx === 0) withLeft = false
    if (withLeft) {
      out.splice(idx - 1, 2, px.seg(out[idx - 1].l, out[idx].r))
    } else {
      out.splice(idx, 2, px.seg(out[idx].l, out[idx + 1].r))
    }
  }
  return out
}

function repair(blocks: Segment[], fine: FineCell[], direction: 1 | -1, minCount: number): Segment[] {
  const px = prefixes(fine)
  let out = blocks.slice()
  let guard = 0
  while (out.length > 1 && guard++ < 64) {
    let bad = -1
    for (let i = 1; i < out.length; i++) {
      if (violates(out[i - 1].rate, out[i].rate, direction)) {
        bad = i
        break
      }
    }
    if (bad === -1 && out.every((block) => block.count >= minCount || out.length === 1)) break
    if (bad === -1) {
      out = mergeSmall(out, fine, minCount)
      continue
    }
    out.splice(bad - 1, 2, px.seg(out[bad - 1].l, out[bad].r))
  }
  return out
}

function splitToward(
  blocks: Segment[],
  fine: FineCell[],
  direction: 1 | -1,
  minCount: number,
  target: number,
): Segment[] {
  const px = prefixes(fine)
  const out = blocks.slice()
  let guard = 0
  while (out.length < target && guard++ < target + 2) {
    let best: { bi: number; k: number; gap: number } | null = null
    for (let bi = 0; bi < out.length; bi++) {
      const block = out[bi]
      if (block.r <= block.l) continue
      for (let k = block.l; k < block.r; k++) {
        const left = px.seg(block.l, k)
        const right = px.seg(k + 1, block.r)
        if (left.count < minCount || right.count < minCount) continue
        if (direction === 1 ? !(left.rate < right.rate) : !(left.rate > right.rate)) continue
        if (bi > 0) {
          const prev = out[bi - 1].rate
          if (direction === 1 ? !(prev < left.rate) : !(prev > left.rate)) continue
        }
        if (bi < out.length - 1) {
          const next = out[bi + 1].rate
          if (direction === 1 ? !(right.rate < next) : !(right.rate > next)) continue
        }
        const gap = Math.abs(right.rate - left.rate)
        if (!best || gap > best.gap) best = { bi, k, gap }
      }
    }
    if (!best) break
    const current = out[best.bi]
    const left = px.seg(current.l, best.k)
    const right = px.seg(best.k + 1, current.r)
    out.splice(best.bi, 1, left, right)
  }
  return out
}

export function isotonicRanges(
  fine: FineCell[],
  direction: 1 | -1,
  minCount: number,
  maxBins: number,
): Range[] {
  if (fine.length === 0) return []
  let blocks = pavBlocks(fine, direction)
  blocks = mergeSmall(blocks, fine, minCount)
  while (blocks.length > maxBins) blocks = mergeClosest(blocks, fine)
  blocks = repair(blocks, fine, direction, minCount)
  while (blocks.length > maxBins) blocks = mergeClosest(blocks, fine)
  return blocks.map((block) => ({ l: block.l, r: block.r }))
}

export function autoRanges(
  fine: FineCell[],
  direction: 1 | -1,
  minCount: number,
  maxBins: number,
  minBins: number,
  targetBins: number,
): Range[] {
  const cap = Math.max(1, Math.min(maxBins, fine.length))
  const target = Math.max(1, Math.min(cap, Math.max(minBins, targetBins)))
  let blocks = pavBlocks(fine, direction).map((block) => block)
  blocks = mergeSmall(blocks, fine, minCount)
  while (blocks.length > cap) blocks = mergeClosest(blocks, fine)
  blocks = splitToward(blocks, fine, direction, minCount, target)
  while (blocks.length > target) blocks = mergeClosest(blocks, fine)
  blocks = repair(blocks, fine, direction, minCount)
  while (blocks.length > cap) blocks = mergeClosest(blocks, fine)
  return blocks.map((block) => ({ l: block.l, r: block.r }))
}

type Node = { cost: number; rate: number; prevEnd: number; prevNode: number }

function prune(states: Node[], direction: 1 | -1): Node[] {
  if (states.length <= 1) return states
  const sorted = states.slice().sort((a, b) => a.cost - b.cost || a.rate - b.rate)
  const kept: Node[] = []
  let flex = direction === 1 ? Infinity : -Infinity
  for (const state of sorted) {
    if (direction === 1) {
      if (state.rate < flex - 1e-12) {
        kept.push(state)
        flex = state.rate
      }
    } else if (state.rate > flex + 1e-12) {
      kept.push(state)
      flex = state.rate
    }
  }
  return kept
}

/**
 * Nearest strictly monotonic partition with the same number of bins as
 * `wantEdges` (length = bins − 1). Null when that bin count cannot be feasible.
 */
export function projectRanges(
  fine: FineCell[],
  wantEdges: number[],
  direction: 1 | -1,
  minCount: number,
): Range[] | null {
  const n = fine.length
  const bins = wantEdges.length + 1
  if (n === 0 || bins > n) return null
  const total = fine.reduce((sum, cell) => sum + cell.count, 0)
  if (minCount * bins > total) return null

  const px = prefixes(fine)
  const scale = Math.max(1e-9, fine[n - 1].hi - fine[0].lo)
  const wants = wantEdges.slice().sort((a, b) => a - b)

  const boundaryCost = (endExclusive: number, boundaryIndex: number) => {
    const hi = fine[endExclusive - 1].hi
    const d = (hi - wants[boundaryIndex]) / scale
    return d * d
  }

  const layers: Node[][][] = []
  const first: Node[][] = Array.from({ length: n + 1 }, () => [])
  for (let end = 1; end <= n; end++) {
    const segment = px.seg(0, end - 1)
    if (segment.count < minCount) continue
    if (bins === 1) {
      if (end === n) first[end].push({ cost: 0, rate: segment.rate, prevEnd: -1, prevNode: -1 })
    } else if (end < n) {
      first[end].push({
        cost: boundaryCost(end, 0),
        rate: segment.rate,
        prevEnd: -1,
        prevNode: -1,
      })
    }
  }
  layers.push(first)

  for (let k = 1; k < bins; k++) {
    const prev = layers[k - 1]
    const layer: Node[][] = Array.from({ length: n + 1 }, () => [])
    const isLast = k === bins - 1
    for (let end = k + 1; end <= n; end++) {
      if (isLast && end !== n) continue
      if (!isLast && end === n) continue
      const collected: Node[] = []
      for (let start = k; start < end; start++) {
        const states = prev[start]
        if (states.length === 0) continue
        const segment = px.seg(start, end - 1)
        if (segment.count < minCount) continue
        const add = isLast ? 0 : boundaryCost(end, k)
        for (let si = 0; si < states.length; si++) {
          const state = states[si]
          const ok = direction === 1 ? segment.rate > state.rate : segment.rate < state.rate
          if (!ok) continue
          collected.push({
            cost: state.cost + add,
            rate: segment.rate,
            prevEnd: start,
            prevNode: si,
          })
        }
      }
      layer[end] = prune(collected, direction)
    }
    layers.push(layer)
  }

  const finals = layers[bins - 1][n]
  if (!finals || finals.length === 0) return null
  let bestIdx = 0
  for (let i = 1; i < finals.length; i++) {
    if (finals[i].cost < finals[bestIdx].cost) bestIdx = i
  }

  const ranges: Range[] = []
  let k = bins - 1
  let end = n
  let nodeIdx = bestIdx
  while (k >= 0) {
    const node = layers[k][end][nodeIdx]
    const start = k === 0 ? 0 : node.prevEnd
    ranges.push({ l: start, r: end - 1 })
    nodeIdx = node.prevNode
    end = start
    k--
  }
  ranges.reverse()
  return ranges
}

export function splitOnce(
  fine: FineCell[],
  ranges: Range[],
  direction: 1 | -1,
  minCount: number,
  maxBins: number,
): Range[] | null {
  if (ranges.length >= maxBins || ranges.length === 0) return null
  const px = prefixes(fine)
  let best: { bi: number; k: number; gap: number } | null = null
  for (let bi = 0; bi < ranges.length; bi++) {
    const range = ranges[bi]
    if (range.r <= range.l) continue
    for (let k = range.l; k < range.r; k++) {
      const left = px.seg(range.l, k)
      const right = px.seg(k + 1, range.r)
      if (left.count < minCount || right.count < minCount) continue
      if (direction === 1 ? !(left.rate < right.rate) : !(left.rate > right.rate)) continue
      if (bi > 0) {
        const prev = px.seg(ranges[bi - 1].l, ranges[bi - 1].r).rate
        if (direction === 1 ? !(prev < left.rate) : !(prev > left.rate)) continue
      }
      if (bi < ranges.length - 1) {
        const next = px.seg(ranges[bi + 1].l, ranges[bi + 1].r).rate
        if (direction === 1 ? !(right.rate < next) : !(right.rate > next)) continue
      }
      const gap = Math.abs(right.rate - left.rate)
      if (!best || gap > best.gap) best = { bi, k, gap }
    }
  }
  if (!best) return null
  const next = ranges.slice()
  const current = next[best.bi]
  next.splice(best.bi, 1, { l: current.l, r: best.k }, { l: best.k + 1, r: current.r })
  return next
}

export function mergeOnce(fine: FineCell[], ranges: Range[]): Range[] | null {
  if (ranges.length < 3) return null
  const px = prefixes(fine)
  let best = 0
  let gap = Infinity
  for (let i = 0; i < ranges.length - 1; i++) {
    const left = px.seg(ranges[i].l, ranges[i].r)
    const right = px.seg(ranges[i + 1].l, ranges[i + 1].r)
    const g = Math.abs(left.rate - right.rate)
    if (g < gap) {
      gap = g
      best = i
    }
  }
  const next = ranges.slice()
  next.splice(best, 2, { l: next[best].l, r: next[best + 1].r })
  return next
}

export function segmentOf(fine: FineCell[], range: Range): Segment {
  return prefixes(fine).seg(range.l, range.r)
}
