import { extraFractions, extraPatterns, extraLogic } from './extra-lessons.js';
export const fractionLessons = [
  { id: 'pizza', title: 'Un trocito de pizza', context: 'Dos pizzas del mismo tamaño. Una se corta en 3 partes iguales y la otra en 4.', prompt: '¿Qué porción es más grande?', fractions: [[1, 3], [1, 4]], kind: 'same-numerator', unit: 'pizza', challenge: true },
  { id: 'chocolate', title: 'Compartimos chocolate', context: 'Dos tabletas iguales, divididas en 8 partes. Comparamos 3 partes con 5 partes.', prompt: '¿Qué cantidad es más grande?', fractions: [[3, 8], [5, 8]], kind: 'same-denominator', unit: 'chocolate', challenge: false },
  { id: 'garden', title: 'Un pequeño jardín', context: 'Dos jardines del mismo tamaño. En uno hay flores en 2 de 5 partes; en el otro, en 2 de 7.', prompt: '¿Dónde ocupan más espacio las flores?', fractions: [[2, 5], [2, 7]], kind: 'same-numerator', unit: 'jardín', challenge: true },
  { id: 'ribbon', title: 'Cintas de colores', context: 'Dos cintas iguales, divididas en 6 partes. Comparamos 4 partes con 2 partes.', prompt: '¿Qué cantidad de cinta es más larga?', fractions: [[4, 6], [2, 6]], kind: 'same-denominator', unit: 'cinta', challenge: false },
  { id: 'transfer', title: 'Ahora, a tu manera', context: 'Dos botellas iguales. Una contiene 3/4 de su capacidad y la otra 3/8.', prompt: '¿Cuál contiene más agua?', fractions: [[3, 4], [3, 8]], kind: 'same-numerator', unit: 'botella', challenge: true, transfer: true },
];

const patternLessons = [
  { id: 'steps', title: 'Pasos de gigante', context: 'En un camino aparecen estos números. Observa cómo cambia cada paso.', prompt: '¿Qué número continúa el patrón?', sequence: [2, 5, 8, 11], options: [14, 15], kind: 'pattern', rule: 'add', step: 3, challenge: true,
    question: '¿Qué cambia de un número al siguiente? Compruébalo en más de un paso.', rubric: 'Each consecutive term increases by 3. Applying the same increase gives the next term.', reasoningPatterns: ['(sum|añad|aument|agreg|mas|salto|sub|avanz).{0,35}(3|tres)', '(3|tres).{0,35}(sum|añad|aument|agreg|mas|salto|sub|avanz)'],
    hints: ['Compara dos números vecinos. ¿La distancia entre ellos se repite?', 'Los saltos del dibujo muestran qué cambia. ¿Funcionaría tu regla en todos los pasos?', 'Otro camino: 1, 5, 9… Cada paso suma 4. ¿Qué salto se repite en tu camino?'], completion: 'Has encontrado un cambio que se repite y lo has comprobado.' },
  { id: 'doubling', title: 'Un jardín que crece', context: 'Contamos las semillas de cuatro macetas. En cada maceta sucede lo mismo.', prompt: '¿Cuántas semillas tendrá la siguiente?', sequence: [3, 6, 12, 24], options: [27, 48], kind: 'pattern', rule: 'double', challenge: true,
    question: '¿Qué operación lleva de una maceta a la siguiente? Pruébala en dos parejas.', rubric: 'Each term is twice the preceding term. Multiplying by two or adding the preceding term to itself explains the rule.', reasoningPatterns: ['dobl|duplic|dos veces', '(multiplic|por).{0,12}(2|dos)'],
    hints: ['¿El aumento es siempre igual? Compara el primer salto con el segundo.', 'Mira las parejas de números. ¿Qué relación se repite entre ellos?', 'Otro ejemplo: 2, 4, 8… Cada número es el doble del anterior. ¿Qué relación ves en tus macetas?'], completion: 'Has comprobado la relación entre varios números, no solo entre dos.' },
  { id: 'countdown', title: 'La cuenta atrás', context: 'Un robot baja escalones y anota el número de cada parada.', prompt: '¿En qué número hará su próxima parada?', sequence: [25, 21, 17, 13], options: [9, 10], kind: 'pattern', rule: 'add', step: -4, challenge: false,
    question: '¿Cuántos escalones baja cada vez? ¿Se cumple también en la primera parada?', rubric: 'Each term decreases by four. Subtracting four explains the next term.', reasoningPatterns: ['(rest|menos|baj|quit|dismin).{0,25}(4|cuatro)', '(4|cuatro).{0,25}(rest|menos|baj|quit|dismin)'],
    hints: ['Fíjate en la dirección: ¿los números crecen o disminuyen?', 'Compara la distancia entre cada pareja. ¿Hay un salto constante?', 'Otro recorrido: 18, 15, 12… Restamos 3 cada vez. ¿Qué cambia en el recorrido del robot?'], completion: 'Has usado una regla para comprobar el siguiente paso.' },
  { id: 'new-jumps', title: 'Saltos en otro planeta', context: 'Estos números cuentan las piedras que recoge un explorador en cada parada.', prompt: '¿Qué número sigue si la regla se mantiene?', sequence: [7, 12, 17, 22], options: [26, 27], kind: 'pattern', rule: 'add', step: 5, challenge: true, transfer: true,
    question: '¿Qué regla propones? Comprueba que funciona en todas las paradas.', rubric: 'Each term increases by five. Adding five consistently explains the next term.', reasoningPatterns: ['(sum|añad|aument|agreg|mas|salto|sub|avanz).{0,35}(5|cinco)', '(5|cinco).{0,35}(sum|añad|aument|agreg|mas|salto|sub|avanz)'],
    hints: ['Prueba tu regla con la primera pareja y después con la última.', 'El dibujo muestra los cambios entre paradas. ¿Qué tienen en común?', 'En otro planeta aparecen 4, 10, 16… Allí se suma 6. Busca el salto que se repite en este planeta.'], completion: 'Has explicado una regla en un contexto nuevo.' },
];

