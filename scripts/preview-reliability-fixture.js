import { createApp } from '../server.js';

// Disposable memory-only UI scenarios. Never loads .env, persists progress or calls an external provider.
const scenario = process.argv.find(arg => arg.startsWith('--scenario='))?.slice(11) ?? 'timeout';
if (!['timeout', 'conflict', 'removed'].includes(scenario)) throw new Error('Unknown reliability scenario.');
let providerCalls = 0;
const server = createApp({
  env: scenario === 'removed' ? { OPENAI_API_KEY: 'fixture-only', OPENAI_MODEL: 'simulated', LUMA_AI_MAX_CALLS: '10' } : {},
  fetchImpl: async () => {
    providerCalls++;
    await new Promise(resolve => setTimeout(resolve, 5000));
    return { ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"category":"supported"}' }] }] }) };
  },
});
const handle = server.listeners('request')[0]; server.removeAllListeners('request');
let sharedId; let attempts = 0; let committed = 0; let conflicts = 0; let recoveries = 0;
let delayedRecovery = false;
server.on('request', (req, res) => {
  if (req.method === 'POST' && req.url === '/api/session' && sharedId) { req.resume(); req.method = 'GET'; req.url = `/api/session/${sharedId}`; }
  if (req.method === 'POST' && req.url === '/api/turn') {
    const number = ++attempts; const end = res.end.bind(res);
    res.end = (chunk, ...args) => {
      if (res.statusCode === 200) committed++;
      if (res.statusCode === 409) { conflicts++; delayedRecovery = scenario === 'conflict'; }
      console.log(JSON.stringify({ scenario, event: 'turn', status: res.statusCode, attempts, committed, conflicts, providerCalls }));
      if (scenario === 'timeout' && number === 2 && res.statusCode === 200) return setTimeout(() => end(chunk, ...args), 18000);
      return end(chunk, ...args);
    };
  }
  if (req.method === 'GET' && req.url.startsWith('/api/session/')) {
    recoveries++; const delay = delayedRecovery ? 2500 : 0; delayedRecovery = false;
    const end = res.end.bind(res);
    res.end = (chunk, ...args) => {
      console.log(JSON.stringify({ scenario, event: 'read', status: res.statusCode, recoveries, attempts, committed, conflicts, providerCalls, delay }));
      return setTimeout(() => end(chunk, ...args), delay);
    };
  }
  handle(req, res);
});
server.listen(4174, '127.0.0.1', async () => {
  const response = await fetch('http://localhost:4174/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ useAI: scenario === 'removed' }) });
  sharedId = (await response.json()).id;
  console.log(`Reliability fixture ready on http://localhost:4174 (${scenario}). Shared disposable session; provider simulated; use localhost to keep its browser cookies separate from the main preview.`);
});
