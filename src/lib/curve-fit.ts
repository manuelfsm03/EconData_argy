/**
 * Ajuste de curva por mínimos cuadrados, para la curva de rendimientos.
 *
 * La nube de puntos TIR vs duration dice dónde cotiza cada bono, pero no dice
 * cuál está caro y cuál barato. Para eso hace falta una referencia: la curva
 * que mejor describe al conjunto. Un bono POR ENCIMA de esa curva rinde más de
 * lo que le correspondería por su plazo (está barato); uno por debajo, al revés.
 *
 * Se ajusta un polinomio de grado bajo por mínimos cuadrados. Grado 2 por
 * defecto y no más: la curva soberana argentina tiene menos de diez puntos, y
 * con un polinomio de grado alto se pasaría exactamente por todos, que es la
 * forma más elegante de no decir nada — si la curva toca todos los puntos,
 * ningún bono está desarbitrado por definición.
 *
 * Regla 6 del ROADMAP: cada cálculo con su fórmula.
 */

export interface Punto {
  x: number
  y: number
}

export interface AjustePolinomico {
  /** Coeficientes en orden ascendente: coef[0] + coef[1]·x + coef[2]·x² … */
  coeficientes: number[]
  grado: number
  /** Cuánta de la dispersión explica la curva, entre 0 y 1. */
  r2: number
  /** Evalúa la curva ajustada en un x cualquiera. */
  evaluar: (x: number) => number
}

/**
 * Resuelve A·coef = b por eliminación gaussiana con pivoteo parcial.
 *
 * El pivoteo no es opcional acá: la matriz de un ajuste polinómico es de
 * Vandermonde, notoriamente mal condicionada, y sin elegir el pivote más
 * grande de cada columna los errores de redondeo se amplifican hasta dar
 * coeficientes sin sentido.
 *
 * Devuelve null si el sistema es singular, que es lo que pasa cuando hay menos
 * puntos distintos que coeficientes a estimar.
 */
function resolverSistema(A: number[][], b: number[]): number[] | null {
  const n = b.length
  // Matriz aumentada, para no pisar la entrada.
  const M = A.map((fila, i) => [...fila, b[i]])

  for (let col = 0; col < n; col++) {
    let mejor = col
    for (let fila = col + 1; fila < n; fila++) {
      if (Math.abs(M[fila][col]) > Math.abs(M[mejor][col])) mejor = fila
    }
    if (Math.abs(M[mejor][col]) < 1e-12) return null
    ;[M[col], M[mejor]] = [M[mejor], M[col]]

    for (let fila = col + 1; fila < n; fila++) {
      const factor = M[fila][col] / M[col][col]
      for (let k = col; k <= n; k++) M[fila][k] -= factor * M[col][k]
    }
  }

  // Sustitución hacia atrás.
  const solucion = new Array<number>(n).fill(0)
  for (let fila = n - 1; fila >= 0; fila--) {
    let suma = M[fila][n]
    for (let k = fila + 1; k < n; k++) suma -= M[fila][k] * solucion[k]
    solucion[fila] = suma / M[fila][fila]
  }

  return solucion.every((v) => Number.isFinite(v)) ? solucion : null
}

/**
 * Ajusta un polinomio de grado `grado` que minimiza la suma de los cuadrados
 * de los residuos.
 *
 * Se arma el sistema de ecuaciones normales (Aᵀ·A)·coef = Aᵀ·y, donde A es la
 * matriz de Vandermonde con las potencias de x.
 *
 * Devuelve null si no hay datos suficientes: hacen falta al menos `grado + 1`
 * puntos con x DISTINTO. Dos bonos con la misma duration aportan un solo punto
 * a los efectos del ajuste, y esa es la razón de contar los x únicos y no las
 * filas.
 */
export function ajustarPolinomio(puntos: Punto[], grado = 2): AjustePolinomico | null {
  const limpios = puntos.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
  const xsUnicos = new Set(limpios.map((p) => p.x))
  if (grado < 1 || xsUnicos.size < grado + 1) return null

  const n = grado + 1
  // Potencias de x hasta 2·grado: son las que aparecen en Aᵀ·A.
  const sumasX = new Array<number>(2 * grado + 1).fill(0)
  const sumasXY = new Array<number>(n).fill(0)

  for (const { x, y } of limpios) {
    let potencia = 1
    for (let k = 0; k <= 2 * grado; k++) {
      sumasX[k] += potencia
      if (k < n) sumasXY[k] += potencia * y
      potencia *= x
    }
  }

  const A: number[][] = []
  for (let fila = 0; fila < n; fila++) {
    A.push(Array.from({ length: n }, (_, col) => sumasX[fila + col]))
  }

  const coeficientes = resolverSistema(A, sumasXY)
  if (coeficientes === null) return null

  const evaluar = (x: number): number =>
    coeficientes.reduce((suma, coef, potencia) => suma + coef * Math.pow(x, potencia), 0)

  // R²: 1 menos la proporción de varianza que la curva NO explica.
  const promedio = limpios.reduce((s, p) => s + p.y, 0) / limpios.length
  const ssTotal = limpios.reduce((s, p) => s + Math.pow(p.y - promedio, 2), 0)
  const ssResiduos = limpios.reduce((s, p) => s + Math.pow(p.y - evaluar(p.x), 2), 0)
  const r2 = ssTotal > 0 ? 1 - ssResiduos / ssTotal : 1

  return { coeficientes, grado, r2, evaluar }
}

