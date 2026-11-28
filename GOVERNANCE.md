# Gobierno del motor

Este proyecto adopta la [Constitución de Código Agéntico v1.1](https://github.com/fegome90-cmd/constitucion-ai/blob/cdb626e0960e88e3be1ce4a1755f5441a1dbe251/constitution/AGENTIC-CONSTITUTION.md). La revisión queda fijada a `cdb626e0960e88e3be1ce4a1755f5441a1dbe251`. Las instrucciones del operador y las restricciones de la plataforma siguen gobernando cada sesión.

## Autoridades y alcance

Felipe González, propietario `fegome90-cmd`, es el responsable humano del repositorio y sus decisiones de producto. Los agentes pueden investigar, implementar y verificar dentro del encargo autorizado. En esta entrega el encargo es construir y probar el MVP en `motor-matematico` usando sus kits. Esto no constituye una aprobación humana de cada línea ni una autorización de despliegue.

| Acción | Responsable y regla local |
|---|---|
| Cambiar código, pruebas y documentos dentro del encargo | Agente implementador o mantenedor; cambios verificables en una rama |
| Revisar una propuesta | Persona revisora o agente con evidencia; distinguir ambos tipos de revisión |
| Crear rama, commits y PR del trabajo encargado | Implementador dentro del repositorio indicado por el responsable |
| Integrar a `main`, publicar un paquete o desplegar un servicio | Responsable humano o instrucción explícita vigente que autorice ese efecto |
| Cambiar permisos, secretos, protección de ramas o borrar datos ajenos al trabajo | Autorización humana específica para la acción y su alcance |

El [mapa de roles](_ctx/policy/roles.yaml) documenta la asignación local de Ley XII. Sin rol explícito se aplica `reader`, con lectura y revisión. Preparación, revisión y aprobación son actos separados: el implementador no puede aprobar su propio trabajo ni elevar su rol. Los revisores EGM realizan revisión, no aprobación humana.

`_ctx/policy/`, `GOVERNANCE.md`, `AGENTS.md` y los controles de CI se tratan como ámbitos críticos de gobierno. El encargo actual permite preparar su propuesta de adopción en una rama. Un cambio efectivo de política o permisos requiere aprobación explícita del responsable humano. No se asigna al implementador una facultad general para cambiar políticas por clasificarlas como documentación.

El mapa es descriptivo, no un motor ejecutable de permisos. La autorización real sigue en el host, GitHub y el operador. Esta adopción no modifica protecciones de ramas ni demuestra conformidad automática con toda la Constitución.

## Calidad y reconciliación

Los gates de este proyecto son lint y formato con Biome, tipos y compilación con TypeScript, tests de Node, oráculos Python, checker estructural del kit documental y prueba del paquete instalado. [Operación](docs/agent/RUNTIME.md) contiene los comandos. Las versiones están fijadas en el lockfile. CI ejecuta estos controles con permisos de lectura.

La API es normativa para el comportamiento prometido. Una divergencia con el código requiere resolver la discrepancia y actualizar las pruebas y el documento propietario. No se presenta el código observado como justificación para ignorar un defecto.

## Escalamiento y excepciones

Una aprobación sensible se registra en el PR o issue correspondiente, con identidad del aprobador humano, fecha, acción exacta, ámbito, commit o versión autorizada, condiciones y enlace a la instrucción o revisión que la otorgó. El implementador registra la ejecución y su resultado por separado. Si falta esa autorización, conserva la propuesta y no realiza el efecto sensible. Un texto generado por un agente no reemplaza ese registro.

Si una tarea necesita permisos o efectos fuera del encargo, el implementador deja el resultado concreto para revisión y plantea al responsable la decisión pendiente. Las excepciones a una regla se registran en el PR con alcance, motivo, evidencia, riesgo y aprobación real cuando corresponda. Las instrucciones ya autorizadas no requieren pedir confirmación repetida.

La adopción usa los principios y obligaciones de la Constitución. Sus ejemplos de frameworks, gestores y herramientas no se importan como requisitos adicionales. [Bases](docs/foundations.md) documenta esa selección.
