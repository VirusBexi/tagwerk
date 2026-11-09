/* ================================================================= INSIGHTS
   The extra sections of the Level tab: Erfolge, Wochenrückblick and Himmel. */

const num = (n) => Number(n).toLocaleString('de-DE');
const LOCK = ic('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>');

/* ------------------------------------------------------------------ Erfolge */
function medalHtml(b, size = 56) {
  return `<span class="medal ${b.done ? 'on' : 'off'}" style="--c:${b.color};--s:${size}px;--p:${Math.round(b.pct * 100)}" aria-hidden="true"><i>${esc(b.emoji)}</i></span>`;
}

const badgeProgress = (b) => (b.goal === 1 ? 'Noch offen' : `${num(b.cur)} von ${num(b.goal)}`);

function badgeSection() {
  const all = badgeList();
  const got = all.filter((b) => b.done);
  // Newest first. What was earned before this device kept track follows, highest tier first.
  const recent = [...got]
    .reverse()
    .sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : 0))
    .slice(0, 4);
  const next = badgesNextUp(3);
  const stack = recent.length
    ? recent.map((b, i) => `<span class="bdg-stack-i" style="z-index:${4 - i}">${medalHtml(b, 40)}</span>`).join('')
    : `<span class="bdg-stack-i">${medalHtml({ ...all[0], done: false, pct: 0 }, 40)}</span>`;
  const tile = (b) => `<button class="bdg-tile" data-act="badges" data-id="${b.id}" style="--c:${b.color}" aria-label="${esc(`${b.name}. ${b.desc} ${badgeProgress(b)}.`)}">
      ${medalHtml(b, 48)}
      <b>${esc(b.name)}</b>
      <span class="bar"><i style="width:${(b.pct * 100).toFixed(1)}%"></i></span>
      <small>${badgeProgress(b)}</small>
    </button>`;
  return `${groupHead('h-bdg', 'Erfolge')}
    <section class="bdg" data-k="bdg">
      <button class="bdg-sum" data-act="badges">
        <span class="bdg-stack">${stack}</span>
        <span class="bdg-sum-t"><b>${got.length} von ${all.length}</b><span>${got.length ? 'freigeschaltet' : 'Dein erster Erfolg wartet schon'}</span></span>
        ${I.right}
      </button>
      ${
        next.length
          ? `<p class="bdg-next-h">Als Nächstes dran</p><div class="bdg-next">${next.map(tile).join('')}</div>`
          : `<p class="bdg-next-h">Alle Erfolge geholt. Respekt.</p>`
      }
    </section>`;
}

/** The gallery sheet: one badge in detail on top, all of them below. */
function badgesBody(sh) {
  const all = badgeList();
  const sel = all.find((b) => b.id === sh.sel) || badgesNextUp(1)[0] || all[0];
  const state = sel.done
    ? `<span class="bdg-state ok">${I.check}${sel.on ? `Freigeschaltet am ${esc(fmtDay(sel.on))}` : 'Freigeschaltet'}</span>`
    : `<span class="bar"><i style="width:${(sel.pct * 100).toFixed(1)}%"></i></span><span class="bdg-state">${badgeProgress(sel)}</span>`;
  const detail = `<div class="bdg-detail" data-k="bdg-detail" style="--c:${sel.color}" aria-live="polite">
      ${medalHtml(sel, 76)}
      <div class="bdg-detail-t"><b>${esc(sel.name)}</b><span>${esc(sel.desc)}</span>${state}</div>
    </div>`;
  const cell = (b) => `<button class="bdg-cell ${b.id === sel.id ? 'sel' : ''} ${b.done ? 'done' : ''}" data-act="badge" data-fx="tab" data-id="${b.id}" style="--c:${b.color}"
        aria-pressed="${b.id === sel.id}" aria-label="${esc(`${b.name}, ${b.done ? 'freigeschaltet' : badgeProgress(b)}`)}">
      ${medalHtml(b, 54)}
      <span>${esc(b.name)}</span>
    </button>`;
  const groups = BADGE_GROUPS.map((g) => {
    const list = all.filter((b) => b.group === g.id);
    return `<section class="bdg-group" data-k="g-${g.id}">
        <h3>${esc(g.name)}<small>${list.filter((b) => b.done).length} / ${list.length}</small></h3>
        <div class="bdg-grid">${list.map(cell).join('')}</div>
      </section>`;
  }).join('');
  return detail + groups;
}

