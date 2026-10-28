import { createApp } from '../server.js';
import { createProgressStore } from '../lib/progress-store.js';
import { createSession, advance } from '../lib/tutor.js';
import { randomUUID } from 'node:crypto';
import { localRequestAllowed, setSecurityHeaders } from '../lib/http-security.js';

// Synthetic device and progress, memory only. No .env or external provider.
// Use localhost so the real 127.0.0.1 preview's cookie is never involved.
const scenario = process.env.LUMA_RESUME_SCENARIO ?? 'normal';
if (!['normal', 'missing', 'delayed'].includes(scenario)) throw new Error('Unknown fixture scenario');
const device = 'd'.repeat(64); const store = createProgressStore(); store.enable(device);
const fractions = createSession({ missionId: 'fractions', adaptive: true });
await advance(fractions, { type: 'answer', choice: 1 });
await advance(fractions, { type: 'hint' });
store.save(device, randomUUID(), fractions);
store.save(device, randomUUID(), createSession({ missionId: 'patterns', adaptive: true }));
const server = createApp({ env: {}, store }); const [handler] = server.listeners('request');
server.removeListener('request', handler);
server.on('request', (req, res) => {
  if (!localRequestAllowed(req, server.address()?.port)) return handler(req, res);
  if (req.url.startsWith('/api/')) req.headers.cookie = `luma_device=${device}`;
  if (req.method === 'POST' && req.url === '/api/resume') {
    if (scenario === 'missing') {
      req.resume(); setSecurityHeaders(res);
      res.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ error: 'Este recorrido guardado ya no está disponible. Los puntos de reanudación duran hasta 7 días.' }));
    }
    if (scenario === 'delayed') return setTimeout(() => handler(req, res), 2000);
  }
  return handler(req, res);
});
server.listen(4176, '127.0.0.1', () => console.log(`Resume fixture: http://localhost:4176 · ${scenario} · synthetic memory only`));
