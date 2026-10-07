/* Google look-alike home page + the hidden "ניק" soundboard. */
(function () {
  'use strict';

  var TRIGGER = 'ניק';
  var MAX_BYTES = 25 * 1024 * 1024;
  var EXTS = ['mp3', 'wav', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'flac', 'webm', 'weba', 'mp4'];
  var WATCHDOG_MS = 35000;      // server pings every 10s; silence this long means a dead link
  var WARM_LIMIT = 12;
  var WARM_MAX_BYTES = 8 * 1024 * 1024;

  var ERRORS = {
    network: 'אין חיבור לשרת. נסו שוב',
    too_big: 'הקובץ גדול מדי (עד 25MB)',
    bad_type: 'זה לא קובץ אודיו נתמך',
    too_many: 'יש יותר מדי סאונדים. מחקו כמה ונסו שוב',
    empty: 'הקובץ ריק',
    not_found: 'הסאונד כבר לא קיים'
  };

  var ICONS = {
    wave: '<path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/>',
    upload: '<path d="M12 15V3"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    headphones: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="2.5"/>',
    volume: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.4 5.6a9 9 0 0 1 0 12.7"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>'
  };

  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  var $ = function (id) { return document.getElementById(id); };
  var noop = function () {};
  var clientId = Math.random().toString(36).slice(2) + Date.now().toString(36);

  var prefs = {
    get: function (key, fallback) {
      try {
        var v = localStorage.getItem('np:' + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem('np:' + key, JSON.stringify(value)); } catch (e) {}
    }
  };

  var state = { sounds: [], online: 0, connected: false };

  function api(method, url, body) {
    var opts = { method: method, headers: {}, cache: 'no-store' };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw (data && data.error) || 'http_' + r.status;
        return data;
      });
    }, function () { throw 'network'; });
  }

  function errorText(code) { return ERRORS[code] || 'משהו השתבש. נסו שוב'; }

  function fmtSize(n) {
    if (!(n > 0)) return '';
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  function ago(ts) {
    var s = (Date.now() - ts) / 1000;
    if (!(s >= 60)) return 'עכשיו';
    var m = Math.floor(s / 60);
    if (m < 60) return m === 1 ? 'לפני דקה' : 'לפני ' + m + ' דק׳';
    var h = Math.floor(m / 60);
    if (h < 24) return h === 1 ? 'לפני שעה' : 'לפני ' + h + ' שעות';
    var d = Math.floor(h / 24);
    return d === 1 ? 'אתמול' : 'לפני ' + d + ' ימים';
  }

  /* =====================================================================
   * Google pages: home (/) and search results (/search?q=...)
   * =================================================================== */

  var homePage = $('g-page');
  var offlinePage = $('ofl');
  var homeInput = $('g-q');
  var account = $('g-account');
  var avatars = Array.prototype.slice.call(document.querySelectorAll('[data-avatar]'));

  function normalize(q) {
    q = String(q || '');
    if (q.normalize) q = q.normalize('NFC');
    return q
      .replace(/[\u0591-\u05C7\u200B-\u200F\u202A-\u202E"'`\u05F3\u05F4]/g, '') // niqqud, direction marks, quotes
      .replace(/\s+/g, ' ')
      .trim();
  }

  function openExternal(url) {
    var w = null;
    try { w = window.open(url, '_blank'); } catch (e) {}
    if (w) {
      try { w.opener = null; } catch (e) {}
    } else {
      location.href = url;
    }
  }

  function bindSearchBox(formEl, inputEl, clearEl) {
    function sync() {
      var has = inputEl.value.length > 0;
      clearEl.hidden = !has;
      formEl.classList.toggle('has-text', has);
    }
    inputEl.addEventListener('input', sync);
    clearEl.addEventListener('click', function () { inputEl.value = ''; sync(); inputEl.focus(); });
    formEl.addEventListener('submit', function (e) { e.preventDefault(); search(inputEl, sync, false); });
    sync();
    return sync;
  }

  var syncHome = bindSearchBox($('g-form'), homeInput, $('g-clear'));
  $('g-lucky').addEventListener('click', function () { search(homeInput, syncHome, true); });

  function search(inputEl, sync, lucky) {
    if (normalize(inputEl.value) === TRIGGER) {
      inputEl.value = '';
      sync();
      inputEl.blur();
      Panel.open();
      return;
    }
    var q = inputEl.value.trim();
    if (!q) {
      if (lucky) openExternal('https://www.google.com/doodles');
      else inputEl.focus();
      return;
    }
    inputEl.blur(); // closes the phone keyboard
    go('/search?q=' + encodeURIComponent(q));
  }

  // ---- routing: one page, the URL decides which view is shown ----

  function go(url) {
    try {
      history.pushState(null, '', url);
    } catch (e) {
      location.href = url;
      return;
    }
    route();
  }

  function queryParams() {
    var out = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf('=');
      var k = i > -1 ? pair.slice(0, i) : pair;
      var v = i > -1 ? pair.slice(i + 1) : '';
      try { out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) {}
    });
    return out;
  }

  function route() {
    setAccount(false);
    var params = queryParams();
    var q = (params.q || '').trim();
    var isSearch = location.pathname.replace(/\/+$/, '') === '/search' && q;
    if (isSearch && normalize(q) === TRIGGER) {
      try { history.replaceState(null, '', '/'); } catch (e) {}
      showHome();
      Panel.open();
      return;
    }
    if (isSearch) showOffline();
    else showHome();
  }

  var favicon = document.querySelector('link[rel="icon"]');
  var googleIcon = favicon ? favicon.getAttribute('href') : '';
  // Chrome shows a plain page icon on its error pages
  var blankIcon = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#5f6368" d="M3 1.5h6.5L13 5v9.5H3z"/>' +
    '<path fill="#fff" d="M4.2 2.7h4.6v3h3v7.6H4.2z"/></svg>');

  function setIcon(href) {
    if (favicon && favicon.getAttribute('href') !== href) favicon.setAttribute('href', href);
  }

  function showHome() {
    DinoGame.hide();
    offlinePage.hidden = true;
    homePage.hidden = false;
    document.body.classList.remove('is-offline');
    document.title = 'Google';
    setIcon(googleIcon);
  }

  // Every search that isn't the trigger: Chrome's "No internet" page with the dino game.
  function showOffline() {
    homePage.hidden = true;
    offlinePage.hidden = false;
    document.body.classList.add('is-offline');
    document.title = 'www.google.com';
    setIcon(blankIcon);
    fillSuggestions();
    window.scrollTo(0, 0);
    DinoGame.show($('ofl-canvas'), offlinePage);
  }

  function fillSuggestions() {
    var list = $('ofl-list');
    if (list.childNodes.length) return;
    var ua = navigator.userAgent || '';
    var mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    var items = mobile
      ? ['לכבות את מצב טיסה', 'להפעיל חבילת גלישה או Wi-Fi', 'לבדוק את עוצמת הקליטה באזור']
      : ['לבדוק את כבלי הרשת, המודם והנתב', 'להתחבר מחדש לרשת Wi-Fi'];
    items.forEach(function (t) {
      var li = document.createElement('li');
      li.textContent = t;
      list.appendChild(li);
    });
    if (!mobile && /Windows/i.test(ua)) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#';
      a.textContent = 'הפעלת אבחון הרשת של Windows';
      a.addEventListener('click', function (e) { e.preventDefault(); });
      li.appendChild(a);
      list.appendChild(li);
    }
  }

  window.addEventListener('popstate', route);

  // ---- account card (Noa) ----

  function setAccount(open, anchor) {
    if (open && anchor) {
      var r = anchor.getBoundingClientRect();
      account.style.top = Math.round(r.bottom + (window.pageYOffset || 0) + 6) + 'px';
    }
    account.hidden = !open;
    avatars.forEach(function (b) { b.setAttribute('aria-expanded', String(open && b === anchor)); });
  }
  avatars.forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      setAccount(account.hidden, b);
    });
  });
  $('g-account-close').addEventListener('click', function () { setAccount(false); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-account-close]'), function (b) {
    b.addEventListener('click', function () { setAccount(false); });
  });
  document.addEventListener('click', function (e) {
    if (!account.hidden && !account.contains(e.target)) setAccount(false);
  });

  /* =====================================================================
   * Soundboard panel
   * =================================================================== */

  var Panel = (function () {
    var root = $('np');
    var grid = $('np-grid');
    var empty = $('np-empty');
    var countEl = $('np-count');
    var uploadsEl = $('np-uploads');
    var drop = $('np-drop');
    var fileInput = $('np-file');
    var live = $('np-live');
    var onlineEl = $('np-online');
    var liveLabel = $('np-live-label');
    var boost = $('np-boost');
    var boostVal = $('np-boost-val');
    var selfToggle = $('np-self');
    var toastsEl = $('np-toasts');

    var isOpen = false;
    var ticker = null;
    var hideTimer = null;
    var confirmDel = null;  // { id, until }
    var freshId = null;
    var playing = {};       // id -> number of local voices
    var uploadChain = Promise.resolve();
    var dragDepth = 0;

    Array.prototype.forEach.call(root.querySelectorAll('[data-icon]'), function (el) {
      el.innerHTML = icon(el.getAttribute('data-icon'));
    });

    // ---- open / close ----

    function open() {
      if (isOpen) return;
      isOpen = true;
      clearTimeout(hideTimer);
      root.hidden = false;
      document.documentElement.classList.add('np-lock');
      render();
      void root.offsetWidth; // start the enter transition from the hidden state
      root.classList.add('open');
      ticker = setInterval(render, 60000);
      setTimeout(function () {
        try { $('np-close').focus({ preventScroll: true }); } catch (e) {}
      }, 60);
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      clearInterval(ticker);
      root.classList.remove('open');
      document.documentElement.classList.remove('np-lock');
      hideTimer = setTimeout(function () { if (!isOpen) root.hidden = true; }, 260);
    }

    Array.prototype.forEach.call(root.querySelectorAll('[data-np-close]'), function (el) {
      el.addEventListener('click', close);
    });

    // ---- rendering ----

    function render() {
      if (!isOpen) return;
      var list = state.sounds.slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      var frag = document.createDocumentFragment();
      list.forEach(function (s) { frag.appendChild(card(s)); });
      grid.textContent = '';
      grid.appendChild(frag);
      empty.hidden = list.length > 0;
      countEl.textContent = list.length ? String(list.length) : '';
      renderLive();
    }

    function card(s) {
      var el = document.createElement('article');
      el.className = 'snd' + (playing[s.id] ? ' playing' : '') + (s.id === freshId ? ' fresh' : '');
      el.setAttribute('data-id', s.id);
      el.innerHTML =
        '<div class="snd-top">' +
          '<div class="snd-icon">' + icon('music') + '<span class="eq"><i></i><i></i><i></i><i></i></span></div>' +
          '<div class="snd-meta"><div class="snd-name"></div><div class="snd-info"></div></div>' +
        '</div>' +
        '<div class="snd-actions">' +
          '<button type="button" class="snd-play" data-act="play">' + icon('megaphone') + '<span>נגן לכולם</span></button>' +
          '<button type="button" class="snd-mini" data-act="preview" title="השמעה רק אצלי" aria-label="השמעה רק אצלי">' + icon('headphones') + '</button>' +
          '<button type="button" class="snd-mini danger" data-act="delete" title="מחיקה" aria-label="מחיקה">' + icon('trash') + '</button>' +
        '</div>';
      var name = el.querySelector('.snd-name');
      name.textContent = s.name;
      name.title = s.name;
      el.querySelector('.snd-info').textContent = [fmtSize(s.size), ago(s.createdAt)].filter(Boolean).join(' · ');
      if (confirmDel && confirmDel.id === s.id && confirmDel.until > Date.now()) showConfirm(el);
      return el;
    }

    function showConfirm(cardEl) {
      var btn = cardEl && cardEl.querySelector('[data-act="delete"]');
      if (!btn) return;
      btn.classList.add('confirm');
      btn.innerHTML = icon('trash') + '<span>למחוק?</span>';
    }

    function renderLive() {
      live.classList.toggle('off', !state.connected);
      onlineEl.textContent = state.connected ? String(state.online) : '';
      liveLabel.textContent = state.connected ? 'באתר עכשיו' : 'מתחבר…';
    }

    function markPlaying(id) {
      if (!isOpen) return;
      var el = null;
      try { el = grid.querySelector('.snd[data-id="' + id + '"]'); } catch (e) {}
      if (el) el.classList.toggle('playing', !!playing[id]);
    }

    SoundEngine.on('start', function (id) {
      playing[id] = (playing[id] || 0) + 1;
      markPlaying(id);
    });
    SoundEngine.on('end', function (id) {
      if (playing[id] > 1) playing[id]--;
      else delete playing[id];
      markPlaying(id);
    });

    // ---- toasts ----

    function toast(msg, type) {
      var t = document.createElement('div');
      t.className = 'np-toast ' + (type || 'ok');
      t.innerHTML = icon(type === 'error' ? 'alert' : type === 'info' ? 'megaphone' : 'check');
      var span = document.createElement('span');
      span.textContent = msg;
      t.appendChild(span);
      toastsEl.appendChild(t);
      while (toastsEl.children.length > 3) toastsEl.removeChild(toastsEl.firstChild);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { t.classList.add('in'); });
      });
      setTimeout(function () {
        t.classList.remove('in');
        setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
      }, 3200);
    }

    // ---- sound actions ----

    function findSound(id) {
      for (var i = 0; i < state.sounds.length; i++) if (state.sounds[i].id === id) return state.sounds[i];
      return null;
    }

    function boostValue() {
      var v = parseFloat(boost.value);
      return isFinite(v) ? v : 3;
    }

    function playForAll(s, btn) {
      if (btn.disabled) return;
      btn.disabled = true;
      setTimeout(function () { btn.disabled = false; }, 350);
      api('POST', '/api/play', { id: s.id, boost: boostValue(), from: clientId }).then(function (res) {
        var n = Math.max(0, (Number(res.online) || 0) - (selfToggle.checked ? 0 : 1));
        toast('מנגן לכולם · ' + (n === 1 ? 'מכשיר אחד' : n + ' מכשירים'), 'ok');
      }, function (err) {
        if (err === 'not_found') removeLocal(s.id);
        toast(errorText(err), 'error');
      });
    }

    function askDelete(s, btn) {
      if (confirmDel && confirmDel.id === s.id && confirmDel.until > Date.now()) {
        confirmDel = null;
        btn.disabled = true;
        api('DELETE', '/api/sounds/' + encodeURIComponent(s.id)).then(function () {
          removeLocal(s.id);
          toast('הסאונד נמחק', 'ok');
        }, function (err) {
          if (err === 'not_found') { removeLocal(s.id); return; }
          btn.disabled = false;
          toast(errorText(err), 'error');
        });
        return;
      }
      confirmDel = { id: s.id, until: Date.now() + 3000 };
      showConfirm(btn.closest('.snd'));
      setTimeout(function () {
        if (confirmDel && confirmDel.id === s.id && confirmDel.until <= Date.now()) {
          confirmDel = null;
          render();
        }
      }, 3100);
    }

    grid.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('button[data-act]');
      if (!btn) return;
      var cardEl = btn.closest('.snd');
      var s = cardEl && findSound(cardEl.getAttribute('data-id'));
      if (!s) return;
      var act = btn.getAttribute('data-act');
      if (act === 'play') playForAll(s, btn);
      else if (act === 'preview') SoundEngine.play(s, boostValue());
      else if (act === 'delete') askDelete(s, btn);
    });

    $('np-stop').addEventListener('click', function () {
      SoundEngine.stopAll();
      api('POST', '/api/stop', { from: clientId }).then(function () {
        toast('הסאונד נעצר אצל כולם', 'ok');
      }, function (err) { toast(errorText(err), 'error'); });
    });

    // ---- volume boost & self toggle ----

    boost.value = String(prefs.get('boost', 3));
    selfToggle.checked = prefs.get('self', true) !== false;
    function syncBoost() {
      var v = boostValue();
      boostVal.textContent = v >= 5 ? 'MAX' : Math.round(v * 100) + '%';
      boostVal.classList.toggle('max', v >= 5);
      boost.style.setProperty('--p', ((v - 1) / 4 * 100) + '%');
    }
    boost.addEventListener('input', function () { syncBoost(); prefs.set('boost', boostValue()); });
    selfToggle.addEventListener('change', function () { prefs.set('self', selfToggle.checked); });
    syncBoost();

    // ---- uploads ----

    function validate(f) {
      if (!f || !f.size) return ERRORS.empty;
      if (f.size > MAX_BYTES) return ERRORS.too_big;
      var dot = f.name.lastIndexOf('.');
      var ext = dot > -1 ? f.name.slice(dot + 1).toLowerCase() : '';
      if (EXTS.indexOf(ext) === -1 && !/^(audio\/|video\/mp4)/.test(f.type || '')) return ERRORS.bad_type;
      return null;
    }

    function uploadRow(file) {
      var row = document.createElement('div');
      row.className = 'up';
      row.innerHTML =
        '<div class="up-icon">' + icon('upload') + '</div>' +
        '<div class="up-main">' +
          '<div class="up-row"><span class="up-name"></span><span class="up-status"></span></div>' +
          '<div class="up-bar"><i></i></div>' +
        '</div>' +
        '<div class="up-actions"></div>';
      row.querySelector('.up-name').textContent = file.name;
      var status = row.querySelector('.up-status');
      var bar = row.querySelector('.up-bar i');
      var actions = row.querySelector('.up-actions');
      uploadsEl.appendChild(row);

      function remove() { if (row.parentNode) row.parentNode.removeChild(row); }

      return {
        wait: function () { status.textContent = 'ממתין…'; },
        progress: function (p) {
          var pct = Math.min(100, Math.round(p * 100));
          bar.style.width = pct + '%';
          status.textContent = pct < 100 ? pct + '%' : 'מעבד…';
        },
        done: function () {
          row.className = 'up done';
          row.querySelector('.up-icon').innerHTML = icon('check');
          bar.style.width = '100%';
          status.textContent = 'מוכן לניגון';
          setTimeout(remove, 2500);
        },
        fail: function (msg, canRetry) {
          row.className = 'up error';
          row.querySelector('.up-icon').innerHTML = icon('alert');
          status.textContent = msg;
          actions.textContent = '';
          if (canRetry) {
            var retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'up-btn';
            retry.textContent = 'נסו שוב';
            retry.addEventListener('click', function () { remove(); enqueue(file); });
            actions.appendChild(retry);
          }
          var dismiss = document.createElement('button');
          dismiss.type = 'button';
          dismiss.className = 'up-btn icon';
          dismiss.setAttribute('aria-label', 'הסרה');
          dismiss.innerHTML = icon('x');
          dismiss.addEventListener('click', remove);
          actions.appendChild(dismiss);
        }
      };
    }

    function upload(file, row) {
      return new Promise(function (resolve) {
        var xhr = new XMLHttpRequest();
        var finished = false;
        function fail(msg) {
          if (finished) return;
          finished = true;
          row.fail(msg, true);
          resolve();
        }
        xhr.open('POST', '/api/upload');
        xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name));
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.timeout = 10 * 60 * 1000;
        xhr.upload.onprogress = function (e) { if (e.lengthComputable && e.total) row.progress(e.loaded / e.total); };
        xhr.onload = function () {
          var res = null;
          try { res = JSON.parse(xhr.responseText); } catch (e) {}
          if (xhr.status >= 200 && xhr.status < 300 && res && res.sound) {
            finished = true;
            row.done();
            addLocal(res.sound);
            toast('„' + res.sound.name + '" הועלה. אפשר לנגן לכולם!', 'ok');
            resolve();
          } else {
            fail(errorText(res && res.error));
          }
        };
        xhr.onerror = function () { fail(ERRORS.network); };
        xhr.ontimeout = function () { fail(ERRORS.network); };
        xhr.onabort = function () { fail(ERRORS.network); };
        row.progress(0);
        xhr.send(file);
      });
    }

    function enqueue(file) {
      var row = uploadRow(file);
      var err = validate(file);
      if (err) { row.fail(err, false); return; }
      row.wait();
      uploadChain = uploadChain.then(function () { return upload(file, row); }, noop);
    }

    function addFiles(files) {
      for (var i = 0; i < files.length; i++) enqueue(files[i]);
    }

    drop.addEventListener('click', function () { fileInput.click(); });
    drop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files.length) addFiles(fileInput.files);
      fileInput.value = '';
    });

    function hasFiles(e) {
      var types = e.dataTransfer && e.dataTransfer.types;
      if (!types) return false;
      for (var i = 0; i < types.length; i++) if (types[i] === 'Files') return true;
      return false;
    }
    root.addEventListener('dragenter', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth++;
      drop.classList.add('drag');
    });
    root.addEventListener('dragover', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    root.addEventListener('dragleave', function (e) {
      if (!hasFiles(e)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) drop.classList.remove('drag');
    });
    root.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth = 0;
      drop.classList.remove('drag');
      addFiles(e.dataTransfer.files);
    });

    // ---- local list updates (the server's broadcast confirms them too) ----

    function addLocal(sound) {
      if (!findSound(sound.id)) state.sounds = state.sounds.concat([sound]);
      freshId = sound.id;
      setTimeout(function () { if (freshId === sound.id) freshId = null; }, 2500);
      SoundEngine.warm(sound.url);
      render();
    }

    function removeLocal(id) {
      state.sounds = state.sounds.filter(function (s) { return s.id !== id; });
      render();
    }

    return {
      open: open,
      close: close,
      isOpen: function () { return isOpen; },
      render: render,
      renderLive: renderLive,
      playForMe: function () { return selfToggle.checked; },
      remotePlayed: function (name) { if (isOpen) toast('מישהו ניגן לכולם: ' + (name || 'סאונד'), 'info'); }
    };
  })();

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!account.hidden) setAccount(false);
    else if (Panel.isOpen()) Panel.close();
  });

  /* =====================================================================
   * Live connection (server-sent events)
   * =================================================================== */

  var es = null;
  var retryTimer = null;
  var retryDelay = 1000;
  var lastSeen = 0;

  function setConnected(v) {
    if (state.connected === v) return;
    state.connected = v;
    Panel.renderLive();
  }

  function setSounds(list) {
    if (!Array.isArray(list)) return;
    state.sounds = list.filter(function (s) {
      return s && typeof s.id === 'string' && typeof s.url === 'string' && s.url.indexOf('/sounds/') === 0;
    });
    state.sounds
      .slice()
      .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); })
      .filter(function (s) { return !(s.size > WARM_MAX_BYTES); })
      .slice(0, WARM_LIMIT)
      .forEach(function (s) { SoundEngine.warm(s.url); });
    Panel.render();
  }

  function setOnline(n) {
    n = Number(n);
    if (!isFinite(n)) return;
    state.online = n;
    Panel.renderLive();
  }

  function onPlay(d) {
    if (typeof d.url !== 'string' || d.url.indexOf('/sounds/') !== 0) return;
    var mine = d.from === clientId;
    if (!mine || Panel.playForMe()) SoundEngine.play({ id: d.id, url: d.url, name: d.name }, d.boost);
    if (!mine) Panel.remotePlayed(d.name);
  }

  function scheduleReconnect() {
    if (retryTimer) return;
    retryTimer = setTimeout(connect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 15000);
  }

  function connect() {
    clearTimeout(retryTimer);
    retryTimer = null;
    if (es) { try { es.close(); } catch (e) {} es = null; }
    if (!window.EventSource) return; // ancient browser: the page still works as a plain Google page

    var src = new EventSource('/events');
    es = src;
    lastSeen = Date.now();

    function on(name, fn) {
      src.addEventListener(name, function (e) {
        if (src !== es) return;
        lastSeen = Date.now();
        var data = null;
        try { data = JSON.parse(e.data); } catch (err) {}
        fn(data || {});
      });
    }

    on('hello', function (d) {
      retryDelay = 1000;
      setConnected(true);
      setSounds(d.sounds);
      setOnline(d.online);
    });
    on('sounds', function (d) { setSounds(d.sounds); });
    on('online', function (d) { setOnline(d.online); });
    on('play', onPlay);
    on('stop', function () { SoundEngine.stopAll(); });
    on('ping', noop);

    src.onopen = function () { if (src === es) lastSeen = Date.now(); };
    src.onerror = function () {
      if (src !== es) return;
      setConnected(false);
      if (src.readyState === 2) scheduleReconnect(); // browser gave up for good; we don't
    };
  }

  function checkConnection() {
    if (!window.EventSource) return;
    if (!es || es.readyState === 2) { scheduleReconnect(); return; }
    if (Date.now() - lastSeen > WATCHDOG_MS) connect();
  }

  setInterval(checkConnection, 5000);
  window.addEventListener('online', function () { retryDelay = 1000; connect(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) checkConnection(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) connect(); }); // back/forward cache

  route();
  try {
    if (!homePage.hidden && window.matchMedia && window.matchMedia('(pointer: fine)').matches) homeInput.focus();
  } catch (e) {}
  connect();
})();
