// Bounded phrases, evaluated only after instruction and contradiction checks.
// Input is normalized text; this does not interpret arbitrary conversation.
export function requestsSupport(value) {
  if (additionalSupportIntent(value)) return true;
  const phrase = value.replace(/[¿?¡!.,;:]/g, '').trim();
  return /^(?:necesito (?:descansar|una pausa)|(?:quiero|podemos) parar|(?:hacemos|quiero) una pausa|no entiendo (?:el enunciado|que me pide)|que (?:me pide|hay que hacer)|(?:puedes )?explicame (?:la pregunta|el enunciado)|que significa (?:la pregunta|esto)|no se como decirlo|no consigo explicarlo|(?:no se |ayudame a )explicar mi (?:idea|respuesta)|se la respuesta pero no se explicarla)(?: por favor)?$/.test(phrase) || /^(?:(?:pues|aun|todavia|perdon) )?(?:no (?:lo )?se|nose|no (?:lo )?entiendo|no entiendo (?:la pregunta|el ejercicio|esto|como hacerlo)|no se (?:que hacer|como hacerlo|como explicarlo)|no me sale|no puedo explicarlo|me he perdido|estoy (?:confundido|confundida|cansado|cansada)|quiero descansar|(?:me das|puedes darme|me puedes dar|necesito|quiero) (?:una )?(?:pista|ayuda)|ayudame|ayuda)(?: por favor)?$/.test(phrase);
}

// Quantified operations stated in everyday language. Mere numbers or 'más'
// do not count. Every recognized claim must match the activity, including
// claims alongside a correct formula; an invalid claim must reach no provider.
export function everydayPatternClaims(value) {
  const claims = [];
  const verbs = '(contar|cuento|contamos|contando|sumar|sumo|sumamos|sumando|anadir|anado|anadimos|anadiendo|agregar|agrego|aumentar|aumento|aumenta|avanzar|avanzo|avanza|subir|subo|sube|restar|resto|restamos|restando|quitar|quito|quitamos|quitando|bajar|bajo|baja)';
  for (const match of value.matchAll(new RegExp(`\\b${verbs}\\s+(?:siempre\\s+|cada vez\\s+|de\\s+)?(\\d+)\\s*(mas|menos)?\\b`, 'g'))) {
    const down = /rest|quit|baj/.test(match[1]);
    const suffix = match[3];
    claims.push({ amount: Number(match[2]), down, conflictingDirection: Boolean(suffix && (suffix === 'menos') !== down), negated: /\bno\s*$/.test(value.slice(0, match.index)) });
  }
  for (const match of value.matchAll(/\b(?:cada vez|siempre|en cada paso)\s+(?:(?:hay|son|vienen|tengo)\s+)?(\d+)\s+(mas|menos)\b/g)) {
    claims.push({ amount: Number(match[1]), down: match[2] === 'menos', conflictingDirection: false, negated: /\bno\s*$/.test(value.slice(0, match.index)) });
  }
  return claims;
}

export function everydayPatternIssue(claims, lesson) {
  return claims.some(c => c.negated ? (lesson.rule !== 'double' && c.amount === Math.abs(lesson.step) && c.down === (lesson.step < 0)) : (c.conflictingDirection || (lesson.rule !== 'double' && (c.amount !== Math.abs(lesson.step) || c.down !== (lesson.step < 0)))));
}

export function supportIntent(value) {
  const additional = additionalSupportIntent(value);
  if (additional) return additional;
  const phrase = value.replace(/[¿?¡!.,;:]/g, '').trim();
  if (/^(?:quiero descansar|necesito (?:descansar|una pausa)|(?:quiero|podemos) parar|estoy cansad[oa]|(?:hacemos|quiero) una pausa)(?: por favor)?$/.test(phrase)) return 'break';
  if (/^(?:no entiendo (?:la pregunta|el enunciado|el ejercicio|que me pide)|que (?:me pide|hay que hacer)|(?:puedes )?explicame (?:la pregunta|el enunciado)|que significa (?:la pregunta|esto))(?: por favor)?$/.test(phrase)) return 'question';
  if (/^(?:no (?:se como|puedo) explicarlo|no se como decirlo|no consigo explicarlo|(?:no se |ayudame a )explicar mi (?:idea|respuesta)|se la respuesta pero no se explicarla)(?: por favor)?$/.test(phrase)) return 'explain';
  return requestsSupport(value) ? 'hint' : null;
}

