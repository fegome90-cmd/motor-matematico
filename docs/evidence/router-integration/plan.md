# Aceptación de la integración FALP

## Objetivo y bases

Comprobar el uso del motor como planificador de observaciones subordinado al router FALP real. Base de producto: `71717755b5369a570580e76b8b17a1051341e035`, rama preexistente `feat/falp-anchor-adapter`, sobre el MVP `effb31d`. Se trabaja en una rama hija para preservar los otros frentes y los PR de gobierno y núcleo.

El router instalado es Prompts con Ancla 0.2.1. Su skill y referencia FALP fueron leídas y contrastadas con el adaptador. Es un protocolo instruccional; no contiene un runtime que ya invoque esta biblioteca. No se modifica ni publica el plugin instalado.

## Diseño elegido

Se compararon dos formas: mantener sólo una receta de host con un harness, o añadir un pequeño módulo puro con una unión discriminada de encargo suficiente e investigación. Se elige el módulo: concentra la distinción entre suficiencia semántica declarada por el host y planificación numérica, sin obligar a cada consumidor a reconstruirla ni cambiar el núcleo.

`routeAnchor` conserva su clasificación de profundidad de observación. `routeFalp` consume una evaluación explícita del host y separa ruta, plan y próximo control. Una investigación numéricamente resuelta requiere reevaluación del host; el módulo no aprueba la entrega del prompt. Un recibo de integración añade encargo, pregunta, revisión y ancla esperados antes de usar `advanceAnchor`.

La comparación es una revisión de diseño con contexto compartido; no se declara arena ciega, diversidad de familias ni FULL_EVAL. Dos lectores separados localizaron la diferencia semántica y uno reprodujo los dos casos base.

## Organización del trabajo

- **Primeros pasos bloqueantes:** fijar fuente y revisión; leer contrato real; ejecutar los ocho tests existentes y reproducir incompatibilidades antes de implementar.
- **Frentes independientes:** un dueño implementa el módulo/recibos y sus tests; el coordinador prepara corpus, prueba diferencial y evidencia; un lector distinto verifica el resultado.
- **Estado compartido:** cada escritor usa su worktree; el coordinador integra commits antes de ejecutar los gates conjuntos. No se pisa la rama remota del adaptador.
- **Descomposición mínima:** ruta y recibos comparten contexto, por lo que tienen un único dueño. El núcleo minimax permanece fuera del cambio salvo defecto demostrado.

## Controles de aceptación

1. Directa sin preguntas artificiales; Focalizada con varias consultas; Exploratoria con una sola; exploración expresa conservada.
2. Gates globales y locales, cobertura incompleta, conflicto, presupuesto y límites impiden una recomendación utilizable.
3. Identidad de tarea, pregunta, revisión y ancla; resultados obsoletos; permisos revocados; replay exacto; UNKNOWN/CONFLICT/BLOCKED sin outcomes inventados.
4. Transposición diferencial acotada, correlaciones, permutaciones, Unicode y costos mayores que 2^53 durante una sesión completa.
5. Consumo desde paquete instalado, suite integrada y CI Node22/24 sobre el commit publicado.
6. Piloto del router instruccional con casos sintéticos, si el host permite ejecutar contextos separados. Separar ese resultado de pruebas mecánicas y de una validación con corpus real.

Los tests afirmarán resultados observables con valores esperados literales. La aritmética no autentica fuentes, no descubre cobertura omitida y no garantiza exactamente una ejecución externa. Los fallos de ejecución sin resultado soportado requieren contabilidad del host. Un piloto sintético no autoriza despliegue automático del router.
