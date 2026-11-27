# Contrato de API 0.2.0

La biblioteca es ESM y requiere Node >=22.18.0. El paquete exporta `validate`, `evaluate`, `plan`, `advance`, `compareRatios`, sus tipos, `INPUT_LIMITS` congelados y los límites del planificador desde `dist/index.js`. El subpath `@fegome90/motor-matematico/diagnostics` expone sólo el núcleo histórico. Las declaraciones TypeScript están en `dist/*.d.ts`.

## Entrada finita

`validate(raw: unknown): Input` valida, copia y ordena el modelo. La entrada tiene exactamente estas claves:

| Campo | Contrato |
|---|---|
| `coverage` | `complete` o `incomplete`, afirmado por el host |
| `gate` | `allowed`, `unknown` o `denied`, afirmado por el host |
| `costUnit` | ID de la unidad común de todos los costos |
| `remainingBudget` | Cadena decimal canónica de entero no negativo |
| `decisions` | De 1 a 64 objetos `{id, domain}`; dominio no vacío de hasta 128 IDs |
| `worlds` | Hasta 4.096 objetos `{id, answers}`; una respuesta del dominio por decisión |
| `actions` | Hasta 128 objetos `{id, capability, permission, available, cost, outcomes}` |
| `observations` | Hasta 512 objetos `{action, outcome, source}` |

Cada acción define un resultado por cada mundo. `permission` tiene los valores del gate, `available` es booleano y `cost` es un entero decimal estrictamente positivo. No hay costos negativos, cero, fracciones, notación exponencial ni coerción desde `number`. Los costos y presupuesto admiten hasta 128 dígitos. Para fracciones de unidad, el host elige una escala entera común antes de construir el modelo.

Los IDs cumplen `[a-zA-Z0-9][a-zA-Z0-9_.:-]*` y tienen hasta 256 caracteres. `source` es una cadena no vacía, de hasta 256 caracteres y sin espacios exteriores. Los IDs son únicos dentro de cada colección. Las claves extra, respuestas ausentes, dominios inválidos y objetos incompatibles con el contrato JSON producen `TypeError`.

Una observación puede traer un resultado fuera del soporte modelado. El motor conserva esa evidencia y el conjunto compatible queda vacío. La evidencia repetida con el mismo triple se deduplica; los resultados contradictorios se conservan. `source` es procedencia declarada, no una firma autenticada.

## Planificación

`plan(raw: unknown, options?: PlanOptions): PlanResult` devuelve un objeto JSON sin `BigInt` público. La [recurrencia y supuestos](design.md) definen su garantía.

| `status` | Significado | Política y costo |
|---|---|---|
| `solved` | Firma única con cobertura completa y gate permitido | Una hoja, costo `"0"`, sin acción |
| `planned` | Política óptima de peor caso que cabe en el presupuesto | DAG completo, costo decimal y primera acción |
| `infeasible` | No existe una política admisible dentro del presupuesto del modelo | Los tres campos en `null` |
| `blocked` | Gate global desconocido o denegado | Los tres campos en `null` |
| `conflict` | Cobertura completa con cero mundos compatibles | Los tres campos en `null` |
| `incomplete` | Cobertura incompleta, sin autorización para concluir suficiencia | Los tres campos en `null` |
| `limit_exceeded` | Una cota de búsqueda o registro impide publicar la política | Los tres campos en `null` |

Los tres campos son `policy`, `worstCaseCost` y `recommendedAction`. La precedencia es conflicto completo vacío, gate, cobertura incompleta, suficiencia, límites de capacidad y búsqueda. Esto permite devolver `solved` sin buscar incluso si el universo original es grande.

`reason` identifica el motivo preciso. Entre ellos figuran `SUFFICIENT`, `OPTIMAL_POLICY`, `NO_POLICY_WITHIN_BUDGET`, `GATE_DENIED`, `GATE_UNKNOWN`, `INCOMPLETE_COVERAGE`, `CONFLICT` y cada límite de la tabla siguiente. La salida incluye `coverage`, `gate`, `costUnit`, `remainingBudget`, `limits` efectivos y `statistics` del trabajo realizado.

### Límites de búsqueda

Todos los límites son enteros seguros. Se rechazan opciones desconocidas, valores fuera de rango y valores no enteros. `maxDepth` admite cero; los demás admiten al menos uno.

| Opción | Valor por defecto | Techo admitido | Razón al detenerse |
|---|---:|---:|---|
| `maxWorlds` | 128 | 512 | `MAX_WORLDS` |
| `maxActions` | 32 | 64 | `MAX_ACTIONS` |
| `maxStates` | 20.000 | 200.000 | `MAX_STATES` |
| `maxTransitions` | 500.000 | 2.000.000 | `MAX_TRANSITIONS` |
| `maxDepth` | 32 | 64 | `MAX_DEPTH` |
| `maxMillis` | 1.000 | 10.000 | `MAX_MILLIS` |

