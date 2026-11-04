import { proxy } from '../_proxy.js';

import { API } from '../_config.js';

export default (req, res) => {
  const qs = req.query.category_id ?
    `?category_id=${encodeURIComponent(req.query.category_id)}` :
    '';
  
  return proxy(req, res, `${API}/voting/results${qs}`, {
    cache: 'no-store',
  });
};
