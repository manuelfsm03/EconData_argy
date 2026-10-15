import assert from "node:assert/strict"
import test from "node:test"

import {
  decideAuthAction,
  isProtectedPath,
  readSupabaseEnv,
  shouldRedirectToLogin,
} from "../src/lib/supabase/middleware-policy"

const base = { supabaseUrl: "https://x.supabase.co", supabaseKey: "sb_publishable_x" }

test("USERS_ENABLED false: pass-through en todas las rutas", () => {
  for (const pathname of ["/", "/perfil", "/api/dolares", "/glosario", "/tv"]) {
    assert.equal(decideAuthAction({ pathname, usersEnabled: false, ...base }), "pass")
  }
})

test("faltan env vars: pass-through aunque auth este habilitada", () => {
  assert.equal(decideAuthAction({ pathname: "/perfil", usersEnabled: true }), "pass")
  assert.equal(
    decideAuthAction({ pathname: "/perfil", usersEnabled: true, supabaseUrl: "https://x" }),
    "pass"
  )
  assert.equal(
    decideAuthAction({ pathname: "/perfil", usersEnabled: true, supabaseKey: "k" }),
    "pass"
  )
})

test("rutas publicas no tocan Supabase", () => {
  for (const pathname of [
    "/auth/login",
    "/api/bcra",
    "/api/macro",
    "/api/bonos",
    "/data/x.json",
    "/glosario",
    "/privacidad",
    "/terminos",
    "/tv",
  ]) {
    assert.equal(decideAuthAction({ pathname, usersEnabled: true, ...base }), "pass", pathname)
  }
})

test("habilitado + configurado: chequea sesion en el resto", () => {
  assert.equal(decideAuthAction({ pathname: "/", usersEnabled: true, ...base }), "check-session")
  assert.equal(decideAuthAction({ pathname: "/perfil", usersEnabled: true, ...base }), "check-session")
})

test("redirect solo para rutas protegidas sin usuario", () => {
  assert.equal(shouldRedirectToLogin("/perfil", false), true)
  assert.equal(shouldRedirectToLogin("/perfil/abc", false), true)
  assert.equal(shouldRedirectToLogin("/perfil", true), false)
  assert.equal(shouldRedirectToLogin("/", false), false)
  assert.equal(shouldRedirectToLogin("/perfiles-publicos", false), false)
  assert.equal(isProtectedPath("/api/perfil"), false)
})

test("readSupabaseEnv: publishable key con fallback a anon", () => {
  assert.deepEqual(
    readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "u", NEXT_PUBLIC_SUPABASE_ANON_KEY: "a" } as never),
    { url: "u", key: "a" }
  )
  assert.equal(
    readSupabaseEnv({
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "p",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "a",
    } as never).key,
    "p"
  )
  assert.deepEqual(readSupabaseEnv({} as never), { url: undefined, key: undefined })
})
