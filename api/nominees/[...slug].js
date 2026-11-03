import { proxy } from '../_proxy.js';

import { API } from '../_config.js';

export default (req, res) => {
  // Mirror the categories catch-all: Vercel may expose the param as '...slug'
  const raw = req.query['...slug'] ?? req.query.slug;
  const slug = Array.isArray(raw) ? raw[0] : raw;

  if (!slug) return res.status(404).json({ error: 'Not found' });

  return proxy(
    req,
    res,
    `${API}/nominees/${encodeURIComponent(slug)}`,
    { cache: 's-maxage=120, stale-while-revalidate=600' }
  );
};
