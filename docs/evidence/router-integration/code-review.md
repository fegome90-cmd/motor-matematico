# Revisión independiente de la frontera FALP

## Dictamen

**PASS dentro del alcance revisado, con un Nit documental. No se encontraron Blocker ni Major.**

La clasificación semántica permanece en `route`; la profundidad de observación se publica en `observationRoute`; el avance operativo depende de `next`. Los recibos nuevos se vinculan al contexto y al despacho confiado, revalidan revocaciones y usan la acción actualmente recomendada. La conservación literal del ancla y la aritmética entera exacta se sostienen en la implementación y las comprobaciones ejecutadas.

Este es un dictamen de revisión de agente sustentado por lectura y pruebas locales, no aprobación humana, evaluación ciega ni autorización de publicación. No evalúa la calidad semántica del host ni modifica el plugin.

## Identidad y alcance

- Fecha de cierre de comprobaciones: `2026-11-27T13:20:25Z`.
- Checkout: `/workspace/scratch/ea177efed27f/motor-router-tests`.
- Rama: `test/falp-router-integration`.
- Base: `71717755b5369a570580e76b8b17a1051341e035`.
- HEAD revisado: `68b6e73ec2376ecdbbe9efb5104d9c5a1056dea3`.
- Cambios considerados: `2be9b06` (frontera FALP), `5448629` (sesión desde tarball) y `68b6e73` (pruebas de traducción, permutación y sesiones JSON).
- Rol: lectura/revisión. No se modificaron archivos del repositorio, no se cambió el plugin y no se hizo push. El reporte y el script adversarial se escribieron fuera del checkout, en el directorio de evidencia asignado.
- Se leyó completo y se confirmó al coordinador el contrato `/home/agent/.codex/plugins/cache/created-by-me-remote/pstack-chatgpt/0.15.15-chatgpt.10/skills/poteto-mode/worker.md` antes de iniciar otras acciones.

## Findings

### Blocker

Ninguno identificado en los archivos y contratos revisados.

### Major

Ninguno identificado en los archivos y contratos revisados.

### Nit N1 — Los mapas para agentes omiten la nueva frontera FALP

**Archivos:** `docs/agent/ARCHITECTURE.md`, líneas 9–16; `docs/agent/CODEMAP.md`, líneas 5–13 y 17–25.

**Discrepancia:** las tablas de componentes, puntos de entrada y superficies de cambio siguen enumerando el núcleo, planificador, sesión, anclas e index, pero no incorporan `src/falp.ts`. La frontera ahora exporta dos funciones públicas y añade una responsabilidad distinta: conservar la clasificación semántica y vincular recibos al contexto del host. El contrato propietario sí está documentado correctamente en `docs/falp-integration.md` y enlazado desde API.

**Evidencia:** lectura completa de ambos mapas, `src/index.ts`, `src/falp.ts`, `docs/api.md` y `docs/falp-integration.md`. La omisión no cambia la ejecución ni contradice el contrato normativo, pero dificulta encontrar el módulo responsable de `routeFalp` y `acceptFalpReceipt` al seguir las entradas de AGENTS.md.

**Cambio sugerido:** añadir una fila de `src/falp.ts` a las tablas de arquitectura y mapa, enlazando `docs/falp-integration.md`, `tests/falp.test.mjs` y la verificación de paquete. Es una mejora documental no bloqueante; no requiere cambiar la implementación.

## Lecturas completas

Se leyeron íntegros los archivos asignados y los contratos/dependencias necesarios. Una primera lectura agrupada truncó parte de la salida; esos archivos se volvieron a leer completos por separado antes de emitir este dictamen.

| Grupo | Archivos leídos completos |
|---|---|
| Gobierno y revisión | `AGENTS.md`, `GOVERNANCE.md`, `docs/review-standard.md` |
| Contratos y diseño | `docs/api.md`, `docs/falp-integration.md`, `docs/anchor-adapter.md`, `docs/design.md` |
| Mapas y operación | `docs/agent/ARCHITECTURE.md`, `docs/agent/RUNTIME.md`, `docs/agent/CODEMAP.md` |
| Implementación | `src/falp.ts`, `src/anchor.ts`, `src/session.ts`, `src/core.ts`, `src/planner.ts`, `src/index.ts` |
| Superficie distribuida de FALP | `dist/falp.js`, `dist/falp.d.ts` |
| Pruebas | `tests/falp.test.mjs`, `tests/anchor.test.mjs`, `tests/session.test.mjs`, `tests/anchor-differential.test.mjs` |
| Fixtures | `examples/anchor-routing.json`, `tests/fixtures/router-integration/translation-cases.json` |
| Consumo y compilación | `package.json`, `tsconfig.json`, `scripts/verify-package.mjs` |
| Evidencia propia | `/workspace/scratch/ea177efed27f/router-pilot/review-adversarial.mjs` |

