import assert from "node:assert/strict"
import test from "node:test"

import { DATA_CARD_BY_ID, DATA_CARD_CATALOG, searchDataCards } from "../src/lib/card-catalog"
import {
  CANVAS_ACTIVE_KEY,
  CANVAS_CATALOG_RAIL_PX,
  CANVAS_CONTENT_GUTTER_PX,
  CANVAS_STORAGE_KEY,
  LEGACY_CANVAS_ACTIVE_KEY,
  LEGACY_CANVAS_STORAGE_KEY,
  buildCanvasLayout,
  canvasReducer,
  createInitialCanvasState,
  isValidStoredSheets,
  persistCanvasState,
  pixelsToRows,
  readCanvasState,
  type CanvasState,
  type CanvasWidget,
} from "../src/client/lib/canvas-workspace"

class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

const widget = (instanceId = "w-1"): CanvasWidget => ({
  instanceId,
  cardId: "ipc",
  x: 0,
  y: 0,
  w: 4,
  h: 8,
  autoFit: true,
})

test("Canvas catalog has 35 unique cards and every card is searchable by its id", () => {
  assert.equal(DATA_CARD_CATALOG.length, 35)
  assert.equal(new Set(DATA_CARD_CATALOG.map((card) => card.id)).size, 35)
  assert.ok(DATA_CARD_CATALOG.every((card) => DATA_CARD_BY_ID.get(card.id) === card))
  assert.ok(DATA_CARD_CATALOG.every((card) => searchDataCards(card.title).some((result) => result.id === card.id)))
})

test("stored sheets validation rejects empty, malformed, and non-finite drafts", () => {
  assert.equal(isValidStoredSheets([]), false)
  assert.equal(isValidStoredSheets([{ id: "sheet", name: "Sheet", widgets: [] }]), true)
  assert.equal(isValidStoredSheets([{ id: "sheet", name: "Sheet", widgets: [{ ...widget(), x: Number.NaN }] }]), false)
  assert.equal(isValidStoredSheets([{ id: "sheet", name: "Sheet", widgets: [{ ...widget(), h: 0 }] }]), false)
  assert.equal(isValidStoredSheets([{ id: "sheet", name: "Sheet", widgets: [{ ...widget(), autoFit: "yes" }] }]), false)
})

test("corrupt current storage fails closed to the initial workspace", () => {
  const storage = new MemoryStorage()
  storage.values.set(CANVAS_STORAGE_KEY, "not-json")
  storage.values.set(CANVAS_ACTIVE_KEY, "corrupt")
  const state = readCanvasState(storage)
  assert.deepEqual(state, createInitialCanvasState())
})

test("legacy storage migrates row coordinates and preserves legacy active sheet", () => {
  const storage = new MemoryStorage()
  storage.setItem(LEGACY_CANVAS_STORAGE_KEY, JSON.stringify([{ id: "legacy", name: "Legacy", widgets: [widget()] }]))
  storage.setItem(LEGACY_CANVAS_ACTIVE_KEY, "legacy")
  const state = readCanvasState(storage)
  assert.equal(state.activeId, "legacy")
  assert.deepEqual(state.sheets[0]?.widgets[0], { ...widget(), y: 0, h: 16 })
})

test("persisted state round-trips through the real storage adapter", () => {
  const storage = new MemoryStorage()
  const state: CanvasState = { sheets: [{ id: "sheet", name: "Sheet", widgets: [widget()] }], activeId: "sheet" }
  assert.equal(persistCanvasState(storage, state), true)
  assert.deepEqual(readCanvasState(storage), state)
  assert.equal(storage.getItem(CANVAS_ACTIVE_KEY), "sheet")
})

test("sheet reducer supports add, rename, duplicate, and delete lifecycle", () => {
  const initial = createInitialCanvasState()
  const added = canvasReducer(initial, { type: "add-sheet", id: "second" })
  assert.equal(added.activeId, "second")
  assert.equal(added.sheets[1]?.name, "Hoja 2")
  const renamed = canvasReducer(added, { type: "rename-sheet", id: "second", name: "Research" })
  const duplicated = canvasReducer(renamed, { type: "duplicate-sheet", sourceId: "mi-pizarra", id: "copy", widgetInstanceIds: ["copy-1", "copy-2", "copy-3", "copy-4"] })
  assert.equal(duplicated.sheets.at(-1)?.name, "Mi Pizarra copia")
  assert.deepEqual(duplicated.sheets.at(-1)?.widgets.map((item) => item.instanceId), ["copy-1", "copy-2", "copy-3", "copy-4"])
  const deleted = canvasReducer(duplicated, { type: "delete-sheet", id: "copy" })
  assert.equal(deleted.sheets.some((sheet) => sheet.id === "copy"), false)
  assert.equal(canvasReducer(initial, { type: "delete-sheet", id: "mi-pizarra" }), initial)
})

test("widget reducer actions add and remove cards without touching another sheet", () => {
  const initial = { sheets: [{ id: "sheet-a", name: "A", widgets: [] }, { id: "sheet-b", name: "B", widgets: [widget("other")] }], activeId: "sheet-a" }
  const added = canvasReducer(initial, { type: "add-widget", sheetId: "sheet-a", widget: widget() })
  assert.equal(added.sheets[0]?.widgets.length, 1)
  assert.equal(added.sheets[1]?.widgets[0]?.instanceId, "other")
  const removed = canvasReducer(added, { type: "remove-widget", sheetId: "sheet-a", instanceId: "w-1" })
  assert.deepEqual(removed.sheets[0]?.widgets, [])
})

test("desktop layout reflects saved positions while mobile collapses to one column", () => {
  const widgets = [{ ...widget(), x: 5, y: 9, w: 6, h: 10 }]
  const desktop = buildCanvasLayout(widgets, false, DATA_CARD_BY_ID)
  const mobile = buildCanvasLayout(widgets, true, DATA_CARD_BY_ID)
  assert.deepEqual(desktop[0], { i: "w-1", x: 5, y: 9, w: 6, h: 10, minW: 4, minH: 12 })
  assert.deepEqual(mobile[0], { i: "w-1", x: 0, y: 9, w: 1, h: 10, minW: 1, minH: 12 })
})

test("desktop layout and resize reducers persist geometry and disable auto-fit", () => {
  const initial = { sheets: [{ id: "sheet", name: "Sheet", widgets: [widget()] }], activeId: "sheet" }
  const moved = canvasReducer(initial, { type: "update-layout", sheetId: "sheet", layout: [{ i: "w-1", x: 2, y: 4, w: 7, h: 9, minW: 4, minH: 6 }] })
  assert.deepEqual(moved.sheets[0]?.widgets[0], { ...widget(), x: 2, y: 4, w: 7, h: 9 })
  const resized = canvasReducer(moved, { type: "resize-widget", sheetId: "sheet", instanceId: "w-1", w: 8, h: 12 })
  assert.deepEqual(resized.sheets[0]?.widgets[0], { ...widget(), x: 2, y: 4, w: 8, h: 12, autoFit: false })
})

test("content measurement is bounded by the card minimum and maximum", () => {
  assert.equal(pixelsToRows(1, 4, 12), 4)
  assert.equal(pixelsToRows(5000, 4, 12), 12)
  assert.ok(pixelsToRows(100, 4, 12) > 4)
})

test("desktop catalog clamp uses semantic rail and gutter constants", () => {
  assert.equal(CANVAS_CATALOG_RAIL_PX, 320)
  assert.equal(CANVAS_CONTENT_GUTTER_PX, 16)
})
