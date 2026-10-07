/*
 * Chrome-style "No internet" T-Rex runner, drawn as pixel art on a canvas.
 * Space / Arrow Up / tap = jump, Arrow Down = drop faster.
 */
(function () {
  'use strict';

  var P = 2;               // one art pixel, in CSS px
  var H = 150;             // canvas height
  var GROUND_Y = 131;      // horizon line
  var DINO_W = 40;
  var DINO_GROUND = 132 - 40;
  var DINO_X = 50;
  var GRAVITY = 0.6;
  var JUMP_VELOCITY = -10;
  var DROP_VELOCITY = -5;
  var MIN_JUMP = 30;
  var START_SPEED = 6;
  var MAX_SPEED = 13;
  var ACCEL = 0.001;
  var CLEAR_MS = 1500;     // no obstacles right after the start
  var RESTART_MS = 600;    // ignore input briefly after a crash

  var DINO_TOP = [
    '..........########..',
    '.........##.#######.',
    '.........##########.',
    '.........##########.',
    '.........##########.',
    '.........#####......',
    '.........########...',
    '#.......#####.......',
    '#......######.......',
    '##....#########.....',
    '###..########.#.....',
    '###########.........',
    '###########.........',
    '.#########..........',
    '..########..........',
    '...######...........'
  ];
  var EYE_OPEN = DINO_TOP[1];
  var EYE_CLOSED = '.........##########.';
  var EYE_DEAD = ['.........##..######.', '.........##..######.'];
  var LEGS = {
    stand: ['....###.##..........', '....##...#..........', '....#....#..........', '....##...##.........'],
    run1: ['....###.##..........', '.....##..#..........', '.........#..........', '.........##.........'],
    run2: ['....###.##..........', '....##...##.........', '....#...............', '....##..............']
  };
  var CACTUS = [
    '....#....',
    '...###...',
    '...###...',
    '...###.#.',
    '.#.###.##',
    '##.###.##',
    '##.###.##',
    '##.###.##',
    '##.######',
    '######...',
    '.#####...',
    '...###...',
    '...###...',
    '...###...',
    '...###...',
    '...###...',
    '...###...'
  ];
  var CLOUD = [
    '.........#####.........',
    '.......##.....##.......',
    '......#.........###....',
    '....##.............#...',
    '..##................##.',
    '.#....................#',
    '#######################'
  ];
  var FONT = {
    '0': ['###', '#.#', '#.#', '#.#', '###'],
    '1': ['.#.', '##.', '.#.', '.#.', '###'],
    '2': ['###', '..#', '###', '#..', '###'],
    '3': ['###', '..#', '###', '..#', '###'],
    '4': ['#.#', '#.#', '###', '..#', '..#'],
    '5': ['###', '#..', '###', '..#', '###'],
    '6': ['###', '#..', '###', '#.#', '###'],
    '7': ['###', '..#', '..#', '..#', '..#'],
    '8': ['###', '#.#', '###', '#.#', '###'],
    '9': ['###', '#.#', '###', '..#', '###'],
    'H': ['#.#', '#.#', '###', '#.#', '#.#'],
    'I': ['###', '.#.', '.#.', '.#.', '###'],
    'G': ['####', '#...', '#.##', '#..#', '####'],
    'A': ['.##.', '#..#', '####', '#..#', '#..#'],
    'M': ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
    'E': ['###', '#..', '###', '#..', '###'],
    'O': ['####', '#..#', '#..#', '#..#', '####'],
    'V': ['#...#', '#...#', '#...#', '.#.#.', '..#..'],
    'R': ['###.', '#..#', '###.', '#.#.', '#..#'],
    ' ': ['..', '..', '..', '..', '..']
  };

  var canvas = null;
  var ctx = null;
  var cssW = 600;
  var dpr = 1;
  var color = '#535353';
  var visible = false;
  var raf = 0;
  var last = 0;
  var blinkTimer = 0;
  var blinking = false;

  var state = 'idle';      // idle | intro | running | crashed
  var dino, speed, distance, obstacles, clouds, bumps, reveal, startTime, crashTime, flashUntil, lastHundred;
  var runTick = 0;
  var hi = 0;
  try { hi = parseInt(localStorage.getItem('dino:hi'), 10) || 0; } catch (e) {}

  // ---- drawing helpers ----

  function bitmap(rows, x, y, p) {
    x = Math.round(x);
    y = Math.round(y);
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var start = -1;
      for (var c = 0; c <= row.length; c++) {
        if (row.charAt(c) === '#') {
          if (start < 0) start = c;
        } else if (start >= 0) {
          ctx.fillRect(x + start * p, y + r * p, (c - start) * p, p);
          start = -1;
        }
      }
    }
  }

  function textWidth(text, p) {
    var w = 0;
    for (var i = 0; i < text.length; i++) w += ((FONT[text.charAt(i)] || FONT[' '])[0].length + 1) * p;
    return w - p;
  }

  function text(str, x, y, p) {
    for (var i = 0; i < str.length; i++) {
      var glyph = FONT[str.charAt(i)] || FONT[' '];
      bitmap(glyph, x, y, p);
      x += (glyph[0].length + 1) * p;
    }
  }

  function pad(n) {
    var s = String(Math.max(0, Math.floor(n)));
    while (s.length < 5) s = '0' + s;
    return s.slice(-5);
  }

  function score() { return Math.floor(distance * 0.025); }

  // ---- game setup ----

  function newDino(x) {
    return { x: x, y: DINO_GROUND, vy: 0, jumping: false, dropping: false, releaseEarly: false };
  }

  function makeBumps() {
    bumps = [];
    for (var x = 0; x < cssW + 60; x += 12 + Math.random() * 30) {
      bumps.push({ x: x, w: 1 + Math.round(Math.random() * 3), dy: 2 + Math.round(Math.random() * 4) });
    }
  }

  function resetIdle() {
    state = 'idle';
    dino = newDino(0);
    obstacles = [];
    clouds = [];
    distance = 0;
    speed = START_SPEED;
    reveal = DINO_W + 4;
    flashUntil = 0;
    lastHundred = 0;
    makeBumps();
  }

  function begin(fullWidth, now) {
    state = fullWidth ? 'running' : 'intro';
    dino = newDino(fullWidth ? DINO_X : 0);
    obstacles = [];
    clouds = [];
    distance = 0;
    speed = START_SPEED;
    reveal = fullWidth ? cssW : DINO_W + 4;
    startTime = now;
    flashUntil = 0;
    lastHundred = 0;
    makeBumps();
    jump();
    kick();
  }

  function jump() {
    if (dino.jumping) return;
    dino.jumping = true;
    dino.dropping = false;
    dino.releaseEarly = false;
    dino.vy = JUMP_VELOCITY - speed / 10;
  }

  function release() {
    if (!dino || !dino.jumping) return;
    var height = DINO_GROUND - dino.y;
    if (height >= MIN_JUMP) {
      if (dino.vy < DROP_VELOCITY) dino.vy = DROP_VELOCITY;
    } else {
      dino.releaseEarly = true;
    }
  }

  function spawn() {
    var large = Math.random() < 0.5;
    var p = large ? 3 : 2;
    var one = CACTUS[0].length * p;
    var size = speed > 7 ? 1 + Math.floor(Math.random() * 3) : 1;
    var w = size * one + (size - 1) * p;
    var h = CACTUS.length * p;
    var minGap = Math.round(w * speed + 120 * 0.6);
    var gap = minGap + Math.round(Math.random() * minGap * 0.5);
    obstacles.push({ x: cssW + 4, y: 132 - h, w: w, h: h, p: p, size: size, one: one, gap: gap });
  }

  function collides(o) {
    var x = dino.x;
    var y = dino.y;
    var boxes = [[x + 18, y + 1, 20, 12], [x + 4, y + 15, 24, 15], [x + 8, y + 31, 13, 8]];
    var ox = o.x + 2;
    var oy = o.y + 3;
    var ow = o.w - 4;
    var oh = o.h - 3;
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (b[0] < ox + ow && b[0] + b[2] > ox && b[1] < oy + oh && b[1] + b[3] > oy) return true;
    }
    return false;
  }

  function crash(now) {
    state = 'crashed';
    crashTime = now;
    var s = score();
    if (s > hi) {
      hi = s;
      try { localStorage.setItem('dino:hi', String(hi)); } catch (e) {}
    }
    try { if (navigator.vibrate) navigator.vibrate(200); } catch (e) {}
  }

  // ---- update & draw ----

  function update(dt, now) {
    if (dino.jumping) {
      dino.y += dino.vy * dt;
      dino.vy += GRAVITY * (dino.dropping ? 3 : 1) * dt;
      if (dino.releaseEarly && DINO_GROUND - dino.y >= MIN_JUMP && dino.vy < DROP_VELOCITY) {
        dino.vy = DROP_VELOCITY;
        dino.releaseEarly = false;
      }
      if (dino.y >= DINO_GROUND) {
        dino.y = DINO_GROUND;
        dino.vy = 0;
        dino.jumping = false;
        dino.dropping = false;
      }
    }

    if (state === 'intro') {
      reveal = Math.min(cssW, reveal + 24 * dt);
      dino.x = Math.min(DINO_X, dino.x + 1.6 * dt);
      if (reveal >= cssW && dino.x >= DINO_X) state = 'running';
    }
    if (state !== 'intro' && state !== 'running') return;

    runTick += dt;
    speed = Math.min(MAX_SPEED, speed + ACCEL * dt);
    distance += speed * dt;

    var hundred = Math.floor(score() / 100);
    if (hundred > lastHundred) {
      lastHundred = hundred;
      flashUntil = now + 1000;
    }

    var move = speed * dt;
    for (var i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].x -= move;
      if (obstacles[i].x + obstacles[i].w < 0) obstacles.splice(i, 1);
    }
    if (state === 'running' && now - startTime > CLEAR_MS) {
      var lastOb = obstacles[obstacles.length - 1];
      if (!lastOb || lastOb.x + lastOb.w + lastOb.gap < cssW) spawn();
    }

    for (var c = clouds.length - 1; c >= 0; c--) {
      clouds[c].x -= move * 0.2;
      if (clouds[c].x + 46 < 0) clouds.splice(c, 1);
    }
    var lastCloud = clouds[clouds.length - 1];
    if (clouds.length < 6 && (!lastCloud || lastCloud.x < cssW - lastCloud.gap)) {
      clouds.push({ x: cssW + 10, y: 20 + Math.random() * 50, gap: 100 + Math.random() * 300 });
    }

    for (var b = 0; b < bumps.length; b++) {
      bumps[b].x -= move;
      if (bumps[b].x + bumps[b].w < 0) bumps[b].x += cssW + 60;
    }

    for (var k = 0; k < obstacles.length; k++) {
      if (collides(obstacles[k])) { crash(now); return; }
    }
  }

  function drawDino() {
    var top = DINO_TOP.slice();
    var legs = LEGS.stand;
    if (state === 'crashed') {
      top[1] = EYE_DEAD[0];
      top[2] = EYE_DEAD[1];
    } else {
      top[1] = blinking && state === 'idle' ? EYE_CLOSED : EYE_OPEN;
      if ((state === 'running' || state === 'intro') && !dino.jumping) {
        legs = Math.floor(runTick / 5) % 2 ? LEGS.run1 : LEGS.run2;
      }
    }
    bitmap(top.concat(legs), dino.x, dino.y, P);
  }

  function drawRestart(cx, cy) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 10, Math.PI * 0.35, Math.PI * 1.95);
    ctx.stroke();
    ctx.beginPath(); // arrow head
    ctx.moveTo(cx + 10, cy - 11);
    ctx.lineTo(cx + 11, cy - 1);
    ctx.lineTo(cx + 1, cy - 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, H);
    ctx.fillStyle = color;

    if (state !== 'idle') {
      ctx.globalAlpha = 0.3;
      for (var c = 0; c < clouds.length; c++) bitmap(CLOUD, clouds[c].x, clouds[c].y, 2);
      ctx.globalAlpha = 1;

      ctx.fillRect(0, GROUND_Y, Math.round(reveal), 1);
      for (var b = 0; b < bumps.length; b++) {
        if (bumps[b].x < reveal) ctx.fillRect(Math.round(bumps[b].x), GROUND_Y + bumps[b].dy, bumps[b].w, 1);
      }

      for (var i = 0; i < obstacles.length; i++) {
        var o = obstacles[i];
        for (var s = 0; s < o.size; s++) bitmap(CACTUS, o.x + s * (o.one + o.p), o.y, o.p);
      }

      var current = pad(score());
      var flashing = flashUntil > now;
      if (flashing) current = pad(lastHundred * 100);
      var showCurrent = !flashing || Math.floor((flashUntil - now) / 250) % 2 === 1;
      var scoreW = textWidth('00000', P);
      var x = cssW - 10 - scoreW;
      if (showCurrent) text(current, x, 8, P);
      if (hi > 0) {
        var hiStr = 'HI ' + pad(hi);
        ctx.globalAlpha = 0.6;
        text(hiStr, x - 20 - textWidth(hiStr, P), 8, P);
        ctx.globalAlpha = 1;
      }
    }

    drawDino();

    if (state === 'crashed') {
      var msg = 'G A M E  O V E R';
      text(msg, Math.round((cssW - textWidth(msg, P)) / 2), 42, P);
      drawRestart(Math.round(cssW / 2), 80);
    }
  }

  function frame(now) {
    raf = 0;
    if (!visible) return;
    var dt = last ? Math.min(3, (now - last) / (1000 / 60)) : 1;
    last = now;
    update(dt, now);
    draw(now);
    if (state === 'intro' || state === 'running') raf = requestAnimationFrame(frame);
  }

  function kick() {
    if (raf || !visible || document.hidden) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function scheduleBlink() {
    clearTimeout(blinkTimer);
    if (!visible) return;
    blinkTimer = setTimeout(function () {
      if (!visible) return;
      if (state === 'idle') {
        blinking = true;
        draw(performance.now());
        setTimeout(function () {
          blinking = false;
          if (visible && state === 'idle') draw(performance.now());
        }, 150);
      }
      scheduleBlink();
    }, 2500 + Math.random() * 4500);
  }

  function resize() {
    if (!canvas) return;
    var box = canvas.parentNode.clientWidth || 600;
    cssW = Math.max(200, Math.min(600, box));
    dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = H + 'px';
    try { color = getComputedStyle(canvas).color || color; } catch (e) {}
    if (state === 'running') reveal = cssW;
    if (bumps) makeBumps();
    draw(performance.now());
  }

  // ---- input ----

  function press() {
    if (!visible) return;
    var now = performance.now();
    if (state === 'idle') { begin(false, now); return; }
    if (state === 'crashed') {
      if (now - crashTime > RESTART_MS) begin(true, now);
      return;
    }
    jump();
  }

  function drop() {
    if (visible && dino && dino.jumping && (state === 'running' || state === 'intro')) {
      dino.dropping = true;
      if (dino.vy < 1) dino.vy = 1;
    }
  }

  window.addEventListener('keydown', function (e) {
    if (!visible || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!e.repeat) press();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      drop();
    }
  });
  window.addEventListener('keyup', function (e) {
    if (!visible) return;
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp') release();
  });
  window.addEventListener('resize', function () { if (visible) resize(); });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && visible && (state === 'running' || state === 'intro')) kick();
  });
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (visible) resize(); });
  } catch (e) {}

  window.DinoGame = {
    // area: the element whose taps should make the dino jump (the whole offline page)
    show: function (canvasEl, area) {
      if (canvas !== canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        area.addEventListener('pointerdown', function (e) {
          if (e.target.closest && e.target.closest('a, button')) return;
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          press();
        });
        area.addEventListener('pointerup', release);
      }
      visible = true;
      resetIdle();
      resize();
      scheduleBlink();
    },
    hide: function () {
      visible = false;
      clearTimeout(blinkTimer);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
  };
})();
