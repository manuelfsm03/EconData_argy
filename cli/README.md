# lapizarra-cli

> **CLI de La Pizarra** — datos macro y financieros argentinos, directo en tu terminal.

`lapizarra` es el cliente de línea de comandos oficial de [La Pizarra](https://lapizarra.ar). Consulta las mismas fuentes públicas que la web (BCRA, INDEC, DolarAPI, argentinadatos.com, Rosario, BYMA Data, Yahoo Finance) y las formatea para verlas cómodo — o piperarlas a `jq`, scripts o dashboards de terminal.

```bash
$ node dist/index.js dolar
```

## Instalación y ejecución

El CLI aún no se distribuye desde npm. Para usarlo desde el repositorio:

```bash
cd cli
npm ci
npm run build
node dist/index.js dolar
```

Requiere **Node.js 20+** (usa `fetch` nativo).

## Comandos

| Comando | Qué hace |
|---|---|
| `lapizarra dolar` | Todas las cotizaciones (blue / MEP / CCL / oficial / mayorista / cripto / tarjeta) + variación día + brechas |
| `lapizarra dolar mep` | Detalle de una variedad (`blue`, `mep`, `ccl`, `oficial`, `mayorista`, `cripto`, `tarjeta`) |
| `lapizarra bcra` | Reservas brutas/netas, TAMAR / BADLAR, base monetaria |
| `lapizarra ipc` | Última inflación mensual + últimos 12 meses (gráfico ASCII) + acumulado 12m |
| `lapizarra bonos` | Screener de bonos soberanos hard dollar (TIR, duration, precio, var día) |
| `lapizarra bonos GD30` | Detalle de un ticker específico |
| `lapizarra riesgo` | Riesgo país AR (EMBI+) + var 1w / 1m + comparativo regional + TIR de globales |
| `lapizarra agro` | Pizarra Rosario: soja / maíz / trigo / girasol con FOB estimado |
| `lapizarra coyuntura` | Últimas noticias económicas del feed de La Pizarra (default: 5) |
| `lapizarra watch <recurso>` | Streaming — refresca cada 30s (`dolar`, `bonos`, `riesgo`) |
| `lapizarra --help` | Muestra la ayuda |
| `lapizarra --version` | Versión instalada |

Todos los comandos aceptan `--format=pretty|json|csv` (default `pretty`).

## Ejemplos

### Cotizaciones de dólar (pretty)

```
$ lapizarra dolar

La Pizarra · Cotizaciones del dólar (ARS)
┌───────────────────┬──────────┬──────────┬──────────┐
│ Variedad          │   Compra │    Venta │  Var día │
├───────────────────┼──────────┼──────────┼──────────┤
│ Blue              │ 1.470,00 │ 1.485,00 │  +0,7% ↑ │
│ MEP               │ 1.460,00 │ 1.472,00 │  +0,4% ↑ │
│ CCL               │ 1.498,00 │ 1.510,00 │  +1,2% ↑ │
│ Oficial           │ 1.230,00 │ 1.245,00 │    0,0%  │
│ Mayorista         │ 1.235,00 │ 1.238,00 │  +0,1%   │
└───────────────────┴──────────┴──────────┴──────────┘
Brecha blue/oficial: +19,28% · CCL/oficial: +21,29%
Actualizado hace 3 min · DolarAPI · lapizarra.ar
```

### Piperar a `jq` para automatizaciones

```bash
# El dólar CCL en JSON, filtrado con jq
lapizarra dolar ccl --format=json | jq '.venta'

# Todos los bonos a CSV para Excel
lapizarra bonos --format=csv > bonos_hoy.csv

# Riesgo país actual (bps) para un script bash
BPS=$(lapizarra riesgo --format=json | jq '.actual.riesgoPaisBps')
echo "Riesgo país: $BPS bps"
```

### Streaming (watch)

```bash
lapizarra watch dolar               # refresca cada 30s
lapizarra watch bonos --interval=60 # cada 60s
lapizarra watch riesgo              # útil en jornada de bolsa
```

## Uso en scripts

El formato `--format=json` está pensado para pipear a `jq`, `python -c`, etc. El `--format=csv` va derecho a un `.csv` o a `awk`. Todos los comandos devuelven **exit code ≠ 0** cuando la API no responde, así que integrarlo a un `cron` o `bash if` es directo:

```bash
if lapizarra bcra --format=json > /tmp/bcra.json; then
  echo "OK, reservas hoy:"
  jq '.reservas.brutas' /tmp/bcra.json
else
  echo "La Pizarra caída — mando alerta"
fi
```

## Configuración

Variables de entorno soportadas:

| Variable | Default | Para qué |
|---|---|---|
| `LAPIZARRA_API_URL` | `https://lapizarra.ar` | Cambiar el backend (útil para probar contra un dev local) |

Ejemplo — apuntar al backend de desarrollo local:

```bash
LAPIZARRA_API_URL=http://localhost:3001 lapizarra dolar
```

## Fuentes

Los datos vienen de las **mismas fuentes públicas** que consume la web de La Pizarra:

- **Dólar** — DolarAPI + Bluelytics (fallback)
- **BCRA** — API oficial v4.0 (reservas, tasas, base monetaria)
- **IPC** — INDEC vía datos.gob.ar + argentinadatos.com (fallback histórico)
- **Bonos soberanos** — motor propio con esquemas verificados contra prospecto (BYMA Data para precios en vivo)
- **Riesgo país** — argentinadatos.com (EMBI+ oficial) + spread contra US 10Y (Yahoo Finance)
- **Agro** — mercado.rava.com (indices de Rosario)
- **Coyuntura** — feed propio de La Pizarra + RSS de medios argentinos

El CLI hace GETs sin autenticación al backend de La Pizarra, no llama directo a las fuentes.

## Desarrollo

```bash
git clone https://github.com/manuelfsm03/EconData_argy
cd EconData_argy/cli
npm install
npm run dev -- dolar    # ejecuta con tsx sin compilar
npm run build           # compila a dist/
node dist/index.js --help
```

## Roadmap

Ideas para próximas versiones (issues y PRs bienvenidos):

- Autocompletado en `bash` y `zsh`
- Watchlist configurable (`~/.lapizarra/config.json` con bonos favoritos)
- Alertas por CLI (`lapizarra alert riesgo --above=1500`)
- Interfaz TUI opcional con `ink` (dashboards en terminal)
- Comando `lapizarra fx` — cotizaciones cruzadas y forwards
- Historial y sparklines por bono (`lapizarra bonos GD30 --hist=30d`)

## Licencia

MIT. La Pizarra es un proyecto abierto — usalo, pipearlo, integralo.

Web: [lapizarra.ar](https://lapizarra.ar) · Repo del backend: [manuelfsm03/EconData_argy](https://github.com/manuelfsm03/EconData_argy)
