// Authored adult examples: hypotheses for review, not a representative child dataset.
import { missions, getMission } from './catalog.js';
import { validExplanation } from './evaluation-cases.js';

const find = (mission, id) => getMission(mission).lessons.find(lesson => lesson.id === id);
const cases = (group, expected, rows) => rows.map(([mission, id, text], index) => ({ id: `${group}-${index}-${id}`, group, lesson: find(mission, id), text, expect: expected }));

// Restrict misspellings to specific words; preserve numbers, polarity and relationships.
const misspell = text => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  .replace(/\biguales\b/g, 'igulaes').replace(/\bgrande\b/g, 'grn ade')
  .replace(/\bcada\b/g, 'cda').replace(/\bdoble\b/g, 'dovle')
  .replace(/\btienen\b/g, 'tinen').replace(/\balgunos\b/g, 'alguns')
  .replace(/\bmayor\b/g, 'mayro').replace(/\bmenor\b/g, 'menro')
  .replace(/\bdescarto\b/g, 'descar to').replace(/[.;:]/g, '');

export const variationCases = [
  ...missions.flatMap(mission => mission.lessons.map(lesson => ({ id: `spelling-${lesson.id}`, group: 'spelling', lesson, text: misspell(validExplanation(lesson)), expect: 'supported' }))),
  ...cases('paraphrase', 'supported', [
    ['fractions', 'pizza', 'Si la misma pizza se reparte entre menos personas, a cada una le toca un trozo mayor.'],
    ['fractions', 'garden', 'La misma cantidad de cachos, pero al cortar menos veces son más grandes.'],
    ['fractions', 'chocolate', 'Cada pedazo ocupa lo mismo. Por eso cinco pedazos ocupan más que tres.'],
    ['fractions', 'ribbon', 'Los pedazos son igual de grandes; cuatro son más que dos.'],
    ['patterns', 'steps', 'De 2 a 5 hay 3 y de 5 a 8 también. Voy sumando 3.'],
    ['patterns', 'countdown', 'En todas las paradas tengo cuatro menos que antes.'],
    ['patterns', 'doubling', 'Hago dos grupos como el anterior: 3 y 3 son 6; 6 y 6 son 12.'],
    ['patterns', 'shells', 'Avanza de dos en dos en todo el camino.'],
    ['logic', 'boxes', 'La roja no vale, la azul tampoco. Solo queda la verde.'],
    ['logic', 'cards', 'Esta es roja, así que se cumple la regla de las rojas y tiene estrella.'],
    ['logic', 'some', 'Puede que Luna sí o puede que no: no sabemos cuáles son los perros con collar.'],
    ['logic', 'number-clues', 'El 6 se reparte en parejas sin que sobre ninguno, y es mayor que 4 y menor que 8.'],
  ]),
  ...cases('incomplete', 'not-supported', [
    ['fractions', 'pizza', 'He comparado…'], ['fractions', 'garden', 'Partes, grande, dos.'],
    ['fractions', 'chocolate', 'Cinco.'], ['fractions', 'ribbon', 'La primera porque sí.'],
    ['patterns', 'steps', 'Catorce.'], ['patterns', 'countdown', 'He mirado los números.'],
    ['patterns', 'doubling', 'La de 48.'], ['patterns', 'shells', 'Mi regla es…'],
    ['logic', 'boxes', 'La verde.'], ['logic', 'cards', 'Tiene estrella.'],
    ['logic', 'some', 'He leído la pista.'], ['logic', 'number-clues', 'He elegido seis.'],
  ]),
  ...cases('misconception', 'not-supported', [
    ['fractions', 'pizza', 'Con menos partes hay trozos más pequeños.'],
    ['fractions', 'garden', 'Con más partes de la misma cantidad cada trozo es más grande.'],
    ['fractions', 'chocolate', 'Los trozos son iguales, pero menos trozos dan más cantidad.'],
    ['fractions', 'ribbon', 'Son del mismo tamaño y dos trozos ocupan más que cuatro.'],
    ['patterns', 'steps', 'Sumo tres al principio y luego sumo cuatro cada vez.'],
    ['patterns', 'countdown', 'Sumo cuatro cada vez.'],
    ['patterns', 'doubling', 'Es el doble porque sumo tres siempre.'],
    ['patterns', 'shells', 'Resto dos cada vez.'],
    ['logic', 'boxes', 'Descarto la azul y la verde, solo queda la roja.'],
    ['logic', 'cards', 'Todas las tarjetas tienen estrella porque una roja la tiene.'],
    ['logic', 'some', 'Algunos son todos, así que Luna tiene el collar.'],
    ['logic', 'number-clues', 'Seis es par y está entre dos y diez, eso es lo que pide la pista.'],
  ]),
  ...cases('uncertainty', 'unsure', [
    ['fractions', 'pizza', 'No entiendo qué significa el número de abajo.'],
    ['fractions', 'chocolate', 'Me estoy frustrando, necesito ayuda.'],
    ['patterns', 'steps', 'No sé cómo empezar.'],
    ['patterns', 'doubling', 'No me sale y estoy cansado.'],
    ['logic', 'boxes', 'No entiendo las pistas.'],
    ['logic', 'cards', 'Necesito una pista, no puedo explicarlo.'],
  ]),
];
