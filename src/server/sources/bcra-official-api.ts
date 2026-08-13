import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * Official BCRA API v4.0 Client
 * 
 * Provides access to the Central Bank of Argentina's official monetary statistics API.
 * This API contains current data up to September 2025 with over 1,176 monetary variables.
 * 
 * Features:
 * - No authentication required
 * - Current data through September 2025
 * - Daily updates for most variables
 * - Comprehensive monetary, financial, and economic indicators
 * 
 * API Base URL: https://api.bcra.gob.ar/estadisticas/v4.0/
 * 
 * @author Monitor Monetario Team
 * @since 2025-09-11
 * @version 4.0
 */

/**
 * Represents a BCRA monetary variable with its metadata
 */
interface BCRAVariable {
  /** Unique identifier for the variable */
  idVariable: number
  /** Spanish description of the variable */
  descripcion: string
  /** Category classification */
  categoria: string
  /** Type of time series */
  tipoSerie: string
  /** Frequency of updates (daily, monthly, etc.) */
  periodicidad: string
  /** Unit of measurement */
  unidadExpresion: string
  /** Currency denomination */
  moneda: string
  /** First date of available data */
  primerFechaInformada: string
  /** Most recent date of available data */
  ultFechaInformada: string
  /** Most recent value reported */
  ultValorInformado: number
}

/**
 * Represents a single data point from BCRA time series
 */
interface BCRADataPoint {
  /** Date in YYYY-MM-DD format */
  fecha: string
  /** Numeric value for the data point */
  valor: number
}

/**
 * Response structure for BCRA series data requests
 */
interface BCRASeriesResponse {
  /** HTTP status code */
  status: number
  /** Response metadata */
  metadata: {
    resultset: {
      /** Total number of records available */
      count: number
      /** Starting offset for pagination */
      offset: number
      /** Maximum number of records returned */
      limit: number
    }
  }
  /** Array of series data */
  results: Array<{
    /** Variable identifier */
    idVariable: number
    /** Array of time series data points */
    detalle: BCRADataPoint[]
  }>
}

/**
 * Response structure for BCRA variables metadata requests
 */
interface BCRAVariablesResponse {
  /** HTTP status code */
  status: number
  /** Response metadata */
  metadata: {
    resultset: {
      /** Total number of variables available */
      count: number
      /** Starting offset for pagination */
      offset: number
      /** Maximum number of variables returned */
      limit: number
    }
  }
  /** Array of variable metadata */
  results: BCRAVariable[]
}

/**
 * Official mapping of frontend series IDs to BCRA API v4.0 variables
 * 
 * This mapping connects our dashboard's series identifiers to the official
 * BCRA IdVariables, enabling seamless integration with current monetary data.
 * 
 * Each variable includes:
 * - idVariable: Official BCRA identifier
 * - descripcion: Spanish description from BCRA
 * - frontendId: Internal identifier used in dashboard
 * - unit: Data unit (percentage, millions_usd, etc.)
 * - frequency: Update frequency (daily, monthly)
 * 
 * @see https://api.bcra.gob.ar/estadisticas/v4.0/Metodologia/ for methodology
 * @see https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias for all variables
 */
