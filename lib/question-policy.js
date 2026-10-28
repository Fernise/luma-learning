// Conservative vocabulary for generated process questions, never arbitrary prose.
// No lesson-specific names, operations, values, verdicts, links or learner quotes.
import { normalize } from './reasoning.js';
const words = new Set(('que como cual en con de a al del el la los las un una lo y o para por entre sobre tu tus te ti has es se si ' +
 'puedes podrias usar usado usas observar observado observas comparar comparado comparas comprobar comprobado compruebas explicar explicado explicas revisar revisado revisas relacion relacionas representar representa representan ' +
 'ayuda ayudar apoya apoyar justifica justificar sabes saber ves ver miras mirar muestra mostrar probar probarias prueba ' +
 'idea ideas eleccion respuesta detalle detalles ejercicio datos dato pista pistas informacion parte partes cantidad cantidades entero enteros tamano ' +
 'numero numeros paso pasos vecinos conocido conocidos cambio cambios regla relacion forma manera otra otro esta este estas estos mantener mantienes encontrar encuentras elegir elegido pensar pensado conectar conecta').split(' '));
const fold = text => normalize(text).replace(/[¿?]/g,'').trim();
export function previousQuestions(messages) {
  return messages.filter(m=>m.role==='tutor').flatMap(m=>m.text.match(/¿[^¿?]{8,178}\?/g)??[]).slice(-3);
}
export function validateQuestion(question, lesson, previous = []) {
  if(typeof question!=='string'||question.length<20||question.length>180||question!==question.trim())return {ok:false,reason:'length'};
  if(!/^¿[\p{L} ]+\?$/u.test(question))return {ok:false,reason:'format'};
  const value=fold(question);const tokens=value.split(' ');
  const fraction=['same-numerator','same-denominator'].includes(lesson.kind);
  // Reviewed neutral synonyms, never arbitrary context or option words.
  const extra=new Set(fraction?['trozo','trozos','tamanos','comparados',...(lesson.unit==='pizza'?['pizza','pizzas']:[])]:[]);
  if(!/^(?:que|como|cual|en que|con que|de que) /.test(value)||tokens.some(t=>!words.has(t)&&!extra.has(t)))return {ok:false,reason:'vocabulary'};
  const relevant=lesson.kind==='pattern'?/\b(?:pasos?|numeros?|cambios?|regla)\b/:lesson.kind==='logic'?/\b(?:pistas?|datos?|eleccion|parte del ejercicio)\b/:/\b(?:partes?|trozos?|cantidades?|enteros?)\b/;
  // The recorded plural refers to the exercise's pieces, without stating a size
  // relationship. Keep this anchor specific; arbitrary object names stay blocked.
  const grounded=lesson.kind==='pattern'?/\b(?:pasos? conocidos?|numeros? vecinos?|del ejercicio|en el ejercicio)\b/:lesson.kind==='logic'?/\b(?:del ejercicio|en el ejercicio)\b/:fraction&&lesson.unit==='pizza'?/\b(?:del ejercicio|en el ejercicio|las cantidades|los enteros|las pizzas|los tamanos de los trozos)\b/:/\b(?:del ejercicio|en el ejercicio|las cantidades|los enteros|los tamanos de los trozos)\b/;
  if(!grounded.test(value)||/\b(?:tu|tus) (?:datos?|informacion|numeros?)\b/.test(value))return {ok:false,reason:'scope'};
  if(!relevant.test(value)||!/\b(?:observ\w*|compar\w*|comprob\w*|explic\w*|revis\w*|relaci\w*|represent\w*|apoya|ayuda|usas|usado|usar|sabes|ves|justific\w*|prob\w*)\b/.test(value))return {ok:false,reason:'scope'};
  const current=new Set(tokens);
  for(const earlier of previous){
    const normalized=fold(earlier);const other=new Set(normalized.split(/\s+/));
    const common=[...current].filter(word=>other.has(word)).length;
    if(value===normalized||common/new Set([...current,...other]).size>=0.8)return {ok:false,reason:'repetition'};
  }
  return {ok:true};
}
export const questionInstructions = 'Also propose question as a string or null. A question is optional and NEVER changes the category. Only propose it for unclear, guess or denominator-error. Write ONE short Spanish process question enclosed in ¿...? with no other punctuation, numbers, mathematical operations, option names, verdicts, assertions, quotes, solutions, or instructions. Adapt it to the learner explanation and avoid previousQuestions. Ask the learner to observe, compare, explain evidence or check their idea without supplying any fact or relationship. Use only neutral common words about parts and quantities (fractions), numbers and steps (patterns), or clues and evidence (logic). Refer explicitly to del ejercicio or en el ejercicio, to las cantidades or los enteros for fractions, or to pasos conocidos or numeros vecinos for patterns. Examples of allowed wording: ¿Qué has comparado entre las partes de las cantidades? ¿Qué cambio observas entre pasos conocidos? ¿Qué pista del ejercicio apoya tu elección? Adapt these forms without supplying facts and without copying a previous question. Prefer null when you cannot meet this. Never output an answer or repeat learner text. Allowed Spanish words (accents allowed): ' + [...words].join(' ');
