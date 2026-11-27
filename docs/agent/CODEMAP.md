# Dónde empezar

## Entradas

| Ruta | Pregunta que responde |
|---|---|
| [index.ts](../../src/index.ts) | Qué exporta la biblioteca |
| [planner.ts](../../src/planner.ts) | Cómo elige una política y cuándo se detiene |
| [core.ts](../../src/core.ts) | Qué entrada acepta y cómo filtra evidencia |
| [anchor.ts](../../src/anchor.ts) | Adaptar briefs con ancla al modelo finito |
| [falp.ts](../../src/falp.ts) | Conservar clasificación del host, controles y recibos de una tarea |
| [session.ts](../../src/session.ts) | Cómo cambia el presupuesto tras una observación |
| [cli.mjs](../../cli.mjs) | Cómo se consume desde un proceso |
| [session.mjs](../../examples/session.mjs) | Cómo recorrer un modelo simulado hasta resolverlo |

## Superficies de cambio

| Si cambia | Empezar por | Revisar también | Verificación |
|---|---|---|---|
| Contrato finito o diagnóstico | `src/core.ts` | [API](../api.md), `tests/core.test.mjs` | Oráculo histórico y tests |
| Optimalidad, presupuesto o límites | `src/planner.ts` | [Diseño](../design.md), `tests/planner.test.mjs` | Oráculo de planificación y certificados |
| Adaptador de anclas | `src/anchor.ts` | [Contrato](../anchor-adapter.md), `tests/anchor.test.mjs` | Pruebas de rutas, recibos y límites |
| Integración del router FALP | `src/falp.ts` | [Frontera del host](../falp-integration.md), `tests/falp.test.mjs` | Contratos de control, recibos y paquete instalado |
| Traducción y piloto del router | `tests/anchor-differential.test.mjs`, `scripts/verify-router-pilot.mjs` | [Evidencia](../evidence/router-integration/README.md), fixtures del piloto | Permutaciones, sesiones JSON y replay de solicitudes |
| Registro de resultados | `src/session.ts` | `tests/session.test.mjs`, ejemplo de sesión | Pruebas de idempotencia, gates y conflictos |
| Entrada o salida de CLI | `cli.mjs` | `tests/cli.test.mjs`, API | Tests de proceso y paquete instalado |
| Empaquetado o toolchain | `package.json` y lockfile | `tsconfig.json`, CI | Tipos, build, dist y tarball |
| Autoridades o documentación | `GOVERNANCE.md` | `AGENTS.md` y el documento propietario | Checker estructural y revisión de contenido |

Los comandos exactos están en [Operación](RUNTIME.md). Las responsabilidades e invariantes pertenecen a [Arquitectura](ARCHITECTURE.md).

## Recorrido

Leer [README](../../README.md), [API](../api.md), `src/index.ts` y el módulo correspondiente a la consulta. Para investigar una discrepancia numérica, comenzar por los fixtures y la salida del oráculo, no por el benchmark de tiempo.
