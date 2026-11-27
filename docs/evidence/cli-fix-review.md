# Verificación independiente del arreglo de salida CLI

Revisor nativo: `/root/cli_fix_review`. Leyó el contrato pstack, CLI, tests del CLI, API, manifiesto y documentos operativos. No editó archivos ni ejecutó build. Trabajó con Linux y Node v24.22.3, usando la distribución existente.

## Resultado

Sin hallazgos materiales en el arreglo. `node --test tests/cli.test.mjs` terminó con código0 y 8/8 pruebas. Una comprobación independiente mediante Python `os.pipe`/`subprocess.run`, cerrando el lector antes de iniciar Node, pasó 12/12 casos sin usar el helper de la suite.

| Caso | Código y resultado |
|---|---|
| Plan normal | 0, JSON de política y stderr vacío |
| Uso inválido normal | 2, JSON INVALID_INPUT |
| Archivo inexistente normal | 3, JSON IO_ERROR |
| stdout cerrado en plan, help, validate y evaluate | 3, JSON IO_ERROR con write EPIPE |
| stderr cerrado ante uso inválido o archivo inexistente | 3, diagnóstico no disponible |
| Ambos canales cerrados durante plan | 3 |
| Plan exitoso con stderr cerrado | 0, JSON de política |
| Uso inválido con sólo stdout cerrado | 2, JSON INVALID_INPUT |

El CLI previo del índice, ejecutado en memoria, reprodujo código1 en los fallos de stdout y stderr. El arreglo instala el listener antes de escribir, lo conserva ante error del callback para atender el evento posterior y lo retira al completar con éxito. Los resultados y help esperan la escritura; el diagnóstico tiene su propio manejo de error.

## Identidad revisada

| Archivo | Git blob |
|---|---|
| cli.mjs | `5208511df7c7e98dbd99d6553171aa38194c181c` |
| tests/cli.test.mjs | `cf4f6c23c1b4e60ddb6ca7b95a6234776db3fe46` |
| docs/api.md | `5de32c131924dc81400c820143789c39b1e9823c` |

La [reproducción del coordinador](cli-output-errors.json) conserva además las salidas de cuatro variantes antes y después, con SHA-256 del CLI. El informe independiente es un resumen del resultado devuelto por el agente, no un export de su transcript ni de sus scripts ad hoc.

## Límites

No se probaron otras plataformas ni desconexiones tardías tras una entrega parcial. La finalización de write no demuestra recepción por el consumidor. La suite completa y CI se acreditan por sus propios registros. Este cierre no cambia el estado del ciclo EGM ni constituye aprobación humana.
