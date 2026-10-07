/*
 * SoundEngine - plays broadcast sounds as loud as the browser allows.
 *
 * Browsers block audio until the visitor has interacted with the page (click,
 * tap or key press). The engine unlocks itself on the first interaction; a sound
 * that arrives before that is held and played the moment the visitor interacts
 * (if it is still fresh).
 *
 * Loudness: source -> gain (boost, up to 5x) -> compressor/limiter -> speakers.
 */
(function () {
  'use strict';

  var AC = window.AudioContext || window.webkitAudioContext;
  var PENDING_TTL_MS = 30000;
  var MAX_CACHED = 6;
  var MAX_CACHED_SECONDS = 90;
  var noop = function () {};

  var ctx = null;
  var bus = null;
  var gen = 0;            // bumped by stopAll(); stale jobs check it before starting
  var pending = null;     // sound waiting for the audio to unlock
  var decoded = new Map(); // url -> Promise<AudioBuffer> (LRU)
  var warmed = {};
  var voices = new Set();
  var listeners = { start: [], end: [] };

  function emit(type, id, extra) {
    listeners[type].forEach(function (fn) { try { fn(id, extra); } catch (e) {} });
  }

  function clampBoost(b) {
    b = Number(b);
    if (!isFinite(b)) return 3;
    return Math.min(5, Math.max(1, b));
  }

  function getCtx() {
    if (ctx || !AC) return ctx;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch (e) {
      try { ctx = new AC(); } catch (e2) { ctx = null; return null; }
    }
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 6;
    comp.ratio.value = 12;
    comp.attack.value = 0.002;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);
    bus = comp;
    ctx.onstatechange = function () { if (ctx.state === 'running') flush(); };
    return ctx;
  }

  function resume() {
    if (!ctx || ctx.state === 'running') return;
    try {
      var p = ctx.resume();
      if (p && p.then) p.then(flush, noop);
    } catch (e) {}
  }

  // Runs inside every user gesture: creating/resuming the context there is what unlocks audio.
  function unlock() {
    var c = getCtx();
    if (!c) return;
    if (c.state === 'running') { flush(); return; } // already unlocked: release anything still held
    resume();
    try { // older iOS needs a sound started inside the gesture
      var src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, 22050);
      src.connect(c.destination);
      src.start(0);
    } catch (e) {}
  }
  ['pointerdown', 'mousedown', 'touchend', 'keydown', 'click'].forEach(function (type) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { resume(); flush(); }
  });

  function decode(url) {
    var hit = decoded.get(url);
    if (hit) { // refresh LRU position
      decoded.delete(url);
      decoded.set(url, hit);
      return hit;
    }
    var c = getCtx();
    var p = fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.arrayBuffer();
      })
      .then(function (data) {
        return new Promise(function (resolve, reject) {
          var fail = function (e) { reject(e || new Error('decode failed')); };
          var ret = c.decodeAudioData(data, resolve, fail); // callback form for old Safari
          if (ret && ret.then) ret.then(resolve, fail);
        });
      });
    decoded.set(url, p);
    while (decoded.size > MAX_CACHED) decoded.delete(decoded.keys().next().value);
    p.then(function (buffer) {
      if (buffer.duration > MAX_CACHED_SECONDS && decoded.get(url) === p) decoded.delete(url);
    }, function () {
      if (decoded.get(url) === p) decoded.delete(url);
    });
    return p;
  }

  function flush() {
    if (!pending || !ctx || ctx.state !== 'running') return;
    var job = pending;
    pending = null;
    if (Date.now() - job.at > PENDING_TTL_MS || job.gen !== gen) return;
    decode(job.sound.url).then(function (buffer) {
      startBuffer(job, buffer);
    }, function () {
      htmlPlay(job);
    });
  }

  function startBuffer(job, buffer) {
    if (job.gen !== gen) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {} // iOS: ignore silent switch
    var src = ctx.createBufferSource();
    var gain = ctx.createGain();
    src.buffer = buffer;
    gain.gain.value = clampBoost(job.boost);
    src.connect(gain);
    gain.connect(bus);
    var voice = {
      id: job.sound.id,
      stop: function () { try { src.stop(); } catch (e) {} }
    };
    voices.add(voice);
    src.onended = function () {
      if (!voices.has(voice)) return;
      voices.delete(voice);
      try { gain.disconnect(); } catch (e) {}
      emit('end', voice.id);
    };
    src.start(0);
    emit('start', voice.id, buffer.duration);
  }

  // Fallback when Web Audio is missing or cannot decode the file.
  function htmlPlay(job) {
    if (job.gen !== gen) return;
    var audio;
    try { audio = new Audio(job.sound.url); } catch (e) { return; }
    audio.volume = 1;
    var voice = {
      id: job.sound.id,
      stop: function () { try { audio.pause(); } catch (e) {} finish(); }
    };
    function finish() {
      if (!voices.has(voice)) return;
      voices.delete(voice);
      emit('end', voice.id);
    }
    voices.add(voice);
    audio.onended = finish;
    audio.onerror = finish;
    var p;
    try { p = audio.play(); } catch (e) { finish(); return; }
    if (p && p.then) {
      p.then(function () { emit('start', voice.id, audio.duration); }, finish);
    } else {
      emit('start', voice.id, audio.duration);
    }
  }

  function play(sound, boost) {
    if (!sound || !sound.url) return;
    var job = { sound: sound, boost: boost, at: Date.now(), gen: gen };
    var c = getCtx();
    if (!c) { htmlPlay(job); return; }
    pending = job;
    decode(sound.url).catch(noop); // start downloading/decoding right away
    if (c.state === 'running') flush();
    else resume();
  }

  function stopAll() {
    gen++;
    pending = null;
    Array.from(voices).forEach(function (v) { v.stop(); });
  }

  // Pre-download into the HTTP cache so a broadcast starts with no delay.
  function warm(url) {
    if (!url || warmed[url] || !window.fetch) return;
    warmed[url] = true;
    fetch(url).then(function (r) { return r.ok ? r.arrayBuffer() : null; })
      .catch(function () { delete warmed[url]; });
  }

  window.SoundEngine = {
    play: play,
    stopAll: stopAll,
    warm: warm,
    unlock: unlock,
    isUnlocked: function () { return !!ctx && ctx.state === 'running'; },
    on: function (type, fn) { if (listeners[type]) listeners[type].push(fn); }
  };
})();
