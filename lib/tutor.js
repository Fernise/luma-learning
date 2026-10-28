import { vocabularyHelp } from './lesson-vocabulary.js';
import { fractionLessons, getMission, missionInfo, publicLesson } from './catalog.js';
import { independentlyReasoned, selectNext } from './adaptation.js';
import { assessLocally } from './reasoning.js';
import { normalize } from './reasoning.js';
import { supportIntent, clarificationQuestion } from './learner-language.js';
import { screenExplanation } from './ai-guard.js';
import { followUpQuestion, observationFollowUp, inferenceSupport } from './follow-up.js';
import { validateQuestion, previousQuestions } from './question-policy.js';
export { assessLocally } from './reasoning.js';
import { randomUUID } from 'node:crypto';
export const lessons = fractionLessons;

export const reasoningCategories = ['supported', 'denominator-error', 'guess', 'unsure', 'off-topic', 'unclear'];

export function correctChoice(lesson) {
  if (lesson.kind === 'logic') return lesson.correct;
  if (lesson.kind === 'pattern') {
    const last = lesson.sequence.at(-1);
    const expected = lesson.rule === 'double' ? last * 2 : last + lesson.step;
    const index = lesson.options.indexOf(expected);
    if (index < 0) throw new Error('Actividad sin solución válida.');
    return index;
  }
  const [[a, b], [c, d]] = lesson.fractions;
  return a * d > c * b ? 0 : 1;
}

export function createSession({ useAI = false, missionId = 'fractions', adaptive = false } = {}) {
  const mission = getMission(missionId);
  const lessonIds = adaptive ? [mission.lessons[0].id] : [...mission.defaultRoute];
  return { runId: randomUUID(), missionId, adaptive, lessonIds, routeLength: adaptive ? 5 : lessonIds.length, adaptation: 'start', index: 0, phase: 'answer', choice: null, confidence: null, attempts: 0, help: 0, reasoningTurns: 0, reasoningAttempts: 0, choiceReasoningAttempts: 0, totalTurns: 0, visual: false, paused: false, useAI, records: [], messages: [{ role: 'tutor', text: '¡Hola! Soy Luma. Aquí tenemos tiempo para pensar. Observa las pistas, elige una opción y cuéntame cómo lo ves.' }] };
}

export const currentLesson = session => getMission(session.missionId).lessons.find(lesson => lesson.id === session.lessonIds[session.index]);

function say(session, text, role = 'tutor') {
  session.messages.push({ role, text });
  session.messages = session.messages.slice(-30);
}

function complete(session, explanation) {
  const lesson = currentLesson(session);
  if (session.phase === 'complete') return;
  session.records.push({ lessonId: lesson.id, title: lesson.title, level: lesson.level, skill: lesson.skill, attempts: session.attempts, help: session.help, reasoningAttempts: session.reasoningAttempts ?? null, reasoning: explanation, confidence: session.confidence, transfer: Boolean(lesson.transfer), unaided: session.attempts === 1 && session.help === 0 });
  session.phase = 'complete';
  say(session, explanation === 'supported' ? `${lesson.completion || 'Tu explicación conecta las partes con su tamaño. Has comprobado tu idea.'} ¡Seguimos explorando!` : explanation === 'not-requested' ? 'Tu elección es correcta. ¡Vamos a explorar una situación nueva!' : 'Has llegado a una elección correcta. Guardaremos tu explicación como algo que todavía estamos explorando.');
}

