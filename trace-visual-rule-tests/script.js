// TRACE — Visual Rule Tests
// Shared geometry/projection helpers, then four independent tests.
// Each test isolates exactly one rule from the System Identity Proposal.

(function () {
  'use strict';

  // ---------- shared helpers ----------

  var PHI = (1 + Math.sqrt(5)) / 2;
  var RAW_V = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]
  ];
  var FACE_IDX = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
  ];
  var BASE_R = Math.sqrt(1 + PHI * PHI);

  function makeSigil(radius, jitterRange) {
    // Law 1: one rule (icosahedron + bounded jitter) generates a fixed instance.
    var verts = RAW_V.map(function (v) {
      var jitter = 1 + (Math.random() * 2 - 1) * jitterRange;
      var s = (radius / BASE_R) * jitter;
      return { x: v[0] * s, y: v[1] * s, z: v[2] * s };
    });
    return { verts: verts, faces: FACE_IDX };
  }

  function normalize(v) {
    var l = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    return { x: v.x / l, y: v.y / l, z: v.z / l };
  }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
  function cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function rotateYP(p, yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var x1 = p.x * cy + p.z * sy;
    var z1 = -p.x * sy + p.z * cy;
    var y1 = p.y;
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    return { x: x1, y: y1 * cp - z1 * sp, z: y1 * sp + z1 * cp };
  }
  function project(p, cx, cy, focal) {
    var scale = focal / (focal + p.z);
    return { x: cx + p.x * scale, y: cy - p.y * scale, scale: scale, z: p.z };
  }

  var LIGHT = normalize({ x: 0.35, y: 0.9, z: 0.5 });
  var BASE_COL = [96, 100, 104];

  function drawSigil(ctx, sigil, yaw, pitch, cx, cy, focal, fogFn) {
    for (var f = 0; f < sigil.faces.length; f++) {
      var fi = sigil.faces[f];
      var v0 = rotateYP(sigil.verts[fi[0]], yaw, pitch);
      var v1 = rotateYP(sigil.verts[fi[1]], yaw, pitch);
      var v2 = rotateYP(sigil.verts[fi[2]], yaw, pitch);
      var n = cross(sub(v1, v0), sub(v2, v0));
      if (n.z <= 0) continue; // backface cull; convex solid needs no depth sort
      var nn = normalize(n);
      var bright = clamp(dot(nn, LIGHT) + 0.2, 0.35, 1.1);
      var p0 = project(v0, cx, cy, focal);
      var p1 = project(v1, cx, cy, focal);
      var p2 = project(v2, cx, cy, focal);
      var col = [BASE_COL[0] * bright, BASE_COL[1] * bright, BASE_COL[2] * bright];
      if (fogFn) col = fogFn(col, (v0.z + v1.z + v2.z) / 3);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.closePath();
      ctx.fillStyle = 'rgb(' + col.map(function (c) { return Math.round(c); }).join(',') + ')';
      ctx.fill();
    }
  }

  var RATIOS = {}; // canvas.id -> intrinsic aspect ratio, captured once before any resize

  function fitCanvas(canvas) {
    // keeps the drawing buffer matched to the CSS width so lines stay crisp
    if (!RATIOS[canvas.id]) RATIOS[canvas.id] = canvas.width / canvas.height;
    var ratio = RATIOS[canvas.id];
    var cssWidth = canvas.clientWidth || canvas.width;
    canvas.width = cssWidth;
    canvas.height = cssWidth / ratio;
    return canvas.getContext('2d');
  }

  var resizeTargets = [];
  function onResize() {
    for (var i = 0; i < resizeTargets.length; i++) fitCanvas(resizeTargets[i]);
  }
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(onResize, 120);
  });

  // ---------- Live conditions ----------
  // Not one of the four graded tests. A visible drag-to-color control, seeded
  // from a real ambient reading. This is the honest version of "reacts to
  // temperature": a browser page cannot read a visitor's CPU temperature,
  // there is no web API for that, so ambient weather is the real input.
  (function liveConditions() {
    var slider = document.getElementById('live-temp');
    var out = document.getElementById('live-temp-out');
    var swatch = document.getElementById('live-swatch');
    if (!slider) return;

    function colormap(u) {
      u = clamp(u, 0, 1);
      var stops = [[30, 40, 180], [30, 180, 220], [60, 200, 80], [230, 210, 40], [220, 60, 40]];
      var seg = u * 4, i = Math.min(3, Math.floor(seg)), f = seg - i;
      var a = stops[i], b = stops[i + 1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    }

    function render() {
      var t = parseInt(slider.value, 10);
      out.textContent = t;
      var col = colormap((t - 40) / (120 - 40));
      swatch.style.background = 'rgb(' + col.map(function (c) { return Math.round(c); }).join(',') + ')';
    }
    slider.addEventListener('input', render);
    render();

    // seeds the slider from a real reading; dragging freely overrides it after that
    fetch('https://api.open-meteo.com/v1/forecast?latitude=33.4484&longitude=-112.0740&current=temperature_2m&temperature_unit=fahrenheit')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.current && typeof data.current.temperature_2m === 'number') {
          slider.value = Math.round(data.current.temperature_2m);
          render();
        }
      })
      .catch(function () { /* keep the default value; the slider still works fully by hand */ });
  })();

  // ---------- Test 1: Sigil Seed ----------
  // One rule, run again on click, produces a repeatable family of forms.
  (function test1() {
    var canvas = document.getElementById('canvas-1');
    var ctx = fitCanvas(canvas);
    resizeTargets.push(canvas);
    var sigil = makeSigil(70, 0.15);
    var yaw = 0.5, pitch = -0.25;

    function regenerate() {
      sigil = makeSigil(70, 0.15); // re-run the same rule, new instance
    }
    canvas.addEventListener('click', regenerate);
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('role', 'button');
    canvas.setAttribute('aria-label', 'Sigil seed. Press enter to generate a new instance from the same rule.');
    canvas.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); regenerate(); }
    });

    function draw() {
      var cx = canvas.width / 2, cy = canvas.height / 2;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      yaw += 0.004;
      drawSigil(ctx, sigil, yaw, pitch, cx, cy, canvas.width * 0.9);
      requestAnimationFrame(draw);
    }
    draw();
  })();

  // ---------- Test 2: Behavior Rule ----------
  // Deflection around a fixed obstacle, force increasing row by row.
  (function test2() {
    var canvas = document.getElementById('canvas-2');
    var ctx = fitCanvas(canvas);
    resizeTargets.push(canvas);
    canvas.setAttribute('aria-label', 'Behavior rule. Particles in six rows deflect around a fixed circle, deflection force increasing from the top row to the bottom row.');
    var ROWS = 6;
    var PER_ROW = 14;
    var particles = [];

    function spawnRow(row) {
      var list = [];
      for (var i = 0; i < PER_ROW; i++) {
        // each particle keeps one fixed lane for its whole life, so it never
        // wobbles between sides right at the edge of the obstacle's influence
        list.push({ x: -40 - i * 30, offset: 0, lane: i % 2 === 0 ? 1 : -1 });
      }
      return list;
    }
    for (var r = 0; r < ROWS; r++) particles.push(spawnRow(r));

    function draw() {
      var w = canvas.width, h = canvas.height;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, w, h);

      var obstacleX = w * 0.55;
      var obstacleR = Math.min(w, h) * 0.09;
      var rowGap = h / (ROWS + 1);

      ctx.strokeStyle = 'rgba(232,246,243,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(obstacleX, h / 2, obstacleR, 0, Math.PI * 2);
      ctx.stroke();

      for (var r = 0; r < ROWS; r++) {
        var rowY = rowGap * (r + 1);
        // rule: same deflection law, force increases row by row
        var strength = 0.15 + (r / (ROWS - 1)) * 1.35;
        var floorPush = 0.08; // minimum deflection so even row 0 stays visibly a rule, not a bug
        for (var i = 0; i < particles[r].length; i++) {
          var p = particles[r][i];
          p.x += 1.1;
          if (p.x > w + 40) p.x = -40;
          var dx = p.x - obstacleX;
          var dist = Math.abs(dx);
          var influence = clamp(1 - dist / (obstacleR * 3.2), 0, 1);
          var push = (influence * strength) + (influence > 0 ? floorPush * influence : 0);
          p.offset += (push * p.lane - p.offset) * 0.15;

          var y = rowY + p.offset * (obstacleR * 1.4);
          ctx.fillStyle = 'rgba(232,246,243,0.85)';
          ctx.beginPath();
          ctx.arc(p.x, y, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      requestAnimationFrame(draw);
    }
    draw();
  })();

  // ---------- Test 3: Gesture Language ----------
  // Horizontal drag maps to exactly one parameter: yaw. Nothing moves on its own.
  (function test3() {
    var canvas = document.getElementById('canvas-3');
    var ctx = fitCanvas(canvas);
    resizeTargets.push(canvas);
    canvas.setAttribute('aria-label', 'Gesture language. Drag left or right to rotate the sigil. It holds still until touched.');
    var sigil = makeSigil(70, 0.15);
    var yaw = 0.6;
    var pitch = -0.15; // fixed, never touched by input
    var dragging = false, lastX = null;

    function toLocalX(e) {
      var rect = canvas.getBoundingClientRect();
      var ev = e.touches ? e.touches[0] : e;
      return (ev.clientX - rect.left) * (canvas.width / rect.width);
    }
    canvas.addEventListener('mousedown', function (e) { dragging = true; lastX = toLocalX(e); });
    window.addEventListener('mouseup', function () { dragging = false; lastX = null; });
    canvas.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var x = toLocalX(e);
      yaw += (x - lastX) * 0.01; // the one parameter this gesture controls
      lastX = x;
    });
    canvas.addEventListener('touchstart', function (e) { dragging = true; lastX = toLocalX(e); }, { passive: true });
    canvas.addEventListener('touchmove', function (e) {
      var x = toLocalX(e);
      yaw += (x - lastX) * 0.01;
      lastX = x;
    }, { passive: true });
    window.addEventListener('touchend', function () { dragging = false; lastX = null; });

    function draw() {
      var cx = canvas.width / 2, cy = canvas.height / 2;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawSigil(ctx, sigil, yaw, pitch, cx, cy, canvas.width * 0.9);
      requestAnimationFrame(draw);
    }
    draw();
  })();

  // ---------- Test 4: Atmosphere Constraint ----------
  // Depth fog: color blends toward the background by real z-distance. No painted vignette.
  (function test4() {
    var canvas = document.getElementById('canvas-4');
    var ctx = fitCanvas(canvas);
    resizeTargets.push(canvas);
    canvas.setAttribute('aria-label', 'Atmosphere constraint. An orbiting sigil and streamline particles fade toward the background with distance from the camera.');
    var toggle = document.getElementById('fog-toggle');
    var sigil = makeSigil(55, 0.15);
    var yaw = 0.6, pitch = -0.3;

    var N = 60;
    var particles = [];
    function spawn(p) {
      var a = Math.random() * Math.PI * 2, r = Math.random() * 90;
      p.x = -140; p.y = Math.cos(a) * r; p.z = Math.sin(a) * r;
    }
    for (var i = 0; i < N; i++) {
      var p = { x: 0, y: 0, z: 0 };
      spawn(p);
      p.x = -140 + Math.random() * 280;
      particles.push(p);
    }

    var BG = [10, 10, 10];
    function fog(col, depth) {
      if (!toggle.checked) return col;
      // depth is view-space z after rotation; further from camera = more background blend
      var t = clamp((depth + 60) / 260, 0, 1);
      return [
        col[0] + (BG[0] - col[0]) * t,
        col[1] + (BG[1] - col[1]) * t,
        col[2] + (BG[2] - col[2]) * t
      ];
    }

    function draw() {
      var w = canvas.width, h = canvas.height;
      var cx = w / 2, cy = h / 2, focal = w * 0.9;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, w, h);
      yaw += 0.003;

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += 0.9;
        if (p.x > 140) spawn(p);
        var v = rotateYP({ x: p.x, y: p.y, z: p.z }, yaw, pitch);
        var pr = project(v, cx, cy, focal);
        var col = fog([120, 170, 190], v.z);
        ctx.fillStyle = 'rgb(' + col.map(function (c) { return Math.round(c); }).join(',') + ')';
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      drawSigil(ctx, sigil, yaw, pitch, cx, cy, focal, fog);
      requestAnimationFrame(draw);
    }
    draw();
  })();

})();