export const BCRA_VARIABLE_MAPPING = {
  // Core series with current data
  BADLAR_TNA: {
    idVariable: 7,
    descripcion: 'Tasa de interés BADLAR de bancos privados',
    frontendId: 'badlar',
    unit: 'percentage',
    frequency: 'daily'
  },
  TAMAR_TNA: {
    idVariable: 6,
    descripcion: 'Tasa de interés TAMAR de bancos privados',
    frontendId: 'tamar',
    unit: 'percentage',
    frequency: 'daily'
  },
  RESERVAS_USD: {
    idVariable: 1,
    descripcion: 'Reservas internacionales',
    frontendId: 'reservas',
    unit: 'millions_usd',
    frequency: 'daily'
  },
  TIPO_CAMBIO_MINORISTA: {
    idVariable: 4,
    descripcion: 'Tipo de cambio minorista (promedio vendedor)',
    frontendId: 'tc_minorista',
    unit: 'ars_per_usd',
    frequency: 'daily'
  },
  TIPO_CAMBIO_MAYORISTA: {
    idVariable: 5,
    descripcion: 'Tipo de cambio mayorista de referencia',
    frontendId: 'tc_mayorista',
    unit: 'ars_per_usd',
    frequency: 'daily'
  },
  BASE_MONETARIA: {
    idVariable: 15,
    descripcion: 'Base monetaria',
    frontendId: 'base_monetaria',
    unit: 'millions_ars',
    frequency: 'daily'
  },
  TASA_DEPOSITOS_30D: {
    idVariable: 12,
    descripcion: 'Tasa de interés de depósitos a 30 días de plazo en entidades financieras',
    frontendId: 'depositos_30d',
    unit: 'percentage',
    frequency: 'daily'
  },
  DEPOSITOS_EFECTIVO: {
    idVariable: 20,
    descripcion: 'Depósitos en efectivo en las entidades financieras',
    frontendId: 'depositos_efectivo',
    unit: 'millions_ars',
    frequency: 'daily'
  },
  CIRCULACION_MONETARIA: {
    idVariable: 16,
    descripcion: 'Circulación monetaria',
    frontendId: 'circulacion',
    unit: 'millions_ars',
    frequency: 'daily'
  },
  // Additional Interest Rates & Financial Instruments
  TM20: {
    idVariable: 8,
    descripcion: 'Tasa de interés TM20 de bancos privados',
    frontendId: 'tm20',
    unit: 'percentage',
    frequency: 'daily'
  },
  PASES_ACTIVOS_BCRA: {
    idVariable: 9,
    descripcion: 'Tasa de interés de pases activos para el BCRA a 1 día de plazo',
    frontendId: 'pases_activos',
    unit: 'percentage',
    frequency: 'daily'
  },
  PASES_PASIVOS_BCRA: {
    idVariable: 10,
    descripcion: 'Tasa de interés de pases pasivos para el BCRA a 1 día de plazo',
    frontendId: 'pases_pasivos',
    unit: 'percentage',
    frequency: 'daily'
  },
  BAIBAR: {
    idVariable: 11,
    descripcion: 'Tasa de interés de préstamos entre entidades financiera privadas (BAIBAR)',
    frontendId: 'baibar',
    unit: 'percentage',
    frequency: 'daily'
  },
  ADELANTOS_CUENTA_CORRIENTE: {
    idVariable: 13,
    descripcion: 'Tasa de interés por adelantos en cuenta corriente',
    frontendId: 'adelantos_cc',
    unit: 'percentage',
    frequency: 'daily'
  },
  PRESTAMOS_PERSONALES: {
    idVariable: 14,
    descripcion: 'Tasa de interés de préstamos personales',
    frontendId: 'prestamos_personales',
    unit: 'percentage',
    frequency: 'daily'
  },
  
  // Monetary Aggregates & Circulation
  BILLETES_Y_MONEDAS: {
    idVariable: 17,
    descripcion: 'Billetes y monedas en poder del público',
    frontendId: 'billetes_monedas',
    unit: 'millions_ars',
    frequency: 'daily'
  },
  EFECTIVO_ENTIDADES: {
    idVariable: 18,
    descripcion: 'Efectivo en pesos en entidades financieras',
    frontendId: 'efectivo_entidades',
    unit: 'millions_ars',
    frequency: 'daily'
  },
  DEPOSITOS_BCRA: {
    idVariable: 19,
    descripcion: 'Depósitos de las entidades financieras en cuenta corriente en el BCRA',
    frontendId: 'depositos_bcra',
    unit: 'millions_ars',
    frequency: 'daily'
  },
  
  // Deposits & Savings (Critical for Dashboard)
  DEPOSITOS_CUENTA_CORRIENTE: {
    idVariable: 21,
    descripcion: 'Depósitos en efectivo en las entidades financieras en cuentas corrientes',
    frontendId: 'depositos_cc',
    unit: 'millions_ars',
    frequency: 'daily'
  },
  CAJAS_AHORRO: {
    idVariable: 22,
    descripcion: 'Depósitos en efectivo en las entidades financieras en cajas de ahorro',
    frontendId: 'cajas_ahorro',
    unit: 'millions_ars',
    frequency: 'daily'
  },
  DEPOSITOS_PLAZO: {
    idVariable: 23,
    descripcion: 'Depósitos a plazo en efectivo en las entidades financieras (incluye inversiones y excluye CEDROs)',
    frontendId: 'plazos_fijos',
    unit: 'millions_ars',
    frequency: 'daily'
  },
  
  // Economic Indicators & Inflation
  M2_PRIV_PMM30D_YOY_PCT: {
    idVariable: 24,
    descripcion: 'M2 privado, promedio móvil 30 días (variación interanual)',
    frontendId: 'm2_privado_yoy',
    unit: 'percentage',
    frequency: 'daily'
  },
  PRESTAMOS_PRIV_TOTAL_ARS: {
    idVariable: 25,
    descripcion: 'Préstamos a sector privado',
    frontendId: 'prestamos_privado',
    unit: 'millions_ars',
    frequency: 'daily'
  },
  IPC_MENSUAL: {
    idVariable: 27,
    descripcion: 'Variación mensual del índice de precios al consumidor',
    frontendId: 'ipc_mensual',
    unit: 'percentage',
    frequency: 'monthly'
  },
  IPC_INTERANUAL: {
    idVariable: 28,
    descripcion: 'Variación interanual del índice de precios al consumidor',
    frontendId: 'ipc_interanual',
    unit: 'percentage',
    frequency: 'monthly'
  },
  EXPECTATIVAS_IPC: {
    idVariable: 29,
    descripcion: 'Mediana de la variación interanual próximos 12 meses del IPC del relevamiento de expectativas',
    frontendId: 'expectativas_ipc',
    unit: 'percentage',
    frequency: 'monthly'
  },
  
  // Index Units
  CER: {
    idVariable: 30,
    descripcion: 'Coeficiente de estabilización de referencia (base 2.2.02=1)',
    frontendId: 'cer',
    unit: 'index',
    frequency: 'daily'
  },
  UVA: {
    idVariable: 31,
    descripcion: 'Unidad de valor adquisitivo (base 31.3.16=14.05)',
    frontendId: 'uva',
    unit: 'ars',
    frequency: 'daily'
  },
  UVI: {
    idVariable: 32,
    descripcion: 'Unidad de vivienda (base 31.3.16=14.05)',
    frontendId: 'uvi',
    unit: 'ars',
    frequency: 'daily'
  },
  
  // Alternative BADLAR
  BADLAR_EFECTIVO: {
    idVariable: 35,
    descripcion: 'Tasa de interés BADLAR de bancos privados (efectivo anual)',
    frontendId: 'badlar_efectivo',
    unit: 'percentage',
    frequency: 'daily'
  },
  
  // Housing Index
  INDICE_LOCACION: {
    idVariable: 40,
    descripcion: 'Índice para Contratos de Locación (base 30.6.20=1)',
    frontendId: 'indice_locacion',
    unit: 'ars',
    frequency: 'monthly'
  }
} as const

