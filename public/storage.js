export const PROGRESS_KEY = 'luma.progress.v1';
export const SESSION_KEY = 'luma.session.v1';
const ids = ['fractions', 'patterns', 'logic'];
const reasons = ['supported', 'needs-review', 'not-requested'];
const confidence = ['exploring', 'fairly-sure', 'sure'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Persist observations only. Conversations, typed explanations and credentials are excluded.
export function progressSnapshot(state, savedAt = new Date().toISOString()) {
  const runId = state?.runId ?? state?.id;
  if (!state || !uuid.test(runId ?? '') || !ids.includes(state.mission?.id ?? state.missionId) || !Array.isArray(state.records)) return null;
  const records = state.records.slice(0, 12).filter(record => reasons.includes(record.reasoning) && Number.isInteger(record.attempts) && record.attempts >= 1 && record.attempts <= 80 && Number.isInteger(record.help) && record.help >= 0 && record.help <= 80).map(record => ({
    lessonId: typeof record.lessonId === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(record.lessonId) ? record.lessonId : null, level: [1, 2, 3].includes(record.level) ? record.level : null, attempts: record.attempts, help: record.help, reasoningAttempts: Number.isInteger(record.reasoningAttempts) && record.reasoningAttempts >= 0 && record.reasoningAttempts <= 80 ? record.reasoningAttempts : null, reasoning: record.reasoning, confidence: confidence.includes(record.confidence) ? record.confidence : null, transfer: record.transfer === true, unaided: record.unaided === true,
  }));
  return { id: runId, missionId: state.mission?.id ?? state.missionId, savedAt, finished: state.phase === 'finished' || state.finished === true, total: Number.isInteger(state.total ?? state.routeLength) && (state.total ?? state.routeLength) >= 1 && (state.total ?? state.routeLength) <= 12 ? (state.total ?? state.routeLength) : Number.isInteger(state.total) ? state.total : null, records };
}

export function readProgress(storage) {
  try {
    const raw = storage.getItem(PROGRESS_KEY);
    if (!raw) return { enabled: false, history: [] };
    const value = JSON.parse(raw);
    if (value.version !== 1 || !Array.isArray(value.history)) return { enabled: false, history: [] };
    const history = value.history.slice(0, 20).map(run => {
      if (typeof run.savedAt !== 'string' || !Number.isFinite(Date.parse(run.savedAt))) return null;
      return progressSnapshot(run, new Date(run.savedAt).toISOString());
    }).filter(run => run && run.records.length);
    return { enabled: true, history };
  } catch { return { enabled: false, history: [] }; }
}

export function writeProgress(storage, history) {
  try { storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, history: history.slice(0, 20) })); return true; }
  catch { return false; }
}

export function sessionId(storage) {
  try { const id = storage.getItem(SESSION_KEY); return uuid.test(id ?? '') ? id : null; }
  catch { return null; }
}

// Re-sanitize at the export boundary, even if a future history source adds fields.
export function buildProgressExport(history, missions, exportedAt = new Date().toISOString()) {
  const runs = history.slice(0, 20).flatMap(run => {
    if (typeof run?.savedAt !== 'string' || !Number.isFinite(Date.parse(run.savedAt))) return [];
    const snapshot = progressSnapshot(run, new Date(run.savedAt).toISOString());
    if (!snapshot?.records.length) return [];
    const { id, ...safe } = snapshot;
    return [{ ...safe, title: missions.find(mission => mission.id === safe.missionId)?.title }];
  });
  return { app: 'Luma', exportedAt, note: 'Observaciones de práctica. No constituyen una evaluación validada del aprendizaje.', runs };
}
