# Planificación exacta y acotada del motor FALP

## Problema y resultado esperado

El prototipo v0.1.0 evalúa suficiencia de evidencia y elige una observación de un paso. El ensayo posterior agregó una búsqueda de dos pasos. Esa búsqueda falla ante tres señales complementarias: puede gastar en ruido y perder la posibilidad de resolver dentro del presupuesto. El fixture `examples/parity3.json` reproduce el caso con tres señales de costo 2, ruido de costo 1 y presupuesto 6.

El MVP devuelve una política completa, con una rama por resultado posible, que minimiza el costo del peor caso dentro del modelo. Si la búsqueda no termina dentro de sus límites, devuelve un estado explícito sin acción recomendada. La biblioteca y el CLI no ejecutan las acciones del modelo.

## Dos formas consideradas

Una extensión de la heurística de dos pasos podría aumentar el horizonte o continuar con una acción barata. Tendría menor trabajo por llamada en algunos modelos, pero conservaría casos donde un horizonte insuficiente pierde una solución y donde una acción aparentemente barata agota el presupuesto.

La alternativa elegida es programación dinámica sobre subconjuntos de mundos compatibles, con memoización y límites explícitos. Permite probar la optimalidad en los modelos para los cuales termina y declarar incertidumbre computacional cuando no termina. El costo de búsqueda puede crecer exponencialmente. Las cotas de trabajo forman parte de la API, no de una promesa de resolver cualquier tamaño.

## Modelo y condiciones

Cada mundo asigna una respuesta a todas las decisiones. Cada acción tiene un resultado determinista en cada mundo y un costo entero positivo. Las observaciones previas filtran mundos mediante intersección. Una firma conjunta es la tupla de respuestas a todas las decisiones en orden canónico.

La suficiencia requiere un conjunto compatible no vacío, cobertura declarada `complete` y una única firma conjunta. Para emitir una respuesta utilizable el gate global también debe ser `allowed`. El código comprueba estas condiciones sobre la entrada. No demuestra que una lista de mundos producida por una persona o un modelo de lenguaje cubra la realidad.

La implementación aplica el concepto de suficiencia por fibras usado en el prototipo FALP. La programación dinámica es una decisión de ingeniería añadida en esta versión. No se presenta como una demostración formal de toda la teoría matemática del usuario.

## Recurrencia

Sea S el subconjunto compatible y A el conjunto fijo de acciones disponibles, autorizadas e individualmente asequibles con el presupuesto inicial de esta llamada. Para cada acción a, S(a,o) contiene los mundos de S que producen el resultado o.

La función V(S) vale cero si todos los mundos de S tienen la misma firma. En otro caso evalúa las acciones que dividen S en al menos dos grupos no vacíos:

```text
V(S) = min_a [ costo(a) + max_o V(S(a,o)) ]
```

Una acción es candidata sólo si todas sus ramas tienen solución. Si no hay ninguna política cuyo costo quepa en el presupuesto, el resultado es `infeasible` con razón `NO_POLICY_WITHIN_BUDGET`. Esto no afirma que el problema sea irresoluble con otro presupuesto o conjunto de acciones.

Los costos positivos y las particiones propias hacen que cada llamada recursiva tenga menos mundos. Una acción ya observada es constante dentro de cada una de sus ramas y no vuelve a ser informativa. Por eso el estado memoizado puede depender sólo de S. El oráculo independiente usa mundos más acciones pendientes y sirve para contrastar esa reducción de estado.

El planificador compara costos con `BigInt`. Los conteos de mundos y de trabajo son enteros seguros acotados. Los tiempos usan el reloj monótono para limitar trabajo, sin participar en la decisión de costos. El empate de costo se resuelve por ID canónico de acción. No usa probabilidades, costos promedio ni flotantes para ordenar políticas.

## Límites y salidas

La validación del modelo precede a la búsqueda. Sus límites máximos son 4.096 mundos, 128 acciones, 64 decisiones, 512 observaciones y 128 dígitos para costos y presupuesto. Después de filtrar evidencia, el planificador aplica los límites de búsqueda que aparecen en [API](api.md).

