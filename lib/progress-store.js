import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, chmodSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { progressSnapshot } from '../public/storage.js';
import { getMission } from './catalog.js';
const key = token => createHash('sha256').update(token).digest('hex');
const WEEK = 7 * 24 * 3600000;
const DEVICE_LIFETIME = 365 * 24 * 3600000;

export function createProgressStore(path = ':memory:', { now = Date.now } = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ':memory:') chmodSync(path, 0o600);
  db.exec(`PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS devices (device_key TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS runs (device_key TEXT NOT NULL REFERENCES devices(device_key) ON DELETE CASCADE, run_id TEXT NOT NULL, saved_at INTEGER NOT NULL, summary TEXT NOT NULL, PRIMARY KEY(device_key, run_id));
    CREATE TABLE IF NOT EXISTS checkpoints (session_key TEXT PRIMARY KEY, device_key TEXT NOT NULL REFERENCES devices(device_key) ON DELETE CASCADE, updated_at INTEGER NOT NULL, state TEXT NOT NULL);
    PRAGMA user_version = 1;`);
  if (path !== ':memory:') for (const suffix of ['-wal', '-shm']) if (existsSync(path + suffix)) chmodSync(path + suffix, 0o600);
  function prune() { db.prepare('DELETE FROM checkpoints WHERE updated_at < ?').run(now() - WEEK); }
  function enabled(token) { return !!token && !!db.prepare('SELECT device_key FROM devices WHERE device_key = ? AND created_at > ?').get(key(token), now() - DEVICE_LIFETIME); }
  function enable(token) { db.prepare('INSERT INTO devices VALUES (?, ?) ON CONFLICT(device_key) DO UPDATE SET created_at=excluded.created_at').run(key(token), now()); }
  function history(token) {
    if (!enabled(token)) return [];
    return db.prepare('SELECT summary FROM runs WHERE device_key = ? ORDER BY saved_at DESC, rowid DESC LIMIT 20').all(key(token)).map(row => JSON.parse(row.summary));
  }
  function checkpoints(token) {
    if (!enabled(token)) return [];
    prune();
    return db.prepare('SELECT session_key, updated_at, state FROM checkpoints WHERE device_key = ? ORDER BY updated_at DESC, rowid DESC LIMIT 20').all(key(token));
  }
  function recovered(source) {
    const state = JSON.parse(source); const mission = getMission(state.missionId);
    if (!state.lessonIds.every(id => mission.lessons.some(lesson => lesson.id === id))) return null;
    state.useAI = false;
    // Older checkpoints have no per-choice counter: resume conservatively while
    // retaining the cumulative record used for adaptation and family summaries.
    state.choiceReasoningAttempts ??= 0;
    state.messages = [{ role: 'tutor', text: state.paused ? 'Tu actividad está recuperada y en pausa. Seguimos cuando quieras.' : state.phase === 'finished' ? 'Tu recorrido está recuperado. Puedes ver sus observaciones o explorar otra isla.' : state.phase === 'complete' ? 'Has recuperado una situación terminada. Puedes pasar al siguiente descubrimiento.' : state.choice !== null ? 'Hemos recuperado tu elección y tus pistas. La conversación anterior no se guarda. Puedes revisar tu idea o explicarla otra vez.' : 'Tu actividad está recuperada. Observa, prueba y elige con calma.' }];
    return state;
  }
  function pending(token) {
    const seen = new Set();
    return checkpoints(token).flatMap(row => {
      const state = recovered(row.state);
      if (!state || seen.has(state.runId)) return [];
      seen.add(state.runId);
      if (state.phase === 'finished') return [];
      return [{ runId: state.runId, missionId: state.missionId, completed: state.records.length, total: state.routeLength, paused: state.paused, updatedAt: new Date(row.updated_at).toISOString() }];
    });
  }
  function restoreRun(token, runId) {
    const row = checkpoints(token).find(row => JSON.parse(row.state).runId === runId);
    const state = row && recovered(row.state);
    return state && state.phase !== 'finished' ? state : null;
  }
  function save(token, sessionToken, session) {
    if (!enabled(token)) return;
    const owner = key(token); const snapshot = progressSnapshot(session, new Date(now()).toISOString());
    // Checkpoints contain only the state required to resume, never messages or typed explanations.
    const checkpoint = Object.fromEntries(['runId', 'missionId', 'adaptive', 'lessonIds', 'routeLength', 'adaptation', 'index', 'phase', 'choice', 'confidence', 'attempts', 'help', 'reasoningTurns', 'reasoningAttempts', 'choiceReasoningAttempts', 'totalTurns', 'visual', 'paused'].map(name => [name, session[name]]));
    checkpoint.useAI = false;
    checkpoint.records = session.records.map(record => Object.fromEntries(['lessonId', 'title', 'level', 'skill', 'attempts', 'help', 'reasoningAttempts', 'reasoning', 'confidence', 'transfer', 'unaided'].map(name => [name, record[name]])));
    db.exec('BEGIN IMMEDIATE');
    try {
      // A recovered run gets a fresh session credential. Retain one checkpoint per run.
      for (const row of db.prepare('SELECT session_key, state FROM checkpoints WHERE device_key = ?').all(owner)) {
        if (row.session_key !== key(sessionToken) && JSON.parse(row.state).runId === session.runId) db.prepare('DELETE FROM checkpoints WHERE session_key = ? AND device_key = ?').run(row.session_key, owner);
      }
      if (snapshot?.records.length) db.prepare('INSERT INTO runs VALUES (?, ?, ?, ?) ON CONFLICT(device_key,run_id) DO UPDATE SET saved_at=excluded.saved_at, summary=excluded.summary').run(owner, session.runId, now(), JSON.stringify(snapshot));
      db.prepare('INSERT INTO checkpoints VALUES (?, ?, ?, ?) ON CONFLICT(session_key) DO UPDATE SET updated_at=excluded.updated_at, state=excluded.state').run(key(sessionToken), owner, now(), JSON.stringify(checkpoint));
      db.prepare('DELETE FROM runs WHERE device_key = ? AND run_id NOT IN (SELECT run_id FROM runs WHERE device_key = ? ORDER BY saved_at DESC, rowid DESC LIMIT 20)').run(owner, owner);
      db.prepare('DELETE FROM checkpoints WHERE device_key = ? AND session_key NOT IN (SELECT session_key FROM checkpoints WHERE device_key = ? ORDER BY updated_at DESC, rowid DESC LIMIT 20)').run(owner, owner);
      prune(); db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function restore(token, sessionToken) {
    if (!enabled(token)) return null;
    prune();
    const row = db.prepare('SELECT state FROM checkpoints WHERE session_key = ? AND device_key = ?').get(key(sessionToken), key(token));
    if (!row) return null;
    return recovered(row.state);
  }
  return { enabled, enable, history, pending, save, restore, restoreRun,
    forget(token) { if (token) db.prepare('DELETE FROM devices WHERE device_key = ?').run(key(token)); },
    removeCheckpoint(sessionToken) { db.prepare('DELETE FROM checkpoints WHERE session_key = ?').run(key(sessionToken)); },
    close() { db.close(); } };
}
