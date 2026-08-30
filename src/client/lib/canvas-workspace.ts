import type { DataCardDefinition } from "@/lib/card-catalog"

export const CANVAS_STORAGE_KEY = "lapizarra.canvas.sheets.v3"
export const CANVAS_ACTIVE_KEY = "lapizarra.canvas.active-sheet.v3"
export const LEGACY_CANVAS_STORAGE_KEY = "lapizarra.canvas.sheets.v2"
export const LEGACY_CANVAS_ACTIVE_KEY = "lapizarra.canvas.active-sheet.v2"
export const LEGACY_HEIGHT_SCALE = 2
export const GRID_ROW_HEIGHT = 22
export const GRID_ROW_GAP = 6
export const CARD_HEADER_HEIGHT = 40
export const CANVAS_CATALOG_RAIL_PX = 20 * 16
export const CANVAS_CONTENT_GUTTER_PX = 2 * 8

export interface CanvasWidget {
  instanceId: string
  cardId: string
  x: number
  y: number
  w: number
  h: number
  autoFit?: boolean
}

export interface CanvasSheet {
  id: string
  name: string
  widgets: CanvasWidget[]
}

export interface CanvasState {
  sheets: CanvasSheet[]
  activeId: string
}

export interface CanvasLayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

export function initialSheets(): CanvasSheet[] {
  return [{
    id: "mi-pizarra",
    name: "Mi Pizarra",
    widgets: [
      { instanceId: "inicio-tipo-cambio", cardId: "resumen-tipo-cambio", x: 0, y: 0, w: 12, h: 10, autoFit: true },
      { instanceId: "inicio-riesgo", cardId: "resumen-riesgo", x: 0, y: 10, w: 4, h: 8, autoFit: true },
      { instanceId: "inicio-reservas", cardId: "resumen-reservas", x: 4, y: 10, w: 4, h: 10, autoFit: true },
      { instanceId: "inicio-rem", cardId: "rem", x: 8, y: 10, w: 4, h: 20, autoFit: true },
    ],
  }]
}

export function createInitialCanvasState(): CanvasState {
  return { sheets: initialSheets(), activeId: "mi-pizarra" }
}

function isFiniteDimension(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function isCanvasWidget(value: unknown): value is CanvasWidget {
  if (!value || typeof value !== "object") return false
  const widget = value as Record<string, unknown>
  return typeof widget.instanceId === "string" && widget.instanceId.length > 0
    && typeof widget.cardId === "string" && widget.cardId.length > 0
    && isFiniteDimension(widget.x) && isFiniteDimension(widget.y)
    && isFiniteDimension(widget.w) && widget.w > 0
    && isFiniteDimension(widget.h) && widget.h > 0
    && (widget.autoFit === undefined || typeof widget.autoFit === "boolean")
}

export function isValidStoredSheets(value: unknown): value is CanvasSheet[] {
  if (!Array.isArray(value) || value.length === 0) return false
  return value.every((value) => {
    if (!value || typeof value !== "object") return false
    const sheet = value as Record<string, unknown>
    return typeof sheet.id === "string" && sheet.id.length > 0
      && typeof sheet.name === "string"
      && Array.isArray(sheet.widgets)
      && sheet.widgets.every(isCanvasWidget)
  })
}

export function migrateLegacySheets(sheets: CanvasSheet[]): CanvasSheet[] {
  return sheets.map((sheet) => ({
    ...sheet,
    widgets: sheet.widgets.map((widget) => ({
      ...widget,
      y: widget.y * LEGACY_HEIGHT_SCALE,
      h: widget.h * LEGACY_HEIGHT_SCALE,
      autoFit: widget.autoFit ?? true,
    })),
  }))
}

export function readCanvasState(storage: Pick<Storage, "getItem">): CanvasState {
  const defaults = createInitialCanvasState()
  try {
    const current = JSON.parse(storage.getItem(CANVAS_STORAGE_KEY) ?? "null")
    const legacy = current === null ? JSON.parse(storage.getItem(LEGACY_CANVAS_STORAGE_KEY) ?? "null") : null
    const sheets = isValidStoredSheets(current)
      ? current
      : isValidStoredSheets(legacy)
        ? migrateLegacySheets(legacy)
        : defaults.sheets
    const activeId = storage.getItem(CANVAS_ACTIVE_KEY) ?? storage.getItem(LEGACY_CANVAS_ACTIVE_KEY) ?? defaults.activeId
    return { sheets, activeId }
  } catch {
    return defaults
  }
}

export function persistCanvasState(storage: Pick<Storage, "setItem">, state: CanvasState): boolean {
  try {
    storage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(state.sheets))
    storage.setItem(CANVAS_ACTIVE_KEY, state.activeId)
    return true
  } catch {
    return false
  }
}

