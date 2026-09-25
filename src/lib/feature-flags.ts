export const USERS_ENABLED = false

// Alertas por email (MVP freemium). Se habilita cuando esté seteada la migración
// `alertas` en Postgres real Y el env RESEND_API_KEY. Encendido default en dev
// para que Juan/Gonza puedan probar la UI; en prod arrancar en false hasta que
// esté todo listo.
export const ALERTAS_ENABLED = true