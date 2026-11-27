# Revisión EGM y resolución

## Procedimiento

Se usan las personas oficiales `codebase_details` e `implementation_readiness` de EGM de Google en la revisión fijada en `docs/foundations.md`. Cada despacho emplea `fork_turns: none`. Los revisores reciben su persona, target completo, estándar local y lista explícita de código y documentación. No reciben el transcript del coordinador. El filesystem es compartido y no hay aislamiento verificado de instrucciones globales: no se declara evaluación ciega ni pstack FULL_EVAL.

Los despachos nativos y reportes de los agentes son evidencia de revisión conversacional separada. Este archivo resume sus informes devueltos; no es un export de trazas completas de herramientas. Las lecturas declaradas por cada revisor se conservan con su resultado. La petición del usuario autoriza continuar pruebas y correcciones hasta el MVP; no se interrumpió para confirmar cada arreglo reversible.

## Ronda 1

Targets completos: `docs/api.md` (114 líneas) y `docs/design.md` (67 líneas). Estándar: `docs/review-standard.md`. Revisores nativos: `/root/egm_api_r1` y `/root/egm_design_r1`, ambos completados, ninguna lectura asignada inaccesible declarada. Revisión estática, sin ejecución de tests por esos revisores.

| ID | Revisor | Severidad original | Hallazgo | Resolución |
|---|---|---|---|---|
| api-1-1 | codebase_details | Blocker | Replay exacto se rechaza cuando hay más de un recibo de una acción, en contra de API | PROPOSE FIX aplicado: buscar triple existente con `some`, tests de múltiples fuentes y contradicción |
| design-1-1 | implementation_readiness | Major | Mismo defecto de idempotencia observado desde el diseño | PROPOSE FIX aplicado junto con api-1-1; no se rebajó la severidad original |
| api-1-2 | codebase_details | Major | CLI plan acepta límites personalizados pero advance no puede reutilizarlos | PROPOSE FIX aplicado: `advance --limits`, prueba con 129 mundos que requiere la opción |
| api-1-3 | codebase_details | Nit | El paquete incluye API pero excluye design.md, que define la garantía | PROPOSE FIX aplicado: documentos y fuentes incluidos en tarball, aserciones del paquete |
| design-1-2 | implementation_readiness | Nit | El diseño dice costo observado aunque se descuenta action.cost del modelo | PROPOSE FIX aplicado: precisión textual |

La ronda 1 no fue limpia. No hubo hallazgos CONTEST, ESCALATE ni DECLINE. Los arreglos no cuentan como hallazgos asentados: una repetición posterior reabre el defecto.

Los revisores también contrastaron favorablemente la recurrencia, aritmética exacta, precedencia, límites cooperativos, DAG y frontera del host. Esas observaciones son estáticas y no reemplazan la campaña de ejecución.

## Ronda 2

Targets completos releídos: API 114 líneas y diseño 67 líneas. Revisores nuevos `/root/egm_api_r2` y `/root/egm_design_r2`, ambos completados y todas las lecturas asignadas declaradas completas. El revisor de diseño no encontró hallazgos. El revisor de API encontró tres Nit y ningún Blocker o Major.

| ID | Severidad original | Hallazgo | Resolución |
|---|---|---|---|
| api-2-1 | Nit | Falta contrato breve de compareRatios | PROPOSE FIX aplicado con firma, argumentos, signos y retorno |
| api-2-2 | Nit | API no menciona Node >=22.18.0 | PROPOSE FIX aplicado junto a ESM |
| api-2-3 | Nit | Fila exit 0 indica status para todos los comandos | PROPOSE FIX aplicado: status sólo para plan; otras formas explícitas |

La ronda 2 es limpia según el criterio EGM: sin Blocker ni Major. Los tres Nit se corrigieron por mejorar el contrato público.

## Ronda 3

