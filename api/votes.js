import { proxy } from './_proxy.js';
const API = 'https://api.creativeawards.et/api';

export default (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Missing ?id=' });
  return proxy(
    req,
    res,
    `${API}/voting/results?category_id=${encodeURIComponent(id)}`,
    { cache: 's-maxage=30, stale-while-revalidate=120' }
  );
};
