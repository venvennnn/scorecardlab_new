import puppeteer from "puppeteer-core"
import { writeFileSync } from "node:fs"

const media = "/cursor/stores/bc-a3a74752-41a6-4708-b442-4b552ba21294/media"
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1600,1000"],
  defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 1 },
})
const page = await browser.newPage()
const errors = []
page.on("pageerror", (err) => errors.push(String(err)))
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text())
})

const notes = []
function note(ok, message) {
  notes.push(`${ok ? "ok" : "FAIL"} ${message}`)
  if (!ok) console.error("FAIL", message)
}

await page.goto("http://localhost:5173/", { waitUntil: "networkidle0", timeout: 30000 })
const splash = await page.$("[data-testid='splash']")
if (splash) {
  const title = await page.$eval("[data-testid='splash']", (el) => el.textContent.trim())
  note(title.includes("Scorecard Lab"), `splash title ${title}`)
  await splash.click()
} else {
  note(true, "splash already finished")
}
await page.waitForSelector("[data-testid='setup']")
await page.click("[data-testid='use-demo']")
await page.waitForSelector("[data-testid='setup-continue']", { timeout: 30000 })
const setupAuc = await page.$eval("[data-testid='setup-auc']", (el) => el.textContent)
note(/\d/.test(setupAuc), `setup auc ${setupAuc.replace(/\s+/g, " ")}`)
const toggledOff = await page.$("[data-testid='feature-toggle-total_credit_lines']")
note(Boolean(toggledOff), "setup has feature toggles")
if (toggledOff) await toggledOff.click()
await new Promise((r) => setTimeout(r, 400))
await page.click("[data-testid='setup-continue']")
await page.waitForSelector("[data-testid='active-name']", { timeout: 30000 })
await page.waitForFunction(() => document.fonts && document.fonts.status === "loaded")
await new Promise((r) => setTimeout(r, 400))

const active = await page.$eval("[data-testid='active-name']", (el) => el.textContent.trim())
note(active === "revolving_utilization_pct", `active variable ${active}`)
const chip = await page.$eval("[data-testid='engine-chip']", (el) => el.textContent)
note(chip.includes("JS") && !/wasm/i.test(chip), `engine chip ${chip.replace(/\s+/g, " ")}`)
const iv = await page.$eval("[data-testid='metric-iv']", (el) => el.textContent)
note(/\d/.test(iv), `iv block ${iv.replace(/\s+/g, " ")}`)
const ledgerBefore = await page.$eval("[data-testid='ledger']", (el) => el.innerText)
await page.screenshot({ path: `${media}/binning-studio.png` })

await page.click("[data-testid='var-debt_to_income_ratio']")
const switched = await page.$eval("[data-testid='active-name']", (el) => el.textContent.trim())
note(switched === "debt_to_income_ratio", `switched to ${switched}`)
await page.click("[data-testid='var-revolving_utilization_pct']")

const handle = await page.$("[data-testid='cut-handle-0']")
const box = await handle.boundingBox()
note(Boolean(box), "cut handle has a box")
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + 40)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + 40, { steps: 12 })
  await page.mouse.up()
}
await new Promise((r) => setTimeout(r, 200))
const ledgerAfter = await page.$eval("[data-testid='ledger']", (el) => el.innerText)
note(ledgerAfter !== ledgerBefore, "ledger changed after drag")
const mono = await page.$eval("[data-testid='metric-mono']", (el) => el.textContent)
note(/Increasing|Decreasing/.test(mono), `monotonicity ${mono.replace(/\s+/g, " ")}`)
await page.screenshot({ path: `${media}/after-drag.png` })

const binsBeforeMerge = await page.$$eval("[data-testid^='ledger-row-']", (rows) => rows.length)
await page.click("[data-testid='btn-merge']")
await new Promise((r) => setTimeout(r, 100))
const binsAfterMerge = await page.$$eval("[data-testid^='ledger-row-']", (rows) => rows.length)
note(binsAfterMerge === binsBeforeMerge - 1, `merge ${binsBeforeMerge} -> ${binsAfterMerge}`)

