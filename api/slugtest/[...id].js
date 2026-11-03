import { proxy } from '../_proxy.js';

const API = 'https://api.creativeawards.et/api';

export default (req, res) => {
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) return res.status(404).json({ error: 'Not found' });
  
  return proxy(req, res, `${API}/categories/${encodeURIComponent(id)}`, {
    cache: 's-maxage=120, stale-while-revalidate=600',
  });
};
