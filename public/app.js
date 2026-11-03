(() => {
  'use strict';
  const PROXY_BASE = 'https://jfrtok-awards-proxy.vercel.app';
  const DEFAULT_CATEGORY = '01a0ecb7-050a-7301-b24f-1295e081dd6b';
  const SKELETON_COUNT = 7;
  const N = window.Normalizer;

  const $ = (id) => document.getElementById(id);
  const mainEl = $('main'), tabContent = $('tabContent'), catSelect = $('catSelect');
  const refreshBtn = $('refreshAll'), statCount = $('statCount'), statVotes = $('statVotes');
  const statUpdated = $('statUpdated'), freeVoteSlot = $('freeVoteSlot'), toastEl = $('toast');

  const ICON = {
    chart: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
    users: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    refresh: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
  };

  const state = {
    categories: [], categoryId: null, category: null, nominees: [],
    sponsors: [], allSponsors: [], packages: [], freeVote: null,
    activeTab: 'nominees', loading: false, lastUpdated: null,
  };

  // HTML escape map. \x22 and \x27 are used for the quote characters so
// editors don't get confused by mixing ' and " inside inline literals.
/* ---------- HTML escaping ---------- */
const HTML_ESCAPES = {
  '&':    '&amp;',
  '<':    '&lt;',
  '>':    '&gt;',
  '\x22': '&quot;',  // "
  '\x27': '&#39;',   // '
};

const ESCAPE_RE = /[&<>\x22\x27]/g;

const esc = (s) => String(s ?? '').replace(ESCAPE_RE, (c) => HTML_ESCAPES[c]);

/* ---------- Formatting helpers ---------- */
const fmtNum = (n) =>
  (typeof n === 'number' && Number.isFinite(n)) ? n.toLocaleString('en-US') : '—';

const timeStr = (d = new Date()) =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}
  async function fetchJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || `Request failed (${r.status})`);
    }
    return r.json(); // raw upstream shape
  }

  function skeletonCard() {
    return `<div class="card" style="animation:none">
      <div class="sk thumb-sk"></div>
      <div class="sk-lines"><div class="sk l1"></div><div class="sk l2"></div></div>
      <div class="metrics"><div class="sk b1"></div><div class="sk b1" style="width:44px"></div></div>
      <div class="sk b2"></div>
    </div>`;
  }

  function renderNomineeSkeleton() {
  const catInfoSkeleton = `
    <div class="cat-info">
      <div class="sk cat-sk-title"></div>
      <div class="cat-sk-desc">
        <div class="sk cat-sk-line w1"></div>
        <div class="sk cat-sk-line w2"></div>
      </div>
      <div class="criteria">
        <div class="sk cat-sk-crit-label"></div>
        <div class="criteria-list">
          <div class="sk cat-sk-chip w1"></div>
          <div class="sk cat-sk-chip w2"></div>
          <div class="sk cat-sk-chip w3"></div>
        </div>
      </div>
    </div>`;
  
  const sponsorStripSkeleton = `
    <div class="sponsor-strip">
      ${[78, 92, 110, 68, 96].map((w) => `
        <div class="sponsor-chip">
          <div class="sk sp-chip-logo"></div>
          <div class="sk sp-chip-label" style="width:${w}px"></div>
        </div>`).join('')}
    </div>`;
  
  tabContent.innerHTML = `
    ${catInfoSkeleton}
    ${sponsorStripSkeleton}
    <div class="list">${Array.from({length:SKELETON_COUNT}, skeletonCard).join('')}</div>`;
}
  function renderNomineeCard(n) {
    const name = esc(n.name || 'Unknown');
    const uid = esc(n.id || '');
    const initial = esc((n.name || '?').trim().charAt(0).toUpperCase() || '?');
    const img = n.image
      ? `<img class="thumb" src="${esc(n.image)}" alt="${name}" loading="lazy" decoding="async">`
      : `<div class="thumb thumb-fallback">${initial}</div>`;
    return `<article class="card" data-uuid="${esc(n.uuid)}">
      ${img}
      <div class="info"><p class="name" title="${name}">${name}</p><p class="uid" title="${uid}">${uid}</p></div>
      <div class="metrics">
        <span class="badge badge-votes">${ICON.chart}<span class="votes-val">${fmtNum(n.votes)}</span></span>
        <span class="badge badge-followers">${ICON.users}<span>${esc(n.followers || '—')}</span></span>
      </div>
      <button class="icon-btn refresh-one" type="button" data-uuid="${esc(n.uuid)}" aria-label="Refresh votes for ${name}">${ICON.refresh}</button>
    </article>`;
  }

  function attachImgFallbacks() {
    tabContent.querySelectorAll('img.thumb').forEach((img) => {
      img.addEventListener('error', () => {
        const d = document.createElement('div');
        d.className = 'thumb thumb-fallback';
        d.textContent = (img.alt || '?').trim().charAt(0).toUpperCase() || '?';
        img.replaceWith(d);
      }, { once: true });
    });
  }

  function renderNomineesTab() {
    if (!state.category || !state.nominees.length) {
      tabContent.innerHTML = `<div class="state">
        <strong>No nominees found</strong>
        <span>This category doesn't have any nominees yet.</span>
        <button class="btn" id="retryBtn">${ICON.refresh}<span>Reload</span></button>
      </div>`;
      return;
    }
    const c = state.category;
    const chips = (c.criteria || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('');
    const catInfo = `<div class="cat-info">
      <h2>${esc(c.name)}</h2>
      ${c.description ? `<p>${esc(c.description)}</p>` : ''}
      ${chips ? `<div class="criteria"><span class="criteria-title">Criteria</span><div class="criteria-list">${chips}</div></div>` : ''}
    </div>`;
    const strip = state.sponsors.length ? `<div class="sponsor-strip">${state.sponsors.map((s) => `
      <div class="sponsor-chip">
        ${s.logo ? `<img src="${esc(s.logo)}" alt="${esc(s.name)}" loading="lazy">` : ''}
        <span>${esc(s.name)}</span>
      </div>`).join('')}</div>` : '';
    tabContent.innerHTML = catInfo + strip + `<div class="list">${state.nominees.map(renderNomineeCard).join('')}</div>`;
    attachImgFallbacks();
  }

  function renderPackagesTab() {
    if (!state.packages.length) {
      tabContent.innerHTML = `<div class="state"><strong>No packages</strong><span>No voting packages for this category.</span></div>`;
      return;
    }
    tabContent.innerHTML = `<div class="pkg-grid">${state.packages.map((p) => `
      <div class="pkg">
        <div><div class="pkg-name">${esc(p.name)}</div><div class="pkg-points">${esc(String(p.points))} votes</div></div>
        <div class="pkg-price">
          <div class="price">${esc(p.price)} ${esc(p.currency || '')}</div>
          ${p.price_usd ? `<div class="price-usd">$${esc(p.price_usd)} USD</div>` : ''}
        </div>
      </div>`).join('')}</div>`;
  }

  function renderSponsorsTab() {
    if (!state.allSponsors.length) {
      tabContent.innerHTML = `<div class="state"><strong>No sponsors</strong><span>No sponsors to display.</span></div>`;
      return;
    }
    tabContent.innerHTML = `<div class="sponsor-grid">${state.allSponsors.map((s) => `
      <div class="sponsor">
        ${s.logo ? `<img src="${esc(s.logo)}" alt="${esc(s.name)}" loading="lazy">` : ''}
        <div class="sponsor-name">${esc(s.name)}</div>
        ${s.website_url ? `<a class="sponsor-link" href="${esc(s.website_url)}" target="_blank" rel="noopener">website ↗</a>` : ''}
      </div>`).join('')}</div>`;
  }

  function renderActiveTab() {
    if (state.activeTab === 'nominees') renderNomineesTab();
    else if (state.activeTab === 'packages') renderPackagesTab();
    else renderSponsorsTab();
  }

  function updateStats() {
    const count = state.nominees.length;
    const total = state.category?.totalVotes ?? state.nominees.reduce((s, n) => s + (n.votes || 0), 0);
    statCount.innerHTML = `<b>${fmtNum(count)}</b> nominee${count === 1 ? '' : 's'}`;
    statVotes.innerHTML = `<b>${fmtNum(total)}</b> votes`;
    statUpdated.innerHTML = state.lastUpdated ? `updated <b>${timeStr(state.lastUpdated)}</b>` : '—';
    freeVoteSlot.innerHTML = state.freeVote?.active ? `<span class="free-badge">FREE</span>` : '';
  }

  /* ---------------- data loading (raw → Normalizer) ---------------- */

  async function loadCategories() {
  const raw = await fetchJSON(PROXY_BASE + '/api/categories');
  state.categories = N.categories(raw);
  catSelect.innerHTML = state.categories.map((c) =>
    `<option value="${esc(c.id)}" data-emerging="${esc(c.is_emerging)}">${esc(c.name)}</option>`).join('');
  if (!state.categoryId) {
    state.categoryId = state.categories.find((c) => c.id === DEFAULT_CATEGORY)?.id ||
      state.categories[0]?.id || null;
  }
  if (state.categoryId) catSelect.value = state.categoryId;
  
  // NEW — upgrade native select into custom UI
  if (window.CategorySelect) window.CategorySelect.enhance(catSelect);
}
  
  
  async function loadCategory() {
    if (!state.categoryId) throw new Error('No category selected');
    const id = encodeURIComponent(state.categoryId);
    // Two raw calls in parallel, merged by the normalizer.
    const [rawCat, rawVotes] = await Promise.all([
      fetchJSON(`${PROXY_BASE}/api/categories/${id}`),
      fetchJSON(`${PROXY_BASE}/api/voting/results?category_id=${id}`),
    ]);
    const normalized = N.category(rawCat, rawVotes, state.categoryId);
    state.category  = normalized.category;
    state.nominees  = normalized.nominees;
    state.sponsors  = normalized.sponsors;
  }
  
  async function loadPackages() {
    if (!state.categoryId) return;
    try {
      const raw = await fetchJSON(`${PROXY_BASE}/api/voting/packages/preview?category_id=${encodeURIComponent(state.categoryId)}`);
      state.packages = N.packages(raw);
    } catch { state.packages = []; }
  }

  async function loadAllSponsors() {
    try {
      const raw = await fetchJSON(PROXY_BASE + '/api/sponsors');
      state.allSponsors = N.sponsors(raw);
    } catch { state.allSponsors = []; }
  }


  async function loadFreeVoteDay() {
    try {
      const raw = await fetchJSON(PROXY_BASE + '/api/voting/free-vote-day');
      state.freeVote = N.freeVoteDay(raw);
    } catch { state.freeVote = { active: false, raw: null }; }
  }

  /* ---------------- actions ---------------- */

  async function refreshAll() {
    if (state.loading) return;
    state.loading = true;
    refreshBtn.classList.add('busy');
    if (!state.nominees.length && state.activeTab === 'nominees') renderNomineeSkeleton();

    try {
      await Promise.all([loadCategory(), loadPackages(), loadFreeVoteDay()]);
      if (!state.allSponsors.length) loadAllSponsors();
      state.lastUpdated = new Date();
      renderActiveTab();
      updateStats();
    } catch (err) {
      tabContent.innerHTML = `<div class="state">
        <strong>Could not load</strong><span>${esc(err.message)}</span>
        <button class="btn" id="retryBtn">${ICON.refresh}<span>Retry</span></button>
      </div>`;
    } finally {
      state.loading = false;
      refreshBtn.classList.remove('busy');
    }
  }

  async function refreshOne(btn) {
    const uuid = btn.dataset.uuid;
    if (!uuid || btn.classList.contains('busy')) return;
    btn.classList.add('busy');
    const card = btn.closest('.card');
    try {
      const raw = await fetchJSON(`${PROXY_BASE}/api/voting/results?category_id=${encodeURIComponent(state.categoryId)}`);
      const { byId } = N.voteMap(raw, state.categoryId);         // normalizer handles it
      const votes = byId[uuid];
      if (typeof votes !== 'number') throw new Error('No votes yet');

      const nominee = state.nominees.find((n) => n.uuid === uuid);
      if (nominee) nominee.votes = votes;

      if (card) {
        const v = card.querySelector('.votes-val');
        const b = card.querySelector('.badge-votes');
        if (v) v.textContent = fmtNum(votes);
        if (b) { b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }
      }
      state.lastUpdated = new Date();
      updateStats();
    } catch (err) {
      toast(err.message || 'Refresh failed');
    } finally {
      btn.classList.remove('busy');
    }
  }

  /* ---------------- wiring ---------------- */

  refreshBtn.addEventListener('click', refreshAll);

  catSelect.addEventListener('change', () => {
    state.categoryId = catSelect.value;
    state.category = null; state.nominees = []; state.packages = []; state.sponsors = [];
    state.lastUpdated = null;
    mainEl.scrollTop = 0;
    if (state.activeTab === 'nominees') renderNomineeSkeleton();
    refreshAll();
  });

  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      state.activeTab = t.dataset.tab;
      mainEl.scrollTop = 0;
      renderActiveTab();
    });
  });

  tabContent.addEventListener('click', (e) => {
    const one = e.target.closest('.refresh-one');
    if (one) { e.preventDefault(); refreshOne(one); return; }
    if (e.target.closest('#retryBtn')) { e.preventDefault(); refreshAll(); }
  });

  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 60_000) refreshAll();
  });

  (async () => {
    renderNomineeSkeleton();
    try {
      await loadCategories();
      await Promise.all([loadAllSponsors(), loadFreeVoteDay()]);
      await loadCategory();
      await loadPackages();
      state.lastUpdated = new Date();
      renderActiveTab();
      updateStats();
    } catch (err) {
      tabContent.innerHTML = `<div class="state">
        <strong>Boot failed</strong><span>${esc(err.message)}</span>
        <button class="btn" id="retryBtn">${ICON.refresh}<span>Retry</span></button>
      </div>`;
    }
  })();
})();
