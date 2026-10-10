import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

/**
 * /api/news (feed de noticias respaldado por Postgres, tabla newsItem) tiraba
 * HTTP 500 con stack trace cada vez que se llamaba, porque esa Postgres
 * todavía no está provisionada (mismo bloqueo que login/foro/profiles —
 * ver PR #89/#90, depende de credenciales de Vercel que no son mías).
 *
 * El único consumidor real (`lapizarra coyuntura` en el CLI, cli/src/
 * commands/coyuntura.ts) ya trata cualquier error como "sin dato primario"
 * y cae a /api/rss-news apenas ve un array vacío — así que un 500 con
 * stack trace no agregaba nada, sólo ruido en los logs en cada llamada.
 */
const route = readFileSync("src/app/api/news/route.ts", "utf8")

test("GET se degrada a array vacío si newsItem no está disponible, no tira 500", () => {
  const getStart = route.indexOf("export async function GET")
  const postStart = route.indexOf("export async function POST")
  const getBody = route.slice(getStart, postStart)

  assert.match(getBody, /catch\s*\(error\)\s*\{/)
  assert.doesNotMatch(getBody, /status:\s*500/)
  assert.match(getBody, /NextResponse\.json\(\[\]\)/)
})

test("el degradado no se traga errores en silencio: queda logueado", () => {
  const getStart = route.indexOf("export async function GET")
  const postStart = route.indexOf("export async function POST")
  const getBody = route.slice(getStart, postStart)
  assert.match(getBody, /console\.warn/)
})

test("POST sigue exigiendo autorización de admin — el degradado es sólo de lectura", () => {
  const postStart = route.indexOf("export async function POST")
  const postBody = route.slice(postStart)
  assert.match(postBody, /requireAdminAuthorization\s*\(/)
})
