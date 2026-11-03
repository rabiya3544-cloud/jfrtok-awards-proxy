import { proxy } from '../_proxy.js';

import { API } from '../_config.js';

export default (req, res) =>
  proxy(req, res, `${API}/voting/free-vote-day`, {
    cache: 's-maxage=60, stale-while-revalidate=180',
  });
