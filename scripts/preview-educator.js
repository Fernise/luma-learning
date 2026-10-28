import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { localRequestAllowed, setSecurityHeaders } from '../lib/http-security.js';
const routes = new Map([
  ['/', ['revision-36.html', 'text/html; charset=utf-8']],
  ['/auditoria', ['auditoria-educativa.md', 'text/plain; charset=utf-8']],
  ['/guia', ['revision-educador.md', 'text/plain; charset=utf-8']],
]);
export function createEducatorPreview() {
  const server = createServer(async (req, res) => {
    setSecurityHeaders(res); res.setHeader('Cache-Control', 'no-store');
    if (!localRequestAllowed(req, server.address()?.port)) { res.writeHead(403); res.end(); return; }
    const route = routes.get(req.url);
    if (req.method !== 'GET' || !route) { res.writeHead(404); res.end(); return; }
    try {
      const body = await readFile(new URL(`../docs/${route[0]}`, import.meta.url), 'utf8');
      // Generated review pages have one inline style/script. Authorize their exact content only.
      const hash = content => `'sha256-${createHash('sha256').update(content).digest('base64')}'`;
      const script = body.match(/<script>([\s\S]*?)<\/script>/)?.[1];
      const style = body.match(/<style>([\s\S]*?)<\/style>/)?.[1];
      setSecurityHeaders(res, { csp: `default-src 'none'; script-src ${script ? hash(script) : "'none'"}; style-src ${style ? hash(style) : "'none'"}; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` });
      res.writeHead(200, { 'Content-Type': route[1] }); res.end(body);
    } catch { res.writeHead(503); res.end('Generate the review pack first.'); }
  });
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) createEducatorPreview().listen(4175, '127.0.0.1', () => console.log('Adult review only: http://127.0.0.1:4175 · no API or progress storage'));
