import { proxy } from './_proxy.js';
import { API } from './_config.js';

export default (req, res) =>
proxy(req, res, `${API}/categories`, { cache: 's-maxage=300, stale-while-revalidate=900' });