const logicLessons = [
  { id: 'boxes', title: 'La llave escondida', context: 'Hay tres cajas: roja, azul y verde. Una guarda una llave. Sabemos que la llave no está en la roja ni en la azul.', prompt: '¿En qué caja puede estar la llave?', options: ['En la verde', 'En la roja'], kind: 'logic', correct: 0, challenge: true,
    question: '¿Qué cajas puedes descartar con las pistas? ¿Qué posibilidades quedan?', rubric: 'The red and blue boxes are excluded and only the green box remains among the three boxes.', reasoningPatterns: ['(roja.{0,40}azul|azul.{0,40}roja).{0,60}(descart|fuera|no|queda|verde)', '(descart|no esta|no puede).{0,60}(roja.{0,40}azul|azul.{0,40}roja)'],
    hints: ['Revisa cada pista por separado. ¿Qué caja elimina cada una?', 'Compara las opciones con las pistas escritas. ¿Hay alguna contradicción?', 'Otro ejemplo: una moneda está en uno de dos vasos. Si descartas el primero, solo queda el segundo. ¿Qué puedes descartar aquí?'], completion: 'Has usado las pistas para descartar posibilidades.' },
  { id: 'cards', title: 'Las tarjetas del club', context: 'En este juego, TODAS las tarjetas rojas tienen una estrella. Encontramos una tarjeta roja.', prompt: '¿Qué sabemos seguro de esa tarjeta?', options: ['Tiene un círculo', 'Tiene una estrella'], kind: 'logic', correct: 1, challenge: true,
    question: '¿Qué dice la regla sobre todas las tarjetas rojas? ¿Esta tarjeta cumple esa condición?', rubric: 'All red cards have a star and this card is red, so applying the rule proves it has a star.', reasoningPatterns: ['(todas|regla).{0,80}(roja|estrella)', '(roja|estrella).{0,80}(todas|regla)'],
    hints: ['La palabra «todas» nos dice algo. ¿Hay excepciones en esta regla?', 'Relaciona la característica de la tarjeta con la condición de la regla.', 'Otra regla: todos los triángulos de un juego tienen un punto. Si encuentras un triángulo, ¿qué puedes asegurar? Vuelve a la tarjeta.'], completion: 'Has conectado una regla general con un caso concreto.' },
  { id: 'some', title: '¿Seguro o posible?', context: 'ALGUNOS perros del parque llevan un collar azul. Luna es un perro de ese parque. No sabemos nada más.', prompt: '¿Podemos asegurar que Luna lleva un collar azul?', options: ['Sí, podemos asegurarlo', 'No, faltan datos'], kind: 'logic', correct: 1, challenge: true,
    question: '¿«Algunos» nos habla de todos los perros? ¿Qué sabemos específicamente de Luna?', rubric: 'Some does not mean all. The facts do not establish whether Luna is one of the dogs with a blue collar.', reasoningPatterns: ['algunos.{0,35}no.{0,35}todos', 'no todos.{0,70}(collar|perro|azul)', '(falta|no sabemos|no se sabe).{0,70}(dato|informacion|luna|collar|perro)'],
    hints: ['Piensa en la diferencia entre «algunos» y «todos».', 'Separa lo que dice la pista de lo que todavía no sabemos.', 'Otro ejemplo: algunas frutas de una cesta son manzanas. Eso no permite asegurar que una fruta concreta sea una manzana. ¿Qué información falta sobre Luna?'], completion: 'Has distinguido lo que sabemos de lo que solo es posible.' },
  { id: 'number-clues', title: 'Todas las pistas cuentan', context: 'Buscamos un número par, mayor que 4 y menor que 8. Una opción debe cumplir las tres pistas.', prompt: '¿Cuál de estas opciones cumple todas las pistas?', options: [6, 5], kind: 'logic', correct: 0, challenge: true, transfer: true,
    question: 'Comprueba cada opción con cada pista. ¿Cumple todas o solo algunas?', rubric: 'Six is even, greater than four and less than eight; five is not even. An explanation should check evenness and the bounds, or eliminate five because it is odd and check six.', reasoningPatterns: ['par.{0,90}(mayor|menor|entre|4|cuatro|8|ocho)', '(mayor|menor|entre|4|cuatro|8|ocho).{0,90}par'],
    hints: ['Haz una comprobación por cada pista. ¿Cuál te ayuda a descartar una opción?', 'Compara ambas opciones con «par», «mayor que 4» y «menor que 8».', 'Otro juego pide un número impar entre 10 y 14. El 11 cumple las pistas; el 12 falla en una. ¿Cómo comprobarías tus opciones?'], completion: 'Has comprobado varias condiciones en una situación nueva.' },
];