`maxStates` acota estados visitados; `maxTransitions` acota ramas exploradas; `maxDepth` acota profundidad de búsqueda, no sólo la política seleccionada. `maxMillis` es un límite cooperativo posterior a validación. No es una fecha límite dura para toda la llamada ni para parsear JSON. El CLI además limita cada entrada a 16 MiB. Un host que necesite una fecha límite dura debe aislar la llamada y terminarla desde fuera.

Si la búsqueda se interrumpe por una cota, el resultado es `limit_exceeded`, con `recommendedAction`, `policy` y `worstCaseCost` en `null`. No se publica el mejor candidato parcial. Así el host nunca confunde una búsqueda interrumpida con una prueba de inviabilidad o una política óptima.

Una vez calculado el óptimo dentro del presupuesto, se comprueba su máximo número de acciones contra los espacios libres del registro de 512 observaciones canónicas. Si no cabe completo, se devuelve `limit_exceeded / MAX_OBSERVATIONS` sin primera acción. No se cambia el objetivo de minimax ni se busca una alternativa más cara con menos pasos. Esa abstención no prueba inviabilidad de otras políticas.

La política se serializa como un grafo acíclico de nodos de decisión y hojas de respuestas. Los nodos de decisión identifican la acción y las ramas; las hojas tienen la firma determinada. El certificado sólo contiene nodos alcanzables de la política elegida. El costo máximo de recorrerlo debe coincidir con `worstCaseCost`.

## Propiedad del estado y frontera del host

`validate` crea una entrada canónica. `plan` y `evaluate` son funciones sin efectos de E/S. `advance` recibe una observación de la acción actualmente recomendada, descuenta su costo y devuelve una entrada nueva. Repetir exactamente el recibo existente es idempotente; reemplazar un recibo de la misma acción produce error. Un resultado fuera del soporte modelado se conserva, descuenta el costo de la acción declarado en el modelo y conduce a `conflict` en la siguiente planificación.

`advance` no ejecuta herramientas, no autentica la fuente y no ofrece transacciones concurrentes. El host conserva el estado, comprueba permisos actuales justo antes de ejecutar, autentica resultados, impide duplicar ejecuciones y resuelve cambios concurrentes. Si cambian disponibilidad, costos o permisos, el host actualiza el modelo y vuelve a planificar.

## Compatibilidad y adopción

`validate` y `evaluate` conservan el contrato de v0.1.0; `evaluate` continúa siendo un diagnóstico de un paso. La entrada finita sigue usando las mismas claves. La API principal añade `plan` y `advance`. El CLI usa subcomandos explícitos y sustituye la llamada antigua `node cli.mjs archivo.json` por `node cli.mjs evaluate archivo.json`. El MVP se versiona como 0.2.0 para hacer visible ese cambio.

La configuración TypeScript y el flujo de proyecto se adaptan de Kit Fundador. La documentación para agentes usa los cinco roles de agent-docs-kit. La Constitución se incorpora mediante referencia fija y gobierno local. [Bases](foundations.md) registra archivos y revisiones. El motor no requiere servidor, base de datos ni proveedor de LLM.

## Aceptación y evidencia

La aceptación requiere conservar la regresión histórica, resolver la paridad de tres señales con costo máximo 6 sin ruido, concordar con el oráculo independiente en los corpus ejecutados y verificar cada rama de las políticas. También requiere pruebas de gates, presupuesto, enteros grandes, entradas inválidas, límites de búsqueda, CLI y paquete instalado desde un tarball local.

La campaña de rendimiento mide parseo, planificación y serialización con resultados comprobados, cinco bloques por escenario y perfil separado. Registra estados limitados y errores, sin mezclar una abstención rápida con una solución. El presupuesto de observaciones y la latencia de CPU son métricas distintas.

El [registro de evidencia](evidence/README.md) contiene comandos, resultados y revisión EGM. Los corpus son sintéticos. La calidad de extracción de prompts, las llamadas a modelos, los tokens, el rendimiento remoto y la integración Code Dope quedan fuera de esta aceptación. La entrega permite consumir el motor desde código o CLI; no autoriza acciones externas mediante la sola lectura de su salida.