No hubo archivos asignados inaccesibles. Una exploración inicial de nombres comprobó que `src/validation.ts` y `src/types.ts` no existen; los contratos correspondientes están en `src/core.ts`, leído completo.

## Evaluación de los riesgos solicitados

| Riesgo | Resultado y soporte |
|---|---|
| Confundir clasificación con profundidad | `routeFalp` conserva `classification` de investigación y calcula `observationRoute` mediante `routeAnchor`. La prueba de una brecha concreta con dos observaciones devuelve `focused / exploratory / observe`; la de un encuadre exploratorio con una observación devuelve `exploratory / focused / observe`. Un modelo resuelto exige `reassess`. |
| Entregar un brief listo mediante un modelo ficticio | `ready` no requiere `AnchorState`. Con gate permitido devuelve `readback`, o `explore` si se solicitó explícitamente. Los gates desconocidos/denegados devuelven `blocked` sin plan. |
| Recibo de otra tarea, revisión, ancla, pregunta o acción | `acceptFalpReceipt` compara contexto contra dispatch y los cinco campos del recibo contra dispatch antes de registrar. Comprueba existencia de pregunta y acción. Las pruebas cruzadas y el rechazo de acción no recomendada pasan. La vinculación semántica entre pregunta y acción pertenece expresamente al despacho confiado del host. |
| Replay y cobro duplicado | La igualdad del triple acción/resultado/fuente devuelve `DUPLICATE` tras revalidar gates, permiso y disponibilidad. Una fuente o resultado diferente para una acción ya observada se rechaza por la sesión. Se comprobó replay incluso con presupuesto cero y registro lleno. |
| Revocación tras el despacho | Gates del contexto y modelo, permiso y disponibilidad actuales se revisan antes de aceptar o reconocer un duplicado. Los siete motivos de revocación están cubiertos por las pruebas FALP. La comprobación adversarial verificó además la precedencia de revocación sobre los tres estados inconclusos sin perder el estado original del recibo. |
| Convertir incertidumbre en evidencia | `UNKNOWN`, `CONFLICT` y `BLOCKED` prohíben `outcome`, conservan estado/presupuesto y requieren acción vigente cuando no prevalece una revocación. Se comprobó rechazo de esos tres reportes después de que la acción dejara de ser recomendada y durante `maxStates: 1`. |
| Alteración del ancla | Las funciones usan igualdad y copia literal, sin trim ni normalización de la salida. Las pruebas cubren CRLF, espacios exteriores, NFC/NFD, emoji, NUL y la frontera de 32.768 unidades UTF-16 en el adaptador. El wrapper verifica igualdad entre `context.anchor` y `state.anchor`. |
| Presupuesto exacto | Costos y saldos permanecen como cadenas decimales. `advance` descuenta con `BigInt`. La sesión FALP por encima de 2^53 pasa; la comprobación adicional de 128 dígitos aceptó el costo máximo exacto con saldo final cero y rechazó un presupuesto una unidad menor sin modificarlo. |
| Capacidad del registro | Se comprobó a través de la frontera FALP que 511 observaciones previas impiden publicar una política de dos pasos (`MAX_OBSERVATIONS`), y que 510 permiten completar exactamente 512 entradas. El caso limitado no registró evidencia ni cobró. |

## Comandos y resultados

Todos los comandos se ejecutaron en el checkout indicado, salvo rutas absolutas explícitas. Runtime observado: **Node `v24.22.3`**. Los avisos de npm sobre `http-proxy` no cambiaron los códigos de salida.

