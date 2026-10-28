// This preview accepts only its literal loopback authorities, never a proxy or forwarded host.
export function localRequestAllowed(req, port) {
  const authorities = ['127.0.0.1', 'localhost'].flatMap(host => port === 80 ? [host, `${host}:80`] : [`${host}:${port}`]);
  const host = req.headers.host;
  if (!authorities.includes(host)) return false;
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  if (req.headers.origin !== undefined && req.headers.origin !== `http://${host}`) return false;
  return true;
}

export function deviceCookie(header) {
  if (!header) return null;
  const entries = header.split(';').map(part => part.trim()).filter(part => part.split('=')[0].trim() === 'luma_device');
  if (!entries.length) return null;
  // Fail closed rather than silently selecting one of two credentials or treating it as absent.
  if (entries.length !== 1 || !/^luma_device=[a-f0-9]{64}$/.test(entries[0])) throw new Error('Invalid device cookie');
  return entries[0].slice('luma_device='.length);
}

export function setSecurityHeaders(res, { csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" } = {}) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', csp);
}
