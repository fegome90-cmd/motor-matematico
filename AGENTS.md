# Motor Matemático · instrucciones de trabajo

Este repositorio concentra el núcleo matemático y sus backends. Antes de editar,
lee [CONTRIBUTING.md](CONTRIBUTING.md), [la adopción de reglas](docs/github/reuse-audit.md)
y los PR y ramas actuales. Las fuentes históricas y los prototipos son evidencia;
no constituyen implementaciones aprobadas por su sola existencia.

## Alcance y colaboración

- Trabaja desde el SHA vigente en una rama propia dirigida a `developer`.
  Usa otro clon o worktree si hay cambios de otro agente; no cambies su índice,
  archivos, rama ni pruebas. Consulta PR abiertos antes de crear una implementación.
- Conserva un único contrato matemático y corpus compartido. Los backends ligero
  y simbólico deben consumir ese contrato; evita mantener dos routers equivalentes.
- Este primer cambio establece gobernanza. La integración del MVP y de Z3 sigue
  en cambios separados. No conviertas este repositorio en un runtime de Code Mode.
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
- El núcleo utilizará un único flujo npm con lockfile y versiones fijadas cuando
  se integre el MVP. No importes el bootstrap pnpm obsoleto de Code Dope.
  Este PR no añade package.json ni declara pruebas del motor.
- Si se versiona `dist/`, debe generarse desde las fuentes en el mismo cambio y
  verificarse la deriva. El MVP debe incorporar ese gate y probar su paquete aislado.
- No activar servicios, recopilar telemetría externa, instalar hooks globales ni
  escribir en otros repositorios como efecto lateral de trabajar aquí.
- Usa datos sintéticos y temporales en un directorio de `os.tmpdir()` creado para
  la tarea. Aplica [SECURITY.md](SECURITY.md) y revisa el diff completo antes de subir.

Estas reglas adaptan las de Code Dope a este dominio; su procedencia y límites se
documentan en [el informe de reutilización](docs/github/reuse-audit.md).
