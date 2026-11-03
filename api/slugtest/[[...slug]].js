// TEMPORARY — for testing only. Delete after verifying.
import { proxy } from '../_proxy.js';

const API = 'https://api.creativeawards.et/api';

export default (req, res) => {
  const slug = req.query.slug;
  const segments = Array.isArray(slug) ? slug : (slug ? [slug] : []);

  if (segments.length === 0) {
    return proxy(req, res, `${API}/categories`, {
      cache: 's-maxage=120, stale-while-revalidate=600',
    });
  }
  if (segments.length === 1) {
    return proxy(req, res, `${API}/categories/${encodeURIComponent(segments[0])}`, {
      cache: 's-maxage=120, stale-while-revalidate=600',
    });
  }
  return res.status(404).json({ error: 'Not found' });
};
