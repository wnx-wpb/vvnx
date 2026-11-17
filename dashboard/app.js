// Token Radar's page: the board, its filters, and one detail view per protocol.
//
// Everything renders from window.RADAR, the sealed snapshot's own figures as data.js carries them.
// The page makes no network request: no fetch, no remote font, no remote image. State lives in the
// URL hash, so a filtered view and a detail view are each one link: #tab, #q, #category, #chain,
// #scope, #sort and #p (the detail view's slug).

(function () {
  'use strict';

  var data = window.RADAR;
  var model = window.RADAR_MODEL;
  if (!data || !model) {
    document.body.insertAdjacentHTML('beforeend', '<p class="fatal">The radar data did not load.</p>');
    return;
  }

  var $ = function (id) {
    return document.getElementById(id);
  };

  var fmtMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  var fmtMoney1 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 1 });
  var fmtPct = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, signDisplay: 'always' });
  var fmtInt = new Intl.NumberFormat('en-US');

  function money(v) {
    if (v === null || v === undefined) return '—';
    var abs = Math.abs(v);
    if (abs >= 1e9) return fmtMoney1.format(v / 1e9) + 'B';
    if (abs >= 1e6) return fmtMoney1.format(v / 1e6) + 'M';
    if (abs >= 1e3) return fmtMoney1.format(v / 1e3) + 'K';
    return fmtMoney.format(v);
  }

  function pct(v) {
    if (v === null || v === undefined) return '—';
    return fmtPct.format(v) + '%';
  }

  function ageText(days) {
    if (days === null || days === undefined) return '—';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.floor(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function chainText(chains) {
    if (!chains || chains.length === 0) return '—';
    if (chains.length === 1) return chains[0];
    return chains[0] + ' +' + (chains.length - 1);
  }

  // ---- state ---------------------------------------------------------------

  var state = { tab: 'board', q: '', category: 'all', chain: 'all', scope: 'all', sort: 'implied', p: null };

  function readHash() {
    var params = new URLSearchParams(window.location.hash.slice(1));
    state.tab = params.get('tab') === 'live' ? 'live' : 'board';
    state.q = params.get('q') || '';
    state.category = params.get('category') || 'all';
    state.chain = params.get('chain') || 'all';
    state.scope = params.get('scope') || 'all';
    state.sort = params.get('sort') || 'implied';
    state.p = params.get('p') || null;
  }

  function writeHash() {
    var params = new URLSearchParams();
    if (state.tab !== 'board') params.set('tab', state.tab);
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.scope !== 'all') params.set('scope', state.scope);
    if (state.sort !== 'implied') params.set('sort', state.sort);
    if (state.p) params.set('p', state.p);
    var hash = params.toString();
    history.replaceState(null, '', hash ? '#' + hash : window.location.pathname + window.location.search);
  }

  // ---- header and method ---------------------------------------------------

  function renderMeta() {
    // The source string carries a fetch URL and timestamp; the masthead shows only its name.
    var shortSource = data.source.split(' ')[0];
    $('meta').innerHTML =
      '<div><dt>Snapshot</dt><dd>' + esc(data.as_of) + '</dd></div>' +
      '<div><dt>Source</dt><dd>' + esc(shortSource) + '</dd></div>' +
      '<div><dt>Ranked</dt><dd>' + fmtInt.format(data.board_size) + ' protocols</dd></div>' +
      '<div><dt>Watchlist</dt><dd>' + fmtInt.format(data.watchlist_size) + ' covered</dd></div>' +
      '<div><dt>Early finds</dt><dd>' + fmtInt.format(data.early_size) + '</dd></div>' +
      '<div><dt>Model</dt><dd>' + esc(data.model_version) + '</dd></div>';
    $('foot-note').textContent =
      'Built from one sealed ' + data.source + ' snapshot dated ' + data.as_of + '. Nothing on this page is live: ' +
      'no prices update, no token has launched, and every implied value is the model\'s estimate from the snapshot\'s own figures, ' +
      'not a market price. Farm plans are estimates; gas costs move.';
  }

  function renderMethod() {
    var c = data.calibration;
    var m = data.model;
    var excludedNote = data.excluded_size > 0
      ? ' ' + fmtInt.format(data.excluded_size) + ' pre-token protocols were set aside as wrapped, staked, bridged or exchange products of tokens that already trade.'
      : '';
    $('method-body').innerHTML =
      '<p>Implied value = TVL × base multiple × growth × maturity × breadth. The base multiple is <strong>' +
      c.base_multiple.toFixed(3) +
      '</strong>, the median market-cap-to-TVL ratio of the <strong>' +
      fmtInt.format(c.sample_size) +
      '</strong> live-token protocols in this same snapshot (raw median ' +
      c.median_ratio.toFixed(3) +
      ', clamped to ' +
      m.base_multiple_floor +
      '–' +
      m.base_multiple_cap +
      '). Growth is the 7-day change clamped to ' +
      m.growth_floor +
      '%–' +
      m.growth_cap +
      '% at half weight. Maturity rises from ' +
      m.maturity_floor +
      ' at listing to 1.00 at ' +
      fmtInt.format(m.maturity_days) +
      ' days. Breadth adds ' +
      (m.breadth_per_chain * 100) +
      '% per extra chain, up to ' +
      m.breadth_max_extra +
      '.</p>' +
      '<p>The board holds all <strong>' +
      fmtInt.format(data.watchlist_size) +
      '</strong> watchlist protocols and <strong>' +
      fmtInt.format(data.early_size) +
      '</strong> early finds below the ' +
      money(data.floor_usd) +
      ' floor.' +
      esc(excludedNote) +
      ' The live-token view is kept apart: those protocols already trade, so the market has already valued them.</p>' +
      '<p>Every row\'s implied value is recomputed in this page from the same figures; the detail view shows the arithmetic and checks it against the stored board.</p>';
  }

  // ---- board ----------------------------------------------------------------

  function fillSelect(select, values, allLabel) {
    var html = '<option value="all">' + esc(allLabel) + '</option>';
    values.forEach(function (v) {
      html += '<option value="' + esc(v) + '">' + esc(v) + '</option>';
    });
    select.innerHTML = html;
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var rows = data.rows.filter(function (r) {
      if (state.scope === 'watchlist' && !r.on_watchlist) return false;
      if (state.scope === 'early' && r.on_watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Uncategorised') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) === -1) return false;
      if (q && r.name.toLowerCase().indexOf(q) === -1 && r.slug.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var sorters = {
      implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd || a.rank - b.rank; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd || a.rank - b.rank; },
      growth: function (a, b) { return (b.change_7d === null ? -Infinity : b.change_7d) - (a.change_7d === null ? -Infinity : a.change_7d) || a.rank - b.rank; },
      age: function (a, b) { return (b.age_days === null ? -1 : b.age_days) - (a.age_days === null ? -1 : a.age_days) || a.rank - b.rank; },
      name: function (a, b) { return a.name.localeCompare(b.name) || a.rank - b.rank; },
    };
    return rows.sort(sorters[state.sort] || sorters.implied);
  }

  function renderBoard() {
    var rows = filteredRows();
    $('count').textContent =
      'Showing ' + fmtInt.format(rows.length) + ' of ' + fmtInt.format(data.rows.length) + ' ranked protocols.';
    $('rows').innerHTML = rows
      .map(function (r) {
        var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down';
        return (
          '<tr data-slug="' + esc(r.slug) + '" tabindex="0">' +
          '<td class="num rank">' + r.rank + '</td>' +
          '<td><span class="name">' + esc(r.name) + '</span> <span class="slug">' + esc(r.slug) + '</span>' +
          (r.on_watchlist ? ' <span class="badge">Watchlist</span>' : ' <span class="badge early">Early</span>') +
          '</td>' +
          '<td>' + esc(r.category || 'Uncategorised') + '</td>' +
          '<td>' + esc(chainText(r.chains)) + '</td>' +
          '<td class="num">' + money(r.tvl_usd) + '</td>' +
          '<td class="num ' + growthClass + '">' + pct(r.change_7d) + '</td>' +
          '<td class="num">' + ageText(r.age_days) + '</td>' +
          '<td class="num strong">' + money(r.implied_value_usd) + '</td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function renderLive() {
    $('live-rows').innerHTML = data.live
      .map(function (r) {
        var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down';
        return (
          '<tr>' +
          '<td><span class="name">' + esc(r.name) + '</span> <span class="slug">' + esc(r.slug) + '</span></td>' +
          '<td>' + esc(r.category || 'Uncategorised') + '</td>' +
          '<td>' + esc(chainText(r.chains)) + '</td>' +
          '<td class="num">' + money(r.tvl_usd) + '</td>' +
          '<td class="num">' + money(r.mcap_usd) + '</td>' +
          '<td class="num ' + growthClass + '">' + pct(r.change_7d) + '</td>' +
          '</tr>'
        );
      })
      .join('');
  }

  // ---- detail view ------------------------------------------------------------

  var dialog = $('detail');

  function openDetail(slug) {
    var row = null;
    for (var i = 0; i < data.rows.length; i++) {
      if (data.rows[i].slug === slug) { row = data.rows[i]; break; }
    }
    if (!row) return;
    state.p = slug;
    writeHash();
    var v = model.impliedOf(row, data);
    var recomputed = v.implied === row.implied_value_usd;
    var steps = model.farmSteps(row, data);
    $('detail-title').textContent = row.name;
    $('detail-body').innerHTML =
      '<p class="detail-sub">Rank ' + row.rank + ' of ' + fmtInt.format(data.rows.length) +
      (row.on_watchlist ? ' · On the watchlist' : ' · Early find') +
      ' · ' + esc(row.category || 'Uncategorised') + ' · ' + esc(row.chains.join(', ') || 'no chain listed') + '</p>' +
      '<dl class="facts">' +
      '<div><dt>TVL</dt><dd>' + money(row.tvl_usd) + '</dd></div>' +
      '<div><dt>7-day change</dt><dd>' + pct(row.change_7d) + '</dd></div>' +
      '<div><dt>Age</dt><dd>' + (row.age_days === null ? 'not listed' : fmtInt.format(row.age_days) + ' days') + '</dd></div>' +
      '<div><dt>Token status</dt><dd>No token recorded in the snapshot</dd></div>' +
      '</dl>' +
      '<h3>Implied value: ' + money(row.implied_value_usd) + '</h3>' +
      '<table class="breakdown"><tbody>' +
      '<tr><th scope="row">TVL × base multiple (' + data.calibration.base_multiple.toFixed(3) + ')</th><td class="num">' + money(row.tvl_usd * data.calibration.base_multiple) + '</td></tr>' +
      '<tr><th scope="row">× growth (' + pct(v.growthPct) + ' clamped, half weight)</th><td class="num">' + v.growthMult.toFixed(4) + '</td></tr>' +
      '<tr><th scope="row">× maturity (' + (v.age === null ? 'age unknown, 365 days assumed' : fmtInt.format(v.age) + ' days') + ')</th><td class="num">' + v.maturityMult.toFixed(4) + '</td></tr>' +
      '<tr><th scope="row">× breadth (' + row.chains.length + ' chain' + (row.chains.length === 1 ? '' : 's') + ')</th><td class="num">' + v.breadthMult.toFixed(4) + '</td></tr>' +
      '<tr><th scope="row">Implied value</th><td class="num strong">' + money(row.implied_value_usd) + '</td></tr>' +
      '</tbody></table>' +
      '<p class="check">' + (recomputed ? 'Recomputed in this page from the snapshot figures: matches the stored board.' : 'Recomputed in this page: differs from the stored board — do not trust this row.') + '</p>' +
      '<h3>Farm plan</h3>' +
      '<ol class="steps">' + steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<p class="warn">An implied value is an estimate, not a price, and a farm plan is not a promise of an airdrop. ' +
      'Only the protocol\'s own published pages can say whether a token or a points programme exists.</p>';
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
  }

  function closeDetail() {
    if (dialog.open) dialog.close();
    if (state.p) {
      state.p = null;
      writeHash();
    }
  }

  // ---- tabs -------------------------------------------------------------------

  function renderTabs() {
    var board = state.tab === 'board';
    $('tab-board').setAttribute('aria-selected', board ? 'true' : 'false');
    $('tab-live').setAttribute('aria-selected', board ? 'false' : 'true');
    $('view-board').hidden = !board;
    $('view-live').hidden = board;
    if (!board) renderLive();
  }

  // ---- wiring -------------------------------------------------------------------

  var categories = [];
  var chains = [];
  data.rows.forEach(function (r) {
    var c = r.category || 'Uncategorised';
    if (categories.indexOf(c) === -1) categories.push(c);
    r.chains.forEach(function (ch) {
      if (chains.indexOf(ch) === -1) chains.push(ch);
    });
  });
  categories.sort();
  chains.sort();
  fillSelect($('category'), categories, 'All categories');
  fillSelect($('chain'), chains, 'All chains');

  readHash();
  $('q').value = state.q;
  $('category').value = state.category;
  $('chain').value = state.chain;
  $('scope').value = state.scope;
  $('sort').value = state.sort;

  renderMeta();
  renderMethod();
  renderTabs();
  renderBoard();

  $('controls').addEventListener('input', function () {
    state.q = $('q').value;
    state.category = $('category').value;
    state.chain = $('chain').value;
    state.scope = $('scope').value;
    state.sort = $('sort').value;
    writeHash();
    renderBoard();
  });
  $('controls').addEventListener('submit', function (e) { e.preventDefault(); });

  $('tab-board').addEventListener('click', function () {
    state.tab = 'board';
    writeHash();
    renderTabs();
  });
  $('tab-live').addEventListener('click', function () {
    state.tab = 'live';
    writeHash();
    renderTabs();
  });

  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) openDetail(tr.getAttribute('data-slug'));
  });
  $('rows').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var tr = e.target.closest('tr[data-slug]');
    if (tr) {
      e.preventDefault();
      openDetail(tr.getAttribute('data-slug'));
    }
  });

  $('detail-close').addEventListener('click', closeDetail);
  dialog.addEventListener('close', function () {
    if (state.p) {
      state.p = null;
      writeHash();
    }
  });
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) closeDetail();
  });

  window.addEventListener('hashchange', function () {
    var previous = state.p;
    readHash();
    $('q').value = state.q;
    $('category').value = state.category;
    $('chain').value = state.chain;
    $('scope').value = state.scope;
    $('sort').value = state.sort;
    renderTabs();
    renderBoard();
    if (state.p && state.p !== previous) openDetail(state.p);
    if (!state.p && dialog.open) dialog.close();
  });

  if (state.p) openDetail(state.p);
})();
