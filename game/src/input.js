// Keyboard and pointer input. Held keys and the pointer give a steering
// direction; one-shot presses (split, eject, pause, restart) are consumed
// once by the game loop, so holding Space never splits twice a frame.
(function () {
  'use strict';
  var ORB = window.ORB || (window.ORB = {});

  var keys = {};
  var pressed = {};
  var pointer = { x: 0, y: 0, inside: false, down: false };

  function codeOf(event) {
    return event.code || event.key || '';
  }

  window.addEventListener('keydown', function (event) {
    var code = codeOf(event);
    if (code === 'Space' || code === 'ArrowUp' || code === 'ArrowDown' ||
        code === 'ArrowLeft' || code === 'ArrowRight') {
      event.preventDefault();
    }
    if (!keys[code]) pressed[code] = true;
    keys[code] = true;
  });
  window.addEventListener('keyup', function (event) {
    keys[codeOf(event)] = false;
  });
  window.addEventListener('blur', function () {
    keys = {};
  });

  ORB.input = {
    attachPointer: function (element) {
      element.addEventListener('pointermove', function (event) {
        var rect = element.getBoundingClientRect();
        pointer.x = event.clientX - rect.left;
        pointer.y = event.clientY - rect.top;
        pointer.inside = true;
      });
      element.addEventListener('pointerdown', function (event) {
        var rect = element.getBoundingClientRect();
        pointer.x = event.clientX - rect.left;
        pointer.y = event.clientY - rect.top;
        pointer.inside = true;
        pointer.down = true;
      });
      element.addEventListener('pointerup', function () { pointer.down = false; });
      element.addEventListener('pointerleave', function () { pointer.inside = false; });
    },
    // Steering: the pointer when it is over the canvas, else WASD / arrows.
    steer: function () {
      var dx = 0;
      var dy = 0;
      if (keys.KeyW || keys.ArrowUp) dy -= 1;
      if (keys.KeyS || keys.ArrowDown) dy += 1;
      if (keys.KeyA || keys.ArrowLeft) dx -= 1;
      if (keys.KeyD || keys.ArrowRight) dx += 1;
      if (dx !== 0 || dy !== 0) {
        var len = Math.sqrt(dx * dx + dy * dy);
        return { x: dx / len, y: dy / len, fromKeys: true };
      }
      return { x: pointer.x, y: pointer.y, fromKeys: false, inside: pointer.inside };
    },
    pointer: pointer,
    held: function (code) { return !!keys[code]; },
    // True once per physical press; the game loop clears it every tick.
    wasPressed: function (code) { return !!pressed[code]; },
    endTick: function () { pressed = {}; },
  };
})();