function giveHelp(session, detail = session.inferenceIssue) {
  const lesson = currentLesson(session);
  session.help += 1;
  const specific = inferenceSupport(lesson, detail, session.help);
  if (specific) {
    if (session.help >= 2) session.visual = true;
    say(session, specific);
    session.messages.at(-1).questionSource = 'local';
    session.messages.at(-1).questionReason = 'inference-evidence';
    return;
  }
  if (lesson.hints && session.help <= 3) {
    if (session.help >= 2) session.visual = true;
    say(session, lesson.hints[session.help - 1]);
    return;
  }
  if (session.help === 1) {
    say(session, lesson.kind === 'same-numerator' ? 'Imagina que repartes la misma cantidad entre más personas. ¿Cómo cambia el tamaño de cada trozo?' : 'Si todos los trozos tienen el mismo tamaño, ¿qué necesitas comparar para saber cuánto hay?');
  } else if (session.help === 2) {
    session.visual = true;
    say(session, 'Vamos a dibujarlo. Las dos barras representan cantidades enteras iguales. Mira sus partes: ¿qué observas? Puedes cambiar tu elección.');
  } else if (session.help === 3) {
    session.visual = true;
    const otherParts = [[2, 6], [3, 8], [4, 9]].find(pair => pair.every(count => !lesson.fractions.some(fraction => fraction[1] === count)));
    say(session, lesson.kind === 'same-numerator' ? `Un ejemplo diferente: una galleta repartida entre ${otherParts[0]} personas da trozos más grandes que la misma galleta repartida entre ${otherParts[1]}. Vuelve a tus barras: ¿cómo aplicarías esa idea?` : 'Un ejemplo diferente: si cada bloque mide lo mismo, una fila de 6 bloques ocupa más que una de 3. Vuelve a tus barras: ¿qué compararías?');
  } else {
    session.paused = true;
    say(session, 'Ya hemos pensado bastante. Podemos hacer una pausa o volver a intentarlo con el dibujo. No hay prisa.');
  }
}


function clarificationPrompt(lesson) {
  if (lesson.kind === 'pattern') return 'Todavía no veo qué cambio propones. ¿Cómo pasas de un número conocido al siguiente?';
  if (['same-numerator', 'same-denominator'].includes(lesson.kind)) return 'Necesito un detalle más. ¿Qué has comparado entre las dos cantidades?';
  return 'Necesito un detalle más. ¿Qué pista has usado para justificar tu elección?';
}

function respondToSupport(session, intent) {
  const lesson = currentLesson(session);
  if (intent === 'break') {
    session.paused = true;
    say(session, 'Nos tomamos un respiro. Tu elección sigue aquí; puedes volver cuando quieras.');
    return;
  }
  if (intent === 'frustration' && session.help < 3) {
    session.help += 1;
    session.visual = true;
    say(session, 'Podemos ir paso a paso. No hace falta resolverlo todo ahora. ¿Prefieres mirar el apoyo visual o hacer una pausa?');
    return;
  }
  if (intent === 'hint' || session.help >= 2) { giveHelp(session); return; }
  session.help += 1;
  if (session.help >= 2) session.visual = true;
  if (intent === 'rephrase') {
    say(session, lesson.kind === 'pattern' ? 'Mira dos números vecinos. ¿Qué notas al pasar de uno al otro?' : lesson.kind === 'logic' ? 'Vuelve a una pista del ejercicio. ¿Qué te permite saber sobre tu elección?' : 'Piensa en las dos cantidades enteras. ¿Qué puedes comparar entre sus partes?');
  } else if (intent === 'why') {
    say(session, lesson.kind === 'pattern' ? 'Para comprobar una regla, podemos probarla en otro paso conocido. ¿Qué cambio ves entre dos números vecinos?' : lesson.kind === 'logic' ? 'Para comprobar una elección, necesitamos una pista que la justifique. ¿Qué dato del ejercicio puedes usar?' : 'Para comprobar una comparación, miramos qué representa cada parte de los enteros iguales. ¿Qué cambia al repartirlos?');
  } else if (intent === 'explain') {
    say(session, lesson.kind === 'pattern' ? 'Puedes empezar con «De un número al siguiente…». ¿Qué cambio has observado?' : lesson.kind === 'logic' ? 'Puedes empezar con «Esta pista me dice…». ¿Qué pista has usado?' : 'Puedes empezar con «He comparado…». ¿Qué has mirado en las dos cantidades?');
  } else {
    say(session, lesson.kind === 'pattern' ? 'La pregunta pide elegir qué número sigue si mantenemos una regla en todos los pasos. ¿Qué parte te resulta confusa?' : lesson.kind === 'logic' ? 'La pregunta pide elegir qué puedes asegurar usando las pistas, sin añadir datos. ¿Qué parte te resulta confusa?' : 'La pregunta pide comparar las cantidades que se toman de dos enteros iguales. ¿Qué parte te resulta confusa?');
  }
}

