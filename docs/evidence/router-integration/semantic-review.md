# Revisión semántica del piloto sintético del router FALP

## Dictamen

Las dos variantes conservan la intención y las restricciones materiales de los ocho casos bajo el contrato de este piloto. No detecté Blocker ni Major. Detecté un Nit de precisión condicional en la instrucción de delegación de B; no demuestra que se haya perdido un literal ni que se haya simulado una revisión.

Los tres casos con next=observe o next=explore son checkpoints legítimos: contienen trabajo pendiente y borradores invariantes, y no los evalué como entregas finales concluidas. Los otros cinco casos contienen prompts textualmente utilizables para el encargo descrito. Esta revisión no ejecutó ninguno de esos prompts.

El resultado permite una comparación cualitativa de estas salidas: no se observa una degradación material de B respecto de A en los ocho casos. No demuestra superioridad, equivalencia general ni no inferioridad estadística.

## Alcance, fuentes y método

Leí completo el contrato worker.md indicado antes de iniciar. Consulté exclusivamente estas fuentes y salidas:

| Clave | Archivo y alcance |
|---|---|
| S1 | /home/agent/.codex/plugins/cache/created-by-me-remote/prompts-con-ancla/0.2.1/skills/crear-prompts-gobernados/SKILL.md, completo. En particular: selección de ruta, portabilidad, delegación, Anti-Drift y readback. |
| S2 | /home/agent/.codex/plugins/cache/created-by-me-remote/prompts-con-ancla/0.2.1/skills/crear-prompts-gobernados/references/exploracion-falp.md, completo. En particular: navegación por incógnita, Main productivo y límites de evidencia. |
| I | /workspace/scratch/ea177efed27f/motor-router-tests/tests/fixtures/router-integration/pilot-inputs.json, los ocho casos. |
| A | /workspace/scratch/ea177efed27f/router-pilot/baseline/output.json, variante declarada instructional-baseline. |
| B | /workspace/scratch/ea177efed27f/router-pilot/assisted/output.json, variante declarada motor-assisted. |

La unidad de evaluación es cada objeto completo de salida —incluidos prompt, next y notes— frente a su request, anchor y contexto en I. Para localizar cualquier fila de las tablas, búsquese su id en cases tanto en I como en el archivo de la variante indicada. Las evaluaciones de redacción se refieren a prompt; las de finalización también consideran next y notes.

Contrasté propósito, obligaciones, restricciones, dependencias y asignación de tareas entre redactor y receptor. Complementé esa lectura con una comprobación local de igualdad de anclas y presencia de los fragmentos solicitados entre comillas angulares. Esa comprobación sólo aporta evidencia literal: no sustituye el juicio semántico.

No abrí gold, expectations ni reportes de otros revisores. No modifiqué repositorio, plugin, inputs ni salidas. No ejecuté tareas destinatarias, no consulté herramientas externas ni inspeccioné trazas de ejecución del motor.

Esta es una revisión separada de la producción de las salidas, pero no ciega: los nombres de variantes y rutas eran visibles y el filesystem es compartido. No se acredita aislamiento experimental ni diversidad de familias de modelos.

## Tabla por caso y variante

### Encargos suficientes y checkpoints

