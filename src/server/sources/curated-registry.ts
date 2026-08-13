export type CuratedDatasetDefinition = {
  id: string
  publisher: string
  version: string
  effectiveAt: string
  reference: string
}

export const CURATED_DATASETS = {
  bandas_cambiarias_policy: {
    id: "bandas_cambiarias_policy",
    publisher: "Banco Central de la República Argentina",
    version: "2025-04-11",
    effectiveAt: "2025-04-14",
    reference: "Comunicado BCRA 11/04/2025",
  },
} as const satisfies Record<string, CuratedDatasetDefinition>

export type CuratedDatasetId = keyof typeof CURATED_DATASETS

export function getCuratedDataset(id: CuratedDatasetId): CuratedDatasetDefinition {
  return CURATED_DATASETS[id]
}
