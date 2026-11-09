/* ==================================================================== SCENE
   The signature of the app: a poster landscape whose sky shows how far today
   has come. Nothing done: night, stars, a thin moon. Every finished task lifts
   the sun and pushes the sky through plum and coral to full gold.
   Stars and clouds are separate layers, so only the compositor animates them. */

const Scene = (() => {
  /* ------------------------------------------------------------- Colors */
  const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => {
    const x = hex2rgb(a);
    const y = hex2rgb(b);
    return `#${[0, 1, 2].map((i) => Math.round(lerp(x[i], y[i], t)).toString(16).padStart(2, '0')).join('')}`;
  };
  /** Eight sky bands, from the far edge to the ring around the sun, spread along a few anchor colours. */
  const ramp = (anchors) =>
    Array.from({ length: 8 }, (_, i) => {
      const x = (i / 7) * (anchors.length - 1);
      const k = Math.min(Math.floor(x), anchors.length - 2);
      return mix(anchors[k], anchors[k + 1], x - k);
    });
  const stop = (p, anchors, sun, far, mid, near) => ({ p, bands: ramp(anchors), sun, far, mid, near });

  /* Every sky tells the same story (night first, full light when the day is done)
     in its own colours. `level` is the overall level that unlocks it; `ink` is the
     title colour once the sky gets bright (null: the sky stays dark enough for cream). */
  const THEMES = {
    abendrot: {
      name: 'Abendrot',
      note: 'Von Nachtblau über Koralle zu Gold',
      level: 1,
      ink: '#2A0F2E',
      stops: [
        { p: 0, bands: ['#0B0E27', '#0E112E', '#111535', '#14183C', '#171C44', '#1B204C', '#1F2455', '#23285E'], sun: '#2B2F6C', far: '#161A4A', mid: '#10133A', near: '#0B0D24' },
        { p: 0.25, bands: ['#12133A', '#191749', '#231C59', '#2F2168', '#3E2775', '#522E7F', '#6A3585', '#853C86'], sun: '#FF8A5F', far: '#2C1F60', mid: '#1A174A', near: '#0C0E28' },
        { p: 0.5, bands: ['#2A1B5E', '#43236F', '#60297B', '#802F7F', '#A0387C', '#C04674', '#DC5868', '#F0705B'], sun: '#FFC76E', far: '#5B2771', mid: '#301C56', near: '#100F2C' },
        { p: 0.75, bands: ['#6B2A7A', '#93347C', '#B84076', '#D6506A', '#EA655B', '#F5804E', '#FA9C47', '#FDB94A'], sun: '#FFE28C', far: '#A33C6E', mid: '#5C2361', near: '#15102E' },
        { p: 1, bands: ['#E8503F', '#F0663B', '#F67E38', '#FA9537', '#FDAD3A', '#FEC447', '#FFD762', '#FFE685'], sun: '#FFF7CC', far: '#C8463F', mid: '#7A2A56', near: '#1A1130' },
      ],
    },
    polarlicht: {
      name: 'Polarlicht',
      note: 'Grünes Leuchten über dem Fjord',
      level: 2,
      ink: '#06262E',
      stops: [
        stop(0, ['#070B1E', '#12203F'], '#1F3A5C', '#0F1D3A', '#0B1530', '#080F22'),
        stop(0.25, ['#081226', '#0E2A45', '#135A5E'], '#5FE3A1', '#12354B', '#0D2238', '#081226'),
        stop(0.5, ['#0B1B3A', '#12506A', '#1FA587'], '#A6F5C0', '#15506A', '#0E2F4C', '#0A162C'),
        stop(0.75, ['#123A6B', '#1B8E94', '#52D99A'], '#D9FFCB', '#1C7C86', '#12476A', '#0B1930'),
        stop(1, ['#1FA8A0', '#55DE9E', '#C8F78A'], '#FBFFD9', '#1E8F8C', '#14566F', '#0C1C34'),
      ],
    },
    lagune: {
      name: 'Lagune',
      note: 'Tiefblau bis türkis, wie ein Sommertag am Meer',
      level: 4,
      ink: '#08173F',
      stops: [
        stop(0, ['#060A20', '#0F1A45'], '#22326F', '#111C4A', '#0C143A', '#080D26'),
        stop(0.25, ['#0A1238', '#16307A', '#2B5BB5'], '#7CC8FF', '#1A2E72', '#111D52', '#090F2C'),
        stop(0.5, ['#0F2466', '#1E5BC0', '#33A7E0'], '#BDEBFF', '#1E55A8', '#132F74', '#0A1232'),
        stop(0.75, ['#1949B0', '#2D9BE6', '#62DCEB'], '#E6FBFF', '#2581C4', '#164A8E', '#0B1638'),
        stop(1, ['#2F8FEA', '#5CD6F0', '#B8F5E4', '#FFF1B8'], '#FFFDE8', '#2E9FCC', '#1B5E9A', '#0C193E'),
      ],
    },
    kirschbluete: {
      name: 'Kirschblüte',
      note: 'Pflaume, Pink und ganz viel Rosa',
      level: 6,
      ink: '#3B0F38',
      stops: [
        stop(0, ['#120A22', '#24123F'], '#3D2060', '#22123E', '#190D30', '#110920'),
        stop(0.25, ['#1C0E38', '#431B5C', '#7A2B74'], '#FF8FC0', '#3C1A58', '#27113F', '#130A24'),
        stop(0.5, ['#33165A', '#82307F', '#D0528F'], '#FFC2DC', '#6E2A76', '#40195A', '#150B28'),
        stop(0.75, ['#6C2A86', '#C9529A', '#F58FB0'], '#FFE1EC', '#A8448C', '#5E2370', '#180C2C'),
        stop(1, ['#E86AA6', '#F9A3BC', '#FFD9D2'], '#FFF8F0', '#C9578F', '#7A2F78', '#1C0E30'),
      ],
    },
    neon: {
      name: 'Neon',
      note: 'Synthwave: Violett, Magenta, Laserlicht',
      level: 9,
      ink: null,
      stops: [
        stop(0, ['#07051A', '#150B3A'], '#2A1670', '#160C40', '#0F082E', '#09051C'),
        stop(0.25, ['#0D0730', '#2A0F6E', '#5A18A8'], '#FF4FD8', '#27106A', '#180A48', '#0B0622'),
        stop(0.5, ['#1A0A5C', '#5A1BC0', '#B02BE0'], '#FF8AE8', '#4A16A0', '#260D68', '#0D0726'),
        stop(0.75, ['#3B14B8', '#9B2DEB', '#F04FD6'], '#FFC4F4', '#7C22C4', '#3C1284', '#0F082A'),
        stop(1, ['#5A2BEA', '#B845F5', '#FF6AD5', '#FFB86B'], '#FFF3C4', '#8B2BD4', '#4A1796', '#110930'),
      ],
    },
  };
  const THEME_IDS = Object.keys(THEMES);
  let theme = 'abendrot';
  let STOPS = THEMES[theme].stops;
  const BAND_SIZES = [11, 8.2, 6.1, 4.5, 3.3, 2.4, 1.65];
  const SLIM_DROP = 90; // how much shorter the sky is outside the "Heute" tab on phones

  let root, wrap, skyEl, starsEl, cloudsEl, hillsEl;
  let W = 0;
  let H = 0;
  let R = 40;
  let cx = 0;
  let horizon = 0;
  let desktop = false;
  let slim = false;
  let progress = 0;
  let sunY = 0;
  let halo, sunEl, bandEls, farEl, midEl, nearEl, treesEl;
  let finaleTimer = 0;
  let glimpse = null; // a progress value shown for a moment instead of the real one
  let glimpseTimer = 0;

  function colorsAt(p, stops = STOPS) {
    let i = 0;
    while (i < stops.length - 2 && p > stops[i + 1].p) i++;
    const a = stops[i];
    const b = stops[i + 1];
    const t = clamp((p - a.p) / (b.p - a.p), 0, 1);
    return {
      bands: a.bands.map((c, n) => mix(c, b.bands[n], t)),
      sun: mix(a.sun, b.sun, t),
      far: mix(a.far, b.far, t),
      mid: mix(a.mid, b.mid, t),
      near: mix(a.near, b.near, t),
    };
  }

  /* ----------------------------------------------------------- Geometry */
  function seeded(seed) {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }
  function hillY(x, base, amp, seed) {
    const u = x / Math.max(W, 1);
    return (
      base -
      amp * (0.55 * Math.sin(u * Math.PI * 1.5 + seed) + 0.3 * Math.sin(u * Math.PI * 3.3 + seed * 2.3) + 0.15 * Math.sin(u * Math.PI * 7.1 + seed * 0.7))
    );
  }
  function hillPath(base, amp, seed) {
    let d = `M-2 ${H + 20} L-2 ${hillY(0, base, amp, seed).toFixed(1)}`;
    for (let x = 8; x <= W + 8; x += 8) d += ` L${x} ${hillY(x, base, amp, seed).toFixed(1)}`;
    return `${d} L${W + 8} ${H + 20} Z`;
  }
  function treesPath(base, amp, seed, scale) {
    const rnd = seeded(Math.floor(seed * 1000) + 11);
    let d = '';
    let x = 6 + rnd() * 24;
    while (x < W) {
      const y = hillY(x, base, amp, seed) + 3;
      const h = (13 + rnd() * 15) * scale;
      const w = h * (0.28 + rnd() * 0.08);
      d += `M${x.toFixed(1)} ${(y - h).toFixed(1)} L${(x - w).toFixed(1)} ${y.toFixed(1)} L${(x + w).toFixed(1)} ${y.toFixed(1)} Z `;
      d += `M${x.toFixed(1)} ${(y - h * 1.3).toFixed(1)} L${(x - w * 0.7).toFixed(1)} ${(y - h * 0.55).toFixed(1)} L${(x + w * 0.7).toFixed(1)} ${(y - h * 0.55).toFixed(1)} Z `;
      x += rnd() < 0.3 ? (5 + rnd() * 9) * scale : (20 + rnd() * 62) * scale;
    }
    return d;
  }

  function build() {
    const box = wrap.getBoundingClientRect();
    const w = Math.round(box.width);
    const h = Math.round(box.height);
    if (w < 10 || h < 10) return;
    W = w;
    H = h;
    desktop = matchMedia('(min-width: 960px)').matches;
    const scale = desktop ? 1.7 : 1;
    const footH = desktop ? Math.max(170, H * 0.24) : 58;
    R = clamp(Math.min(W, H) * (desktop ? 0.14 : 0.1), 26, 92);
    cx = W * (desktop ? 0.66 : 0.77);
    const nearBase = H - footH;
    const midBase = nearBase - (desktop ? 46 : 18);
    const farBase = midBase - (desktop ? 62 : 22);
    horizon = farBase;
    const vb = `0 0 ${W} ${H}`;

    // The box was rounded to whole pixels: stretch by that fraction instead of leaving a seam.
    [skyEl, cloudsEl, hillsEl].forEach((svg) => svg.setAttribute('preserveAspectRatio', 'none'));
    skyEl.setAttribute('viewBox', vb);
    const rays = Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2;
      const spread = 0.085;
      const far = Math.max(W, H) * 1.3;
      const p = (ang) => `${(Math.cos(ang) * far).toFixed(0)} ${(Math.sin(ang) * far).toFixed(0)}`;
      return `M0 0 L${p(a - spread)} L${p(a + spread)} Z`;
    }).join(' ');
    skyEl.innerHTML =
      `<rect class="band" width="${W}" height="${H}"/>` +
      `<g class="halo">` +
      BAND_SIZES.map((m) => `<circle class="band" r="${(R * m).toFixed(1)}"/>`).join('') +
      `<path class="rays" d="${rays}"/>` +
      `<circle class="sun" r="${R.toFixed(1)}"/></g>`;

    const rnd = seeded(4242);
    const starDots = (n, spread) => {
      let s = '';
      for (let i = 0; i < n; i++) {
        const x = rnd() * W;
        const y = rnd() * horizon * spread;
        const r = (0.5 + rnd() * rnd() * 1.3) * (desktop ? 1.25 : 1);
        s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}"/>`;
      }
      return s;
    };
    const moonR = desktop ? 30 : 15;
    const mx = W * (desktop ? 0.72 : 0.81);
    const my = horizon * (desktop ? 0.3 : 0.55);
    starsEl.innerHTML =
      `<svg class="layer tw-a" viewBox="${vb}" aria-hidden="true"><g fill="#FFF4E0">${starDots(desktop ? 60 : 30, 0.96)}</g></svg>` +
      `<svg class="layer tw-b" viewBox="${vb}" aria-hidden="true"><g fill="#FFF4E0">${starDots(desktop ? 50 : 24, 0.96)}</g>` +
      `<path class="moon" fill="#F8EFD7" d="M${mx} ${my - moonR} A${moonR} ${moonR} 0 1 0 ${mx} ${my + moonR} A${moonR * 1.32} ${moonR * 1.32} 0 0 1 ${mx} ${my - moonR} Z"/></svg>`;

    const cloud = (x, y, s) =>
      [
        [0, 0, 92, 15],
        [16, -11, 52, 14],
        [-22, 11, 80, 12],
      ]
        .map(([dx, dy, cw, ch]) => `<rect x="${x + dx * s}" y="${y + dy * s}" width="${cw * s}" height="${ch * s}" rx="${(ch * s) / 2}"/>`)
        .join('');
    cloudsEl.setAttribute('viewBox', vb);
    cloudsEl.innerHTML = desktop
      ? cloud(W * 0.12, H * 0.42, 1.7) + cloud(W * 0.62, H * 0.5, 1.2) + cloud(W * 0.3, H * 0.6, 0.9)
      : cloud(W * 0.1, horizon * 0.7, 0.72) + cloud(W * 0.55, horizon * 0.52, 0.55);

    hillsEl.setAttribute('viewBox', vb);
    const amp = desktop ? 26 : 10;
    const seedFar = 0.8;
    const seedMid = 2.6;
    const seedNear = 4.4;
    hillsEl.innerHTML =
      `<path class="far" d="${hillPath(farBase, amp * 1.25, seedFar)}"/>` +
      `<path class="tree-far" d="${treesPath(midBase, amp, seedMid, scale * 0.82)}"/>` +
      `<path class="mid" d="${hillPath(midBase, amp, seedMid)}"/>` +
      `<path class="near" d="${hillPath(nearBase, amp * 0.5, seedNear)}"/>`;

    halo = $('.halo', skyEl);
    sunEl = $('.sun', skyEl);
    bandEls = $$('.band', skyEl);
    farEl = $('.far', hillsEl);
    midEl = $('.mid', hillsEl);
    nearEl = $('.near', hillsEl);
    treesEl = $('.tree-far', hillsEl);
    root.classList.add('no-tr');
    apply();
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('no-tr')));
  }

  function apply() {
    if (!W || !halo) return;
    const p = glimpse == null ? progress : glimpse;
    const c = colorsAt(p);
    bandEls.forEach((el, i) => {
      el.style.fill = c.bands[i];
    });
    sunEl.style.fill = c.sun;
    farEl.style.fill = c.far;
    midEl.style.fill = c.mid;
    treesEl.style.fill = c.mid;
    nearEl.style.fill = c.near;

    const visible = desktop || !slim ? H : H - SLIM_DROP;
    const top = H - visible;
    const lifted = p <= 0 ? 0 : 0.16 + 0.84 * p;
    const eased = Math.sin((lifted * Math.PI) / 2);
    const low = horizon + R * 1.55;
    const high = top + visible * (desktop ? 0.25 : 0.27);
    sunY = lerp(low, high, eased);
    halo.style.transform = `translate(${cx}px, ${sunY}px)`;

    starsEl.style.opacity = clamp(1 - p * 3.6, 0, 1);
    cloudsEl.style.opacity = clamp((p - 0.18) * 1.5, 0, 0.92);
    cloudsEl.style.fill = mix(c.bands[3], '#FFF4E0', 0.28);

    const rootStyle = document.documentElement.style;
    const ink = p >= 0.82 ? THEMES[theme].ink : null;
    rootStyle.setProperty('--ground', c.near);
    rootStyle.setProperty('--hero-fg', ink || '#FFF4E0');
    rootStyle.setProperty('--hero-shadow', ink ? 'rgba(255, 240, 200, 0.28)' : 'rgba(30, 10, 50, 0.38)');
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', c.bands[0]);
  }

  /* ---------------------------------------------------------------- API */
  function mount(el) {
    if (THEMES[L.sky]) {
      theme = L.sky;
      STOPS = THEMES[theme].stops;
    }
    root = el;
    wrap = $('.sky-wrap', el);
    skyEl = $('.sky', el);
    starsEl = $('.stars', el);
    cloudsEl = $('.clouds', el);
    hillsEl = $('.hills', el);
    build();
    let lastW = 0;
    let lastH = 0;
    new ResizeObserver(() => {
      const b = wrap.getBoundingClientRect();
      if (Math.abs(b.width - lastW) > 1 || Math.abs(b.height - lastH) > 1) {
        lastW = b.width;
        lastH = b.height;
        build();
      }
    }).observe(wrap);
  }

  function set(p, isSlim) {
    const changed = p !== progress || isSlim !== slim;
    progress = clamp(p, 0, 1);
    slim = isSlim;
    if (changed) apply();
  }

  /** Switches the sky. With `show`, the finished day is shown for a moment, so you see what you picked. */
  function setTheme(id, show) {
    if (!THEMES[id]) return;
    theme = id;
    STOPS = THEMES[id].stops;
    clearTimeout(glimpseTimer);
    glimpse = show && motionOK() ? 1 : null;
    apply();
    if (glimpse != null) {
      glimpseTimer = setTimeout(() => {
        glimpse = null;
        apply();
      }, 2300);
    }
  }

  /** The skies in unlock order, each with the colours of a late afternoon for a small preview. */
  const themes = () =>
    THEME_IDS.map((id) => {
      const t = THEMES[id];
      return { id, name: t.name, note: t.note, level: t.level, active: id === theme, colors: colorsAt(0.8, t.stops) };
    });

  function pulse() {
    if (!sunEl || !motionOK()) return;
    sunEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }], {
      duration: 520,
      easing: 'cubic-bezier(.2,1.4,.4,1)',
    });
  }

  /** Where flying XP should land: the sun if it is on screen. */
  function sunPoint() {
    if (!wrap) return null;
    const b = wrap.getBoundingClientRect();
    const y = b.top + Math.min(sunY, horizon);
    const min = root.getBoundingClientRect().top + 8;
    if (y < Math.max(min, 8)) return null;
    return { x: b.left + cx, y };
  }

  function finale() {
    if (!root) return;
    clearTimeout(finaleTimer);
    root.classList.add('finale');
    if (motionOK()) {
      const birds = document.createElement('div');
      birds.className = 'birds';
      birds.innerHTML =
        '<svg viewBox="0 0 90 30" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
        '<path d="M2 12 q6 -7 11 0 q5 -7 11 0"/><path d="M34 22 q5 -6 9 0 q4 -6 9 0"/><path d="M62 8 q5 -6 9 0 q4 -6 9 0"/></g></svg>';
      root.append(birds);
      setTimeout(() => birds.remove(), 6200);
    }
    finaleTimer = setTimeout(() => root.classList.remove('finale'), 4200);
  }

  return { mount, set, setTheme, themes, pulse, sunPoint, finale, SLIM_DROP };
})();

function motionOK() {
  return L.motion && !matchMedia('(prefers-reduced-motion: reduce)').matches;
}
