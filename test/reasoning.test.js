import test from 'node:test';
import assert from 'node:assert/strict';
import { getMission, missions } from '../lib/catalog.js';
import { assessLocally, advance, createSession, correctChoice, currentLesson } from '../lib/tutor.js';
const find = (mission, id) => getMission(mission).lessons.find(lesson => lesson.id === id);

test('sharing language can explain smaller portions without accepting a larger-portion claim', () => {
  const lesson = find('fractions', 'pizza');
  assert.equal(assessLocally('Si reparto la misma pizza entre más personas, le toca menos a cada una.', lesson), 'supported');
  assert.notEqual(assessLocally('Si reparto la misma pizza entre más personas, le toca más a cada una.', lesson), 'supported');
});
test('doubling accepts two checked self-additions but rejects an incorrect result or unrelated pairs', () => {
  const lesson = find('patterns', 'doubling');
  assert.equal(assessLocally('Seis más seis son doce y doce más doce son veinticuatro.', lesson), 'supported');
  for (const text of ['Seis más seis son trece y doce más doce son veinticuatro.', 'Cinco más cinco son diez y diez más diez son veinte.', 'Seis más seis son doce.']) assert.notEqual(assessLocally(text, lesson), 'supported');
});
test('missing case-specific evidence remains valid uncertainty without equating some with all', () => {
  const lesson = find('logic', 'some');
  assert.equal(assessLocally('Quizá todos los perros tengan collar azul, quizá no. De Luna no tenemos ese dato.', lesson), 'supported');
  assert.notEqual(assessLocally('Algunos significa todos.', lesson), 'supported');
});
test('bounds reasoning checks both limits instead of accepting a single inequality', () => {
  const lesson = find('logic', 'odd-large');
  for (const text of ['El quince es impar y menor que dieciséis.', 'El quince es impar y mayor que doce.', 'El quince es impar y mayor que diez y menor que dieciséis.']) assert.notEqual(assessLocally(text, lesson), 'supported');
  assert.equal(assessLocally('El quince es impar y mayor que doce y menor que dieciséis.', lesson), 'supported');
});
const cases = [
  ['fractions', 'pizza', 'La pizza es igual y al repartirla en más partes cada trozo es más pequeño.', 'supported'],
  ['fractions', 'pizza', 'Con menos cachos, cada cacho sale más grande.', 'supported'],
  ['fractions', 'pizza', 'Para más personas quedan trozos más chiquitos.', 'supported'],
  ['fractions', 'pizza', 'Hay más partes y todas son más grandes.', 'denominator-error'],
  ['fractions', 'pizza', 'Menos partes y trozos más pequeñas.', 'denominator-error'],
  ['fractions', 'pizza', 'No hay menos partes y trozos más grandes.', 'unclear'],
  ['fractions', 'chocolate', 'Son del mismo tamaño y cojo cinco frente a tres.', 'supported'],
  ['fractions', 'chocolate', 'Los cachos son iguales y hay más cachos.', 'supported'],
  ['fractions', 'chocolate', 'Tengo menos trozos iguales, por eso más cantidad.', 'unclear'],
  ['patterns', 'steps', 'Van de tres en tres.', 'supported'],
  ['patterns', 'steps', 'Añades 3 siempre.', 'supported'],
  ['patterns', 'steps', 'Sumo 4 cada vez.', 'unclear'],
  ['patterns', 'steps', 'Resto 3 cada vez.', 'unclear'],
  ['patterns', 'steps', 'Sumo 3 pero también sumo 4 en cada paso.', 'unclear'],
  ['patterns', 'steps', 'No sumo tres en cada paso.', 'unclear'],
  ['patterns', 'countdown', 'Quito cuatro cada vez.', 'supported'],
  ['patterns', 'countdown', 'Baja siempre 4.', 'supported'],
  ['patterns', 'doubling', 'Son dos veces lo de antes.', 'supported'],
  ['patterns', 'doubling', 'Multiplico por dos.', 'supported'],
  ['patterns', 'doubling', 'Es doble porque multiplico por tres.', 'unclear'],
  ['logic', 'some', 'No se puede asegurar porque solo algunos tienen ese collar.', 'unclear'],
  ['logic', 'some', 'Algunos no significa todos.', 'supported'],
  ['logic', 'some', 'Algunos significa todos.', 'unclear'],
  ['logic', 'cards', 'Todas las rojas tienen estrella y esta es roja.', 'supported'],
  ['logic', 'cards', 'Todas las rojas no tienen estrella.', 'unclear'],
  ['logic', 'cards', 'Todas roja estrella.', 'unclear'],
  ['logic', 'cards', 'Todas las rojas tienen un círculo y esta es roja.', 'unclear'],
  ['logic', 'tickets', 'Todas las entradas azules permiten entrar al jardín.', 'unclear'],
  ['logic', 'boxes', 'Descarto la roja y la azul, solo queda la verde.', 'supported'],
  ['logic', 'boxes', 'No descarto ni la roja ni la azul.', 'unclear'],
  ['logic', 'boxes', 'Descarto la roja y la azul y queda la roja.', 'unclear'],
  ['logic', 'number-clues', 'El seis es par y está entre cuatro y ocho.', 'supported'],
  ['logic', 'number-clues', 'Seis es impar y está entre cuatro y ocho.', 'unclear'],
  ['logic', 'number-clues', 'Cinco es par y está entre cuatro y ocho.', 'unclear'],
  ['logic', 'number-clues', 'Seis es par y está entre dos y diez.', 'unclear'],
  ['logic', 'odd-large', 'Es impar y está entre doce y dieciséis.', 'supported'],
  ['logic', 'odd-large', 'Es par y está entre doce y dieciséis.', 'unclear'],
];
for (const [mission, id, text, expected] of cases) test(`reasoning: ${id}: ${text}`, () => assert.equal(assessLocally(text, find(mission, id)), expected));

