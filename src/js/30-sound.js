/* ==================================================================== SOUND
   Every sound is synthesized live with the Web Audio API, so the app ships no
   audio files and works offline. Check-offs climb a pentatonic scale over the
   course of a day: the more you finish, the higher it rings. */

const HOLD_MS = 950;

const Sound = (() => {
  const PACKS = {
    kristall: { label: 'Kristall', root: 76 },
    holz: { label: 'Holz', root: 67 },
    arcade: { label: 'Arcade', root: 72 },
  };
  const SCALE = [0, 2, 4, 7, 9];

  let ctx = null;
  let out = null;
  let verb = null;
  let noiseBuf = null;

  const m2f = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const gainFor = () => Math.pow(clamp(L.volume, 0, 1), 1.4);

  function ensure() {
    if (!L.sound) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC({ latencyHint: 'interactive' });
      } catch {
        return null;
      }
      // A hard limiter only: quiet clicks pass untouched, big fanfares can't distort.
      const limiter = ctx.createDynamicsCompressor();
      limiter.knee.value = 0;
      limiter.threshold.value = -3;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.12;
      out = ctx.createGain();
      out.gain.value = gainFor();
      out.connect(limiter);
      limiter.connect(ctx.destination);

      verb = ctx.createConvolver();
      verb.buffer = impulse(1.7, 2.8);
      const wet = ctx.createGain();
      wet.gain.value = 0.26;
      verb.connect(wet);
      wet.connect(out);

      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function impulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        last = last * 0.55 + white * 0.45; // darker tail
        d[i] = last;
      }
    }
    return buf;
  }

  const wire = (node, send) => {
    node.connect(out);
    if (send) {
      const s = ctx.createGain();
      s.gain.value = send;
      node.connect(s);
      s.connect(verb);
    }
  };
  const envelope = (g, t, attack, decay, v) => {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(v * 0.002, 0.0001), t + attack + decay);
  };

  function tone(type, f, t, dur, v, { to, send = 0.3, detune = 0, attack = 0.003 } = {}) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.85);
    envelope(g, t, attack, dur, v);
    o.connect(g);
    wire(g, send);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  /** FM bell: a sine whose pitch is wobbled by a second, inharmonic sine. */
  function bell(f, t, dur = 1.2, v = 0.2, ratio = 3.01, index = 2) {
    const c = ctx.createOscillator();
    const m = ctx.createOscillator();
    const mg = ctx.createGain();
    const g = ctx.createGain();
    c.frequency.value = f;
    m.frequency.value = f * ratio;
    mg.gain.setValueAtTime(f * index, t);
    mg.gain.exponentialRampToValueAtTime(Math.max(f * 0.02, 0.01), t + dur * 0.55);
    m.connect(mg);
    mg.connect(c.frequency);
    envelope(g, t, 0.002, dur, v);
    c.connect(g);
    wire(g, 0.55);
    c.start(t);
    m.start(t);
    c.stop(t + dur + 0.1);
    m.stop(t + dur + 0.1);
  }

  function marimba(f, t, v = 0.32) {
    tone('sine', f, t, 0.55, v, { send: 0.2 });
    tone('sine', f * 4, t, 0.1, v * 0.32, { send: 0.08 });
    tone('sine', f * 10, t, 0.025, v * 0.08, { send: 0 });
  }

  function chip(f, t, v = 0.11) {
    const o = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(f, t);
    o.frequency.setValueAtTime(f * 1.5, t + 0.055);
    lp.type = 'lowpass';
    lp.frequency.value = 5200;
    envelope(g, t, 0.001, 0.17, v);
    o.connect(lp);
    lp.connect(g);
    wire(g, 0.08);
    o.start(t);
    o.stop(t + 0.22);
  }

  function noise(t, dur, v, { type = 'bandpass', f = 1800, q = 0.9, to } = {}) {
    const s = ctx.createBufferSource();
    const flt = ctx.createBiquadFilter();
    const g = ctx.createGain();
    s.buffer = noiseBuf;
    s.loop = true;
    flt.type = type;
    flt.Q.value = q;
    flt.frequency.setValueAtTime(f, t);
    if (to) flt.frequency.exponentialRampToValueAtTime(to, t + dur);
    envelope(g, t, Math.min(0.004, dur / 3), dur, v);
    s.connect(flt);
    flt.connect(g);
    wire(g, 0.12);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  const thump = (t, v = 0.3, f = 170, to = 70, dur = 0.09) => tone('sine', f, t, dur, v, { to, send: 0 });

  /** Warm chord: two detuned saws per note through a filter that opens up. */
  function pad(midis, t, dur, v = 0.05) {
    const flt = ctx.createBiquadFilter();
    const g = ctx.createGain();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(700, t);
    flt.frequency.exponentialRampToValueAtTime(3400, t + dur * 0.5);
    flt.frequency.exponentialRampToValueAtTime(900, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.05);
    g.gain.setValueAtTime(1, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    flt.connect(g);
    wire(g, 0.6);
    for (const m of midis) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        const a = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = m2f(m);
        o.detune.value = det;
        a.gain.value = v;
        o.connect(a);
        a.connect(flt);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    }
  }

  /** One note in the timbre of the chosen sound pack. */
  function note(m, t, v = 0.28) {
    if (L.pack === 'holz') marimba(m2f(m), t, v * 1.25);
    else if (L.pack === 'arcade') chip(m2f(m), t, v * 0.9);
    else bell(m2f(m), t, 0.95, v * 1.05);
  }

  const FX = {
    check(t, { step = 0 } = {}) {
      const root = PACKS[L.pack].root;
      const oct = Math.min(Math.floor(step / SCALE.length), 2);
      const m = root + 12 * oct + SCALE[step % SCALE.length] - 12;
      thump(t, 0.34, 200, 85, 0.07);
      noise(t, 0.022, 0.16, { f: 3000 });
      note(m, t + 0.004, 0.62);
      note(m + 12, t + 0.05, 0.2);
      if (step >= 3) note(m + 7, t + 0.07, 0.26);
    },
    uncheck(t) {
      const root = PACKS[L.pack].root - 12;
      thump(t, 0.2, 150, 80, 0.07);
      note(root, t, 0.24);
      tone('sine', m2f(root), t + 0.01, 0.13, 0.16, { to: m2f(root - 7), send: 0.1 });
    },
    tick(t, { i = 0 } = {}) {
      tone('sine', 880 + i * 130, t, 0.04, 0.1, { send: 0.04 });
    },
    tap(t) {
      tone('sine', 1500, t, 0.02, 0.09, { send: 0 });
    },
    tab(t) {
      tone('triangle', 620, t, 0.06, 0.2, { to: 840, send: 0.08 });
    },
    select(t, { i = 0 } = {}) {
      tone('triangle', m2f(72 + SCALE[i % 5] + (i >= 5 ? 12 : 0)), t, 0.09, 0.2, { send: 0.12 });
    },
    open(t) {
      noise(t, 0.2, 0.2, { f: 700, to: 2600, q: 0.7 });
    },
    close(t) {
      noise(t, 0.16, 0.16, { f: 2200, to: 600, q: 0.7 });
    },
    add(t) {
      tone('sine', 380, t, 0.1, 0.42, { to: 820, send: 0.2 });
      note(PACKS[L.pack].root, t + 0.075, 0.42);
    },
    remove(t) {
      noise(t, 0.2, 0.34, { f: 1600, to: 260 });
      thump(t + 0.05, 0.42, 130, 50, 0.13);
    },
    move(t) {
      noise(t, 0.2, 0.2, { f: 900, to: 3000 });
      tone('sine', 520, t + 0.02, 0.1, 0.26, { to: 780, send: 0.2 });
    },
    undo(t) {
      tone('sine', 780, t, 0.1, 0.32, { to: 420, send: 0.2 });
    },
    ding(t) {
      bell(m2f(88), t, 0.9, 0.3, 2.01, 1.2);
      bell(m2f(95), t + 0.09, 1.1, 0.22, 2.01, 1);
    },
    step(t, { i = 0 } = {}) {
      note(PACKS[L.pack].root - 5 + SCALE[i % 5], t, 0.4);
    },
    deny(t) {
      tone('triangle', 200, t, 0.08, 0.34, { send: 0.05 });
      tone('triangle', 165, t + 0.09, 0.11, 0.34, { send: 0.05 });
    },
    goal(t) {
      const r = PACKS[L.pack].root - 12;
      thump(t, 0.75, 120, 36, 0.5);
      noise(t, 0.5, 0.42, { type: 'lowpass', f: 900, to: 180, q: 0.4 });
      [0, 7, 12, 16, 19, 24].forEach((s, i) => note(r + s, t + 0.02 + i * 0.045, 0.34));
      pad([r - 12, r, r + 4, r + 7, r + 11], t + 0.02, 1.8, 0.05);
      bell(m2f(r + 36), t + 0.3, 1.8, 0.18);
    },
    levelup(t) {
      const r = PACKS[L.pack].root - 12;
      noise(t, 0.6, 0.2, { f: 400, to: 5200, q: 0.8 });
      const start = t + 0.3;
      [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => note(r + s, start + i * 0.062, 0.36));
      const hit = start + 0.46;
      thump(hit, 0.7, 110, 40, 0.42);
      pad([r - 12, r, r + 4, r + 7, r + 11, r + 14], hit, 2.5, 0.06);
      [24, 28, 31, 36].forEach((s, i) => bell(m2f(r + s), hit + i * 0.09, 1.9, 0.18));
    },
    alldone(t) {
      const r = PACKS[L.pack].root - 12;
      pad([r - 7, r - 3, r + 2, r + 9], t, 0.6, 0.05); // Fsus-Klang
      pad([r - 5, r - 1, r + 2, r + 7], t + 0.36, 0.6, 0.05); // Dominante
      pad([r - 12, r, r + 4, r + 7, r + 11, r + 14], t + 0.72, 2.9, 0.06); // Auflösung
      [7, 9, 12, 16, 19, 24].forEach((s, i) => note(r + s, t + 0.1 + i * 0.13, 0.32));
      [24, 31, 36].forEach((s, i) => bell(m2f(r + s), t + 0.86 + i * 0.13, 2, 0.18));
      thump(t + 0.72, 0.55, 100, 40, 0.5);
    },
  };

  function play(name, opts) {
    if (!ensure()) return;
    try {
      out.gain.value = gainFor();
      FX[name](ctx.currentTime + 0.002, opts);
    } catch {
      /* Sound must never break an action. */
    }
  }

  /** Rising charge sound while a goal button is held. Returns stop(). */
  function holdStart() {
    if (!ensure()) return () => {};
    const t = ctx.currentTime + 0.005;
    const span = HOLD_MS / 1000;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(560, t + span);
    f.type = 'lowpass';
    f.Q.value = 7;
    f.frequency.setValueAtTime(240, t);
    f.frequency.exponentialRampToValueAtTime(4200, t + span);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + span * 0.8);
    o.connect(f);
    f.connect(g);
    wire(g, 0.25);
    o.start(t);
    return () => {
      const now = ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(0.0001, now, 0.035);
      o.frequency.cancelScheduledValues(now);
      o.frequency.setTargetAtTime(55, now, 0.06);
      o.stop(now + 0.25);
    };
  }

  /** Browsers only start audio from a user gesture. */
  const unlock = () => ensure();

  return { play, holdStart, unlock, PACKS };
})();

