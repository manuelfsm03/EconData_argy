# Mora e irregularidad del crédito (BCRA)

Fuente de series agregadas del sistema financiero: ratio de cartera irregular del crédito al sector privado (total, familias, empresas), mensual. Consumidor previsto: macro (gráficos "Irregularidad del crédito a privados / a familias").

No usa la Central de Deudores (consultas por CUIT/CUIL tienen condiciones de uso propias).

## Flujo

1. `.github/workflows/update-mora-bcra.yml` (mensual, día 5, y `workflow_dispatch`).
2. `scripts/update-mora-bcra.ts` descarga el Excel y parsea con `src/server/sources/bcra-irregularidad.ts` (búsqueda por etiquetas, no por índices).
3. Escribe `public/data/mora-bcra.json` (`estado`, `fuente`, `url_fuente`, `generado_en`, `cobertura`, `series`).
4. `GET /api/credito/mora?serie=familias&desde=2023-01` lo sirve sin llamadas externas.

El JSON NO está versionado en este PR: lo produce la primera corrida real. Hasta entonces el endpoint responde 503 `DATA_NOT_READY`.

## Degradación

Si la descarga o el parseo fallan, el script no inventa datos: conserva el JSON previo con `estado: "fuente_caida"` y `ultimo_error`, y el workflow queda en rojo.

## Supuestos NO VERIFICADOS (validar fuera de la red corporativa)

- URL por defecto: `https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/informes/InfBanc_Anexo.xlsx` (el mismo anexo que ya usa `bcra-banking.ts`). No se confirmó que contenga hojas de irregularidad; si no, configurar la variable de repositorio `MORA_BCRA_URL` (o `MORA_BCRA_URL=... npx tsx scripts/update-mora-bcra.ts`) con el archivo correcto de series de calidad de cartera.
- Layout: fila de fechas mensuales (serial Excel, fecha o texto), rótulo que contiene "irregular" y sub-filas "familias" / "empresas" / "total/privado".
- Unidad: porcentaje; si todos los valores son <= 1 se interpretan como fracción y se multiplican por 100.

## Cómo validar

```
gh workflow run "Actualizar mora BCRA"      # o: npx tsx scripts/update-mora-bcra.ts
```

Revisar en el log las series y el último período, y contrastar el último valor de familias y empresas con el gráfico publicado por el BCRA.