export async function advance(session, action, { assess = assessLocally, onGuard = () => {}, getQuestion = () => null } = {}) {
  if (!action || typeof action.type !== 'string') throw new Error('Acción no válida.');
  if (session.totalTurns >= 80) throw new Error('Esta sesión ha llegado a su límite. Puedes empezar una nueva.');
  const mission = getMission(session.missionId);
  const lesson = currentLesson(session);
  if (action.type === 'answer') {
    if (session.paused || session.phase === 'complete' || session.phase === 'finished') throw new Error('Ahora no se puede responder.');
    if (![0, 1].includes(action.choice)) throw new Error('Elige una de las dos opciones.');
    if (action.confidence != null && !['exploring', 'fairly-sure', 'sure'].includes(action.confidence)) throw new Error('Confianza no válida.');
    delete session.inferenceIssue;
    if (session.choice !== action.choice) session.choiceReasoningAttempts = 0;
    session.choice = action.choice;
    if (session.attempts === 0) session.confidence = action.confidence ?? null;
    session.attempts += 1;
    session.reasoningTurns = 0;
    say(session, `Elijo ${lesson.fractions ? lesson.fractions[action.choice].join('/') : lesson.options[action.choice]}.`, 'student');
    if (session.choice === correctChoice(lesson)) {
      const breathingRoom = session.adaptive && session.records.length >= 2 && session.records.slice(-2).every(independentlyReasoned);
      if (session.attempts > 1 || session.help > 0 || lesson.transfer || (lesson.challenge && !breathingRoom)) {
        session.phase = 'explain';
        say(session, `Tu elección es correcta. ${lesson.question}`);
      } else {
        complete(session, 'not-requested');
      }
    } else {
      session.phase = 'reflect';
      say(session, session.attempts === 1 ? `Cuéntame cómo has llegado a esa elección. ${lesson.question || '¿Qué representa cada número de la fracción?'}` : `Revisemos esa idea con calma. ${lesson.question || '¿Qué puedes comprobar antes de volver a elegir?'}`);
      if (session.attempts > 1) giveHelp(session);
    }
  } else if (action.type === 'explain') {
    if (session.paused || !['reflect', 'explain'].includes(session.phase)) throw new Error('Primero elige una opción.');
    if (typeof action.text !== 'string' || !action.text.trim() || action.text.length > 600) throw new Error('Escribe una explicación de hasta 600 caracteres.');
    const text = action.text.trim();
    say(session, text, 'student');
    session.reasoningTurns += 1;
    const screened = screenExplanation(text, lesson);
    if (screened) onGuard({ source: 'guard', reason: screened.reason });
    const support = screened?.reason === 'support-request' ? supportIntent(normalize(text)) : null;
    if (!support && !['clarification', 'vocabulary'].includes(screened?.reason)) {
      session.reasoningAttempts = (session.reasoningAttempts ?? session.reasoningTurns - 1) + 1;
      session.choiceReasoningAttempts = (session.choiceReasoningAttempts ?? 0) + 1;
    }
    const category = screened?.category ?? await assess(text, lesson);
    if (!reasoningCategories.includes(category)) throw new Error('Evaluación no válida.');
    // Keep only a recognized issue in memory for the next explicit hint/uncertainty.
    // New reasoning, a new choice or a new lesson ends that context; no raw text is added.
    if (inferenceSupport(lesson, screened?.detail, 1)) session.inferenceIssue = screened.detail;
    else if (!support && category !== 'unsure' && !['vocabulary', 'clarification'].includes(screened?.reason)) delete session.inferenceIssue;
    if (screened?.reason === 'vocabulary') {
      session.help += 1;
      say(session, vocabularyHelp(normalize(text), lesson));
    } else if (support) {
      respondToSupport(session, support);
    } else if (screened?.reason === 'clarification') {
      if (session.reasoningTurns >= 3) giveHelp(session);
      else say(session, clarificationQuestion(normalize(text), lesson));
    } else if (category === 'off-topic') {
      say(session, `Vamos a centrarnos en tu idea. Puedo darte una pista. ${lesson.question || '¿Qué representan las partes de estas cantidades?'}`);
      if (session.reasoningTurns >= 3) giveHelp(session);
    } else if (category === 'supported' && session.choice === correctChoice(lesson)) {
      complete(session, 'supported');
    } else if (session.choice === correctChoice(lesson) && session.choiceReasoningAttempts >= 2 && ['unclear', 'guess'].includes(category) && screened?.reason !== 'contradiction') {
      // Avoid repeated interrogation. Correct selection is retained; reasoning is not declared mastered.
      complete(session, 'needs-review');
    } else if (category === 'unsure' || session.reasoningAttempts >= 2) {
      giveHelp(session, screened?.detail);
    } else {
      const candidate = !screened ? getQuestion() : null;
      const validCandidate = ['unclear','guess','denominator-error'].includes(category) && validateQuestion(candidate, lesson, previousQuestions(session.messages)).ok;
      const observation = !screened && category === 'unclear' ? observationFollowUp(text, lesson, validCandidate ? candidate : null) : null;
      if (observation) {
        say(session, observation);
        session.messages.at(-1).questionSource = 'local';
        session.messages.at(-1).questionReason = 'observation-next-step';
      } else if (validCandidate) {
        say(session, candidate);
        session.messages.at(-1).questionSource = 'ai';
      } else say(session, followUpQuestion(lesson, screened?.detail) || followUpQuestion(lesson, screened?.reason) || (category === 'denominator-error' ? 'Has mirado los números. Pensemos también en lo que significan: al dividir la misma cantidad en más partes, ¿cómo cambia cada parte?' : clarificationPrompt(lesson)));
    }
  } else if (action.type === 'hint') {
    if (session.paused || ['complete', 'finished'].includes(session.phase)) throw new Error('Ahora no necesitas una pista.');
    giveHelp(session);
  } else if (action.type === 'pause') {
    session.paused = true;
    say(session, 'Nos tomamos un respiro. Tu exploración te espera aquí.');
  } else if (action.type === 'resume') {
    session.paused = false;
    say(session, '¡Seguimos a tu ritmo! Puedes usar el dibujo o contarme tu idea.');
  } else if (action.type === 'next') {
    if (session.phase !== 'complete') throw new Error('Primero termina esta exploración.');
    if (session.adaptive && session.index + 1 < session.routeLength) {
      const selected = selectNext(mission, session.records, session.lessonIds, lesson, session.index + 1 === session.routeLength - 1);
      session.lessonIds.push(selected.lesson.id); session.adaptation = selected.reason;
    }
    session.index += 1;
    session.choice = null;
    session.confidence = null;
    session.attempts = session.help = session.reasoningTurns = session.reasoningAttempts = session.choiceReasoningAttempts = 0;
    delete session.inferenceIssue;
    session.visual = false;
    session.paused = false;
    if (session.index >= session.routeLength) {
      session.index = session.routeLength - 1;
      session.phase = 'finished';
      say(session, '¡Exploración terminada! Has comparado, explicado y revisado tus ideas. Puedes ver lo que has practicado o empezar de nuevo.');
    } else {
      session.phase = 'answer';
      say(session, currentLesson(session).transfer ? 'Ahora prueba un contexto nuevo. Primero inténtalo a tu manera; las pistas siguen aquí si las necesitas.' : session.adaptation === 'more-support' ? 'Vamos a practicar con una situación más sencilla o parecida. Puedes pedir apoyo cuando lo necesites.' : session.adaptation === 'more-challenge' ? 'Has explicado tu idea sin pistas. Vamos a probar un pequeño reto nuevo.' : 'Una nueva situación. Observa las pistas y elige con calma.');
    }
  } else {
    throw new Error('Acción no disponible.');
  }
  session.totalTurns += 1;
  return publicSession(session);
}

export function publicSession(session) {
  const mission = getMission(session.missionId);
  // IDs are only kept in memory, including for messages from older/restored sessions.
  for (const message of session.messages) message.id ??= randomUUID();
  return { revision: session.totalTurns, runId: session.runId, mission: { ...missionInfo(mission), lessonTitles: Array.from({ length: session.routeLength }, (_, index) => mission.lessons.find(lesson => lesson.id === session.lessonIds[index])?.title ?? (index === session.routeLength - 1 ? 'En otro contexto' : `Descubrimiento ${index + 1}`)) }, adaptive: session.adaptive, adaptation: session.adaptation, lesson: publicLesson(currentLesson(session)), index: session.index, total: session.routeLength, phase: session.phase, choice: session.choice, confidence: session.confidence, visual: session.visual, paused: session.paused, help: session.help, messages: session.messages.slice(-30), records: session.records, mode: session.useAI ? 'ai' : 'local' };
}