await page.click("[data-testid='btn-split']")
await new Promise((r) => setTimeout(r, 100))
const binsAfterSplit = await page.$$eval("[data-testid^='ledger-row-']", (rows) => rows.length)
note(binsAfterSplit === binsAfterMerge + 1, `split ${binsAfterMerge} -> ${binsAfterSplit}`)

await page.click("[data-testid='btn-autobin']")
await new Promise((r) => setTimeout(r, 150))
const autoRows = await page.$$eval("[data-testid^='ledger-row-']", (rows) => rows.length)
note(autoRows >= 2, `auto-bin rows ${autoRows}`)
await page.click("[data-testid='btn-isotonic']")
await new Promise((r) => setTimeout(r, 150))
const isoRows = await page.$$eval("[data-testid^='ledger-row-']", (rows) => rows.length)
note(isoRows >= 2, `isotonic rows ${isoRows}`)

const ksBefore = await page.$eval("[data-testid='model-ks']", (el) => el.textContent.trim())
const studioBad = await page.$eval("[data-testid='studio-bad-rate']", (el) => el.textContent.trim())
note(/%/.test(studioBad), `studio bad rate ${studioBad}`)
const aucBeforeToggle = await page.$eval("[data-testid='model-auc']", (el) => el.textContent.trim())
const linesToggle = await page.$("[data-testid='feature-toggle-annual_income_log']")
note(Boolean(linesToggle), "studio can toggle features")
if (linesToggle) {
  await linesToggle.click()
  await new Promise((r) => setTimeout(r, 400))
  const aucAfterToggle = await page.$eval("[data-testid='model-auc']", (el) => el.textContent.trim())
  note(aucAfterToggle.length > 0, `auc after feature toggle ${aucBeforeToggle} -> ${aucAfterToggle}`)
  await linesToggle.click()
  await new Promise((r) => setTimeout(r, 400))
}
await page.click("[data-testid='nav-diagnostics']")
await page.waitForSelector("[data-testid='diag-ks']")
const diag = await page.$eval("[data-testid='diag-ks']", (el) => el.textContent)
note(diag.includes(ksBefore.replace("KS", "").trim()), `diagnostics ks matches studio (${ksBefore})`)

await page.click("[data-testid='nav-points']")
await page.waitForSelector("[data-testid='points-table']")
const pointsText = await page.$eval("[data-testid='points-table']", (el) => el.innerText)
note(pointsText.includes("revolving_utilization_pct") && pointsText.includes("WoE"), "points table populated")
const pdoBefore = pointsText
await page.focus("[data-testid='points-pdo']")
await page.click("[data-testid='points-pdo']", { clickCount: 3 })
await page.type("[data-testid='points-pdo']", "40")
await new Promise((r) => setTimeout(r, 200))
const pdoAfter = await page.$eval("[data-testid='points-table']", (el) => el.innerText)
note(pdoAfter !== pdoBefore, "PDO change rescales the points table")

await page.click("[data-testid='nav-frontier']")
await page.waitForSelector("[data-testid='frontier']")
const uploadLabel = await page.$eval("[data-testid='upload-csv']", (el) => el.textContent.trim())
note(uploadLabel.includes("Upload CSV"), `upload control ${uploadLabel}`)
const approvalBefore = await page.$eval("[data-testid='approval-a']", (el) => el.textContent.trim())
const profitBefore = await page.$eval("[data-testid='profit-a']", (el) => el.textContent.trim())
const badRate = await page.$eval("[data-testid='bad-rate-a']", (el) => el.textContent.trim())
note(/%/.test(badRate), `bad rate next to profit ${badRate}`)
const deltaBefore = await page.$eval("[data-testid='profit-delta-a']", (el) => el.textContent.trim())
note(deltaBefore.length > 0, `profit delta shown ${deltaBefore}`)
const slider = await page.$("[data-testid='acceptance-a']")
const sliderBox = await slider.boundingBox()
if (sliderBox) {
  await page.mouse.click(sliderBox.x + sliderBox.width * 0.42, sliderBox.y + sliderBox.height / 2)
}
await new Promise((r) => setTimeout(r, 150))
const approvalAfter = await page.$eval("[data-testid='approval-a']", (el) => el.textContent.trim())
const profitAfter = await page.$eval("[data-testid='profit-a']", (el) => el.textContent.trim())
const shift = await page.$eval("[data-testid='profit-shift-value']", (el) => el.textContent.trim())
note(approvalAfter !== approvalBefore || profitAfter !== profitBefore, `acceptance ${approvalBefore}/${profitBefore} -> ${approvalAfter}/${profitAfter}`)
note(approvalAfter !== "0.0%" && approvalAfter !== "100.0%", `approval stays inside the book (${approvalAfter})`)
note(/[+\-−]/.test(shift) || shift === "0", `A to B profit change ${shift}`)
await page.screenshot({ path: `${media}/economic-view.png` })

