/* ==================================================================== VIEWS
   Each view returns an HTML string; morph() patches it into the page. */

const ic = (inner) =>
  `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const I = {
  sun: ic('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'),
  target: ic('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
  bell: ic('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
  peak: ic('<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>'),
  plus: ic('<path d="M5 12h14M12 5v14"/>'),
  sliders: ic('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'),
  left: ic('<path d="m15 18-6-6 6-6"/>'),
  right: ic('<path d="m9 18 6-6-6-6"/>'),
  calendar: ic('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  trash: ic('<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  repeat: ic('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
  arrow: ic('<path d="M5 12h14M12 5l7 7-7 7"/>'),
  x: ic('<path d="M18 6 6 18M6 6l12 12"/>'),
  check: ic('<path d="M20 6 9 17l-5-5"/>'),
  flame: ic('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
  layers: ic('<path d="m12 2 10 5-10 5L2 7l10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>'),
  cloud: ic('<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/>'),
  down: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
  up: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'),
  pencil: ic('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
  trophy: ic('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/>'),
  phone: ic('<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>'),
  clock: ic('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  back: ic('<path d="M19 12H5M12 19l-7-7 7-7"/>'),
};

const BRAND = `<svg viewBox="0 0 40 40" class="brand" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#F0663B"/><circle cx="20" cy="24" r="15" fill="#FA9537"/><circle cx="20" cy="24" r="10.5" fill="#FEC447"/><circle cx="20" cy="24" r="6.5" fill="#FFF7CC"/><path d="M0 28c7-5 12-5 20-1s14 3 20-1v14H0z" fill="#1A1130"/></svg>`;

