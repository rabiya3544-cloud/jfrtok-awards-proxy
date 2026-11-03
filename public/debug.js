(function () {
  'use strict';

  /* ───────────── shared helpers ───────────── */
  const PROXY_BASE = 'https://jfrtok-awards-proxy.vercel.app';
  const $ = (id) => document.getElementById(id);
  const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '\x22': '&quot;', // "
  '\x27': '&#39;', // '
};

const ESCAPE_RE = /[&<>\x22\x27]/g;

const esc = (s) => String(s ?? '').replace(ESCAPE_RE, (c) => HTML_ESCAPES[c]);
    
  const fmtBytes = (n) => (typeof n === 'number')
    ? (n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB') : '—';
  const fmtNum = (n) => (typeof n === 'number') ? n.toLocaleString('en-US') : '—';
  const timeStr = (d = new Date()) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const DEFAULT_CATEGORY = '01a0ecb7-050a-7301-b24f-1295e081dd6b';
  const N = window.Normalizer;

  /* ───────────── DOM refs ───────────── */
  const statusEl        = $('status');
  const runBtn          = $('runBtn');
  const runBtnLabel     = $('runBtnLabel');
  const proxySummaryEl  = $('proxySummary');
  const proxyResultsEl  = $('proxyResults');
  const normSummaryEl   = $('normSummary');
  const normResultsEl   = $('normResults');
  const statA           = $('statA');
  const statB           = $('statB');
  const statC           = $('statC');
  const toastEl         = $('toast');

  /* ───────────── per-tab state ───────────── */
  const tabState = {
    proxy: { status: 'Checking…',       btn: 'Run Proxy',         running: false, stats: ['—', '—', '—'] },
    norm:  { status: 'Not run yet',     btn: 'Run Normalization', running: false, stats: ['—', '—', '—'] },
  };
  let activeTab = 'proxy';
  let normHasRun = false;

  function syncChrome() {
    const s = tabState[activeTab];
    statusEl.textContent = s.status;
    runBtnLabel.textContent = s.btn;
    runBtn.disabled = s.running;
    statA.innerHTML = s.stats[0];
    statB.innerHTML = s.stats[1];
    statC.innerHTML = s.stats[2];
  }

  /* ───────────── toast ───────────── */
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  /* ───────────── tabs ───────────── */
  function switchTab(name) {
    activeTab = name;
    document.querySelectorAll('.tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(p =>
      p.classList.toggle('active', p.dataset.tab === name));
    $('main').scrollTop = 0;
    if (name === 'norm' && !normHasRun) {
      normHasRun = true;
      runNormalizer();
    }
    syncChrome();
  }
  document.querySelectorAll('.tab').forEach(t =>
    t.addEventListener('click', () => switchTab(t.dataset.tab)));

  /* ═══════════════════════════════════════════════════════════
     PROXY MIRROR TEST
  ═══════════════════════════════════════════════════════════ */

  function classify(r) {
    if (!r.upstream || !r.proxy) return 'error';
    if (r.upstream.error || r.proxy.error) return 'error';
    if (!r.match) return 'mismatch';
    return 'match';
  }

  function badge(r) {
    const c = classify(r);
    if (c === 'match')    return '<span class="match-badge yes">✓ match</span>';
    if (c === 'mismatch') return '<span class="match-badge no">✗ mismatch</span>';
    return '<span class="match-badge err">⚠ error</span>';
  }

  function kv(label, val, cls) {
    return `<div class="kv"><span>${esc(label)}</span><b class="${cls || ''}">${val}</b></div>`;
  }

  function sideHTML(side, other) {
    if (!side) return '<div class="kv"><span>no data</span></div>';
    const statusCls = side.ok ? 'ok' : 'bad';
    const shaShort  = side.sha ? side.sha.slice(0, 12) : '—';
    const shaCls    = (other && other.sha && side.sha !== other.sha) ? 'bad' : '';
    const sizeCls   = (other && side.bytes !== other.bytes) ? 'bad' : '';
    return [
      kv('status', side.status || '—', statusCls),
      kv('time',   side.ms + ' ms', ''),
      kv('size',   fmtBytes(side.bytes), sizeCls),
      kv('sha',    shaShort, 'mono ' + shaCls),
      side.error ? `<div class="err-line">${esc(side.error)}</div>` : '',
    ].join('');
  }

  function proxyCardHTML(r) {
    const cls = classify(r);
    const clsName = cls === 'match' ? 'match' : cls === 'mismatch' ? 'mismatch' : 'error';
    const expanded = !!r._expanded;

    const upSample = r.upstream && r.upstream.sample
      ? esc(r.upstream.sample)
      : (r.upstream && r.upstream.error ? esc(r.upstream.error) : '—');
    const pxSample = r.proxy && r.proxy.sample
      ? esc(r.proxy.sample)
      : (r.proxy && r.proxy.error ? esc(r.proxy.error) : '—');

    return `
    <article class="test ${clsName}" data-endpoint="${esc(r.name)}">
      <header class="test-head">
        <span class="test-name">${esc(r.name)}</span>
        ${badge(r)}
        <button class="icon-btn expand-toggle" type="button" aria-label="Toggle samples">${expanded ? '▴' : '▾'}</button>
      </header>
      <div class="test-body">
        <div class="cols">
          <div class="col"><div class="col-title">Upstream</div>${sideHTML(r.upstream, r.proxy)}</div>
          <div class="col"><div class="col-title">Proxy</div>${sideHTML(r.proxy, r.upstream)}</div>
        </div>
        <div class="actions">
          <button class="mini-btn" type="button" data-action="retest">↻ Retest</button>
          <a class="mini-btn" href="${esc(r.upstreamUrl)}" target="_blank" rel="noopener">↗ Upstream</a>
          <a class="mini-btn" href="${esc(r.proxyUrl)}" target="_blank" rel="noopener">↗ Proxy</a>
          <button class="mini-btn" type="button" data-action="toggle-samples">${expanded ? '▴ Hide' : '▾ Samples'}</button>
        </div>
        <div class="samples" ${expanded ? '' : 'hidden'}>
          <div class="sample-row">
            <div class="sample-title">Upstream · first ${r.upstream?.sample ? Math.min(r.upstream.sample.length, 800) : 0} chars</div>
            <pre class="sample">${upSample}</pre>
          </div>
          <div class="sample-row">
            <div class="sample-title">Proxy · first ${r.proxy?.sample ? Math.min(r.proxy.sample.length, 800) : 0} chars</div>
            <pre class="sample">${pxSample}</pre>
          </div>
        </div>
      </div>
    </article>`;
  }

  function renderProxySummary(data) {
    const total   = data.count;
    const matches = data.results.filter((r) => r.match).length;
    const mism    = data.results.filter((r) => classify(r) === 'mismatch').length;
    const errs    = data.results.filter((r) => classify(r) === 'error').length;

    proxySummaryEl.innerHTML = `
      <span class="chip ${data.allMatch ? 'ok' : (mism ? 'bad' : 'warn')}">
        <b>${matches}/${total}</b> match
      </span>
      ${mism ? `<span class="chip bad"><b>${mism}</b> mismatch</span>` : ''}
      ${errs ? `<span class="chip warn"><b>${errs}</b> error</span>` : ''}
      <span class="chip"><b>${fmtNum(data.totalMs)}</b> ms total</span>
      <span class="chip mono" title="${esc(data.generatedAt)}">${timeStr(new Date(data.generatedAt))}</span>
    `;

    tabState.proxy.status = data.allMatch
      ? `all ${total} endpoints match upstream byte-for-byte`
      : `${matches}/${total} match · ${mism} mismatch · ${errs} error`;
    tabState.proxy.stats = [
      data.allMatch
        ? `<b style="color:var(--ok)">all match</b>`
        : `<b style="color:var(--bad)">${mism + errs} issue${mism + errs === 1 ? '' : 's'}</b>`,
      `<b>${fmtNum(data.totalMs)}</b> ms`,
      `updated <b>${timeStr(new Date(data.generatedAt))}</b>`,
    ];
    syncChrome();
  }

  function renderProxySkeleton() {
    proxyResultsEl.innerHTML =
      Array.from({ length: 6 }, () => '<div class="skeleton"></div>').join('');
    proxySummaryEl.innerHTML = '';
    tabState.proxy.status  = 'Running proxy test…';
    tabState.proxy.btn     = 'Running…';
    tabState.proxy.running = true;
    tabState.proxy.stats   = ['—', '—', '—'];
    syncChrome();
  }

  async function runProxy() {
    if (tabState.proxy.running) return;
    renderProxySkeleton();
    try {
      const res = await fetch(PROXY_BASE + '/api/debug?t=' + Date.now(), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      // preserve expand state
      const expanded = new Set(
        [...proxyResultsEl.querySelectorAll('.test')]
          .filter((el) => !el.querySelector('.samples').hidden)
          .map((el) => el.dataset.endpoint)
      );
      data.results.forEach((r) => { r._expanded = expanded.has(r.name); });

      renderProxySummary(data);
      proxyResultsEl.innerHTML = data.results.map(proxyCardHTML).join('');
    } catch (err) {
      proxyResultsEl.innerHTML = `<div class="test error"><div class="test-body">
        <div class="err-line">${esc(err.message)}</div>
      </div></div>`;
      tabState.proxy.status = 'Failed';
      toast(err.message);
    } finally {
      tabState.proxy.running = false;
      tabState.proxy.btn = 'Run Proxy';
      syncChrome();
    }
  }

  async function retestOne(endpoint, card) {
    const btn = card.querySelector('[data-action="retest"]');
    btn.disabled = true;
    btn.textContent = '…';
    try {
      const res = await fetch(
        `${PROXY_BASE}/api/debug?endpoint=${encodeURIComponent(endpoint)}&t=${Date.now()}`,
        { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const fresh = data.results[0];
      fresh._expanded = !card.querySelector('.samples').hidden;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = proxyCardHTML(fresh);
      card.replaceWith(wrapper.firstElementChild);

      const all     = [...proxyResultsEl.querySelectorAll('.test')].length;
      const matches = [...proxyResultsEl.querySelectorAll('.test')]
        .filter((el) => el.classList.contains('match')).length;
      proxySummaryEl.querySelector('.chip').innerHTML = `<b>${matches}/${all}</b> match`;
      tabState.proxy.stats[0] = matches === all
        ? `<b style="color:var(--ok)">all match</b>`
        : `<b style="color:var(--bad)">${all - matches} issue${all - matches === 1 ? '' : 's'}</b>`;
      syncChrome();
      toast(`${endpoint} · ${fresh.match ? 'match' : 'mismatch'}`);
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
      btn.textContent = '↻ Retest';
    }
  }

  proxyResultsEl.addEventListener('click', (e) => {
    const card = e.target.closest('.test');
    if (!card) return;

    if (e.target.closest('.expand-toggle') || e.target.closest('[data-action="toggle-samples"]')) {
      const box = card.querySelector('.samples');
      box.hidden = !box.hidden;
      const mini = card.querySelector('[data-action="toggle-samples"]');
      mini.textContent = box.hidden ? '▾ Samples' : '▴ Hide';
      card.querySelector('.expand-toggle').textContent = box.hidden ? '▾' : '▴';
      return;
    }

    if (e.target.closest('[data-action="retest"]')) {
      retestOne(card.dataset.endpoint, card);
      return;
    }
  });

  /* ═══════════════════════════════════════════════════════════
     NORMALIZATION TEST
  ═══════════════════════════════════════════════════════════ */

  function ncheck(name, cond, detail) {
    return { name, pass: !!cond, detail: detail == null ? null : String(detail) };
  }
  function safeCall(fn) { try { fn(); return true; } catch { return false; } }
  function isSortedDesc(arr, fn) {
    for (let i = 1; i < arr.length; i++) {
      if ((fn(arr[i - 1]) ?? 0) < (fn(arr[i]) ?? 0)) return false;
    }
    return true;
  }
  async function getJSON(url) {
    const sep = url.includes('?') ? '&' : '?';
    const r = await fetch(url + sep + 't=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  function testParseCount() {
    const cases = [
      ['435K', 435000], ['1.8M', 1800000], ['2M', 2000000], ['2.5M', 2500000],
      ['596.3K', 596300], ['1,091', 1091], ['500', 500], ['681.1k', 681100],
      [null, null], ['', null], ['abc', null],
    ];
    return {
      name: 'parseCount (unit)',
      checks: cases.map(([input, expected]) => {
        const actual = N.parseCount(input);
        return ncheck(
          `parseCount(${JSON.stringify(input)})`,
          actual === expected,
          `expected ${expected}, got ${actual}`
        );
      }),
    };
  }

  async function testCategories() {
    const raw = await getJSON(PROXY_BASE + '/api/categories');
    let norm, err;
    try { norm = N.categories(raw); } catch (e) { err = e; }
    if (err) return { name: 'categories', checks: [ncheck('no throw', false, err.message)] };

    const rawCount = raw?.data?.length ?? 0;
    return {
      name: 'categories',
      checks: [
        ncheck('no throw', true),
        ncheck('length matches raw', norm.length === rawCount, `${norm.length} vs ${rawCount}`),
        ncheck('all have id',        norm.every(c => !!c.id)),
        ncheck('all have name',      norm.every(c => typeof c.name === 'string' && c.name.length > 0)),
        ncheck('sponsors is array',  norm.every(c => Array.isArray(c.sponsors))),
        ncheck('is_emerging boolean', norm.every(c => typeof c.is_emerging === 'boolean')),
        ncheck('null safe',          safeCall(() => N.categories(null))),
        ncheck('empty object safe',  safeCall(() => N.categories({}))),
        ncheck('missing data safe',  safeCall(() => N.categories({ data: null }))),
      ],
      sample: norm.slice(0, 1),
    };
  }

  async function testSponsors() {
    const raw = await getJSON(PROXY_BASE + '/api/sponsors');
    let norm, err;
    try { norm = N.sponsors(raw); } catch (e) { err = e; }
    if (err) return { name: 'sponsors', checks: [ncheck('no throw', false, err.message)] };

    return {
      name: 'sponsors',
      checks: [
        ncheck('no throw', true),
        ncheck('length matches raw', norm.length === (raw?.data?.length ?? 0)),
        ncheck('all have id',        norm.every(s => !!s.id)),
        ncheck('all have name',      norm.every(s => typeof s.name === 'string')),
        ncheck('offerings is array', norm.every(s => Array.isArray(s.offerings))),
        ncheck('offerings have ids', norm.every(s => s.offerings.every(o => !!o.id))),
        ncheck('null safe',          safeCall(() => N.sponsors(null))),
      ],
      sample: norm.slice(0, 1),
    };
  }


  async function testVotes() {
    const raw = await getJSON(`${PROXY_BASE}/api/voting/results?category_id=${encodeURIComponent(DEFAULT_CATEGORY)}`);
    let norm, err;
    try { norm = N.voteMap(raw, DEFAULT_CATEGORY); } catch (e) { err = e; }
    if (err) return { name: 'votes', checks: [ncheck('no throw', false, err.message)] };

    const block      = raw?.data?.[0];
    const rawNominees = block?.nominees ?? [];
    const rawWithId   = rawNominees.filter(n => n.id);

    return {
      name: 'votes',
      checks: [
        ncheck('no throw', true),
        ncheck('count matches raw', norm.count === rawNominees.length, `${norm.count} vs ${rawNominees.length}`),
        ncheck('byId is object',   norm.byId && typeof norm.byId === 'object'),
        ncheck('byName is object', norm.byName && typeof norm.byName === 'object'),
        ncheck('byId covers every raw nominee', rawWithId.every(n => n.id in norm.byId)),
        ncheck('all votes are numbers', Object.values(norm.byId).every(v => typeof v === 'number')),
        ncheck('totalVotes matches raw',
          norm.totalVotes === (block?.category?.total_votes ?? null),
          `${norm.totalVotes} vs ${block?.category?.total_votes}`),
        ncheck('empty data safe', safeCall(() => N.voteMap({ data: [] }, DEFAULT_CATEGORY))),
      ],
      sample: { totalVotes: norm.totalVotes, count: norm.count, byIdKeys: Object.keys(norm.byId).length },
    };
  }

  async function testCategory() {
    const id = DEFAULT_CATEGORY;
    const [rawCat, rawVotes] = await Promise.all([
      getJSON(`${PROXY_BASE}/api/category?id=${id}`),
      getJSON(`${PROXY_BASE}/api/voting/results?category_id=${id}`),
    ]);
    let norm, err;
    try { norm = N.category(rawCat, rawVotes, id); } catch (e) { err = e; }
    if (err) return { name: 'category (merged)', checks: [ncheck('no throw', false, err.message)] };

    const rawNominees = rawCat?.data?.nominees ?? [];
    const voteMap     = N.voteMap(rawVotes, id);

    return {
      name: 'category (merged)',
      checks: [
        ncheck('no throw', true),
        ncheck('count matches raw', norm.count === rawNominees.length, `${norm.count} vs ${rawNominees.length}`),
        ncheck('every nominee has uuid',           norm.nominees.every(n => !!n.uuid)),
        ncheck('every nominee has name',           norm.nominees.every(n => typeof n.name === 'string')),
        ncheck('every nominee has votes as number', norm.nominees.every(n => typeof n.votes === 'number')),
        ncheck('votes match voteMap for all',
          norm.nominees.every(n => (voteMap.byId[n.uuid] ?? 0) === n.votes)),
        ncheck('sorted descending by votes', isSortedDesc(norm.nominees, n => n.votes)),
        ncheck('followersCount is null or non-negative number',
          norm.nominees.every(n => n.followersCount === null ||
            (typeof n.followersCount === 'number' && n.followersCount >= 0))),
        ncheck('totalVotes exposed on category',
          norm.category?.totalVotes === null || typeof norm.category?.totalVotes === 'number'),
        ncheck('empty inputs safe', safeCall(() => N.category({}, {}, id))),
      ],
      sample: { category: norm.category?.name, count: norm.count, top: norm.nominees[0] },
    };
  }
  
  async function testNominee() {
  const slug = 'yasino-comedianyasino';
  const raw = await getJSON(`/api/nominees/${slug}`);
  let norm, err;
  try { norm = N.nominee(raw); } catch (e) { err = e; }
  if (err) return { name: 'nominee', checks: [ncheck('no throw', false, err.message)] };
  
  return {
    name: 'nominee',
    checks: [
      ncheck('no throw', true),
      ncheck('returns object', norm && typeof norm === 'object'),
      ncheck('has uuid', norm && !!norm.uuid),
      ncheck('has slug', norm && typeof norm.slug === 'string'),
      ncheck('has name', norm && typeof norm.name === 'string'),
      ncheck('categories is array', norm && Array.isArray(norm.categories)),
      ncheck('categories have ids', norm && norm.categories.every(c => !!c.id)),
      ncheck('followersCount is null or non-negative number',
        norm && (norm.followersCount === null ||
          (typeof norm.followersCount === 'number' && norm.followersCount >= 0))),
      ncheck('null safe', safeCall(() => N.nominee(null))),
      ncheck('empty object safe', safeCall(() => N.nominee({}))),
    ],
    sample: norm,
  };
}

async function testNominees() {
  const raw = await getJSON('/api/nominees');
  let norm, err;
  try { norm = N.nominees(raw); } catch (e) { err = e; }
  if (err) return { name: 'nominees (list)', checks: [ncheck('no throw', false, err.message)] };
  
  const rawCount = (raw && Array.isArray(raw.data)) ? raw.data.length : 0;
  return {
    name: 'nominees (list)',
    checks: [
      ncheck('no throw', true),
      ncheck('returns array', Array.isArray(norm)),
      ncheck('length matches raw', norm.length <= rawCount, `${norm.length} vs ${rawCount}`),
      ncheck('all have uuid', norm.every(n => !!n.uuid)),
      ncheck('all have name', norm.every(n => typeof n.name === 'string')),
      ncheck('all have slug', norm.every(n => n.slug === null || typeof n.slug === 'string')),
      ncheck('null safe', safeCall(() => N.nominees(null))),
      ncheck('empty data safe', safeCall(() => N.nominees({ data: [] }))),
    ],
    sample: { count: norm.length, first: norm[0] },
  };
}

  async function testPackages() {
    const raw = await getJSON(`${PROXY_BASE}/api/voting/packages/preview?category_id=${encodeURIComponent(DEFAULT_CATEGORY)}`);
    let norm, err;
    try { norm = N.packages(raw); } catch (e) { err = e; }
    if (err) return { name: 'packages', checks: [ncheck('no throw', false, err.message)] };

    return {
      name: 'packages',
      checks: [
        ncheck('no throw', true),
        ncheck('length matches raw', norm.length === (raw?.data?.length ?? 0)),
        ncheck('all have id',      norm.every(p => !!p.id)),
        ncheck('all have name',    norm.every(p => typeof p.name === 'string')),
        ncheck('points is number', norm.every(p => typeof p.points === 'number')),
        ncheck('null safe',        safeCall(() => N.packages(null))),
      ],
      sample: norm.slice(0, 2),
    };
  }

  async function testFreeVoteDay() {
    const raw = await getJSON(PROXY_BASE + '/api/voting/free-vote-day');
    let norm, err;
    try { norm = N.freeVoteDay(raw); } catch (e) { err = e; }
    if (err) return { name: 'free-vote-day', checks: [ncheck('no throw', false, err.message)] };

    return {
      name: 'free-vote-day',
      checks: [
        ncheck('no throw', true),
        ncheck('returns { active, raw }', norm && typeof norm.active === 'boolean' && 'raw' in norm),
        ncheck('active is boolean', typeof norm.active === 'boolean'),
        ncheck('null safe',         safeCall(() => N.freeVoteDay(null))),
        ncheck('empty object safe', safeCall(() => N.freeVoteDay({}))),
      ],
      sample: { active: norm.active, rawType: typeof norm.raw },
    };
  }

  async function runNormalizer() {
    if (!N) {
      normResultsEl.innerHTML =
        '<div class="test error"><div class="test-body">' +
        '<div class="err-line">normalizer.js failed to load. Check that /normalizer.js exists.</div>' +
        '</div></div>';
      tabState.norm.status = 'normalizer.js missing';
      tabState.norm.btn    = 'Unavailable';
      syncChrome();
      return;
    }
    if (tabState.norm.running) return;

    tabState.norm.running = true;
    tabState.norm.btn     = 'Running…';
    tabState.norm.status  = 'Running normalization tests…';
    tabState.norm.stats   = ['—', '—', '—'];
    normSummaryEl.innerHTML = '';
    normResultsEl.innerHTML =
      '<div style="padding:20px;text-align:center;font-size:11px;color:var(--dim)">Running…</div>';
    syncChrome();

    const suites = [
  { fn: testParseCount, sync: true, label: 'parseCount (unit)' },
  { fn: testCategories, label: 'categories' },
  { fn: testSponsors, label: 'sponsors' },
  { fn: testVotes, label: 'votes' },
  { fn: testCategory, label: 'category (merged)' },
  { fn: testNominee, label: 'nominee' },
  { fn: testNominees, label: 'nominees (list)' },
  { fn: testPackages, label: 'packages' },
  { fn: testFreeVoteDay, label: 'free-vote-day' },
];

const results = [];
for (const s of suites) {
  try {
    results.push(s.sync ? s.fn() : await s.fn());
  } catch (e) {
    results.push({
      name: s.label || s.fn.name.replace(/^test/, '').toLowerCase(),
      checks: [ncheck('suite ran', false, e.message)],
    });
  }
}

    renderNormResults(results);

    const total  = results.reduce((s, r) => s + r.checks.length, 0);
    const passed = results.reduce((s, r) => s + r.checks.filter(c => c.pass).length, 0);
    const allOk  = passed === total;
    const stamp  = new Date();

    normSummaryEl.innerHTML = `
      <span class="chip ${allOk ? 'ok' : 'bad'}">
        <b>${passed}/${total}</b> passed
      </span>
      ${allOk ? '' : `<span class="chip bad"><b>${total - passed}</b> failed</span>`}
      <span class="chip"><b>${results.length}</b> suites</span>
      <span class="chip mono">${timeStr(stamp)}</span>
    `;

    tabState.norm.status = allOk
      ? `all ${total} checks passed across ${results.length} suites`
      : `${passed}/${total} checks passed · ${total - passed} failed`;
    tabState.norm.stats = [
      allOk
        ? `<b style="color:var(--ok)">${passed}/${total} passed</b>`
        : `<b style="color:var(--bad)">${total - passed} failed</b> · ${passed}/${total}`,
      `<b>${results.length}</b> suites`,
      `updated <b>${timeStr(stamp)}</b>`,
    ];
    tabState.norm.running = false;
    tabState.norm.btn     = 'Run Normalization';
    syncChrome();
  }

  function renderNormResults(results) {
    normResultsEl.innerHTML = results.map(r => {
      const passed = r.checks.filter(c => c.pass).length;
      const total  = r.checks.length;
      const ok     = passed === total;

      const sampleHtml = r.sample !== undefined
        ? `<details style="margin-top:6px">
             <summary style="font-size:10px;color:var(--dim);cursor:pointer">Show normalized sample</summary>
             <pre style="margin:6px 0 0;padding:8px;background:#0c0c11;border:1px solid #1e1e26;border-radius:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;max-height:200px;overflow:auto;color:#c7c7cf;white-space:pre-wrap;word-break:break-all">${esc(JSON.stringify(r.sample, null, 2))}</pre>
           </details>`
        : '';

      return `
        <div class="test ${ok ? 'match' : 'mismatch'}">
          <div class="test-head">
            <span class="test-name">${esc(r.name)}</span>
            <span class="match-badge ${ok ? 'yes' : 'no'}">${passed}/${total}</span>
          </div>
          <div class="test-body">
            ${r.checks.map(c => `
              <div style="display:flex;align-items:flex-start;gap:6px;font-size:10.5px;line-height:1.5;padding:2px 0">
                <span style="color:${c.pass ? 'var(--ok)' : 'var(--bad)'};font-weight:800;flex:none;width:12px">${c.pass ? '✓' : '✗'}</span>
                <span style="flex:1;color:${c.pass ? 'var(--muted)' : 'var(--text)'}">${esc(c.name)}</span>
                ${c.detail ? `<span style="color:var(--dim);font-size:9.5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;flex:none;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(c.detail)}">${esc(c.detail)}</span>` : ''}
              </div>
            `).join('')}
            ${sampleHtml}
          </div>
        </div>`;
    }).join('');
  }

  /* ═══════════════════════════════════════════════════════════
     HEADER BUTTON DISPATCH
  ═══════════════════════════════════════════════════════════ */
  runBtn.addEventListener('click', () => {
    if (activeTab === 'proxy') runProxy();
    else { normHasRun = true; runNormalizer(); }
  });

  /* ═══════════════════════════════════════════════════════════
     BOOT
  ═══════════════════════════════════════════════════════════ */
  syncChrome();
  runProxy();   // auto-run proxy test on load
})();

