import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { password } = await req.json() as { password?: string }
  const expected     = process.env.ADMIN_PASSWORD

  if (!expected || password !== expected)
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set("lapizarra_admin", expected, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   60 * 60 * 8, // 8 horas
    path:     "/",
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete("lapizarra_admin")
  return res
}