writeFileSync("/tmp/scorecard-bad.csv", "")
const badInput = await page.$("[data-testid='file-input']")
await badInput.uploadFile("/tmp/scorecard-bad.csv")
await page.waitForSelector("[data-testid='error-banner']")
const badMsg = await page.$eval("[data-testid='error-banner']", (el) => el.textContent)
note(/empty/i.test(badMsg), `bad csv: ${badMsg}`)
const stillDemo = await page.$eval("[data-testid='dataset-button']", (el) => el.textContent)
note(stillDemo.includes("german_credit_25k"), "demo remains after a bad file")

const header = "default_flag,revolving_utilization_pct,debt_to_income_ratio,city"
const lines = [header]
for (let i = 0; i < 400; i++) {
  const u = (i % 50) / 40
  const d = (i % 17) / 20
  const y = u + d > 0.8 ? 1 : 0
  lines.push(`${y},${u.toFixed(3)},${d.toFixed(3)},${i % 2 === 0 ? "a" : "b"}`)
}
writeFileSync("/tmp/scorecard-ok.csv", lines.join("\n"))
await page.click("[data-testid='nav-studio']")
const input = await page.$("[data-testid='file-input']")
await input.uploadFile("/tmp/scorecard-ok.csv")
await page.waitForSelector("[data-testid='setup']")
await page.waitForSelector("[data-testid='setup-continue']", { timeout: 15000 })
const uploadedName = await page.$eval("[data-testid='setup']", (el) => el.innerText)
note(/scorecard-ok/.test(uploadedName), "setup shows the uploaded book")
await page.click("[data-testid='setup-continue']")
await page.waitForFunction(() => document.querySelector("[data-testid='dataset-button']")?.textContent?.includes("scorecard-ok"))
const uploadedIv = await page.$eval("[data-testid='metric-iv']", (el) => el.textContent)
note(/\d/.test(uploadedIv), `uploaded iv ${uploadedIv.replace(/\s+/g, " ")}`)
const warn = await page.$eval("[data-testid='warning-line']", (el) => el.textContent)
note(/city/i.test(warn), `categorical warning present`)
const restore = await page.$("[data-testid='restore-demo']")
note(Boolean(restore), "restore demo is offered after upload")
if (restore) {
  await restore.click()
  await page.waitForFunction(() => document.querySelector("[data-testid='dataset-button']")?.textContent?.includes("german_credit_25k"))
  note(true, "restore demo reloads german_credit_25k")
}

const client = await page.createCDPSession()
await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: "/tmp" })
await page.click("[data-testid='side-dossier']")
await new Promise((r) => setTimeout(r, 400))
const fs = await import("node:fs")
const downloaded = fs.readdirSync("/tmp").filter((name) => name.includes("session-record"))
note(downloaded.length > 0, `dossier download ${downloaded.join(",") || "missing"}`)
if (downloaded.length) {
  const body = fs.readFileSync(`/tmp/${downloaded[0]}`, "utf8")
  note(body.includes("Not a regulatory certification"), "session record refuses certification language")
  note(!/wasm/i.test(body), "session record engine is not wasm")
}

await page.click("[data-testid='preset-btn']")
await page.click("[data-testid='preset-strict']")
await new Promise((r) => setTimeout(r, 200))
const minBin = await page.$eval("[data-testid='min-bin']", (el) => el.value)
note(minBin === "10", `strict preset min bin ${minBin}`)

console.log(notes.join("\n"))
if (errors.length) console.log("PAGE ERRORS\n" + errors.join("\n"))
await browser.close()
if (notes.some((line) => line.startsWith("FAIL")) || errors.length) process.exit(1)
