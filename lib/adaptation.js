// Transparent practice rules, not an estimate of ability or a validated learning model.
export const independentlyReasoned = record => record?.reasoning === 'supported' && record.unaided === true && record.reasoningAttempts === 1;

export function selectNext(mission, records, usedIds, lastLesson, final = false) {
  const last = records.at(-1);
  const needsSupport = last && (last.reasoning === 'needs-review' || last.help > 0 || last.attempts >= 2 || last.reasoningAttempts > 1);
  const independentExplanation = independentlyReasoned(last);
  const target = Math.max(1, Math.min(3, lastLesson.level + (needsSupport ? -1 : independentExplanation ? 1 : 0)));
  const practicedSkills = mission.lessons.filter(lesson => usedIds.includes(lesson.id)).map(lesson => lesson.skill);
  const candidates = mission.lessons.filter(lesson => !usedIds.includes(lesson.id) && Boolean(lesson.transfer) === final && (!final || practicedSkills.includes(lesson.skill)));
  candidates.sort((a, b) => (needsSupport ? Number(a.level > lastLesson.level) - Number(b.level > lastLesson.level) : 0) ||
    (final || needsSupport ? Number(b.skill === lastLesson.skill) - Number(a.skill === lastLesson.skill) : 0) || Math.abs(a.level - target) - Math.abs(b.level - target) ||
    (needsSupport ? Number(b.skill === lastLesson.skill) - Number(a.skill === lastLesson.skill) : Number(a.skill === lastLesson.skill) - Number(b.skill === lastLesson.skill)) || a.level - b.level);
  if (!candidates.length) throw new Error('No quedan actividades para este recorrido.');
  const lesson = candidates[0];
  return { lesson, reason: final ? 'new-context' : needsSupport ? 'more-support' : independentExplanation && lesson.level > lastLesson.level ? 'more-challenge' : 'practice', target };
}
