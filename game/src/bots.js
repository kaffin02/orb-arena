// Bot brains: every AI blob thinks with the same rules — chase what is
// smaller, flee what is bigger, dodge thorn orbs while big, and split only
// when the piece it launches could actually eat its prey. Each bot also
// gets a temperament (bold, cautious, greedy) that bends those rules.
(function () {
  'use strict';
  var ORB = window.ORB || (window.ORB = {});
  var cfg = ORB.config;

  var TEMPERAMENTS = ['bold', 'cautious', 'greedy'];

  ORB.createBot = function (index, rng, time) {
    var name = cfg.botNames[index % cfg.botNames.length];
    var color = cfg.botColors[index % cfg.botColors.length];
    return {
      id: 'bot-' + index,
      name: name,
      color: color,
      temperament: TEMPERAMENTS[index % TEMPERAMENTS.length],
      thinkAt: 0, // next world time to re-pick a target
      targetX: 0,
      targetY: 0,
      wanderAngle: rng.range(0, Math.PI * 2),
      splitAt: 0,
      bornAt: time,
    };
  };

  // Pick a steering target for one bot blob. Returns {x, y, wantSplit}.
  ORB.botThink = function (bot, blob, world, rng) {
    var now = world.time;
    var sense = 620 + blob.radius * 2;
    var best = null;
    var bestScore = Infinity;
    var threatX = 0;
    var threatY = 0;
    var threatWeight = 0;

    for (var i = 0; i < world.blobs.length; i++) {
      var other = world.blobs[i];
      if (other === blob || other.owner === blob.owner) continue;
      var d = ORB.distance(blob.x, blob.y, other.x, other.y);
      if (d > sense * 1.5) continue;
      // A freshly spawned blob is safe: not prey, not worth chasing.
      if (other.spawnProtectedUntil > now) continue;
      if (other.radius > blob.radius * cfg.eatRadiusRatio && d < sense) {
        // A bigger blob nearby: run away, harder the closer it is.
        var w = (sense - d) / sense;
        threatX += (blob.x - other.x) / (d || 1) * w;
        threatY += (blob.y - other.y) / (d || 1) * w;
        threatWeight += w;
      } else if (blob.radius > other.radius * cfg.eatRadiusRatio && d < sense * 1.4) {
        // Smaller prey: chase the best meal (big mass, close by).
        var score = d / Math.max(10, other.mass);
        if (score < bestScore) {
          bestScore = score;
          best = other;
        }
      }
    }

    var bold = bot.temperament === 'bold' ? 1.35 : bot.temperament === 'cautious' ? 0.6 : 1;
    if (threatWeight > 0.25 && threatWeight * (bot.temperament === 'cautious' ? 1.6 : 1) > 0.3) {
      // Flee, and keep a little distance from the wall while doing it.
      var fx = threatX;
      var fy = threatY;
      var fl = Math.sqrt(fx * fx + fy * fy) || 1;
      return { x: fx / fl, y: fy / fl, wantSplit: false };
    }

    if (best && now >= bot.thinkAt) {
      bot.targetX = best.x;
      bot.targetY = best.y;
      bot.thinkAt = now + 0.25;
    }

    var tx;
    var ty;
    if (best) {
      tx = bot.targetX - blob.x;
      ty = bot.targetY - blob.y;
    } else {
      // No prey in reach: drift to the nearest pellet, or just wander.
      var pellet = ORB.nearestPellet(world, blob.x, blob.y, 500);
      if (pellet) {
        tx = pellet.x - blob.x;
        ty = pellet.y - blob.y;
      } else {
        bot.wanderAngle += rng.range(-0.4, 0.4);
        tx = Math.cos(bot.wanderAngle);
        ty = Math.sin(bot.wanderAngle);
      }
    }

    // Big blobs give thorn orbs a wide berth.
    if (blob.radius > cfg.spikeRadius) {
      for (var s = 0; s < world.spikes.length; s++) {
        var spike = world.spikes[s];
        var sd = ORB.distance(blob.x, blob.y, spike.x, spike.y);
        if (sd < blob.radius + cfg.spikeRadius + 60) {
          var push = (blob.radius + cfg.spikeRadius + 60 - sd) / 60;
          tx += (blob.x - spike.x) / (sd || 1) * push * 2;
          ty += (blob.y - spike.y) / (sd || 1) * push * 2;
        }
      }
    }

    var len = Math.sqrt(tx * tx + ty * ty) || 1;
    var wantSplit = false;
    if (best && blob.mass >= cfg.splitMinMass * 2 && now >= bot.splitAt) {
      // Split only when the launched half could eat the prey outright.
      var halfRadius = ORB.blobRadius(blob.mass / 2);
      var preyD = ORB.distance(blob.x, blob.y, best.x, best.y);
      if (halfRadius > best.radius * cfg.eatRadiusRatio && preyD < 380 * bold) {
        wantSplit = true;
        bot.splitAt = now + 2.5;
      }
    }
    return { x: tx / len, y: ty / len, wantSplit: wantSplit };
  };
})();
