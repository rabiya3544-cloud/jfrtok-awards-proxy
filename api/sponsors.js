import { proxy } from './_proxy.js';
import { API } from './_config.js';

export default (req, res) =>
proxy(req, res, `${API}/sponsors`, { cache: 's-maxage=600, stale-while-revalidate=1800' });
