import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  IPC_DIVISIONS,
  buildIpcDivisionSnapshot,
  chunkIpcDivisionKeys,
} from "../src/server/domain/ipc-divisions"

const macroRoute = readFileSync("src/app/api/macro/route.ts", "utf8")
const cardCatalog = readFileSync("src/lib/card-catalog.ts", "utf8")

test("declares the 12 unique official INDEC IPC divisions", () => {
  assert.equal(IPC_DIVISIONS.length, 12)
  assert.equal(new Set(IPC_DIVISIONS.map(item => item.key)).size, 12)
  assert.equal(new Set(IPC_DIVISIONS.map(item => item.id)).size, 12)
  assert.ok(IPC_DIVISIONS.every(item => item.id.startsWith("146.3_")))
})

test("splits the series into four bounded requests", () => {
  const chunks = chunkIpcDivisionKeys(3)
  assert.equal(chunks.length, 4)
  assert.ok(chunks.every(chunk => chunk.length === 3))
  assert.deepEqual(chunks.flat(), IPC_DIVISIONS.map(item => item.key))
})

test("computes monthly and annual changes from index levels", () => {
  const key = IPC_DIVISIONS[0].key
  const series = Array.from({ length: 13 }, (_, index) => [
    new Date(Date.UTC(2026, 5 - index, 1)).toISOString().slice(0, 10),
    index === 0 ? 120 : index === 1 ? 100 : index === 12 ? 80 : 90,
  ] as [string, number])

  const snapshot = buildIpcDivisionSnapshot({ [key]: series })
  assert.equal(snapshot[0].data_date, "2026-06-01")
  assert.equal(snapshot[0].nivel, 120)
  assert.equal(snapshot[0].var_mensual, 20)
  assert.equal(snapshot[0].var_interanual, 50)
  assert.equal(snapshot[1].nivel, null)
})

test("keeps missing or invalid comparison levels null", () => {
  const key = IPC_DIVISIONS[0].key
  const snapshot = buildIpcDivisionSnapshot({ [key]: [["2026-06-01", 120], ["2026-05-01", 0]] })
  assert.equal(snapshot[0].var_mensual, null)
  assert.equal(snapshot[0].var_interanual, null)
})

test("macro route exposes the endpoint and the active IPC card links it", () => {
  assert.match(macroRoute, /endpoint === "ipc_divisiones"/)
  assert.match(macroRoute, /chunkIpcDivisionKeys\(3\)/)
  assert.match(macroRoute, /Promise\.all/)
  assert.match(cardCatalog, /\/api\/macro\?endpoint=ipc_divisiones/)
})