// Tentative clarification only for a bounded incomplete claim, never guessed
// from the solution or echoed from untrusted learner text.
export function clarificationQuestion(value, lesson) {
  if (/^(?:pues )?(?:porque|creo que)[.!?… ]*$/.test(value)) return lesson.kind === 'pattern' ? 'Tu idea puede empezar con un paso pequeño. ¿Qué cambia entre dos números conocidos?' : lesson.kind === 'logic' ? 'Tu idea puede empezar con una pista. ¿Qué dato del ejercicio has usado?' : 'Tu idea puede empezar con un detalle. ¿Qué has comparado entre las dos cantidades?';
  if (/^(?:no|no es eso)[.!? ]*$/.test(value)) return 'Probemos otra forma de explicarlo. ¿Qué has observado en el ejercicio?';
  if (/^(?:si|eso|exacto)[.!? ]*$/.test(value)) return '¿Cómo lo comprobarías con lo que ves en el ejercicio?';
  if (lesson.kind === 'pattern') {
    if (/^(?:(?:mi regla es|creo que|porque) )?(?:sumo|sumar|anado|anadir|cuento|contar)(?: (?:lo mismo|siempre|mas|un numero))*[.!? ]*$/.test(value)) return '¿Quieres decir que añades la misma cantidad en cada paso? Puedes aclararlo comprobando una pareja.';
    if (/^(?:(?:mi regla es|creo que|porque) )?(?:resto|restar|quito|quitar)(?: (?:lo mismo|siempre|un numero))*[.!? ]*$/.test(value)) return '¿Quieres decir que quitas la misma cantidad en cada paso? Puedes aclararlo comprobando una pareja.';
  }
  if (['same-numerator','same-denominator'].includes(lesson.kind) && /^(?:porque |creo que )?(?:son iguales|tienen el mismo tamano|es mas grande)[.!? ]*$/.test(value)) return '¿Te refieres a las cantidades enteras o a cada parte?';
  return null;
}

// Only a leading, explicitly superseded belief is removed. Current claims,
// including conflicting operations after 'ahora', remain subject to checks.
export function currentReasoningText(value) {
  return value.replace(/^(?:(?:antes pensaba|antes creia) que |me equivoque:\s*)[^.!?]{1,120}?(?:[.!?]\s*(?:pero )?|,\s*pero )ahora\s+/, '');
}
export const currentPatternText = currentReasoningText;

// Only an explicit denial immediately introducing this claim applies to it.
// An unrelated 'no' elsewhere must not disable contradiction checks.
export function claimIsNegated(prefix) {
  return /\b(?:no|no es cierto que|no es verdad que|no significa que|no implica que)(?: con)?\s*$/.test(prefix.split(/[.!?;]+/).at(-1));
}

export function explicitPatternIssue(value, lesson) {
  const patterns=lesson.rule==='double'
    ? [/\b(?:multiplico|multiplica|multiplicamos) por (\d+)\b/g, /\b(?:sum\w*|anad\w*|agreg\w*)\s+(\d+)\s+(?:cada|siempre|en cada)\b/g]
    : [/\b(?:cada numero es|cada paso es|la regla es) el doble(?: del anterior)?\b/g];
  for (const [index,pattern] of patterns.entries()) for (const match of value.matchAll(pattern)) {
    if (claimIsNegated(value.slice(0,match.index))) continue;
    if (lesson.rule!=='double'||index===1||Number(match[1])!==2) return true;
  }
  return false;
}

// Exact, short requests only. A mixed mathematical claim must still be checked;
// this helper cannot discard clauses or interpret arbitrary emotional language.
function additionalSupportIntent(value) {
  const phrase = value.replace(/[¿?¡!.,;:]/g, '').trim();
  if (/^(?:me lo (?:explicas|dices) de otra manera|puedes (?:preguntarlo de otra forma|decirlo de otra manera))(?: por favor)?$/.test(phrase)) return 'rephrase';
  if (/^no me entero$/.test(phrase)) return 'question';
  if (/^(?:aun |todavia )?no lo tengo claro$/.test(phrase)) return 'hint';
  if (/^(?:por que|por que es asi)(?: por favor)?$/.test(phrase)) return 'why';
  if (/^(?:(?:puedes )?repetir la pregunta|repite la pregunta|no lo entindo)(?: por favor)?$/.test(phrase)) return 'question';
  if (/^(?:no estoy segur[oa]|no se si esta bien)(?: por favor)?$/.test(phrase)) return 'hint';
  if (/^(?:estoy frustrad[oa]|esto me (?:esta agobiando|agobia)|esto es (?:muy )?dificil|soy tont[oa](?: nunca me sale)?|nunca me sale)$/.test(phrase)) return 'frustration';
  if (/^(?:quiero dejarlo por hoy|prefiero descansar)$/.test(phrase)) return 'break';
  return null;
}
