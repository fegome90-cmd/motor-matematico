# Criterio de revisión del MVP

Auditar el documento indicado en la revisión contra el código y los archivos de contexto expresamente asignados. Distinguir un defecto del producto, una afirmación falsa del documento y una mejora futura.

1. La aritmética de costos debe ser exacta para las entradas admitidas. La garantía de optimalidad debe corresponder a la búsqueda que efectivamente termina.
2. Las respuestas deben distinguir conflicto, gate, cobertura, inviabilidad y límite de búsqueda. Ninguna interrupción autoriza una acción parcial.
3. Documentar límites y condiciones de operación, incluido el control cooperativo de tiempo y la responsabilidad del host sobre permisos, evidencia y concurrencia.
4. Los ejemplos y comandos públicos deben corresponder a archivos, exportaciones y comportamiento existentes. La sesión debe conservar presupuesto y permitir reintentos sin cobros duplicados.
5. Las afirmaciones de verificación deben tener evidencia concreta. Los tests sintéticos, la revisión de agentes y la revisión humana son categorías distintas.
6. La reutilización de los tres kits debe tener procedencia y adaptaciones explícitas. No se exige copiar servicios que el producto no usa.

Para cada hallazgo: severidad Blocker, Major o Nit, archivo y líneas, discrepancia, evidencia y cambio necesario. Un Blocker impide usar con seguridad el contrato prometido. Un Major deja un comportamiento esencial incorrecto, ambiguo o sin verificar. Un Nit no afecta esos contratos. Declarar las lecturas efectuadas y cualquier archivo inaccesible. Una lectura incompleta no es una revisión limpia.

El alcance es una biblioteca y CLI para modelos finitos suministrados por el host. No exigir extracción LLM, despliegue, interfaz gráfica, prueba de toda la teoría ni rendimiento distribuido como condición del MVP. No declarar evaluación ciega: los contextos conversacionales son nuevos, pero el filesystem es compartido.
