import { proxy } from './_proxy.js';

import { API } from './_config.js';

export default (req, res) =>
proxy(req, res, `${API}/nominees`, {
  cache: 's-maxage=120, stale-while-revalidate=600',
});
