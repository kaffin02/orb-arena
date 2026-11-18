// Blobs: the round bodies every player and bot is made of. One blob is one
// circle with a mass; a player or a bot owns one or more of them after a
// split. This file knows how a blob moves, eats, splits and rejoins —
// nothing about who steers it.
(function () {
  'use strict';
  var ORB = window.ORB || (window.ORB = {});
  var cfg = ORB.config;
  var nextId = 1;

  ORB.createBlob = function (owner, x, y, mass, name, color) {
    var blob = {
      id: nextId++,
      owner: owner, // 'player' or a bot id such as 'bot-3'
      name: name,
      color: color,
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      mass: mass,
      radius: ORB.blobRadius(mass),
      bornAt: 0, // world time when this piece was split off
      splitCooldownUntil: 0,
      eatCooldownUntil: 0, // briefly cannot eat right after splitting
      spawnProtectedUntil: 0, // fresh spawns cannot be eaten until this time
    };
    return blob;
  };

  ORB.refreshBlob = function (blob) {
    blob.radius = ORB.blobRadius(blob.mass);
  };

  // A blob can eat another when it is clearly bigger and the prey's centre
  // is far enough inside it. Same-owner pieces never eat each other, and a
  // freshly spawned blob is safe for a few seconds.
  ORB.canEat = function (eater, prey, now) {
    if (eater.owner === prey.owner) return false;
    if (now !== undefined && prey.spawnProtectedUntil > now) return false;
    if (eater.radius < prey.radius * cfg.eatRadiusRatio) return false;
    var d = ORB.distance(eater.x, eater.y, prey.x, prey.y);
    return d < eater.radius - prey.radius * cfg.eatOverlap;
  };

  // Steer a blob toward a unit direction at its own top speed.
  ORB.steerBlob = function (blob, dirX, dirY, dt) {
    var speed = ORB.blobSpeed(blob.radius);
    var tx = dirX * speed;
    var ty = dirY * speed;
    // Heavy blobs turn slowly; light ones snap to the pointer.
    var turn = ORB.clamp(6 - blob.radius / 60, 1.5, 6);
    var k = Math.min(1, turn * dt);
    blob.vx += (tx - blob.vx) * k;
    blob.vy += (ty - blob.vy) * k;
  };

  ORB.moveBlob = function (blob, dt) {
    blob.x += blob.vx * dt;
    blob.y += blob.vy * dt;
    var m = cfg.arenaMargin;
    var size = cfg.arenaSize;
    if (blob.x < m + blob.radius) { blob.x = m + blob.radius; blob.vx = Math.abs(blob.vx) * 0.3; }
    if (blob.x > size - m - blob.radius) { blob.x = size - m - blob.radius; blob.vx = -Math.abs(blob.vx) * 0.3; }
    if (blob.y < m + blob.radius) { blob.y = m + blob.radius; blob.vy = Math.abs(blob.vy) * 0.3; }
    if (blob.y > size - m - blob.radius) { blob.y = size - m - blob.radius; blob.vy = -Math.abs(blob.vy) * 0.3; }
  };

  // Split one blob into two halves, launched along (dirX, dirY).
  // Returns the new piece, or null when the blob is too small or on cooldown.
  ORB.splitBlob = function (blob, dirX, dirY, now) {
    if (blob.mass < cfg.splitMinMass) return null;
    if (now < blob.splitCooldownUntil) return null;
    var half = blob.mass / 2;
    blob.mass = half;
    ORB.refreshBlob(blob);
    var len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    var nx = dirX / len;
    var ny = dirY / len;
    var piece = ORB.createBlob(blob.owner, blob.x + nx * blob.radius, blob.y + ny * blob.radius, half, blob.name, blob.color);
    piece.vx = blob.vx + nx * cfg.splitLaunchSpeed;
    piece.vy = blob.vy + ny * cfg.splitLaunchSpeed;
    piece.bornAt = now;
    piece.splitCooldownUntil = now + cfg.splitCooldownSeconds;
    piece.eatCooldownUntil = now + 0.4;
    blob.splitCooldownUntil = now + cfg.splitCooldownSeconds;
    blob.bornAt = now;
    return piece;
  };

  // Two pieces of the same owner rejoin once their merge timer is over and
  // they drift back together.
  ORB.tryMerge = function (a, b, now) {
    if (a.owner !== b.owner) return false;
    if (now - a.bornAt < cfg.mergeSeconds) return false;
    if (now - b.bornAt < cfg.mergeSeconds) return false;
    var d = ORB.distance(a.x, a.y, b.x, b.y);
    if (d > (a.radius + b.radius) * 0.55) return false;
    var total = a.mass + b.mass;
    a.x = (a.x * a.mass + b.x * b.mass) / total;
    a.y = (a.y * a.mass + b.y * b.mass) / total;
    a.mass = Math.min(cfg.maxMass, total);
    ORB.refreshBlob(a);
    return true;
  };
})();
