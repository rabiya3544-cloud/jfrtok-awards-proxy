import { proxy } from '../../_proxy.js';

const API = 'https://api.creativeawards.et/api';

export default (req, res) => {
  const id = req.query.category_id;
  if (!id) return res.status(400).json({ error: 'Missing ?category_id=' });

  return proxy(
    req,
    res,
    `${API}/voting/packages/preview?category_id=${encodeURIComponent(id)}`,
    { cache: 's-maxage=300, stale-while-revalidate=900' }
  );
};
