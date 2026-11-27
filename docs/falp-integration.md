# Frontera FALP para el host

Esta frontera permite usar el planificador en el router de Prompts con Ancla sin confundir la clasificación de una tarea con la cantidad de observaciones necesarias. Es una API de biblioteca: no instala ni modifica el plugin, no clasifica texto libre y no ejecuta herramientas.

El host declara si el brief está listo o si existe una investigación focalizada o exploratoria. El motor conserva esa declaración y calcula una política de observación sólo cuando hay un modelo. El controlador debe obedecer **`next`**; el campo `route` describe la clasificación semántica y por sí solo no habilita ninguna acción ni la entrega del prompt.

## Entrada del router

```ts
type HostContext = {
  taskId: string;
  revision: string;
  anchor: string;
  gate: 'allowed' | 'unknown' | 'denied';
};

type FalpRequest =
  | {
      kind: 'ready';
      context: HostContext;
      explorationRequested: boolean;
    }
  | {
      kind: 'investigation';
      context: HostContext;
      classification: 'focused' | 'exploratory';
      explorationRequested: boolean;
      state: AnchorState;
    };
```

`routeFalp(raw: unknown, options?: PlanOptions): FalpRouting` valida la entrada y devuelve una copia canónica sin mutar el objeto suministrado. Las dos variantes tienen exactamente los campos mostrados. `context` admite únicamente sus cuatro campos, y `state` únicamente `anchor` y `model`.

`taskId` y `revision` son IDs canónicos con el mismo patrón y límite de 256 caracteres del núcleo. `revision` identifica la revisión declarada por el host; no es un contador incrementado por esta biblioteca. `anchor` conserva literalmente hasta 32.768 unidades UTF-16, incluidos espacios exteriores, CRLF y formas Unicode distintas. No puede ser texto vacío ni sólo espacios. En una investigación, `state.anchor` debe ser idéntica a `context.anchor`.

La variante `ready` expresa la evaluación semántica del host: no tiene preguntas pendientes modeladas. No requiere inventar un mundo o una pregunta para satisfacer el contrato del núcleo. La variante `investigation` requiere un `AnchorState` válido, normalmente producido por `compileAnchor`. Un modelo con cero preguntas sigue siendo inválido; para un brief listo se usa `ready`.

El host asigna `focused` cuando existe una brecha concreta material y `exploratory` cuando se necesita explorar el encuadre. Esa clasificación no se infiere de la longitud del árbol. Por ejemplo, una pregunta concreta puede requerir dos observaciones; una tarea exploratoria puede resolverse con una sola observación dentro de un modelo declarado. Ninguno de esos casos cambia la clasificación aportada por el host.

## Salida y control operativo

La salida tiene `{context, route, observationRoute, next, explorationRequired, reason, plan}`. `route` es `direct` para `ready` y conserva `classification` para una investigación, incluso si el control operativo queda bloqueado. `observationRoute` usa las rutas del [adaptador de anclas](anchor-adapter.md) y sólo describe la profundidad de la política de observación.

| Entrada y estado actual | `route` | `next` | `plan` |
|---|---|---|---|
| `ready`, gate permitido y sin exploración solicitada | `direct` | `readback` | `null` |
| `ready`, gate permitido y exploración explícita | `direct` | `explore` | `null` |
| Cualquier variante con gate del host desconocido o denegado | Clasificación conservada | `blocked` | `null` |
| Investigación con política `planned` | `classification` | `observe` | Política del motor |
| Investigación con modelo `solved` | `classification` | `reassess` | Hoja resuelta del motor |
| Investigación `blocked`, `incomplete`, `conflict`, `infeasible` o `limit_exceeded` | `classification` | `blocked` | Resultado sin política, costo ni acción |

`readback` pasa a la siguiente etapa de preparación del prompt; no equivale a aprobación. `explore` activa el módulo FALP pedido explícitamente y pide al host preparar la exploración. `observe` permite al host considerar la recomendación bajo sus propios permisos actuales. `reassess` exige volver a evaluar el brief y el ancla antes de decidir cómo continuar: una firma única en el modelo no prueba que el encargo real esté listo.

