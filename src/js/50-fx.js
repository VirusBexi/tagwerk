/* ======================================================================= FX
   Particles on one full-screen canvas. The loop only runs while something is
   alive, so an idle app costs no battery. */

const Fx = (() => {
  let cv, ctx, W, H, dpr;
  let parts = [];
  let rings = [];
  let running = false;
  let last = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
  }
  function init() {
    cv = $('#fx');
    ctx = cv.getContext('2d');
    resize();
    addEventListener('resize', resize);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    rings = rings.filter((r) => (r.age += dt) < r.life);
    for (const r of rings) {
      const t = r.age / r.life;
      const e = 1 - Math.pow(1 - t, 3);
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - t) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, 0, Math.PI * 2);
      ctx.stroke();
    }

    parts = parts.filter((p) => (p.age += dt) < p.life);
    for (const p of parts) {
      p.vy += p.g * dt;
      p.vx *= 1 - p.drag * dt;
      p.vy *= 1 - p.drag * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      const t = p.age / p.life;
      ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.flutter) ctx.scale(Math.cos(p.age * p.flutter), 1);
      if (p.shape === 'tri') {
        ctx.beginPath();
        ctx.moveTo(0, -p.s);
        ctx.lineTo(p.s * 0.85, p.s * 0.7);
        ctx.lineTo(-p.s * 0.85, p.s * 0.7);
        ctx.closePath();
        ctx.fill();
      } else if (p.shape === 'dot') {
        ctx.beginPath();
        ctx.arc(0, 0, p.s * 0.65, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.s, -p.s * 0.45, p.s * 2, p.s * 0.9);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    if (parts.length || rings.length) {
      requestAnimationFrame(loop);
    } else {
      running = false;
      ctx.clearRect(0, 0, W, H);
    }
  }

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const SHAPES = ['tri', 'rect', 'dot'];

  /** Shards flying out from a check mark, plus a shock ring. */
  function burst(x, y, color, count = 16, power = 1) {
    if (!motionOK()) return;
    const colors = [color, color, '#FFF4E0', '#FFC145'];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const v = (120 + Math.random() * 300) * power;
      parts.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 60 * power,
        g: 620,
        drag: 2.8,
        s: 2.2 + Math.random() * 3.6 * power,
        rot: Math.random() * 6,
        spin: (Math.random() - 0.5) * 16,
        shape: pick(SHAPES),
        color: pick(colors),
        age: 0,
        life: 0.5 + Math.random() * 0.45,
      });
    }
    rings.push({ x, y, r0: 12, r1: 56 * power, width: 5 * power, color, age: 0, life: 0.46 });
    start();
  }

  /** Paper falling from the top of the screen. */
  function confetti(count = 110, colors = ['#FFC145', '#FF7A59', '#FFF4E0', '#FF6F91', '#F67E38', '#FFE685']) {
    if (!motionOK()) return;
    for (let i = 0; i < count; i++) {
      parts.push({
        x: Math.random() * W,
        y: -20 - Math.random() * H * 0.6,
        vx: (Math.random() - 0.5) * 70,
        vy: 130 + Math.random() * 220,
        g: 60,
        drag: 0.25,
        s: 3 + Math.random() * 4.5,
        rot: Math.random() * 6,
        spin: (Math.random() - 0.5) * 7,
        flutter: 4 + Math.random() * 6,
        shape: Math.random() < 0.8 ? 'rect' : 'tri',
        color: pick(colors),
        age: 0,
        life: 2.4 + Math.random() * 1.8,
      });
    }
    start();
  }

  function ring(x, y, color, r1 = 90) {
    if (!motionOK()) return;
    rings.push({ x, y, r0: 10, r1, width: 7, color, age: 0, life: 0.62 });
    start();
  }

  /** Sends "+25" across the screen. `done` runs when it lands, also without animation. */
  function flyXp(from, to, text, color, done) {
    if (!motionOK() || !to) {
      if (done) done();
      return;
    }
    const orb = document.createElement('div');
    orb.className = 'orb';
    orb.textContent = text;
    orb.style.setProperty('--c', color);
    orb.style.left = `${from.x}px`;
    orb.style.top = `${from.y}px`;
    document.body.append(orb);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const midX = dx * 0.42 + (dx >= 0 ? 40 : -40);
    const midY = dy * 0.5 - 30;
    const anim = orb.animate(
      [
        { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
        { transform: 'translate(-50%,-50%) translate(0,-26px) scale(1.18)', opacity: 1, offset: 0.2 },
        { transform: `translate(-50%,-50%) translate(${midX}px,${midY}px) scale(1)`, opacity: 1, offset: 0.62 },
        { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.45)`, opacity: 0.85 },
      ],
      { duration: 680, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'forwards' },
    );
    anim.onfinish = () => {
      orb.remove();
      if (done) done();
    };
  }

  return { init, burst, confetti, ring, flyXp };
})();

/* ====================================================== XP-Anzeige (HUD)
   A pill that slides in after every gain and fills the category's level bar
   right in front of you. Rapid gains reuse the same pill. */
const Hud = (() => {
  let hideTimer = 0;
  let root;

  function show({ emoji, name, color, xp, before, after }) {
    root = root || $('#hud');
    const leveled = after.level > before.level;
    root.innerHTML = `
      <div class="hud-card" style="--c:${esc(color)}">
        <span class="hud-emoji">${esc(emoji)}</span>
        <div class="hud-body">
          <div class="hud-top"><b>${esc(name)}</b><span>Level <b class="hud-lv">${before.level}</b></span></div>
          <div class="hud-bar" role="presentation"><i style="width:${(before.pct * 100).toFixed(1)}%"></i></div>
        </div>
        <span class="hud-xp">+${xp}</span>
      </div>`;
    root.classList.add('on');
    const bar = $('.hud-bar i', root);
    const lv = $('.hud-lv', root);
    const ticks = 7;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        bar.style.width = leveled ? '100%' : `${(after.pct * 100).toFixed(1)}%`;
      }),
    );
    for (let i = 0; i < ticks; i++) setTimeout(() => Sound.play('tick', { i }), 260 + i * 62);
    if (leveled) {
      setTimeout(() => {
        lv.textContent = after.level;
        lv.classList.add('bump');
        bar.style.transition = 'none';
        bar.style.width = '0%';
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            bar.style.transition = '';
            bar.style.width = `${(after.pct * 100).toFixed(1)}%`;
          }),
        );
      }, 760);
    }
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => root.classList.remove('on'), leveled ? 1400 : 2100);
  }
  return { show };
})();

/* ================================================================ Level-up */
const LevelUp = (() => {
  const queue = [];
  let open = false;
  let waiting = [];

  function next() {
    const item = queue.shift();
    const host = $('#levelRoot');
    if (!item) {
      open = false;
      host.innerHTML = '';
      const fns = waiting;
      waiting = [];
      fns.forEach((fn) => setTimeout(fn, 260));
      return;
    }
    open = true;
    const { name, emoji, color, from, to, rankBefore, rank, extra } = item;
    host.innerHTML = `
      <div class="lvl" style="--c:${esc(color)}" data-act="close-level" role="dialog" aria-label="Level ${to} erreicht">
        <div class="lvl-bands" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="lvl-body">
          <div class="lvl-emoji">${esc(emoji)}</div>
          <p class="lvl-name">${esc(name)}</p>
          <div class="lvl-num" aria-hidden="true"><span class="old">${from}</span><span class="new">${to}</span></div>
          <p class="lvl-title">Level ${to}!</p>
          <p class="lvl-rank">${rank !== rankBefore ? `Neuer Rang: ${esc(rank)}` : esc(rank)}</p>
          ${extra ? `<p class="lvl-extra">${esc(extra)}</p>` : ''}
        </div>
        <button class="btn lvl-btn" data-act="close-level">Weiter</button>
      </div>`;
    Sound.play('levelup');
    Haptic('level');
    setTimeout(() => {
      const r = $('.lvl-num');
      if (r) {
        const b = r.getBoundingClientRect();
        Fx.burst(b.left + b.width / 2, b.top + b.height / 2, color, 34, 2.2);
      }
      Fx.confetti(90, [color, color, '#FFF4E0', '#FFC145']);
    }, 720);
  }

  const close = () => next();

  function push(item) {
    queue.push(item);
    if (!open) next();
  }

  /** Runs fn once all level-up screens are gone (they start after `delay`). */
  function afterAll(fn, delay = 0) {
    setTimeout(() => {
      if (open || queue.length) waiting.push(fn);
      else fn();
    }, delay + 20);
  }

  return { push, close, afterAll, get open() { return open; } };
})();

/* ========================================================= Erfolg-Banner
   A freshly earned badge drops in from the top, one at a time. */
const BadgeBanner = (() => {
  const queue = [];
  let showing = false;
  let timer = 0;
  let host;

  const medalHtml = (b, cls = '') =>
    `<span class="medal ${cls}" style="--c:${esc(b.color)}" aria-hidden="true"><i>${esc(b.emoji)}</i></span>`;

  function next() {
    host = host || $('#badgeRoot');
    const b = queue.shift();
    if (!b) {
      showing = false;
      return;
    }
    showing = true;
    host.innerHTML = `
      <button class="bdg-pop" style="--c:${esc(b.color)}" data-act="badges" data-id="${esc(b.id)}" data-fx="none">
        <span class="bdg-pop-shine" aria-hidden="true"></span>
        ${medalHtml(b, 'on')}
        <span class="bdg-pop-text">
          <small>Erfolg freigeschaltet</small>
          <b>${esc(b.name)}</b>
          <span>${esc(b.desc)}</span>
        </span>
      </button>`;
    Sound.play('badge');
    Haptic('success');
    setTimeout(() => {
      const m = $('.medal', host);
      if (!m) return;
      const r = m.getBoundingClientRect();
      Fx.burst(r.left + r.width / 2, r.top + r.height / 2, b.color, 20, 1.5);
    }, 330);
    timer = setTimeout(hide, 3800);
  }

  function hide() {
    clearTimeout(timer);
    const el = host && host.firstElementChild;
    if (!el) return next();
    el.classList.add('out');
    setTimeout(() => {
      host.innerHTML = '';
      next();
    }, 240);
  }

  function push(list) {
    queue.push(...list);
    if (!showing) next();
  }

  return { push, hide, medalHtml };
})();

/* Number roll-up for counters in the sky. */
function rollNumber(el, to, ms = 500) {
  const from = Number(el.dataset.val ?? el.textContent) || 0;
  el.dataset.val = to;
  if (from === to || !motionOK()) {
    el.textContent = to;
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    const t = clamp((now - t0) / ms, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(lerp(from, to, eased));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
