// Rendering: everything the arena shows on the canvas — the grid, the
// food, the blobs with their names, the particles — plus the minimap.
// Menus, the HUD numbers and the leaderboard are DOM (see index.html);
// this file only paints the canvas.
(function () {
  'use strict';
  var ORB = window.ORB || (window.ORB = {});
  var cfg = ORB.config;

  ORB.createRenderer = function (canvas, minimap) {
    var ctx = canvas.getContext('2d');
    var mapCtx = minimap.getContext('2d');
    var camera = { x: cfg.arenaSize / 2, y: cfg.arenaSize / 2, zoom: 1 };
    var dpr = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = canvas.clientWidth || window.innerWidth;
      var h = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    function updateCamera(world) {
      var center = ORB.playerCenter(world);
      var maxR = 27;
      if (world.player) {
        for (var i = 0; i < world.player.pieces.length; i++) {
          maxR = Math.max(maxR, world.player.pieces[i].radius);
        }
      }
      var targetZoom = ORB.clamp(1.3 - maxR / 450, cfg.zoomMin, cfg.zoomMax);
      camera.zoom += (targetZoom - camera.zoom) * 0.08;
      camera.x += (center.x - camera.x) * 0.12;
      camera.y += (center.y - camera.y) * 0.12;
    }

    function view() {
      var w = canvas.width / dpr;
      var h = canvas.height / dpr;
      return {
        w: w, h: h,
        left: camera.x - w / 2 / camera.zoom,
        top: camera.y - h / 2 / camera.zoom,
      };
    }

    function drawBlob(blob, now) {
      var r = blob.radius;
      // Soft glow, then the body, then a darker rim, then the name.
      var glow = ctx.createRadialGradient(blob.x, blob.y, r * 0.2, blob.x, blob.y, r * 1.25);
      glow.addColorStop(0, blob.color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(blob.x, blob.y, r * 1.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = blob.color;
      ctx.beginPath();
      ctx.arc(blob.x, blob.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(2, r * 0.06);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.stroke();
      // A lighter cap, so the blob reads as a ball, not a flat disc.
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(blob.x - r * 0.25, blob.y - r * 0.3, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      // Spawn protection: a dashed ring, so a new blob's safety is visible.
      if (blob.spawnProtectedUntil > now) {
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, r + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (r >= 16) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold ' + Math.max(11, Math.round(r * 0.34)) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(blob.name, blob.x, blob.y - r * 0.08);
        ctx.font = Math.max(10, Math.round(r * 0.26)) + 'px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(Math.round(blob.mass), blob.x, blob.y + r * 0.28);
      }
    }

    function drawSpike(spike, now) {
      var r = spike.radius;
      var points = 14;
      ctx.fillStyle = '#16a34a';
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (var i = 0; i <= points * 2; i++) {
        var angle = (i / (points * 2)) * Math.PI * 2 + now * 0.15;
        var rad = i % 2 === 0 ? r : r * 0.72;
        var x = spike.x + Math.cos(angle) * rad;
        var y = spike.y + Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#bbf7d0';
      ctx.beginPath();
      ctx.arc(spike.x, spike.y, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawMinimap(world) {
      var size = minimap.width;
      var scale = size / cfg.arenaSize;
      mapCtx.clearRect(0, 0, size, size);
      mapCtx.fillStyle = 'rgba(10, 15, 30, 0.85)';
      mapCtx.fillRect(0, 0, size, size);
      mapCtx.strokeStyle = 'rgba(255,255,255,0.25)';
      mapCtx.strokeRect(0.5, 0.5, size - 1, size - 1);
      for (var i = 0; i < world.blobs.length; i++) {
        var blob = world.blobs[i];
        mapCtx.fillStyle = blob.owner === 'player' ? '#ffffff' : blob.color;
        var dot = Math.max(2, blob.radius * scale * 1.6);
        mapCtx.beginPath();
        mapCtx.arc(blob.x * scale, blob.y * scale, dot, 0, Math.PI * 2);
        mapCtx.fill();
      }
      var v = view();
      mapCtx.strokeStyle = '#ffffff';
      mapCtx.lineWidth = 1;
      mapCtx.strokeRect(v.left * scale, v.top * scale,
        (v.w / camera.zoom) * scale, (v.h / camera.zoom) * scale);
    }

    function draw(world, now) {
      resize();
      updateCamera(world);
      var w = canvas.width / dpr;
      var h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Deep-space backdrop.
      var bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#0b1026');
      bg.addColorStop(1, '#101a33');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      var v = view();
      var shakeX = 0;
      var shakeY = 0;
      if (world.shake > 0) {
        shakeX = (Math.random() - 0.5) * world.shake * 24;
        shakeY = (Math.random() - 0.5) * world.shake * 24;
      }
      ctx.save();
      ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(-camera.x, -camera.y);

      // Arena floor and grid.
      ctx.fillStyle = '#111a30';
      ctx.fillRect(0, 0, cfg.arenaSize, cfg.arenaSize);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.10)';
      ctx.lineWidth = 1;
      var step = 150;
      ctx.beginPath();
      for (var gx = 0; gx <= cfg.arenaSize; gx += step) {
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, cfg.arenaSize);
      }
      for (var gy = 0; gy <= cfg.arenaSize; gy += step) {
        ctx.moveTo(0, gy);
        ctx.lineTo(cfg.arenaSize, gy);
      }
      ctx.stroke();
      // Arena border: a bright wall you cannot cross.
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 8;
      ctx.strokeRect(0, 0, cfg.arenaSize, cfg.arenaSize);

      // Pellets, with a gentle pulse so the field feels alive.
      for (var i = 0; i < world.pellets.length; i++) {
        var pellet = world.pellets[i];
        if (pellet.x < v.left - 30 || pellet.x > v.left + v.w / camera.zoom + 30 ||
            pellet.y < v.top - 30 || pellet.y > v.top + v.h / camera.zoom + 30) continue;
        var pulse = 1 + 0.18 * Math.sin(now * 2.4 + pellet.phase);
        ctx.fillStyle = pellet.color;
        ctx.beginPath();
        ctx.arc(pellet.x, pellet.y, pellet.radius * pulse, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mega orbs: big, golden, unmissable.
      for (var m = 0; m < world.megas.length; m++) {
        var mega = world.megas[m];
        var glowR = mega.radius * (1.6 + 0.25 * Math.sin(now * 3 + mega.phase));
        var glow = ctx.createRadialGradient(mega.x, mega.y, mega.radius * 0.3, mega.x, mega.y, glowR);
        glow.addColorStop(0, 'rgba(250, 204, 21, 0.85)');
        glow.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(mega.x, mega.y, glowR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(mega.x, mega.y, mega.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#713f12';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+40', mega.x, mega.y);
      }

      // Thorn orbs.
      for (var s = 0; s < world.spikes.length; s++) drawSpike(world.spikes[s], now);

      // Blobs, smallest first so big ones draw on top.
      var sorted = world.blobs.slice().sort(function (a, b) { return a.radius - b.radius; });
      for (var b = 0; b < sorted.length; b++) drawBlob(sorted[b], world.time);

      // Particles.
      for (var p = 0; p < world.particles.length; p++) {
        var part = world.particles[p];
        ctx.globalAlpha = 1 - part.age / part.life;
        ctx.fillStyle = part.color;
        ctx.beginPath();
        ctx.arc(part.x, part.y, part.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Floating score popups.
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (var u = 0; u < world.popups.length; u++) {
        var pop = world.popups[u];
        var age = now - pop.at;
        ctx.globalAlpha = Math.max(0, 1 - age / 1.1);
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.fillText(pop.text, pop.x, pop.y - age * 34);
      }
      ctx.globalAlpha = 1;

      ctx.restore();

      drawMinimap(world);
      return { camera: camera, view: v };
    }

    return {
      draw: draw,
      resize: resize,
      camera: camera,
      screenToWorld: function (sx, sy) {
        var w = canvas.width / dpr;
        var h = canvas.height / dpr;
        return {
          x: camera.x + (sx - w / 2) / camera.zoom,
          y: camera.y + (sy - h / 2) / camera.zoom,
        };
      },
    };
  };
})();