test('all 36 activities have at least one locally recognized explanation', () => {
  for (const lesson of missions.flatMap(mission => mission.lessons)) {
    let text;
    if (lesson.fractions) text = lesson.kind === 'same-numerator' ? 'Más partes de la misma cantidad hacen trozos más pequeños.' : 'Los trozos son iguales y hay más trozos.';
    else if (lesson.kind === 'pattern') text = lesson.rule === 'double' ? 'Es el doble cada vez.' : `${lesson.step < 0 ? 'Resto' : 'Sumo'} ${Math.abs(lesson.step)} cada vez.`;
    else if (lesson.reasoningType === 'some') text = 'Algunos no significa todos.';
    else if (lesson.reasoningType === 'bounds') text = `Es ${/\bimpar\b/.test(lesson.context) ? 'impar' : 'par'} y ${lesson.context.match(/mayor que \d+ y menor que \d+/)[0]}.`;
    else if (lesson.reasoningType === 'all') text = lesson.context;
    else text = lesson.context + ' Descarto esas posibilidades y queda la otra.';
    assert.equal(assessLocally(text, lesson), 'supported', `${lesson.id}: ${text}`);
  }
});
test('a plausible explanation never overrides a wrong mathematical choice in any activity', async () => {
  for (const mission of missions) for (const lesson of mission.lessons) {
    const session = createSession({ missionId: mission.id }); session.lessonIds = [lesson.id]; session.routeLength = 1;
    await advance(session, { type: 'answer', choice: 1 - correctChoice(currentLesson(session)) });
    await advance(session, { type: 'explain', text: 'Explicación reconocida.' }, { assess: () => 'supported' });
    assert.equal(session.records.length, 0, lesson.id);
    assert.notEqual(session.phase, 'complete');
    assert.doesNotMatch(session.messages.at(-1).text, /la (opcion|respuesta) correcta es|debes elegir/i);
  }
});

test('fraction worked examples use partitions different from the unsolved activity', async () => {
  for (const lesson of getMission('fractions').lessons.filter(item => item.kind === 'same-numerator')) {
    const session = createSession(); session.lessonIds = [lesson.id]; session.routeLength = 1;
    for (let count = 0; count < 3; count++) await advance(session, { type: 'hint' });
    const exampleNumbers = session.messages.at(-1).text.match(/\d+/g).map(Number);
    assert.equal(exampleNumbers.length, 2);
    assert.ok(exampleNumbers.every(number => lesson.fractions.every(pair => number !== pair[1])), lesson.id);
    assert.equal(session.records.length, 0);
  }
});
