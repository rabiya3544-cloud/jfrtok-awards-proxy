import crypto from 'node:crypto';

const API = 'https://api.creativeawards.et/api';
const DEFAULT_CATEGORY_ID = '01a0ecb7-050a-7301-b24f-1295e081dd6b';
const SAMPLE_LIMIT = 800;

function sha(body) {
  return crypto.createHash('sha256').update(body).digest('hex');
}

function protocol(req) {
  const xf = req.headers['x-forwarded-proto'];
  if (xf) return String(xf).split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  return /^(localhost|127\.0\.0\.1|\[::1\])/.test(host) ? 'http' : 'https';
}

function buildTargets(categoryId) {
  const cid = encodeURIComponent(categoryId);
  return {
    categories: {
      upstream: `${API}/categories`,
      proxyPath: `/api/categories`,
    },
    category: {
      upstream: `${API}/categories/${cid}`,
      proxyPath: `/api/categories/${cid}`,
    },
    votes: {
      upstream: `${API}/voting/results?category_id=${cid}`,
      proxyPath: `/api/votes?id=${cid}`,
    },
    sponsors: {
      upstream: `${API}/sponsors`,
      proxyPath: `/api/sponsors`,
    },
    packages: {
      upstream: `${API}/voting/packages/preview?category_id=${cid}`,
      proxyPath: `/api/packages?category_id=${cid}`,
    },
    'free-vote-day': {
      upstream: `${API}/voting/free-vote-day`,
      proxyPath: `/api/free-vote-day`,
    },
  };
}

// api/debug.js — replace the two fetch calls in probe()
// and add cache-busting when probing the proxy side.

async function probe(url, { timeout = 12000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  const started = Date.now();
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
    const body = await r.text();
    return {
      ok: r.ok,
      status: r.status,
      contentType: r.headers.get('content-type'),
      ms: Date.now() - started,
      bytes: body.length,
      sha: sha(body),
      sample: body.slice(0, SAMPLE_LIMIT),
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      contentType: null,
      ms: Date.now() - started,
      bytes: 0,
      sha: null,
      sample: null,
      error: err.name === 'AbortError' ? 'timed out' : err.message,
    };
  } finally {
    clearTimeout(t);
  }
}

// And in testOne(), cache-bust the proxy probe:
async function testOne(name, target, baseUrl) {
  const sep = target.proxyPath.includes('?') ? '&' : '?';
  const proxyUrl = `${baseUrl}${target.proxyPath}${sep}_t=${Date.now()}`;
  const [upstream, proxy] = await Promise.all([
    probe(target.upstream),
    probe(proxyUrl, { timeout: 14000 }),   // 4s more than the proxy's own 10s
  ]);
  const match = !!upstream.sha && !!proxy.sha && upstream.sha === proxy.sha;
  return {
    name,
    upstreamUrl: target.upstream,
    proxyUrl: target.proxyPath,             // display clean (no _t)
    upstream,
    proxy,
    match,
    statusMatch: upstream.status === proxy.status,
    sizeMatch: upstream.bytes === proxy.bytes,
  };
}


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) {
    return res.status(500).json({
      error: 'No host header — cannot self-probe the proxy endpoints.',
    });
  }
  const baseUrl = `${protocol(req)}://${host}`;

  const categoryId = req.query.category_id || DEFAULT_CATEGORY_ID;
  const TARGETS = buildTargets(categoryId);

  const which = req.query.endpoint;
  try {
    const started = Date.now();
    let results;

    if (which) {
      if (!Object.keys(TARGETS).includes(which)) {
        return res.status(400).json({
          error: `Unknown endpoint "${which}"`,
          available: Object.keys(TARGETS),
        });
      }
      results = [await testOne(which, TARGETS[which], baseUrl)];
    } else {
      results = await Promise.all(
        Object.entries(TARGETS).map(([name, target]) =>
          testOne(name, target, baseUrl)
        )
      );
    }

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      totalMs: Date.now() - started,
      host,
      baseUrl,
      categoryId,
      sampleLimit: SAMPLE_LIMIT,
      count: results.length,
      allMatch: results.every((r) => r.match),
      results,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    });
  }
}
