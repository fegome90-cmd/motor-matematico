# Bases reutilizadas

Las revisiones siguientes se fijaron antes de la adaptación. No se importan automáticamente cambios futuros de esos repositorios.

| Base | Revisión | Uso concreto |
|---|---|---|
| [Kit Fundador](https://github.com/fegome90-cmd/kit_fundador/tree/68ec5cf5361481f0553bb5984a0d0d688fe06157) | `68ec5cf5361481f0553bb5984a0d0d688fe06157` | Configuración TS NodeNext/ES2022, separación de núcleo y adaptador, scripts y controles de CI |
| [Kit documental](https://github.com/fegome90-cmd/agent-docs-kit/tree/c1efd7bed2c2e74f47a7ce41a893839cfcdc6f57) | `c1efd7bed2c2e74f47a7ce41a893839cfcdc6f57` | Cinco documentos para agentes, redacción basada en evidencia y checker estructural |
| [Constitución Agéntica](https://github.com/fegome90-cmd/constitucion-ai/tree/cdb626e0960e88e3be1ce4a1755f5441a1dbe251) | `cdb626e0960e88e3be1ce4a1755f5441a1dbe251` | Gobierno, autoridades, roles, verificación y reconciliación documental |

## Kit Fundador

[templates/fastify-core/tsconfig.json](https://github.com/fegome90-cmd/kit_fundador/blob/68ec5cf5361481f0553bb5984a0d0d688fe06157/templates/fastify-core/tsconfig.json) aporta la base de `tsconfig.json`. Se agregan declaraciones públicas y `noUncheckedIndexedAccess`. Se omite `types: ["node"]` porque el núcleo TypeScript no importa API de Node; los adaptadores Node son archivos JavaScript.

[El manifiesto del template](https://github.com/fegome90-cmd/kit_fundador/blob/68ec5cf5361481f0553bb5984a0d0d688fe06157/templates/fastify-core/package.json) aporta build, typecheck y pruebas con `node:test`. Este repositorio usa npm y un solo lockfile. Los patrones de ignore se adaptan del mismo template. Aquí `dist` se versiona para ejecutar el motor sin instalar compilador; CI comprueba que corresponda al código fuente.

[El workflow](https://github.com/fegome90-cmd/kit_fundador/blob/68ec5cf5361481f0553bb5984a0d0d688fe06157/.github/workflows/ci.yml) aporta permisos mínimos, concurrencia y pasos de calidad. Se actualiza al entorno Node declarado por este proyecto. Las rutas de `dev-docs` y el stack descrito por `GEMINI.md` del kit son históricos y no gobiernan el motor. No se copian Fastify, HTTP, identidades ni persistencia, porque el producto de esta entrega es un núcleo y CLI locales.

## Kit documental

Las plantillas `templates/AGENTS.md` y `templates/docs/agent/{CONTEXT,ARCHITECTURE,CODEMAP,RUNTIME}.md` se adaptaron a archivos reales del motor. Cada contrato tiene un documento propietario. Los otros documentos lo enlazan.

`scripts/check-docs.py` carga la API pública `check` de un checkout limpio en la revisión fijada. Ese checkout se mantiene fuera del paquete. La variable opcional `AGENT_DOCS_KIT_PATH` permite reutilizarlo localmente; CI obtiene la revisión exacta. No se instala Portalocker ni Graphify porque no se usan historial transaccional ni extracción de grafos.

El checker valida presencia, UTF-8, LF, borradores pendientes y enlaces locales simples de los cinco documentos. Un PASS estructural no acredita coherencia semántica, aprobación humana ni vigencia de todo lo enlazado. La revisión EGM contrasta la documentación con el código por separado.

## Constitución

[GOVERNANCE.md](../GOVERNANCE.md) implementa el mapa local de autoridades de Ley VIII, artículo 14.4. [_ctx/policy/roles.yaml](../_ctx/policy/roles.yaml) documenta roles y ámbitos de Ley XII. Ambos distinguen autorización de trabajo, revisión de agentes y aprobación humana.

La toolchain concreta es una elección local coherente con los controles de Ley V. Se usan TypeScript y Biome fijados, `node:test` y Python para los oráculos. Los ejemplos de Vitest, pnpm u otros starters constitucionales no son dependencias obligatorias del motor.

## Procedencia de prototipo y método

La base recibida `falp-math-router-v0.1.0.zip` tiene SHA-256 `7d81ee04c53191c6a7be20e7868db82a93baea0b43316df7f5e9e05f58eae0d0`. El archivo de evidencia histórico tiene SHA-256 `5cdbaf4cf1cf43e86b7aec1d87a6a37c166bfc0ff5b1d4a2860fd7a595db45c1`. Se conserva la implementación inicial en el historial Git, antes de modificarla.

Se aplica pstack-chatgpt 0.15.15-chatgpt.10 para diseño, trabajo aislado, registro y verificación. Las revisiones documentales con contexto nuevo usan el método [EGM de Google](https://github.com/google/elephant-goldfish-model/tree/46933754e63c0424daa9c270d7e0734245d79560), revisión `46933754e63c0424daa9c270d7e0734245d79560`. Esto no afirma que Google haya revisado o certificado el motor, ni que se haya ejecutado Gemini. Los resultados y límites del procedimiento se registran en evidencia.

Las licencias y atribuciones están en [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