| Comando | Resultado |
|---|---|
| `git status --short --branch` | Rama correcta; sólo trabajo concurrente no rastreado de corpus/piloto/evidencia. Ninguna modificación de fuente atribuible a esta revisión. |
| `git log --oneline -6` | Verificados los tres commits del encargo encima de la base. |
| `git rev-parse HEAD 7171775` | HEAD y base completos registrados arriba. |
| `git diff 7171775..HEAD --stat` | 13 archivos, 1.524 inserciones y 1 eliminación. |
| `node --version` | `v24.22.3`. |
| `node --test tests/falp.test.mjs tests/anchor.test.mjs tests/anchor-differential.test.mjs tests/session.test.mjs` | **41/41 PASS**, 0 fallos, 0 omitidos; salida 0. Incluye 168 permutaciones de traducción y 24 sesiones JSON dentro de los subtests. |
| `npm run typecheck` | **PASS**, TypeScript `--noEmit`; salida 0. |
| `npm run verify:package` | **PASS**, salida 0; consumo público desde tarball instalado, CLI de costo `6`, biblioteca de costo `6`, sesión FALP `next: reassess` y saldo `0`, 0 dependencias de runtime. La salida reportó 67 archivos empaquetados. |
| `node --test /workspace/scratch/ea177efed27f/router-pilot/review-adversarial.mjs` | **3/3 PASS**, 0 fallos, 0 omitidos; salida 0. El archivo contiene los casos concretos de reportes inconclusos, capacidad de registro/replay y enteros de 128 dígitos. |
| `git diff --check 7171775..HEAD` | **PASS**, salida 0, sin errores de whitespace. |
| `git diff --exit-code 7171775..HEAD -- src/core.ts src/planner.ts src/session.ts src/anchor.ts` | Salida 0; esas cuatro dependencias no fueron modificadas por los tres commits revisados. |
| `git diff --exit-code -- src dist docs/api.md docs/falp-integration.md tests/falp.test.mjs` | Salida 0 al cierre; superficie principal revisada sin cambios locales. |
| `date -u +%Y-%m-%dT%H:%M:%SZ` | `2026-11-27T13:20:25Z`. |

Se ejecutaron solamente tres comprobaciones adversariales adicionales, dirigidas a huecos concretos de la suite FALP. No se repitieron los oráculos completos.

## Límites del dictamen

1. La evaluación es de contrato de biblioteca y preservación de invariantes sobre modelos suministrados. No prueba exactitud de clasificación semántica en tareas reales, cobertura de mundos declarada por el host, calidad del prompt resultante ni ahorro de tokens.
2. No se exige ni se verificó autenticación externa, parser de lenguaje natural o vigencia global de revisiones: no están prometidos. El host debe conservar el despacho confiado, aportar el estado vigente, autenticar fuentes y coordinar concurrencia. Sustituir coordinadamente todo el contexto/modelo no es detectable por una función pura de estos argumentos.
3. No se aprobaron ni evaluaron efectos externos. Un resultado `SUPPORTED` conserva su significado documentado de dato aceptado por el host; no prueba que una herramienta se haya ejecutado ni que la fuente sea auténtica.
4. Los 41 tests y el tarball usan los artefactos `dist` presentes en el checkout. Se leyeron completos `dist/falp.js` y `dist/falp.d.ts` contra la fuente y se ejecutó typecheck; esta revisión no volvió a generar `dist` para conservar el alcance de sólo lectura. No reemplaza el gate de recompilación y comparación de distribución.
5. No se ejecutaron en este frente lint completo, todos los tests del repositorio, checker documental, oráculos Python ni la matriz CI Node 22/24. Esos gates corresponden a la verificación integral del coordinador; no se presentan como hechos de esta revisión.
6. El tarball se creó desde el checkout de trabajo compartido. Los agentes concurrentes añadían documentos y fixtures no rastreados; el smoke test confirma el consumo público observado, no la igualdad byte a byte con un futuro tarball del commit final.
7. El corpus piloto y sus nuevos scripts/tests concurrentes no son objeto de este dictamen. No se leyeron ni se usaron para inferir calidad del router.

La conclusión operativa es que los tres commits revisados cumplen la frontera FALP prometida en los riesgos inspeccionados. El único ajuste propuesto aquí es incorporar el nuevo módulo a los mapas de orientación para agentes.

## Cierre posterior de Nit N1

**Resolución observada el `2026-11-27T13:22:07Z`: Nit N1 resuelto en el worktree compartido.** La observación y el dictamen originales se conservan arriba como historial.

Por solicitud del coordinador se volvieron a leer únicamente `docs/agent/ARCHITECTURE.md` y `docs/agent/CODEMAP.md` mediante `cat docs/agent/ARCHITECTURE.md docs/agent/CODEMAP.md` (salida 0). Ambos documentos incorporan ahora `src/falp.ts`. Arquitectura describe la separación entre clasificación semántica y control operativo, la validación de recibos contextuales y enlaza el contrato `docs/falp-integration.md`. El mapa añade el punto de entrada y una superficie de cambio específica con el mismo contrato, `tests/falp.test.mjs` y verificación del paquete instalado.

**Estado de hallazgos abiertos tras esta comprobación: 0 Blocker, 0 Major y 0 Nit.** Esta nota sólo cierra la omisión documental observada: no repite pruebas, no extiende la revisión al merge concurrente ni certifica el commit final. Los resultados y límites técnicos anteriores conservan su alcance original.
