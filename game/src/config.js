// ORB ARENA — tuning and constants.
// One clear job: every number the game balances on lives here, so tuning
// never means hunting through the simulation or the renderer.
(function () {
  'use strict';
  var ORB = window.ORB || (window.ORB = {});

  ORB.config = {
    // The arena is much bigger than the viewport; the camera follows you.
    arenaSize: 3800,
    arenaMargin: 60,

    // Food.
    pelletCount: 360, // steady-state pellets on the field
    pelletMass: 2,
    megaOrbCount: 5, // big bonus orbs
    megaOrbMass: 40,
    megaRespawnSeconds: 6,

    // Thorn orbs (spike mines): touching one while too big splits you.
    spikeCount: 14,
    spikeRadius: 46,
    spikeRespawnSeconds: 8,

    // Bots.
    botCount: 14,
    botNames: ['Nova', 'Pip', 'Momo', 'Ziggy', 'Lulu', 'Bongo',
      'Kiki', 'Rex', 'Tofu', 'Yuki', 'Milo', 'Zara'],
    botColors: ['#ff5d8f', '#ffb020', '#22d3ee', '#a78bfa', '#34d399',
      '#f97316', '#e879f9', '#f43f5e', '#84cc16', '#38bdf8',
      '#facc15', '#fb7185'],
    botRespawnSeconds: 3,

    // Player.
    playerStartMass: 25,
    playerColor: '#4ade80',
    playerOutline: '#166534',

    // Growth and movement.
    maxMass: 5000,
    massDecayPerSecond: 0.002, // fraction lost per second, only above this mass
    massDecayStartsAt: 60,
    maxBlobsPerOwner: 16,

    // Split (Space): needs this much mass, pieces rejoin after this long.
    splitMinMass: 40,
    splitCooldownSeconds: 0.6,
    mergeSeconds: 12,
    splitLaunchSpeed: 520,

    // Eject (W): one pellet of this mass, this often at most.
    ejectMass: 8,
    ejectMinMass: 24,
    ejectCooldownSeconds: 0.15,
    ejectSpeed: 460,

    // Eating: the eater must be this much bigger, radius-wise.
    eatRadiusRatio: 1.12,
    eatOverlap: 0.35, // how far inside the eater the prey's centre must be

    // Camera.
    zoomMin: 0.45,
    zoomMax: 1.3,

    // Pellets drift nowhere; ejected pellets slow down this fast.
    ejectFriction: 2.2,

    // A new champion banner only when the leader changes to you.
    championMass: 0,
  };

  // Radius grows with the square root of mass, so doubling your mass
  // makes you about 40% wider, never twice as wide.
  ORB.blobRadius = function (mass) {
    return 6 + 4.2 * Math.sqrt(Math.max(1, mass));
  };

  // Bigger blobs move slower; the smallest are the quickest.
  ORB.blobSpeed = function (radius) {
    var speed = 300 * Math.pow(27 / Math.max(10, radius), 0.45);
    return Math.max(85, Math.min(300, speed));
  };

  ORB.clamp = function (value, low, high) {
    return value < low ? low : value > high ? high : value;
  };

  ORB.distance = function (ax, ay, bx, by) {
    var dx = ax - bx;
    var dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  };
})();
