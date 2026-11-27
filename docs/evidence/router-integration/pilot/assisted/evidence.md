# Piloto sintético asistido por motor

Se crearon ocho solicitudes mediante una evaluación semántica explícita del host y se realizaron ocho invocaciones reales de `routeFalp` en Node. El producto y la skill se usaron sólo mediante lectura. Los únicos archivos escritos están en `/workspace/scratch/ea177efed27f/router-pilot/assisted/`.

## Artefactos

- `run-engine.mjs`: reproduce las evaluaciones del host, compila los dos briefs de investigación y ejecuta una llamada real por caso.
- `requests.json`: evaluaciones explícitas, sus motivos y las ocho solicitudes efectivamente enviadas.
- `engine-results.json`: resultados reales completos, numeración de invocaciones, versión de Node y huella del fixture.
- `write-output.mjs`: reproduce la salida editorial a partir de los resultados observados; no invoca al motor.
- `output.json`: esquema solicitado, cinco prompts completos tras readback textual y tres bloques invariantes con pendientes explícitos.
- `readback.json`: comprobaciones mecánicas de custodia y alcance declarado de la revisión textual propia.

## Comandos ejecutados y códigos

| Comando | Código de salida | Resultado |
|---|---:|---|
| `node /workspace/scratch/ea177efed27f/router-pilot/assisted/run-engine.mjs` | 0 | Ocho llamadas reales de `routeFalp`; dos llamadas de `compileAnchor(case.brief)`; solicitudes y resultados escritos. |
| `node /workspace/scratch/ea177efed27f/router-pilot/assisted/write-output.mjs` | 0 | Ocho casos escritos y releídos; cinco prompts completos y tres borradores con pendientes; cero llamadas adicionales de `routeFalp`. |
| `cat /workspace/scratch/ea177efed27f/router-pilot/assisted/engine-results.json` | 0 | Lectura completa de los resultados antes de redactar los prompts. |
| `cat /workspace/scratch/ea177efed27f/router-pilot/assisted/output.json` | 0 | Lectura final íntegra de la salida. |

Runtime observado: Node `v24.22.3`. El SHA-256 de `pilot-inputs.json` es `fa08630b5dc166a52a4c0401eed3f2b5a95e09b7b608630e4a553c8fd542c74f`.

Para reproducir en este workspace, ejecutar primero `run-engine.mjs` y luego `write-output.mjs` con los comandos de la tabla. El primer script sobrescribe sus artefactos de ejecución y realiza otras ocho llamadas reales; esa repetición no se efectuó durante este piloto.

## Ocho invocaciones observadas

| N.º | Caso | Solicitud del host | Exploración solicitada | Ruta semántica | next | explorationRequired | Ruta de observación |
|---:|---|---|---|---|---|---|---|
| 1 | ready_zero | ready | false | direct | readback | false | null |
| 2 | focused_two_reads | investigation / focused | false | focused | observe | true | exploratory |
| 3 | exploratory_one_read | investigation / exploratory | true | exploratory | observe | true | focused |
| 4 | explicit_exploration | ready | true | direct | explore | true | null |
| 5 | recipient_portability | ready | false | direct | readback | false | null |
| 6 | audit_not_repair | ready | false | direct | readback | false | null |
| 7 | mandatory_worker | ready | false | direct | readback | false | null |
| 8 | optional_no_go | ready | false | direct | readback | false | null |

La política de `focused_two_reads` tiene profundidad 2 y recomienda primero `read_left`, con `read_right` después. Esto no cambia su clasificación semántica focalizada. La política de `exploratory_one_read` tiene profundidad 1 y recomienda `read_requirements`; tampoco convierte su decisión de estrategia en una ruta focalizada. En ambos casos el estado es `planned`, no hay observaciones y las acciones siguen sin ejecutar.

`explicit_exploration` conserva `ready` porque su brief es suficiente, pero el control operativo exige `explore`. Su bloque de texto permanece provisional: la exploración solicitada no se ejecutó ni se trasladó al receptor.

