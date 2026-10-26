import { createContext, useContext, type ReactNode } from "react"
import { useScorecard, type Lab } from "./useScorecard"

const LabContext = createContext<Lab | null>(null)

export function LabProvider({ children }: { children: ReactNode }) {
  const lab = useScorecard()
  return <LabContext.Provider value={lab}>{children}</LabContext.Provider>
}

export function useLab(): Lab {
  const lab = useContext(LabContext)
  if (!lab) throw new Error("Lab context missing")
  return lab
}
