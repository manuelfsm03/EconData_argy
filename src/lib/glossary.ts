// Categorías para agrupar los términos en la vista `/glosario`.
export type GlossaryCategoria =
  | "instrumento"
  | "cambiario"
  | "inflacion"
  | "tasas"
  | "actividad"
  | "sector-externo"
  | "fiscal"
  | "monetario"
  | "renta-fija"
  | "renta-variable"
  | "commodities"
  | "teoria"

export interface GlossaryEntry {
  // Definición corta en español rioplatense (obligatoria).
  text: string
  source: string
  url: string
  // Campos opcionales (nuevos, para la capa educativa).
  nombre?: string       // Nombre largo, ej: "Letra Capitalizable"
  sigla?: string        // Sigla oficial, ej: "LECAP"
  ejemplo?: string      // Ejemplo aplicado si suma claridad
  categoria?: GlossaryCategoria
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // ── Tipos de cambio ──────────────────────────────────────────────────────────
  BLUE: {
    nombre: "Dólar Blue",
    sigla: "Blue",
    categoria: "cambiario",
    text: "Tipo de cambio informal surgido de operaciones privadas fuera del sistema oficial. No está regulado por el BCRA. Refleja la escasez de dólares en el mercado legal.",
    ejemplo: "Si el oficial cotiza a $1.000 y el blue a $1.300, la brecha es 30%.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tipo-de-cambio-minorista/",
  },
  CCL: {
    nombre: "Contado con Liquidación",
    sigla: "CCL",
    categoria: "cambiario",
    text: "Contado con Liquidación. Tipo de cambio implícito que surge de comprar un activo (bono o acción) en pesos en Argentina y venderlo en dólares en el exterior. Es legal y no requiere cepo.",
    ejemplo: "Comprás GD30 en pesos en BYMA y lo vendés en dólares en Nueva York — el ratio te da el CCL.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tipo-de-cambio-minorista/",
  },
  MEP: {
    nombre: "Dólar MEP",
    sigla: "MEP",
    categoria: "cambiario",
    text: "Dólar Bolsa o MEP (Mercado Electrónico de Pagos). Surge de comprar un bono en pesos y venderlo en dólares dentro del mercado local. Operación bursátil 100% legal.",
    ejemplo: "AL30 en pesos → AL30D en dólares; el ratio de precios da el MEP.",
    source: "CNV",
    url: "https://www.argentina.gob.ar/cnv",
  },
  OFICIAL: {
    nombre: "Dólar Oficial minorista",
    categoria: "cambiario",
    text: "Tipo de cambio minorista regulado por el BCRA para transacciones corrientes de personas físicas. Es el precio base del sistema cambiario argentino.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tipo-de-cambio-minorista/",
  },
  MAYORISTA: {
    nombre: "Dólar mayorista",
    categoria: "cambiario",
    text: "Tipo de cambio para operaciones comerciales entre empresas, bancos y el BCRA. Es la referencia para liquidación de exportaciones e importaciones.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tipo-cambio-referencia-comunicacion-a-3500-tcnpm/",
  },
  SOLIDARIO: {
    nombre: "Dólar solidario / turista",
    categoria: "cambiario",
    text: "Tipo de cambio para consumos con tarjeta en el exterior y compra de dólares ahorro. Incluye el impuesto PAIS (actualmente en revisión) y percepciones de AFIP a cuenta de Ganancias.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tipo-de-cambio-minorista/",
  },
  CRIPTO: {
    nombre: "Dólar cripto",
    categoria: "cambiario",
    text: "Tipo de cambio implícito en operaciones con stablecoins (USDT, USDC) en exchanges locales. Funciona como referencia alternativa al dólar blue.",
    source: "CNV",
    url: "https://www.argentina.gob.ar/cnv",
  },
  A3500: {
    nombre: "Tipo de cambio de referencia A 3500",
    sigla: "A3500",
    categoria: "cambiario",
    text: "Comunicación A 3500 del BCRA. Tipo de cambio de referencia publicado diariamente por el banco central, utilizado para ciertos contratos y regulaciones.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tipo-cambio-referencia-comunicacion-a-3500-tcnpm/",
  },
  "BRECHA CAMBIARIA": {
    nombre: "Brecha cambiaria",
    categoria: "cambiario",
    text: "Diferencia porcentual entre un tipo de cambio alternativo (blue, CCL, MEP) y el tipo de cambio oficial. A mayor brecha, mayor distorsión en el mercado cambiario.",
    ejemplo: "Oficial $1.000 y CCL $1.400 → brecha del 40%.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tipo-de-cambio-minorista/",
  },
  MULC: {
    nombre: "Mercado Único y Libre de Cambios",
    sigla: "MULC",
    categoria: "cambiario",
    text: "Mercado formal donde exportadores liquidan sus divisas y donde el BCRA interviene. Está regulado por la normativa cambiaria: cepo, restricciones de acceso e incentivos temporales.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/SistemasFinancierosYdePagos/Regimen_cambiario_normativas.asp",
  },
  "BASE CAMBIARIA": {
    nombre: "Base cambiaria",
    categoria: "cambiario",
    text: "Compromiso del BCRA de mantener cierta cantidad de pesos constante o creciendo a un ritmo pautado, ancla nominal usada en algunos regímenes cambiarios recientes.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/PublicacionesEstadisticas/Principales_variables.asp",
  },
  "BANDA CAMBIARIA": {
    nombre: "Banda cambiaria",
    categoria: "cambiario",
    text: "Esquema donde el tipo de cambio fluctúa libremente dentro de un techo y un piso definidos por el BCRA. Si toca los bordes, el central interviene comprando o vendiendo divisas.",
    ejemplo: "Banda entre $900 (piso) y $1.400 (techo): adentro flota libre; si toca el techo, el BCRA vende dólares.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/PublicacionesEstadisticas/Principales_variables.asp",
  },
  "CRAWLING PEG": {
    nombre: "Crawling peg",
    categoria: "cambiario",
    text: "Régimen cambiario donde el BCRA devalúa el peso a un ritmo diario prefijado (por ejemplo, 2% mensual). Sirve como ancla nominal sin fijar del todo el tipo de cambio.",
    ejemplo: "Un crawl del 1% mensual mueve el oficial ~$10 al mes sobre un valor de $1.000.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/PublicacionesEstadisticas/Principales_variables.asp",
  },

