# Pruebas de integración del router FALP

## Alcance

Campaña del 27 de noviembre de 2026 para usar el motor en el router de Prompts con Ancla 0.2.1. La fuente instalada es un protocolo instruccional; no contiene un runtime que ya llame a esta biblioteca. Esta campaña entrega y verifica la frontera de integración, conservando la clasificación semántica y la autoridad del host. La instalación del plugin no cambia.

La base es el adaptador `71717755b5369a570580e76b8b17a1051341e035`. La rama de trabajo es `test/falp-router-integration`, separada de los frentes de gobierno y MVP. Durante la campaña se incorporó por merge el commit ya publicado `95b63ac63cf328e3b833d01ff0551aa392c4d1f0`: fortalece el verificador de certificados con nodos compartidos y estabiliza los tests de tuberías del CLI. No altera el código de producto. Las fuentes instaladas y sus hashes constan en [source-manifest.json](source-manifest.json).

## Hallazgos y cambio realizado

El adaptador de anclas clasifica la profundidad de una política, mientras FALP clasifica la naturaleza de la incertidumbre. Por eso una pregunta concreta con dos lecturas aparecía como `exploratory` en `routeAnchor`; además, un brief suficiente con cero preguntas no era un modelo finito válido. Son brechas de integración, no errores aritméticos del minimax ni incumplimientos del contrato anterior.

La nueva [frontera del host](../../falp-integration.md) separa ambos conceptos:

| Caso | Ruta FALP | Ruta de observaciones | Control siguiente |
|---|---|---|---|
| Encargo suficiente, sin preguntas | `direct` | `null` | `readback` |
| Brecha concreta que requiere dos lecturas | `focused` | `exploratory` | `observe` |
| Estrategia abierta que requiere una lectura | `exploratory` | `focused` | `observe` |
| Encargo suficiente con exploración expresa pendiente | `direct` | `null` | `explore` |
| Investigación resuelta en el modelo | Clasificación conservada | `direct` | `reassess` |
| Gate, cobertura, conflicto, presupuesto o límite impiden continuar | Clasificación conservada | Según estado | `blocked` |

`next` gobierna la continuación. La ruta por sí sola no concede permiso ni autoriza entregar el prompt. Los recibos se validan contra tarea, pregunta, revisión, ancla y acción del despacho confiado conservado por el host. Se revalidan permisos antes de aceptar evidencia y antes de reconocer un replay. El cálculo conserva enteros exactos y no introduce dependencias de ejecución.

## Matriz y evidencia

El comando integrado terminó con código 0. [validation.log](validation.log) conserva la salida completa y [validation-summary.json](validation-summary.json) el resumen con hashes. La compilación dejó `dist` idéntico a los archivos versionados.

| Control ejecutado | Resultado |
|---|---|
| Biome, tipos y build | PASS; 25 archivos revisados por Biome |
| Tests Node | 106/106 PASS; 27 nuevos sobre la base del adaptador |
| Oráculo histórico | 4.352/4.352 PASS |
| Oráculo independiente de planificación | 18.750/18.750 PASS |
| Certificados y caminos comprobados | 5.837 políticas; 24.228 recorridos; 19.454 pasos |
| Autocomprobación del verificador actualizado | 45 óptimos manuales; 17 certificados corruptos rechazados |
| Checker agent-docs-kit | 5 documentos; PASS estructural |
| Consumo del tarball instalado | API, CLI y sesión FALP PASS; sin dependencias de ejecución |

El [resumen del oráculo](planner-oracle-summary.json) fija los módulos comprobados. Estas cantidades describen controles distintos; no se suman como si fueran tareas independientes del router. Las pruebas específicas de esta integración son:

- `tests/falp.test.mjs`: 18 contratos del host y recibos; incluye una sesión `18014398509481987 → 9007199254740994 → 0`, estados inconclusos sin resultados inventados, replay y revocaciones.
- `tests/falp-boundaries.test.mjs`: tres regresiones aportadas por la revisión independiente; respuestas inconclusas fuera de turno, capacidad exacta de 512 observaciones con replay a presupuesto cero y costos de 128 dígitos con presupuesto una unidad menor.
- `tests/anchor-differential.test.mjs`: 168 permutaciones contra dos modelos esperados escritos por separado, correlaciones entre respuestas, 24 sesiones completas con JSON y 48 avances; conserva CRLF, NFC/NFD, emoji, NUL y el límite de longitud del ancla.
- `tests/router-pilot.test.mjs`: verifica las salidas guardadas del piloto y vuelve a llamar a la API actual para los ocho casos.
- `scripts/verify-package.mjs`: instala un tarball y usa exports públicos para un encargo directo y una sesión de dos observaciones con saldo `5 → 3 → 0`, replay sin nuevo cobro y cierre `reassess`.

