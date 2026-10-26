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
import { quantile, thresholdStats } from "../engine/stats"
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

type Boot = {
  dataset: Dataset
  settings: Settings
  model: ScorecardModel
  active: string
}

function boot(): Boot {
  const dataset = buildDemoDataset()
  let settings: Settings = { ...DEFAULT_SETTINGS }
  let cuts: Record<string, number[]> | undefined
  let active = ""
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as {
        datasetId?: string
        settings?: Partial<Settings>
        cuts?: Record<string, number[]>
        active?: string
      }
      if (saved.settings) settings = { ...DEFAULT_SETTINGS, ...saved.settings }
      if (saved.datasetId === dataset.id && saved.cuts) cuts = saved.cuts
      if (saved.active) active = saved.active
    }
  } catch {
    settings = { ...DEFAULT_SETTINGS }
  }
  const model = buildScorecard(dataset, settings, cuts)
  const activeName = model.variables.some((variable) => variable.name === active)
    ? active
    : (model.variables[0]?.name ?? "")
  return { dataset, settings, model, active: activeName }
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
  const initial = useState(boot)[0]
  const [dataset, setDataset] = useState(initial.dataset)
  const [settings, setSettings] = useState(initial.settings)
  const [model, setModel] = useState(initial.model)
  const [active, setActive] = useState(initial.active)
  const [section, setSection] = useState<Section>("studio")
  const [status, setStatus] = useState("")
  const [slow, setSlow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<string[]>([initial.dataset.target])
  const [profitGood, setProfitGood] = useState(100)
  const [lossBad, setLossBad] = useState(500)
  const [threshold1, setThreshold1] = useState<number | null>(null)
  const [threshold2, setThreshold2] = useState<number | null>(null)
  const csvText = useRef<string | null>(null)
  const csvName = useRef("german_credit_25k")
  const modelRef = useRef(model)
  const datasetRef = useRef(dataset)
  const settingsRef = useRef(settings)
  const activeRef = useRef(active)
  modelRef.current = model
  datasetRef.current = dataset
  settingsRef.current = settings
  activeRef.current = active

  function note(next: ScorecardModel) {
    modelRef.current = next
    setModel(next)
    if (next.ms > 150) {
      setSlow(true)
      window.setTimeout(() => setSlow(false), 800)
    } else setSlow(false)
  }

  useEffect(() => {
    const cuts: Record<string, number[]> = {}
    for (const variable of model.variables) {
      cuts[variable.name] = variable.bins.slice(0, -1).map((bin) => bin.hi)
    }
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
  }, [model, settings, dataset.id, active])

  const sortedScores = useMemo(() => {
    const copy = Array.from(model.scores)
    copy.sort((a, b) => a - b)
    return copy
  }, [model])

  const t1 = threshold1 ?? quantile(sortedScores, 0.7)
  const t2 = threshold2 ?? quantile(sortedScores, 0.45)
  const stats1 = useMemo(() => thresholdStats(model.scores, dataset.y, t1), [model, dataset, t1])
  const stats2 = useMemo(() => thresholdStats(model.scores, dataset.y, t2), [model, dataset, t2])
  const activeVariable = model.variables.find((variable) => variable.name === active) ?? model.variables[0]

  function commitSettings(next: Settings, rebuild: boolean) {
    settingsRef.current = next
    setSettings(next)
    const built = rebuild ? buildScorecard(datasetRef.current, next) : rescale(modelRef.current, datasetRef.current, next)
    note(built)
    if (!built.variables.some((variable) => variable.name === activeRef.current)) {
      const name = built.variables[0]?.name ?? ""
      activeRef.current = name
      setActive(name)
    }
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

  function onFile(file: File) {
    void file.text().then((text) => {
      csvText.current = text
      csvName.current = file.name.replace(/\.csv$/i, "") || "upload"
      const result = ingestCsv(text, csvName.current)
      if (!result.ok) {
        setError(result.issues.map((issue) => issue.message).join(" "))
        return
      }
      setError(null)
      setCandidates(result.binaryCandidates)
      datasetRef.current = result.dataset
      setDataset(result.dataset)
      const built = buildScorecard(result.dataset, settingsRef.current)
      note(built)
      const name = built.variables[0]?.name ?? ""
      activeRef.current = name
      setActive(name)
      setThreshold1(null)
      setThreshold2(null)
      setSection("studio")
      setStatus(`Loaded ${result.dataset.name}.`)
    }).catch(() => {
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
    datasetRef.current = result.dataset
    setDataset(result.dataset)
    const built = buildScorecard(result.dataset, settingsRef.current)
    note(built)
    const name = built.variables[0]?.name ?? ""
    activeRef.current = name
    setActive(name)
    setThreshold1(null)
    setThreshold2(null)
  }

  return {
    dataset,
    settings,
    model,
    active,
    activeVariable,
    section,
    status,
    slow,
    error,
    candidates,
    profitGood,
    lossBad,
    t1,
    t2,
    stats1,
    stats2,
    setSection,
    setActive: (name: string) => {
      activeRef.current = name
      setActive(name)
      setStatus("")
    },
    setProfitGood,
    setLossBad,
    setThreshold1,
    setThreshold2,
    updateSetting,
    applyPreset(which: "defaults" | "strict") {
      const next = which === "strict" ? { ...STRICT_SETTINGS } : { ...DEFAULT_SETTINGS }
      commitSettings(next, true)
      setStatus(which === "strict" ? "Stricter minimum-bin preset." : "Spec defaults restored.")
    },
    onFile,
    onTarget,
    drag(index: number, value: number) {
      const next = dragCut(modelRef.current, datasetRef.current, settingsRef.current, activeRef.current, index, value)
      note(next)
      setStatus("")
    },
    merge() {
      const next = applyMerge(modelRef.current, datasetRef.current, settingsRef.current, activeRef.current)
      if (!next) {
        setStatus("Already at two bins.")
        return
      }
      note(next)
      setStatus("Merged the closest adjacent bins.")
    },
    split() {
      const next = applySplit(modelRef.current, datasetRef.current, settingsRef.current, activeRef.current)
      if (!next) {
        setStatus("No feasible split under the minimum bin size.")
        return
      }
      note(next)
      setStatus("Split the widest feasible bin.")
    },
    isotonic() {
      note(applyIsotonic(modelRef.current, datasetRef.current, settingsRef.current, activeRef.current))
      setStatus("Isotonic PAV partition applied.")
    },
    autoBin() {
      note(applyAuto(modelRef.current, datasetRef.current, settingsRef.current, activeRef.current))
      setStatus("Auto-bin applied.")
    },
    exportJson() {
      download(`${dataset.name}-cuts.json`, cutsJson(dataset, settings, model), "application/json")
    },
    exportCutsCsv() {
      download(`${dataset.name}-cuts.csv`, cutsCsv(model), "text/csv")
    },
    exportPoints() {
      download(`${dataset.name}-points.csv`, pointsCsv(model), "text/csv")
    },
    exportPython() {
      download(`${dataset.name}-scorecard.py`, pythonSnippet(dataset, model), "text/x-python")
    },
    exportDossier() {
      download(`${dataset.name}-session-record.json`, sessionRecord(dataset, settings, model), "application/json")
    },
  }
}

export type Lab = ReturnType<typeof useScorecard>
