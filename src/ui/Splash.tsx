import { useEffect, useRef } from "react"

export function Splash({ onDone }: { onDone: () => void }) {
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  useEffect(() => {
    const timer = window.setTimeout(() => doneRef.current(), 1400)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <button
      type="button"
      data-testid="splash"
      className="grid h-full min-h-0 w-full place-items-center bg-surface"
      onClick={onDone}
    >
      <h1 className="splash-title font-display text-[4.5rem] font-normal italic leading-none tracking-tight text-on-surface">
        Scorecard Lab
      </h1>
    </button>
  )
}
