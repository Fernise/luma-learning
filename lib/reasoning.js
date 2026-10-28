import {copyClaims,copyIssue,fractionRelationIssue} from './language-relations.js';
import { falseMathClaim, patternArithmeticEvidence } from './math-claims.js';
import { requestsSupport, currentReasoningText, explicitPatternIssue, everydayPatternClaims, everydayPatternIssue } from './learner-language.js';
import { someInferenceIssue } from './some-inference.js';
import { allInferenceIssue, allProofText } from './all-inference.js';
const numbers = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, veinticuatro: 24 };
const spelling = { igulaes: 'iguales', cda: 'cada', dovle: 'doble', tinen: 'tienen', alguns: 'algunos', mayro: 'mayor', menro: 'menor' };
export const normalize = text => String(text).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim()
  .replace(/\b(igulaes|cda|dovle|tinen|alguns|mayro|menro)\b/g, word => spelling[word])
  .replace(/\bgrn ade\b/g, 'grande').replace(/\bdescar to\b/g, 'descarto');
const numeric = text => text.replace(/\b(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|veinticuatro)\b/g, word => numbers[word]);
export function assessLocally(text, lesson) {
  let value = normalize(text);
  // Inspect the whole message for instructions before removing a retracted belief.
  if (/ignora|instrucciones|respuesta correcta|dime la respuesta|system prompt|ignore|answer/.test(value)) return 'off-topic';
  value = currentReasoningText(value);
  let num = numeric(value);
  const relationIssue=fractionRelationIssue(value,lesson);
  if(relationIssue)return relationIssue;
  if (falseMathClaim(num)) return 'unclear';
  if (/adivin|suerte|porque si|al azar/.test(value)) return 'guess';
  if (requestsSupport(value)) return 'unsure';
  // Uncertainty about missing facts can itself be valid reasoning in a 'some' problem.
  if (/no me sale|quiero descansar/.test(value)) return 'unsure';
  if (lesson.reasoningType !== 'some' && /\bno se\b|no entiendo|no puedo|ayuda|dificil|cansad|frustrad/.test(value)) return 'unsure';
  if (lesson.kind === 'pattern') {
    if (explicitPatternIssue(num, lesson)) return 'unclear';
    const everyday = everydayPatternClaims(num);
    if (everydayPatternIssue(everyday, lesson)) return 'unclear';
    const arithmetic = patternArithmeticEvidence(num, lesson);
    if (arithmetic !== null) return arithmetic ? 'supported' : 'unclear';
    if (/\bno\b.{0,16}(sum|rest|multiplic|dobl|duplic|aument|baj)/.test(value)) return 'unclear';
    if (lesson.rule === 'double') {
      const copies=copyClaims(num);
      if(copyIssue(copies))return 'unclear';
      if (/\b(?:por|multiplico por|multiplica por)\s+(?!2\b)\d+/.test(num)) return 'unclear';
      if (/\b(sum\w*|anad\w*|agreg\w*)\s+\d+\s+(siempre|cada|en cada)/.test(num)) return 'unclear';
      if(copies.some(c=>!c.negated&&c.amount===2))return 'supported';
      const pairs = [...num.matchAll(/\b(\d+) (?:y|mas|\+) (\d+) (?:son|dan) (\d+)\b/g)];
      if (pairs.length) return pairs.length >= 2 && pairs.every(([, a, b, c]) => Number(a) === Number(b) && Number(c) === 2 * Number(a) && lesson.sequence.some((term, index) => term === Number(a) && lesson.sequence[index + 1] === Number(c))) ? 'supported' : 'unclear';
      return /doble|duplic|dos veces|2 veces|multiplic\w*.{0,12}\b2\b|\bpor 2\b/.test(num) ? 'supported' : 'unclear';
    }
    if (everyday.some(claim => !claim.negated)) return 'supported';
    const amount = Math.abs(lesson.step); const down = lesson.step < 0;
    const claims = [...num.matchAll(/\b(sum\w*|anad\w*|agreg\w*|aument\w*|rest\w*|quit\w*|baj\w*|menos|mas)\s+(?:siempre\s+|de\s+|otros\s+)?(\d+)\b/g)];
    if (claims.some(match => Number(match[2]) !== amount || /rest|quit|baj|menos/.test(match[1]) !== down)) return 'unclear';
    if (claims.length) return 'supported';
    const direction = down ? '(rest|quit|baj|dismin|menos)' : '(sum|anad|agreg|aument|sub|avanz|mas)';
    if (new RegExp(`${direction}.{0,30}\\b${amount}\\b|\\b${amount}\\b.{0,30}${direction}`).test(num)) return 'supported';
    return !down && new RegExp(`\\bde ${amount} en ${amount}\\b`).test(num) ? 'supported' : 'unclear';
  }
  if (lesson.kind === 'logic') {
    const type = lesson.reasoningType;
    if (type === 'some') {
      if (someInferenceIssue(value, lesson)) return 'unclear';
      if (/no hay.{0,20}(?:un )?(?:dato|informacion).{0,70}(?:luna|pipo|brisa)/.test(value)) return 'supported';
      if (/algunos.{0,15}no (?:significa[n]?|quiere[n]? decir|implica[n]?)(?: que)? todos|algunos,? no de todos|no (podemos|puedo|se puede) (asegurar|saber)/.test(value) || /(falta|no sabemos|no se sabe|no tenemos).{0,70}(dato|informacion|collar|vela|pluma|luna|pipo|brisa)/.test(value)) return 'supported';
      return /\bno se\b|no entiendo|ayuda/.test(value) ? 'unsure' : 'unclear';
    }
    if (type === 'exclude') {
      if (/\bno\b.{0,12}(descart|elimin)/.test(value)) return 'unclear';
      const excluded = normalize(lesson.options[1 - lesson.correct]).split(' ').at(-1);
      if (new RegExp(`(queda|elijo).{0,12}\\b${excluded}\\b`).test(value)) return 'unclear';
    }
    if (type === 'bounds' && /\bno\b/.test(value)) return 'unclear';
    if (type === 'bounds') {
      const odd = /\bimpar\b/.test(normalize(lesson.context));
      if (odd ? /\bpar\b/.test(value) : /\bimpar\b/.test(value)) return 'unclear';
      for (const claim of num.matchAll(/\b(\d+)\s+es\s+(?:un numero\s+)?(impar|par)\b/g)) if ((Number(claim[1]) % 2 === 1) !== (claim[2] === 'impar')) return 'unclear';
      const bounds = numeric(normalize(lesson.context)).match(/mayor que (\d+) y menor que (\d+)/);
      const interval = num.match(/entre (\d+) y (\d+)/);
      if (bounds && interval && (bounds[1] !== interval[1] || bounds[2] !== interval[2])) return 'unclear';
      const lower = num.match(/(?:mayor que|por encima de) (\d+)/); const upper = num.match(/(?:menor que|por debajo de) (\d+)/);
      if (bounds && ((lower && lower[1] !== bounds[1]) || (upper && upper[1] !== bounds[2]))) return 'unclear';
      if (bounds && !interval && !(lower && upper)) return 'unclear';
    }
    if (type === 'all') {
      if (allInferenceIssue(value, lesson)) return 'unclear';
      const evidence = allProofText(value, lesson);
      if (/\bno\b/.test(evidence) || /todas.{0,60}porque una\b/.test(evidence)) return 'unclear';
      const conclusion = normalize(lesson.options[lesson.correct]).split(' ').at(-1);
      if (!evidence.includes(conclusion) || !/tien|llev|permit|cumple|porque|por eso|\bes\b|\bson\b/.test(evidence)) return 'unclear';
      return lesson.reasoningPatterns.some(pattern => new RegExp(normalize(pattern)).test(evidence)) ? 'supported' : 'unclear';
    }
    return lesson.reasoningPatterns.some(pattern => new RegExp(normalize(pattern)).test(value)) ? 'supported' : 'unclear';
  }
  value = value.split(/[.!?;]+/).map(clause=>clause.trim()).filter(clause=>!/^(?:la pizza entera|el entero) no cambia$|^no cambia el entero$|^no es (?:cierto|verdad) que [\d/\s<>+=-]+$/.test(clause)).join('. ');
  if (/\bno\b/.test(value)) return 'unclear';
  const parts = '(partes|trozos|cachos|pedazos|porciones|personas|divisiones)';
  if (lesson.kind === 'same-numerator') {
    const moreSmall = new RegExp(`(mas|muchas).{0,15}${parts}.{0,65}(pequen|menor|chiquit)`);
    const fewerBig = new RegExp(`(menos|pocas).{0,15}${parts}.{0,65}(grande|mayor)|${parts}.{0,20}(menos|pocas).{0,55}(grande|mayor)`);
    const contradiction = new RegExp(`mas.{0,15}${parts}.{0,35}(mas grandes|mayores)|menos.{0,15}${parts}.{0,35}(mas pequenas|menores)`);
    if (contradiction.test(value)) return 'denominator-error';
    const sharedLess = /mas.{0,15}personas.{0,65}(toca|recibe).{0,15}menos.{0,20}(cada|una|uno)/.test(value);
    if (moreSmall.test(value) || fewerBig.test(value) || sharedLess || /denominador.{0,35}(menor|pequen).{0,35}(grande|mayor)/.test(value)) return 'supported';
    if (/(mas|mayor|grande).{0,30}(numero|denominador)|(?:numero|denominador).{0,30}(mas|mayor|grande)/.test(value)) return 'denominator-error';
  } else {
    const equal = /iguales|mismo tamano|mismo denominador|igual de grandes|igual tamano|(?:ocupa|ocupan|mide|miden) lo mismo/.test(value);
    const more = new RegExp(`(mas|mayor).{0,30}${parts}|${parts}.{0,30}(mas|mayor)`).test(value);
    const [a, b] = lesson.fractions.map(pair => pair[0]);
    const counts = new RegExp(`\\b${a}\\b`).test(num) && new RegExp(`\\b${b}\\b`).test(num) && /hay|tengo|tiene|comparo|frente|cojo|elijo/.test(value);
    const comparisons = [...num.matchAll(/\b(\d+)\s+(?:(?:trozos|pedazos|partes)\s+)?(?:son|ocupan|dan)\s+mas\s+que\s+(\d+)\b/g)];
    if (comparisons.some(([, a, b]) => Number(a) <= Number(b))) return 'unclear';
    if (equal && (more || counts || comparisons.length) && !/menos.{0,15}(trozos|partes|pedazos).{0,25}(mas cantidad|mayor cantidad)/.test(value)) return 'supported';
  }
  return 'unclear';
}
