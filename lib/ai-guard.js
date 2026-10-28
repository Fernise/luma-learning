import {copyClaims,copyIssue,fractionRelationIssue} from './language-relations.js';
import { vocabularyHelp } from './lesson-vocabulary.js';
// These checks constrain the tutor; they are not a general-purpose content classifier.
import { normalize } from './reasoning.js';
import { someInferenceIssue } from './some-inference.js';
import { allInferenceIssue } from './all-inference.js';
import { falseMathClaim } from './math-claims.js';
import { requestsSupport, currentReasoningText, explicitPatternIssue, clarificationQuestion, everydayPatternClaims, everydayPatternIssue } from './learner-language.js';
const plain = text => normalize(text.normalize('NFKC').replace(/\p{Cf}/gu, ''));
const numberWords = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16 };
const numbered = value => value.replace(/\b(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis)\b/g, word => numberWords[word]);

const controlRequests = [
  /\b(ignora|ignorar|olvida|omite|desobedece|ignore|disregard|override|bypass)\b.{0,70}\b(instrucciones|reglas|restricciones|instructions|rules|previous|system|prompt)\b/,
  /\b(revela|muestra|muestrame|imprime|devuelve|dame|reveal|print|show|return)\b.{0,60}\b(prompt|instrucciones internas|api.?key|clave|secret|token|contrasena|\.env)\b/,
  /\b(actua|actuar|comportate|finge|eres ahora|roleplay|act as|pretend|you are now)\b/,
  /\b(system|developer|assistant|sistema|desarrollador)\s*:/,
  /<\|(?:im_start|system|assistant|endoftext)|\[\/?(?:inst|system)\]|<\/?(?:system|developer|assistant)>/,
  /\b(supported|denominator-error|off-topic)\b|["']category["']\s*:/,
  /\b(ejecuta|ejecutar|execute|run|abre|abrir|open|visita|visit|fetch|descarga|download|curl)\b.{0,70}\b(archivo|file|terminal|comando|command|url|web|python|javascript|shell|codigo|script)\b/,
  /https?:\/\/|\b(?:localhost|127\.0\.0\.1)\b|\b(?:openai_api_key|process\.env|base64|jailbreak)\b/,
  /\b(escribe|genera|crea|write|generate|create|traduc[eir]*)\b.{0,70}\b(poema|poem|cuento|story|receta|recipe|codigo|code|script|email|correo|cancion|song)\b/,
  /\b(dime|dame|revela|tell me|give me)\b.{0,30}\b(respuesta|solucion|answer|solution)\b/,
];

function contradiction(value, lesson) {
  const num = numbered(value);
  const relationIssue=fractionRelationIssue(value,lesson);
  if(relationIssue)return relationIssue;
  if (falseMathClaim(num)) return 'unclear';
  if (lesson.reasoningType === 'exclude') {
    const wrong = plain(String(lesson.options[1 - lesson.correct])).split(' ').at(-1);
    if (new RegExp(`\\b(?:queda|elijo)\\s+(?:(?:la|el)\\s+)?${wrong}\\b`).test(value)) return 'unclear';
  }
  if (lesson.kind === 'same-numerator') {
    if (/mas.{0,15}(partes|trozos|cachos|pedazos|porciones).{0,35}(mas grandes|mayores)|menos.{0,15}(partes|trozos|cachos|pedazos|porciones).{0,35}(mas pequenas|menores)/.test(value) && !/\bno\b/.test(value)) return 'denominator-error';
  }
  if (lesson.kind === 'pattern') {
    const active = num;
    if (explicitPatternIssue(active, lesson)) return 'unclear';
    if (everydayPatternIssue(everydayPatternClaims(active), lesson)) return 'unclear';
    if (lesson.rule === 'double') {
      if(copyIssue(copyClaims(active)))return 'unclear';
      if (!/\bno\b/.test(active) && /\b(?:multiplico|multiplica|multiplicamos) por (?!2\b)\d+/.test(active)) return 'unclear';
      if (!/\bno\b/.test(active) && /\b(sum\w*|anad\w*|agreg\w*)\s+\d+\s+(siempre|cada|en cada)/.test(active)) return 'unclear';
    } else {
      const claims = [...active.matchAll(/\b(sumo|sumamos|resto|restamos|anado|anadimos|quito|quitamos)\s+(\d+)\s+(?:cada|siempre|en cada)/g)];
      if (!/\bno\b/.test(active) && claims.some(match => Number(match[2]) !== Math.abs(lesson.step) || /rest|quit/.test(match[1]) !== (lesson.step < 0))) return 'unclear';
    }
  }
  if (lesson.kind === 'same-denominator' && !/\bno\b/.test(num)) {
    for (const [, a, b] of num.matchAll(/\b(\d+)\s+(?:(?:trozos|pedazos|partes)\s+)?(?:son|ocupan|dan)\s+mas\s+que\s+(\d+)\b/g)) if (Number(a) <= Number(b)) return 'unclear';
  }
  if (lesson.reasoningType === 'all' && /todas.{0,60}porque una\b/.test(value)) return 'unclear';
  if (lesson.reasoningType === 'bounds') {
    for (const claim of num.matchAll(/\b(\d+)\s+es\s+(?:un numero\s+)?(impar|par)\b/g)) {
      if ((Number(claim[1]) % 2 === 1) !== (claim[2] === 'impar') && !/\bno\b/.test(num)) return 'unclear';
    }
  }
  return null;
}

export function screenExplanation(text, lesson) {
  if (typeof text !== 'string' || !text.trim() || text.length > 600 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) return { category: 'off-topic', reason: 'invalid-input' };
  const original = plain(text);
  if (/\b(?:archivo|contenido|clave).{0,35}\.env\b/.test(original) || controlRequests.some(pattern => pattern.test(original)) || /\btu nuevo papel\b|\b(?:responde|hablame|ayudame).{0,60}\b(?:inversiones|correo|politica|partido de futbol)\b/.test(original)) return { category: 'off-topic', reason: 'instruction' };
  const value = currentReasoningText(original);
  // An option repeated verbatim is a choice, not evidence for that choice.
  const optionText = entry => numbered(plain(String(entry)).replace(/\b(?:he elegido|elijo|la de|opcion|en|el|la|los|las|un|una)\b/g, ' ')).replace(/[^\p{L}\p{N}/]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const options = lesson.fractions ? lesson.fractions.map(parts => parts.join('/')) : lesson.options ?? [];
  if (options.some(option => optionText(option) === optionText(value))) return { category: 'unclear', reason: 'answer-only' };
  if (lesson.reasoningType === 'all') {
    const detail = allInferenceIssue(value, lesson);
    if (detail) return { category: 'unclear', reason: 'contradiction', detail };
  }
  if (lesson.reasoningType === 'some') {
    const detail = someInferenceIssue(value, lesson);
    if (detail) return { category: 'unclear', reason: 'contradiction', detail };
  }
  const category = contradiction(value, lesson);
  if (category) return { category, reason: 'contradiction' };
  if (vocabularyHelp(value, lesson)) return { category: 'unsure', reason: 'vocabulary' };
  if (requestsSupport(value)) return { category: 'unsure', reason: 'support-request' };
  if (clarificationQuestion(value, lesson)) return { category: 'unclear', reason: 'clarification' };
  // Vocabulary is deliberately broad, with exercise-specific words and uncertainty preserved.
  const shared = 'comparar comparo comparado comprobar compruebo comprobado relacion razon porque igual iguales mismo tamano mayor menor grande grandes pequeno pequenos parte partes trozo trozos cacho cachos cantidad cantidades numero numeros mas menos dividir reparto repartir persona personas mitad tercio cuarto denominador numerador suma sumo sumamos sumar resto restamos restar quito quitar anado anadimos doble duplico duplicar multiplico multiplicar veces salto saltos cambia cambio aumenta disminuye regla todos todas algunos algunas ningun ninguno puede podemos asegurar falta faltan dato datos informacion pista pistas descarto descartamos eliminar elimino queda quedan solo par impar entre condicion condiciones no entiendo no se ayuda confuso dificil agobiado agobiando creo';
  const context = plain(`${lesson.context ?? ''} ${lesson.title ?? ''} ${(lesson.options ?? []).join(' ')}`);
  const terms = new Set(`${shared} ${Object.keys(numberWords).join(' ')} ${context}`.split(/[^\p{L}\p{N}]+/u).filter(word => word.length >= 4));
  const meaningful = value.split(/[^\p{L}\p{N}]+/u).some(word => terms.has(word));
  const mathRelation = (lesson.kind === 'pattern' && everydayPatternClaims(numbered(value)).length > 0) || /\b\d{1,4}\s*[+×x*\-]\s*\d{1,4}\s*=\s*\d{1,4}\b/.test(value) || /\b(sumando|restando|anadiendo|quitando|avanza|avanzan|grupos|pedazos)\b/.test(value) || /\b\d+ y \d+ (son|dan) \d+\b/.test(value);
  if (!meaningful && !mathRelation && !/\b(?:par|impar)\b/.test(value) && !/\b(no se|no entiendo|no me sale|cansad\w*|descans\w*|frustrad\w*|ayuda|al azar|suerte|adivine|adivino|explic\w*|razon\w*|entiend\w*|consig\w*|piens\w*|pens\w*)\b/.test(value)) return { category: 'off-topic', reason: 'scope' };
  return null;
}
