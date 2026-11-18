// A small seeded random number generator (mulberry32): the same seed gives
// the same game, which is what makes the screenshot scenes repeatable.
(function () {
  'use strict';
  var ORB = window.ORB || (window.ORB = {});

  ORB.createRandom = function (seed) {
    var a = seed >>> 0;
    function next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next: next,
      range: function (low, high) { return low + (high - low) * next(); },
      int: function (low, high) { return Math.floor(low + (high - low + 1) * next()); },
      pick: function (items) { return items[Math.floor(next() * items.length)]; },
      chance: function (p) { return next() < p; },
    };
  };
})();
