/**
 * normalizer.js
 * ------------
 * Pure functions that turn the *raw* Creative Awards API responses
 * (see /api/*) into UI-friendly shapes.
 *
 * Loaded as a plain <script> — exposes `window.Normalizer`.
 * Also `module.exports` when required in Node/tests.
 *
 * All functions accept null/undefined and never throw.
 */
(function (global) {
  'use strict';

  /** "435K" -> 435000 · "1.8M" -> 1800000 · "1,091" -> 1091 */
  function parseCount(text) {
    if (text === null || text === undefined || text === '') return null;
    const s = String(text).toUpperCase().replace(/,/g, '');
    const m = s.match(/([\d.]+)\s*([KM]?)/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    if (Number.isNaN(n)) return null;
    const mult = m[2] === 'K' ? 1e3 : m[2] === 'M' ? 1e6 : 1;
    return Math.round(n * mult);
  }

  const safeArr = (v) => (Array.isArray(v) ? v : []);

  /* ------------------------------------------------------------------ */
  /*  GET /api/categories                                               */
  /*  raw: { data: [{ id, name, …, sponsors: [...] }] }                 */
  /* ------------------------------------------------------------------ */
  function categories(raw) {
    const list = safeArr(raw && raw.data);
    return list.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      image: c.image,
      is_emerging: c.is_emerging,
      order: c.order,
      has_dedicated_points: c.has_dedicated_points,
      allows_collaborations: c.allows_collaborations,
      collects_video_submissions: c.collects_video_submissions,
      collects_challenge_videos: c.collects_challenge_videos,
      is_free_category: c.is_free_category,
      sponsors: safeArr(c.sponsors).map((s) => ({
        id: s.id,
        name: s.name,
        logo: s.logo,
      })),
    }));
  }

  /* ------------------------------------------------------------------ */
  /*  GET /api/sponsors                                                 */
  /*  raw: { data: [{ id, name, …, offerings: [...] }] }                */
  /* ------------------------------------------------------------------ */
  function sponsors(raw) {
    const list = safeArr(raw && raw.data);
    return list.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      website_url: s.website_url,
      logo: s.logo,
      order: s.order,
      offerings: safeArr(s.offerings).map((o) => ({
        id: o.id,
        name: o.name,
        type: o.type,
        image: o.image,
      })),
    }));
  }

  /* ------------------------------------------------------------------ */
  /*  GET /api/votes?id=<categoryId>                                    */
  /*  raw: { data: [{ category: { id, total_votes },                    */
  /*                  nominees: [{ id, name, votes }] }] }              */
  /*  -> { totalVotes, count, byId, byName, rows }                      */
  /* ------------------------------------------------------------------ */
  function voteMap(raw, categoryId) {
    const list = safeArr(raw && raw.data);
    const block =
      (categoryId && list.find((b) => b && b.category && b.category.id === categoryId)) ||
      list[0] ||
      null;

    const byId = {};
    const byName = {};
    const rows = [];

    if (block) {
      for (const n of safeArr(block.nominees)) {
        const votes = typeof n.votes === 'number' ? n.votes : 0;
        if (n.id) byId[n.id] = votes;
        if (n.name) byName[n.name] = votes;
        rows.push({ id: n.id, name: n.name, votes, partner_name: n.partner_name ?? null });
      }
    }

    return {
      totalVotes:
        block && block.category && typeof block.category.total_votes === 'number'
          ? block.category.total_votes
          : null,
      count: rows.length,
      byId,
      byName,
      rows,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  GET /api/category?id=<id>   +   GET /api/votes?id=<id>            */
  /*  Produces the merged shape used by the UI.                         */
  /* ------------------------------------------------------------------ */
  function category(rawCat, rawVotes, categoryId) {
    const cat = (rawCat && rawCat.data) || {};
    const votes = voteMap(rawVotes, categoryId || cat.id);

    const nominees = safeArr(cat.nominees).map((n) => ({
      uuid: n.id,                                     // internal UUID
      id: n.username || n.slug || '',                 // user-facing id
      name: n.name || '',
      image: n.image || null,
      profile_link: n.profile_link || null,
      followers: n.number_of_followers ?? null,       // "435K"
      followersCount: parseCount(n.number_of_followers),
      votes: votes.byId[n.id] ?? 0,
      categories: safeArr(n.categories).map((c) => ({
        id: c.id,
        name: c.name,
        image: c.image,
      })),
    }));

    // Sort by votes desc, then name asc — purely a UI concern.
    nominees.sort(
      (a, b) =>
        (b.votes ?? 0) - (a.votes ?? 0) ||
        String(a.name).localeCompare(String(b.name))
    );

    return {
      category: {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        image: cat.image,
        is_emerging: cat.is_emerging,
        criteria: safeArr(cat.criteria).map((c) => c.title),
        totalVotes: votes.totalVotes,
      },
      sponsors: safeArr(cat.sponsors).map((s) => ({
        id: s.id,
        name: s.name,
        logo: s.logo,
        website_url: s.website_url,
      })),
      count: nominees.length,
      nominees,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  GET /api/packages?category_id=<id>                                */
  /*  raw: { data: [{ id, name, points, display_price, … }] }           */
  /* ------------------------------------------------------------------ */
  function packages(raw) {
    return safeArr(raw && raw.data).map((p) => ({
      id: p.id,
      name: p.name,
      points: p.points,
      price: p.display_price,
      price_usd: p.price_usd,
      currency: p.currency,
      is_active: p.is_active,
      available_internationally: p.available_internationally,
      available_locally: p.available_locally,
    }));
  }

  /* ------------------------------------------------------------------ */
  /*  GET /api/free-vote-day                                            */
  /*  Upstream shape unknown → be permissive.                           */
  /* ------------------------------------------------------------------ */
  function freeVoteDay(raw) {
    if (!raw) return { active: false, raw: null };
    const root = raw.data !== undefined ? raw.data : raw;
    if (root === null || root === undefined) return { active: false, raw };

    let active = false;
    if (Array.isArray(root)) {
      active = root.length > 0;
    } else if (typeof root === 'object') {
      active = !!(
        root.is_today ||
        root.active ||
        root.is_active ||
        root.free_vote_day ||
        root.is_free_vote_day
      );
    } else if (typeof root === 'boolean') {
      active = root;
    }
    return { active, raw };
  }

  const Normalizer = {
    parseCount,
    categories,
    sponsors,
    voteMap,
    category,
    packages,
    freeVoteDay,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Normalizer;
  else global.Normalizer = Normalizer;
})(typeof globalThis !== 'undefined' ? globalThis : this);