  // ── Inflación ────────────────────────────────────────────────────────────────
  IPC: {
    nombre: "Índice de Precios al Consumidor",
    sigla: "IPC",
    categoria: "inflacion",
    text: "Índice de Precios al Consumidor. Mide la variación de precios de una canasta representativa de bienes y servicios consumidos por los hogares urbanos argentinos.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31",
  },
  "IPC MENSUAL": {
    nombre: "IPC mensual",
    categoria: "inflacion",
    text: "Variación del IPC respecto al mes anterior. Publicado mensualmente por el INDEC, es el principal indicador de inflación a corto plazo.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31",
  },
  "IPC INTERANUAL": {
    nombre: "IPC interanual",
    categoria: "inflacion",
    text: "Variación acumulada del IPC en los últimos 12 meses. Permite comparar la inflación anual sin depender de estacionalidad.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31",
  },
  "IPC YTD": {
    nombre: "IPC acumulado del año",
    categoria: "inflacion",
    text: "Inflación acumulada desde el 1° de enero del año en curso hasta el último dato disponible.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31",
  },
  "NÚCLEO": {
    nombre: "Inflación núcleo",
    categoria: "inflacion",
    text: "Inflación núcleo o core. Excluye precios estacionales y regulados para reflejar la tendencia inflacionaria subyacente de la economía.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31",
  },
  "REGULADOS": {
    nombre: "Precios regulados",
    categoria: "inflacion",
    text: "Precios de bienes y servicios con tarifas fijadas o influenciadas por el Estado (servicios públicos, combustibles, transporte).",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31",
  },
  "ESTACIONALES": {
    nombre: "Precios estacionales",
    categoria: "inflacion",
    text: "Precios que varían según la época del año (frutas, verduras, indumentaria). Se excluyen del índice núcleo para medir la inflación subyacente.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31",
  },
  CER: {
    nombre: "Coeficiente de Estabilización de Referencia",
    sigla: "CER",
    categoria: "inflacion",
    text: "Índice diario del BCRA que ajusta capital por inflación (IPC). Se usa para indexar instrumentos como bonos CER, plazos fijos UVA y créditos hipotecarios.",
    ejemplo: "Si el CER sube 5% en un mes, un bono CER capitaliza 5% más el cupón real.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/PublicacionesEstadisticas/Principales_variables_datos.asp",
  },
  UVA: {
    nombre: "Unidad de Valor Adquisitivo",
    sigla: "UVA",
    categoria: "inflacion",
    text: "Unidad de cuenta que se ajusta diariamente por CER (inflación IPC). Usada en plazos fijos UVA y créditos hipotecarios; protege el capital del ahorrista frente a la inflación.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/PublicacionesEstadisticas/Principales_variables_datos.asp",
  },
  REM: {
    nombre: "Relevamiento de Expectativas de Mercado",
    sigla: "REM",
    categoria: "inflacion",
    text: "Encuesta mensual del BCRA a consultoras y bancos con proyecciones de inflación, tipo de cambio, PBI y tasas. Es la mediana de expectativas de mercado.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/PublicacionesEstadisticas/Relevamiento_Expectativas_de_Mercado.asp",
  },

