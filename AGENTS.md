# Entrada para agentes

Motor matemático FALP, una biblioteca TypeScript y un CLI para planificar observaciones sobre un modelo finito. Estas instrucciones aplican a este repositorio.

## Autoridades

La solicitud vigente del responsable define el trabajo autorizado. [GOVERNANCE.md](GOVERNANCE.md) registra la adopción local de la Constitución Agéntica y las autoridades. [El contrato de API](docs/api.md) es la referencia de comportamiento público. [La decisión de diseño](docs/design.md) explica el algoritmo y sus límites. No atribuir aprobación humana a un test, un agente o un documento generado.

## Lectura por intención

| Para | Leer |
|---|---|
| Entender propósito y términos | [Contexto](docs/agent/CONTEXT.md) |
| Revisar responsabilidades e invariantes | [Arquitectura](docs/agent/ARCHITECTURE.md) |
| Localizar código y pruebas afectadas | [Mapa](docs/agent/CODEMAP.md) |
| Preparar, ejecutar y verificar | [Operación](docs/agent/RUNTIME.md) |
| Revisar procedencia y adopción de kits | [Bases](docs/foundations.md) |

## Reglas críticas

Los costos públicos son cadenas de enteros decimales. Su aritmética usa `BigInt`. La exactitud se refiere al modelo recibido, cuya cobertura y autoridad debe establecer el host. El núcleo no ejecuta herramientas ni convierte texto libre en permisos. Un límite de búsqueda produce `limit_exceeded`, nunca una prueba de inviabilidad. Estos contratos pertenecen a [API](docs/api.md) y [diseño](docs/design.md).

Mantener código, declaraciones generadas y documentación coherentes en el mismo cambio. Las pruebas y los resultados medidos se registran con su comando, entorno y limitaciones. No extrapolar un corpus sintético a calidad semántica o ahorro de tokens. Las decisiones de publicación y permisos pertenecen a [gobierno](GOVERNANCE.md).

## Evidencia

Entrada adaptada de las plantillas de agent-docs-kit, con fuentes fijadas en [bases](docs/foundations.md). El registro de esta implementación está en [evidencia](docs/evidence/README.md).
