# retenciones.json — retenciones a la exportación agrícola

Este archivo es la **fuente de verdad** para las retenciones (derechos de exportación) y los gastos portuarios que usa el endpoint `/api/agro-local` para calcular el FOB teórico de los granos.

## Cuándo editar

Cuando el Ministerio de Economía publique una nueva resolución que modifique:
- El derecho de exportación de algún cultivo (`cultivos.<grano>.derecho_export`, valor decimal — ej. `0.33` = 33%).
- Los gastos portuarios estimados (`gastos_portuarios_usd_ton`, USD por tonelada).

Actualizá también `vigente_desde` y `resolucion_ref` con la fecha y el número de la resolución.

## Dónde ver la resolución vigente

- Boletín Oficial de la República Argentina: <https://www.boletinoficial.gob.ar/>
- InfoLEG (búsqueda por número de resolución): <http://servicios.infoleg.gob.ar/>

Buscá resoluciones del Ministerio de Economía sobre "derechos de exportación" o "retenciones".

## Cómo se aplica el cambio

Un commit que actualice este JSON dispara el redeploy en Vercel — no hace falta tocar código TypeScript. El endpoint `/api/agro-local` lo lee en cada request (con fallback a los valores anteriores si el JSON queda malformado).