  // ── ROFEX / Futuros ──────────────────────────────────────────────────────────
  ROFEX: {
    nombre: "Matba-Rofex",
    categoria: "instrumento",
    text: "Rosario Futures Exchange (Matba-Rofex). Mercado donde se negocian contratos de futuros de dólar. Permite a empresas e inversores cubrirse ante variaciones del tipo de cambio.",
    source: "Matba-Rofex",
    url: "https://www.matbarofex.com.ar/producto/futuros-y-opciones-sobre-dolar",
  },
  TNA: {
    nombre: "Tasa Nominal Anual",
    sigla: "TNA",
    categoria: "tasas",
    text: "Tasa Nominal Anual. Expresa el rendimiento o costo de una operación financiera en términos anuales sin capitalización de intereses. Base para calcular tasas efectivas.",
    ejemplo: "TNA 100% con capitalización mensual → TEA ≈ 161%.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tasas-de-interes/",
  },
  TEA: {
    nombre: "Tasa Efectiva Anual",
    sigla: "TEA",
    categoria: "tasas",
    text: "Tasa Efectiva Anual. Incluye el efecto de la capitalización de intereses. Es la tasa real que se obtiene o se paga en un año considerando el reinvest de rendimientos.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tasas-de-interes/",
  },
  TEM: {
    nombre: "Tasa Efectiva Mensual",
    sigla: "TEM",
    categoria: "tasas",
    text: "Rendimiento efectivo en un mes con capitalización. Se compara directo con la inflación mensual: si TEM > IPC mensual, la tasa real es positiva.",
    ejemplo: "TEM 3,5% vs. IPC mensual 2% → tasa real positiva de ~1,5%.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tasas-de-interes/",
  },
  "DEV. IMP.": {
    nombre: "Devaluación implícita",
    categoria: "tasas",
    text: "Devaluación implícita. Variación porcentual que el mercado de futuros anticipa para el tipo de cambio desde hoy hasta el vencimiento del contrato.",
    source: "Matba-Rofex",
    url: "https://www.matbarofex.com.ar/producto/futuros-y-opciones-sobre-dolar",
  },
  "DEV. MENSUAL": {
    nombre: "Devaluación mensual implícita",
    categoria: "tasas",
    text: "Devaluación mensual implícita en el contrato de futuros. Útil para comparar con la inflación mensual esperada.",
    source: "Matba-Rofex",
    url: "https://www.matbarofex.com.ar/producto/futuros-y-opciones-sobre-dolar",
  },

  // ── Actividad ────────────────────────────────────────────────────────────────
  EMAE: {
    nombre: "Estimador Mensual de Actividad Económica",
    sigla: "EMAE",
    categoria: "actividad",
    text: "Estimador Mensual de Actividad Económica. Anticipa la evolución del PBI trimestral. Elaborado por el INDEC con datos de 15 sectores de actividad.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-9-48",
  },
  PBI: {
    nombre: "Producto Bruto Interno",
    sigla: "PBI",
    categoria: "actividad",
    text: "Producto Bruto Interno. Valor monetario total de los bienes y servicios finales producidos en Argentina en un período determinado.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-9-40",
  },
  IPI: {
    nombre: "Índice de Producción Industrial",
    sigla: "IPI",
    categoria: "actividad",
    text: "Índice de Producción Industrial. Mide la evolución mensual de la producción manufacturera argentina.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-9-46",
  },
  ISAC: {
    nombre: "Índice Sintético de Actividad de la Construcción",
    sigla: "ISAC",
    categoria: "actividad",
    text: "Índice Sintético de Actividad de la Construcción. Mide la evolución de la actividad constructora a través del consumo de insumos.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-9-47",
  },

  // ── Balanza / Sector externo ─────────────────────────────────────────────────
  "BALANZA COMERCIAL": {
    nombre: "Balanza comercial",
    categoria: "sector-externo",
    text: "Diferencia entre exportaciones e importaciones de bienes. Superávit cuando las exportaciones superan a las importaciones; déficit en el caso contrario.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-2-40",
  },
  "CUENTA CORRIENTE": {
    nombre: "Cuenta corriente",
    categoria: "sector-externo",
    text: "Componente de la balanza de pagos que registra exportaciones e importaciones de bienes y servicios, rentas de inversión y transferencias corrientes.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-2-40",
  },
  FOB: {
    nombre: "Free On Board",
    sigla: "FOB",
    categoria: "sector-externo",
    text: "Precio de la mercadería exportada puesta en el puerto de origen, sin flete internacional ni seguro. Es la base para calcular el valor exportado que reporta el INDEC.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-2-40",
  },
  CIF: {
    nombre: "Cost, Insurance & Freight",
    sigla: "CIF",
    categoria: "sector-externo",
    text: "Precio de la mercadería importada incluyendo costo, seguro y flete hasta el puerto de destino. Es la métrica de referencia para importaciones.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-2-40",
  },
  RETENCIONES: {
    nombre: "Derechos de exportación",
    categoria: "sector-externo",
    text: "Impuesto a la exportación de bienes primarios y manufacturas, especialmente del complejo agroindustrial (soja, maíz, trigo, girasol). Se cobra sobre el valor FOB.",
    ejemplo: "Soja al 33% de retenciones: por cada US$100 FOB exportados, US$33 van al fisco.",
    source: "Ministerio de Economía",
    url: "https://www.argentina.gob.ar/economia",
  },

