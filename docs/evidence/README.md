# Evidencia del MVP 0.2.0

**Resultado local: apto para usar como biblioteca y CLI sobre modelos finitos explícitos.** La exactitud y optimalidad son condicionales al modelo y a la terminación de la búsqueda. No se evaluó extracción de prompts ni ejecución de proveedores LLM.

## Verificación integrada

El comando `AGENT_DOCS_KIT_PATH=/ruta/al/kit npm run check` terminó con código 0. El [log completo](validation.log) conserva la ejecución en Node 24.22.3 y Python 3.12.14. Los resultados corresponden al build cuyos hashes figuran en [el resumen del oráculo](planner-oracle-summary.json).

| Control | Resultado |
|---|---|
| Lint y formato con reglas activas de Biome | PASS, 17 archivos |
| Tipos y compilación TypeScript 5.9.3 | PASS |
| Pruebas de núcleo, planner, sesión y CLI | 71/71 PASS |
| Oráculo histórico de diagnóstico | 4.352/4.352 PASS |
| Oráculo independiente de planificación | 18.750/18.750 PASS |
| Políticas verificadas completamente | 5.837 |
| Recorridos de mundos compatibles | 24.228 |
| Pasos de acción autorizados comprobados | 19.454 |
| Casos con costos mayores que 2^53 | 17 exactos |
| Autocomprobación del oráculo y del verificador | 45 óptimos manuales y 16 certificados corruptos rechazados |
| Checker de cinco documentos agent-docs-kit | PASS estructural |
| Tarball instalado en un proyecto temporal | API y CLI devuelven costo exacto 6 |

El oráculo utiliza otra representación, mundos más acciones pendientes, y enteros arbitrarios de Python. Sus 18.750 casos incluyen 16.384 combinaciones exhaustivas pequeñas, 1.200 casos aleatorios con semilla fija, 1.000 casos históricos, 61 regresiones, 24 comprobaciones de capacidad/precedencia y 81 entradas malformadas. Un caso malformado pasa si el motor lo rechaza con el error esperado.

El fixture de paridad de tres señales resuelve los 16 mundos mediante tres observaciones de costo 2, sin ruido. La sesión completa termina con presupuesto 0. Los reintentos con varias fuentes, resultados fuera del modelo, la continuidad del CLI con límites personalizados y la capacidad para registrar toda la política tienen regresiones específicas.

## Rendimiento medido

[benchmark.json](benchmark.json) contiene las muestras crudas y el entorno. Se ejecutaron cinco bloques por escenario/política, con orden alternado, calentamiento excluido y resultados comprobados fuera del reloj. La ventana de API incluye parseo JSON, llamada real y serialización. Hubo 1.185 llamadas medidas y cero fallos; 395 corresponden al planificador y 790 a diagnósticos antes/después. Los estados de límite se registran aparte de soluciones.

| Escenario | Mundos / acciones | Resultado | Muestras | p50 ms | p95 ms | Rango de medianas de bloque ms |
|---|---:|---|---:|---:|---:|---:|
| parity1 | 2 / 1 | planned | 150 | 0.022 | 0.047 | 0.021–0.026 |
| parity3_noise | 16 / 4 | planned | 100 | 0.151 | 0.339 | 0.137–0.276 |
| parity6 | 64 / 6 | planned | 25 | 1.219 | 2.675 | 1.174–1.749 |
| parity7 | 128 / 7 | planned | 15 | 7.712 | 11.746 | 5.974–9.187 |
| state_limit | 128 / 7 | limit_exceeded | 50 | 0.991 | 1.441 | 0.814–1.064 |
| capacity256 | 256 / 8 | limit_exceeded | 50 | 1.482 | 2.577 | 1.446–1.590 |
| capacity4096 | 4096 / 128 | limit_exceeded | 5 | 565.628 | 613.036 | 492.584–613.036 |

La mediana del CLI completo, incluida la creación del proceso, fue 87.02 ms en paridad3, con cinco ejecuciones y rango 69.98–106.79 ms. Es una medición local; cinco muestras no permiten una afirmación robusta de p99.

El escenario de 4.096 mundos contiene 64 decisiones, 128 acciones y 9.641.792 bytes JSON. El planificador lo valida y luego informa MAX_WORLDS; no lo resuelve. El tiempo medido incluye parseo, recorrido sin búsqueda y serialización, sin aislar la validación. El reloj cooperativo maxMillis empieza después de validar y no es un plazo duro de toda la operación.

### Diagnóstico antes y después

Para `evaluate`, que mantiene el mismo resultado de un paso, la campaña intercalada midió 2032.69 ms → 662.87 ms de p50 en el escenario de 4.096 mundos, cinco muestras por versión. Los rangos de medianas fueron 1869.70–2069.11 ms y 587.22–743.11 ms. En modelos pequeños la validación más estricta puede compensar o superar la ganancia de caché; no se afirma una mejora universal.

