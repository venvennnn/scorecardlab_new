import { Footer, Header } from "./ui/Header"
import { BinningStudio } from "./ui/BinningStudio"
import { Diagnostics } from "./ui/Diagnostics"
import { Frontier } from "./ui/Frontier"
import { PointsView } from "./ui/PointsView"
import { LabProvider, useLab } from "./state/lab"

export function App() {
  return (
    <LabProvider>
      <Shell />
    </LabProvider>
  )
}

function Shell() {
  const lab = useLab()
  return (
    <div className="flex h-full min-h-0 flex-col bg-surface font-body-md text-body-md text-on-surface antialiased">
      <Header />
      {lab.error && (
        <div data-testid="error-banner" className="shrink-0 border-b border-error bg-error-container px-4 py-1.5 text-body-sm text-on-error-container">
          {lab.error}
        </div>
      )}
      {lab.section === "studio" && <BinningStudio />}
      {lab.section === "diagnostics" && <Diagnostics />}
      {lab.section === "points" && <PointsView />}
      {lab.section === "frontier" && <Frontier />}
      <Footer />
    </div>
  )
}
