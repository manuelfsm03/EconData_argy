import assert from "node:assert/strict"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { chromium } from "playwright"

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000"
const artifactDir = process.env.CI_ARTIFACT_DIR ?? "artifacts/canvas"
mkdirSync(artifactDir, { recursive: true })

const cases = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
]
const results = []
let browser = null

async function assertVisibleAndUnobscured(page, locator, label) {
  assert.equal(await locator.isVisible(), true, `${label} is not visible`)
  const box = await locator.boundingBox()
  const viewport = page.viewportSize()
  assert.ok(box && viewport, `${label} has no layout box`)
  assert.ok(box.width > 0 && box.height > 0, `${label} has no visible area`)
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, `${label} is clipped at ${JSON.stringify(box)} in ${JSON.stringify(viewport)}`)
  await locator.evaluate((element, name) => {
    const rect = element.getBoundingClientRect()
    // Keep the four probes inside rounded borders; a 2px probe can land on a
    // transparent corner even when the card is fully visible and unobscured.
    const insetX = Math.min(8, rect.width / 4)
    const insetY = Math.min(8, rect.height / 4)
    const points = [
      [rect.left + rect.width / 2, rect.top + rect.height / 2],
      [rect.left + insetX, rect.top + insetY],
      [rect.right - insetX, rect.top + insetY],
      [rect.left + insetX, rect.bottom - insetY],
      [rect.right - insetX, rect.bottom - insetY],
    ]
    for (const [x, y] of points) {
      const px = Math.min(Math.max(x, 0), window.innerWidth - 1)
      const py = Math.min(Math.max(y, 0), window.innerHeight - 1)
      const top = document.elementFromPoint(px, py)
      if (!top || (top !== element && !element.contains(top))) throw new Error(`${name} is obscured at (${px}, ${py})`)
    }
  }, label)
  return {
    box,
    center: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  }
}

async function waitForStableLayout(page, locators, label) {
  await page.evaluate(() => document.fonts?.ready)
  let previous = null
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await Promise.all(locators.map(async (locator) => {
      const box = await locator.boundingBox()
      return box ? [box.x, box.y, box.width, box.height].map((value) => Math.round(value * 10) / 10) : null
    }))
    if (current.every(Boolean) && previous && JSON.stringify(current) === JSON.stringify(previous)) return
    previous = current
    await page.waitForTimeout(100)
  }
  if (!previous?.every(Boolean)) throw new Error(`${label} never reached a measurable layout`)
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  assert.ok(overflow.document <= overflow.viewport + 1 && overflow.body <= overflow.viewport + 1, `${label} has horizontal overflow: ${JSON.stringify(overflow)}`)
  return overflow
}