  // ── Fiscal ───────────────────────────────────────────────────────────────────
  "RESULTADO PRIMARIO": {
    nombre: "Resultado primario",
    categoria: "fiscal",
    text: "Diferencia entre ingresos y gastos del sector público sin contar el pago de intereses de la deuda. Indicador clave de la sostenibilidad fiscal.",
    source: "Ministerio de Economía",
    url: "https://www.argentina.gob.ar/economia",
  },
  "RESULTADO FINANCIERO": {
    nombre: "Resultado financiero",
    categoria: "fiscal",
    text: "Diferencia entre ingresos y gastos del sector público incluyendo el pago de intereses de la deuda. Refleja el verdadero equilibrio o desequilibrio fiscal.",
    source: "Ministerio de Economía",
    url: "https://www.argentina.gob.ar/economia",
  },
  IMIG: {
    nombre: "Informe Mensual de Ingresos y Gastos del SPNF",
    sigla: "IMIG",
    categoria: "fiscal",
    text: "Reporte mensual de la Secretaría de Hacienda con ingresos y gastos del Sector Público Nacional No Financiero. Fuente oficial para armar el flujo fiscal completo (primario y financiero).",
    source: "Secretaría de Hacienda",
    url: "https://www.argentina.gob.ar/economia/hacienda",
  },
  COPARTICIPACIÓN: {
    nombre: "Coparticipación federal",
    categoria: "fiscal",
    text: "Régimen de reparto automático de impuestos nacionales entre Nación, provincias y CABA (Ley 23.548). Define qué porcentaje de la masa coparticipable recibe cada jurisdicción.",
    source: "Ministerio de Economía",
    url: "https://www.argentina.gob.ar/economia",
  },
  "DEUDA FLOTANTE": {
    nombre: "Deuda flotante",
    categoria: "fiscal",
    text: "Obligaciones del sector público devengadas pero aún no pagadas (por ejemplo, facturas a proveedores impagas al cierre del período). Distorsiona el resultado fiscal si crece.",
    source: "Ministerio de Economía",
    url: "https://www.argentina.gob.ar/economia",
  },
  "GASTO PRIMARIO": {
    nombre: "Gasto primario",
    categoria: "fiscal",
    text: "Total del gasto del sector público antes del pago de intereses de la deuda. Incluye salarios, jubilaciones, transferencias y gastos operativos.",
    source: "Ministerio de Economía",
    url: "https://www.argentina.gob.ar/economia",
  },
  RECAUDACIÓN: {
    nombre: "Recaudación tributaria",
    categoria: "fiscal",
    text: "Total de ingresos que recauda AFIP por impuestos nacionales (IVA, Ganancias, Débitos y Créditos, Seguridad Social, Comercio Exterior). Se publica todos los meses.",
    source: "AFIP",
    url: "https://www.afip.gob.ar/estudios/",
  },

  // ── Banco Central / Reservas ─────────────────────────────────────────────────
  "CAJAS DE AHORRO": {
    nombre: "Cajas de ahorro",
    categoria: "monetario",
    text: "Depósitos bancarios a la vista en caja de ahorro. No tienen plazo fijo ni rendimiento garantizado, pero permiten retiro inmediato. Son el principal instrumento de ahorro líquido de los hogares argentinos.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/balances-y-agregados-monetarios/",
  },
  "DEPOSITOS CC": {
    nombre: "Depósitos en cuenta corriente",
    categoria: "monetario",
    text: "Depósitos en cuenta corriente bancaria. Son depósitos a la vista utilizados principalmente por empresas para operaciones comerciales. No generan intereses y permiten el giro en descubierto.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/balances-y-agregados-monetarios/",
  },
  "COMPONENTES DEPOSITOS": {
    nombre: "Componentes de los depósitos privados",
    categoria: "monetario",
    text: "Desagregación del total de depósitos del sector privado en sus tres componentes principales: cuentas corrientes (transaccionales), cajas de ahorro (líquidas) y plazos fijos (a término). Refleja la preferencia por liquidez de la economía.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/depositos-y-otros-pasivos-de-las-entidades-financieras/",
  },
  "RATIO BADLAR": {
    nombre: "Ratio BADLAR / plazo fijo minorista",
    categoria: "tasas",
    text: "Cociente entre la tasa BADLAR y la tasa de depósitos a 30 días. Cuando el ratio supera 1, los grandes depositantes obtienen mayor rendimiento que los pequeños ahorristas, lo que indica segmentación del mercado de depósitos.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tasas-de-interes/",
  },
  TM20: {
    nombre: "Tasa TM20",
    sigla: "TM20",
    categoria: "tasas",
    text: "Tasa promedio de depósitos a plazo fijo de 30-35 días de más de $20 millones del sector privado no financiero. Referencia de corto plazo para grandes inversores institucionales.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tasas-de-interes/",
  },
  "CIRCULACION MONETARIA": {
    nombre: "Circulación monetaria",
    categoria: "monetario",
    text: "Billetes y monedas en manos del público, sin contar los encajes en poder de los bancos. Es la parte más líquida de la base monetaria y refleja la demanda de efectivo de la economía.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/datos-monetarios-diarios/",
  },
  M2: {
    nombre: "Agregado monetario M2",
    sigla: "M2",
    categoria: "monetario",
    text: "M2 Privado. Agregado monetario que incluye circulación monetaria, depósitos en cuenta corriente y cajas de ahorro del sector privado. Mide la liquidez amplia disponible en la economía.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/balances-y-agregados-monetarios/",
  },
  M3: {
    nombre: "Agregado monetario M3",
    sigla: "M3",
    categoria: "monetario",
    text: "Agregado más amplio: M2 más los plazos fijos del sector privado en pesos. Se usa como referencia del ahorro total en moneda local dentro del sistema financiero.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/balances-y-agregados-monetarios/",
  },
  "PRESTAMOS PRIVADO": {
    nombre: "Préstamos al sector privado",
    categoria: "monetario",
    text: "Financiaciones otorgadas por el sistema financiero al sector privado no financiero. Su evolución refleja la dinámica del crédito y el nivel de actividad económica.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/balances-y-agregados-monetarios/",
  },
  RESERVAS: {
    nombre: "Reservas internacionales brutas",
    categoria: "monetario",
    text: "Reservas internacionales brutas del BCRA. Incluyen oro, divisas, DEGs del FMI y otros activos externos. Son el principal respaldo del sistema monetario.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/reservas-internacionales-y-base-monetaria/",
  },
  "RESERVAS NETAS": {
    nombre: "Reservas netas",
    categoria: "monetario",
    text: "Reservas brutas descontando los pasivos de corto plazo: encajes de depósitos en dólares, swap con China y vencimientos de deuda próximos. Son las reservas disponibles reales.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/reservas-internacionales-y-base-monetaria/",
  },
  "BASE MONETARIA": {
    nombre: "Base monetaria",
    categoria: "monetario",
    text: "Total de billetes y monedas en circulación más los depósitos de los bancos en el BCRA. Es la cantidad de dinero de alta potencia que emite el banco central.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/datos-monetarios-diarios/",
  },
  LEBAC: {
    nombre: "Letras del BCRA",
    sigla: "LEBAC",
    categoria: "instrumento",
    text: "Instrumento histórico de política monetaria del BCRA para absorber pesos. Ya no se emiten; fueron reemplazadas por LELIQ y luego por pases y otras operaciones de esterilización.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/datos-monetarios-diarios/",
  },
  LELIQ: {
    nombre: "Letras de Liquidez",
    sigla: "LELIQ",
    categoria: "instrumento",
    text: "Letras de Liquidez del BCRA. Instrumento de política monetaria utilizado para absorber pesos del mercado y controlar la liquidez bancaria.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/datos-monetarios-diarios/",
  },
  "PASES PASIVOS": {
    nombre: "Pases pasivos",
    categoria: "monetario",
    text: "Operaciones de recompra a corto plazo (1 o 7 días) mediante las cuales el BCRA absorbe liquidez del sistema financiero.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/datos-monetarios-diarios/",
  },
  "TASA PLAZO FIJO": {
    nombre: "Tasa de plazo fijo minorista",
    categoria: "tasas",
    text: "Rendimiento anual nominal que pagan los bancos por depósitos a plazo fijo en pesos. El BCRA fija pisos mínimos para proteger el ahorro.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tasas-de-interes/",
  },
  BADLAR: {
    nombre: "Buenos Aires Deposits of Large Amount Rate",
    sigla: "BADLAR",
    categoria: "tasas",
    text: "Buenos Aires Deposits of Large Amount Rate. Tasa de interés promedio que pagan los bancos por depósitos a plazo fijo de más de $1 millón a 30-35 días.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tasas-de-interes/",
  },
  TAMAR: {
    nombre: "Tasa Mayorista Argentina",
    sigla: "TAMAR",
    categoria: "tasas",
    text: "Tasa de Interés Mayorista de Argentina. Referencia vigente para depósitos a plazo fijo mayoristas de bancos privados; reemplaza a BADLAR como referencia corriente.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tasas-de-interes/",
  },
  "TASA DE POLÍTICA MONETARIA": {
    nombre: "Tasa de política monetaria",
    sigla: "TPM",
    categoria: "tasas",
    text: "Tasa de referencia que fija el BCRA para guiar el costo del dinero en la economía. Incide directamente en los rendimientos de plazos fijos y préstamos.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tasas-de-interes/",
  },
  TPM: {
    nombre: "Tasa de política monetaria",
    sigla: "TPM",
    categoria: "tasas",
    text: "Alias de la tasa de política monetaria del BCRA. Es la tasa techo que rige los pases pasivos y ancla el resto de las tasas de la economía.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tasas-de-interes/",
  },