`explorationRequired` es verdadero para una investigación y para una solicitud explícita de exploración, también cuando existe un bloqueo. Es descriptivo: no reemplaza `next`. El gate del contexto se comprueba antes de planificar; sus motivos son `HOST_GATE_DENIED` y `HOST_GATE_UNKNOWN`. El gate del modelo conserva sus propios motivos `GATE_DENIED` y `GATE_UNKNOWN`. Un gate permitido del host no anula el gate local.

Para `ready`, los motivos son `BRIEF_SUFFICIENT` o `EXPLORATION_REQUESTED`. Las investigaciones conservan el motivo exacto del planificador. Las opciones y límites se pasan a éste sólo cuando hace falta planificar. Una entrada `ready` o bloqueada por el gate del host no ejecuta ni valida opciones de búsqueda que no usa.

## Recibos vinculados al despacho del host

```ts
acceptFalpReceipt(
  request: unknown,
  dispatch: unknown,
  receipt: unknown,
  options?: PlanOptions,
): FalpReceiptResult
```

El `dispatch` es una declaración confiada del host, conservada cuando decide qué observación pedir. Contiene exactamente `{taskId, questionId, revision, anchor, action}`. No se debe reconstruir tomando los valores del recibo recibido. `questionId` identifica una pregunta existente en `state.model.decisions`; el despacho del host vincula esa pregunta con la acción. El motor no deduce esa relación a partir del nombre de la acción ni de texto libre.

Un recibo tiene esos mismos cinco campos y una de estas formas:

```ts
type ReceiptDetails =
  | { status: 'SUPPORTED'; outcome: string; source: string }
  | { status: 'UNKNOWN' | 'CONFLICT' | 'BLOCKED'; source: string };
```

`SUPPORTED` significa que el host está aportando un resultado que decidió tratar como observado. No significa que el motor haya autenticado su fuente. Sólo esta variante admite `outcome`, un ID canónico. Las otras tres lo prohíben para impedir convertir incertidumbre o bloqueo en una observación ficticia. `source` es procedencia declarada no vacía, sin espacios exteriores y de hasta 256 caracteres.

La función compara primero `dispatch.taskId`, `dispatch.revision` y `dispatch.anchor` con el contexto actual suministrado. Después exige igualdad literal entre los cinco campos del recibo y del despacho, y comprueba que la pregunta y la acción existan en el modelo. Un recibo y un despacho que coincidan entre sí, pero pertenezcan a otra tarea o revisión del contexto, se rechazan.

Antes de registrar evidencia se revalidan el gate del host, el gate del modelo, el permiso y la disponibilidad actuales de la acción. La evidencia nueva debe corresponder a la acción recomendada al volver a planificar. Pasar el contexto anterior a una revocación no permite detectar esa revocación: el host debe suministrar su estado vigente y coordinar su almacenamiento.

La salida contiene `{status, reason, request, receipt}`:

| `status` de salida | Efecto sobre el modelo y presupuesto |
|---|---|
| `ACCEPTED` | Registra el resultado `SUPPORTED` y descuenta una vez el costo entero de la acción |
| `DUPLICATE` | Conserva el estado canónico y el presupuesto; el mismo triple acción/resultado/fuente ya estaba registrado y el contexto suministrado coincide |
| `UNKNOWN` | Conserva estado y presupuesto; devuelve el recibo inconcluso |
| `CONFLICT` | Conserva estado y presupuesto; devuelve el reporte de evidencia contradictoria sin escoger un resultado |
| `BLOCKED` | Conserva estado y presupuesto; devuelve el bloqueo reportado o la revocación detectada |

Los motivos `SUPPORTED`, `DUPLICATE_RECEIPT`, `UNKNOWN`, `CONFLICT` y `BLOCKED` distinguen los primeros casos. Una revocación usa `HOST_GATE_DENIED`, `HOST_GATE_UNKNOWN`, `GATE_DENIED`, `GATE_UNKNOWN`, `ACTION_DENIED`, `ACTION_PERMISSION_UNKNOWN` o `ACTION_UNAVAILABLE`. El recibo original sigue en `receipt`, por lo que su estado no se pierde si prevalece una revocación local.

Los recibos inconclusos también deben coincidir con la acción planificada vigente. No se agregan al registro matemático y el host debe contabilizar aparte cualquier costo de una consulta externa fallida. El presupuesto del motor describe acciones con resultado modelado aceptado, no el gasto operativo total de los intentos externos.