| Caso | Variante | Dictamen | Evaluación semántica |
|---|---|---|---|
| ready_zero | A | Conforme como prompt completo | Define entrada con items enteros, suma con negativos, cero para lista vacía y salida exclusivamente JSON con una propiedad total entera. Incluye ambos ejemplos exigidos y la prohibición literal. No introduce dependencias, consultas ni confirmaciones. La nota distingue readback textual de ejecución destinataria. |
| ready_zero | B | Conforme como prompt completo | Preserva los mismos requisitos. Hace explícitos el carácter obligatorio de items y total y la exclusión de null en total; son precisiones coherentes con el dominio pedido, sin resolver un problema distinto. No presenta la decisión del router como validación conductual. |
| focused_two_reads | A | Conforme como checkpoint | Conserva una sola incógnita —concordancia de etiquetas— y estrategia ya decidida. Exige evidencia de ambos contratos antes de concluir y prohíbe alternativas. Las dos consultas no convierten el problema en exploración de estrategia: route=focused es coherente. El borrador identifica la observación pendiente del redactor y no transforma escenarios en hechos. |
| focused_two_reads | B | Conforme como checkpoint | Mantiene route=focused, las dos fuentes necesarias, sólo lectura y la prohibición de concluir sin ambas observaciones. La provisionalidad está en notes; next=observe sigue abierto. La mención de observationRoute=exploratory no redefine el problema ni impone una estrategia alternativa al receptor. La afirmación sobre la política del motor no fue corroborada mediante una traza en esta revisión. |
| exploratory_one_read | A | Conforme como checkpoint, con ambigüedad de encargo descrita abajo | Mantiene abiertas las dos alternativas y los criterios mantenimiento, portabilidad y capacidades. No elige estrategia antes de consultar requisitos ni instala o impone proveedor. La consulta única no elimina la exploración de estrategia. El texto marca el reporte y la comparación como trabajo pendiente del redactor. |
| exploratory_one_read | B | Conforme como checkpoint, con la misma ambigüedad | Conserva ambas alternativas, los tres criterios y la prohibición literal. Distingue requisitos documentados, inferencias y ausencias; no toma local_only o external_ok por observaciones. route=exploratory es coherente con la decisión abierta. next=observe y notes impiden interpretar el borrador como comparación concluida. |
| explicit_exploration | A | Conforme como checkpoint | El encargo de resumen está definido, pero la exploración de enfoques pedida al redactor sigue pendiente. route=direct describe la suficiencia del brief; explorationRequired=true y next=explore conservan esa obligación adicional. El borrador preserva cuatro viñetas y ausencia de fuentes añadidas y explica que explorar no se transfiere al receptor. |
| explicit_exploration | B | Conforme como checkpoint | Conserva el contenido invariante del resumen y la obligación literal. notes señala expresamente que el redactor debe explorar antes de entregar y que no lo ha hecho. La separación de ese estado fuera del campo prompt evita introducirlo como instrucción destinataria. No hay un cierre ficticio ni preguntas de relleno. |

### Portabilidad, permisos y delegación

| Caso | Variante | Dictamen | Evaluación semántica |
|---|---|---|---|
| recipient_portability | A | Conforme como prompt completo | El receptor comprueba sus propias herramientas y acceso a adjuntos. No hereda capacidades ni gobernanza del redactor; las menciones negativas a memoria, plugins y rutas no confieren acceso. Audita sólo mediante lectura, exige localizadores en ambos documentos y acota conclusiones si falta evidencia. Que el prompt no abra con el nombre Claude no impide su uso por ese receptor. |
| recipient_portability | B | Conforme como prompt completo | Identifica a Claude y conserva lectura, adjuntos y localizadores. Usa únicamente recursos disponibles y autorizados y deja pendiente sólo lo dependiente de un adjunto inaccesible. No añade Bootstrap, Kernel ni accesos privados. La auditoría queda correctamente asignada al receptor. |
| audit_not_repair | A | Conforme como prompt completo | Solicita estado y diff reales, revisión identificable, severidad y evidencia localizada. Preserva la prohibición literal y refuerza que no se apliquen reparaciones ni operaciones que modifiquen estado. La inspección del PR se pide al receptor; no se inventa una auditoría ya realizada. |
| audit_not_repair | B | Conforme como prompt completo | Conserva la misma frontera de auditoría, el estado real y el entorno existente. Exige distinguir lo declarado de lo comprobado y justificar severidad e impacto. Las limitaciones de acceso afectan sólo conclusiones dependientes. No amplía permisos a escritura, reparación, merge o despliegue. |
| mandatory_worker | A | Conforme como prompt completo | Exige worker real, comprueba capacidad en destino y requiere recepción y evidencia de despacho. Un rol, sesión abierta o revisión propia no bastan. Si falta capacidad, bloquea sólo la revisión y permite preparación autorizada. La instrucción de copiar cadenas exactas con delimitadores y comprobar evidencia decisiva mejora la verificabilidad sin sustituir al worker. |
| mandatory_worker | B | Conforme en lo material; Nit N1 | Conserva delegación obligatoria, imposibilidad de sustituirla por revisión propia, recepción de resultado y bloqueo limitado si no puede cumplirse. Las capacidades se comprueban en destino. La instrucción condicional sobre cadenas preservadas es menos precisa que S1 respecto de texto exacto y delimitadores; véase N1. No se observa una afirmación de delegación efectivamente ejecutada. |
| optional_no_go | A | Conforme como prompt completo | Pide exactamente cuatro viñetas, conserva los números y su relación con las afirmaciones, y define salida cuando falta texto o está vacío. No inventa contenido para satisfacer el formato y no exige confirmar restricciones opcionales. No convierte la falta de NO GO adicional en un permiso. |
| optional_no_go | B | Conforme como prompt completo | Mantiene cuatro viñetas, fidelidad numérica y salida de ausencia si falta el insumo o no es accesible. No pregunta ni añade un formulario. La condición de ausencia evita tratar el formato de cuatro viñetas como obligación de fabricar un resumen sin fuente. |