`maxWorlds` cuenta mundos compatibles después de observar. `maxActions` cuenta acciones permitidas, disponibles e individualmente asequibles, incluidas las constantes. El algoritmo descarta las constantes al buscar. `maxDepth` mide profundidad de exploración, que puede superar la profundidad del plan elegido. `maxMillis` usa comprobaciones cooperativas después de validar; no limita de forma dura la validación ni la latencia total.

Además de esas opciones, la capacidad fija es `INPUT_LIMITS.observations = 512` recibos canónicos. Después de encontrar la política óptima que cabe en el presupuesto, el motor comprueba que el camino con más acciones quepa en los espacios de observación restantes. Si no cabe, devuelve `limit_exceeded / MAX_OBSERVATIONS`, sin recomendación, costo ni política. Esta comprobación no busca otra política más corta y más cara. No prueba que todas las políticas desborden el registro. Los resultados `solved` no necesitan espacio nuevo.

### Certificado

`policy` tiene la forma `{root, nodes}`. `root` identifica un nodo en la lista. Un nodo es uno de estos tipos:

```ts
type PolicyNode =
  | { id: string; type: 'leaf'; answers: Record<string, string> }
  | {
      id: string;
      type: 'decision';
      action: string;
      branches: { outcome: string; child: string }[];
    };
```

El DAG contiene sólo nodos alcanzables. Las ramas modeladas son no vacías. Todas las rutas terminan en una hoja que coincide con todos los mundos de esa rama. El máximo costo de una ruta es `worstCaseCost`. Esa cifra es condicional al modelo de resultados deterministas y costos fijos. No estima latencia ni costo monetario salvo que el host defina así `costUnit`.

### Estadísticas

`worlds` y `actions` cuentan elementos de entrada. `compatibleWorlds`, `signatures` y `admissibleActions` describen el estado filtrado. `states`, `cacheHits`, `transitions` y `maxDepth` describen la búsqueda. `policyNodes` cuenta los nodos publicados. Las estadísticas son diagnósticas; no conceden permisos ni demuestran cobertura externa.

## Registrar una observación

`advance(raw: unknown, observation: unknown, options?: PlanOptions): Input` devuelve un modelo nuevo. La observación es `{action, outcome, source}` y debe pertenecer a la primera acción del plan actual. La función vuelve a planificar con las opciones recibidas antes de aceptar una observación nueva.

Una observación nueva descuenta exactamente el costo de la acción. Una política publicada por `plan` cabe completa en los espacios de observación del estado suministrado; si el host añade evidencia por otra vía, debe volver a planificar antes de ejecutar. Un resultado desconocido se registra y conduce a conflicto en la siguiente llamada. Repetir exactamente un recibo ya registrado devuelve el mismo estado canónico sin descontar de nuevo. Una observación diferente de una acción ya registrada produce `TypeError`; para rectificar evidencia el host reconstruye y valida el modelo explícitamente.

La idempotencia sólo se aplica al estado pasado a la función. No impide dos ejecuciones externas concurrentes. El host debe conservar el estado actualizado, revalidar permisos y disponibilidad antes de ejecutar, autenticar el resultado y controlar concurrencia. Esta biblioteca no ejecuta ni autentica herramientas.

## Diagnóstico histórico

`evaluate(raw: unknown): Result` conserva rutas `direct`, `focused`, `exploratory` y `abstain` de v0.1.0. Su selección es de un paso. `JOINT_PLAN_REQUIRED` sin recomendación no demuestra inviabilidad. Para obtener una política completa se usa `plan`.

`evaluate.sufficient` expresa suficiencia matemática dentro del modelo incluso si el gate bloquea la ruta. Los posibles valores de sus decisiones son información diagnóstica. El host usa `plan.status` para decidir si existe una salida utilizable autorizada, no `evaluate.sufficient` aislado.

| Campos de `Result` | Interpretación |
|---|---|
| `coverage`, `gate`, `costUnit`, `remainingBudget` | Declaraciones del modelo validado |
| `worldIds`, `observations` | IDs de mundos compatibles y evidencia canónica usada para filtrarlos |
| `signatures`, `signatureCount` | Vectores únicos de respuestas conjuntas, en el orden de decisiones canónicas, y su cantidad |
| `decisions` | Objetos `{id, possible, status}`; `possible` reúne los valores compatibles de cada decisión |
| `unresolvedCount` | Cantidad de decisiones cuyo estado no es `determined` |
| `sufficient` | Cobertura completa y exactamente una firma conjunta |
| `actions` | Una evaluación `ActionAssessment` por acción del modelo |
| `route`, `reason`, `recommendedAction` | Ruta, motivo y acción elegida, o `null` cuando no hay recomendación |

El estado de una decisión es `conflict` si la cobertura es completa y no quedan mundos; `unverified` si la cobertura es incompleta; `determined` si tiene un único valor con cobertura completa; `undetermined` en el resto de casos.