fractionLessons.forEach((lesson, index) => Object.assign(lesson, { level: [1, 1, 2, 2, 2][index], skill: lesson.kind, review: 'pending' }));
patternLessons.forEach((lesson, index) => Object.assign(lesson, { level: [1, 2, 1, 2][index], skill: lesson.rule === 'double' ? 'double' : lesson.step < 0 ? 'subtract' : 'add', review: 'pending' }));
logicLessons.forEach((lesson, index) => Object.assign(lesson, { level: [1, 1, 2, 2][index], reasoningType: ['exclude', 'all', 'some', 'bounds'][index], skill: ['exclude', 'all', 'some', 'bounds'][index], review: 'pending' }));

export const missions = [
  { id: 'fractions', title: 'Un mundo en partes', topic: 'Fracciones', tag: 'Matemáticas', icon: '½', color: 'sage', description: 'Compara cantidades y descubre por qué una parte puede ser más grande.', skill: 'Comparar y explicar', minutes: '10–15 min', defaultRoute: fractionLessons.map(lesson => lesson.id), lessons: [...fractionLessons, ...extraFractions] },
  { id: 'patterns', title: 'Detectives de patrones', topic: 'Patrones', tag: 'Matemáticas', icon: '↗', color: 'lavender', description: 'Encuentra una regla, ponla a prueba y descubre el siguiente paso.', skill: 'Buscar y comprobar reglas', minutes: '10–15 min', defaultRoute: patternLessons.map(lesson => lesson.id), lessons: [...patternLessons, ...extraPatterns] },
  { id: 'logic', title: 'El club de las pistas', topic: 'Lógica', tag: 'Razonamiento', icon: '◇', color: 'peach', description: 'Sigue las pistas y distingue lo que sabes de lo que todavía no sabes.', skill: 'Deducir y cuestionar', minutes: '10–15 min', defaultRoute: logicLessons.map(lesson => lesson.id), lessons: [...logicLessons, ...extraLogic] },
];