## Lecturas autorizadas

Se ejecutó `cat` sobre cada ruta siguiente y se leyó su contenido completo; todos devolvieron código 0:

1. `/home/agent/.codex/plugins/cache/created-by-me-remote/pstack-chatgpt/0.15.15-chatgpt.10/skills/poteto-mode/worker.md`, leído antes de cualquier otra acción y confirmado al operador.
2. `/home/agent/.codex/plugins/cache/created-by-me-remote/prompts-con-ancla/0.2.1/skills/crear-prompts-gobernados/SKILL.md`.
3. `/home/agent/.codex/plugins/cache/created-by-me-remote/prompts-con-ancla/0.2.1/skills/crear-prompts-gobernados/references/exploracion-falp.md`.
4. `/workspace/scratch/ea177efed27f/motor-router-tests/tests/fixtures/router-integration/pilot-inputs.json`, releído por separado porque la primera salida agrupada tuvo truncamiento de transporte.
5. `/workspace/scratch/ea177efed27f/motor-falp-contract/src/falp.ts`.
6. `/workspace/scratch/ea177efed27f/motor-falp-contract/dist/index.js`.
7. `/workspace/scratch/ea177efed27f/motor-falp-contract/dist/anchor.js`, para comprobar el contrato compilado de `compileAnchor` y la distinción documentada entre política de observación y suficiencia semántica.

El comando `cat /workspace/scratch/ea177efed27f/motor-falp-contract/docs/falp-integration.md` devolvió código 1: el archivo no existía en el momento de la lectura. No se necesitó para ejecutar la API disponible.

Los scripts vuelven a leer únicamente el fixture autorizado y sus propios artefactos. La importación real de `dist/index.js` carga sus módulos compilados. No se leyeron expectativas, código de pruebas, reportes del proyecto ni salidas baseline. La única lectura de entrada bajo `tests/` fue el fixture indicado expresamente por el operador.

## Readback y límites

La salida conserva los ocho anclajes exactamente, incluidos los CRLF de `focused_two_reads`, y las siete frases literales solicitadas. Los controles `route`, `next` y `explorationRequired` proceden de los resultados reales del motor. La revisión textual propia cotejó intención, receptor, permisos, obligaciones y término; no equivale a una revisión independiente ni a una prueba conductual en destino.

No se realizaron consultas a la red, no se ejecutaron probes, no se produjeron recibos de observación y no se ejecutaron auditorías, revisiones delegadas, resúmenes ni otras tareas destinatarias. Los escenarios declarados, sus resultados posibles y `coverage=complete` permanecen propiedades del modelo hipotético aportado. No se promovió ningún resultado posible a hecho observado.

No se tomó `next=readback` como una aprobación automática. El piloto no produjo `solved` ni recorrió `reassess` o `blocked`; no demuestra esos caminos. La salida pendiente declara que una eventual resolución del modelo tampoco sustituiría la reevaluación del host ni el readback del prompt.

El encargo se recibió en un contexto fresco, con filesystem compartido. No se acredita evaluación ciega, aislamiento independiente ni diversidad de modelos. No hay telemetría de tokens o coste; no se calcularon ni inventaron cifras, ahorros ni ventajas de latencia o calidad. Los costes `reads` del plan son unidades declaradas del modelo, no lecturas ejecutadas ni gasto observado.

No se modificaron el repositorio ni el plugin. Los campos de instrumentación describen el piloto y no alteran las reglas de la skill.

## Nota del archivo en el repositorio

Este documento conserva el reporte original del agente. Los scripts de ejecución y escritura se archivaron como `original-run-engine.txt` y `original-write-output.txt` para conservar su código y rutas históricas. El comando portable del repositorio es `node scripts/verify-router-pilot.mjs`; verifica los artefactos y reejecuta el motor sin volver a generar respuestas de un LLM.
