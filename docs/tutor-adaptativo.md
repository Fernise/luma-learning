# Tutor adaptativo · 0.9.0

19 de octubre de 2026. Implementada la propuesta de preguntas con IA dentro del ejercicio, con guía local como alternativa. Activación en Opciones para adultos → «Usar IA para interpretar y adaptar preguntas». Sigue siendo una prueba para adultos con datos ficticios.

## Qué hace

Una sola petición a Responses devuelve una categoría y una pregunta opcional. Usa el modelo ya configurado; no cambia la clave ni el modelo. Se envían el ejercicio, la explicación actual (hasta 600 caracteres), el número de ayudas y hasta tres preguntas anteriores de Luma. No se envían las explicaciones anteriores del niño, cookie, identificadores de acceso o recorrido. La conversación continúa solo en memoria; los puntos guardados no contienen texto y vuelven al modo local al recuperarse del disco.

La pregunta puede mostrarse en el primer seguimiento de una explicación `unclear`, `guess` o `denominator-error`, cuando no hay un filtro local. El motor decide por separado elección, avance, ayuda, pausa y cierre. Las necesidades de apoyo, las contradicciones conocidas y las instrucciones ajenas al ejercicio conservan las respuestas locales. No se generan todas las intervenciones ni se añade un chat general.

El modelo escribe la frase completa, pero debe usar un vocabulario acotado a preguntas sobre el proceso. Esto limita deliberadamente su expresividad. No se trata de elegir un índice de una lista de frases, aunque el filtro puede descartar muchas formulaciones válidas. No hay evidencia aún de que esta versión resulte más natural con el proveedor real.

## Controles y alternativa local

Se solicita JSON estricto con `category` y `question` (texto o `null`), sin otros campos, sin herramientas y con `store: false`. Se comprueban estado completo, un único mensaje del asistente, contenido permitido y categoría válida. Una respuesta de clasificación antigua sin pregunta conserva compatibilidad y usa guía local.

La pregunta debe ocupar 20–180 caracteres, ser una sola interrogación en español, contener solo letras y espacios dentro de los signos y usar vocabulario aprobado. No se admiten números, operaciones, nombres de opciones, enlaces, HTML, citas del niño, afirmaciones o varios enunciados. Debe referirse al ejercicio o a sus partes/cantidades/pasos conocidos y superar la comparación con las tres preguntas anteriores. El tutor vuelve a comprobarla justo antes de mostrarla. Una pregunta aceptada no cambia la categoría ni acredita comprensión.

Una propuesta descartada conserva la clasificación válida y la pregunta local. Error, rechazo, salida incompleta o estructura inesperada recuperan la evaluación local. No hay una segunda llamada para reformular. Se mantienen 10 segundos por llamada, 10 llamadas por expedición y hasta 100 por arranque (reducibles con `LUMA_AI_MAX_CALLS`); la respuesta conjunta usa como máximo 250 tokens de salida. Las herramientas anteriores de clasificación aislada siguen con 150. El límite del navegador sigue siendo 15 segundos.

Estos controles reducen posibilidades de respuesta; no certifican seguridad semántica, utilidad ni precisión pedagógica. Un clasificador puede aceptar una explicación insuficiente o rechazar una válida. Un vocabulario aprobado no garantiza que una pregunta sea clara o útil.

Implementación contrastada con la documentación oficial de [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs): el esquema estructura la respuesta; los controles de contenido siguen siendo responsabilidad de Luma. `store: false` no equivale a retención cero del proveedor.

## Evaluación realizada

- 328 pruebas automáticas aprobadas, incluidos HTTP real local y proveedores simulados.
- Nueve escenarios de integración, 16 turnos: seguimiento de fracciones/patrones/lógica, elección revisada, propuesta con solución, salida ajena al ejercicio, fallo de conexión, rechazo, filtro previo y elección incorrecta ante clasificador permisivo. Todos pasan; 12 llamadas simuladas, cero reales.
- Regresiones anteriores: 88/88 casos, 78/78 variaciones, diez conversaciones y doce conversaciones ampliadas aprobadas.
- Interfaz con proveedor simulado y datos ficticios: pregunta visible, foco en editor, borrador exacto con salto de línea al pausar/reanudar, explicación válida posterior y foco en Siguiente. Consola sin errores ni avisos observados.
- Anchos reales observados 390, 768 y 1440 px, sin desbordamiento horizontal del documento. Se guardaron capturas de escritorio y móvil. No se verificaron teclado virtual, Safari/iOS/Android físicos, lectura de pantalla ni eficacia con niños.

Los escenarios son de autoría para comprobar la integración. No son un conjunto independiente ni representativo de lenguaje infantil; pasar los casos conocidos no mide precisión general. La captura usa un proveedor simulado, no una respuesta real de OpenAI. No se afirma una tasa de filtrado de propuestas reales.

Evidencia: informe offline, pruebas, interfaz, escritorio, móvil simulado.

## Latencia, tokens y coste

El panel adulto muestra llamadas, clasificaciones recibidas, propuestas aceptadas/descartadas por el filtro, tokens comunicados por el proveedor y espera de la última llamada/máximo observado. Propuesta aceptada no significa pregunta mostrada: el estado del ejercicio puede preferir ayuda o cierre. No se guardan diagnósticos crudos del proveedor.

Los contadores de tokens pueden ser incompletos si una llamada falla sin informar uso. El informe de evaluación indica cuántas llamadas carecen de ese dato. Los tokens y tiempos de la evaluación offline son simulados: no son factura ni latencia real. Los límites son de llamadas y salida, no de euros.

```sh
npm run eval:adaptive
npm run preview:adaptive
```

La vista simulada abre `localhost:4174`, sin `.env`, API ni datos del servidor principal. Activa el modo simulado en Opciones para adultos para probar el seguimiento y detén el fixture al terminar.

La evaluación real se ejecutó posteriormente en 0.9.0, con ocho llamadas; detectó cero preguntas mostradas. Véase el resultado y el ajuste pendiente de validar de 0.9.1. El comando preparado es:

```sh
npm run eval:adaptive:live
```

Realiza como máximo ocho llamadas reales con textos ficticios, guarda `evaluacion-real.json` y exige revisar manualmente los resultados. No usa los resultados simulados para afirmar un aprobado automático del modelo. Opcionalmente se pueden añadir `-- --input-usd-per-million=PRECIO --output-usd-per-million=PRECIO` con los precios comprobados del modelo; el cálculo cubre solo el uso comunicado y no inventa precios ni costes de llamadas sin datos. Los escenarios posteriores al límite usan guía local y deben distinguirse del comportamiento del modelo.

## Entrega y pendientes

Las 36 fichas adultas se regeneraron; sus decisiones humanas siguen pendientes. Demo móvil aislada y guion del piloto preparados. No se leyó ni mostró `.env`, no hubo API de pago, instalación, publicación o borrado de progreso real. La demo se comprobó en loopback y no se abrió la Wi-Fi. En esta entrega inicial no se había realizado revisión real. La continuación de 0.9.1 registra las ocho llamadas y sus limitaciones; el móvil físico y el piloto siguen pendientes.

Actualización 0.9.2 · 21 de octubre: nueva evaluación real y ajuste de descartes. Tres preguntas mostradas en ocho llamadas y las seis propuestas verificadas por reproducción tras revisión del vocabulario; no confundir reproducción con nueva generación.


_Public source note: references to omitted private operational or historical evidence are retained as plain labels. This snapshot does not reproduce that evidence._
