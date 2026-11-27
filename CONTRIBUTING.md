# Cómo trabajamos en Motor Matemático

## Ramas, PR y promoción

| Destino | Origen permitido | Propósito |
| --- | --- | --- |
| `developer` | Rama de trabajo distinta de `main`, `developer` y `tester` | Integración; puede provenir de un fork |
| `tester` | `developer` del mismo repositorio | Verificación del candidato integrado |
| `main` | `tester` del mismo repositorio | Versión estable autorizada por Felipe |

Una rama por cambio coherente (`feat/`, `fix/`, `chore/`, `docs/` o equivalente).
Parte de la base actual, conserva el trabajo ajeno y evita push directo, force-push
y eliminación de las ramas permanentes. Los agentes usan clones o worktrees propios.

Abre el PR en borrador mientras falten verificaciones o revisión. Para integrar
ramas de trabajo se prefiere squash. Para promociones entre ramas permanentes se
usa merge commit, preservando la ascendencia. No activar auto-merge. Felipe
autoriza cada merge sobre un candidato concreto; no reutilizar una autorización
de otro repositorio ni de otro HEAD.

El [control de rutas](scripts/check-pr-route.mjs) comprueba la
tabla en CI. No contiene bypass por nombre del PR, label o variable de entorno.
Es un control de automatización revisable, no sustituye las reglas del servidor:
un cambio del propio workflow o del gate también requiere revisión.

## Verificación de esta base

La gobernanza no necesita instalar dependencias npm. Node 24.22.3 es la versión
fijada para estos jobs; Git y Bash se utilizan en los controles reutilizados.

```sh
git diff --check
node --test scripts/check-pr-route.test.mjs scripts/scan-staged-secrets.test.mjs
node scripts/check-docs.mjs
bash scripts/check-secrets.sh history
```

El control de documentación solo ve archivos versionados o añadidos al índice.
Los controles de secretos requieren Gitleaks 8.30.1; el workflow verifica su
checksum. `history` exige historial completo y analiza el historial alcanzable
desde HEAD con salida redactada. `staged` inspecciona los bytes del índice y usa
la política del HEAD, no una política editada sin commit:

```sh
bash scripts/check-secrets.sh staged
```

En el primer commit de incorporación de `.gitleaks.toml`, `staged` no dispone de
una política previa y debe fallar. Para esa incorporación se comprueba la copia
del candidato con la política revisada y después su historial completo. No se
añade un fallback que confíe en una política arbitraria del worktree.

## Gates del MVP

El PR que incorpore el motor debe añadir un job estable `package` que ejecute el
flujo real del producto: instalación congelada, tipos, pruebas, oráculo,
verificación de build si se versiona y prueba del consumidor aislado. Debe fijar
Node/npm/TypeScript y un solo `package-lock.json`; los comandos definitivos deben
existir y ejecutarse, no ser placeholders.

Antes de promover el MVP a `tester` y luego a `main`, añadir `package` como check
obligatorio en GitHub y confirmar una ejecución real de ese nombre. Los checks de
esta base no demuestran corrección, eficiencia ni compatibilidad del motor.

## Reglas en GitHub y estado real

La [plantilla de ruleset](.github/rulesets/protected-branches.json)
está **desactivada** y solo es una propuesta versionada: copiarla al repositorio
no modifica GitHub. El estado inicial comprobado fue `main` sin protección
indicada por la API, lista de rulesets vacía y ningún PR. Ver detalles y secuencia
de activación en [docs/github/reuse-audit.md](docs/github/reuse-audit.md).

Para activar, el mantenedor debe comprobar los checks reales, importar el ruleset
y cambiar `enforcement` a `active`, sin bypass. No declarar protecciones activas
sin leerlas después desde GitHub. La plantilla conserva el mínimo de cero reviews
aprobatorias de Code Dope: la autorización explícita del mantenedor es una regla
operativa, no una aprobación independiente impuesta por GitHub.

Antes de cada merge: revisar diff y alcance, confirmar CI del SHA vigente y base
actualizada, resolver conversaciones, registrar autorización y usar el método
de merge correspondiente. Ningún resultado verde autoriza publicar un paquete,
desplegar un plugin ni ampliar permisos.

## Licencias y procedencia

Las piezas copiadas de Code Dope conservan su [licencia MIT](licenses/code-dope-MIT.txt)
y revisión de origen en [el manifiesto](docs/github/upstream-manifest.json).
Esa licencia corresponde a las piezas indicadas y no decide automáticamente la
licencia del nuevo motor. Registrar futuras incorporaciones con origen, revisión,
licencia, modificaciones y pruebas.
