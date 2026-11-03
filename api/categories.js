import { proxy } from './_proxy.js';
const API = 'https://api.creativeawards.et/api';

export default (req, res) =>
proxy(req, res, `${API}/categories`, { cache: 's-maxage=300, stale-while-revalidate=900' });