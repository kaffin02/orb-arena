// ORB ARENA — bootstrap, game loop and screens.
// One clear job: own the state machine (menu → playing → paused → over),
// wire the DOM to the world, and drive the animation loop. The simulation
// lives in world.js; the painting in render.js.
(function () {
  'use strict';
  var ORB = window.ORB || (window.ORB = {});
  var cfg = ORB.config;

  var canvas = document.getElementById('game');
  var minimap = document.getElementById('minimap');
  var hudMass = document.getElementById('hud-mass');
  var hudScore = document.getElementById('hud-score');
  var hudRank = document.getElementById('hud-rank');
  var hudTime = document.getElementById('hud-time');
  var board = document.getElementById('leaderboard');
  var feedEl = document.getElementById('feed');
  var bannerEl = document.getElementById('banner');
  var menuEl = document.getElementById('menu');
  var pauseEl = document.getElementById('pause');
  var overEl = document.getElementById('over');
  var nameInput = document.getElementById('player-name');
  var bestEl = document.getElementById('best-mass');

  var params = new URLSearchParams(window.location.search);
  var shot = params.get('shot');
  var seedParam = Number.parseInt(params.get('seed') || '', 10);
  var seed = Number.isInteger(seedParam) ? seedParam : (Math.floor(Math.random() * 4294967296) >>> 0);

  var rng = ORB.createRandom(seed);
  var world = ORB.createWorld(rng, 'You');
  ORB.populateWorld(world);
  var renderer = ORB.createRenderer(canvas, minimap);
  ORB.input.attachPointer(canvas);

  var lastHud = { mass: -1, score: -1, rank: -1, time: '' };
  var lastBoard = '';
  var lastFeed = '';
  var bannerUntil = 0;

  function cleanName(raw) {
    var name = String(raw || '').replace(/[<>&"']/g, '').trim().slice(0, 12);
    return name || 'You';
  }

  function bestMass() {
    try {
      return Number(window.localStorage.getItem('orb-arena-best') || 0);
    } catch (e) {
      return 0;
    }
  }

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  // The in-game chrome (HUD, leaderboard, minimap, hints) belongs to play,
  // not to the title screen: hide it behind the menu.
  var chromeEls = [
    document.getElementById('hud'),
    document.getElementById('leaderboard'),
    document.getElementById('feed'),
    document.getElementById('minimap'),
    document.querySelector('.map-label'),
    document.getElementById('hint'),
    document.getElementById('pause-btn'),
  ];
  function setChromeVisible(visible) {
    for (var i = 0; i < chromeEls.length; i++) {
      if (visible) chromeEls[i].classList.remove('hidden');
      else chromeEls[i].classList.add('hidden');
    }
  }

  function showOnly(which) {
    if (which === 'menu') { show(menuEl); hide(pauseEl); hide(overEl); setChromeVisible(false); }
    else if (which === 'pause') { hide(menuEl); show(pauseEl); hide(overEl); setChromeVisible(true); }
    else if (which === 'over') { hide(menuEl); hide(pauseEl); show(overEl); setChromeVisible(true); }
    else { hide(menuEl); hide(pauseEl); hide(overEl); setChromeVisible(true); }
  }

  function formatTime(seconds) {
    var s = Math.max(0, Math.floor(seconds));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function fillOverScreen() {
    // All pieces were eaten, so the live mass is 0: the peak is the score
    // that matters on this screen.
    document.getElementById('over-mass').textContent = String(Math.round(world.stats.peakMass));
    document.getElementById('over-time').textContent = formatTime(world.stats.survivedSeconds);
    document.getElementById('over-kills').textContent = String(world.player ? world.player.kills : 0);
    document.getElementById('over-score').textContent = String(world.player ? world.player.score : 0);
    document.getElementById('over-best').textContent = String(Math.max(bestMass(), Math.round(world.stats.peakMass)));
  }

  function startGame() {
    ORB.audio.unlock();
    ORB.audio.click();
    world.playerName = cleanName(nameInput.value);
    rng = ORB.createRandom((Math.floor(Math.random() * 4294967296)) >>> 0);
    world = ORB.createWorld(rng, world.playerName);
    ORB.populateWorld(world);
    ORB.startPlayer(world);
    world.state = 'playing';
    showOnly('none');
    snapCamera();
  }

  function restartGame() {
    startGame();
  }

  function togglePause() {
    if (world.state === 'playing') {
      world.state = 'paused';
      showOnly('pause');
      ORB.audio.click();
    } else if (world.state === 'paused') {
      world.state = 'playing';
      showOnly('none');
      ORB.audio.click();
    }
  }

  function snapCamera() {
    var c = ORB.playerCenter(world);
    var maxR = 27;
    if (world.player) {
      for (var i = 0; i < world.player.pieces.length; i++) {
        maxR = Math.max(maxR, world.player.pieces[i].radius);
      }
    }
    renderer.camera.x = c.x;
    renderer.camera.y = c.y;
    renderer.camera.zoom = ORB.clamp(1.3 - maxR / 450, cfg.zoomMin, cfg.zoomMax);
  }

  // Steering for this tick: the pointer's direction from the screen centre,
  // or WASD / arrows when the pointer is not steering. A test driver can
  // override the direction (see window.__orb.steerTo); split and eject
  // still come from the real keys.
  var testSteerOverride = null;
  function currentSteer() {
    if (testSteerOverride) {
      return {
        dirX: testSteerOverride.x,
        dirY: testSteerOverride.y,
        split: ORB.input.wasPressed('Space'),
        eject: ORB.input.wasPressed('KeyW'),
      };
    }
    var steer = ORB.input.steer();
    var dirX = 0;
    var dirY = 0;
    if (steer.fromKeys) {
      dirX = steer.x;
      dirY = steer.y;
    } else if (steer.inside) {
      var w = canvas.clientWidth || window.innerWidth;
      var h = canvas.clientHeight || window.innerHeight;
      var dx = steer.x - w / 2;
      var dy = steer.y - h / 2;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len > 12) {
        dirX = dx / len;
        dirY = dy / len;
      }
    }
    return {
      dirX: dirX,
      dirY: dirY,
      split: ORB.input.wasPressed('Space'),
      eject: ORB.input.wasPressed('KeyW'),
    };
  }

  function updateHud(now) {
    var mass = Math.round(ORB.playerMass(world));
    var score = world.player ? world.player.score : 0;
    var rank = world.state === 'playing' || world.state === 'paused' ? ORB.playerRank(world) : 0;
    var time = formatTime(world.player ? world.time - world.player.startTime : 0);
    if (mass !== lastHud.mass) { hudMass.textContent = String(mass); lastHud.mass = mass; }
    if (score !== lastHud.score) { hudScore.textContent = String(score); lastHud.score = score; }
    if (rank !== lastHud.rank) { hudRank.textContent = rank > 0 ? '#' + rank : '—'; lastHud.rank = rank; }
    if (time !== lastHud.time) { hudTime.textContent = time; lastHud.time = time; }

    // Leaderboard, refreshed a few times a second.
    var rows = ORB.leaderboard(world).slice(0, 10);
    var html = '<div class="board-title">LEADERBOARD</div>';
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var me = row.owner === 'player' ? ' me' : '';
      var crown = i === 0 ? ' 👑' : '';
      html += '<div class="board-row' + me + '"><span class="board-rank">' + (i + 1) + '</span>' +
        '<span class="board-dot" style="background:' + row.color + '"></span>' +
        '<span class="board-name">' + row.name + crown + '</span>' +
        '<span class="board-mass">' + Math.round(row.mass) + '</span></div>';
    }
    if (html !== lastBoard) { board.innerHTML = html; lastBoard = html; }

    var feedHtml = '';
    for (var f = 0; f < world.feed.length; f++) feedHtml += '<div>' + world.feed[f].text + '</div>';
    if (feedHtml !== lastFeed) { feedEl.innerHTML = feedHtml; lastFeed = feedHtml; }

    if (world.championAnnounced && now < bannerUntil) {
      show(bannerEl);
    } else {
      hide(bannerEl);
    }
  }

  var lastTime = 0;
  var wasChampion = false;
  function loop(timestamp) {
    requestAnimationFrame(loop);
    var now = timestamp / 1000;
    var dt = lastTime ? Math.min(now - lastTime, 1 / 30) : 1 / 60;
    lastTime = now;

    if (world.state === 'menu') {
      // Attract mode: bots drift behind the title screen.
      ORB.tickWorld(world, dt, { dirX: 0, dirY: 0, split: false, eject: false });
    } else if (world.state === 'playing') {
      ORB.tickWorld(world, dt, currentSteer());
      if (world.state === 'over') {
        fillOverScreen();
        showOnly('over');
      }
    }

    if (world.championAnnounced && !wasChampion) {
      bannerUntil = now + 4;
      bannerEl.textContent = '👑 ARENA CHAMPION — you lead the board!';
    }
    wasChampion = world.championAnnounced;

    renderer.draw(world, now);
    updateHud(now);

    if (ORB.input.wasPressed('KeyP') || ORB.input.wasPressed('Escape')) togglePause();
    if (ORB.input.wasPressed('KeyM')) {
      var muted = ORB.audio.toggleMute();
      document.getElementById('mute-btn').textContent = muted ? '🔇 Sound off' : '🔊 Sound on';
    }
    if (ORB.input.wasPressed('KeyR') && world.state === 'over') restartGame();
    if (ORB.input.wasPressed('Enter') && world.state === 'menu') startGame();

    // Clear one-shot presses last, so every reader above saw this tick's.
    ORB.input.endTick();
  }

  // Buttons.
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('resume-btn').addEventListener('click', togglePause);
  document.getElementById('restart-btn').addEventListener('click', restartGame);
  document.getElementById('restart-btn-2').addEventListener('click', restartGame);
  document.getElementById('pause-btn').addEventListener('click', togglePause);
  document.getElementById('mute-btn').addEventListener('click', function () {
    var muted = ORB.audio.toggleMute();
    document.getElementById('mute-btn').textContent = muted ? '🔇 Sound off' : '🔊 Sound on';
  });
  nameInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') startGame();
    event.stopPropagation();
  });

  // The handle the playtest drives: state, actions, and a forced death.
  window.__orb = {
    world: function () { return world; },
    state: function () { return world.state; },
    playerMass: function () { return ORB.playerMass(world); },
    playerPieces: function () { return world.player ? world.player.pieces.length : 0; },
    blobCount: function () { return world.blobs.length; },
    rank: function () { return ORB.playerRank(world); },
    start: startGame,
    restart: restartGame,
    pause: togglePause,
    steerTo: function (x, y) { testSteerOverride = { x: x, y: y }; },
    clearSteer: function () { testSteerOverride = null; },
    die: function () {
      if (!world.player) return;
      for (var i = world.blobs.length - 1; i >= 0; i--) {
        if (world.blobs[i].owner === 'player') world.blobs.splice(i, 1);
      }
      world.player.pieces = [];
    },
  };

  bestEl.textContent = String(bestMass());

  if (shot === 'start') {
    // Title screen over a living arena: paint twice, then signal ready.
    showOnly('menu');
    renderer.draw(world, 12.5);
    renderer.draw(world, 12.5);
    window.__shotReady = true;
  } else if (shot === 'play' || shot === 'split' || shot === 'end') {
    ORB.stageShot(shot, seed, world, renderer, function () {
      renderer.draw(world, 12.5);
    }, function () {
      if (world.state === 'over') {
        fillOverScreen();
        showOnly('over');
      } else {
        showOnly('none');
      }
      // The HUD, leaderboard and feed are DOM, not canvas: refresh them
      // from the staged world, or they would show the pre-game values.
      updateHud(12.5);
    });
  } else {
    showOnly('menu');
    requestAnimationFrame(loop);
  }
})();
