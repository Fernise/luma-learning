import { createApp } from '../server.js';
import { getMission, publicLesson } from '../lib/catalog.js';

// Isolated UI fixture: response changes are synthetic and never commit a tutor turn.
// No .env, provider credentials, disk store, or learner text are read or written.
const scenario = process.argv.find(arg => arg.startsWith('--scenario='))?.slice(11) ?? 'same';
if (!['same', 'missing', 'choice', 'lesson'].includes(scenario)) throw new Error('Unknown recovery fixture scenario.');
const delayMs = Number(process.argv.find(arg => arg.startsWith('--delay-ms='))?.slice(11) ?? 0);
const failTurn = Number(process.argv.find(arg => arg.startsWith('--fail-turn='))?.slice(12) ?? 0);
const shareSession = process.argv.includes('--share-session');
if (shareSession && (scenario !== 'same' || delayMs || failTurn)) throw new Error('Shared session fixture requires unmodified responses.');
if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 10000 || !Number.isInteger(failTurn) || failTurn < 0) throw new Error('Invalid fixture timing or turn.');
const server = createApp({ env: {} });
const handle = server.listeners('request')[0];
server.removeAllListeners('request');
let turns = 0; let recoveries = 0;
let sharedId;
server.on('request', (req, res) => {
  // Test tabs opt into one memory-only session. All later GETs and turns use the real server.
  if (shareSession && req.method === 'POST' && req.url === '/api/session') {
    if (sharedId) { req.resume(); req.method = 'GET'; req.url = `/api/session/${sharedId}`; }
    else {
      const end = res.end.bind(res);
      res.end = (chunk, ...args) => {
        const result = JSON.parse(String(chunk));
        if (res.statusCode === 201) sharedId = result.id;
        return end(chunk, ...args);
      };
    }
  }
  if (req.method === 'POST' && req.url === '/api/turn') {
    turns++;
    if (turns === failTurn) {
      req.resume(); res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Fixture: turn unavailable.' })); return;
    }
  }
  if (req.method === 'GET' && req.url.startsWith('/api/session/')) {
    recoveries++;
    let successful = false;
    const writeHead = res.writeHead.bind(res); const end = res.end.bind(res);
    res.writeHead = (status, ...args) => {
      successful = status === 200;
      return writeHead(successful && scenario === 'missing' ? 404 : status, ...args);
    };
    res.end = (chunk, ...args) => {
      // Audit counts only: never log session identifiers or text written in the UI.
      console.log(JSON.stringify({ scenario, recoveries, tutorTurns: turns }));
      if (successful) {
        let next = JSON.parse(String(chunk));
        if (scenario === 'missing') next = { error: 'Fixture: no recoverable activity.' };
        else if (scenario === 'choice') { next.choice = next.choice === 0 ? 1 : 0; next.phase = 'reflect'; }
        else if (scenario === 'lesson') {
          next.index = 1; next.lesson = publicLesson(getMission(next.mission.id).lessons[1]); next.choice = null; next.phase = 'answer';
        }
        return setTimeout(() => end(JSON.stringify(next), ...args), delayMs);
      }
      return setTimeout(() => end(chunk, ...args), delayMs);
    };
  }
  handle(req, res);
});
server.listen(4174, '127.0.0.1', () => console.log(`Recovery fixture on localhost:4174 (${scenario}); memory only, AI disabled.`));
