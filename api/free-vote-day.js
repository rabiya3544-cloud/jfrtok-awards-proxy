import { proxy } from './_proxy.js';

const API = 'https://api.creativeawards.et/api';

export default (req, res) =>
proxy(req, res, `${API}/voting/free-vote-day`, {
  cache: 's-maxage=60, stale-while-revalidate=180',
});