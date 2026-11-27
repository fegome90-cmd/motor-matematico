# Preparación, ejecución y verificación

## Requisitos

La ejecución necesita Node >=22.18.0. La campaña local usa Node 24.22.3; CI declara Node 22 y 24. No se necesitan credenciales, servidor, red ni dependencias npm para ejecutar `dist` y el CLI desde el checkout.

El desarrollo usa npm y las versiones exactas de TypeScript y Biome en [package.json](../../package.json) y el lockfile `package-lock.json` del repositorio. Los oráculos y el checker documental requieren Python >=3.11. La campaña local usa Python 3.12.14. Python no forma parte del runtime de la biblioteca.

## Preparar

Desde la raíz del repositorio, instalar las herramientas con `npm ci` y generar distribución con `npm run build`. Para el checker documental, preparar una copia exacta de la base:

```sh
git clone https://github.com/fegome90-cmd/agent-docs-kit.git .tools/agent-docs-kit
git -C .tools/agent-docs-kit checkout --detach c1efd7bed2c2e74f47a7ce41a893839cfcdc6f57
```

Si ya existe esa carpeta, inspeccionar su revisión y estado antes de cambiarla. También se admite `AGENT_DOCS_KIT_PATH=/ruta/al/checkout`, que debe apuntar a la revisión indicada sin cambios versionados. El checker no instala dependencias ni actualiza el kit.

## Comandos

Todos se ejecutan en la raíz. Los scripts npm están definidos en el manifiesto. [Evidencia](../evidence/README.md) distingue resultados locales de CI y métodos pendientes.

| Acción | Comando | Alcance |
|---|---|---|
| Ejemplo completo | `npm run demo` | Paridad de tres señales, simulación de un mundo |
| Planificar | `node cli.mjs plan examples/parity3.json` | Política exacta de costo máximo 6 |
| Lint y formato | `npm run lint` | TS, JS y configuraciones seleccionadas |
| Comprobar tipos | `npm run typecheck` | Núcleo TypeScript |
| Compilar | `npm run build` | `src` a `dist` y declaraciones |
| Tests | `npm test` | Núcleo, planificación, sesión y CLI |
| Oráculo histórico | `npm run test:oracle` | Diagnóstico original vs Python |
| Oráculo de planificación | `npm run test:planner-oracle` | Minimax y certificados completos |
| Documentos | `npm run check:docs` | Cinco documentos, estructura y enlaces simples |
| Paquete | `npm run verify:package` | Empaquetado e instalación en directorio temporal |
| Todos los gates | `npm run check` | Secuencia completa de los controles anteriores |
| Rendimiento | `npm run bench` | Escenarios acotados, conteos y latencias |

CI ejecuta `git diff --exit-code -- dist` después de compilar y rechaza archivos sin seguimiento bajo `dist`. Así detecta distribución versionada obsoleta y módulos generados que falten en el commit. La prueba del tarball crea sólo un directorio temporal propio y lo elimina al terminar. No publica en npm.

## Procesos y diagnóstico

El CLI es un proceso local que termina al producir su resultado. El [contrato CLI](../api.md) define códigos 0, 2 y 3. Un estado `limit_exceeded` puede ser válido aunque el comando termine con 0. Comprobar `status` y `reason`, además del código del proceso.

No hay proceso en segundo plano ni observabilidad remota. Los resultados del plan incluyen estadísticas; las evidencias de ejecución viven en [evidencia](../evidence/README.md). El tiempo cooperativo del planificador excluye validación y no sustituye un supervisor externo para plazos duros.
