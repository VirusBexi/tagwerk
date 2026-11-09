/* ================================================================= SORTING
   The open tasks of a day can be put in order by hand: hold a row for a moment
   on the phone, or simply drag it with the mouse. The order belongs to the task,
   so a repeating task keeps its place on its other days too. */

let dragActive = false;

/** Writes the new order. `ids` is the list as it should be, `movedId` the row that was carried. */
function reorderTasks(ids, movedId) {
  const ord = (id) => (S.tasks[id] && S.tasks[id].order) || 0;
  const at = ids.indexOf(movedId);
  const prev = at > 0 ? ord(ids[at - 1]) : null;
  const next = at < ids.length - 1 ? ord(ids[at + 1]) : null;
  const o = prev == null ? next - 1000 : next == null ? prev + 1000 : (prev + next) / 2;
  if ((prev == null || o > prev) && (next == null || o < next)) {
    updateTask(movedId, { order: o });
    return;
  }
  // Neighbours share a value: number the whole list afresh.
  const base = Math.min(...ids.map(ord));
  ids.forEach((id, i) => updateTask(id, { order: base + i * 1000 }));
}

function initRowDrag() {
  const PRESS_MS = 380;
  let d = null; // the running drag
  let arm = null; // a press that may still become one
  let scrollRaf = 0;

  const pressable = (e) => {
    if (d || ui.sheet || ui.dialog) return null;
    const wrap = e.target.closest && e.target.closest('.row-wrap[data-drag]');
    if (!wrap || e.target.closest('.chk, .row-tools, .tool')) return null;
    return wrap;
  };

  const disarm = () => {
    if (arm && arm.timer) clearTimeout(arm.timer);
    arm = null;
  };

  function begin(wrap, y, mouse) {
    const list = wrap.parentElement;
    const rows = $$('.row-wrap[data-drag]', list);
    const from = rows.indexOf(wrap);
    if (rows.length < 2 || from < 0) return false;
    const rects = rows.map((el) => el.getBoundingClientRect());
    const sy = window.scrollY;
    d = {
      wrap,
      list,
      rows,
      from,
      to: from,
      mouse,
      y0: y,
      sy0: sy,
      lastY: y,
      tops: rects.map((r) => r.top + sy),
      heights: rects.map((r) => r.height),
      step: rects[from].height + (rects[1].top - rects[0].bottom),
    };
    dragActive = true;
    list.classList.add('sorting');
    wrap.classList.add('dragging');
    root.classList.add('is-sorting');
    Sound.play('grab');
    Haptic('tap');
    scrollRaf = requestAnimationFrame(autoScroll);
    return true;
  }

  function move(y) {
    const { rows, from, tops, heights } = d;
    const last = rows.length - 1;
    d.lastY = y;
    const dy = clamp(
      y - d.y0 + (window.scrollY - d.sy0),
      tops[0] - tops[from] - 10,
      tops[last] + heights[last] - tops[from] - heights[from] + 10,
    );
    d.wrap.style.transform = `translate3d(0,${dy.toFixed(1)}px,0) scale(1.025)`;

    const centre = tops[from] + heights[from] / 2 + dy;
    let to = 0;
    for (let i = 0; i <= last; i++) if (i !== from && tops[i] + heights[i] / 2 < centre) to++;
    if (to === d.to) return;
    d.to = to;
    Haptic('tick');
    rows.forEach((el, i) => {
      if (i === from) return;
      const shift = from < to && i > from && i <= to ? -d.step : to < from && i >= to && i < from ? d.step : 0;
      el.style.transform = shift ? `translate3d(0,${shift}px,0)` : '';
    });
  }

  /* Near the top or bottom edge the page scrolls along. */
  function autoScroll() {
    if (!d) return;
    const top = 130;
    const bottom = window.innerHeight - 150;
    const v = d.lastY < top ? (d.lastY - top) / 7 : d.lastY > bottom ? (d.lastY - bottom) / 7 : 0;
    if (v) {
      const before = window.scrollY;
      window.scrollBy(0, clamp(v, -16, 16));
      if (window.scrollY !== before) move(d.lastY);
    }
    scrollRaf = requestAnimationFrame(autoScroll);
  }

  function finish(cancel) {
    if (!d) return;
    const { wrap, list, rows, from } = d;
    const to = cancel ? from : d.to;
    cancelAnimationFrame(scrollRaf);
    d = null;
    dragActive = false;
    list.classList.remove('sorting');
    root.classList.remove('is-sorting');
    suppressClickUntil = performance.now() + 350;
    Sound.play('drop');
    Haptic('tick');
    if (to !== from) {
      const ids = rows.map((el) => $('.row', el).dataset.id);
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved);
      reorderTasks(ids, moved);
    }
    // The render takes the rows from where they are right now and lets them glide home.
    renderNow();
    if (wrap.isConnected) {
      wrap.classList.add('dropping');
      setTimeout(() => wrap.classList.remove('dropping'), 460);
    }
  }

  /* Touch: hold still for a moment, then carry. */
  document.addEventListener(
    'touchstart',
    (e) => {
      disarm();
      if (e.touches.length !== 1) return;
      const wrap = pressable(e);
      if (!wrap) return;
      const t = e.touches[0];
      arm = { wrap, x: t.clientX, y: t.clientY };
      arm.timer = setTimeout(() => {
        const a = arm;
        arm = null;
        if (a && a.wrap.isConnected && !a.wrap.classList.contains('swiping')) begin(a.wrap, a.y, false);
      }, PRESS_MS);
    },
    { passive: true },
  );
  document.addEventListener(
    'touchmove',
    (e) => {
      const t = e.touches[0];
      if (d && !d.mouse) {
        if (e.cancelable) e.preventDefault();
        move(t.clientY);
      } else if (arm && !arm.mouse && Math.hypot(t.clientX - arm.x, t.clientY - arm.y) > 8) {
        disarm();
      }
    },
    { passive: false },
  );
  const touchEnd = (cancel) => (e) => {
    disarm();
    if (!d || d.mouse) return;
    if (e.cancelable) e.preventDefault();
    finish(cancel);
  };
  document.addEventListener('touchend', touchEnd(false));
  document.addEventListener('touchcancel', touchEnd(true));
  // A long press must not open the system menu while a row is held.
  document.addEventListener('contextmenu', (e) => {
    if (d || (arm && !arm.mouse)) e.preventDefault();
  });

  /* Mouse and pen: press and pull up or down. */
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    const wrap = pressable(e);
    if (wrap) arm = { wrap, x: e.clientX, y: e.clientY, mouse: true };
  });
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    if (d && d.mouse) {
      move(e.clientY);
      return;
    }
    if (!arm || !arm.mouse) return;
    if (arm.wrap.classList.contains('swiping')) {
      arm = null;
      return;
    }
    const dy = Math.abs(e.clientY - arm.y);
    if (dy < 6 || dy < Math.abs(e.clientX - arm.x)) return;
    const a = arm;
    arm = null;
    if (begin(a.wrap, a.y, true)) move(e.clientY);
  });
  const mouseEnd = (cancel) => (e) => {
    if (e.pointerType === 'touch') return;
    if (arm && arm.mouse) arm = null;
    if (d && d.mouse) finish(cancel);
  };
  document.addEventListener('pointerup', mouseEnd(false));
  document.addEventListener('pointercancel', mouseEnd(true));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && d) {
      e.stopPropagation();
      finish(true);
    }
  });
  window.addEventListener('blur', () => finish(true));
}
