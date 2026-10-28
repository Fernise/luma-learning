import { createApp } from '../server.js';
import { createSession } from '../lib/tutor.js';
import { missions } from '../lib/catalog.js';
import { createProgressStore } from '../lib/progress-store.js';

// Adult review of one authored activity. No .env, external provider or disk progress.
const lessonId = process.argv.find(arg => arg.startsWith('--lesson='))?.slice(9) ?? 'lanterns';
const mission = missions.find(mission => mission.lessons.some(lesson => lesson.id === lessonId));
if (!mission) throw new Error('Choose an existing authored lesson ID.');
const store = createProgressStore();
const device = 'c'.repeat(64); const id = 'lesson-review-fixture';
store.enable(device);
store.save(device, id, Object.assign(createSession({ missionId: mission.id }), { lessonIds: [lessonId], routeLength: 1 }));
const server = createApp({ env: {}, store });
const handle = server.listeners('request')[0]; server.removeAllListeners('request');
server.on('request', (req, res) => {
  req.headers.cookie = `luma_device=${device}`;
  if (req.method === 'POST' && req.url === '/api/session') { req.resume(); req.method = 'GET'; req.url = `/api/session/${id}`; }
  handle(req, res);
});
server.listen(4174, '127.0.0.1', () => console.log(`Adult lesson fixture: http://localhost:4174 · ${lessonId} · memory only, AI disabled`));
