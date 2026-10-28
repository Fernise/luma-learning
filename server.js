import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash, randomBytes } from 'node:crypto';
import { createSession, advance, publicSession } from './lib/tutor.js';
import { aiAvailable, createAIService } from './lib/ai.js';
import { createProgressStore } from './lib/progress-store.js';
import { missions, missionInfo } from './lib/catalog.js';
import { localRequestAllowed, deviceCookie, setSecurityHeaders } from './lib/http-security.js';
import { previousQuestions } from './lib/question-policy.js';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const staticFiles = { '/': ['index.html', 'text/html; charset=utf-8'], '/assets/luma-app.js': ['app.js', 'text/javascript; charset=utf-8'], '/assets/luma-storage.js': ['storage.js', 'text/javascript; charset=utf-8'], '/assets/luma-exploration.js': ['exploration.js', 'text/javascript; charset=utf-8'], '/assets/luma-conversation.js': ['conversation.js', 'text/javascript; charset=utf-8'], '/assets/luma-recovery.js': ['recovery.js', 'text/javascript; charset=utf-8'], '/assets/luma-request.js': ['request.js', 'text/javascript; charset=utf-8'], '/assets/luma.css': ['styles.css', 'text/css; charset=utf-8'] };

async function assetVersion() {
  const files = await Promise.all(['app.js', 'storage.js', 'exploration.js', 'conversation.js', 'recovery.js', 'request.js', 'styles.css'].map(file => readFile(root + file)));
  const hash = createHash('sha256');
  files.forEach(file => hash.update(file));
  return hash.digest('hex').slice(0, 16);
}

