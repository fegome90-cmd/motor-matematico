# Composición y límites

## Intención

El núcleo calcula sobre datos explícitos; el adaptador CLI maneja archivos y procesos. El host es dueño del estado persistente y de la ejecución externa. La decisión de programación dinámica frente a horizonte fijo está en [diseño](../design.md).

## Componentes

| Componente | Responsabilidad | Dependencias |
|---|---|---|
| [core.ts](../../src/core.ts) | Contrato canónico y diagnóstico de un paso | JavaScript estándar |
| [planner.ts](../../src/planner.ts) | Búsqueda minimax, límites, memo y certificado | `validate` del núcleo |
| [session.ts](../../src/session.ts) | Registrar un recibo, descontar una vez, devolver estado nuevo | `validate` y `plan` |
| [anchor.ts](../../src/anchor.ts) | Compilar briefs, conservar ancla y clasificar la política | `validate`, `plan` y `advance` |
| [index.ts](../../src/index.ts) | Exportaciones públicas | Los módulos de biblioteca |
| [CLI](../../cli.mjs) | Parsear JSON, limitar bytes, imprimir y definir códigos de salida | API pública y archivos de Node |

## Flujos y estado

La llamada a `plan` valida y filtra evidencia. Comprueba conflicto, gate, cobertura y suficiencia antes de buscar. La búsqueda produce un DAG completo o una razón explícita sin plan. El host ejecuta la primera acción autorizada, obtiene un recibo y llama `advance` para producir el siguiente estado. [API](../api.md) posee ese contrato, incluida la responsabilidad del host ante concurrencia.

Las máscaras de mundos, costos `BigInt` y memo sólo existen durante una llamada. No hay caché global, red, base de datos ni secretos del producto. Los objetos públicos serializados usan cadenas y números acotados.

## Invariantes y evolución

Mantener exactitud de costos, evidencia por intersección, ausencia de certeza con cobertura incompleta y ninguna recomendación tras una búsqueda limitada. La política publicada debe resolver todas sus ramas dentro del presupuesto. Los contratos e invariantes están en [diseño](../design.md) y [API](../api.md), y las autoridades en [gobierno](../../GOVERNANCE.md).

## Comprobación y riesgos

El oráculo Python enumera estados y acciones pendientes de forma independiente. El verificador de certificados recorre cada mundo compatible y compara respuestas, acciones y costos. Las pruebas de sesión comprueban recibos y presupuesto; las de CLI y paquete comprueban el consumo público. [Operación](RUNTIME.md) reúne comandos y [evidencia](../evidence/README.md) registra resultados.

La búsqueda es exponencial en el peor caso y puede abstenerse por límites. Un modelo incompleto marcado erróneamente como completo sigue siendo un error del host que la aritmética exacta no puede detectar.