/* ---------------------------------------------------------- Wochenrückblick */
function weekData(mon, today = todayStr()) {
  const d = derived();
  const end = addDays(mon, 6);
  const days = [];
  const cats = {};
  const addCat = (id, xp) => {
    const key = id && getCat(id) ? id : '';
    cats[key] = (cats[key] || 0) + xp;
  };
  let xp = 0;
  let n = 0;
  let perfect = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDays(mon, i);
    const entries = d.byDate[date] || [];
    const v = d.xpDay[date] || 0;
    for (const e of entries) addCat(e.catId, e.xp);
    if (date <= today) {
      const st = dayStat(date);
      if (st.total > 0 && st.done === st.total) perfect++;
    }
    days.push({ date, xp: v, n: entries.length, future: date > today, today: date === today });
    xp += v;
    n += entries.length;
  }
  let goals = 0;
  for (const g of live('goals')) {
    if (!g.doneAt || !g.doneOn || g.doneOn < mon || g.doneOn > end) continue;
    goals++;
    addCat(g.catId, g.xp || 0);
  }
  return { days, cats, xp, n, goals, perfect };
}

function weekReview() {
  const t = todayStr();
  const d = derived();
  const cur = weekStart(t);
  const firstDate = Object.keys(d.xpDay).sort()[0];
  const minWeek = firstDate ? weekStart(firstDate) : cur;
  const mon = ui.insWeek && ui.insWeek <= cur ? ui.insWeek : cur;
  const isCur = mon === cur;
  const w = weekData(mon, t);
  const title = isCur ? 'Diese Woche' : mon === addDays(cur, -7) ? 'Letzte Woche' : `Kalenderwoche ${isoWeek(mon)}`;

  /* Compared with the same stretch of the week before. */
  const span = isCur ? weekdayOf(t) : 7;
  let prev = 0;
  for (let i = 0; i < span; i++) prev += d.xpDay[addDays(mon, i - 7)] || 0;
  const diff = w.xp - prev;
  const upTo = isCur && span < 7 ? ` bis ${WD_LONG[span]}` : '';
  let delta = '';
  if (!w.xp && (isCur || !prev)) {
    delta = `<p class="wkc-delta">${isCur ? 'Neue Woche, alles offen. Der erste Haken zählt.' : 'Eine ruhige Woche.'}</p>`;
  } else if (!diff) {
    delta = `<p class="wkc-delta">Gleichauf mit der Vorwoche${upTo}</p>`;
  } else {
    delta = `<p class="wkc-delta ${diff > 0 ? 'up' : 'down'}"><i aria-hidden="true">${diff > 0 ? '▲' : '▼'}</i>${num(Math.abs(diff))} XP ${diff > 0 ? 'mehr' : 'weniger'} als ${isCur ? 'letzte Woche' : 'in der Woche davor'}${upTo}</p>`;
  }

  /* One hue, seven bars. Behind each one, pale and wider, the same weekday of the week before.
     Only the best day carries its number; the rest is in the tip line. */
  const before = w.days.map((x) => d.xpDay[addDays(x.date, -7)] || 0);
  const hasBefore = before.some((v) => v > 0);
  const max = Math.max(1, ...w.days.map((x) => x.xp), ...before);
  const best = w.days.reduce((a, b) => (b.xp > a.xp ? b : a), w.days[0]);
  const PLOT = 92;
  const px = (v) => (v ? Math.max(5, Math.round((v / max) * PLOT)) : 0);
  const labelOf = (x, i) => {
    const was = before[i] ? ` · Vorwoche ${num(before[i])} XP` : '';
    return x.future
      ? `${fmtWdShort(x.date)}: liegt noch vor dir${was}`
      : `${fmtWdShort(x.date)}: ${num(x.xp)} XP${x.n ? `, ${plural(x.n, 'Aufgabe', 'Aufgaben')}` : ''}${was}`;
  };
  const selAt = w.days.findIndex((x) => x.date === ui.insDay);
  const sel = w.days[selAt];
  const rest = sel ? labelOf(sel, selAt) : hasBefore ? 'Blass dahinter: die Woche davor' : 'Tippe auf einen Balken für die Zahlen';
  const bars = w.days
    .map((x, i) => {
      const label = labelOf(x, i);
      return `<button class="wkc-col ${x.today ? 'now' : ''} ${x.future ? 'future' : ''} ${x.xp ? '' : 'zero'} ${x === sel ? 'sel' : ''}" data-act="ins-day" data-fx="none" data-date="${x.date}" data-tip="${esc(label)}" aria-pressed="${x === sel}" aria-label="${esc(label)}">
          <span class="wkc-plot"><u style="height:${px(before[i])}px"></u>${x === best && x.xp ? `<em>${num(x.xp)}</em>` : ''}<i style="height:${px(x.xp)}px"></i></span>
          <span class="wkc-wd">${WD_SHORT[weekdayOf(x.date)]}</span>
        </button>`;
    })
    .join('');

  const bestWd = best.xp ? WD_SHORT[weekdayOf(best.date)] : '–';
  const facts = `<dl class="stats three">
      <div><dt>Erledigt</dt><dd>${w.n + w.goals}</dd></div>
      <div><dt>Bester Tag</dt><dd>${bestWd}${best.xp ? `<small> ${num(best.xp)} XP</small>` : ''}</dd></div>
      <div><dt>Perfekte Tage</dt><dd>${w.perfect}<small> von ${span}</small></dd></div>
    </dl>`;

  /* Where the XP came from: labelled rows, the colour only repeats the label. */
  let rows = Object.entries(w.cats)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  if (rows.length > 6) {
    const rest = rows.slice(5).reduce((sum, [, v]) => sum + v, 0);
    rows = [...rows.slice(0, 5), ['+', rest]];
  }
  const catMax = rows.length ? Math.max(...rows.map(([, v]) => v)) : 1;
  const catRows = rows
    .map(([id, v]) => {
      const c = getCat(id);
      const name = c ? `${esc(c.emoji)} ${esc(c.name)}` : id === '+' ? 'Weitere' : 'Ohne Kategorie';
      return `<li style="--c:${c ? c.color : '#9C99B7'}"><span class="wkc-cat">${name}</span><span class="bar"><i style="width:${((v / catMax) * 100).toFixed(1)}%"></i></span><b>${num(v)}</b></li>`;
    })
    .join('');

  return `${groupHead('h-week', 'Wochenrückblick')}
    <section class="wkc" data-k="wkc" aria-label="Wochenrückblick, ${esc(title)}">
      <div class="period">
        <button class="icon-btn" data-act="ins-week" data-dir="-1" aria-label="Woche davor" ${mon <= minWeek ? 'disabled' : ''}>${I.left}</button>
        <div class="period-t"><b>${esc(title)}</b><span>${esc(fmtWeekRange(mon))}</span></div>
        <button class="icon-btn" data-act="ins-week" data-dir="1" aria-label="Woche danach" ${isCur ? 'disabled' : ''}>${I.right}</button>
      </div>
      <div class="wkc-hero">
        <p class="wkc-xp"><b>${num(w.xp)}</b><small>XP</small></p>
        ${delta}
      </div>
      <div class="wkc-chart" role="group" aria-label="XP pro Tag">${bars}</div>
      <p class="wkc-tip" id="insTip" data-rest="${esc(rest)}">${esc(rest)}</p>
      ${facts}
      ${catRows ? `<ul class="wkc-cats" aria-label="XP nach Kategorie">${catRows}</ul>` : ''}
    </section>`;
}

