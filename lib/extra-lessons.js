const fraction = (id, title, context, fractions, kind, level, transfer = false) => ({ id, title, context, prompt: '¿Qué cantidad es más grande?', fractions, kind, level, unit: 'barra', challenge: true, transfer, skill: kind, review: 'pending' });
export const extraFractions = [
  fraction('juice', 'Zumo para la excursión', 'Dos jarras iguales. Comparamos 1 de 2 partes con 1 de 6 partes de la misma capacidad.', [[1, 2], [1, 6]], 'same-numerator', 1),
  fraction('mosaic', 'El mosaico del faro', 'Dos mosaicos iguales divididos en 5 partes. En uno pintamos 2 partes y en otro 4.', [[2, 5], [4, 5]], 'same-denominator', 1),
  fraction('sails', 'Velas al viento', 'Dos velas de barco del mismo tamaño. Comparamos 2 de 3 partes de una con 2 de 6 de la otra.', [[2, 3], [2, 6]], 'same-numerator', 2),
  fraction('trail', 'El camino iluminado', 'Dos caminos iguales divididos en 10 tramos. Hay luz en 7 tramos de uno y en 4 del otro.', [[7, 10], [4, 10]], 'same-denominator', 2, true),
  fraction('reservoir', 'Agua en la isla', 'Dos depósitos iguales. Comparamos 3 de 5 partes con 3 de 10 partes de su capacidad.', [[3, 5], [3, 10]], 'same-numerator', 3),
  fraction('paint-transfer', 'Pintura para un mural', 'Dos botes iguales. Comparamos 1 de 2 partes con 1 de 4 partes de su capacidad.', [[1, 2], [1, 4]], 'same-numerator', 1, true),
  fraction('rope-transfer', 'Cuerdas para el puente', 'Dos cuerdas iguales. Comparamos 3 de 7 partes de una con 3 de 5 partes de la otra.', [[3, 7], [3, 5]], 'same-numerator', 3, true),
];
function pattern(id, title, context, sequence, options, step, level, transfer = false) {
  const double = step === 'double'; const negative = !double && step < 0;
  const amount = double ? 2 : Math.abs(step);
  return { id, title, context, prompt: '¿Qué número continúa el patrón?', sequence, options, kind: 'pattern', rule: double ? 'double' : 'add', step: double ? undefined : step, level, transfer, challenge: true, skill: double ? 'double' : negative ? 'subtract' : 'add', review: 'pending',
    question: '¿Qué cambia de una parada a la siguiente? Comprueba tu regla en dos parejas.',
    hints: ['Elige dos números vecinos. ¿Cómo pasas de uno al otro?', 'Compara varias parejas en la mesa de exploración. ¿Funciona la misma regla?', double ? 'Otro ejemplo: 5, 10, 20… Cada número es el doble del anterior. ¿Cómo comprobarías tu camino?' : negative ? 'Otro recorrido: 16, 13, 10… Quitamos 3 cada vez. ¿Qué sucede en tu recorrido?' : amount === 4 ? 'Otro recorrido: 2, 5, 8… Añadimos 3 cada vez. ¿Qué cambia en tu recorrido?' : 'Otro recorrido: 1, 5, 9… Añadimos 4 cada vez. ¿Qué cambia en tu recorrido?'],
    rubric: double ? 'Each term is twice the previous term.' : `Each term changes by ${step}. The explanation should identify the direction and size of this repeated change.`,
    reasoningPatterns: [double ? 'dobl|duplic|multiplic.{0,20}(2|dos)' : `${negative ? '(rest|baj|quit|menos)' : '(sum|añad|aument|mas)'}.{0,30}${amount}`],
    completion: 'Has comprobado una regla en varias parejas.' };
}
export const extraPatterns = [
  pattern('shells', 'Conchas en la orilla', 'Contamos las conchas reunidas en cuatro paradas.', [1, 3, 5, 7], [9, 10], 2, 1),
  pattern('lanterns', 'Luces del puerto', 'Observa cuántos faroles se encienden en cada fila.', [4, 8, 12, 16], [19, 20], 4, 2),
  pattern('robot', 'El robot regresa', 'El robot anota el número de cada parada en su camino de vuelta.', [18, 16, 14, 12], [10, 11], -2, 1),
  pattern('bubbles', 'Burbujas en el aire', 'Cada grupo de burbujas sigue la misma relación.', [2, 4, 8, 16], [18, 32], 'double', 2),
  pattern('stairs', 'Las escaleras del faro', 'Estas marcas indican cada parada de una subida.', [6, 13, 20, 27], [33, 34], 7, 3),
  pattern('countdown-transfer', 'Batería de la nave', 'La nave anota cuántas unidades de energía quedan en cuatro momentos. Entre ellos ocurre el mismo cambio.', [40, 34, 28, 22], [16, 18], -6, 3, true),
  pattern('flowers-transfer', 'Flores en otro jardín', 'Una exploradora registra nuevas flores en cada parada.', [3, 5, 7, 9], [11, 12], 2, 1, true),
  pattern('double-transfer', 'Mensajes de la isla', 'Contamos los mensajes de cuatro rondas. Observa cómo cambia la cantidad.', [4, 8, 16, 32], [36, 64], 'double', 3, true),
];
function logic(id, title, context, prompt, options, correct, level, type, patterns, rubric, transfer = false) {
  return { id, title, context, prompt, options, correct, kind: 'logic', level, reasoningType: type, skill: type, reasoningPatterns: patterns, rubric, transfer, challenge: true, review: 'pending',
    question: type === 'some' ? '¿La pista habla de todos o solo de algunos? ¿Qué sabemos de este caso?' : type === 'all' ? '¿Cuál es la regla y qué condición cumple este caso?' : type === 'bounds' ? 'Comprueba cada condición por separado. ¿Tu elección cumple todas?' : '¿Qué posibilidades puedes descartar con las pistas? ¿Qué queda?',
    hints: ['Revisa una pista cada vez. ¿Qué te permite afirmar?', 'Marca los hechos que has revisado. ¿Tu conclusión respeta todas las pistas?', type === 'some' ? 'Otro ejemplo: algunas frutas son manzanas. Una fruta concreta podría ser una pera. ¿Qué dato falta en tu caso?' : type === 'all' ? 'Otro juego: todos los triángulos tienen un punto. Si ves un triángulo, ¿qué puedes asegurar? Aplica tu regla.' : type === 'bounds' ? 'Otro juego busca un número impar entre 10 y 14. El 11 cumple las condiciones. ¿Cómo comprobarías las tuyas?' : 'Otra búsqueda: una moneda está en uno de dos vasos. Si descartas uno, queda el otro. ¿Qué puedes descartar aquí?'],
    completion: 'Has relacionado tu elección con los hechos del problema.' };
}
export const extraLogic = [
  logic('backpacks', 'La mochila del mapa', 'El mapa está en una de tres mochilas: naranja, morada y gris. No está en la naranja ni en la gris.', '¿Dónde puede estar el mapa?', ['En la morada', 'En la gris'], 0, 1, 'exclude', ['(naranja.{0,50}gris|gris.{0,50}naranja).{0,70}(no|descart|queda|morada)', '(no esta|descart).{0,70}(naranja|gris).{0,70}(naranja|gris|morada)'], 'Orange and grey are excluded; purple remains.'),
  logic('tickets', 'La entrada al observatorio', 'TODAS las entradas azules permiten entrar al observatorio. Tenemos una entrada azul. El observatorio es un lugar para mirar el cielo.', '¿Qué permite esa entrada?', ['Entrar al observatorio', 'Solo entrar al jardín'], 0, 1, 'all', ['(todas|regla).{0,80}(azul|observatorio)', '(azul|observatorio).{0,80}(todas|regla)'], 'All blue tickets admit to the observatory; this ticket is blue.'),
  logic('birds', 'Pájaros del bosque', 'ALGUNOS pájaros del bosque tienen plumas amarillas. Pipo es un pájaro de ese bosque. No sabemos nada más.', '¿Sabemos seguro que Pipo tiene plumas amarillas?', ['Sí, seguro', 'No, falta información'], 1, 2, 'some', ['algunos.{0,35}no.{0,35}todos', 'no todos.{0,70}(pluma|pajaro|amarill)', '(falta|no sabemos|no se sabe).{0,70}(dato|informacion|pipo|pluma)'], 'Some does not mean all, and no evidence identifies Pipo as yellow.'),
  logic('even-small', 'El número de la puerta', 'La puerta pide un número par, mayor que 2 y menor que 6. Debe cumplir las tres pistas.', '¿Qué número sirve?', [3, 4], 1, 1, 'bounds', ['par.{0,90}(mayor|menor|entre|2|dos|6|seis)', '(mayor|menor|entre|2|dos|6|seis).{0,90}par'], 'Four is even and strictly between two and six; three is odd.'),
  logic('odd-large', 'El código del telescopio', 'Buscamos un número impar, mayor que 12 y menor que 16. Debe cumplir todas las condiciones.', '¿Qué código cumple las pistas?', [14, 15], 1, 3, 'bounds', ['impar.{0,90}(mayor|menor|entre|12|doce|16|dieciseis)', '(mayor|menor|entre|12|doce|16|dieciseis).{0,90}impar'], 'Fifteen is odd and strictly between twelve and sixteen.'),
  logic('boats-transfer', 'Barcos del nuevo puerto', 'ALGUNOS barcos del puerto tienen una vela blanca. El Brisa es un barco de ese puerto. No sabemos el color de su vela.', '¿Podemos asegurar que su vela es blanca?', ['No, faltan datos', 'Sí, porque está en el puerto'], 0, 1, 'some', ['algunos.{0,35}no.{0,35}todos', 'no todos.{0,70}(barco|vela|blanca)', '(falta|no sabemos|no se sabe).{0,70}(dato|informacion|vela|brisa)'], 'Membership in the port does not establish sail color.', true),
  logic('badges-transfer', 'El club de exploradores', 'TODAS las insignias verdes de este club tienen una luna. Encontramos una insignia verde del club. Una insignia es un pequeño distintivo.', '¿Qué sabemos de la insignia?', ['Tiene un sol', 'Tiene una luna'], 1, 2, 'all', ['(todas|regla).{0,80}(verde|luna)', '(verde|luna).{0,80}(todas|regla)'], 'The universal rule applies to this green badge.', true),
  logic('odd-transfer', 'La última señal', 'Una señal pide un número impar, mayor que 6 y menor que 10. Hay que comprobar las tres condiciones.', '¿Qué número podemos usar?', [8, 9], 1, 3, 'bounds', ['impar.{0,90}(mayor|menor|entre|6|seis|10|diez)', '(mayor|menor|entre|6|seis|10|diez).{0,90}impar'], 'Nine is odd and strictly between six and ten.', true),
];