  // ── Renta Fija ───────────────────────────────────────────────────────────────
  "RIESGO PAÍS": {
    nombre: "Riesgo país (EMBI+)",
    categoria: "renta-fija",
    text: "Sobretasa que paga Argentina sobre los bonos del Tesoro de EEUU. Medido por el EMBI+ de JP Morgan. A mayor valor, mayor percepción de riesgo de impago.",
    ejemplo: "1.500 puntos = 15 puntos porcentuales por encima del yield del Treasury.",
    source: "Secretaría de Finanzas",
    url: "https://www.argentina.gob.ar/economia/finanzas",
  },
  PARIDAD: {
    nombre: "Paridad de un bono",
    categoria: "renta-fija",
    text: "Precio de un bono expresado como porcentaje de su valor nominal. Una paridad del 40% implica que el bono cotiza a 40 centavos por dólar de valor nominal.",
    source: "BYMA",
    url: "https://www.byma.com.ar/",
  },
  TIR: {
    nombre: "Tasa Interna de Retorno",
    sigla: "TIR",
    categoria: "renta-fija",
    text: "Tasa Interna de Retorno. Rendimiento anualizado si se compra el bono al precio actual y se mantiene hasta el vencimiento cobrando todos los cupones.",
    source: "BYMA",
    url: "https://www.byma.com.ar/",
  },
  ON: {
    nombre: "Obligación Negociable",
    sigla: "ON",
    categoria: "renta-fija",
    text: "Obligación Negociable. Bono corporativo emitido por empresas privadas para financiarse en el mercado de capitales.",
    ejemplo: "YPF, Pampa Energía o Telecom emiten ONs en dólares para captar deuda en Argentina.",
    source: "CNV",
    url: "https://www.argentina.gob.ar/cnv",
  },
  YTM: {
    nombre: "Yield to Maturity",
    sigla: "YTM",
    categoria: "renta-fija",
    text: "Yield to Maturity — Rendimiento al Vencimiento. Tasa de retorno anualizada si se compra el bono al precio actual y se mantiene hasta el vencimiento, reinvirtiendo todos los cupones. Equivalente a la TIR en inglés.",
    source: "BYMA",
    url: "https://www.byma.com.ar/",
  },
  EMBI: {
    nombre: "Emerging Markets Bond Index",
    sigla: "EMBI",
    categoria: "renta-fija",
    text: "Emerging Markets Bond Index. Índice de JP Morgan que mide el spread (sobretasa) que pagan los bonos soberanos de mercados emergentes sobre los Treasuries de EEUU. El EMBI+ Argentina es el indicador de riesgo país más utilizado.",
    source: "J.P. Morgan",
    url: "https://www.jpmorgan.com/insights/research/emerging-markets-research",
  },
  DURATION: {
    nombre: "Duration",
    categoria: "renta-fija",
    text: "Duración modificada. Mide la sensibilidad del precio de un bono ante cambios en la tasa de interés: por cada 1% que sube la tasa, el precio cae ~duration%. A mayor duration, mayor riesgo tasa.",
    ejemplo: "Un bono con duration 5 pierde ~5% de precio si la TIR sube 1 punto porcentual.",
    source: "BYMA",
    url: "https://www.byma.com.ar/",
  },
  LECAP: {
    nombre: "Letra de Capitalización del Tesoro",
    sigla: "LECAP",
    categoria: "instrumento",
    text: "Letra de Capitalización del Tesoro argentino. Instrumento de deuda a corto plazo emitido por la Secretaría de Finanzas que capitaliza intereses (no paga cupones). Compite directamente con el plazo fijo bancario.",
    ejemplo: "Comprás una LECAP a 90 días con TEM 3,5%: al vencimiento cobrás capital + intereses en un solo pago.",
    source: "Secretaría de Finanzas",
    url: "https://www.argentina.gob.ar/economia/finanzas",
  },
  BONCAP: {
    nombre: "Bono Capitalizable del Tesoro",
    sigla: "BONCAP",
    categoria: "instrumento",
    text: "Bono en pesos del Tesoro que capitaliza intereses (sin cupón) a plazos mayores que las LECAP. Formato similar pero más largo, típicamente 1-2 años.",
    source: "Secretaría de Finanzas",
    url: "https://www.argentina.gob.ar/economia/finanzas",
  },
  GD30: {
    nombre: "Bonar Global 2030",
    sigla: "GD30",
    categoria: "instrumento",
    text: "Bono soberano en dólares bajo ley Nueva York con vencimiento 2030. Es el título argentino más operado post-reestructuración 2020; benchmark para el MEP y el CCL.",
    source: "Secretaría de Finanzas",
    url: "https://www.argentina.gob.ar/economia/finanzas",
  },
  GD35: {
    nombre: "Bonar Global 2035",
    sigla: "GD35",
    categoria: "instrumento",
    text: "Bono soberano en dólares bajo ley Nueva York con vencimiento 2035. Junto con GD30 y GD38, integra el tramo largo de los Globales post-canje 2020.",
    source: "Secretaría de Finanzas",
    url: "https://www.argentina.gob.ar/economia/finanzas",
  },
  AL30: {
    nombre: "Bonar Ley Argentina 2030",
    sigla: "AL30",
    categoria: "instrumento",
    text: "Versión ley argentina del Bonar 2030. Mismo flujo que GD30 pero jurisdicción local, lo que suele traducirse en un precio algo menor y mayor volatilidad.",
    source: "Secretaría de Finanzas",
    url: "https://www.argentina.gob.ar/economia/finanzas",
  },
  AE38: {
    nombre: "Bonar Ley Argentina 2038",
    sigla: "AE38",
    categoria: "instrumento",
    text: "Bono soberano en dólares con ley argentina y vencimiento 2038. Cupón creciente (step-up) y amortización en cuotas semestrales desde 2027.",
    source: "Secretaría de Finanzas",
    url: "https://www.argentina.gob.ar/economia/finanzas",
  },
  "DOLLAR-LINKED": {
    nombre: "Bono dollar-linked",
    categoria: "instrumento",
    text: "Bono en pesos cuyo capital se ajusta por la variación del tipo de cambio oficial (comunicación A 3500). Sirve para cubrirse contra devaluación sin tener que operar el CCL/MEP.",
    ejemplo: "Si el oficial sube 20%, un dollar-linked ajusta su capital en 20% al vencimiento.",
    source: "Secretaría de Finanzas",
    url: "https://www.argentina.gob.ar/economia/finanzas",
  },
  DUAL: {
    nombre: "Bono dual",
    categoria: "instrumento",
    text: "Bono en pesos que al vencimiento paga lo mayor entre el ajuste por CER (inflación) y el ajuste por dollar-linked (devaluación). Cobertura híbrida contra los dos frentes.",
    source: "Secretaría de Finanzas",
    url: "https://www.argentina.gob.ar/economia/finanzas",
  },
  "BONO CER": {
    nombre: "Bono ajustado por CER",
    categoria: "instrumento",
    text: "Bono en pesos cuyo capital se indexa por CER (inflación IPC). El cupón se calcula sobre el capital ajustado; sirve para ganarle o empatarle a la inflación.",
    ejemplo: "TX26, TX28, DICP son bonos CER emblemáticos.",
    source: "Secretaría de Finanzas",
    url: "https://www.argentina.gob.ar/economia/finanzas",
  },
  FCI: {
    nombre: "Fondo Común de Inversión",
    sigla: "FCI",
    categoria: "instrumento",
    text: "Patrimonio colectivo administrado por una sociedad gerente que invierte en una cartera diversificada (dinero, bonos, acciones). El inversor compra cuotapartes; sirve para diversificar con montos chicos.",
    ejemplo: "Un FCI Money Market invierte en plazos fijos y cauciones y ofrece liquidez inmediata.",
    source: "CNV",
    url: "https://www.argentina.gob.ar/cnv",
  },
  CAUCIÓN: {
    nombre: "Caución bursátil",
    categoria: "instrumento",
    text: "Préstamo de dinero a plazos muy cortos (1 a 120 días) garantizado con títulos en la bolsa. Tasa muy usada como referencia de liquidez de corto plazo en pesos y dólares.",
    source: "BYMA",
    url: "https://www.byma.com.ar/",
  },

