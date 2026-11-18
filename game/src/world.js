// The world: everything that exists in the arena and one tick of the
// simulation. The world owns the pellets, thorn orbs, mega orbs, blobs and
// the scoreboard; it knows nothing about the canvas or the DOM.
(function () {
  'use strict';
  var ORB = window.ORB || (window.ORB = {});
  var cfg = ORB.config;

  var PELLET_COLORS = ['#f472b6', '#facc15', '#38bdf8', '#a78bfa', '#fb923c', '#4ade80'];

  ORB.createWorld = function (rng, playerName) {
    var world = {
      rng: rng,
      time: 0,
      state: 'menu', // menu | playing | paused | over
      playerName: playerName || 'You',
      pellets: [],
      megas: [],
      spikes: [],
      blobs: [], // every blob: player pieces and bots
      bots: [], // bot brains, one per bot owner
      player: null, // { name, pieces, score, kills, eaten, peakMass, startTime }
      feed: [], // kill-feed lines {text, at}
      particles: [],
      popups: [], // floating "+12" texts {x, y, text, at, color}
      shake: 0,
      championAnnounced: false,
      stats: { eaten: 0, peakMass: 0, survivedSeconds: 0 },
    };
    return world;
  };

  function randomSpot(world, margin) {
    var m = margin || 120;
    return {
      x: world.rng.range(m, cfg.arenaSize - m),
      y: world.rng.range(m, cfg.arenaSize - m),
    };
  }

  ORB.nearestPellet = function (world, x, y, maxD) {
    var best = null;
    var bestD = maxD || Infinity;
    for (var i = 0; i < world.pellets.length; i++) {
      var p = world.pellets[i];
      var d = ORB.distance(x, y, p.x, p.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  };

  function spawnPellet(world) {
    var spot = randomSpot(world);
    world.pellets.push({
      x: spot.x, y: spot.y,
      radius: world.rng.range(4.5, 7),
      color: world.rng.pick(PELLET_COLORS),
      phase: world.rng.range(0, Math.PI * 2),
    });
  }

  function spawnMega(world) {
    var spot = randomSpot(world, 200);
    world.megas.push({
      x: spot.x, y: spot.y,
      radius: 24,
      respawnAt: 0,
      phase: world.rng.range(0, Math.PI * 2),
    });
  }

  function spawnSpike(world) {
    var spot = randomSpot(world, 220);
    world.spikes.push({ x: spot.x, y: spot.y, radius: cfg.spikeRadius, respawnAt: 0 });
  }

  function spawnBotBlob(world, bot, mass) {
    var spot = randomSpot(world, 300);
    var blob = ORB.createBlob(bot.id, spot.x, spot.y, mass, bot.name, bot.color);
    blob.bornAt = world.time;
    world.blobs.push(blob);
    return blob;
  }

  // Fill a fresh world: pellets, spikes, megas and one blob per bot.
  ORB.populateWorld = function (world) {
    for (var i = 0; i < cfg.pelletCount; i++) spawnPellet(world);
    for (var s = 0; s < cfg.spikeCount; s++) spawnSpike(world);
    for (var m = 0; m < cfg.megaOrbCount; m++) spawnMega(world);
    for (var b = 0; b < cfg.botCount; b++) {
      var bot = ORB.createBot(b, world.rng, world.time);
      world.bots.push(bot);
      var startMass = world.rng.range(18, 130);
      spawnBotBlob(world, bot, startMass);
    }
  };

  ORB.startPlayer = function (world) {
    // Spawn away from the bots: a new player gets room to breathe, plus a
    // few seconds of spawn protection (see canEat).
    var spot = randomSpot(world, 400);
    for (var tries = 0; tries < 20; tries++) {
      var clear = true;
      for (var i = 0; i < world.blobs.length; i++) {
        if (ORB.distance(spot.x, spot.y, world.blobs[i].x, world.blobs[i].y) < 500) {
          clear = false;
          break;
        }
      }
      if (clear) break;
      spot = randomSpot(world, 400);
    }
    var piece = ORB.createBlob('player', spot.x, spot.y, cfg.playerStartMass, world.playerName, cfg.playerColor);
    piece.bornAt = world.time;
    piece.spawnProtectedUntil = world.time + 4;
    world.blobs.push(piece);
    world.player = {
      name: world.playerName,
      pieces: [piece],
      score: 0,
      kills: 0,
      eaten: 0,
      peakMass: cfg.playerStartMass,
      startTime: world.time,
      combo: 0,
      comboUntil: 0,
      ejectCooldownUntil: 0,
    };
    world.stats.peakMass = cfg.playerStartMass;
  };

  ORB.playerMass = function (world) {
    if (!world.player) return 0;
    var total = 0;
    for (var i = 0; i < world.player.pieces.length; i++) total += world.player.pieces[i].mass;
    return total;
  };

  ORB.playerCenter = function (world) {
    var cx = 0;
    var cy = 0;
    var total = 0;
    var pieces = world.player ? world.player.pieces : [];
    for (var i = 0; i < pieces.length; i++) {
      cx += pieces[i].x * pieces[i].mass;
      cy += pieces[i].y * pieces[i].mass;
      total += pieces[i].mass;
    }
    if (total === 0) return { x: cfg.arenaSize / 2, y: cfg.arenaSize / 2 };
    return { x: cx / total, y: cy / total };
  };

  // The scoreboard: owners ranked by total mass, player included.
  ORB.leaderboard = function (world) {
    var byOwner = {};
    for (var i = 0; i < world.blobs.length; i++) {
      var blob = world.blobs[i];
      var row = byOwner[blob.owner];
      if (!row) {
        row = { owner: blob.owner, name: blob.name, color: blob.color, mass: 0 };
        byOwner[blob.owner] = row;
      }
      row.mass += blob.mass;
    }
    var rows = [];
    for (var key in byOwner) rows.push(byOwner[key]);
    rows.sort(function (a, b) { return b.mass - a.mass; });
    return rows;
  };

  ORB.playerRank = function (world) {
    var rows = ORB.leaderboard(world);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].owner === 'player') return i + 1;
    }
    return rows.length + 1;
  };

  function addFeed(world, text) {
    world.feed.push({ text: text, at: world.time });
    if (world.feed.length > 4) world.feed.shift();
  }

  function burst(world, x, y, color, count) {
    for (var i = 0; i < count; i++) {
      var angle = world.rng.range(0, Math.PI * 2);
      var speed = world.rng.range(40, 220);
      world.particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: world.rng.range(0.3, 0.7),
        age: 0,
        color: color,
        radius: world.rng.range(2, 5),
      });
    }
    if (world.particles.length > 260) world.particles.splice(0, world.particles.length - 260);
  }

  function popup(world, x, y, text, color) {
    world.popups.push({ x: x, y: y, text: text, at: world.time, color: color || '#ffffff' });
    if (world.popups.length > 24) world.popups.shift();
  }

  // One eating event: eater absorbs prey. The player hears it and scores.
  function eatBlob(world, eater, prey) {
    var gained = prey.mass;
    eater.mass = Math.min(cfg.maxMass, eater.mass + gained);
    ORB.refreshBlob(eater);
    burst(world, prey.x, prey.y, prey.color, 10);
    if (eater.owner === 'player') {
      var player = world.player;
      player.score += Math.round(gained);
      player.kills += 1;
      player.combo = world.time < player.comboUntil ? player.combo + 1 : 1;
      player.comboUntil = world.time + 4;
      popup(world, eater.x, eater.y - eater.radius - 8, '+' + Math.round(gained), '#4ade80');
      ORB.audio.eat(player.combo);
      addFeed(world, 'You ate ' + prey.name + ' (+' + Math.round(gained) + ')');
    } else if (prey.owner === 'player') {
      addFeed(world, prey.name + ' ate you');
    } else if (world.player) {
      addFeed(world, eater.name + ' ate ' + prey.name);
    }
    var index = world.blobs.indexOf(prey);
    if (index !== -1) world.blobs.splice(index, 1);
    if (prey.owner === 'player' && world.player) {
      var pi = world.player.pieces.indexOf(prey);
      if (pi !== -1) world.player.pieces.splice(pi, 1);
    }
  }

  // A thorn orb splits a too-big blob into small pieces and is consumed.
  function hitSpike(world, blob, spike) {
    var pieces = Math.min(8, Math.max(2, Math.floor(blob.mass / 25)));
    var each = Math.max(12, blob.mass / pieces);
    var survivors = [];
    var angle0 = world.rng.range(0, Math.PI * 2);
    for (var i = 0; i < pieces; i++) {
      var angle = angle0 + (i / pieces) * Math.PI * 2;
      var piece = ORB.createBlob(blob.owner, blob.x + Math.cos(angle) * blob.radius * 0.4,
        blob.y + Math.sin(angle) * blob.radius * 0.4, each, blob.name, blob.color);
      piece.vx = Math.cos(angle) * 320;
      piece.vy = Math.sin(angle) * 320;
      piece.bornAt = world.time;
      piece.eatCooldownUntil = world.time + 0.4;
      survivors.push(piece);
    }
    var index = world.blobs.indexOf(blob);
    if (index !== -1) world.blobs.splice(index, 1);
    if (blob.owner === 'player' && world.player) {
      var pi = world.player.pieces.indexOf(blob);
      if (pi !== -1) world.player.pieces.splice(pi, 1);
      for (var j = 0; j < survivors.length; j++) world.player.pieces.push(survivors[j]);
      ORB.audio.spike();
      addFeed(world, 'Thorn orb shattered you!');
      world.shake = 0.35;
    }
    for (var k = 0; k < survivors.length; k++) world.blobs.push(survivors[k]);
    spike.respawnAt = world.time + cfg.spikeRespawnSeconds;
    var si = world.spikes.indexOf(spike);
    if (si !== -1) world.spikes.splice(si, 1);
  }

  function respawnBot(world, bot) {
    // Bots come back a little bigger as the game goes on.
    var growth = 1 + Math.min(1.6, world.time / 240);
    var mass = world.rng.range(15, 55) * growth;
    spawnBotBlob(world, bot, mass);
  }

  // One simulation step. `steer` is the player's steering for this tick:
  // {dirX, dirY} in world space, plus split/eject requests.
  ORB.tickWorld = function (world, dt, steer) {
    world.time += dt;

    // --- Player steering ---
    if (world.player && world.state === 'playing') {
      var pieces = world.player.pieces;
      for (var p = 0; p < pieces.length; p++) {
        ORB.steerBlob(pieces[p], steer.dirX, steer.dirY, dt);
      }
      if (steer.split) {
        var fresh = [];
        for (var s = 0; s < pieces.length; s++) {
          if (world.player.pieces.length + fresh.length >= cfg.maxBlobsPerOwner) break;
          var piece = ORB.splitBlob(pieces[s], steer.dirX, steer.dirY, world.time);
          if (piece) fresh.push(piece);
        }
        if (fresh.length > 0) {
          for (var f = 0; f < fresh.length; f++) {
            world.blobs.push(fresh[f]);
            world.player.pieces.push(fresh[f]);
          }
          ORB.audio.split();
        }
      }
      if (steer.eject && world.time >= world.player.ejectCooldownUntil) {
        var mass = ORB.playerMass(world);
        if (mass >= cfg.ejectMinMass + cfg.ejectMass) {
          // Eject from the biggest piece, in the facing direction.
          var biggest = pieces[0];
          for (var b = 1; b < pieces.length; b++) {
            if (pieces[b].mass > biggest.mass) biggest = pieces[b];
          }
          biggest.mass -= cfg.ejectMass;
          ORB.refreshBlob(biggest);
          var ex = biggest.x + steer.dirX * (biggest.radius + 12);
          var ey = biggest.y + steer.dirY * (biggest.radius + 12);
          world.pellets.push({
            x: ex, y: ey,
            vx: steer.dirX * cfg.ejectSpeed + biggest.vx,
            vy: steer.dirY * cfg.ejectSpeed + biggest.vy,
            radius: 8, color: cfg.playerColor, phase: 0,
            ejected: true, ejectedBy: 'player', edibleAt: world.time + 2, bornAt: world.time,
          });
          world.player.ejectCooldownUntil = world.time + cfg.ejectCooldownSeconds;
          ORB.audio.eject();
        }
      }
    }

    // --- Bot brains ---
    for (var i = 0; i < world.bots.length; i++) {
      var bot = world.bots[i];
      var botBlobs = [];
      for (var j = 0; j < world.blobs.length; j++) {
        if (world.blobs[j].owner === bot.id) botBlobs.push(world.blobs[j]);
      }
      if (botBlobs.length === 0) {
        // Dead bot: bring it back after a short pause.
        if (!bot.deadAt) bot.deadAt = world.time;
        if (world.time - bot.deadAt >= cfg.botRespawnSeconds) {
          respawnBot(world, bot);
          bot.deadAt = 0;
        }
        continue;
      }
      bot.deadAt = 0;
      for (var k = 0; k < botBlobs.length; k++) {
        var bblob = botBlobs[k];
        var decision = ORB.botThink(bot, bblob, world, world.rng);
        ORB.steerBlob(bblob, decision.x, decision.y, dt);
        if (decision.wantSplit) {
          var count = 0;
          for (var n = 0; n < world.blobs.length; n++) {
            if (world.blobs[n].owner === bot.id) count++;
          }
          if (count < cfg.maxBlobsPerOwner) {
            var piece = ORB.splitBlob(bblob, decision.x, decision.y, world.time);
            if (piece) world.blobs.push(piece);
          }
        }
      }
    }

    // --- Move everything, decay, merge ---
    for (var m = 0; m < world.blobs.length; m++) {
      var blob = world.blobs[m];
      ORB.moveBlob(blob, dt);
      if (blob.mass > cfg.massDecayStartsAt) {
        blob.mass *= (1 - cfg.massDecayPerSecond * dt);
        ORB.refreshBlob(blob);
      }
    }
    for (var a = 0; a < world.blobs.length; a++) {
      for (var c = a + 1; c < world.blobs.length; c++) {
        if (ORB.tryMerge(world.blobs[a], world.blobs[c], world.time)) {
          var merged = world.blobs[c];
          world.blobs.splice(c, 1);
          if (merged.owner === 'player' && world.player) {
            var mi = world.player.pieces.indexOf(merged);
            if (mi !== -1) world.player.pieces.splice(mi, 1);
          }
          c--;
        }
      }
    }

    // --- Pellets: drift, friction, being eaten ---
    for (var pi2 = world.pellets.length - 1; pi2 >= 0; pi2--) {
      var pellet = world.pellets[pi2];
      if (pellet.vx || pellet.vy) {
        pellet.x += (pellet.vx || 0) * dt;
        pellet.y += (pellet.vy || 0) * dt;
        var damp = Math.max(0, 1 - cfg.ejectFriction * dt);
        pellet.vx *= damp;
        pellet.vy *= damp;
        if (Math.abs(pellet.vx) < 4) pellet.vx = 0;
        if (Math.abs(pellet.vy) < 4) pellet.vy = 0;
        pellet.x = ORB.clamp(pellet.x, cfg.arenaMargin, cfg.arenaSize - cfg.arenaMargin);
        pellet.y = ORB.clamp(pellet.y, cfg.arenaMargin, cfg.arenaSize - cfg.arenaMargin);
      }
      // An ejected pellet settles into ordinary food after a few seconds.
      if (pellet.ejected && world.time - (pellet.bornAt || 0) > 4) pellet.ejected = false;
      var eaten = false;
      for (var bi = 0; bi < world.blobs.length; bi++) {
        var eater = world.blobs[bi];
        if (pellet.ejected && pellet.ejectedBy === eater.owner && world.time < (pellet.edibleAt || 0)) continue;
        var pd = ORB.distance(eater.x, eater.y, pellet.x, pellet.y);
        if (pd < eater.radius * 0.9 + pellet.radius) {
          eater.mass = Math.min(cfg.maxMass, eater.mass + (pellet.ejected ? cfg.ejectMass : cfg.pelletMass));
          ORB.refreshBlob(eater);
          if (eater.owner === 'player' && world.player) {
            world.player.score += pellet.ejected ? cfg.ejectMass : 1;
            if (!pellet.ejected) ORB.audio.eat(1);
          }
          eaten = true;
          break;
        }
      }
      if (eaten) world.pellets.splice(pi2, 1);
    }
    while (world.pellets.length < cfg.pelletCount) spawnPellet(world);

    // --- Mega orbs ---
    for (var gi = world.megas.length - 1; gi >= 0; gi--) {
      var mega = world.megas[gi];
      for (var gj = 0; gj < world.blobs.length; gj++) {
        var mEater = world.blobs[gj];
        if (ORB.distance(mEater.x, mEater.y, mega.x, mega.y) < mEater.radius + mega.radius * 0.6) {
          mEater.mass = Math.min(cfg.maxMass, mEater.mass + cfg.megaOrbMass);
          ORB.refreshBlob(mEater);
          burst(world, mega.x, mega.y, '#facc15', 14);
          if (mEater.owner === 'player' && world.player) {
            world.player.score += cfg.megaOrbMass;
            popup(world, mEater.x, mEater.y - mEater.radius - 8, '+40 MEGA', '#facc15');
            ORB.audio.gulp();
            addFeed(world, 'You grabbed a mega orb (+40)');
          }
          mega.respawnAt = world.time + cfg.megaRespawnSeconds;
          world.megas.splice(gi, 1);
          break;
        }
      }
    }
    // Mega orbs are sparse, so top the field back up to its count.
    while (world.megas.length < cfg.megaOrbCount) spawnMega(world);

    // --- Thorn orbs ---
    for (var si2 = world.spikes.length - 1; si2 >= 0; si2--) {
      var spike = world.spikes[si2];
      for (var sj = 0; sj < world.blobs.length; sj++) {
        var sBlob = world.blobs[sj];
        if (sBlob.radius <= spike.radius) continue; // small blobs slip past
        if (ORB.distance(sBlob.x, sBlob.y, spike.x, spike.y) < sBlob.radius + spike.radius * 0.2) {
          hitSpike(world, sBlob, spike);
          break;
        }
      }
    }
    while (world.spikes.length < cfg.spikeCount) spawnSpike(world);

    // --- Blob eats blob ---
    for (var e1 = 0; e1 < world.blobs.length; e1++) {
      var eater1 = world.blobs[e1];
      if (world.time < eater1.eatCooldownUntil) continue;
      for (var e2 = 0; e2 < world.blobs.length; e2++) {
        if (e1 === e2) continue;
        var prey = world.blobs[e2];
        if (ORB.canEat(eater1, prey, world.time)) {
          eatBlob(world, eater1, prey);
          if (e2 < e1) e1--;
          e2--;
        }
      }
    }

    // --- Particles and popups age out ---
    for (var pa = world.particles.length - 1; pa >= 0; pa--) {
      var part = world.particles[pa];
      part.age += dt;
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      if (part.age >= part.life) world.particles.splice(pa, 1);
    }
    for (var po = world.popups.length - 1; po >= 0; po--) {
      if (world.time - world.popups[po].at > 1.1) world.popups.splice(po, 1);
    }
    for (var fe = world.feed.length - 1; fe >= 0; fe--) {
      if (world.time - world.feed[fe].at > 6) world.feed.splice(fe, 1);
    }
    if (world.shake > 0) world.shake = Math.max(0, world.shake - dt);

    // --- Player bookkeeping: peak mass, champion, game over ---
    if (world.player) {
      var mass = ORB.playerMass(world);
      if (mass > world.stats.peakMass) world.stats.peakMass = mass;
      if (world.player.pieces.length === 0) {
        world.stats.survivedSeconds = world.time - world.player.startTime;
        world.state = 'over';
        ORB.audio.death();
        try {
          var best = Number(window.localStorage.getItem('orb-arena-best') || 0);
          if (world.stats.peakMass > best) {
            window.localStorage.setItem('orb-arena-best', String(Math.round(world.stats.peakMass)));
          }
        } catch (err) { /* storage is a bonus, never a failure */ }
      } else if (!world.championAnnounced && ORB.playerRank(world) === 1 && mass >= 150) {
        world.championAnnounced = true;
        ORB.audio.champion();
        addFeed(world, '👑 You lead the arena!');
      }
    }
  };
})();