/* ------------------------------------------------------------------- Himmel */
function skyPreview(c) {
  const R = 7;
  const cx = 87;
  const cy = 43;
  const rings = [11, 8.2, 6.1, 4.5, 3.3, 2.4, 1.65]
    .map((k, i) => `<circle cx="${cx}" cy="${cy}" r="${(R * k).toFixed(1)}" fill="${c.bands[i + 1]}"/>`)
    .join('');
  return `<svg class="sky-pic" viewBox="0 0 120 78" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="120" height="78" fill="${c.bands[0]}"/>${rings}
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="${c.sun}"/>
      <path d="M0 57c16-7 30-6 46-1s34 5 50-2 18-4 24-2v26H0z" fill="${c.far}"/>
      <path d="M0 65c20-6 36 2 56-1s40-9 64-2v16H0z" fill="${c.mid}"/>
      <path d="M0 72c24-5 44 3 68 0s36-4 52-1v7H0z" fill="${c.near}"/>
    </svg>`;
}

function skySection() {
  const level = totalLevel(derived().xpTotal).level;
  const cards = Scene.themes()
    .map((t) => {
      const open = level >= t.level;
      const label = open ? `${t.name}${t.active ? ', ausgewählt' : ''}` : `${t.name}, gesperrt bis Level ${t.level}`;
      const mark = !open ? `<span class="sky-mark">${LOCK}</span>` : t.active ? `<span class="sky-mark on">${I.check}</span>` : '';
      return `<button class="sky-card ${t.active ? 'on' : ''} ${open ? '' : 'locked'}" data-k="sky-${t.id}" data-act="set-sky" data-fx="none" data-id="${t.id}" aria-pressed="${t.active}" aria-label="${esc(label)}">
          <span class="sky-frame">${skyPreview(t.colors)}${mark}</span>
          <span class="sky-name">${esc(t.name)}</span>
          <span class="sky-note">${open ? esc(t.note) : `Ab Level ${t.level}`}</span>
        </button>`;
    })
    .join('');
  return `${groupHead('h-sky', 'Himmel')}<div class="sky-strip" data-k="sky-strip">${cards}</div>`;
}