  // ── Renta Variable ───────────────────────────────────────────────────────────
  MERVAL: {
    nombre: "S&P Merval",
    categoria: "renta-variable",
    text: "Índice bursátil de referencia de la Bolsa de Buenos Aires. Mide el desempeño de las empresas de mayor capitalización y liquidez que cotizan en BYMA.",
    source: "BYMA",
    url: "https://www.byma.com.ar/",
  },
  CEDEAR: {
    nombre: "Certificado de Depósito Argentino",
    sigla: "CEDEAR",
    categoria: "renta-variable",
    text: "Certificado de Depósito Argentino. Representa acciones de empresas extranjeras que cotizan en Argentina en pesos. Permite invertir en Apple, Google, etc. desde Argentina.",
    ejemplo: "AAPL CEDEAR en BYMA cotiza en pesos y sigue el precio de Apple en NASDAQ, ajustado por CCL y ratio.",
    source: "CNV",
    url: "https://www.argentina.gob.ar/cnv",
  },
  ADR: {
    nombre: "American Depositary Receipt",
    sigla: "ADR",
    categoria: "renta-variable",
    text: "Certificado emitido en EEUU que representa acciones de una empresa extranjera. Las principales empresas argentinas (YPF, Galicia, Pampa, Tenaris, Mercado Libre) cotizan como ADR en Wall Street.",
    source: "SEC",
    url: "https://www.sec.gov/",
  },