const CHECK_SVG = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle class="c-ring" cx="16" cy="16" r="13"/><circle class="c-fill" cx="16" cy="16" r="13"/><path class="c-mark" pathLength="1" d="M10 16.5l4.2 4.2L22.5 12"/></svg>`;

const colorOf = (cat) => (cat ? cat.color : '#FFC145');
const catMeta = (cat) => (cat ? `<span class="m">${esc(cat.emoji)} ${esc(cat.name)}</span>` : '');

/* ------------------------------------------------------------- Navigation */
const TABS = [
  ['today', 'Heute', I.sun],
  ['goals', 'Ziele', I.target],
  ['rems', 'Erinnerungen', I.bell],
  ['levels', 'Level', I.peak],
];

function navHtml() {
  const item = ([id, label, icon]) =>
    `<button class="nav-item ${ui.tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}" data-fx="tab" aria-current="${ui.tab === id ? 'page' : 'false'}">${icon}<span>${label}</span></button>`;
  return {
    tabbar:
      item(TABS[0]) +
      item(TABS[1]) +
      `<button class="add-sun" data-act="add" data-fx="none" aria-label="Neu anlegen"><span>${I.plus}</span></button>` +
      item(TABS[2]) +
      item(TABS[3]),
    rail:
      `<div class="rail-brand">${BRAND}<span>Tagwerk</span></div>` +
      `<button class="add-sun" data-act="add" data-fx="none" aria-label="Neu anlegen" title="Neu anlegen (N)"><span>${I.plus}</span></button>` +
      `<div class="rail-items">${TABS.map(item).join('')}</div>` +
      `<button class="nav-item rail-settings" data-act="settings">${I.sliders}<span>Einstellungen</span></button>`,
  };
}

/* ------------------------------------------------------------ Sky content */
function sceneTexts() {
  const t = todayStr();
  if (ui.tab === 'today') {
    const rel = relDay(ui.date, t);
    return {
      eyebrow: rel ? `${rel} · ${fmtDay(ui.date)}` : `${fmtDay(ui.date)} ${ui.date.slice(0, 4)}`,
      title: WD_LONG[weekdayOf(ui.date)],
    };
  }
  if (ui.tab === 'goals') return { eyebrow: `KW ${isoWeek(t)} · ${MONTHS[fromYmd(t).getMonth()]}`, title: 'Ziele' };
  if (ui.tab === 'rems') return { eyebrow: 'Nichts vergessen', title: 'Erinnerungen' };
  return { eyebrow: 'Dein Fortschritt', title: 'Level' };
}

function sceneButtons() {
  const t = todayStr();
  let h = '';
  if (ui.tab === 'today' && ui.date !== t) {
    h += `<button class="sky-btn sky-today" data-act="go-today" title="Zu heute springen (T)">Heute</button>`;
  }
  if (ui.tab === 'today') h += `<button class="sky-btn" data-act="open-calendar" aria-label="Datum wählen">${I.calendar}</button>`;
  h += `<button class="sky-btn only-phone" data-act="settings" aria-label="Einstellungen">${I.sliders}</button>`;
  return h;
}

function footHtml() {
  const t = todayStr();
  const d = derived();
  const total = totalLevel(d.xpTotal);
  const levelBlock = `
    <button class="foot-level" data-act="tab" data-tab="levels" aria-label="Zum Level-Tab">
      <span class="foot-level-top"><b>Level ${total.level}</b><span>${rankOf(total.level)}</span></span>
      <span class="bar"><i style="width:${(total.pct * 100).toFixed(1)}%"></i></span>
      <span class="foot-level-sub">${total.into} / ${total.need} XP</span>
    </button>`;
  const lvPill = `<button class="pill only-phone" data-act="tab" data-tab="levels">Lv <b>${total.level}</b></button>`;
  const streak = streakInfo(t);
  const streakPill = streak.n ? `<span class="pill ${streak.doneToday ? 'lit' : ''}" title="${plural(streak.n, 'Tag', 'Tage')} in Folge">${I.flame}<b>${streak.n}</b></span>` : '';

  if (ui.tab === 'today') {
    const st = dayStat(ui.date);
    const future = ui.date > t;
    const xp = d.xpDay[ui.date] || 0;
    const mini = `<span class="foot-mini">${esc(fmtWdShort(ui.date))}</span>`;
    return `
      <div class="foot-left">${mini}
        <span class="foot-count">${future ? `<b>${st.total}</b>` : `<b>${st.done}</b><i>/${st.total}</i>`}</span>
        <span class="foot-label">${future ? 'geplant' : 'erledigt'}</span>
      </div>
      <div class="foot-right">
        ${future && !st.xp ? '' : `<span class="pill xp" id="xpPill">${future ? `<b>${st.xp}</b> XP möglich` : `<b>+${xp}</b> XP`}</span>`}
        ${streakPill}${lvPill}
      </div>${levelBlock}`;
  }
  if (ui.tab === 'goals') {
    const week = goalsFor('week', currentPeriod('week', t));
    const month = goalsFor('month', currentPeriod('month', t));
    const done = (l) => l.filter((g) => g.doneAt).length;
    return `
      <div class="foot-left"><span class="foot-count"><b>${done(week)}</b><i>/${week.length}</i></span><span class="foot-label">diese Woche</span></div>
      <div class="foot-right"><span class="pill"><b>${done(month)}/${month.length}</b> im Monat</span>${lvPill}</div>${levelBlock}`;
  }
  if (ui.tab === 'rems') {
    const upcoming = live('rems')
      .filter((r) => !(r.kind === 'once' && r.doneAt))
      .map((r) => ({ r, occ: nextOf(r, t) }))
      .filter((x) => x.occ >= t)
      .sort((a, b) => (a.occ < b.occ ? -1 : 1))[0];
    return `
      <div class="foot-left foot-next">${
        upcoming
          ? `<span class="foot-label">Als Nächstes, ${countdown(diffDays(upcoming.occ, t))}</span><span class="foot-next-t">${esc(upcoming.r.title)}</span>`
          : `<span class="foot-label">Gerade steht nichts an</span>`
      }</div>
      <div class="foot-right">${lvPill}</div>${levelBlock}`;
  }
  return `
    <div class="foot-left"><span class="foot-count"><b>${total.need - total.into}</b></span><span class="foot-label">XP bis Level ${total.level + 1}</span></div>
    <div class="foot-right">${streakPill}</div>${levelBlock}`;
}

/* ------------------------------------------------------------- Week strip */
function dayCell(date, sel) {
  const t = todayStr();
  const st = dayStat(date);
  const pct = st.total ? (st.done / st.total) * 100 : 0;
  const hasRem = remsForDay(date).some((r) => r.until === 0);
  const ring = st.total
    ? `<svg class="wd-ring" viewBox="0 0 40 40" aria-hidden="true"><circle class="tr" cx="20" cy="20" r="18"/><circle class="pr ${pct ? '' : 'none'}" cx="20" cy="20" r="18" pathLength="100" stroke-dasharray="${pct.toFixed(1)} 100"/></svg>`
    : '';
  const label = `${WD_LONG[weekdayOf(date)]}, ${fmtDay(date)}${st.total ? `, ${st.done} von ${st.total} erledigt` : ''}`;
  return `<button class="wd ${date === sel ? 'sel' : ''} ${date === t ? 'today' : ''} ${st.total && st.done === st.total ? 'full' : ''}" data-act="day" data-date="${date}" aria-label="${esc(label)}">
      <span class="wd-name">${WD_SHORT[weekdayOf(date)]}</span>
      <span class="wd-num">${ring}<b>${fromYmd(date).getDate()}</b></span>
      <span class="wd-dot ${hasRem ? 'on' : ''}"></span>
    </button>`;
}

function weekStrip(date) {
  const mon = weekStart(date);
  const page = (m) => `<div class="wk">${Array.from({ length: 7 }, (_, i) => dayCell(addDays(m, i), date)).join('')}</div>`;
  return `<div class="strip" data-k="strip">
    <button class="wk-arrow" data-act="week" data-dir="-1" aria-label="Vorherige Woche">${I.left}</button>
    <div class="wk-view"><div class="wk-track">${page(addDays(mon, -7))}${page(mon)}${page(addDays(mon, 7))}</div></div>
    <button class="wk-arrow" data-act="week" data-dir="1" aria-label="Nächste Woche">${I.right}</button>
  </div>`;
}

/* ------------------------------------------------------------------ Rows */
function taskRow(task, date, done, opts = {}) {
  const cat = getCat(task.catId);
  const meta = [];
  if (cat) meta.push(catMeta(cat));
  if (opts.overdue) meta.push(`<span class="m late">seit ${esc(fmtDayShort(task.date))}</span>`);
  if (task.repeat) {
    meta.push(`<span class="m">${I.repeat}${esc(repeatLabel(task.repeat))}</span>`);
    const n = routineStreak(task, todayStr() < date ? todayStr() : date);
    if (n >= 2) meta.push(`<span class="m hot">${I.flame}${n}×</span>`);
  }
  const attrs = `data-id="${task.id}" data-date="${date}"`;
  return `<div class="row-wrap" data-k="${task.id}|${date}" data-flip ${opts.drag ? 'data-drag' : ''} style="--i:${opts.i || 0}">
    <div class="row-under" aria-hidden="true">
      <span class="u u-done">${I.check}Erledigt</span>
      <span class="u u-move">Morgen${I.arrow}</span>
      <span class="u u-del">Löschen${I.trash}</span>
    </div>
    <div class="row ${done ? 'done' : ''}" style="--c:${colorOf(cat)}" data-swipe ${attrs}>
      <button class="chk" data-act="toggle" data-fx="none" ${attrs} aria-pressed="${done}" aria-label="${esc(task.title)} ${done ? 'wieder öffnen' : 'erledigen'}">${CHECK_SVG}</button>
      <button class="row-main" data-act="edit-task" ${attrs}>
        <span class="row-title"><span class="t">${esc(task.title)}</span></span>
        ${meta.length ? `<span class="row-meta">${meta.join('')}</span>` : ''}
      </button>
      <span class="row-tools">
        ${done ? '' : `<button class="tool" data-act="move-tomorrow" ${attrs} title="Auf morgen schieben" aria-label="Auf morgen schieben">${I.arrow}</button>`}
        <button class="tool" data-act="delete-task" data-fx="none" ${attrs} title="Löschen" aria-label="Löschen">${I.trash}</button>
      </span>
      <span class="stamp">+${task.xp}</span>
    </div>
  </div>`;
}

function remWhen(rem, occ, until, late) {
  if (late) return `Überfällig seit ${fmtDayShort(occ)}`;
  const at = rem.time ? ` um ${rem.time}` : '';
  if (until === 0) return `Heute${at}`;
  if (until === 1) return `Morgen${at}`;
  return `In ${until} Tagen, ${fmtWdShort(occ)}${at}`;
}
function ageText(rem, occ) {
  const age = ageAt(rem, occ);
  if (!age || age < 1) return '';
  return /geburtstag/i.test(rem.title) ? ` · wird ${age}` : ` · ${age} Jahre`;
}

function remRow({ rem, occ, until, late }) {
  return `<div class="rem-row ${late ? 'late' : ''}" data-k="r-${rem.id}" data-flip>
    <span class="rem-ic">${rem.kind === 'yearly' ? I.repeat : I.bell}</span>
    <button class="rem-main" data-act="edit-rem" data-id="${rem.id}">
      <span class="rem-title">${esc(rem.title)}</span>
      <span class="rem-sub">${esc(remWhen(rem, occ, until, late))}${esc(ageText(rem, occ))}</span>
    </button>
    <button class="rem-ok" data-act="dismiss-rem" data-fx="none" data-id="${rem.id}" data-occ="${occ}" data-until="${until}" aria-label="${esc(rem.title)} abhaken" title="Abhaken, bringt keine XP">${I.check}</button>
  </div>`;
}

const groupHead = (key, label, extra = '') => `<div class="gh" data-k="${key}"><span>${label}</span>${extra}</div>`;

/* ----------------------------------------------------------------- Heute */
const demoBanner = () =>
  hasDemo()
    ? `<div class="demo-line" data-k="n-demo"><span><b>Beispieldaten</b> zum Ausprobieren</span><button class="demo-x" data-act="remove-demo">Entfernen</button></div>`
    : '';

const installBanner = () =>
  canSuggestInstall()
    ? `<div class="note" data-k="n-install">
        <p><b>Leg Tagwerk auf deinen Home-Bildschirm.</b> Dann öffnet es sich wie eine echte App, mit eigenem Icon und ohne Browserleiste.</p>
        <div class="note-btns"><button class="btn small" data-act="install">Zeig mir wie</button><button class="btn small ghost" data-act="dismiss-install">Später</button></div>
      </div>`
    : '';

function viewToday() {
  const date = ui.date;
  const t = todayStr();
  const isToday = date === t;
  const items = dayTasks(date);
  const open = items.filter((x) => !x.done);
  const done = items.filter((x) => x.done);
  const over = isToday ? overdueTasks(t) : [];
  const rems = remsForDay(date);
  const label = relDay(date, t) || WD_LONG[weekdayOf(date)];
  const parts = [];
  let i = 0;

  if (rems.length) {
    parts.push(groupHead('h-rem', 'Denk dran'));
    rems.forEach((r) => parts.push(remRow(r)));
  }
  if (over.length) {
    parts.push(groupHead('h-over', 'Überfällig'));
    over.forEach((task) => parts.push(taskRow(task, task.date, false, { overdue: true, i: i++ })));
  }
  parts.push(
    groupHead('h-tasks', 'Aufgaben', `<button class="gh-btn" data-act="add" data-pane="tpl">${I.layers}Vorlagen</button>`),
  );
  if (!items.length && !over.length) {
    parts.push(`<div class="empty" data-k="empty">
      <p class="empty-t">${date < t ? 'An diesem Tag war nichts geplant.' : `Für ${esc(label === 'Heute' ? 'heute' : label === 'Morgen' ? 'morgen' : label === 'Übermorgen' ? 'übermorgen' : label)} ist noch nichts geplant.`}</p>
      <p>Leg eine Aufgabe an oder nimm eine aus deinen Vorlagen. Jede erledigte Aufgabe hebt die Sonne ein Stück höher.</p>
    </div>`);
  }
  open.forEach(({ task }) => parts.push(taskRow(task, date, false, { i: i++, drag: open.length > 1 })));
  parts.push(
    `<button class="add-row" data-k="add-row" data-act="add" data-flip>${I.plus}Aufgabe für ${esc(label === 'Heute' || label === 'Morgen' || label === 'Übermorgen' ? label.toLowerCase() : label)}</button>`,
  );
  if (items.length && !open.length && !over.length) {
    parts.push(`<div class="perfect" data-k="perfect">
      <p class="perfect-t">Tagwerk vollbracht.</p>
      <p>Alles erledigt, die Sonne steht ganz oben. +${dayStat(date).xpDone} XP an diesem Tag.</p>
    </div>`);
  }
  if (done.length) {
    parts.push(groupHead('h-done', `Erledigt · ${done.length}`));
    done.forEach(({ task }) => parts.push(taskRow(task, date, true)));
  }

  const dirClass = ui.dayDir > 0 ? 'turn-next' : ui.dayDir < 0 ? 'turn-prev' : '';
  return `<div class="page has-aside" data-k="today">
    <div class="col-main">
      ${weekStrip(date)}
      ${demoBanner()}
      <div class="list ${dirClass}" data-k="day-${date}">${parts.join('')}</div>
      ${installBanner()}
    </div>
    ${asideToday()}
  </div>`;
}

/* The extra column on large screens: everything else at a glance. */
function asideToday() {
  const t = todayStr();
  const week = goalsFor('week', currentPeriod('week', t));
  const up = live('rems')
    .filter((r) => !(r.kind === 'once' && r.doneAt))
    .map((rem) => ({ rem, occ: nextOf(rem, t) }))
    .filter((x) => x.occ >= t)
    .sort((a, b) => (a.occ < b.occ ? -1 : 1))
    .slice(0, 4);
  const d = derived();
  return `<aside class="aside" data-k="aside">
    <section>
      <button class="aside-h" data-act="tab" data-tab="goals">Wochenziele ${I.right}</button>
      ${week.length ? week.map((g) => `
        <button class="aside-goal ${g.doneAt ? 'done' : ''}" data-act="edit-goal" data-id="${g.id}">
          <span class="dot" style="background:${colorOf(getCat(g.catId))}"></span><span class="at">${esc(g.title)}</span><span class="ax">+${g.xp}</span>
        </button>`).join('') : '<p class="aside-empty">Für diese Woche ist noch kein Ziel gesetzt.</p>'}
    </section>
    <section>
      <button class="aside-h" data-act="tab" data-tab="rems">Bald ${I.right}</button>
      ${up.length ? up.map(({ rem, occ }) => `
        <button class="aside-rem" data-act="edit-rem" data-id="${rem.id}">
          <span class="at">${esc(rem.title)}</span><span class="ax">${esc(countdown(diffDays(occ, t)))}</span>
        </button>`).join('') : '<p class="aside-empty">Keine Erinnerungen in Sicht.</p>'}
    </section>
    <section>
      <button class="aside-h" data-act="tab" data-tab="levels">Kategorien ${I.right}</button>
      ${sortedCats().map((c) => {
        const l = catLevel(d.xpCat[c.id] || 0);
        return `<div class="aside-cat" style="--c:${c.color}"><span class="ac-top"><span>${esc(c.emoji)} ${esc(c.name)}</span><b>Lv ${l.level}</b></span><span class="bar"><i style="width:${(l.pct * 100).toFixed(1)}%"></i></span></div>`;
      }).join('')}
    </section>
  </aside>`;
}

/* ----------------------------------------------------------------- Ziele */
function goalDeadline(g) {
  const t = todayStr();
  if (g.doneAt) return `Geschafft am ${fmtDayShort(g.doneOn)}`;
  if (g.kind === 'big') {
    if (!g.target) return '';
    const n = diffDays(g.target, t);
    return n >= 0 ? `Bis ${fmtDayShort(g.target)} ${g.target.slice(0, 4)}, noch ${plural(n, 'Tag', 'Tage')}` : `Ziel war ${fmtDayShort(g.target)} ${g.target.slice(0, 4)}`;
  }
  if (g.kind === 'week') {
    const end = addDays(g.period, 6);
    const n = diffDays(end, t);
    if (n >= 0 && n <= 6) return n === 0 ? 'Letzter Tag' : `Noch ${plural(n, 'Tag', 'Tage')}`;
    return '';
  }
  if (g.period === monthOf(t)) {
    const [y, m] = g.period.split('-').map(Number);
    const n = daysInMonth(y, m) - fromYmd(t).getDate();
    return n === 0 ? 'Letzter Tag' : `Noch ${plural(n, 'Tag', 'Tage')}`;
  }
  return '';
}

function goalCard(g, opts = {}) {
  const cat = getCat(g.catId);
  const steps = g.steps || [];
  const doneSteps = steps.filter((s) => s.done).length;
  const deadline = goalDeadline(g);
  return `<article class="goal ${g.doneAt ? 'is-done' : ''}" data-k="g-${g.id}" data-flip style="--c:${colorOf(cat)}">
    <div class="goal-top">
      <button class="goal-main" data-act="edit-goal" data-id="${g.id}">
        <span class="goal-title">${esc(g.title)}</span>
        <span class="row-meta">${catMeta(cat)}${deadline ? `<span class="m">${esc(deadline)}</span>` : ''}${opts.stale ? `<span class="m late">${g.kind === 'week' ? `aus KW ${isoWeek(g.period)}` : `aus ${esc(fmtMonth(g.period))}`}</span>` : ''}</span>
      </button>
      ${g.doneAt
        ? `<span class="goal-won">${I.trophy}<b>+${g.xp}</b></span>`
        : `<button class="hold ${steps.length && doneSteps === steps.length ? 'ready' : ''}" data-hold="${g.id}" data-fx="none" aria-label="${esc(g.title)} abschließen, ${g.xp} XP. Gedrückt halten.">
            <svg viewBox="0 0 64 64" aria-hidden="true"><circle class="h-track" cx="32" cy="32" r="29"/><circle class="h-fill" cx="32" cy="32" r="29" pathLength="100"/></svg>
            <span class="hold-core"><b>+${g.xp}</b><small>halten</small></span>
          </button>`}
    </div>
    ${steps.length && !g.doneAt ? `
      <div class="goal-progress"><span class="bar"><i style="width:${((doneSteps / steps.length) * 100).toFixed(1)}%"></i></span><span class="gp-n">${doneSteps}/${steps.length}</span></div>
      <div class="steps">${steps.map((s, i) => `
        <button class="step ${s.done ? 'on' : ''}" data-k="${s.id}" data-act="toggle-step" data-fx="none" data-goal="${g.id}" data-step="${s.id}" data-i="${i}" aria-pressed="${!!s.done}">
          <span class="step-box">${I.check}</span><span>${esc(s.t)}</span>
        </button>`).join('')}
      </div>` : ''}
    ${opts.stale ? `<div class="goal-carry"><button class="btn small" data-act="carry-goal" data-id="${g.id}">In diese ${g.kind === 'week' ? 'Woche' : 'Zeit'} übernehmen</button></div>` : ''}
  </article>`;
}

function segmented(act, options, value, extraAttr = '') {
  const idx = Math.max(0, options.findIndex(([v]) => v === value));
  return `<div class="seg" style="--n:${options.length};--i:${idx}" role="group">
    <span class="seg-ind" aria-hidden="true"></span>
    ${options.map(([v, label]) => `<button class="${v === value ? 'on' : ''}" data-act="${act}" data-val="${esc(v)}" ${extraAttr} aria-pressed="${v === value}">${label}</button>`).join('')}
  </div>`;
}

function viewGoals() {
  const k = ui.goalKind;
  const t = todayStr();
  const period = k === 'week' ? ui.goalWeek : k === 'month' ? ui.goalMonth : null;
  const list = goalsFor(k, period);
  const open = list.filter((g) => !g.doneAt);
  const done = list.filter((g) => g.doneAt);
  const isCurrent = period === currentPeriod(k, t);
  const stale = isCurrent ? staleGoals(k, period) : [];
  let nav = '';
  if (k === 'week') {
    const rel = isCurrent ? 'Diese Woche' : period === addDays(currentPeriod('week', t), 7) ? 'Nächste Woche' : period === addDays(currentPeriod('week', t), -7) ? 'Letzte Woche' : `KW ${isoWeek(period)}`;
    nav = periodNav(rel, fmtWeekRange(period));
  } else if (k === 'month') {
    const rel = isCurrent ? 'Dieser Monat' : period === addMonths(currentPeriod('month', t), 1) ? 'Nächster Monat' : fmtMonth(period);
    nav = periodNav(rel, isCurrent || period === addMonths(currentPeriod('month', t), 1) ? fmtMonth(period) : '');
  }
  const parts = [];
  if (stale.length) {
    parts.push(groupHead('h-stale', 'Noch offen von früher'));
    stale.forEach((g) => parts.push(goalCard(g, { stale: true })));
    parts.push(groupHead('h-now', k === 'week' ? 'Diese Woche' : 'Dieser Monat'));
  }
  if (!list.length) {
    const hint = { week: 'Was soll bis Sonntag stehen?', month: 'Was willst du diesen Monat schaffen?', big: 'Was ist das eine Große, auf das du hinarbeitest?' }[k];
    parts.push(`<div class="empty" data-k="empty"><p class="empty-t">${hint}</p><p>Ziele bringen deutlich mehr XP als einzelne Aufgaben. Zum Abschließen hältst du den Knopf gedrückt.</p></div>`);
  }
  open.forEach((g) => parts.push(goalCard(g)));
  parts.push(`<button class="add-row" data-k="add-goal" data-act="add" data-pane="goal" data-flip>${I.plus}${{ week: 'Wochenziel', month: 'Monatsziel', big: 'Großes Ziel' }[k]} hinzufügen</button>`);
  if (done.length) {
    parts.push(groupHead('h-done', `Geschafft · ${done.length}`));
    done.forEach((g) => parts.push(goalCard(g)));
  }
  return `<div class="page" data-k="goals">
    ${segmented('goal-kind', [['week', 'Woche'], ['month', 'Monat'], ['big', 'Groß']], k)}
    ${nav}
    <div class="list" data-k="goals-${k}-${period}">${parts.join('')}</div>
  </div>`;
}

const periodNav = (title, sub) => `<div class="period">
  <button class="icon-btn" data-act="goal-period" data-dir="-1" aria-label="Zurück">${I.left}</button>
  <div class="period-t"><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>
  <button class="icon-btn" data-act="goal-period" data-dir="1" aria-label="Weiter">${I.right}</button>
