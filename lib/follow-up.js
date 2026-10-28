// Authored questions use the concept, never the answer key or the learner's raw text.
import {normalize} from './reasoning.js';
const questions = {
  'same-numerator': {
    'answer-only': '¿Cómo relacionas las partes del mismo entero con el tamaño de cada trozo?',
    contradiction: 'Al dividir la misma cantidad en más partes, ¿cómo puedes comprobar el tamaño de cada parte?',
  },
  'same-denominator': {
    'answer-only': '¿Cómo usarías el tamaño de las partes y cuántas hay para justificar tu elección?',
    contradiction: 'Si las partes tienen el mismo tamaño, ¿cómo comprobarías cuál de las dos cantidades ocupa más?',
  },
  pattern: {
    'answer-only': '¿Qué regla te lleva a tu elección y funciona también en dos parejas conocidas?',
    contradiction: '¿La operación que propones funciona tanto en la primera pareja como en la siguiente?',
  },
  exclude: {
    'answer-only': '¿Qué pista te permite descartar la otra opción?',
    contradiction: '¿Qué pista puedes usar para comprobar la posibilidad que propones?',
  },
  all: {
    'ambiguous-quantity': '¿Qué quieres decir con «solo»: cuántos dibujos hay o qué tipos de dibujos hay?',
    'unsupported-converse': '¿En qué dirección puedes aplicar la regla a este caso?',
    'negated-rule': '¿Tu explicación mantiene lo que dice la regla sobre todo el grupo?',
    'unsupported-exclusion': '¿Qué pista habla de otras características de este caso?',
    'answer-only': '¿Cómo conectas la regla del juego con la característica de este caso?',
    contradiction: '¿Qué dice la regla sobre todo el grupo, además del caso que estás mirando?',
  },
  some: {
    'unsupported-individual': '¿Qué pista habla de si este caso tiene o no esa característica?',
    'unsupported-certainty': '¿Qué dato sobre este caso te permite estar seguro de esa afirmación?',
    'unsupported-universal': '¿Qué pista permite afirmar lo mismo sobre todo el grupo?',
    'unsupported-exception': '¿Qué pista dice que alguien del grupo no tiene esa característica?',
    'answer-only': '¿Qué dice la pista sobre este caso concreto?',
    contradiction: '¿Qué diferencia hay entre lo que dice la pista sobre el grupo y lo que sabemos de este caso?',
  },
  bounds: {
    'answer-only': '¿Cómo comprobarías tu elección con cada una de las condiciones?',
    contradiction: '¿Cómo puedes comprobar si el número que describes cumple la condición que has mencionado?',
  },
};

export function followUpQuestion(lesson, reason) {
  const concept = lesson.kind === 'logic' ? lesson.reasoningType : lesson.kind;
  const question = questions[concept]?.[reason];
  if (!question) return null;
  return `${reason === 'answer-only' ? 'Has indicado tu elección.' : 'Vamos a comprobar esa idea.'} ${question}`;
}

// Advance support through evidence, the visible clue board and another context.
// Uses a recognized issue, never the answer key or a fragment of learner text.
export function inferenceSupport(lesson, detail, help) {
  if (lesson.kind !== 'logic' || lesson.reasoningType !== 'some' ||
      !['unsupported-individual','unsupported-certainty','unsupported-universal','unsupported-exception'].includes(detail)) return null;
  if (help === 1) {
    if (detail === 'unsupported-exception') return 'Busca una pista que hable de alguien sin esa característica. ¿Qué información encuentras?';
    if (detail === 'unsupported-universal') return 'Revisa a quién se refiere cada pista. ¿Qué dato usarías para hablar de cada miembro del grupo?';
    return 'Busca una pista que hable de este caso concreto. ¿Qué información aporta sobre su característica?';
  }
  if (help === 2) return 'En el tablero puedes revisar una pista cada vez. ¿Cuál habla del grupo y cuál aporta un dato sobre este caso?';
  if (help === 3) return 'Otro ejemplo: una caja contiene algunas fichas lisas. Al sacar una sin mirar, ¿qué dato necesitarías para describir su superficie?';
  return null;
}

// A few explicit observations name the attribute but do not explain a relation.
// Ask for the missing connection; never infer mastery or a winning option.
export function observationFollowUp(text, lesson, candidate = null) {
  if (!['same-numerator','same-denominator'].includes(lesson.kind) || typeof text !== 'string') return null;
  const value = normalize(text);
  const size = /^(?:he (?:comparado|mirado|observado)|compare|mire|observe) (?:el tamano|los tamanos) de (?:las partes|los trozos)[.!]*$/.test(value);
  const count = /^(?:he contado|conte) (?:las partes|los trozos)[.!]*$/.test(value);
  if (!size && !count) return null;
  if (candidate) {
    const question = normalize(candidate).replace(/[¿?]/g,'').trim();
    const sizeEcho = size && /^(?:que (?:has )?(?:comparado|mirado|observado)\b|que tamanos?\b)/.test(question) && /\btamanos?\b/.test(question);
    if (!sizeEcho) return null;
  }
  if (count) return 'Has contado las partes. ¿Qué necesitas comprobar sobre su tamaño para comparar las cantidades?';
  return lesson.kind === 'same-numerator'
    ? 'Has mirado el tamaño de las partes. ¿Cómo lo relacionas con las divisiones del mismo entero?'
    : 'Has mirado el tamaño de las partes. ¿Cómo lo usarías junto con cuántas partes hay para explicar tu elección?';
}