Los 18 tests de la frontera se comprobaron también con una [mutación que reemplazó ambas funciones por `undefined`](undefined-api-mutation.log): fallaron los 18. Se corrigieron dos negativos del primer intento que podían pasar por un `TypeError` incidental. Esto prueba que esos tests requieren la API; no es una campaña completa de mutation testing.

## Piloto de prompts

Ocho encargos sintéticos fueron etiquetados antes de generar las salidas. Dos agentes en contextos nuevos recibieron la skill instalada y los mismos inputs. El baseline usó sólo las instrucciones; el asistido construyó solicitudes explícitas y ejecutó ocho llamadas reales a `routeFalp`, dos con planificación numérica. Ninguno ejecutó las tareas destinatarias ni convirtió escenarios hipotéticos en observaciones.

El [resultado mecánico](pilot/mechanical-results.json) comprueba 8/8 casos en cada variante: rutas, control siguiente, exploración exigida, anclas exactas, siete frases protegidas y ausencia de preguntas innecesarias. Conserva hashes de inputs, expectativas, salidas y módulos. Ambas variantes pasan: este piloto no muestra superioridad del motor sobre el baseline.

La [revisión semántica](semantic-review.md) examina intención, alcance, permisos, separación redactor/receptor y dependencias; no se sustituye por coincidencias de texto. La [revisión de código](code-review.md) cubre la frontera y sus dependencias con un revisor distinto del implementador. Son revisiones de agentes sobre un filesystem compartido, sin acreditar evaluación ciega, diversidad de familias ni aprobación humana.

La revisión semántica encontró 0 Blocker, 0 Major y un Nit condicional en el prompt asistido de delegación: pide preservar cadenas, pero no explicita sus delimitadores. No hubo pérdida observada de un literal ni una delegación simulada. Se conserva la salida original; el contrato de integración recuerda al host copiar literalmente las cadenas protegidas con delimitadores explícitos. No se declara que este recordatorio haya sido evaluado en una nueva generación. La revisión de código cerró su única observación documental tras incorporar el módulo FALP al mapa y la arquitectura.

En los tres checkpoints `observe` o `explore`, el campo `prompt` contiene sólo contenido invariante y `notes` explica los pendientes. No son entregas finales. El consumidor debe conservar el envoltorio y obedecer `next`; extraer y enviar `prompt` solo pierde ese control. Las otras cinco salidas tuvieron readback textual por su redactor; no se ejecutaron en el agente destinatario.

Los inputs declaran de forma explícita la suficiencia, naturaleza de la incógnita y modelos. El piloto comprueba compatibilidad sobre esas declaraciones, no capacidad de descubrirlas a partir de encargos ambiguos. El caso `exploratory_one_read` depende del marco del piloto para interpretarse como redacción de prompt: su petición aislada pide explorar una estrategia. No demuestra activación correcta de la skill fuera de ese marco. No hay mediciones de tokens, costo de proveedor, calidad estadística, latencia de extremo a extremo o resultados productivos.

## Reproducir

Desde la raíz, con herramientas y checker preparados según [Operación](../../agent/RUNTIME.md):

```sh
npm run build
node --test tests/falp.test.mjs tests/falp-boundaries.test.mjs tests/anchor-differential.test.mjs tests/router-pilot.test.mjs
node scripts/verify-router-pilot.mjs
npm run check
```

El replay ejecuta el motor sobre solicitudes guardadas; no regenera las respuestas LLM. [requests.json](pilot/assisted/requests.json) conserva los juicios del host y [engine-results.json](pilot/assisted/engine-results.json) las llamadas originales. El script original se archiva como [texto de evidencia](pilot/assisted/original-run-engine.txt), con las rutas del entorno donde se ejecutó. El replay es el comando portable para este checkout.

## Criterio para llevarlo al router

La frontera es candidata para conectar un host que suministre estado vigente, preserve el despacho confiado, obedezca `next` y haga readback. La exactitud depende del universo y costos declarados. Una cadena intacta no acredita fidelidad semántica; el motor tampoco autentica emisores ni coordina estados concurrentes.

Para probar uso real del plugin falta conectar sus llamadas al paquete y ejecutar encargos representativos con sus herramientas y permisos de destino. Ese paso debe conservar la comparación por tarea, evidencia y costos completos, incluidos intentos externos inconclusos. Esta campaña no declara ese despliegue ejecutado ni aprobación automática de su resultado.