Targets completos releídos: API 116 líneas y diseño 67 líneas. Revisores nuevos `/root/egm_api_r3` y `/root/egm_design_r3`, ambos completados, sin lecturas asignadas inaccesibles. API reportó un Major; diseño un Nit. La ronda no es limpia y reinicia el contador de convergencia.

| ID | Severidad original | Hallazgo | Resolución |
|---|---|---|---|
| api-3-1 | Major | Registro con 512 observaciones puede recibir recomendación que advance no podrá registrar | PROPOSE FIX aplicado al producto: medir pasos máximos de la política óptima y comprobar espacio para todos los recibos antes de publicarla; MAX_OBSERVATIONS retiene acción, costo y política |
| design-3-1 | Nit | “Al alcanzar cualquier límite” no distingue cotas inclusivas | PROPOSE FIX aplicado: “Si la búsqueda se interrumpe por una cota” |

La solución de api-3-1 cubre la política completa, no sólo el siguiente recibo. No cambia la minimización de costo ni busca una política más cara para reducir recibos; esa limitación está explícita en la API. Se añadieron regresiones de ledger lleno, ajuste exacto y alternativa más corta/cara.

## Ronda 4

Targets completos releídos: API 118 líneas y diseño 69 líneas. Revisores nuevos `/root/egm_api_r4` y `/root/egm_design_r4`, ambos completados, sin lecturas asignadas inaccesibles. Diseño no encontró hallazgos; API encontró un Nit y ningún Blocker o Major. Ambos contrastaron estáticamente el control completo de recibos, la garantía minimax y la frontera de ejecución del host.

| ID | Severidad original | Hallazgo | Resolución |
|---|---|---|---|
| api-4-1 | Nit | Faltan campos, métricas y motivos del diagnóstico histórico `evaluate` | PROPOSE FIX aplicado: tablas de Result, ActionAssessment, exclusiones y razones; sin cambios del producto |

La ronda 4 es limpia según el criterio EGM. Es la primera ronda limpia posterior a la corrección de capacidad.

## Ronda 5

Targets completos releídos: API 152 líneas y diseño 69 líneas. Revisores nuevos `/root/egm_api_r5` y `/root/egm_design_r5`, ambos completados, sin lecturas inaccesibles. Diseño no encontró hallazgos. API encontró un Major en el adaptador CLI.

| ID | Severidad original | Hallazgo | Resolución |
|---|---|---|---|
| api-5-1 | Major | Un error asíncrono de stdout, como EPIPE, evita el catch y rompe el contrato JSON/salida3 | PROPOSE FIX aplicado: esperar escrituras y escuchar error; si stderr tampoco está disponible, conservar salida3 sin prometer JSON |

El coordinador reprodujo el defecto con una tubería POSIX sin lector: las cuatro variantes terminaban en salida1. Después del arreglo terminan en salida3 y el canal stderr entrega JSON cuando está disponible. Se añadieron dos pruebas de comportamiento, con resultados y help, stderr cerrado y ambos canales cerrados. La [evidencia antes/después](cli-output-errors.json) conserva hashes de ambas versiones del CLI y las salidas observadas.

## Estado del ciclo

El ciclo terminó al alcanzar su máximo de cinco rondas, **sin convergencia formal de dos rondas limpias consecutivas**. La ronda5 no se cuenta como limpia por haber aplicado su corrección. No se rebajaron severidades ni se registraron defectos corregidos como riesgos aceptados.

El encargo vigente autoriza continuar las correcciones y pruebas hasta el MVP. Fuera del ciclo documental, la [revisión independiente del arreglo](cli-fix-review.md) cerró ese defecto: 8/8 pruebas CLI y 12/12 casos POSIX independientes, sin hallazgos materiales. Esa comprobación no se presenta como una sexta ronda ni como convergencia EGM. No quedan hallazgos conocidos sin corrección en este registro. El criterio de uso del producto se apoya en sus contratos, pruebas observadas y límites documentados, sin atribuir aprobación humana.
