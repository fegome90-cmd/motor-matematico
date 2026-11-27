# Base de trabajo GitHub reutilizada de Code Dope

Fecha de inspección: 27-11-2026. Alcance: reglas de colaboración, ramas, PR y CI.
Este cambio no incorpora un nuevo motor ni decide cuál prototipo matemático es
la implementación de referencia. Las verificaciones de gobernanza y las de
producto se mantienen identificadas como evidencia diferente.

## 1. Fuentes fijadas y hallazgos

| Fuente | Revisión inspeccionada | Uso |
| --- | --- | --- |
| Code Dope `developer` | `0bd8cbc8ed278ad93ac7f5d69c0ccc4cf932b71a` | Reglas, plantilla, escáner y validador documental |
| Code Dope `main` | `f7ae6fcbb630b6c981510d95b17f3c79517328ca` | Contrastar bootstrap y automatizaciones |
| Code Dope `tester` | `ab09eee621de379b5059376f47f3f7a61e30ae63` | Identificar divergencia de las ramas permanentes |
| Motor Matemático `main` inicial | `009b00f3bb656bb6e4d32bbe8f852a2b54b305e9` | Base del PR; solo README |

Fuentes primarias consultadas:

- [CONTRIBUTING de Code Dope](https://github.com/fegome90-cmd/code-dope/blob/0bd8cbc8ed278ad93ac7f5d69c0ccc4cf932b71a/CONTRIBUTING.md).
- [AGENTS de Code Dope](https://github.com/fegome90-cmd/code-dope/blob/0bd8cbc8ed278ad93ac7f5d69c0ccc4cf932b71a/AGENTS.md).
- [CI de la biblioteca](https://github.com/fegome90-cmd/code-dope/blob/0bd8cbc8ed278ad93ac7f5d69c0ccc4cf932b71a/.github/workflows/ci.yml).
- [Package de developer: npm](https://github.com/fegome90-cmd/code-dope/blob/0bd8cbc8ed278ad93ac7f5d69c0ccc4cf932b71a/package.json).
- [Package de main: pnpm](https://github.com/fegome90-cmd/code-dope/blob/f7ae6fcbb630b6c981510d95b17f3c79517328ca/package.json).
- [Automatización de README de main](https://github.com/fegome90-cmd/code-dope/blob/f7ae6fcbb630b6c981510d95b17f3c79517328ca/.github/workflows/update-readme.yml).
- [Ruleset real 28158227](https://github.com/fegome90-cmd/code-dope/rules/28158227) y [API de detalle](https://api.github.com/repos/fegome90-cmd/code-dope/rulesets/28158227).

`main` y `developer` no describen el mismo arranque. En `main` el paquete 0.0.0
usa pnpm 11.25.0; `developer` usa npm 11.19.1, package-lock y pruebas reales de
la biblioteca 0.1.0. Copiar todo `main` reintroduciría un segundo bootstrap.
Copiar todos los componentes de `developer` importaría requisitos de QuickJS,
workers y MCP ajenos a este motor. La adopción se hace por mecanismo y SHA.

## 2. Qué está realmente impuesto en Code Dope

El ruleset inspeccionado está activo para `developer`, `tester` y la rama
predeterminada. No tiene actores de bypass. Impide borrar y hacer force-push;
exige PR, resolución de conversaciones, base actualizada y tres checks de
GitHub Actions: `package`, `Secrets and private paths`,
`Documentation links and references`.

Dos garantías requieren distinguir regla escrita de ejecución automática:

1. La cantidad de reviews aprobatorias obligatorias es **cero**. La autorización
   de Felipe para merge es una regla operativa explícita, no una segunda revisión
   impuesta automáticamente por ese ruleset.
2. El ruleset no restringe la rama de origen. La ruta
   `trabajo → developer → tester → main` está escrita en CONTRIBUTING.
   Este PR añade un control de metadatos de PR para verificarla.

El workflow incluye el evento `edited` para volver a validar un PR cuando cambia
su base; una ejecución previa contra otro destino no constituye evidencia de la
nueva ruta. La revisión independiente detectó esta omisión antes de publicar el PR.

La API de motor-matematico inicialmente mostró solo `main`, `protected: false`,
rulesets vacíos y ningún PR. La lectura de protección clásica no fue accesible
mediante la integración; por ello la comprobación se basa en las ramas y rulesets,
sin afirmar haber leído una configuración administrativa no disponible.

## 3. Matriz de reutilización

| Pieza | Decisión y motivo |
| --- | --- |
| Flujo de tres ramas y PR en borrador | Adoptado, con rutas de promoción verificadas |
| Plantilla PR y evidencia por SHA | Adaptada a contratos, oráculos, benchmarks y coordinación |
| Escaneo exacto del índice y pruebas | Copiado; cambia únicamente el prefijo de temporales |
| Escaneo de historial y Gitleaks | Copiado; misma versión 8.30.1 y checksum de origen |
| Validador UTF-8/enlaces locales | Copiado sin cambios |
| Policy de Gitleaks | Copiada; cambia únicamente el título |
| Permisos mínimos de CI | Adoptados: contents read y checkout sin credenciales persistentes |
| Acciones de GitHub | Fijadas a SHA resuelto de v4 durante esta inspección |
| Control del origen/destino del PR | Implementación nueva acotada, con pruebas adversarias |
| Reglas de agentes y seguridad | Adaptadas a suficiencia, exactitud, cobertura y backends |
| `check:dist` y consumidor del tarball | Requisito de integración del MVP según empaquetado elegido |
| Workflows y dependencias QuickJS/MCP | No corresponden a la gobernanza de este motor |
| README automático | Excluido: requiere token, force-push y PR directo a main |
| Toolchain pnpm de bootstrap | Excluido: evita una segunda instalación y lockfile |
| Permisos/publicación/licencia del motor | No se heredan de Code Dope |

El [manifiesto de procedencia](upstream-manifest.json) registra blobs de origen,
adaptaciones y SHA-256 de las copias. La [licencia MIT](../../licenses/code-dope-MIT.txt)
se conserva para esas piezas. El workflow no instala un runtime matemático,
no publica paquetes ni despliega plugins.

## 4. Secuencia para comenzar sin duplicar trabajo

1. Conservar el commit inicial y verificar de nuevo ramas/PR antes de escribir.
2. Crear `developer` y `tester` en ese mismo SHA si siguen ausentes, sin mover main.
3. Abrir `chore/github-governance → developer` como PR de base de trabajo.
   Esta rama no contiene src, dist, package, README central ni corpus del motor.
4. El MVP en curso (`feat/mvp-exact-planner`) conserva su rama y archivos.
   Después de integrar la gobernanza, incorporar su base actualizada sin reemplazar
   el núcleo por otro prototipo ni decidir la paridad de backends por conteo de tests.
5. Integrar el MVP con su CI real y su check estable `package`. Registrar contratos,
   invariantes, costes y límites de ambos prototipos antes de unificarlos.
6. Promover únicamente mediante `developer → tester → main`, con pruebas sobre
   cada candidato y autorización explícita de Felipe para cada merge.

La existencia del otro worktree se comprobó en modo lectura. No se editó, no se
cambió su branch y no se ejecutó su código como parte de esta auditoría.
Las cifras históricas no se transfieren como resultados del nuevo repositorio.

## 5. Activación de protecciones: pendiente y separada del contenido

La [plantilla](../../.github/rulesets/protected-branches.json) usa
`enforcement: disabled`: es una configuración revisable, no un estado aplicado.
En particular, **este PR no activa por sí mismo protecciones en GitHub**.

Después de una ejecución real satisfactoria de los tres checks de gobernanza:

- El mantenedor importa la plantilla y activa el ruleset, sin bypass.
- Verifica por API los nombres exactos de checks, la identidad de GitHub Actions
  (integration_id 15368), ramas incluidas, PR, conversaciones y base actualizada.
- Mantiene desactivado auto-merge. Usa squash para trabajo y merge commit para
  promociones; la plantilla admite ambos y excluye rebase como método de PR.
- Antes de promover código del motor añade `package` como check obligatorio,
  después de verlo ejecutarse realmente. No exigir ahora un check inexistente
  ni crear un job vacío para aparentar que el producto fue probado.
- Conserva registro de antes/después y lectura posterior del ruleset. Si el
  conector no permite modificar settings, efectuar esa operación desde la UI
  autorizada o con un administrador; no atribuir enforcement a archivos locales.

La revisión independiente y la autorización de merge siguen siendo necesarias:
el workflow es código del repositorio y un PR también podría modificarlo. Estos
controles no equivalen a una frontera inmutable contra su propio autor.

## 6. Contrato de evidencia para el motor

El futuro check de producto debe separar:

- Aritmética exacta, sin pérdida al transportar racionales o BigInt.
- Suficiencia lógica y preservación de firmas conjuntas/correlaciones.
- Política de selección y planificación: óptimo demostrado versus heurística.
- Fidelidad semántica y cobertura del problema representado.
- Compatibilidad Node/QuickJS/WASM y coste de arranque de cada backend.

Una estrategia adaptativa con buenos promedios no se promueve si conserva un
contraejemplo material sin tratar. El informe histórico de eficiencia reportó
NO-GO de integración y el caso adversario de paridad de tres bits; ese caso debe
preservarse al importar el corpus. Su SHA-256 documental es
`38efb31c6de3c4a52280a514913f72a186a75e7a0e9cbe0114ecd9b57d0513ec`.
El ahorro reportado allí es sintético y no se usa como gate de aceptación de este PR.

## 7. Límites de esta entrega

La base reduce diferencias de workflow y protege la trazabilidad del trabajo.
No valida el motor, no certifica una prueba Lean, no garantiza cobertura de un
extractor LLM y no integra Z3. Sus resultados verificables son los controles
de gobernanza y sus ejecuciones sobre el commit del PR.
