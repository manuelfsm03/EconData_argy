export const IPC_DIVISIONS = [
  { key: "ipc_div_alimentos", id: "146.3_IALIMENNAL_DICI_M_45", nombre: "Alimentos y bebidas no alcohólicas" },
  { key: "ipc_div_bebidas", id: "146.3_IBEBIDANAL_DICI_M_39", nombre: "Bebidas alcohólicas y tabaco" },
  { key: "ipc_div_prendas", id: "146.3_IPRENDANAL_DICI_M_35", nombre: "Prendas de vestir y calzado" },
  { key: "ipc_div_vivienda", id: "146.3_IVIVIENNAL_DICI_M_52", nombre: "Vivienda, agua, electricidad, gas y otros combustibles" },
  { key: "ipc_div_equipamiento", id: "146.3_IEQUIPANAL_DICI_M_46", nombre: "Equipamiento y mantenimiento del hogar" },
  { key: "ipc_div_salud", id: "146.3_ISALUDNAL_DICI_M_18", nombre: "Salud" },
  { key: "ipc_div_transporte", id: "146.3_ITRANSPNAL_DICI_M_23", nombre: "Transporte" },
  { key: "ipc_div_comunicacion", id: "146.3_ICOMUNINAL_DICI_M_27", nombre: "Comunicación" },
  { key: "ipc_div_recreacion", id: "146.3_IRECREANAL_DICI_M_31", nombre: "Recreación y cultura" },
  { key: "ipc_div_educacion", id: "146.3_IEDUCACNAL_DICI_M_22", nombre: "Educación" },
  { key: "ipc_div_restaurantes", id: "146.3_IRESTAUNAL_DICI_M_33", nombre: "Restaurantes y hoteles" },
  { key: "ipc_div_varios", id: "146.3_IBIENESNAL_DICI_M_36", nombre: "Bienes y servicios varios" },
] as const

export type IpcSeries = [date: string, value: number][]

function positive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

export function chunkIpcDivisionKeys(size: number): string[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error("chunk size must be a positive integer")
  const keys = IPC_DIVISIONS.map(item => item.key)
  const chunks: string[][] = []
  for (let index = 0; index < keys.length; index += size) {
    chunks.push(keys.slice(index, index + size))
  }
  return chunks
}

export function buildIpcDivisionSnapshot(seriesByKey: Record<string, IpcSeries>) {
  return IPC_DIVISIONS.map(division => {
    const serie = seriesByKey[division.key] ?? []
    const current = serie[0]?.[1]
    const previous = serie[1]?.[1]
    const yearAgo = serie[12]?.[1]
    const level = positive(current) ? current : null

    return {
      key: division.key,
      nombre: division.nombre,
      data_date: level === null ? null : serie[0]?.[0] ?? null,
      nivel: level,
      var_mensual: level !== null && positive(previous)
        ? Number(((level / previous - 1) * 100).toFixed(2))
        : null,
      var_interanual: level !== null && positive(yearAgo)
        ? Number(((level / yearAgo - 1) * 100).toFixed(2))
        : null,
      serie,
    }
  })
}