export type BCRAVariableKey = keyof typeof BCRA_VARIABLE_MAPPING

export class BCRAOfficialApiClient {
  private baseUrl = 'https://api.bcra.gob.ar/estadisticas/v4.0'
  private requestCount = 0
  
  constructor() {
    console.log('🏦 Official BCRA API v4.0 client initialized')
    console.log('✅ No authentication required')
  }

  /**
   * Make request to official BCRA API
   */
  private async fetchFromBCRA<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`
    
    console.log(`🔍 Fetching: ${url}`)
    
    try {
      const response = await fetchRegistered(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        // Disable cache to ensure fresh data
        cache: 'no-store',
      })

      this.requestCount++

      if (!response.ok) {
        // Try to get error details from response
        let errorDetails = ''
        try {
          const errorBody = await response.json()
          if (errorBody.errorMessages) {
            errorDetails = ` - ${errorBody.errorMessages.join(', ')}`
          }
        } catch {}
        
        throw new Error(`BCRA API error: ${response.status} ${response.statusText}${errorDetails}`)
      }

      const data = await response.json()
      
      // Validate response format
      if (!data.status || !data.results) {
        throw new Error('Invalid response format from BCRA API')
      }
      
      if (data.status !== 200) {
        const errorMsg = data.errorMessages?.join(', ') || 'Unknown error'
        throw new Error(`BCRA API error: ${errorMsg}`)
      }

      return data as T
    } catch (error) {
      console.error(`Error fetching from BCRA endpoint ${endpoint}:`, error)
      throw error
    }
  }

  /**
   * Get all available monetary variables
   */
  async getVariables(
    filters?: {
      categoria?: string
      periodicidad?: 'D' | 'M' | 'T'
      offset?: number
      limit?: number
    }
  ): Promise<BCRAVariable[]> {
    const params = new URLSearchParams()
    
    if (filters?.categoria) params.append('categoria', filters.categoria)
    if (filters?.periodicidad) params.append('periodicidad', filters.periodicidad)
    if (filters?.offset) params.append('offset', filters.offset.toString())
    if (filters?.limit) params.append('limit', filters.limit.toString())
    
    const endpoint = `monetarias${params.toString() ? '?' + params.toString() : ''}`
    
    const response = await this.fetchFromBCRA<BCRAVariablesResponse>(endpoint)
    return response.results
  }

  /**
   * Get time series data for a specific variable
   */
  async getSeriesData(
    idVariable: number,
    fromDate?: string,
    toDate?: string,
    limit = 1000,
    offset = 0
  ): Promise<BCRADataPoint[]> {
    const params = new URLSearchParams()
    
    if (fromDate) params.append('desde', fromDate)
    if (toDate) params.append('hasta', toDate)
    if (limit) params.append('limit', limit.toString())
    if (offset) params.append('offset', offset.toString())
    
    const endpoint = `monetarias/${idVariable}${params.toString() ? '?' + params.toString() : ''}`
    
    const response = await this.fetchFromBCRA<BCRASeriesResponse>(endpoint)
    
    if (response.results.length === 0) {
      return []
    }
    
    return response.results[0].detalle || []
  }

  /**
   * Get multiple series data in parallel
   */
  async getMultipleSeriesData(
    variables: BCRAVariableKey[],
    fromDate?: string,
    toDate?: string
  ): Promise<Record<string, BCRADataPoint[]>> {
    const results: Record<string, BCRADataPoint[]> = {}
    
    // Process in batches to be respectful to the API
    const batchSize = 3
    for (let i = 0; i < variables.length; i += batchSize) {
      const batch = variables.slice(i, i + batchSize)
      
      const promises = batch.map(async (variableKey) => {
        try {
          const config = BCRA_VARIABLE_MAPPING[variableKey]
          const data = await this.getSeriesData(
            config.idVariable,
            fromDate,
            toDate
          )
          return { variableKey, data }
        } catch (error) {
          console.error(`Failed to fetch ${variableKey}:`, error)
          return { variableKey, data: [] }
        }
      })
      
      const batchResults = await Promise.all(promises)
      
      for (const { variableKey, data } of batchResults) {
        const config = BCRA_VARIABLE_MAPPING[variableKey]
        results[config.frontendId] = data
      }
      
      // Add delay between batches to be respectful
      if (i + batchSize < variables.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    return results
  }

  /**
   * Get latest value for a variable
   */
  async getLatestValue(variableKey: BCRAVariableKey): Promise<number | null> {
    try {
      const config = BCRA_VARIABLE_MAPPING[variableKey]
      const data = await this.getSeriesData(config.idVariable, undefined, undefined, 1)
      
      if (data.length === 0) return null
      
      // Data comes sorted by date DESC by default
      return data[0].valor
    } catch (error) {
      console.error(`Failed to get latest value for ${variableKey}:`, error)
      return null
    }
  }

  /**
   * Transform BCRA data to our database format
   */
  transformToObservations(
    variableKey: BCRAVariableKey,
    bcraData: BCRADataPoint[]
  ) {
    const config = BCRA_VARIABLE_MAPPING[variableKey]
    
    return bcraData.map(point => ({
      id_variable: variableKey,
      date: point.fecha,
      value: point.valor,
      frontend_id: config.frontendId,
    }))
  }

  /**
   * Get variable metadata
   */
  getVariableInfo(variableKey: BCRAVariableKey) {
    return BCRA_VARIABLE_MAPPING[variableKey]
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to fetch a simple variable list with limit 1
      const variables = await this.getVariables({ limit: 1 })
      return variables.length > 0
    } catch (error) {
      console.error('BCRA Official API connection test failed:', error)
      return false
    }
  }

  /**
   * Get request statistics
   */
  getRequestStats() {
    return {
      requestCount: this.requestCount,
      baseUrl: this.baseUrl,
    }
  }
}

// Export singleton instance
export const bcraOfficialApi = new BCRAOfficialApiClient()