</div>`;

/* ---------------------------------------------------------- Erinnerungen */
function remTile(rem, occ, opts = {}) {
  const t = todayStr();
  const d = fromYmd(occ);
  const n = diffDays(occ, t);
  const when = opts.history ? `Erledigt` : n < 0 ? `Überfällig seit ${fmtDayShort(occ)}` : countdown(n);
  const sub = `${when.charAt(0).toUpperCase()}${when.slice(1)}${rem.time ? ` · ${rem.time}` : ''}${esc(ageText(rem, occ))}`;
  const soon = n >= 0 && n <= 7 && !opts.history;
  return `<div class="rem-card ${soon ? 'soon' : ''} ${n < 0 && !opts.history ? 'late' : ''} ${opts.history ? 'history' : ''}" data-k="rc-${rem.id}" data-flip>
    <button class="rem-card-main" data-act="edit-rem" data-id="${rem.id}">
      <span class="date-tile"><b>${d.getDate()}</b><small>${MONTHS_SHORT[d.getMonth()]}</small></span>
      <span class="rem-card-txt"><span class="rem-title">${esc(rem.title)}</span><span class="rem-sub">${sub}</span></span>
    </button>
    ${rem.kind === 'once' && !opts.history ? `<button class="rem-ok" data-act="dismiss-rem" data-fx="none" data-id="${rem.id}" data-occ="${occ}" data-until="0" aria-label="${esc(rem.title)} abhaken" title="Abhaken, bringt keine XP">${I.check}</button>` : ''}
    ${opts.history ? `<button class="rem-ok" data-act="reopen-rem" data-id="${rem.id}" aria-label="Wieder öffnen" title="Wieder öffnen">${I.repeat}</button>` : ''}
  </div>`;
}

function viewRems() {
  const t = todayStr();
  const once = live('rems').filter((r) => r.kind === 'once');
  const active = once.filter((r) => !r.doneAt).sort((a, b) => (a.date < b.date ? -1 : 1));
  const finished = once.filter((r) => r.doneAt).sort((a, b) => b.doneAt - a.doneAt).slice(0, 8);
  const yearly = live('rems')
    .filter((r) => r.kind === 'yearly')
    .map((rem) => ({ rem, occ: nextYearly(rem, t) }))
    .sort((a, b) => (a.occ < b.occ ? -1 : 1));
  const parts = [];
  parts.push(groupHead('h-once', 'Normal', `<button class="gh-btn" data-act="add" data-pane="rem" data-remkind="once">${I.plus}Neu</button>`));
  if (!active.length) {
    parts.push(`<div class="empty small" data-k="e-once"><p>Für kleine Dinge und einmalige Events: „Pfand mitnehmen“, „Konzert am Samstag“.</p></div>`);
  }
  active.forEach((rem) => parts.push(remTile(rem, rem.date)));
  parts.push(groupHead('h-yearly', 'Jährlich', `<button class="gh-btn" data-act="add" data-pane="rem" data-remkind="yearly">${I.plus}Neu</button>`));
  if (!yearly.length) {
    parts.push(`<div class="empty small" data-k="e-yearly"><p>Für Geburtstage und Jahrestage. Sie kommen von selbst jedes Jahr wieder.</p></div>`);
  }
  yearly.forEach(({ rem, occ }) => parts.push(remTile(rem, occ)));
  if (finished.length) {
    parts.push(groupHead('h-fin', 'Zuletzt erledigt'));
    finished.forEach((rem) => parts.push(remTile(rem, rem.date, { history: true })));
  }
  return `<div class="page" data-k="rems"><div class="list" data-k="rem-list">${parts.join('')}</div>
    <p class="fineprint">Erinnerungen bringen keine XP. Du siehst sie in der Tagesansicht, sobald sie anstehen.</p>
  </div>`;
}

/* ----------------------------------------------------------------- Level */
function heatmap() {
  const t = todayStr();
  const weeks = 17;
  const first = addDays(weekStart(t), -(weeks - 1) * 7);
  const xp = derived().xpDay;
  const LEVELS = [1, 30, 75, 150];
  const step = (v) => {
    if (!v) return 0;
    let s = 1;
    for (let i = 1; i < LEVELS.length; i++) if (v >= LEVELS[i]) s = i + 1;
    return s;
  };
  let cols = '';
  let monthRow = '';
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const mon = addDays(first, w * 7);
    const m = fromYmd(mon).getMonth();
    monthRow += `<span>${m !== lastMonth && w < weeks - 1 ? MONTHS_SHORT[m] : ''}</span>`;
    lastMonth = m;
    let col = '';
    for (let d = 0; d < 7; d++) {
      const date = addDays(mon, d);
      if (date > t) {
        col += '<span class="hm-cell future"></span>';
        continue;
      }
      const v = xp[date] || 0;
      const label = `${fmtWdShort(date)}: ${v} XP`;
      col += `<button class="hm-cell s${step(v)} ${date === t ? 'now' : ''}" data-act="heat" data-fx="none" data-tip="${esc(label)}" title="${esc(label)}" aria-label="${esc(label)}"></button>`;
    }
    cols += `<div class="hm-col">${col}</div>`;
  }
  return `<section class="hm" aria-label="XP pro Tag, letzte ${weeks} Wochen">
    <div class="hm-grid" style="--weeks:${weeks}">
      <div class="hm-months">${monthRow}</div>
      <div class="hm-days"><span>Mo</span><span></span><span>Mi</span><span></span><span>Fr</span><span></span><span></span></div>
      <div class="hm-cols">${cols}</div>
    </div>
    <div class="hm-foot">
      <span class="hm-tip" id="heatTip">${esc(ui.heatTip || 'Tippe auf einen Tag für die XP')}</span>
      <span class="hm-legend"><span>weniger</span><i class="hm-cell s0"></i><i class="hm-cell s1"></i><i class="hm-cell s2"></i><i class="hm-cell s3"></i><i class="hm-cell s4"></i><span>mehr</span></span>
    </div>
  </section>`;
}

function catCard(c) {
  const d = derived();
  const xp = d.xpCat[c.id] || 0;
  const l = catLevel(xp);
  return `<button class="cat-card" data-k="c-${c.id}" data-act="edit-cat" data-id="${c.id}" style="--c:${c.color}">
    <span class="cat-disc" aria-hidden="true">${esc(c.emoji)}</span>
    <span class="cat-body">
      <span class="cat-top"><span class="cat-name">${esc(c.name)}</span><span class="cat-rank">${rankOf(l.level)}</span></span>
      <span class="bar lg"><i style="width:${(l.pct * 100).toFixed(1)}%"></i></span>
      <span class="cat-sub"><span>${l.into} / ${l.need} XP</span><span>${plural(d.countCat[c.id] || 0, 'Eintrag', 'Einträge')}</span></span>
    </span>
    <span class="cat-lv"><small>LV</small><b>${l.level}</b></span>
  </button>`;
}

function viewLevels() {
  const d = derived();
  const total = totalLevel(d.xpTotal);
  const s = streakInfo();
  const cats = sortedCats().sort((a, b) => (d.xpCat[b.id] || 0) - (d.xpCat[a.id] || 0));
  return `<div class="page" data-k="levels">
    <section class="overall">
      <div class="overall-top">
        <div class="overall-n"><small>Gesamt-Level</small><b>${total.level}</b></div>
        <div class="overall-r"><span class="overall-rank">${rankOf(total.level)}</span><span class="overall-sub">${total.into} / ${total.need} XP</span></div>
      </div>
      <span class="bar lg sun"><i style="width:${(total.pct * 100).toFixed(1)}%"></i></span>
      <dl class="stats">
        <div><dt>Gesamt</dt><dd>${d.xpTotal}<small> XP</small></dd></div>
        <div><dt>Serie</dt><dd>${s.n}<small> ${s.n === 1 ? 'Tag' : 'Tage'}</small></dd></div>
        <div><dt>Perfekte Tage</dt><dd>${perfectDays()}</dd></div>
        <div><dt>Erledigt</dt><dd>${d.taskCount + d.goalCount}</dd></div>
      </dl>
    </section>
    ${badgeSection()}
    ${weekReview()}
    ${groupHead('h-cats', 'Kategorien', `<button class="gh-btn" data-act="new-cat">${I.plus}Neu</button>`)}
    <div class="cat-list" data-k="cat-list">
      ${cats.map(catCard).join('') || `<div class="empty small" data-k="e-cats"><p>Lege Kategorien an wie „Schule“ oder „Sport“. In jeder levelst du getrennt auf.</p></div>`}
    </div>
    ${skySection()}
    ${groupHead('h-heat', 'Deine letzten Wochen')}
    ${heatmap()}
  </div>`;
}
