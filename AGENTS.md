# Motor Matemático · instrucciones de trabajo

Este repositorio concentra el núcleo matemático y sus backends. El MVP aporta una biblioteca TypeScript y un CLI para planificar observaciones sobre un modelo finito. Antes de editar,
lee [CONTRIBUTING.md](CONTRIBUTING.md), [la adopción de reglas](docs/github/reuse-audit.md)
y los PR y ramas actuales. Las fuentes históricas y los prototipos son evidencia;
no constituyen implementaciones aprobadas por su sola existencia.

## Alcance y colaboración

- Trabaja desde el SHA vigente en una rama propia dirigida a `developer`.
  Usa otro clon o worktree si hay cambios de otro agente; no cambies su índice,
  archivos, rama ni pruebas. Consulta PR abiertos antes de crear una implementación.
- Conserva un único contrato matemático y corpus compartido. Los backends ligero
  y simbólico deben consumir ese contrato; evita mantener dos routers equivalentes.
- La gobernanza, el MVP, los adaptadores FALP y la integración de Z3 tienen alcances separados. No conviertas este repositorio en un runtime de Code Mode.
- Reutiliza código con revisión fijada y atribución. No heredes excepciones,
  autorizaciones ni estados de publicación de Code Dope u otro repositorio.

## Evidencia y exactitud

- Separa corrección aritmética, corrección de la decisión, fidelidad de la
  representación y rendimiento del runtime. Un test sintético no valida las cuatro.
- La autorización, el catálogo y la cobertura proceden de una autoridad externa al
  extractor. `UNKNOWN`, timeout, inconsistencia o agotamiento no son certeza.
- Conserva las correlaciones y comprueba no vacuidad antes de declarar suficiencia.
  Los costes exactos no pasan por coma flotante ni por conversiones JSON con pérdida.
- Un cambio de comportamiento incluye casos positivos, negativos, fallos parciales
  y un oráculo independiente cuando se afirme exactitud. No debilites una regresión
  para obtener verde; conserva contraejemplos de estrategias anteriores, incluida
  paridad de tres bits cuando se importe el corpus adaptativo.
- Los benchmarks deben declarar unidad, semilla, corpus, denominador y fallos.
  No presentar ahorro sintético como tokens, dinero o tiempo real.
- Registra SHA evaluado, comando, entorno y resultado. Distingue PASS, FAIL y
  NO EJECUTADO; la concordancia de dos resultados vacíos no demuestra corrección.

## Flujo de desarrollo

- Sigue la ruta y los gates de [CONTRIBUTING.md](CONTRIBUTING.md).
  CI verde no autoriza merge, publicación ni cambios administrativos.
- El núcleo usa un único flujo npm con lockfile y versiones fijadas.
  No importes el bootstrap pnpm obsoleto de Code Dope.
- Si se versiona `dist/`, debe generarse desde las fuentes en el mismo cambio y
  verificarse la deriva. El MVP debe mantener ese gate y probar su paquete aislado.
- No activar servicios, recopilar telemetría externa, instalar hooks globales ni
  escribir en otros repositorios como efecto lateral de trabajar aquí.
- Usa datos sintéticos y temporales en un directorio de `os.tmpdir()` creado para
  la tarea. Aplica [SECURITY.md](SECURITY.md) y revisa el diff completo antes de subir.

Estas reglas adaptan las de Code Dope a este dominio; su procedencia y límites se
documentan en [el informe de reutilización](docs/github/reuse-audit.md).

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

## Contratos del MVP

Los costos públicos son cadenas de enteros decimales. Su aritmética usa `BigInt`. La exactitud se refiere al modelo recibido, cuya cobertura y autoridad debe establecer el host. El núcleo no ejecuta herramientas ni convierte texto libre en permisos. Un límite de búsqueda produce `limit_exceeded`, nunca una prueba de inviabilidad. Estos contratos pertenecen a [API](docs/api.md) y [diseño](docs/design.md).

Mantener código, declaraciones generadas y documentación coherentes en el mismo cambio. Las pruebas y los resultados medidos se registran con su comando, entorno y limitaciones. No extrapolar un corpus sintético a calidad semántica o ahorro de tokens. Las decisiones de publicación y permisos pertenecen a [gobierno](GOVERNANCE.md).

## Evidencia

Entrada adaptada de las plantillas de agent-docs-kit, con fuentes fijadas en [bases](docs/foundations.md). El registro de esta implementación está en [evidencia](docs/evidence/README.md).