/* ================================================================== HAPTICS
   Android vibrates directly. Safari has no vibration API, but from iOS 18 on,
   toggling a native switch element gives a tiny haptic tap. */
const Haptic = (() => {
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const PATTERNS = {
    tick: 6,
    tap: 9,
    swipe: 12,
    success: [12, 40, 22],
    heavy: [24, 40, 40],
    level: [22, 60, 22, 60, 70],
    deny: [30, 50, 30],
  };
  let sw = null;
  const iosTap = () => {
    if (!sw) {
      sw = document.createElement('label');
      sw.setAttribute('aria-hidden', 'true');
      sw.style.cssText = 'position:fixed;left:-99px;top:0;opacity:0;pointer-events:none';
      sw.innerHTML = '<input type="checkbox" switch tabindex="-1">';
      document.body.append(sw);
    }
    sw.click();
  };
  return (kind) => {
    if (!L.haptics) return;
    const p = PATTERNS[kind] || 8;
    if (navigator.vibrate) {
      try {
        navigator.vibrate(p);
      } catch {
        /* optional */
      }
    } else if (IOS) {
      const taps = Array.isArray(p) ? Math.ceil(p.length / 2) : 1;
      for (let i = 0; i < taps; i++) setTimeout(iosTap, i * 90);
    }
  };
})();
