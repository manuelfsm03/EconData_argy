// Templates HTML minimalistas para los emails de alerta disparada.
// Estilo: fondo dark, header amber, link al dashboard.
//
// Todo inline por compatibilidad con clientes de mail (Gmail suele romper CSS
// en <head>). Sin imágenes externas para no depender de un CDN.

const DASHBOARD_URL = process.env.LAPIZARRA_URL ?? "https://lapizarra.ar"

const BG = "#121214"
const BG_PANEL = "#1A1A1D"
const TEXT = "#F5F3EE"
const TEXT_DIM = "#A8A49D"
const AMBER = "#E8944A"
const BORDER = "#2A2A2F"

interface Args {
  descripcion: string   // "Dólar Blue > $1.500"
  detalle: string       // "El dólar blue está en $1.520 (venta) — cruzó tu umbral"
  ctaLabel?: string     // default: "Ver en La Pizarra"
  ctaHref?: string      // default: DASHBOARD_URL
}

export function renderAlertaDisparadaHtml(args: Args): string {
  const cta = args.ctaLabel ?? "Ver en La Pizarra"
  const href = args.ctaHref ?? DASHBOARD_URL

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Alerta disparada — La Pizarra</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:${TEXT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;background:${BG_PANEL};border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:20px 28px;background:${AMBER};color:#0a0a0a;">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;opacity:0.75;">La Pizarra · Alerta</div>
              <div style="font-size:20px;font-weight:800;margin-top:6px;">${escapeHtml(args.descripcion)}</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:${TEXT};">
                ${escapeHtml(args.detalle)}
              </p>
              <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:${TEXT_DIM};">
                Esta alerta pasó a estado <b style="color:${TEXT};">disparada</b>.
                Para volver a recibirla podés reactivarla desde tu panel.
              </p>
              <p style="margin:0;">
                <a href="${href}"
                   style="display:inline-block;padding:12px 20px;background:${AMBER};color:#0a0a0a;
                          text-decoration:none;border-radius:4px;font-size:13px;font-weight:700;
                          text-transform:uppercase;letter-spacing:1px;">
                  ${escapeHtml(cta)}
                </a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 28px;border-top:1px solid ${BORDER};font-size:11px;color:${TEXT_DIM};text-align:center;">
              Recibís este mail porque configuraste una alerta en La Pizarra.
              Si no fuiste vos, ignoralo o borrala desde el panel.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// Escape mínimo para inyectar texto en HTML de email.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
