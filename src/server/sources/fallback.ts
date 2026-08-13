import { SOURCE_REGISTRY, type SourceId } from "./registry"
import type { SourceDefinition } from "./types"

export type ResolvedSource = SourceDefinition & { fallbackFrom: SourceId | null }

function compatible(primary: SourceDefinition, fallback: SourceDefinition): boolean {
  return primary.dataClass === fallback.dataClass
}

export function resolveSourceChain(sourceId: SourceId): ResolvedSource[] {
  const chain: ResolvedSource[] = []
  const visited = new Set<string>()

  const visit = (id: SourceId, fallbackFrom: SourceId | null) => {
    const definition = SOURCE_REGISTRY[id] as SourceDefinition | undefined
    if (!definition) throw new Error(`SOURCE_NOT_REGISTERED:${id}`)
    if (visited.has(id)) throw new Error(`SOURCE_FALLBACK_CYCLE:${id}`)
    if (fallbackFrom && !compatible(SOURCE_REGISTRY[fallbackFrom], definition)) {
      throw new Error(`SOURCE_FALLBACK_INCOMPATIBLE:${fallbackFrom}:${id}`)
    }
    visited.add(id)
    chain.push({ ...definition, fallbackFrom })
    for (const next of definition.fallbackSourceIds) visit(next as SourceId, id)
  }

  visit(sourceId, null)
  return chain
}
