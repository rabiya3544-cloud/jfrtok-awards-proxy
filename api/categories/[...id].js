import { proxy } from '../_proxy.js';

const API = 'https://api.creativeawards.et/api';

export default (req, res) => {
  // Vercel names the catch-all param after the literal token inside the brackets
  // → req.query['...id'], not req.query.id
  const raw = req.query['...id'] ?? req.query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;

  if (!id) return res.status(404).json({ error: 'Not found' });

  return proxy(req, res, `${API}/categories/${encodeURIComponent(id)}`, {
    cache: 's-maxage=120, stale-while-revalidate=600',
  });
};