  // ── Commodities / Mercados internacionales ───────────────────────────────────
  VIX: {
    nombre: "CBOE Volatility Index",
    sigla: "VIX",
    categoria: "commodities",
    text: "Índice de Volatilidad del CBOE (Chicago). Mide la volatilidad esperada del S&P 500 para los próximos 30 días. Valores altos indican mayor aversión al riesgo global.",
    source: "CBOE",
    url: "https://www.cboe.com/tradable_products/vix/",
  },
  DXY: {
    nombre: "Índice del Dólar",
    sigla: "DXY",
    categoria: "commodities",
    text: "Índice del Dólar Estadounidense. Mide el valor del dólar frente a una canasta de 6 divisas principales (euro, yen, libra, dólar canadiense, corona sueca, franco suizo).",
    source: "ICE Futures",
    url: "https://www.theice.com/products/194/ICE-US-Dollar-Index-Futures",
  },
  "US 10Y": {
    nombre: "Bono del Tesoro EEUU 10 años",
    categoria: "commodities",
    text: "Rendimiento del bono del Tesoro de EEUU a 10 años. Referencia global del costo del dinero libre de riesgo. Su suba encarece el financiamiento de países emergentes.",
    source: "U.S. Treasury",
    url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/",
  },
  WTI: {
    nombre: "West Texas Intermediate",
    sigla: "WTI",
    categoria: "commodities",
    text: "West Texas Intermediate. Precio del petróleo crudo de referencia en EEUU. Su variación impacta directamente en los ingresos de exportación de Vaca Muerta.",
    source: "CME Group",
    url: "https://www.cmegroup.com/markets/energy/crude-oil/light-sweet-crude.html",
  },
  BRENT: {
    nombre: "Brent Crude",
    categoria: "commodities",
    text: "Petróleo crudo de referencia global, extraído del Mar del Norte. Suele cotizar levemente por encima del WTI y es el benchmark internacional más utilizado.",
    source: "ICE Futures",
    url: "https://www.theice.com/products/219/Brent-Crude-Futures",
  },
  SOJA: {
    nombre: "Soja Chicago (CBOT)",
    categoria: "commodities",
    text: "Principal commodity de exportación argentina. Su precio impacta directamente en la liquidación de divisas del sector agropecuario y en las reservas del BCRA.",
    source: "Matba-Rofex",
    url: "https://www.matbarofex.com.ar/producto/soja",
  },
  ORO: {
    nombre: "Oro",
    categoria: "commodities",
    text: "Metal precioso que funciona como activo refugio en momentos de incertidumbre global. Su precio suele subir cuando aumenta la aversión al riesgo.",
    source: "CME Group",
    url: "https://www.cmegroup.com/markets/metals/precious/gold.html",
  },
  MAÍZ: {
    nombre: "Maíz Chicago (CBOT)",
    categoria: "commodities",
    text: "Segundo commodity agrícola en importancia para Argentina, tanto para consumo interno como para exportación (granos, harina, forraje). Su precio se rige en Chicago.",
    source: "Matba-Rofex",
    url: "https://www.matbarofex.com.ar/",
  },
  TRIGO: {
    nombre: "Trigo Chicago / Kansas",
    categoria: "commodities",
    text: "Cereal clave del complejo agroindustrial argentino. Su precio internacional se referencia contra los contratos de Chicago y Kansas; sensible al clima y a decisiones geopolíticas.",
    source: "Matba-Rofex",
    url: "https://www.matbarofex.com.ar/",
  },