export function createApp({ env = process.env, fetchImpl = fetch, store = createProgressStore() } = {}) {
  const sessions = new Map();
  const ai = createAIService({ env, fetchImpl });
  function send(res, status, value) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  }
  async function body(req) {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) throw new Error('Formato de petición no válido.');
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 4096) throw new Error('La petición es demasiado larga.');
      chunks.push(chunk);
    }
    // Decode once: a multibyte character may cross HTTP chunks. Invalid UTF-8 is rejected.
    const source = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    return JSON.parse(source || '{}');
  }
  function fields(value, allowed) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Campos no permitidos.');
  }
  const server = http.createServer(async (req, res) => {
    setSecurityHeaders(res);
    try {
      const url = new URL(req.url, 'http://localhost');
      if (!req.url.startsWith('/') || req.url.startsWith('//')) return send(res, 403, { error: 'Dirección no permitida.' });
      if (!localRequestAllowed(req, server.address()?.port)) return send(res, 403, { error: 'Acceso local no permitido.' });
      const cookie = deviceCookie(req.headers.cookie);
      const device = store.enabled(cookie) ? cookie : null;
      if (req.method === 'GET' && url.pathname === '/api/progress') return send(res, 200, { enabled: store.enabled(device), history: store.history(device), pending: store.pending(device) });
      if (req.method === 'POST' && url.pathname === '/api/progress/enable') {
        const payload = await body(req);
        fields(payload, ['consent', 'sessionId']);
        if (payload.consent !== true) return send(res, 400, { error: 'El guardado requiere activar la opción para adultos.' });
        if (payload.sessionId !== undefined && (typeof payload.sessionId !== 'string' || !payload.sessionId.length || payload.sessionId.length > 128)) throw new Error('Sesión no válida.');
        const entry = sessions.get(payload.sessionId);
        if (entry?.device && entry.device !== device) return send(res, 404, { error: 'Sesión no disponible.' });
        const token = store.enabled(device) ? device : randomBytes(32).toString('hex');
        store.enable(token);
        res.setHeader('Set-Cookie', `luma_device=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`);
        if (entry) { store.save(token, payload.sessionId, entry.session); entry.device = token; }
        return send(res, 200, { enabled: true, history: store.history(token), pending: store.pending(token) });
      }
      if (req.method === 'DELETE' && url.pathname === '/api/progress') {
        store.forget(device);
        for (const [id, entry] of sessions) if (device && entry.device === device) sessions.delete(id);
        res.setHeader('Set-Cookie', 'luma_device=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
        return send(res, 200, { enabled: false, history: [], pending: [] });
      }
      if (req.method === 'GET' && url.pathname === '/api/config') return send(res, 200, { aiAvailable: aiAvailable(env), ai: ai.status() });
      if (req.method === 'GET' && url.pathname === '/api/missions') return send(res, 200, { missions: missions.map(missionInfo) });
      if (req.method === 'GET' && url.pathname.startsWith('/api/session/')) {
        const id = url.pathname.slice('/api/session/'.length);
        let entry = sessions.get(id);
        if (entry && Date.now() - entry.touched > 3600000) { sessions.delete(id); entry = null; }
        if (!entry) { const restored = store.restore(device, id); if (restored && sessions.size < 100) { entry = { session: restored, touched: Date.now(), busy: false, device }; sessions.set(id, entry); } }
        if (!entry || (entry.device && entry.device !== device)) return send(res, 404, { error: 'La sesión ha caducado. Empieza una nueva.' });
        return send(res, 200, { id, ...publicSession(entry.session) });
      }
      if (req.method === 'POST' && url.pathname === '/api/resume') {
        const payload = await body(req);
        fields(payload, ['runId']);
        if (typeof payload.runId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(payload.runId)) throw new Error('Recorrido no válido.');
        const now = Date.now();
        for (const [id, entry] of sessions) if (now - entry.touched > 3600000 && !entry.busy) sessions.delete(id);
        if (!device) return send(res, 404, { error: 'Este recorrido guardado ya no está disponible en este navegador.' });
        // Reuse a live session, including its revision, rather than fork a second copy.
        for (const [id, entry] of sessions) if (entry.device === device && entry.session.runId === payload.runId && entry.session.phase !== 'finished') {
          if (entry.busy) return send(res, 409, { code: 'session_busy', error: 'Hay otra respuesta en curso. Espera un momento y revisa el recorrido.' });
          store.save(device, id, entry.session);
          entry.touched = now;
          return send(res, 200, { id, ...publicSession(entry.session) });
        }
        const session = store.restoreRun(device, payload.runId);
        if (!session) return send(res, 404, { error: 'Este recorrido guardado ya no está disponible. Los puntos de reanudación duran hasta 7 días.' });
        if (sessions.size >= 100) return send(res, 429, { error: 'Hay demasiadas sesiones. Vuelve a intentarlo más tarde.' });
        const id = randomUUID();
        store.save(device, id, session);
        sessions.set(id, { session, touched: now, busy: false, device });
        return send(res, 200, { id, ...publicSession(session) });
      }
      if (req.method === 'POST' && url.pathname === '/api/session') {
        const now = Date.now();
        for (const [id, entry] of sessions) if (now - entry.touched > 3600000) sessions.delete(id);
        if (sessions.size >= 100) return send(res, 429, { error: 'Hay demasiadas sesiones. Vuelve a intentarlo más tarde.' });
        const payload = await body(req);
        fields(payload, ['useAI', 'missionId', 'adaptive']);
        if ((payload.useAI !== undefined && typeof payload.useAI !== 'boolean') || (payload.adaptive !== undefined && typeof payload.adaptive !== 'boolean') || (payload.missionId !== undefined && typeof payload.missionId !== 'string')) throw new Error('Opciones no válidas.');
        if (payload.useAI && !aiAvailable(env)) return send(res, 400, { error: 'La IA opcional no está configurada.' });
        const id = randomUUID();
        const session = createSession({ useAI: payload.useAI === true, missionId: payload.missionId, adaptive: payload.adaptive !== false });
        store.save(device, id, session);
        sessions.set(id, { session, touched: now, busy: false, device: store.enabled(device) ? device : null });
        return send(res, 201, { id, ...publicSession(session) });
      }
      if (req.method === 'POST' && url.pathname === '/api/turn') {
        const payload = await body(req);
        fields(payload, ['id', 'revision', 'action']);
        const actionFields = { answer: ['type', 'choice', 'confidence'], explain: ['type', 'text'], hint: ['type'], pause: ['type'], resume: ['type'], next: ['type'] };
        if (!Object.hasOwn(actionFields, payload.action?.type) || typeof payload.id !== 'string') throw new Error('Acción no disponible.');
        fields(payload.action, actionFields[payload.action.type]);
        if (!Number.isSafeInteger(payload.revision) || payload.revision < 0 || payload.revision > 80) throw new Error('Versión del recorrido no válida.');
        const entry = sessions.get(payload.id);
        if (!entry || (entry.device && entry.device !== device) || Date.now() - entry.touched > 3600000) return send(res, 404, { error: 'La sesión ha caducado. Empieza una nueva.' });
        if (entry.busy) return send(res, 409, { code: 'session_busy', error: 'Hay otra respuesta en curso. Espera un momento y revisa el recorrido.' });
        if (payload.revision !== entry.session.totalTurns) return send(res, 409, { code: 'session_changed', error: 'Tu recorrido ha cambiado en otra pantalla. Revisa el avance antes de volver a intentarlo.' });
        entry.busy = true;
        let fallback = false;
        let assessment;
        let question = null;
        // Commit a turn atomically; invalid actions and failed assessments do not mutate the session.
        const draft = structuredClone(entry.session);
        try {
          const state = await advance(draft, payload.action, { getQuestion: () => question, onGuard: result => { assessment = result; if (draft.useAI) ai.recordGuard(); }, ...(draft.useAI ? { assess: (text, lesson) => ai.assess(text, lesson, { runId: draft.runId, context: {previousQuestions: previousQuestions(draft.messages),help: draft.help}, onQuestion: value => { question = value; }, onResult: result => { assessment = result; fallback = result.source === 'local'; } }) } : {}) });
          // A deletion in another tab invalidates this in-flight result, including its checkpoint.
          if (sessions.get(payload.id) !== entry || (entry.device && !store.enabled(entry.device))) return send(res, 404, { code: 'session_removed', error: 'Este recorrido se ha borrado en otra pantalla.' });
          store.save(entry.device ?? device, payload.id, draft);
          entry.session = draft;
          entry.touched = Date.now();
          return send(res, 200, { id: payload.id, ...state, fallback, ...(assessment ? { assessment } : {}) });
        } finally { entry.busy = false; }
      }
      if (req.method === 'DELETE' && url.pathname.startsWith('/api/session/')) {
        if (url.search && url.search !== '?keepProgress=1') throw new Error('Opción no válida.');
        const id = url.pathname.slice('/api/session/'.length); const entry = sessions.get(id);
        if (entry?.device && entry.device !== device) return send(res, 404, { error: 'Sesión no disponible.' });
        const restored = !entry ? store.restore(device, id) : null;
        if (entry || restored) { sessions.delete(id); if (url.search !== '?keepProgress=1') store.removeCheckpoint(id); }
        return send(res, 200, { deleted: true });
      }
      if (req.method === 'GET' && staticFiles[url.pathname]) {
        const [file, type] = staticFiles[url.pathname];
        let source = await readFile(root + file, 'utf8');
        if (file === 'index.html') {
          const version = await assetVersion();
          source = source.replaceAll('/assets/luma.css', `/assets/luma.css?v=${version}`).replaceAll('/assets/luma-app.js', `/assets/luma-app.js?v=${version}`);
        } else if (file === 'app.js') {
          const version = await assetVersion();
          source = source.replace("'./storage.js'", `'./luma-storage.js?v=${version}'`).replace("'./exploration.js'", `'./luma-exploration.js?v=${version}'`).replace("'./conversation.js'", `'./luma-conversation.js?v=${version}'`).replace("'./recovery.js'", `'./luma-recovery.js?v=${version}'`).replace("'./request.js'", `'./luma-request.js?v=${version}'`);
        }
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
        return res.end(source);
      }
      send(res, 404, { error: 'No encontrado.' });
    } catch {
      send(res, 400, { error: 'No hemos podido procesar esa acción. Revisa tu respuesta e inténtalo otra vez.' });
    }
  });
  server.on('close', () => store.close());
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createApp({ store: createProgressStore(fileURLToPath(new URL('./data/luma.sqlite', import.meta.url))) }).listen(port, '127.0.0.1', () => console.log(`Luma is ready at http://127.0.0.1:${port}`));
}
