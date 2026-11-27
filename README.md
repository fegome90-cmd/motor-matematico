# Motor matemático FALP

MVP 0.2.0 de un motor que decide qué observaciones pedir para resolver un conjunto de decisiones. Recibe mundos posibles, acciones, evidencia, permisos y presupuesto. Devuelve una política completa que minimiza el costo del peor caso, o un motivo explícito para detenerse.

Los costos se calculan exactamente con `BigInt` y se intercambian como cadenas decimales. La garantía depende del modelo finito recibido. La aplicación anfitriona determina la cobertura de los mundos, autentica las observaciones y ejecuta las acciones autorizadas.

## Probar el motor

Se necesita Node >=22.18.0. Desde un checkout de esta revisión, la distribución incluida permite ejecutarlo sin instalar dependencias:

```sh
node cli.mjs plan examples/parity3.json
node examples/session.mjs
```

El primer comando devuelve `status: "planned"`, `recommendedAction: "signal_0"` y `worstCaseCost: "6"`, junto con el grafo completo. El segundo simula las tres observaciones, descuenta el presupuesto de 6 a 0 y termina en `solved`. El fixture contiene una acción de ruido barata; el plan la evita.

Para usar un modelo propio:

```sh
node cli.mjs validate modelo.json
node cli.mjs plan modelo.json
node cli.mjs advance modelo.json observacion.json
```

El último comando imprime el modelo actualizado y conserva el archivo original. Una observación tiene la forma `{"action":"signal_0","outcome":"o1","source":"mi-adaptador"}`. Debe corresponder a la acción recomendada. El motor registra el resultado, sin ejecutar la acción.

## Usar desde código

```js
import { readFileSync } from 'node:fs';
import { plan, advance } from './dist/index.js';

let model = JSON.parse(readFileSync('examples/parity3.json', 'utf8'));
const result = plan(model);

if (result.status === 'planned') {
  // En este ejemplo, el resultado viene del mundo simulado w7.
  model = advance(model, {
    action: result.recommendedAction,
    outcome: 'o1',
    source: 'simulation:w7',
  });
}
console.log(plan(model));
```

El paquete local exporta la misma API como `@fegome90/motor-matematico`. Para generar el tarball, instalar herramientas con `npm ci` y ejecutar `npm pack`. Se puede instalar ese archivo en otro proyecto con `npm install /ruta/al/archivo.tgz`. No hay dependencias de ejecución. Esta entrega no publica el paquete en npm.

## Estados que el consumidor debe manejar

| Estado | Qué permite concluir |
|---|---|
| `solved` | La respuesta conjunta está determinada en el modelo y el gate permite usarla |
| `planned` | Hay una política completa y óptima dentro del presupuesto |
| `infeasible` | No existe política admisible dentro del presupuesto de ese modelo |
| `blocked` | Falta autorización global |
| `conflict` | La evidencia deja vacío un universo declarado completo |
| `incomplete` | La cobertura declarada no permite afirmar suficiencia |
| `limit_exceeded` | La búsqueda alcanzó una cota; no se publica una acción parcial |

Los límites predeterminados de planificación son 128 mundos compatibles, 32 acciones admisibles, 20.000 estados, 500.000 transiciones, profundidad 32 y 1.000 ms cooperativos posteriores a validación. Se pueden configurar dentro de los techos documentados en [API](docs/api.md). Un límite computacional no prueba inviabilidad. La política publicada también debe caber completa en los espacios disponibles del registro de 512 observaciones; de lo contrario se devuelve `MAX_OBSERVATIONS`.

## Desarrollar y verificar

```sh
npm ci
npm run build
npm test
npm run test:oracle
npm run test:planner-oracle
npm run verify:package
```

Los oráculos requieren Python >=3.11. El gate completo `npm run check` añade lint, tipos y documentación; la [guía de operación](docs/agent/RUNTIME.md) explica cómo preparar el checker documental fijado por commit. `npm run bench` mide planificación local, con verificación de sus resultados.

La [evidencia de la entrega](docs/evidence/README.md) incluye los resultados de pruebas, benchmark y revisión con contexto nuevo. Las pruebas usan modelos sintéticos: no miden comprensión de prompts, tokens ni proveedores LLM. La integración con un router anfitrión requiere construir y validar su modelo y revalidar permisos antes de ejecutar herramientas.

## Continuar el proyecto

- [API y formato JSON](docs/api.md).
- [Diseño matemático y alternativas](docs/design.md).
- [Entrada para agentes](AGENTS.md).
- [Kit Fundador, kit documental y Constitución adoptados](docs/foundations.md).
- [Gobierno y autoridades](GOVERNANCE.md).

La implementación conserva `evaluate` para el diagnóstico de un paso de v0.1.0 y añade `plan` para políticas completas. Los cambios de código, evidencia y documentos se trabajan juntos en este repositorio.
