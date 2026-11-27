# Auditoría de trazabilidad

## Revisor y alcance

Revisor nativo: `/root/trail_review_supported`, modelo solicitado y aceptado `gpt-6.2-sol`. El intento anterior con `gpt-5.5` fue rechazado por el host como modelo no disponible; no cuenta como revisión. La selección de un modelo distinto al coordinador no demuestra diversidad de familias.

El revisor trabajó en modo de sólo lectura sobre fuentes, Git, ZIP originales, logs, resúmenes y muestras. No tuvo disponible un transcript local exportado de la sesión principal. El contexto conversacional era nuevo y el filesystem compartido; no se declara evaluación ciega. Este archivo resume el informe recibido, no lo presenta como una traza completa de herramientas.

## Resultado local

El revisor confirmó que los SHA-256 de los cuatro módulos de `dist` coinciden con el oráculo, el benchmark y el perfil. El JSON del oráculo coincide con el resumen incluido en el log. La campaña revisada en ese momento registra 69 pruebas Node, 4.352 comparaciones históricas y 18.750 casos de planificación. La prueba del paquete instalado devuelve costo exacto 6 en API y CLI.

Se recalcularon los estadísticos de las 21 combinaciones de escenario y política: 1.185 llamadas y cero fallos. Se comprobó el hash del perfil V8 descomprimido y sus 30 funciones principales. La comparación corresponde a un diagnóstico sintético local, con resultados por límites separados de soluciones.

El manifiesto del ZIP original enumera 22 archivos. El commit de importación conserva 18 byte a byte, adapta uno y deja tres fuera. Los ZIP respaldan 35 pruebas y 4.352 comparaciones históricas. La etapa intermedia de 64 pruebas conserva sólo el registro de sesión, sin un log autónomo accesible al auditor. Las campañas de 66 y 69 pruebas sí tienen logs propios en este repositorio.

## Hallazgos resueltos

- Se preservaron y enlazaron los artefactos históricos para no atribuir cifras antiguas al build final.
- Se corrigió el calentamiento asimétrico del benchmark y se repitió la campaña con referencia precalculada.
- Se incluyeron los logs anidados en Git y se delimitó la ventana medida de parseo, API y serialización.
- Se precisaron el rol lector por defecto, la separación de actos y la aprobación de ámbitos críticos.
- El gate de distribución comprueba diferencias y archivos generados todavía no versionados.
- Se distinguió la licencia declarada para 0.2.0 de la falta de licencia propia en el ZIP 0.1.0.

## Límites del dictamen

Al devolver su informe, la inclusión efectiva de los archivos en el commit, la ronda EGM 5 y el CI remoto estaban pendientes. Este dictamen no los acredita. El coordinador debe comprobar esos resultados por separado sobre el commit publicado y conservar sus referencias.

El coordinador añadió posteriormente el arreglo de salida CLI, su revisión independiente, el log de 71 pruebas y una nueva campaña de rendimiento. La medición auditada aquí se preserva en `history/benchmark-before-io.json`; la auditoría no se atribuye retrospectivamente a esas ejecuciones posteriores. Los módulos del núcleo mantienen sus hashes.
