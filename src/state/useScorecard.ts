import { useEffect, useMemo, useRef, useState } from "react"
import { ingestCsv } from "../engine/csv"
import { buildDemoDataset } from "../engine/demo"
import {
  cutsCsv,
  cutsJson,
  pointsCsv,
  pythonSnippet,
  sessionRecord,
} from "../engine/export"
import { bookCounts, economicsAtRate, profitCurve, rankByScore } from "../engine/stats"
import {
  applyAuto,
  applyIsotonic,
  applyMerge,
  applySplit,
  buildScorecard,
  dragCut,
  rescale,
  type ScorecardModel,
} from "../engine/scorecard"
import { DEFAULT_SETTINGS, STRICT_SETTINGS, type Dataset, type Settings } from "../engine/types"

const SESSION_KEY = "scorecardlab.session.v1"

export type Section = "studio" | "diagnostics" | "points" | "frontier"
export type Phase = "splash" | "setup" | "lab"

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as { settings?: Partial<Settings> }
      if (saved.settings) return { ...DEFAULT_SETTINGS, ...saved.settings }
    }
  } catch {
    /* local recall is optional */
  }
  return { ...DEFAULT_SETTINGS }
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function useScorecard() {
  const [phase, setPhase] = useState<Phase>("splash")
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [settings, setSettings] = useState(loadSettings)
  const [model, setModel] = useState<ScorecardModel | null>(null)
  const [active, setActive] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [section, setSection] = useState<Section>("studio")
  const [status, setStatus] = useState("")
  const [slow, setSlow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<string[]>([])
  const [profitGood, setProfitGood] = useState(100)
  const [lossBad, setLossBad] = useState(500)
  const [accept1, setAccept1State] = useState(0.7)
  const [accept2, setAccept2State] = useState(0.45)
  const csvText = useRef<string | null>(null)
  const csvName = useRef("german_credit_25k")
  const demoCuts = useRef<Record<string, number[]> | undefined>(undefined)
  const modelRef = useRef(model)
  const datasetRef = useRef(dataset)
  const settingsRef = useRef(settings)
  const activeRef = useRef(active)
  const selectedRef = useRef(selected)
  modelRef.current = model
  datasetRef.current = dataset
  settingsRef.current = settings
  activeRef.current = active
  selectedRef.current = selected

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as { datasetId?: string; cuts?: Record<string, number[]>; active?: string }
      if (saved.datasetId === "german_credit_25k" && saved.cuts) demoCuts.current = saved.cuts
      if (saved.active) activeRef.current = saved.active
    } catch {
      /* optional */
    }
  }, [])

  function note(next: ScorecardModel) {
    modelRef.current = next
    setModel(next)
    if (next.ms > 150) {
      setSlow(true)
      window.setTimeout(() => setSlow(false), 800)
    } else setSlow(false)
  }

  useEffect(() => {
    if (!model || !dataset) return
    const cuts: Record<string, number[]> = {}
    for (const variable of model.variables) {
      cuts[variable.name] = variable.bins.slice(0, -1).map((bin) => bin.hi)
    }
    if (dataset.id === "german_credit_25k") demoCuts.current = cuts
    try {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          datasetId: dataset.id,
          settings,
          cuts: dataset.id === "german_credit_25k" ? cuts : {},
          active,
        }),
      )
    } catch {
      /* local recall is optional */
    }
  }, [model, settings, dataset, active])

  const ranked = useMemo(() => (model ? rankByScore(model.scores) : []), [model])
  const counts = useMemo(
    () => (dataset ? bookCounts(dataset.y) : { n: 0, events: 0, nonEvents: 0 }),
    [dataset],
  )
  const emptyScores = useMemo(() => new Float64Array(0), [])
  const stats1 = useMemo(
    () => economicsAtRate(model?.scores ?? emptyScores, dataset?.y ?? emptyScores, accept1, profitGood, lossBad, ranked, counts),
    [model, dataset, accept1, profitGood, lossBad, ranked, counts, emptyScores],
  )
  const stats2 = useMemo(
    () => economicsAtRate(model?.scores ?? emptyScores, dataset?.y ?? emptyScores, accept2, profitGood, lossBad, ranked, counts),
    [model, dataset, accept2, profitGood, lossBad, ranked, counts, emptyScores],
  )
  const curve = useMemo(
    () => profitCurve(model?.scores ?? emptyScores, dataset?.y ?? emptyScores, profitGood, lossBad, ranked, counts),
    [model, dataset, profitGood, lossBad, ranked, counts, emptyScores],
  )
  const t1 = stats1.threshold
  const t2 = stats2.threshold
  const activeVariable = model?.variables.find((variable) => variable.name === active) ?? model?.variables[0]

  function cutsOf(current: ScorecardModel | null): Record<string, number[]> | undefined {
    if (!current) return datasetRef.current?.id === "german_credit_25k" ? demoCuts.current : undefined
    const cuts: Record<string, number[]> = {}
    for (const variable of current.variables) {
      cuts[variable.name] = variable.bins.slice(0, -1).map((bin) => bin.hi)
    }
    return cuts
  }

  function adopt(built: ScorecardModel, names: string[]) {
    selectedRef.current = names
    setSelected(names)
    note(built)
    if (!built.variables.some((variable) => variable.name === activeRef.current)) {
      const name = built.variables[0]?.name ?? ""
      activeRef.current = name
      setActive(name)
    }
  }

  function rebuild(nextDataset: Dataset, names: string[], nextSettings = settingsRef.current, cuts?: Record<string, number[]>) {
    const built = buildScorecard(nextDataset, nextSettings, cuts ?? cutsOf(modelRef.current), names)
    adopt(built, names)
  }

  function commitSettings(next: Settings, rebuildBins: boolean) {
    const currentDataset = datasetRef.current
    const currentModel = modelRef.current
    if (!currentDataset || !currentModel) {
      settingsRef.current = next
      setSettings(next)
      return
    }
    settingsRef.current = next
    setSettings(next)
    const names = selectedRef.current
    const built = rebuildBins
      ? buildScorecard(currentDataset, next, undefined, names)
      : rescale(currentModel, currentDataset, next)
    adopt(built, names)
  }

  function updateSetting(key: keyof Settings, value: number) {
    if (!Number.isFinite(value)) return
    const next = { ...settingsRef.current, [key]: value }
    if (key === "maxBins") next.maxBins = Math.max(2, Math.min(8, Math.round(value)))
    if (key === "minBinPct") next.minBinPct = Math.max(0.01, Math.min(0.3, value))
    if (key === "laplace") next.laplace = Math.max(0, value)
    if (key === "pdo") next.pdo = Math.max(1, value)
    if (key === "odds") next.odds = Math.max(0.01, value)
    const structural = key === "minBinPct" || key === "maxBins" || key === "minBins"
    commitSettings(next, structural)
    if (structural) setStatus("Bins rebuilt for the new constraint.")
  }

  function applyDataset(next: Dataset, names?: string[], cuts?: Record<string, number[]>) {
    datasetRef.current = next
    setDataset(next)
    const selectedNames = names && names.length > 0 ? names : next.features.map((feature) => feature.name)
    rebuild(next, selectedNames, settingsRef.current, cuts)
    setStatus(`Loaded ${next.name}.`)
  }

  function onFile(file: File) {
    void file
      .text()
      .then((text) => {
        csvText.current = text
        csvName.current = file.name.replace(/\.csv$/i, "") || "upload"
        const result = ingestCsv(text, csvName.current)
        if (!result.ok) {
          setError(result.issues.map((issue) => issue.message).join(" "))
          return
        }
        setError(null)
        setCandidates(result.binaryCandidates)
        setPhase("setup")
        applyDataset(result.dataset)
      })
      .catch(() => {
        setError("The file could not be read.")
      })
  }

  function onTarget(target: string) {
    const text = csvText.current
    if (!text) return
    const result = ingestCsv(text, csvName.current, target)
    if (!result.ok) {
      setError(result.issues.map((issue) => issue.message).join(" "))
      return
    }
    setError(null)
    applyDataset(result.dataset, selectedRef.current.filter((name) => name !== target))
  }

  function loadDemo() {
    csvText.current = null
    csvName.current = "german_credit_25k"
    const next = buildDemoDataset()
    setError(null)
    setCandidates([next.target])
    setPhase("setup")
    applyDataset(
      next,
      next.features.map((feature) => feature.name),
      demoCuts.current,
    )
  }

  function restoreDemo() {
    csvText.current = null
    csvName.current = "german_credit_25k"
    const next = buildDemoDataset()
    setError(null)
    setCandidates([next.target])
    applyDataset(
      next,
      next.features.map((feature) => feature.name),
      demoCuts.current,
    )
    setPhase("lab")
    setSection("studio")
  }

  function finishSplash() {
    setPhase("setup")
  }

  function enterLab() {
    if (!datasetRef.current || selectedRef.current.length === 0) return
    setPhase("lab")
    setSection("studio")
  }

  function toggleFeature(name: string) {
    const current = datasetRef.current
    if (!current) return
    const on = selectedRef.current.includes(name)
    const next = on ? selectedRef.current.filter((item) => item !== name) : [...selectedRef.current, name]
    if (next.length === 0) {
      setStatus("Keep at least one feature.")
      return
    }
    rebuild(current, next)
    setStatus(on ? `Dropped ${name}. Logistic refit.` : `Added ${name}. Logistic refit.`)
  }

  return {
    phase,
    dataset,
    settings,
    model,
    active,
    selected,
    activeVariable,
    section,
    status,
    slow,
    error,
    candidates,
    profitGood,
    lossBad,
    accept1,
    accept2,
    t1,
    t2,
    stats1,
    stats2,
    curve,
    setSection,
    setActive: (name: string) => {
      activeRef.current = name
      setActive(name)
      setStatus("")
    },
    setProfitGood,
    setLossBad,
    setAccept1(value: number) {
      if (!Number.isFinite(value)) return
      setAccept1State(Math.min(1, Math.max(0, value)))
    },
    setAccept2(value: number) {
      if (!Number.isFinite(value)) return
      setAccept2State(Math.min(1, Math.max(0, value)))
    },
    onFile,
    onTarget,
    restoreDemo,
    loadDemo,
    finishSplash,
    enterLab,
    openSetup() {
      setPhase("setup")
    },
    toggleFeature,
    updateSetting,
    applyPreset(which: "defaults" | "strict") {
      const next = which === "strict" ? { ...STRICT_SETTINGS } : { ...DEFAULT_SETTINGS }
      commitSettings(next, true)
      setStatus(which === "strict" ? "Stricter minimum-bin preset." : "Spec defaults restored.")
    },
    drag(index: number, value: number) {
      const currentModel = modelRef.current
      const currentDataset = datasetRef.current
      if (!currentModel || !currentDataset) return
      const next = dragCut(currentModel, currentDataset, settingsRef.current, activeRef.current, index, value)
      note(next)
      setStatus("")
    },
    merge() {
      const currentModel = modelRef.current
      const currentDataset = datasetRef.current
      if (!currentModel || !currentDataset) return
      const next = applyMerge(currentModel, currentDataset, settingsRef.current, activeRef.current)
      if (!next) {
        setStatus("Already at two bins.")
        return
      }
      note(next)
      setStatus("Merged the closest adjacent bins.")
    },
    split() {
      const currentModel = modelRef.current
      const currentDataset = datasetRef.current
      if (!currentModel || !currentDataset) return
      const next = applySplit(currentModel, currentDataset, settingsRef.current, activeRef.current)
      if (!next) {
        setStatus("No feasible split under the minimum bin size.")
        return
      }
      note(next)
      setStatus("Split the widest feasible bin.")
    },
    isotonic() {
      const currentModel = modelRef.current
      const currentDataset = datasetRef.current
      if (!currentModel || !currentDataset) return
      note(applyIsotonic(currentModel, currentDataset, settingsRef.current, activeRef.current))
      setStatus("Isotonic PAV partition applied.")
    },
    autoBin() {
      const currentModel = modelRef.current
      const currentDataset = datasetRef.current
      if (!currentModel || !currentDataset) return
      note(applyAuto(currentModel, currentDataset, settingsRef.current, activeRef.current))
      setStatus("Auto-bin applied.")
    },
    exportJson() {
      if (!dataset || !model) return
      download(`${dataset.name}-cuts.json`, cutsJson(dataset, settings, model), "application/json")
    },
    exportCutsCsv() {
      if (!dataset || !model) return
      download(`${dataset.name}-cuts.csv`, cutsCsv(model), "text/csv")
    },
    exportPoints() {
      if (!dataset || !model) return
      download(`${dataset.name}-points.csv`, pointsCsv(model), "text/csv")
    },
    exportPython() {
      if (!dataset || !model) return
      download(`${dataset.name}-scorecard.py`, pythonSnippet(dataset, model), "text/x-python")
    },
    exportDossier() {
      if (!dataset || !model) return
      download(`${dataset.name}-session-record.json`, sessionRecord(dataset, settings, model), "application/json")
    },
  }
}

export type Lab = ReturnType<typeof useScorecard>