  // ── Teoría económica ────────────────────────────────────────────────────────
  SEÑOREAJE: {
    nombre: "Señoreaje",
    categoria: "teoria",
    text: "Ingreso real que obtiene el Estado al emitir dinero. Se calcula como π × (M/P): la tasa de inflación multiplicada por los saldos monetarios reales. Es esencialmente un impuesto implícito sobre quienes mantienen pesos.",
    source: "Banco Mundial / BCRA",
    url: "https://www.bcra.gob.ar/PublicacionesEstadisticas/Principales_variables.asp",
  },
  "MODELO CAGAN": {
    nombre: "Modelo Cagan",
    categoria: "teoria",
    text: "Modelo de demanda de dinero propuesto por Philip Cagan (1956) para estudiar hiperinflaciones. Postula que la demanda real de dinero cae exponencialmente con la inflación esperada: M/P = k · e^(−α·π), donde α es la semi-elasticidad.",
    source: "Cagan, P. (1956). The Monetary Dynamics of Hyperinflation.",
    url: "https://www.nber.org/books-and-chapters/studies-quantity-theory-money",
  },
  "CURVA DE LAFFER MONETARIA": {
    nombre: "Curva de Laffer monetaria",
    categoria: "teoria",
    text: "Relación entre inflación y señoreaje: a inflaciones bajas, más emisión genera más ingresos reales; pero al superar π* (la tasa óptima), la destrucción de saldos reales supera la ganancia por emisión y el señoreaje cae. Tiene forma de campana.",
    source: "Modelo Cagan (1956)",
    url: "https://www.nber.org/books-and-chapters/studies-quantity-theory-money",
  },
  "PI STAR": {
    nombre: "π* (tasa óptima de señoreaje)",
    categoria: "teoria",
    text: "Tasa de inflación que maximiza el señoreaje según el modelo Cagan. Se calcula como π* = 1/α, donde α es la semi-elasticidad estimada. Inflaciones superiores a π* destruyen los saldos reales más rápido de lo que la emisión genera ingresos.",
    source: "Modelo Cagan (1956)",
    url: "https://www.nber.org/books-and-chapters/studies-quantity-theory-money",
  },
  "SALDOS REALES": {
    nombre: "Saldos monetarios reales",
    categoria: "teoria",
    text: "Valor real de la base monetaria: M/P, es decir, los pesos en circulación deflactados por el nivel de precios. Mide el poder adquisitivo del dinero emitido. Su caída persistente indica que la inflación erosiona la demanda de moneda local.",
    source: "BCRA / INDEC",
    url: "https://www.bcra.gob.ar/PublicacionesEstadisticas/Principales_variables.asp",
  },
  "ALPHA CAGAN": {
    nombre: "α (semi-elasticidad Cagan)",
    categoria: "teoria",
    text: "Semi-elasticidad de la demanda de dinero respecto a la inflación (α) en el modelo Cagan. Indica cuánto cae el logaritmo de los saldos reales por cada punto porcentual adicional de inflación. Se estima por MCO sobre datos anuales históricos.",
    source: "Modelo Cagan (1956)",
    url: "https://www.nber.org/books-and-chapters/studies-quantity-theory-money",
  },
}

// ── Utilidades y metadatos ────────────────────────────────────────────────────

// Diccionario de etiquetas para las categorías (para vistas y tooltips).
export const CATEGORIA_LABEL: Record<GlossaryCategoria, string> = {
  instrumento: "Instrumentos",
  cambiario: "Cambiario",
  inflacion: "Inflación",
  tasas: "Tasas",
  actividad: "Actividad",
  "sector-externo": "Sector externo",
  fiscal: "Fiscal",
  monetario: "Monetario",
  "renta-fija": "Renta fija",
  "renta-variable": "Renta variable",
  commodities: "Commodities",
  teoria: "Teoría",
}

// Devuelve un slug estable a partir del ID del término (para anchors en /glosario).
export function slugTermino(termId: string): string {
  return termId
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

// Lookup case-insensitive por ID exacto o por sigla. Devuelve null si no está.
export function buscarTermino(idOTermino: string): { id: string; entry: GlossaryEntry } | null {
  if (!idOTermino) return null
  const clave = idOTermino.trim().toUpperCase()
  if (GLOSSARY[clave]) return { id: clave, entry: GLOSSARY[clave] }
  // Búsqueda alternativa: por sigla exacta.
  const encontrado = Object.entries(GLOSSARY).find(([, e]) => e.sigla?.toUpperCase() === clave)
  if (encontrado) return { id: encontrado[0], entry: encontrado[1] }
  return null
}
