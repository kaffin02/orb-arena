// Sound effects, made only with the Web Audio API: short oscillator tones,
// no audio files, no network. The context is created on the first user
// gesture (a browser rule); before that every call is a silent no-op.
(function () {
  'use strict';
  var ORB = window.ORB || (window.ORB = {});

  var context = null;
  var muted = false;
  var master = null;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return context;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      context = new AC();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
    } catch (e) {
      context = null;
    }
    return context;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    var ctx = ensure();
    if (!ctx || !master) return;
    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var now = ctx.currentTime;
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), now + dur);
      gain.gain.setValueAtTime(vol || 0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch (e) { /* sound is decoration; never break the game */ }
  }

  ORB.audio = {
    unlock: function () { ensure(); },
    toggleMute: function () {
      muted = !muted;
      return muted;
    },
    isMuted: function () { return muted; },
    click: function () { tone(760, 0.06, 'square', 0.25); },
    // Eating: the pitch climbs with the combo, so a feeding frenzy sounds like one.
    eat: function (combo) {
      tone(280 + Math.min(combo, 12) * 36, 0.09, 'sine', 0.5, 520 + Math.min(combo, 12) * 36);
    },
    gulp: function () { tone(180, 0.16, 'triangle', 0.6, 90); },
    split: function () { tone(420, 0.12, 'square', 0.35, 140); },
    eject: function () { tone(300, 0.07, 'sine', 0.3, 200); },
    spike: function () { tone(200, 0.25, 'sawtooth', 0.4, 60); },
    death: function () {
      tone(320, 0.5, 'sawtooth', 0.4, 55);
      tone(160, 0.7, 'triangle', 0.35, 40);
    },
    champion: function () {
      var notes = [523, 659, 784, 1047];
      for (var i = 0; i < notes.length; i++) {
        (function (f, delay) {
          setTimeout(function () { tone(f, 0.22, 'triangle', 0.5); }, delay);
        })(notes[i], i * 110);
      }
    },
  };
})();