## Hallazgos por severidad

Las severidades se usan para el contrato de este piloto: Blocker impide el uso seguro o veraz del resultado; Major altera una obligación material; Nit identifica una precisión menor que no cambia el cumplimiento observado.

| Severidad | Cantidad | Resultado |
|---|---:|---|
| Blocker | 0 | No se detectó sustitución de autoridad, ejecución inventada ni incumplimiento que invalide estas salidas bajo el contrato de checkpoint. |
| Major | 0 | No se detectó cambio material de intención, permisos, alcance o término en los casos examinados. |
| Nit | 1 | N1: precisión condicional de transporte de texto exacto al worker en B. |

### N1 — B, mandatory_worker: explicitar texto exacto y delimitadores

**Evidencia:** B, cases[id=mandatory_worker].prompt, indica: “Incluye de forma explícita cualquier cadena o campo que deba preservarse; no remitas a contexto que el worker no pueda ver”. S1, sección Delegación, exige que, cuando una subtarea requiera una cadena, campo o documento exacto, cada mensaje incluya el texto exacto y sus delimitadores desde la fuente autorizada. A contiene una instrucción expresa de copiar el texto con sus delimitadores.

**Implicación:** la redacción de B conserva la intención de portar el contexto necesario, pero no especifica los delimitadores ni distingue con la misma fuerza una copia literal de una referencia o reformulación. Es una debilidad de precisión en una condición futura, no evidencia de pérdida de datos ocurrida: el caso no incluye material concreto para esa revisión y aquí no se despachó ningún worker destinatario.

**Ajuste acotado recomendado:** cuando corresponda una cadena, campo o fragmento exacto, exigir copiarlo literalmente desde la fuente autorizada, incluidos sus delimitadores, dentro del mensaje al worker. No requiere añadir fases, nuevos workers ni otra aprobación.

## Ambigüedades y decisiones de interpretación

1. **exploratory_one_read no solicita expresamente un prompt en su request aislado.** Comienza pidiendo explorar la estrategia de un editor. S1 declara que la skill no se activa por una petición de ejecutar una tarea sin solicitar un prompt. Evalué el caso dentro del encargo explícito de este piloto de redacción y router; bajo ese contexto, las dos salidas preservan adecuadamente la incertidumbre. El caso aislado no permite certificar el disparador de la skill ni distinguir por completo si la exploración debe quedar resuelta por el redactor o ser la tarea futura del receptor. Para evaluar ese límite, habría que explicitar el objetivo del prompt solicitado. No atribuí esta ambigüedad a una variante.

2. **focused_two_reads presupone que observar los contratos es dependencia del redactor.** El request declara una incógnita y consultas todavía no observadas, y el contrato de revisión establece que next=observe es un checkpoint válido. Por eso acepté las dos observaciones como pendientes. En una solicitud genérica de redactar instrucciones de auditoría, conocer previamente las etiquetas podría no ser necesario. Este fixture prueba la ruta bajo la dependencia declarada; no demuestra que toda auditoría de contratos exija investigación previa del redactor.

