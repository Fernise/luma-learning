import { createApp } from '../server.js';

// Disposable complete journeys, no .env, disk progress or external provider.
// localhost keeps test browser cookies separate from 127.0.0.1 main preview.
const server = createApp({ env: {} });
server.listen(4174, '127.0.0.1', () => console.log('Beta review: http://localhost:4174 · memory only, AI disabled'));