/**
 * El grado más alto que los datos bancan sin convertirse en interpolación.
 *
 * Con pocos puntos, un polinomio de grado alto pasa exactamente por todos y el
 * residuo de cada bono da cero: la curva deja de ser una referencia y pasa a
 * ser un calco. Se exige un punto de sobra por coeficiente para que el ajuste
 * siga siendo un promedio y no una copia.
 */
export function gradoSugerido(cantidadPuntosUnicos: number, maximo = 3): number {
  return Math.max(1, Math.min(maximo, Math.floor(cantidadPuntosUnicos / 2) - 1))
}

/** Puntos de la curva ajustada, para dibujarla suave entre el mínimo y el máximo. */
export function muestrearCurva(
  ajuste: AjustePolinomico,
  desde: number,
  hasta: number,
  muestras = 60,
): Punto[] {
  if (!(hasta > desde) || muestras < 2) return []
  const paso = (hasta - desde) / (muestras - 1)
  return Array.from({ length: muestras }, (_, i) => {
    const x = desde + paso * i
    return { x, y: ajuste.evaluar(x) }
  })
}

/**
 * Cuánto se aparta cada bono de la curva, en puntos porcentuales de TIR.
 *
 * Positivo = rinde MÁS de lo que le tocaría por su plazo, o sea que está barato
 * y el mercado le pide una prima. Negativo = caro. Es la lectura que hace útil
 * a la curva: sin el residuo, la curva es decoración.
 */
export function residuos<T extends Punto>(
  puntos: T[],
  ajuste: Pick<AjustePolinomico, "evaluar">,
): (T & { residuo: number })[] {
  return puntos.map((p) => ({ ...p, residuo: p.y - ajuste.evaluar(p.x) }))
}

export interface AjusteLogaritmico {
  /** y = a + b·ln(x) */
  a: number
  b: number
  /** Cuánta de la dispersión explica la curva, entre 0 y 1. */
  r2: number
  /** Evalúa la curva ajustada en un x > 0. */
  evaluar: (x: number) => number
}

/**
 * Ajuste logarítmico y = a + b·ln(x): la forma de la curva de letras en pesos,
 * que sube rápido en el tramo corto y se aplana en el largo.
 *
 * Es una recta por mínimos cuadrados sobre ln(x), así que reusa
 * ajustarPolinomio de grado 1. Sólo entran los x > 0 (el logaritmo no existe
 * en cero).
 *
 * Pide al menos `minimoPuntos` x distintos, tres por defecto: con dos, la curva
 * pasa exacto por ambos, los dos residuos dan cero y la curva no dice nada.
 */
export function ajustarLogaritmica(puntos: Punto[], minimoPuntos = 3): AjusteLogaritmico | null {
  const enLog = puntos
    .filter((p) => Number.isFinite(p.x) && p.x > 0 && Number.isFinite(p.y))
    .map((p) => ({ x: Math.log(p.x), y: p.y }))
  if (new Set(enLog.map((p) => p.x)).size < Math.max(2, minimoPuntos)) return null

  const recta = ajustarPolinomio(enLog, 1)
  if (recta === null) return null
  const [a, b] = recta.coeficientes
  return { a, b, r2: recta.r2, evaluar: (x: number) => a + b * Math.log(x) }
}

/**
 * Puntos de una curva logarítmica entre `desde` y `hasta`, espaciados parejo en
 * ln(x) y no en x: la curva dobla en el tramo corto, y con muestras lineales
 * ese tramo quedaría dibujado con un par de segmentos rectos.
 */
export function muestrearLogaritmica(
  ajuste: Pick<AjusteLogaritmico, "evaluar">,
  desde: number,
  hasta: number,
  muestras = 60,
): Punto[] {
  if (!(desde > 0) || !(hasta > desde) || muestras < 2) return []
  const lnDesde = Math.log(desde)
  const paso = (Math.log(hasta) - lnDesde) / (muestras - 1)
  return Array.from({ length: muestras }, (_, i) => {
    const x = Math.exp(lnDesde + paso * i)
    return { x, y: ajuste.evaluar(x) }
  })
}
