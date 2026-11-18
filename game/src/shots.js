// The screenshot scenes behind ?shot=start|play|split|end. Each one plays
// the real rules forward from a seeded world, so the frame is what a short
// game really looks like — and the same seed always gives the same frame.
// The scene paints twice, then sets window.__shotReady for the screenshot.
(function () {
  'use strict';
  var ORB = window.ORB || (window.ORB = {});

  // A scripted player for the staged scenes: chase the nearest pellet,
  // flee a bigger blob that gets close, and split when a meal is in reach.
  function autopilot(world, dt) {
    var player = world.player;
    if (!player || player.pieces.length === 0) return { dirX: 1, dirY: 0, split: false, eject: false };
    var me = player.pieces[0];
    for (var i = 1; i < player.pieces.length; i++) {
      if (player.pieces[i].mass > me.mass) me = player.pieces[i];
    }
    var dx = 0;
    var dy = 0;
    var threat = null;
    var threatD = Infinity;
    for (var b = 0; b < world.blobs.length; b++) {
      var other = world.blobs[b];
      if (other.owner === 'player') continue;
      var d = ORB.distance(me.x, me.y, other.x, other.y);
      if (other.radius > me.radius * 1.12 && d < 520 && d < threatD) {
        threat = other;
        threatD = d;
      }
    }
    if (threat) {
      dx = me.x - threat.x;
      dy = me.y - threat.y;
    } else {
      var pellet = ORB.nearestPellet(world, me.x, me.y, 900);
      if (pellet) {
        dx = pellet.x - me.x;
        dy = pellet.y - me.y;
      } else {
        dx = Math.cos(world.time * 0.3);
        dy = Math.sin(world.time * 0.3);
      }
    }
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var split = false;
    if (!threat && me.mass >= 90) {
      for (var p = 0; p < world.blobs.length; p++) {
        var prey = world.blobs[p];
        if (prey.owner === 'player') continue;
        var pd = ORB.distance(me.x, me.y, prey.x, prey.y);
        if (ORB.blobRadius(me.mass / 2) > prey.radius * 1.12 && pd < 320) {
          split = true;
          break;
        }
      }
    }
    return { dirX: dx / len, dirY: dy / len, split: split, eject: false };
  }

  function runSim(world, seconds, driver) {
    var steps = Math.round(seconds * 60);
    var dt = 1 / 60;
    for (var i = 0; i < steps; i++) {
      if (world.state !== 'playing') break;
      ORB.tickWorld(world, dt, driver(world, dt));
    }
  }

  // Stage one scene. `paint` draws the frame, `done` fires when it is ready.
  ORB.stageShot = function (kind, seed, world, renderer, paint, done) {
    var rng = ORB.createRandom(seed);
    var fresh = ORB.createWorld(rng, 'You');
    ORB.populateWorld(fresh);
    ORB.startPlayer(fresh);
    fresh.state = 'playing';

    if (kind === 'play') {
      runSim(fresh, 35, autopilot);
    } else if (kind === 'split') {
      // Grow the player first, then split at the prey: the shot catches
      // the two fresh halves mid-chase.
      runSim(fresh, 40, autopilot);
      var pieces = fresh.player.pieces;
      if (pieces.length > 0) {
        var me = pieces[0];
        me.mass = Math.max(me.mass, 240);
        ORB.refreshBlob(me);
        var dir = autopilot(fresh, 1 / 60);
        var halves = [];
        for (var i = 0; i < pieces.length; i++) {
          var piece = ORB.splitBlob(pieces[i], dir.dirX, dir.dirY, fresh.time);
          if (piece) halves.push(piece);
        }
        for (var j = 0; j < halves.length; j++) {
          fresh.blobs.push(halves[j]);
          fresh.player.pieces.push(halves[j]);
        }
      }
      runSim(fresh, 2.5, autopilot);
    } else if (kind === 'end') {
      runSim(fresh, 45, autopilot);
      // A giant bot swallows the player whole: the game-over screen.
      var center = ORB.playerCenter(fresh);
      var giant = ORB.createBlob('bot-giant', center.x, center.y, 4000, 'Zara', '#f43f5e');
      fresh.blobs.push(giant);
      var guard = 0;
      while (fresh.state === 'playing' && guard < 600) {
        ORB.tickWorld(fresh, 1 / 60, { dirX: 0, dirY: 0, split: false, eject: false });
        guard++;
      }
    }

    // Copy the staged world into the live one the renderer paints.
    world.pellets = fresh.pellets;
    world.megas = fresh.megas;
    world.spikes = fresh.spikes;
    world.blobs = fresh.blobs;
    world.bots = fresh.bots;
    world.player = fresh.player;
    world.feed = fresh.feed;
    world.particles = fresh.particles;
    world.popups = fresh.popups;
    world.time = fresh.time;
    world.state = fresh.state;
    world.stats = fresh.stats;
    world.championAnnounced = fresh.championAnnounced;
    world.rng = fresh.rng;

    // Frame the shot on the player — or on whatever ate them, for the end.
    var focus = ORB.playerCenter(fresh);
    var maxR = 27;
    if (fresh.player) {
      for (var fi = 0; fi < fresh.player.pieces.length; fi++) {
        maxR = Math.max(maxR, fresh.player.pieces[fi].radius);
      }
    }
    if (!fresh.player || fresh.player.pieces.length === 0) {
      var biggest = null;
      for (var bi = 0; bi < fresh.blobs.length; bi++) {
        if (!biggest || fresh.blobs[bi].radius > biggest.radius) biggest = fresh.blobs[bi];
      }
      if (biggest) focus = { x: biggest.x, y: biggest.y };
    }
    renderer.camera.x = focus.x;
    renderer.camera.y = focus.y;
    renderer.camera.zoom = ORB.clamp(1.3 - maxR / 450, ORB.config.zoomMin, ORB.config.zoomMax);

    paint();
    paint();
    window.__shotReady = true;
    if (done) done();
  };
})();