// State the assumptions used by the authored comparisons without identifying the winning option.
missions.find(mission => mission.id === 'fractions').lessons.forEach(lesson => {
  lesson.context += ' Siempre dividimos en partes iguales.';
});
missions.find(mission => mission.id === 'patterns').lessons.forEach(lesson => {
  lesson.context += ' En este juego, repetimos una suma, una resta o un doble.';
});
missions.find(mission => mission.id === 'logic').lessons.filter(lesson => lesson.reasoningType === 'bounds').forEach(lesson => {
  lesson.prompt = '¿Cuál de estas opciones cumple todas las pistas?';
});

// These facts are already stated in the context; no conclusion or answer is added.
missions.find(mission => mission.id === 'logic').lessons.filter(lesson => lesson.reasoningType === 'all').forEach(lesson => {
  lesson.context += lesson.id === 'tickets' ? ' Una entrada puede permitir visitar más de un lugar.' : ' En este juego, un objeto puede tener más de un dibujo.';
  lesson.prompt = '¿Qué podemos asegurar con esta regla?';
  lesson.rubric += ' This proves the stated property, not exclusivity or absence of other properties. It does not establish the converse implication. Do not credit an assertion that the case has only that property or cannot have another property.';
});
missions.find(mission => mission.id === 'logic').lessons.filter(lesson => lesson.reasoningType === 'some').forEach(lesson => {
  lesson.rubric += ' Some establishes that at least one member has the property. It does not establish that any member lacks it: all members might have it. Do not credit an asserted exception or "only some" as a deduction from these facts. Distinguish a hypothetical possibility from an assertion; accept missing case-specific evidence.';
});
missions.find(mission => mission.id === 'logic').lessons.filter(lesson => lesson.reasoningType === 'bounds').forEach(lesson => {
  const parity = /\bimpar\b/.test(lesson.context) ? 'El número debe ser impar.' : 'El número debe ser par.';
  const bounds = lesson.context.match(/mayor que (\d+) y menor que (\d+)/);
  if (bounds) lesson.facts = [parity, `Debe ser mayor que ${bounds[1]}.`, `Debe ser menor que ${bounds[2]}.`];
});

export function getMission(id = 'fractions') {
  const mission = missions.find(item => item.id === id);
  if (!mission) throw new Error('Recorrido no disponible.');
  return mission;
}

export function missionInfo(mission) {
  const { lessons, defaultRoute, ...info } = mission;
  return { ...info, total: lessons.length, sessionLength: 5, lessonIds: lessons.map(lesson => lesson.id), lessonTitles: lessons.map(lesson => lesson.title) };
}

export function publicLesson(lesson) {
  const { correct, reasoningPatterns, rubric, rule, step, question, hints, completion, reasoningType, skill, ...visible } = lesson;
  return visible;
}

// One question per intervention; none identifies the winning option.
const reasoningQuestions = {
  'same-numerator': '¿Cómo cambia el tamaño de cada parte al dividir la misma cantidad de otra manera?',
  'same-denominator': '¿Cómo compararías cuántas partes del mismo tamaño hay en cada cantidad?',
  pattern: '¿Cómo comprobarías tu regla en otra pareja del camino?',
  exclude: '¿Qué posibilidad queda al aplicar todas las pistas?',
  all: '¿Qué puedes asegurar al aplicar la regla a este caso?',
  some: '¿Qué dato tienes sobre este caso concreto?',
  bounds: '¿Cómo comprobarías tu elección con las tres pistas?'
};
for (const mission of missions) for (const lesson of mission.lessons) {
  lesson.question = reasoningQuestions[lesson.reasoningType ?? lesson.kind];
  if (lesson.kind === 'pattern') lesson.completion = 'Has explicado una regla para este patrón.';
}
