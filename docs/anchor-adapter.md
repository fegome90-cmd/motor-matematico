# Adaptador de Prompts con Ancla (candidato)

## Responsabilidad

El adaptador recibe un brief estructurado después de fijar el ancla. No interpreta texto libre ni autoriza acciones. Conserva el ancla como una cadena opaca, incluidos espacios exteriores, saltos de línea y caracteres Unicode. El host conserva la autoridad sobre esa cadena, cobertura, permisos, autenticación de resultados y ejecución. La comparación literal no acredita fidelidad semántica del prompt generado ni detecta que el host haya sustituido el estado completo.

Se compararon dos diseños. El primero infiere preguntas, mundos y permisos del texto; se difiere porque puede confundir restricciones protegidas con decisiones abiertas. El elegido recibe preguntas y escenarios conjuntos declarados por el host. Transpone las columnas de comprobaciones al formato del motor. No expande un producto cartesiano ni rellena datos ausentes. No cambia la función minimax ni introduce un proveedor LLM.

## API

`compileAnchor(raw: unknown): AnchorState` acepta un objeto JSON ordinario con exactamente estas claves:

| Campo | Contrato |
|---|---|
| anchor | Texto no vacío, máximo 32.768 unidades UTF-16, sin normalización |
| coverage, gate, costUnit, remainingBudget, observations | Mismo contrato del motor |
| questions | Decisiones abiertas con ID y dominio. Excluir decisiones protegidas por el ancla |
| probes | Acciones de observación con id, capability, permission, available, cost, sin outcomes |
| scenarios | Filas con id, answers por pregunta y outcomes por probe |

Cada fila debe incluir un resultado por probe, aunque el probe no esté disponible o autorizado. Las filas representan hipótesis de trabajo, no hechos. Los dominios, IDs, costos y observaciones se validan con el núcleo. El adaptador rechaza campos inesperados, ausencias y accesores en las estructuras que transpone. No es un sandbox para objetos ejecutables, proxies ni entradas de tamaño arbitrario: el host debe limitar los bytes antes de parsear JSON. La salida es `{anchor, model}`, con `model` canónico del motor.

`routeAnchor(state, options?)` llama a `plan` y devuelve `{anchor, route, plan}`. La ruta se refiere a las observaciones del modelo, no a la autorización de entregar el prompt:

| Ruta | Estado y condición |
|---|---|
| direct | solved |
| focused | planned y todas las ramas de la primera acción terminan en hoja |
| exploratory | planned y al menos una rama requiere observaciones adicionales |
| abstain | blocked, incomplete, conflict, infeasible o limit_exceeded |

`advanceAnchor(state, observation, options?)` usa `advance`, sin ejecutar herramientas. Devuelve otro estado con el mismo texto del ancla. Conserva costos exactos, restricciones, idempotencia del recibo y límites del motor. El host revalida permisos, usa las mismas opciones para continuar y no modifica el ancla durante la sesión. Una revisión autorizada del ancla requiere reconstruir el brief; no es una observación.

## Probar

El [ejemplo de auditoría](../examples/anchor-routing.json) es sintético, inspirado en tareas de revisión de PR. Los dos hechos abiertos son el entorno y la localización del contrato, no el objetivo ni el permiso de escritura. Con presupuesto 5, la política consulta inspect_host y locate_contract; el ruido no aporta información. No es evidencia de clasificación semántica sobre prompts reales.

Desde el checkout compilado:

```sh
node --input-type=module -e "import {readFileSync} from 'node:fs'; import {compileAnchor,routeAnchor} from './dist/index.js'; const b=JSON.parse(readFileSync('examples/anchor-routing.json','utf8')); console.log(routeAnchor(compileAnchor(b)))"
node --test tests/anchor.test.mjs
```

La siguiente etapa necesita un corpus autorizado de tareas reales, etiquetas de decisiones materiales y costos medidos, además de comparar contra el router actual sin sustituirlo. No se ha integrado el plugin de Prompts con Ancla ni se ha medido ahorro de tokens.
