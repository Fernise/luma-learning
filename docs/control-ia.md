# Control del tutor y siguientes iteraciones · 0.7.0

Revisión completada el 4 de octubre de 2026. Se mantiene la clave local sin mostrarla ni incluirla en archivos de pruebas. La aplicación sigue escuchando en `127.0.0.1`.

## Alcance de la IA

El modelo recibe datos del ejercicio y una explicación, y devuelve una categoría de un conjunto cerrado. No recibe claves, cookie, conversaciones anteriores ni instrucciones del cliente como instrucciones de sistema. No genera el texto visible del tutor ni decide la corrección de una opción. No dispone de herramientas: la petición declara una lista vacía y prohíbe su elección. El servidor no implementa ejecución de funciones, navegación, lectura de archivos ni código generado por el modelo.

Se valida la forma de la respuesta además del esquema JSON: un único mensaje de asistente, una única salida de texto de hasta 256 caracteres, una única propiedad `category` y un valor permitido. Una llamada de herramienta, otro rol, mensajes adicionales, negativa, respuesta incompleta o categoría inadecuada para el ejercicio se descarta. La categoría `denominator-error` solo se admite para comparar fracciones con el mismo numerador.

Antes de la interpretación se filtran peticiones conocidas para cambiar de rol, ignorar instrucciones, revelar secretos, visitar enlaces, ejecutar código o escribir otros contenidos. Se normalizan Unicode y caracteres invisibles. Un filtro temático conserva vocabulario del ejercicio, razonamiento, incertidumbre y analogías básicas; mensajes claramente ajenos se reconducen. Estos filtros son heurísticos: admiten falsos rechazos y no constituyen una prueba de resistencia frente a cualquier ataque. La protección de las capacidades depende principalmente del flujo fijo y de la ausencia de herramientas, no de encontrar todas las frases maliciosas.

Algunas contradicciones matemáticas claras se comprueban antes de la IA: un salto constante incorrecto, multiplicación errónea en un patrón de doble, una afirmación falsa de paridad, equiparar «algunos» con «todos» y ciertos errores explícitos de tamaño de partes. Tampoco estas comprobaciones cubren cualquier explicación posible. Detectar una contradicción impide pasar a `needs-review` por repetirla; se mantienen las preguntas y aumenta el apoyo.

## API y límites

Se rechazan campos adicionales, tipos incorrectos y acciones ajenas al tutor. El navegador no puede suministrar un modelo, herramientas, instrucciones o un ejercicio diferente. Se exigen cuerpos JSON en los endpoints que los leen; se rechazan peticiones de origen externo, metadatos de navegación cruzada y encabezados Host ajenos al servicio de loopback y su puerto. Los tests de Host usan HTTP directo porque el cliente fetch empleado en las pruebas no conserva un Host personalizado.

Todas las acciones respetan el límite de 80 turnos; se corrigió la excepción que permitía repetir pausas sin ese límite. La conversación en memoria queda acotada a 30 mensajes. Se mantienen 10 llamadas de IA por expedición, 100 por proceso del servidor, límite de salida, espera máxima y recuperación local. Reiniciar restablece los contadores: no son un límite monetario ni protegen otros usos de la misma clave.

El modo para adultos es una opción de esta beta local, no autenticación ni una verificación de edad. Una persona con control del ordenador o del navegador puede hacer peticiones locales y modificar su entorno. Estos controles no sustituyen autenticación, gestión de secretos y límites persistentes antes de publicar la app.

## Resultados observados

107 pruebas automáticas pasan, sin llamadas externas. Incluyen 25 ataques, los filtros de las 36 explicaciones válidas, contradicciones repetidas, límites ante concurrencia, conservación de la adaptación, salidas inesperadas, restricciones HTTP, reinicio y almacenamiento.

La evaluación con la API real utilizó ejemplos ficticios de adultos. Una primera serie detectó dos explicaciones válidas de fracciones rechazadas por el modelo. Se añadieron criterios explícitos para ambos tipos de comparación. En la serie final de positivos, las 36 explicaciones fueron reconocidas por la IA. En la serie final de negativos y ataques:

- 12 explicaciones incorrectas quedaron sin reconocimiento como razonamiento válido.
- En uno de esos 12 casos el modelo produjo una categoría inadecuada para el ejercicio; la validación la rechazó y el motor local mantuvo el resultado sin reconocimiento. Esto valida la recuperación del sistema, no una respuesta correcta del modelo.
- 25 ataques o peticiones ajenas se recondujeron sin ninguna llamada al proveedor.

Son 73 casos distintos comprobados en dos series finales. No es una estimación representativa de precisión ni una garantía frente a ataques nuevos. Las frases son de autoría, hay una observación por caso y falta variedad de explicaciones reales, repetición para medir variabilidad y revisión por un educador.

Los informes están en `artifacts/ia-control/evaluacion-validos.json` y `evaluacion-negativos.json`. `evaluacion.json` conserva la serie anterior parcial, interrumpida al detectar una categoría inadecuada; no debe confundirse con el resultado final. Durante las iteraciones de evaluación se hicieron 48 + 39 + 12 llamadas; los ataques no consumieron la API. Las comprobaciones adicionales de interfaz se registran por separado.

La revisión visual del navegador integrado comprueba una petición de cambio de instrucciones con una elección correcta: no completa el ejercicio, muestra una pregunta del mismo problema y el panel para adultos registra cero llamadas y un mensaje reconducido. Dos contradicciones posteriores tampoco completan el ejercicio. Al explicar correctamente la regla, la actividad puede continuar con una única interpretación real.

## Iteraciones de interacción

Se añadió el aviso «Estoy leyendo tu idea…» mientras se procesa el formulario, con estado accesible de espera en la conversación. Tras una reconducción se muestra «Seguimos con el ejercicio», en lugar de anunciar un fallo de IA. El panel para adultos incluye el número agregado de mensajes reconducidos y el alcance permitido del modelo, sin conservar su texto en esos contadores.

Los inicios de frase se adaptan ahora al ejercicio: comparación de partes en fracciones, regla y comprobación entre parejas en patrones, y relación entre pistas y conclusión en lógica. No incluyen cantidades, operaciones correctas ni conclusiones del ejercicio. Pulsarlos solo inicia una explicación vacía; se conserva cualquier borrador ya escrito.

Se revisaron el tutor y las opciones para adultos en cuatro anchos entre 320 y 1366 px: sin desbordamiento horizontal y con el diálogo dentro de la pantalla. En móvil, las opciones pueden desplazarse verticalmente para alcanzar todos sus controles. Las mediciones están en `artifacts/ia-control/mediciones.json`.

La siguiente revisión humana debería estudiar claridad de las preguntas, falsos rechazos del filtro y comprensión en un contexto nuevo. La publicación y el piloto infantil continúan pendientes.

Referencia técnica: [Safety in building agents, documentación oficial de OpenAI](https://developers.openai.com/api/docs/guides/agent-builder-safety#combine-techniques). Recomienda combinar aislamiento, datos estructurados y controles; estos reducen el riesgo sin garantizar su eliminación.
