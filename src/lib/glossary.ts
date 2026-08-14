export interface GlossaryEntry {
  text: string
  source: string
  url: string
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // ── Tipos de cambio ──────────────────────────────────────────────────────────
  BLUE: {
    text: "Tipo de cambio informal surgido de operaciones privadas fuera del sistema oficial. No está regulado por el BCRA. Refleja la escasez de dólares en el mercado legal.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tipo-de-cambio-minorista/",
  },
  CCL: {
    text: "Contado con Liquidación. Tipo de cambio implícito que surge de comprar un activo (bono o acción) en pesos en Argentina y venderlo en dólares en el exterior. Es legal y no requiere cepo.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tipo-de-cambio-minorista/",
  },
  MEP: {
    text: "Dólar Bolsa o MEP (Mercado Electrónico de Pagos). Surge de comprar un bono en pesos y venderlo en dólares dentro del mercado local. Operación bursátil 100% legal.",
    source: "CNV",
    url: "https://www.argentina.gob.ar/cnv",
  },
  OFICIAL: {
    text: "Tipo de cambio minorista regulado por el BCRA para transacciones corrientes de personas físicas. Es el precio base del sistema cambiario argentino.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tipo-de-cambio-minorista/",
  },
  MAYORISTA: {
    text: "Tipo de cambio para operaciones comerciales entre empresas, bancos y el BCRA. Es la referencia para liquidación de exportaciones e importaciones.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tipo-cambio-referencia-comunicacion-a-3500-tcnpm/",
  },
  SOLIDARIO: {
    text: "Tipo de cambio para consumos con tarjeta en el exterior y compra de dólares ahorro. Incluye el impuesto PAIS (actualmente en revisión) y percepciones de AFIP a cuenta de Ganancias.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tipo-de-cambio-minorista/",
  },
  CRIPTO: {
    text: "Tipo de cambio implícito en operaciones con stablecoins (USDT, USDC) en exchanges locales. Funciona como referencia alternativa al dólar blue.",
    source: "CNV",
    url: "https://www.argentina.gob.ar/cnv",
  },
  A3500: {
    text: "Comunicación A 3500 del BCRA. Tipo de cambio de referencia publicado diariamente por el banco central, utilizado para ciertos contratos y regulaciones.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tipo-cambio-referencia-comunicacion-a-3500-tcnpm/",
  },
  "BRECHA CAMBIARIA": {
    text: "Diferencia porcentual entre un tipo de cambio alternativo (blue, CCL, MEP) y el tipo de cambio oficial. A mayor brecha, mayor distorsión en el mercado cambiario.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tipo-de-cambio-minorista/",
  },

  // ── Inflación ────────────────────────────────────────────────────────────────
  IPC: {
    text: "Índice de Precios al Consumidor. Mide la variación de precios de una canasta representativa de bienes y servicios consumidos por los hogares urbanos argentinos.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31",
  },
  "IPC MENSUAL": {
    text: "Variación del IPC respecto al mes anterior. Publicado mensualmente por el INDEC, es el principal indicador de inflación a corto plazo.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31",
  },
  "IPC INTERANUAL": {
    text: "Variación acumulada del IPC en los últimos 12 meses. Permite comparar la inflación anual sin depender de estacionalidad.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31",
  },
  "IPC YTD": {
    text: "Inflación acumulada desde el 1° de enero del año en curso hasta el último dato disponible.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31",
  },
  "NÚCLEO": {
    text: "Inflación núcleo o core. Excluye precios estacionales y regulados para reflejar la tendencia inflacionaria subyacente de la economía.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31",
  },
  "REGULADOS": {
    text: "Precios de bienes y servicios con tarifas fijadas o influenciadas por el Estado (servicios públicos, combustibles, transporte).",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31",
  },
  "ESTACIONALES": {
    text: "Precios que varían según la época del año (frutas, verduras, indumentaria). Se excluyen del índice núcleo para medir la inflación subyacente.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31",
  },

  // ── ROFEX / Futuros ──────────────────────────────────────────────────────────
  ROFEX: {
    text: "Rosario Futures Exchange (Matba-Rofex). Mercado donde se negocian contratos de futuros de dólar. Permite a empresas e inversores cubrirse ante variaciones del tipo de cambio.",
    source: "Matba-Rofex",
    url: "https://www.matbarofex.com.ar/producto/futuros-y-opciones-sobre-dolar",
  },
  TNA: {
    text: "Tasa Nominal Anual. Expresa el rendimiento o costo de una operación financiera en términos anuales sin capitalización de intereses. Base para calcular tasas efectivas.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tasas-de-interes/",
  },
  TEA: {
    text: "Tasa Efectiva Anual. Incluye el efecto de la capitalización de intereses. Es la tasa real que se obtiene o se paga en un año considerando el reinvest de rendimientos.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tasas-de-interes/",
  },
  "DEV. IMP.": {
    text: "Devaluación implícita. Variación porcentual que el mercado de futuros anticipa para el tipo de cambio desde hoy hasta el vencimiento del contrato.",
    source: "Matba-Rofex",
    url: "https://www.matbarofex.com.ar/producto/futuros-y-opciones-sobre-dolar",
  },
  "DEV. MENSUAL": {
    text: "Devaluación mensual implícita en el contrato de futuros. Útil para comparar con la inflación mensual esperada.",
    source: "Matba-Rofex",
    url: "https://www.matbarofex.com.ar/producto/futuros-y-opciones-sobre-dolar",
  },

  // ── Actividad ────────────────────────────────────────────────────────────────
  EMAE: {
    text: "Estimador Mensual de Actividad Económica. Anticipa la evolución del PBI trimestral. Elaborado por el INDEC con datos de 15 sectores de actividad.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-9-48",
  },
  PBI: {
    text: "Producto Bruto Interno. Valor monetario total de los bienes y servicios finales producidos en Argentina en un período determinado.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-9-40",
  },
  IPI: {
    text: "Índice de Producción Industrial. Mide la evolución mensual de la producción manufacturera argentina.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-9-46",
  },
  ISAC: {
    text: "Índice Sintético de Actividad de la Construcción. Mide la evolución de la actividad constructora a través del consumo de insumos.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-9-47",
  },

  // ── Balanza / Sector externo ─────────────────────────────────────────────────
  "BALANZA COMERCIAL": {
    text: "Diferencia entre exportaciones e importaciones de bienes. Superávit cuando las exportaciones superan a las importaciones; déficit en el caso contrario.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-2-40",
  },
  "CUENTA CORRIENTE": {
    text: "Componente de la balanza de pagos que registra exportaciones e importaciones de bienes y servicios, rentas de inversión y transferencias corrientes.",
    source: "INDEC",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-2-40",
  },

  // ── Fiscal ───────────────────────────────────────────────────────────────────
  "RESULTADO PRIMARIO": {
    text: "Diferencia entre ingresos y gastos del sector público sin contar el pago de intereses de la deuda. Indicador clave de la sostenibilidad fiscal.",
    source: "Ministerio de Economía",
    url: "https://www.argentina.gob.ar/economia",
  },
  "RESULTADO FINANCIERO": {
    text: "Diferencia entre ingresos y gastos del sector público incluyendo el pago de intereses de la deuda. Refleja el verdadero equilibrio o desequilibrio fiscal.",
    source: "Ministerio de Economía",
    url: "https://www.argentina.gob.ar/economia",
  },

  // ── Banco Central / Reservas ─────────────────────────────────────────────────
  "CAJAS DE AHORRO": {
    text: "Depósitos bancarios a la vista en caja de ahorro. No tienen plazo fijo ni rendimiento garantizado, pero permiten retiro inmediato. Son el principal instrumento de ahorro líquido de los hogares argentinos.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/balances-y-agregados-monetarios/",
  },
  "DEPOSITOS CC": {
    text: "Depósitos en cuenta corriente bancaria. Son depósitos a la vista utilizados principalmente por empresas para operaciones comerciales. No generan intereses y permiten el giro en descubierto.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/balances-y-agregados-monetarios/",
  },
  "COMPONENTES DEPOSITOS": {
    text: "Desagregación del total de depósitos del sector privado en sus tres componentes principales: cuentas corrientes (transaccionales), cajas de ahorro (líquidas) y plazos fijos (a término). Refleja la preferencia por liquidez de la economía.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/depositos-y-otros-pasivos-de-las-entidades-financieras/",
  },
  "RATIO BADLAR": {
    text: "Cociente entre la tasa BADLAR y la tasa de depósitos a 30 días. Cuando el ratio supera 1, los grandes depositantes obtienen mayor rendimiento que los pequeños ahorristas, lo que indica segmentación del mercado de depósitos.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tasas-de-interes/",
  },
  TM20: {
    text: "Tasa promedio de depósitos a plazo fijo de 30-35 días de más de $20 millones del sector privado no financiero. Referencia de corto plazo para grandes inversores institucionales.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tasas-de-interes/",
  },
  "CIRCULACION MONETARIA": {
    text: "Billetes y monedas en manos del público, sin contar los encajes en poder de los bancos. Es la parte más líquida de la base monetaria y refleja la demanda de efectivo de la economía.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/datos-monetarios-diarios/",
  },
  M2: {
    text: "M2 Privado. Agregado monetario que incluye circulación monetaria, depósitos en cuenta corriente y cajas de ahorro del sector privado. Mide la liquidez amplia disponible en la economía.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/balances-y-agregados-monetarios/",
  },
  "PRESTAMOS PRIVADO": {
    text: "Financiaciones otorgadas por el sistema financiero al sector privado no financiero. Su evolución refleja la dinámica del crédito y el nivel de actividad económica.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/balances-y-agregados-monetarios/",
  },
  RESERVAS: {
    text: "Reservas internacionales brutas del BCRA. Incluyen oro, divisas, DEGs del FMI y otros activos externos. Son el principal respaldo del sistema monetario.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/reservas-internacionales-y-base-monetaria/",
  },
  "RESERVAS NETAS": {
    text: "Reservas brutas descontando los pasivos de corto plazo: encajes de depósitos en dólares, swap con China y vencimientos de deuda próximos. Son las reservas disponibles reales.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/reservas-internacionales-y-base-monetaria/",
  },
  "BASE MONETARIA": {
    text: "Total de billetes y monedas en circulación más los depósitos de los bancos en el BCRA. Es la cantidad de dinero de alta potencia que emite el banco central.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/datos-monetarios-diarios/",
  },
  LELIQ: {
    text: "Letras de Liquidez del BCRA. Instrumento de política monetaria utilizado para absorber pesos del mercado y controlar la liquidez bancaria.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/datos-monetarios-diarios/",
  },
  "PASES PASIVOS": {
    text: "Operaciones de recompra a corto plazo (1 o 7 días) mediante las cuales el BCRA absorbe liquidez del sistema financiero.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/datos-monetarios-diarios/",
  },
  "TASA PLAZO FIJO": {
    text: "Rendimiento anual nominal que pagan los bancos por depósitos a plazo fijo en pesos. El BCRA fija pisos mínimos para proteger el ahorro.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tasas-de-interes/",
  },
  BADLAR: {
    text: "Buenos Aires Deposits of Large Amount Rate. Tasa de interés promedio que pagan los bancos por depósitos a plazo fijo de más de $1 millón a 30-35 días.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tasas-de-interes/",
  },
  TAMAR: {
    text: "Tasa de Interés Mayorista de Argentina. Referencia vigente para depósitos a plazo fijo mayoristas de bancos privados; reemplaza a BADLAR como referencia corriente.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tasas-de-interes/",
  },
  "TASA DE POLÍTICA MONETARIA": {
    text: "Tasa de referencia que fija el BCRA para guiar el costo del dinero en la economía. Incide directamente en los rendimientos de plazos fijos y préstamos.",
    source: "BCRA",
    url: "https://www.bcra.gob.ar/estadisticas-indicadores/tasas-de-interes/",
  },

  // ── Renta Fija ───────────────────────────────────────────────────────────────
  "RIESGO PAÍS": {
    text: "Sobretasa que paga Argentina sobre los bonos del Tesoro de EEUU. Medido por el EMBI+ de JP Morgan. A mayor valor, mayor percepción de riesgo de impago.",
    source: "Secretaría de Finanzas",
    url: "https://www.argentina.gob.ar/economia/finanzas",
  },
  PARIDAD: {
    text: "Precio de un bono expresado como porcentaje de su valor nominal. Una paridad del 40% implica que el bono cotiza a 40 centavos por dólar de valor nominal.",
    source: "BYMA",
    url: "https://www.byma.com.ar/",
  },
  TIR: {
    text: "Tasa Interna de Retorno. Rendimiento anualizado si se compra el bono al precio actual y se mantiene hasta el vencimiento cobrando todos los cupones.",
    source: "BYMA",
    url: "https://www.byma.com.ar/",
  },
  ON: {
    text: "Obligación Negociable. Bono corporativo emitido por empresas privadas para financiarse en el mercado de capitales.",
    source: "CNV",
    url: "https://www.argentina.gob.ar/cnv",
  },

  YTM: {
    text: "Yield to Maturity — Rendimiento al Vencimiento. Tasa de retorno anualizada si se compra el bono al precio actual y se mantiene hasta el vencimiento, reinvirtiendo todos los cupones. Equivalente a la TIR en inglés.",
    source: "BYMA",
    url: "https://www.byma.com.ar/",
  },
  EMBI: {
    text: "Emerging Markets Bond Index. Índice de JP Morgan que mide el spread (sobretasa) que pagan los bonos soberanos de mercados emergentes sobre los Treasuries de EEUU. El EMBI+ Argentina es el indicador de riesgo país más utilizado.",
    source: "J.P. Morgan",
    url: "https://www.jpmorgan.com/insights/research/emerging-markets-research",
  },
  LECAP: {
    text: "Letra de Capitalización del Tesoro argentino. Instrumento de deuda a corto plazo emitido por la Secretaría de Finanzas que capitaliza intereses (no paga cupones). Compite directamente con el plazo fijo bancario.",
    source: "Secretaría de Finanzas",
    url: "https://www.argentina.gob.ar/economia/finanzas",
  },

  // ── Renta Variable ───────────────────────────────────────────────────────────
  MERVAL: {
    text: "Índice bursátil de referencia de la Bolsa de Buenos Aires. Mide el desempeño de las empresas de mayor capitalización y liquidez que cotizan en BYMA.",
    source: "BYMA",
    url: "https://www.byma.com.ar/",
  },
  CEDEAR: {
    text: "Certificado de Depósito Argentino. Representa acciones de empresas extranjeras que cotizan en Argentina en pesos. Permite invertir en Apple, Google, etc. desde Argentina.",
    source: "CNV",
    url: "https://www.argentina.gob.ar/cnv",
  },

  // ── Commodities / Mercados internacionales ───────────────────────────────────
  VIX: {
    text: "Índice de Volatilidad del CBOE (Chicago). Mide la volatilidad esperada del S&P 500 para los próximos 30 días. Valores altos indican mayor aversión al riesgo global.",
    source: "CBOE",
    url: "https://www.cboe.com/tradable_products/vix/",
  },
  DXY: {
    text: "Índice del Dólar Estadounidense. Mide el valor del dólar frente a una canasta de 6 divisas principales (euro, yen, libra, dólar canadiense, corona sueca, franco suizo).",
    source: "ICE Futures",
    url: "https://www.theice.com/products/194/ICE-US-Dollar-Index-Futures",
  },
  "US 10Y": {
    text: "Rendimiento del bono del Tesoro de EEUU a 10 años. Referencia global del costo del dinero libre de riesgo. Su suba encarece el financiamiento de países emergentes.",
    source: "U.S. Treasury",
    url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/",
  },
  WTI: {
    text: "West Texas Intermediate. Precio del petróleo crudo de referencia en EEUU. Su variación impacta directamente en los ingresos de exportación de Vaca Muerta.",
    source: "CME Group",
    url: "https://www.cmegroup.com/markets/energy/crude-oil/light-sweet-crude.html",
  },
  BRENT: {
    text: "Petróleo crudo de referencia global, extraído del Mar del Norte. Suele cotizar levemente por encima del WTI y es el benchmark internacional más utilizado.",
    source: "ICE Futures",
    url: "https://www.theice.com/products/219/Brent-Crude-Futures",
  },
  SOJA: {
    text: "Principal commodity de exportación argentina. Su precio impacta directamente en la liquidación de divisas del sector agropecuario y en las reservas del BCRA.",
    source: "Matba-Rofex",
    url: "https://www.matbarofex.com.ar/producto/soja",
  },
  ORO: {
    text: "Metal precioso que funciona como activo refugio en momentos de incertidumbre global. Su precio suele subir cuando aumenta la aversión al riesgo.",
    source: "CME Group",
    url: "https://www.cmegroup.com/markets/metals/precious/gold.html",
  },
  SEÑOREAJE: {
    text: "Ingreso real que obtiene el Estado al emitir dinero. Se calcula como π × (M/P): la tasa de inflación multiplicada por los saldos monetarios reales. Es esencialmente un impuesto implícito sobre quienes mantienen pesos.",
    source: "Banco Mundial / BCRA",
    url: "https://www.bcra.gob.ar/PublicacionesEstadisticas/Principales_variables.asp",
  },
  "MODELO CAGAN": {
    text: "Modelo de demanda de dinero propuesto por Philip Cagan (1956) para estudiar hiperinflaciones. Postula que la demanda real de dinero cae exponencialmente con la inflación esperada: M/P = k · e^(−α·π), donde α es la semi-elasticidad.",
    source: "Cagan, P. (1956). The Monetary Dynamics of Hyperinflation.",
    url: "https://www.nber.org/books-and-chapters/studies-quantity-theory-money",
  },
  "CURVA DE LAFFER MONETARIA": {
    text: "Relación entre inflación y señoreaje: a inflaciones bajas, más emisión genera más ingresos reales; pero al superar π* (la tasa óptima), la destrucción de saldos reales supera la ganancia por emisión y el señoreaje cae. Tiene forma de campana.",
    source: "Modelo Cagan (1956)",
    url: "https://www.nber.org/books-and-chapters/studies-quantity-theory-money",
  },
  "PI STAR": {
    text: "Tasa de inflación que maximiza el señoreaje según el modelo Cagan. Se calcula como π* = 1/α, donde α es la semi-elasticidad estimada. Inflaciones superiores a π* destruyen los saldos reales más rápido de lo que la emisión genera ingresos.",
    source: "Modelo Cagan (1956)",
    url: "https://www.nber.org/books-and-chapters/studies-quantity-theory-money",
  },
  "SALDOS REALES": {
    text: "Valor real de la base monetaria: M/P, es decir, los pesos en circulación deflactados por el nivel de precios. Mide el poder adquisitivo del dinero emitido. Su caída persistente indica que la inflación erosiona la demanda de moneda local.",
    source: "BCRA / INDEC",
    url: "https://www.bcra.gob.ar/PublicacionesEstadisticas/Principales_variables.asp",
  },
  "ALPHA CAGAN": {
    text: "Semi-elasticidad de la demanda de dinero respecto a la inflación (α) en el modelo Cagan. Indica cuánto cae el logaritmo de los saldos reales por cada punto porcentual adicional de inflación. Se estima por MCO sobre datos anuales históricos.",
    source: "Modelo Cagan (1956)",
    url: "https://www.nber.org/books-and-chapters/studies-quantity-theory-money",
  },
}
