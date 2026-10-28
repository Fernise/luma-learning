# Seguridad y cookies · revisión técnica local 0.8.14

7 de octubre de 2026. Revisión del código y pruebas con datos ficticios, sin leer `.env`, enviar explicaciones reales ni llamar a proveedores de pago. No es una auditoría externa ni una certificación de cumplimiento. La aplicación sigue limitada a loopback; no se ha publicado.

## Inventario

| Elemento | Uso | Duración y alcance |
| --- | --- | --- |
| Cookie `luma_device` | Vincular este navegador con el progreso guardado, tras activar la opción | `Max-Age=31536000`, un año desde su emisión, comprobado también por el servidor; `HttpOnly`, `SameSite=Strict`, `Path=/`, sin `Domain` |
| `sessionStorage`, `luma.session.v1` | Identificador secreto para acceder a la actividad de esa pestaña | Duración de la pestaña, sujeta a recuperación del navegador; accesible al JavaScript de la app |
| `localStorage`, `luma.progress.v1` | Lectura de resúmenes antiguos para compatibilidad | No contiene conversaciones; la versión actual guarda nuevos resúmenes en SQLite |
| SQLite local | Hasta 20 resúmenes y 20 puntos de reanudación por dispositivo | Puntos hasta siete días; resúmenes sin caducidad temporal automática, hasta borrado o límite de cantidad |
| Memoria del servidor | Actividad y conversación reciente | Hasta 30 mensajes por sesión y una hora sin turnos; desaparece al reiniciar |

No se observan scripts, cookies de publicidad, analítica o recursos de terceros en el código de la interfaz infantil. La IA opcional es un envío explícito y separado del ejercicio y la explicación al proveedor; esta revisión no lo activó. El guardado permanece desactivado inicialmente y no se emite cookie al abrir una página o iniciar una actividad. La activación de la opción es una señal técnica del cliente: no verifica por sí sola que quien la activa sea adulto.

El servidor también caduca la credencial al cumplirse un año desde su última emisión explícita. Una cookie antigua copiada no recupera acceso después de ese plazo. La emisión explícita actualiza el momento registrado en la tabla existente de dispositivos; no requiere migración ni borra resúmenes.

La duración de la cookie no es la retención de SQLite. Expirar o quitar una cookie mediante el navegador no borra automáticamente los registros locales, y puede perderse su vinculación. El botón de borrado y la desactivación del guardado sí eliminan los registros vinculados y expiran la cookie. No se borraron datos existentes durante esta revisión. La política de retención temporal de resúmenes queda pendiente de decisión antes de publicar.

`HttpOnly` impide leer esta cookie mediante JavaScript; no evita que una inyección actúe con los permisos de la página. `SameSite` limita solicitudes entre sitios, pero no sustituye todos los controles de CSRF. Sin `Domain` la cookie se limita al host emisor; los puertos no aíslan cookies. Véanse [los atributos de Set-Cookie en MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) y [las recomendaciones de sesiones de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Cambios comprobados

| Hallazgo | Corrección | Evidencia |
| --- | --- | --- |
| `Host` se interpretaba como URL y aceptaba formatos con usuario, ruta o codificación | Autoridades locales literales del puerto actual; origen exacto y rechazo de solicitudes marcadas cross-site | Pruebas HTTP en la app y la vista adulta |
| Se escogía la primera cookie coincidente, ignorando duplicados o valores malformados | Rechazo de credenciales ambiguas antes de acceder a datos; no emitir ni borrar cookies en esa petición | GET, DELETE y activación devuelven 400 sin exponer tokens |
| Activar guardado con una sesión ajena podía crear una cookie y aparentar éxito, aunque no tomara posesión de la sesión | Comprobar propietario y formato antes de activar o emitir una cookie | Otro navegador y la ausencia de cookie no pueden adjuntar, consultar, modificar o borrar una sesión vinculada, incluso conociendo su ID |
| Decodificar cada fragmento de petición podía alterar UTF-8 partido | Limitar bytes crudos a 4096, reunirlos y decodificar una vez; rechazar UTF-8 inválido | Explicación con acento partido y emoji preservada; bytes inválidos y exceso no cambian el estado |
| Vista adulta sin controles de Host/origen ni CSP | Mismos controles locales, CSP con hashes del script y estilo generados, sin unsafe-inline | Hashes exactos comprobados; búsqueda y filtro funcionan en navegador |
| Protección adicional de respuestas | `X-Frame-Options: DENY`, CORP same-origin, nosniff, no-referrer, CSP y no-store | Cabeceras en rutas válidas e inexistentes |
| La duración se imponía solo en el navegador, no al validar la credencial | Caducidad de un año también en el servidor; rechazar acceso y turnos con una credencial vencida | Reloj simulado: límite exacto, reemisión y bloqueo de la sesión en memoria |
| Texto de cookies incompleto en las opciones | Explicar función, duración, ausencia de publicidad y retirada | Captura del diálogo en instancia aislada, sin activar el guardado |

La cookie válida existente conserva nombre, formato y duración: no hay migración destructiva. La cookie de retirada conserva host y ruta y establece `Max-Age=0`. No se añadió `Secure` a esta beta HTTP; una publicación requiere HTTPS y cookie Secure, con configuración explícita del dominio y proxy. No debe exponerse este servidor sin esa preparación. [MDN explica Secure y las excepciones locales](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#secure); [OWASP recomienda TLS para proteger sesiones](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#transport-layer-security).

## Otras protecciones revisadas

La app no ofrece CORS a otros orígenes y requiere JSON para peticiones con cuerpo. Las acciones y sus campos están restringidos; la revisión del turno evita reenvíos obsoletos. Las rutas públicas están enumeradas, no permiten leer archivos arbitrarios y no sirven `.env`, la base ni código del servidor. El texto de las explicaciones se añade con `textContent`, no con HTML generado por el alumno. SQLite usa parámetros y guarda hashes de las credenciales, excluyendo conversación y texto escrito. Las pruebas anteriores mantienen aislamiento y recuperación tras reinicio, borrado durante interpretación, límites de IA y ausencia de texto/credenciales en claro en archivos de prueba.

Una sesión sin guardado utiliza su identificador aleatorio como credencial de acceso; no está vinculada a una cookie de dispositivo. Quien obtenga ese identificador puede acceder a la sesión mientras sea válida. Una vez vinculada al guardado requiere también la cookie correspondiente. Es una limitación documentada de la beta, no autenticación familiar ni verificación de identidad. Un proceso malicioso en el mismo ordenador queda fuera del aislamiento que ofrecen estas cabeceras y las pruebas.

## Resultado y pendientes

**176 pruebas pasan**, incluidas nueve nuevas para autoridades, cookies, aislamiento, UTF-8 y cabeceras. `npm test` usa entornos desechables y proveedores simulados. Captura: `artifacts/seguridad-cookies/opciones-cookies.png`. La comprobación visual de búsqueda/filtro de las fichas comprueba que la nueva CSP no impide su funcionamiento.

Antes de publicar: diseñar acceso familiar y consentimiento apropiado, configurar HTTPS/Secure y dominio, decidir retención/recuperación de cuentas y verificar tratamiento de datos infantiles y cookies del producto final. Hará falta limitar abuso de solicitudes y creaciones de dispositivos de forma persistente, además de las cotas actuales de sesiones y llamadas de IA. El límite global de IA se reinicia con el servidor; no es un presupuesto en euros. No se afirma ausencia total de vulnerabilidades ni cumplimiento legal a partir de pruebas técnicas. No se instalaron servicios, modificaron permisos, rotaron credenciales ni borraron datos del usuario.