let smokeError = null
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.SMOKE_EXECUTABLE_PATH ? { executablePath: process.env.SMOKE_EXECUTABLE_PATH } : {}),
  })
  for (const viewport of cases) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
    const page = await context.newPage()
    const pageErrors = []
    page.on("pageerror", (error) => pageErrors.push(error.message))

    const canvasUrl = `${baseUrl}/?section=canvas`
    await page.goto(canvasUrl, { waitUntil: "domcontentloaded" })
    await page.getByText("Mi Pizarra", { exact: true }).first().waitFor()
    const header = page.locator("header").first()
    const canvasControls = page.locator("div.sticky.top-12").first()
    const catalogButton = page.getByRole("button", { name: "Tarjetas", exact: true })
    const sidebarTrigger = page.getByRole("button", { name: "Mostrar u ocultar menú", exact: true })
    await catalogButton.waitFor()
    await waitForStableLayout(page, [header, canvasControls, catalogButton], `${viewport.name} canvas readiness`)
    await assertVisibleAndUnobscured(page, header, `${viewport.name} header`)
    await assertVisibleAndUnobscured(page, canvasControls, `${viewport.name} canvas controls`)
    await assertVisibleAndUnobscured(page, catalogButton, `${viewport.name} catalog button`)
    await assertNoHorizontalOverflow(page, `${viewport.name} canvas`)

    let drawerLibraryHeading = null
    let drawerCanvasHeading = null
    let drawerOpenGeometry = null
    if (viewport.width <= 767) {
      await sidebarTrigger.click()
      const openSidebar = page.locator('aside[data-open="true"]').first()
      await openSidebar.waitFor({ state: "visible" })
      await waitForStableLayout(page, [openSidebar], `${viewport.name} drawer open readiness`)
      drawerOpenGeometry = await assertVisibleAndUnobscured(page, openSidebar, `${viewport.name} open drawer`)
      assert.ok(drawerOpenGeometry.box.width > 0, `${viewport.name} open drawer has no usable width`)
      const libraryNav = openSidebar.getByRole("button", { name: /Biblioteca de datos/ }).first()
      await assertVisibleAndUnobscured(page, libraryNav, `${viewport.name} drawer Biblioteca navigation`)
      await libraryNav.click()
      await page.locator('aside[data-open="false"]').first().waitFor()
      await page.waitForTimeout(250)
      drawerLibraryHeading = page.locator("header").first().getByText("Biblioteca de datos", { exact: true })
      await drawerLibraryHeading.waitFor()
      await waitForStableLayout(page, [drawerLibraryHeading], `${viewport.name} drawer Biblioteca destination readiness`)
      await assertVisibleAndUnobscured(page, drawerLibraryHeading, `${viewport.name} drawer Biblioteca destination`)
      await sidebarTrigger.click()
      const reopenedSidebar = page.locator('aside[data-open="true"]').first()
      await reopenedSidebar.waitFor({ state: "visible" })
      await waitForStableLayout(page, [reopenedSidebar], `${viewport.name} drawer reopen readiness`)
      const canvasNav = reopenedSidebar.getByRole("button", { name: /Mi Pizarra/ }).first()
      await waitForStableLayout(page, [canvasNav], `${viewport.name} drawer Mi Pizarra readiness`)
      await assertVisibleAndUnobscured(page, canvasNav, `${viewport.name} drawer Mi Pizarra navigation`)
      await canvasNav.click()
      drawerCanvasHeading = page.getByText("Mi Pizarra", { exact: true }).first()
      await drawerCanvasHeading.waitFor()
      // closeOnMobile closes the drawer as part of the real navigation click;
      // assert that lifecycle rather than reopening it just to close it.
      await page.locator('aside[data-open="false"]').first().waitFor({ state: "attached" })
      await page.waitForTimeout(250)
      await waitForStableLayout(page, [canvasControls, catalogButton], `${viewport.name} Canvas after drawer readiness`)
    }

    // Resolve the catalog only after any drawer navigation. A locator created
    // before the route/state transition can observe the old hidden aside.
    const resolveCatalog = async () => {
      let current = page.locator("aside").filter({ has: page.getByText(/^35 tarjetas programables$/) }).first()
      if (!(await current.isVisible())) {
        const freshCatalogButton = page.getByRole("button", { name: "Tarjetas", exact: true }).last()
        await freshCatalogButton.click()
        current = page.locator("aside").filter({ has: page.getByText(/^35 tarjetas programables$/) }).first()
      }
      await current.getByText(/^35 tarjetas programables$/).waitFor({ state: "visible" })
      return current
    }
    const catalog = await resolveCatalog()
    await waitForStableLayout(page, [catalog], `${viewport.name} catalog readiness`)
    const catalogGeometry = await assertVisibleAndUnobscured(page, catalog, `${viewport.name} catalog`)
    const catalogCount = catalog.getByText(/^35 tarjetas programables$/)
    await catalogCount.waitFor({ state: "visible" })
    assert.equal(await catalogCount.textContent(), "35 tarjetas programables", `${viewport.name} catalog count`)
    const canvasOverflow = await assertNoHorizontalOverflow(page, `${viewport.name} canvas catalog`)
    await page.screenshot({ path: join(artifactDir, `${viewport.name}-canvas.png`) })

    const libraryUrl = `${baseUrl}/?section=library`
    await page.goto(libraryUrl, { waitUntil: "domcontentloaded" })
    const libraryHeader = page.locator("header").first()
    const libraryHeading = libraryHeader.getByText("Biblioteca de datos", { exact: true })
    await libraryHeading.waitFor()
    const libraryHeaderGeometry = await assertVisibleAndUnobscured(page, libraryHeader, `${viewport.name} library header`)
    await assertVisibleAndUnobscured(page, libraryHeading, `${viewport.name} library heading`)
    const libraryResumenTab = page.getByRole("button", { name: "Resumen", exact: true })
    const libraryMacroTab = page.getByRole("button", { name: "Macro", exact: true })
    await libraryResumenTab.waitFor()
    await libraryMacroTab.waitFor()
    await page.getByText(/EMAE — Actividad Económica/i).first().waitFor()
    await waitForStableLayout(page, [libraryHeader, libraryHeading, libraryResumenTab, libraryMacroTab], `${viewport.name} library readiness`)
    const libraryDashboardGeometry = await assertVisibleAndUnobscured(page, libraryMacroTab, `${viewport.name} library dashboard`)
    const libraryOverflow = await assertNoHorizontalOverflow(page, `${viewport.name} library`)
    await page.screenshot({ path: join(artifactDir, `${viewport.name}-library.png`) })

    const focusLibraryUrl = `${baseUrl}/?section=library&ticker=YPFD&kind=accion`
    const focusRequest = page.waitForRequest((request) => request.url().includes("/api/acciones/YPFD"))
    await page.goto(focusLibraryUrl, { waitUntil: "domcontentloaded" })
    const focusLibraryHeading = page.locator("header").first().getByText("Biblioteca de datos", { exact: true })
    await focusLibraryHeading.waitFor()
    await focusRequest
    const focusFinanzasTab = page.getByRole("button", { name: "Finanzas", exact: true })
    const focusAccionesTab = page.getByRole("button", { name: /Acciones$/ }).first()
    await focusAccionesTab.waitFor()
    await waitForStableLayout(page, [focusLibraryHeading, focusFinanzasTab, focusAccionesTab], `${viewport.name} focused library readiness`)
    await assertVisibleAndUnobscured(page, focusAccionesTab, `${viewport.name} focused ticker section`)
    const focusedLibraryOverflow = await assertNoHorizontalOverflow(page, `${viewport.name} focused library`)
    await page.screenshot({ path: join(artifactDir, `${viewport.name}-library-focus.png`) })

    const connectUrl = `${baseUrl}/?section=connect`
    await page.goto(connectUrl, { waitUntil: "domcontentloaded" })
    const connectHeader = page.locator("header").first()
    const connectHeading = page.getByRole("heading", { name: "Conectar La Pizarra", exact: true })
    const claudeHeading = page.getByRole("heading", { name: "Conectar en Claude", exact: true })
    const mcpUrl = page.getByText("https://www.lapizarra.ar/api/mcp", { exact: true }).first()
    await connectHeading.waitFor()
    await claudeHeading.waitFor()
    await waitForStableLayout(page, [connectHeader, connectHeading, claudeHeading, mcpUrl], `${viewport.name} connect readiness`)
    await assertVisibleAndUnobscured(page, connectHeader, `${viewport.name} connect header`)
    await assertVisibleAndUnobscured(page, connectHeading, `${viewport.name} connect heading`)
    await assertVisibleAndUnobscured(page, claudeHeading, `${viewport.name} Claude heading`)
    await assertVisibleAndUnobscured(page, mcpUrl, `${viewport.name} MCP URL`)
    const connectOverflow = await assertNoHorizontalOverflow(page, `${viewport.name} connect`)
    await page.screenshot({ path: join(artifactDir, `${viewport.name}-connect.png`), fullPage: true })

    assert.deepEqual(pageErrors, [], `${viewport.name} page errors: ${pageErrors.join("; ")}`)
    results.push({
      viewport,
      routes: {
        canvas: { catalogCount: 35, catalogGeometry, overflow: canvasOverflow },
        library: { heading: "Biblioteca de datos", headerGeometry: libraryHeaderGeometry, dashboardGeometry: libraryDashboardGeometry, overflow: libraryOverflow },
        drawer: { openGeometry: drawerOpenGeometry, libraryHeading: Boolean(drawerLibraryHeading), canvasHeading: Boolean(drawerCanvasHeading) },
        libraryFocus: { ticker: "YPFD", cardId: "acciones", overflow: focusedLibraryOverflow },
        connect: { heading: "Conectar La Pizarra", claude: true, mcpUrl: true, overflow: connectOverflow },
      },
      pageErrors,
    })
    await context.close()
  }
} catch (error) {
  smokeError = error
} finally {
  if (browser) await browser.close()
  writeFileSync(join(artifactDir, "browser-smoke.json"), `${JSON.stringify({ baseUrl, results, error: smokeError ? String(smokeError.message ?? smokeError) : null }, null, 2)}\n`)
}

if (smokeError) throw smokeError
console.log(`browser smoke passed: ${results.length} viewports, ${results.length * 5} routes`)
