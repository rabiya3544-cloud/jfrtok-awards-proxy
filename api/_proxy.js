const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Fetch `targetUrl` and forward the *raw text* to the client, preserving:
 *   - HTTP status
 *   - Content-Type header
 *   - Body bytes (no JSON.parse/stringify round-trip)
 *
 * `_` prefix → Vercel does not expose this file as a route.
 */
export async function proxy(req, res, targetUrl, { cache = 's-maxage=120, stale-while-revalidate=600' } = {}) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 13000);
  
  try {
    const r = await fetch(targetUrl, {
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': UA,
      },
    });
    
    // Grab raw text — do NOT parse/re-serialize.
    const body = await r.text();
    
    res.status(r.status);
res.setHeader(
  'Content-Type',
  r.headers.get('content-type') || 'application/json; charset=utf-8'
);
    res.setHeader('Cache-Control', cache);
    if (r.ok) {
  res.setHeader('Cache-Control', cache);
} else {
  res.setHeader('Cache-Control', 'no-store');
}

return res.send(body);
    
  } catch (err) {
    const message = err.name === 'AbortError' ? 'Upstream timed out' : err.message;
    return res.status(502).json({ error: message });
  } finally {
    clearTimeout(timer);
  }
}
