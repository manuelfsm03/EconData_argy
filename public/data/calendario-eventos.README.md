# Calendario financiero — cómo agregar/corregir eventos

Este archivo (`calendario-eventos.json`) es el catálogo curado que alimenta el
Calendario Financiero (`/calendario`), el componente "Próximos eventos" del
resumen y el feed iCal (`/api/calendario.ics`).

## Estructura

```json
{
  "actualizado": "YYYY-MM-DD",
  "cobertura": { "desde": "YYYY-MM-DD", "hasta": "YYYY-MM-DD" },
  "nota": "Aclaración libre sobre el criterio del catálogo.",
  "eventos": [ /* array de EventoFinanciero */ ]
}
```

Cada evento respeta el contrato de `EventoFinanciero`
(`src/lib/calendario-financiero.ts`):

| Campo         | Tipo                                                                                                | Requerido | Notas                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `id`          | `string`                                                                                            | sí        | Único y estable. Formato sugerido: `<slug-corto>-<YYYY-MM-DD>`.                          |
| `fecha`       | `string` (`YYYY-MM-DD`)                                                                             | sí        | ISO. Zona horaria implícita: America/Argentina/Buenos_Aires.                             |
| `hora`        | `string` (`HH:mm`)                                                                                  | opcional  | Si se omite, el evento es "todo el día".                                                 |
| `categoria`   | `"licitacion" \| "publicacion_datos" \| "vencimiento_tesoro" \| "earnings" \| "feriado" \| "otro"` | sí        |                                                                                          |
| `titulo`      | `string`                                                                                            | sí        | Breve, resume qué es y de qué período.                                                   |
| `descripcion` | `string`                                                                                            | opcional  | Contexto adicional (2-3 líneas).                                                         |
| `fuente`      | `{ nombre: string; url?: string }`                                                                  | sí        | Fuente oficial verificable.                                                              |
| `importancia` | `"alta" \| "media" \| "baja"`                                                                       | sí        | Filtro rápido "solo alta importancia".                                                   |
| `recurrencia` | `"mensual" \| "trimestral" \| "anual" \| null`                                                     | opcional  | Solo informativo (no genera instancias). Cada instancia debe cargarse como evento propio. |

## Reglas de curación

1. **Nada de scraping en vivo (por ahora).** Todo se hardcodea acá.
2. **Fechas honestas.** Si es estimada (ej. licitaciones al 2do/4to miércoles),
   marcarlo en el `titulo` con "— estimada" y aclararlo en `descripcion`.
3. **Fuente siempre citada.** Si la URL cambia, actualizarla.
4. **Sin duplicados.** El `id` es la clave: cambiarlo si cambia el mes/año.
5. **Cobertura mínima:** 3-6 meses hacia adelante. Cuando se acabe, agregar
   los meses siguientes a mano.

## Categorías

- `licitacion` → Licitaciones del Tesoro Nacional (Bonos/LECAP/BONCER).
- `publicacion_datos` → INDEC, BCRA, AFIP, etc. (IPC, EMAE, IPI, reservas...).
- `vencimiento_tesoro` → Pagos de servicios de deuda soberana (GD30, AL30, etc.).
- `earnings` → Balances de empresas argentinas (YPF, GGAL, PAMP, etc.).
- `feriado` → Feriados nacionales con impacto en el mercado.
- `otro` → Cualquier evento que no encaje en las anteriores.

## Cómo agregar un evento nuevo

1. Editar `calendario-eventos.json`.
2. Agregar el evento al array `eventos` (respetar el orden por fecha ascendente
   ayuda a leer, pero el endpoint igual ordena).
3. Actualizar el campo `actualizado` con la fecha de hoy.
4. Si extendés la cobertura, actualizar `cobertura.hasta`.
5. Correr `npx tsc --noEmit` para confirmar que el JSON sigue matcheando el tipo
   (el endpoint lo valida en runtime, pero un typo en `categoria` se detecta acá).

## Ideas para las próximas iteraciones

- Balances (`earnings`) de empresas AR con fechas confirmadas: YPF, GGAL, PAMP, TXAR, BMA, TGSU2.
- Integración con el sistema de alertas del proyecto (`recordatorio_evento`).
- Admin UI para agregar eventos sin editar JSON.
- Notificaciones automáticas 1 día antes por email/push.
- Cargar el cronograma oficial de servicios de deuda del Ministerio de Economía
  para reemplazar las fechas estimadas de bonos.
