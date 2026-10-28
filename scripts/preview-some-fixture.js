import { createApp } from '../server.js';
import { createSession } from '../lib/tutor.js';
import { createProgressStore } from '../lib/progress-store.js';
// Single authored lesson, real HTTP/tutor pipeline, memory-only progress and no provider.
const store = createProgressStore();
const device = 'b'.repeat(64); const id = 'some-review-fixture';
store.enable(device);
const session = Object.assign(createSession({ missionId: 'logic' }), { lessonIds: ['some'], routeLength: 1 });
store.save(device, id, session);
const server = createApp({ env: {}, store });
const handle = server.listeners('request')[0]; server.removeAllListeners('request');
server.on('request', (req, res) => {
  req.headers.cookie = `luma_device=${device}`;
  if (req.method === 'POST' && req.url === '/api/session') { req.resume(); req.method = 'GET'; req.url = `/api/session/${id}`; }
  handle(req, res);
});
server.listen(4174, '127.0.0.1', () => console.log('Some-inference fixture: http://localhost:4174 · memory only, AI disabled'));