| Campos de `ActionAssessment` | Interpretación |
|---|---|
| `id`, `capability`, `cost` | Identidad, capacidad declarada y costo decimal de la acción |
| `eligible`, `exclusion` | Admisibilidad local y primer motivo de exclusión, o `null`; no evalúan el gate global |
| `outcomes` | Particiones `{outcome, worlds, signatures}` de los mundos compatibles por resultado |
| `worstResidual` | Máximo número de firmas conjuntas que quedarían en una partición; cero si no hay particiones |
| `guaranteedReduction` | `signatureCount - worstResidual` |
| `efficiency` | Razón exacta reducción/costo como `{numerator, denominator}` de cadenas decimales; no es una probabilidad |
| `resolvesAll` | Hay más de una firma inicial y cada partición deja una sola; puede ser verdadero aunque la acción esté excluida |

Las exclusiones tienen esta precedencia: `denied`, `permission_unknown`, `unavailable`, `over_budget`, `no_partition` (cero o una partición). La elegibilidad local no autoriza efectos externos.

| `reason` | `route` | Recomendación |
|---|---|---|
| `CONFLICT`, `GATE_DENIED`, `GATE_UNKNOWN`, `INCOMPLETE_COVERAGE` | `abstain` | Ninguna; se comprueban en ese orden |
| `SUFFICIENT` | `direct` | Ninguna |
| `ONE_ACTION_RESOLVES` | `focused` | Acción elegible resolutiva de menor costo; empate por ID |
| `NO_ADMISSIBLE_ACTION` | `abstain` | Ninguna |
| `PARTIAL_PROGRESS` | `exploratory` | Mayor eficiencia positiva; empates por menor costo e ID |
| `JOINT_PLAN_REQUIRED` | `exploratory` | Ninguna; hay acciones elegibles, pero ninguna garantiza reducción en un paso |

`compareRatios(a: bigint, b: bigint, c: bigint, d: bigint): -1 | 0 | 1` compara `a/b` con `c/d` mediante productos exactos. Devuelve -1 si la primera razón es menor, 0 si son iguales y 1 si es mayor. Los numeradores deben ser no negativos y los denominadores estrictamente positivos; los signos inválidos producen `TypeError`. Es una utilidad tipada para `bigint`, no una operación sobre el JSON de entrada.

## CLI

El ejecutable `motor-matematico`, o `node cli.mjs` desde el checkout, acepta:

```sh
motor-matematico plan modelo.json
motor-matematico plan - --limits limites.json
motor-matematico evaluate modelo.json
motor-matematico validate modelo.json
motor-matematico advance modelo.json observacion.json --limits limites.json
```

`-` lee el modelo de stdin. Las opciones y la observación se leen desde archivos. `--limits` es opcional tanto en `plan` como en `advance`; para continuar un plan que necesita límites personalizados, pasar los mismos límites a `advance`. Cada entrada tiene un límite de 16 MiB. El CLI escribe resultados JSON en stdout y errores JSON en stderr. No modifica los archivos de entrada.

| Salida del proceso | Significado |
|---:|---|
| 0 | Comando completado; para `plan`, leer `status` para distinguir solución, bloqueo o límite |
| 2 | Argumentos, JSON o contrato inválidos |
| 3 | Error de E/S |

Un `infeasible` o `limit_exceeded` es un resultado válido del motor y conserva salida 0. `evaluate` devuelve `Result`, con `route` y `reason`; `validate` y `advance` devuelven el modelo `Input`, sin `status`. El help usa texto, no JSON. El formato antiguo sin subcomando produce error de uso.

Las escrituras esperan su finalización y manejan errores asíncronos, incluida una tubería stdout cerrada. Si stderr también falla, el CLI conserva salida 3, pero no puede entregar un diagnóstico JSON por ese canal.

## Adaptador de anclas

El paquete exporta también `compileAnchor`, `routeAnchor` y `advanceAnchor`. Su contrato independiente está en [adaptador de anclas](anchor-adapter.md).

## Frontera FALP del host

`routeFalp(request: unknown, options?: PlanOptions)` conserva la clasificación semántica declarada por el host y separa la ruta de observación del control operativo `next`. Admite briefs `ready` sin modelo ni preguntas ficticias. Una investigación `solved` pasa a `reassess`; no aprueba la entrega del prompt.

`acceptFalpReceipt(request: unknown, dispatch: unknown, receipt: unknown, options?: PlanOptions)` vincula un recibo al contexto actual y al despacho confiado del host, revalida gates y permisos, y registra sólo un resultado `SUPPORTED` de la acción vigente. `UNKNOWN`, `CONFLICT` y `BLOCKED` conservan estado y presupuesto; un replay exacto no cobra otra vez. La [frontera FALP](falp-integration.md) documenta schemas, estados, errores y responsabilidades del host. Ambas funciones y sus tipos se exportan desde el paquete principal.
