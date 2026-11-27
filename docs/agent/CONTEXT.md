# Propósito y conceptos

## Propósito y actores

Felipe desarrolla este motor para mejorar la decisión de qué evidencia pedir en un router FALP. La entrega actual es una biblioteca y CLI que reciben un modelo finito explícito. El host define ese modelo, autoriza acciones y aporta observaciones. El motor devuelve suficiencia, una política de observación o un motivo explícito para detenerse. La [API](../api.md) define las capacidades vigentes.

## Conceptos

| Término | Significado | Distinción necesaria |
|---|---|---|
| Mundo | Asignación de respuestas y resultados modelados | No implica una hipótesis validada sobre la realidad |
| Firma conjunta | Tupla de respuestas de todas las decisiones | Conserva correlaciones entre decisiones |
| Suficiencia | Una sola firma en un conjunto compatible no vacío | Requiere cobertura completa declarada |
| Política | Árbol de decisiones representado como DAG | Considera cada resultado posible modelado |
| Costo minimax | Mayor costo entre ramas, minimizado sobre políticas | No es costo promedio ni probabilidad |
| Límite de búsqueda | Cota de trabajo computacional | No es prueba de inviabilidad |

## Alcance y límites

El MVP valida, diagnostica, planifica y registra resultados. La planificación usa costos enteros exactos. No extrae mundos desde lenguaje natural, no ejecuta herramientas y no certifica permisos. El [diseño](../design.md) explica los supuestos matemáticos y el contraejemplo que motiva la búsqueda completa.

## Entorno del producto

El consumidor puede ser otro módulo Node o un proceso que intercambia JSON por CLI. La aplicación anfitriona conserva estado y verifica autoridad. Las [bases adoptadas](../foundations.md) permiten continuar el trabajo en este repositorio. Los resultados sintéticos no representan una validación semántica de un router LLM.

## Evidencia

Ver [API](../api.md), [diseño](../design.md) y [resultados ejecutados](../evidence/README.md). La integración con Prompts con Ancla, modelos y Code Dope requiere un trabajo posterior con datos y contratos reales.
