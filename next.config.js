/** @type {import('next').NextConfig} */

// Las APIs del gobierno argentino (BCRA, datos.gob.ar) usan certificados
// que el runtime de Node.js no puede verificar en este entorno (proxy SSL).
// Esto permite que las llamadas server-side a esas APIs funcionen correctamente.
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

module.exports = {}
