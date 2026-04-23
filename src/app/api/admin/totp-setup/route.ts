/**
 * GET  /api/admin/totp-setup  — genera secret + QR para escanear
 * POST /api/admin/totp-setup  — verifica que el código del teléfono es correcto
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticator } from "otplib"
import QRCode from "qrcode"

export const runtime = "nodejs"

function isAuthorized(req: NextRequest): boolean {
  const pw = process.env.ADMIN_PASSWORD
  if (!pw) return false
  if (req.headers.get("x-admin-password") === pw) return true
  if (req.cookies.get("lapizarra_admin")?.value === pw) return true
  return false
}

// GET: generar QR para escanear con Microsoft/Google Authenticator
export async function GET(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  // Si ya hay un secret configurado, no generar uno nuevo
  const existingSecret = process.env.TOTP_SECRET
  const secret = existingSecret ?? authenticator.generateSecret()

  const otpauth = authenticator.keyuri(
    "lapizarra-admin",   // cuenta
    "La Pizarra",        // issuer (aparece en el app)
    secret,
  )

  const qrDataUrl = await QRCode.toDataURL(otpauth, {
    width:  300,
    margin: 2,
    color:  { dark: "#ffffff", light: "#000000" },
  })

  return NextResponse.json({
    secret,
    otpauth,
    qr_data_url:   qrDataUrl,
    ya_configurado: !!existingSecret,
    instrucciones: existingSecret
      ? "TOTP ya configurado. Usá el código de tu app."
      : `Escaneá el QR con Microsoft/Google Authenticator y guardá el secret en TOTP_SECRET=${secret}`,
  })
}

// POST: verificar código de 6 dígitos
export async function POST(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { code } = await req.json() as { code?: string }
  const secret   = process.env.TOTP_SECRET

  if (!secret)
    return NextResponse.json({ error: "TOTP no configurado. Escaneá el QR primero." }, { status: 503 })

  if (!code || !/^\d{6}$/.test(code))
    return NextResponse.json({ error: "Código debe ser 6 dígitos" }, { status: 400 })

  const valid = authenticator.verify({ token: code, secret })

  if (!valid)
    return NextResponse.json({ error: "Código incorrecto o expirado" }, { status: 401 })

  return NextResponse.json({ ok: true, mensaje: "Código TOTP válido" })
}