3. **La etiqueta route no agota el estado de trabajo.** En explicit_exploration, direct más next=explore no significa omitir la exploración: separa suficiencia del brief y obligación explícita. En focused_two_reads, explorationRequired se interpreta como activación del módulo FALP para una ruta focalizada, no como permiso para reabrir la estrategia. Las notas de ambas variantes sostienen esas lecturas.

4. **El contrato permite borradores en los checkpoints.** A incluye avisos de provisionalidad y tareas del redactor dentro de prompt; B los deja en notes. Evaluando el objeto completo, ninguna variante presenta ese trabajo pendiente como finalizado. No penalicé A por no ser todavía un prompt limpio para copiar ni B por reservar el estado en metadatos. Un consumidor que extrajera sólo prompt perdería información material en B; un consumidor que enviara el campo provisional de A al receptor arrastraría instrucciones del redactor. No se inspeccionó tal consumidor: esto es un límite de uso del checkpoint, no un fallo observado de integración.

5. **No se añadieron expectativas no decididas.** ready_zero define un dominio de entrada válido; no inventé un requisito de manejo de JSON malformado. optional_no_go no precisa si hay que reproducir todos los números de un texto arbitrariamente extenso o preservar exactamente los incluidos; ambas variantes conservan la formulación solicitada y el piloto no aporta un texto para resolver esa interpretación.

## Comprobaciones complementarias

La comparación local, sin leer expectativas, arrojó:

- Ocho ids presentes en cada variante.
- Ocho anclas exactamente iguales a las de I en cada variante, incluidos los caracteres CRLF de focused_two_reads.
- Siete fragmentos solicitados literalmente, todos presentes en el prompt correspondiente de cada variante. optional_no_go no contiene un fragmento entre comillas angulares exigido como literal.
- Los ocho pares A/B coinciden en route, next y explorationRequired.
- Los dieciséis objetos tienen clarifyingQuestions vacío; la lectura de los prompts tampoco detectó preguntas de confirmación o formularios que reintroduzcan esa fricción.

En focused_two_reads y exploratory_one_read, el request pide mayúscula inicial en el fragmento literal y el anchor usa minúscula. Ambas salidas conservan el anchor exacto y el fragmento del request dentro del prompt. No traté esa diferencia de los inputs como autorización para normalizar el ancla.

Estas observaciones son verificaciones de artefactos textuales. No son pruebas del comportamiento del receptor.

## Qué comparación de calidad queda sustentada

Esta muestra permite sostener que A y B mantuvieron las decisiones materiales examinadas, incluidas dos trampas de clasificación: una incógnita concreta que necesita dos lecturas sigue siendo focalizada, y una estrategia abierta que puede discriminarse con una lectura sigue siendo exploratoria. También permite observar diferencias de redacción: A ofrece más detalle sobre verificabilidad del worker; B separa mejor el contenido destinatario de las notas del checkpoint.

No permite concluir que integrar el motor mejore la calidad en general ni que la equivalencia de etiquetas pruebe equivalencia semántica fuera de estos casos. Son ocho casos sintéticos explícitos, sin repetición experimental, sin ejecución de receptores y sin revisión ciega. La muestra está orientada a contratos y límites concretos; no representa la distribución de pedidos reales.

Las afirmaciones internas de B acerca de una política, su profundidad o su siguiente consulta no se certifican con esta revisión: sólo se leyeron las salidas, el modelo hipotético de entrada y las fuentes de instrucciones. Tampoco se verificó que un consumidor respete los estados pendientes al entregar prompts. La recomendación que se desprende de este dictamen es mantener el resultado como evidencia de compatibilidad semántica local; una afirmación de mejora o de ausencia general de regresiones requeriría evidencia adicional.

## Trazabilidad de ejecución de esta revisión

Se usaron lecturas locales de los cinco archivos enumerados y del worker.md, seguidas de un script local que cargó los tres JSON para contrastar anclas, fragmentos exigidos, ids y campos de control. El script no accedió a expectativas ni ejecutó el código del repositorio. Sólo se creó este reporte en la ruta solicitada, fuera del repositorio.

Fin de revisión.
