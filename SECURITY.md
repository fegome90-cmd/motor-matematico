# Seguridad del repositorio

- Trabajar con fixtures sintéticos. No introducir datos clínicos, identificadores
  reales, tokens, credenciales, archivos de entorno ni rutas privadas de usuario.
- El motor propone decisiones; el ejecutor aplica autorizaciones. Ningún resultado
  SAT ni afirmación del extractor puede crear un permiso.
- Los resultados inciertos o contradictorios requieren un estado explícito y
  observable. No convertir un fallo de backend en éxito silencioso.
- El workflow usa `contents: read`, no persiste credenciales en checkout y no
  necesita secrets, publicación de paquetes ni servicios externos de aplicación.
- Los controles de secretos reutilizados no son una auditoría de seguridad
  completa. Registrar fallos sin volcar posibles secretos en logs.
- Si aparece una credencial real, detener su difusión, notificar al mantenedor sin
  incluir su valor y acordar revocación y limpieza. No abrir un issue público con
  el material sensible.

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para gates, limitaciones y permisos de merge.
