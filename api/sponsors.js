import { proxy } from './_proxy.js';
const API = 'https://api.creativeawards.et/api';

export default (req, res) =>
proxy(req, res, `${API}/sponsors`, { cache: 's-maxage=600, stale-while-revalidate=1800' });