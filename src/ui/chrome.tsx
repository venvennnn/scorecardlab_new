import type { ReactNode } from "react"

export function SectionKicker({ index, label, meta }: { index: string; label: string; meta?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 font-label-caps text-label-caps tracking-[0.14em] text-secondary">
      <span className="h-1.5 w-1.5 rounded-[999px] bg-primary" />
      <span>
        SECTION {index} / {label}
      </span>
      {meta && <span className="font-numeric-data text-[11px] tracking-normal text-on-surface-variant">{meta}</span>}
    </div>
  )
}

export function PageWrap({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto w-full max-w-[1440px] px-gutter py-4">{children}</div>
    </div>
  )
}
