# Changelog

## 2026-08-14

- Bonos: nueva calculadora para simular precio, TIR y métricas de GD30 con una fecha de liquidación elegida.
- Bandas cambiarias: la trayectoria REM ahora usa el mismo Excel histórico oficial del BCRA que el panel REM, sin completar datos faltantes con valores estimados.
- Noticias: el filtro usa palabras completas, la sección de origen y una ventana de actualidad de 30 días; excluye duplicados, deportes, espectáculos, policiales, accidentes y ocio que antes entraban por coincidencias parciales como `un`, `oro`, `irán` o `elecciones` dentro de otras palabras.
- Foro: se muestran los temas con más actividad de las últimas 24 horas y se puede abrir cada conversación desde sus accesos rápidos.
- Macro: Big Mac y Señoreaje siguen disponibles en Biblioteca/Canvas, se eliminó la pirámide duplicada y se retiró la fuente EMAE obsoleta.
- Estado: la salud se calcula por los endpoints reales de cada tarjeta, con cancelación, deduplicación, límite de sondeos y exclusión de operaciones con efectos laterales.
- ROFEX: la fuente de mercado Rava admite hasta 15 MB; el límite general de 5 MB continúa cerrado para el resto.
- Tasas: TAMAR BCRA (variable 44) pasa a ser la referencia mayorista vigente en Resumen, BCRA, Economía y Breakeven. BADLAR se conserva como serie histórica secundaria y en los campos de respuesta compatibles.