La comparación de diagnóstico exige igualdad completa de salida en cada muestra contra una referencia precalculada por escenario. No vuelve a ejecutar una versión entre muestras para generar la referencia. No compara `plan` con `evaluate` como si hicieran el mismo trabajo: la búsqueda completa resuelve sinergias y verifica un costo de peor caso, mientras el diagnóstico elige un paso.

### Limitador y condiciones

El perfil se tomó antes del arreglo exclusivo del CLI; los cuatro módulos del núcleo y el harness mantienen los mismos hashes. El [perfil separado](profile-summary.json) localiza firmas repetidas en la versión original y funciones mapping, fields y object de validación en el núcleo actual. La copia de [perfil V8 comprimida](paired.cpuprofile.gz) permite contrastarlo. Los milisegundos muestreados del perfil no se usan como latencias del benchmark.

El contenedor mostró 9 CPUs disponibles y carga de un minuto 0.48; el trabajo de cada llamada es de un solo hilo. El máximo RSS de toda la campaña compartida fue 685.104 KiB. Incluye fixtures, ambas versiones, serialización y GC; no mide el pico por política ni establece un presupuesto de memoria de producción. No hubo E/S de red dentro de las ventanas de API.

## Revisiones y trazabilidad

La ejecución previa a la corrección de capacidad se conserva en [log histórico](history/validation-before-ledger.log) y [resumen histórico](history/oracle-before-ledger.json). La campaña de 69 pruebas anterior al arreglo de E/S tiene [su propio log](history/validation-before-io.log). El log vigente contiene 71 pruebas y las regresiones de tuberías cerradas; no se confunden estas revisiones.

La [revisión EGM y su resolución](goldfish_review_report.md) usa personas de Google con agentes nuevos. Terminó en cinco rondas por el límite del ciclo, sin dos rondas limpias consecutivas; el último defecto del CLI se corrigió y comprobó fuera del ciclo. Contexto conversacional nuevo no significa filesystem aislado. No se declara pstack FULL_EVAL, certificación Google, ejecución de Gemini ni aprobación humana. El [registro de decisiones](decisions.tsv) conserva elecciones y evidencia.

La [revisión de comentarios y supresiones](comment-review.md) no encontró cambios esenciales. La [auditoría de trazabilidad](trail_review.md) contrastó hashes, estadísticas y procedencia con un revisor separado; sus límites y los controles pendientes al emitir el dictamen están explícitos.

La [verificación independiente del arreglo de E/S](cli-fix-review.md) cubrió 12 casos POSIX y las ocho pruebas del CLI. El cierre es específico del defecto de salida, sin alterar el resultado formal del ciclo EGM.

## Reproducción

Desde el repositorio, después de preparar herramientas y checker según [Operación](../agent/RUNTIME.md):

```sh
npm run check
npm run bench -- --output .audit/local/benchmark.json
git show b1b3180c4b3e6b4d659e648e2c45ba327c7b83bd:dist/core.js > .audit/local/baseline-core.mjs
node scripts/benchmark.mjs --baseline .audit/local/baseline-core.mjs --output .audit/local/paired.json
python3 -B tests/planner-oracle.py --output .audit/local/planner-oracle-full.json
```

La salida completa del oráculo puede regenerarse; este repositorio conserva su resumen con hashes y los corpus/scripts que la producen. La medición perfilada se reproduce con el comando de profile-summary.json. La campaña anterior al arreglo del CLI se conserva en [benchmark histórico](history/benchmark-before-io.json); las cifras de esta página corresponden a la repetición posterior.

La publicación se realizó mediante la conexión de GitHub porque el cliente Git local no tenía credenciales HTTPS. Los cinco árboles publicados coinciden exactamente con los árboles locales verificados. El [mapa de commits](publish-map.json) conserva la correspondencia: los metadatos de publicación cambiaron los IDs de commit, sin alterar archivos ni modos. Las referencias históricas del registro a `b8df8ba` identifican el commit local; su equivalente publicado es `b1b3180`.

## CI y alcance pendiente

GitHub ejecutó y aprobó la matriz Node 22/24 para el commit de producto `4c671f01d2a7a1c88f9c14733fa5bbf35b2ff04a`, tanto en [push](https://github.com/fegome90-cmd/motor-matematico/actions/runs/45999962754) como en [PR](https://github.com/fegome90-cmd/motor-matematico/actions/runs/45999969623). Pasaron el gate integrado, la correspondencia de dist, la demo y el benchmark acotado de Node24. El [registro de CI](ci.json) conserva estados, pasos y tiempos observados. Los commits posteriores de evidencia tienen sus propios [checks del PR](https://github.com/fegome90-cmd/motor-matematico/pull/2/checks).

Quedan fuera de esta aceptación la calidad semántica de prompts, mediciones de tokens, servicios externos, un adaptador Code Dope y un corpus real de tareas. El motor depende de costos y resultados deterministas declarados; no modela variación de costos, ruido probabilístico ni efectos externos de las acciones.
