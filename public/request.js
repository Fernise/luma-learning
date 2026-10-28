export const REQUEST_TIMEOUT_MS = 15000;

// Bound both the connection and reading the body. A timeout never retries a mutation.
export async function requestJSON(path, payload, method = 'POST', { fetchImpl = fetch, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('La respuesta está tardando demasiado. Revisa el recorrido antes de volver a intentarlo.');
      error.code = 'request_timeout';
      reject(error); controller.abort();
    }, timeoutMs);
  });
  const operation = (async () => {
    let response;
    try { response = await fetchImpl(path, { method, signal: controller.signal, headers: { 'Content-Type': 'application/json' }, ...(payload ? { body: JSON.stringify(payload) } : {}) }); }
    catch { throw new Error('No podemos conectar con Luma. Vuelve a intentarlo en un momento.'); }
    let result;
    try { result = await response.json(); }
    catch { throw new Error('No hemos podido leer la respuesta de Luma. Tu idea sigue aquí; revisa el recorrido antes de volver a intentarlo.'); }
    if (!response.ok) {
      const error = new Error(typeof result?.error === 'string' ? result.error : 'No se ha podido conectar.');
      error.status = response.status; error.code = result?.code; throw error;
    }
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('No hemos podido leer la respuesta de Luma. Revisa el recorrido antes de volver a intentarlo.');
    return result;
  })();
  try { return await Promise.race([operation, deadline]); }
  finally { clearTimeout(timer); }
}
