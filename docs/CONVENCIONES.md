# Convenciones — La Pizarra (`EconData_argy`)

Estándar de **nombres de rama** y **descripción de PR** para trabajar en equipo sin pisarnos y que las revisiones sean consistentes.

## Nombres de rama

Formato: `tipo/descripcion-corta-en-kebab`

| Tipo | Para qué | Ejemplo |
|---|---|---|
| `feat/` | nueva funcionalidad | `feat/tab-calendario` |
| `fix/` | corrección de bug | `fix/inflacion-personal-icc` |
| `chore/` | mantenimiento, infra, deps | `chore/branch-naming-pr-template` |
| `refactor/` | reestructura sin cambio de comportamiento | `refactor/split-tab-macro` |
| `security/` | parche de seguridad | `security/rss-ssrf` |
| `data/` | fuentes / series de datos | `data/badlar-to-tamar` |

**Reglas**
- Todo en **minúsculas y kebab-case**. Sin mayúsculas → evita colisiones en Windows (ej. `Juan` vs `juan`).
- **Una rama por tarea/PR.** Nada de ramas gigantes multi-feature (la rama `feature/pivot` es el ejemplo a no repetir: quedó con 250 archivos de diferencia y difícil de mergear).
- **Nadie pushea a `main` directo.** Se mergea por PR; Claude revisa los PRs.
- Rama siempre **desde `main` actualizado** (`git fetch` antes).

## Descripción de PR

Usar el template de [`.github/pull_request_template.md`](../.github/pull_request_template.md). Todo PR documenta:
1. **Qué hace.**
2. Si toca datos: **qué fuente usa, cómo se actualiza y qué calcula.**
3. Checklist: typecheck verde + sin mocks/hardcodes como reales + convención de rama.

## Flujo de trabajo
1. `git fetch origin` → rama desde `main` con la convención de arriba.
2. Commits chicos y descriptivos.
3. `npx tsc --noEmit` en verde antes de push.
4. Abrir PR con el template → review → merge a `main`.