export function getActiveSheet(state: CanvasState): CanvasSheet | undefined {
  return state.sheets.find((sheet) => sheet.id === state.activeId) ?? state.sheets[0]
}

export function pixelsToRows(contentHeight: number, minH: number, maxH: number): number {
  const measured = Math.ceil((CARD_HEADER_HEIGHT + contentHeight + GRID_ROW_GAP) / (GRID_ROW_HEIGHT + GRID_ROW_GAP))
  return Math.max(minH, Math.min(maxH, measured))
}

export function buildCanvasLayout(
  widgets: readonly CanvasWidget[],
  compact: boolean,
  cards: ReadonlyMap<string, Pick<DataCardDefinition, "minW" | "minH">>,
): CanvasLayoutItem[] {
  return widgets.map((widget) => {
    const definition = cards.get(widget.cardId)
    return {
      i: widget.instanceId,
      x: compact ? 0 : widget.x,
      y: widget.y,
      w: compact ? 1 : widget.w,
      h: widget.h,
      minW: compact ? 1 : definition?.minW ?? 4,
      minH: (definition?.minH ?? 6) * LEGACY_HEIGHT_SCALE,
    }
  })
}

export type CanvasAction =
  | { type: "hydrate"; state: CanvasState }
  | { type: "set-active"; id: string }
  | { type: "add-sheet"; id: string; name?: string }
  | { type: "duplicate-sheet"; sourceId: string; id: string; widgetInstanceIds: string[] }
  | { type: "rename-sheet"; id: string; name: string }
  | { type: "delete-sheet"; id: string }
  | { type: "add-widget"; sheetId: string; widget: CanvasWidget }
  | { type: "remove-widget"; sheetId: string; instanceId: string }
  | { type: "update-active-widgets"; sheetId: string; update: (widgets: CanvasWidget[]) => CanvasWidget[] }
  | { type: "update-layout"; sheetId: string; layout: readonly CanvasLayoutItem[] }
  | { type: "resize-widget"; sheetId: string; instanceId: string; w: number; h: number }

function updateSheet(state: CanvasState, sheetId: string, update: (sheet: CanvasSheet) => CanvasSheet): CanvasState {
  return { ...state, sheets: state.sheets.map((sheet) => sheet.id === sheetId ? update(sheet) : sheet) }
}

export function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case "hydrate":
      return action.state
    case "set-active":
      return { ...state, activeId: action.id }
    case "add-sheet":
      return {
        sheets: [...state.sheets, { id: action.id, name: action.name ?? `Hoja ${state.sheets.length + 1}`, widgets: [] }],
        activeId: action.id,
      }
    case "duplicate-sheet": {
      const source = state.sheets.find((sheet) => sheet.id === action.sourceId)
      if (!source) return state
      return {
        sheets: [...state.sheets, {
          id: action.id,
          name: `${source.name} copia`,
          widgets: source.widgets.map((widget, index) => ({ ...widget, instanceId: action.widgetInstanceIds[index] ?? widget.instanceId })),
        }],
        activeId: action.id,
      }
    }
    case "rename-sheet":
      return updateSheet(state, action.id, (sheet) => ({ ...sheet, name: action.name }))
    case "delete-sheet": {
      if (state.sheets.length === 1) return state
      const index = state.sheets.findIndex((sheet) => sheet.id === action.id)
      if (index < 0) return state
      const sheets = state.sheets.filter((sheet) => sheet.id !== action.id)
      const nextActive = state.activeId === action.id
        ? sheets[Math.max(0, index - 1)]?.id ?? sheets[0]?.id ?? ""
        : state.activeId
      return { sheets, activeId: nextActive }
    }
    case "add-widget":
      return updateSheet(state, action.sheetId, (sheet) => ({ ...sheet, widgets: [...sheet.widgets, action.widget] }))
    case "remove-widget":
      return updateSheet(state, action.sheetId, (sheet) => ({ ...sheet, widgets: sheet.widgets.filter((widget) => widget.instanceId !== action.instanceId) }))
    case "update-active-widgets":
      return updateSheet(state, action.sheetId, (sheet) => ({ ...sheet, widgets: action.update(sheet.widgets) }))
    case "update-layout": {
      const positions = new Map(action.layout.map((item) => [item.i, item]))
      return updateSheet(state, action.sheetId, (sheet) => ({
        ...sheet,
        widgets: sheet.widgets.map((widget) => {
          const item = positions.get(widget.instanceId)
          return item ? { ...widget, x: item.x, y: item.y, w: item.w, h: item.h } : widget
        }),
      }))
    }
    case "resize-widget":
      return updateSheet(state, action.sheetId, (sheet) => ({
        ...sheet,
        widgets: sheet.widgets.map((widget) => widget.instanceId === action.instanceId
          ? { ...widget, w: action.w, h: action.h, autoFit: false }
          : widget),
      }))
  }
}
