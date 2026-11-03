import { proxy } from '../_proxy.js';

const API = 'https://api.creativeawards.et/api';

export default async (req, res) => {
  return res.status(200).json({
    url: req.url,
    query: req.query,
    queryKeys: Object.keys(req.query),
    headers: {
      host: req.headers.host,
      'x-forwarded-path': req.headers['x-forwarded-path'] || null,
    },
  });
};