Un replay exacto puede devolver `DUPLICATE` aunque la acción ya no sea la recomendada, porque no aporta evidencia nueva ni vuelve a descontar costo. Los gates, el permiso y la disponibilidad se revisan antes de ese reconocimiento; una revocación devuelve `BLOCKED` incluso en un replay, sin alterar la evidencia ya registrada. Otro resultado o fuente para una acción ya observada produce `TypeError` y requiere reconciliación explícita del host.

Un `SUPPORTED` cuyo resultado esté fuera del soporte modelado se registra y cobra como una observación real. La siguiente llamada a `routeFalp` devuelve `blocked / CONFLICT` con cobertura completa. Esto es distinto de un recibo con `status: 'CONFLICT'`, que no afirma un resultado y deja intacto el modelo.

Entradas mal formadas, identidades incompatibles, preguntas o acciones inexistentes, evidencia nueva no recomendada y ausencia de una política vigente producen `TypeError`, sin devolver un estado actualizado. Esta frontera no convierte un límite o bloqueo del planificador en una acción de respaldo.

## Ejemplo ejecutable desde el checkout compilado

El siguiente recorrido usa el fixture sintético; `native` es un resultado fijado para la prueba, no una consulta real del entorno.

```js
import { readFileSync } from 'node:fs';
import { compileAnchor, routeFalp, acceptFalpReceipt } from './dist/index.js';

const brief = JSON.parse(readFileSync('examples/anchor-routing.json', 'utf8'));
let request = {
  kind: 'investigation',
  context: {
    taskId: 'audit-17', revision: 'rev-1', anchor: brief.anchor, gate: 'allowed',
  },
  classification: 'focused',
  explorationRequested: false,
  state: compileAnchor(brief),
};
const routed = routeFalp(request);
if (routed.next !== 'observe') throw new Error(routed.reason);
const dispatch = {
  taskId: request.context.taskId,
  revision: request.context.revision,
  anchor: request.context.anchor,
  questionId: 'runtime',
  action: routed.plan.recommendedAction,
};
const accepted = acceptFalpReceipt(request, dispatch, {
  ...dispatch, status: 'SUPPORTED', outcome: 'native', source: 'synthetic-fixture',
});
if (accepted.status !== 'ACCEPTED') throw new Error(accepted.reason);
request = accepted.request;
console.log(routeFalp(request));
```

Al principio la ruta FALP es `focused`, la ruta de observación es `exploratory` y el costo de peor caso es `"5"`. Después del recibo el presupuesto queda en `"3"` y la siguiente acción es `locate_contract`. Tras resolver ambas preguntas, `next` es `reassess`. El host decide cómo reconstruir un brief listo y realizar el readback.

## Límites de la frontera y verificación

Los argumentos públicos de entrada se tratan como `unknown`. Se rechazan claves inesperadas y propiedades accesoras sin ejecutar sus getters; las estructuras del modelo se validan con el núcleo. Se preservan costos como cadenas de enteros, sin convertirlos a `number`.

El host sigue siendo responsable de limitar los bytes antes de parsear JSON, declarar un modelo que cubra el problema, clasificar la tarea, autorizar y ejecutar observaciones, autenticar al emisor, conservar el despacho confiado, aportar la revisión vigente y coordinar actualizaciones concurrentes. La validación no es un sandbox para proxies u objetos ejecutables. La comparación de cadenas no verifica la fidelidad semántica del ancla ni detecta una sustitución coordinada de todo el contexto y estado. No se promete revisión global vigente ni ejecución externa exactamente una vez.

Al delegar, el host debe transportar las cadenas protegidas de forma literal con delimitadores explícitos. Pedir genéricamente que el receptor preserve campos no reemplaza esa copia. Antes de emitir el prompt, el readback debe comparar las obligaciones y literales con el encargo original. Los controles `next` y el estado de los pendientes deben acompañar cualquier borrador interno; enviar sólo su texto puede perder un bloqueo o una exploración pendiente.

`tests/falp.test.mjs` cubre controles operativos, separación semántica, bloqueos del planificador, recibos cruzados o vencidos frente al contexto, revocaciones, estados inconclusos, replay, anclas exactas y una sesión con costos mayores que la precisión entera de `number`. `scripts/verify-package.mjs` repite un recorrido desde el tarball instalado y desde sus exports públicos. Estas pruebas de contrato no miden calidad semántica sobre tareas reales, ahorro de tokens ni costo de proveedores externos.
