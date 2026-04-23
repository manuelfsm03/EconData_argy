import { NextRequest, NextResponse } from "next/server"

const ADMIN_COOKIE = "lapizarra_admin"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Proteger páginas /admin/* ─────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    const cookie   = request.cookies.get(ADMIN_COOKIE)?.value
    const expected = process.env.ADMIN_PASSWORD

    // Cookie válida → dejar pasar
    if (expected && cookie === expected) return NextResponse.next()

    // Sin cookie → redirigir al login
    const loginUrl = new URL("/admin/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/((?!login).*)"],
}
