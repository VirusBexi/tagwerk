/* ====================================================================== APP
   Global UI state, rendering, actions, gestures and start-up. */

const ui = {
  tab: 'today',
  date: todayStr(),
  today: todayStr(),
  dayDir: 0,
  goalKind: 'week',
  goalWeek: weekStart(todayStr()),
  goalMonth: monthOf(todayStr()),
  sheet: null,
  sheetClosing: false,
  dialog: null,
  installEvent: null,
  heatTip: null,
  insWeek: null,
  insDay: null,
};

const root = document.documentElement;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isTouch = () => matchMedia('(pointer: coarse)').matches;
const canSuggestInstall = () => TARGET !== 'artifact' && !isStandalone() && !L.installDismissed && isTouch();

/* ---------------------------------------------------------------- Render */
let rafId = 0;
function render() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    renderNow();
  });
}

function renderChrome() {
  const nav = navHtml();
  morph($('#tabbar'), nav.tabbar);
  morph($('#rail'), nav.rail);
  const tx = sceneTexts();
  $('#eyebrow').textContent = tx.eyebrow;
  const title = $('#title');
  title.textContent = tx.title;
  title.style.setProperty('--len', tx.title.length);
  morph($('#sceneBtns'), sceneButtons());
  morph($('#sceneFoot'), footHtml());
  const st = dayStat(ui.tab === 'today' ? ui.date : todayStr());
  Scene.set(st.total ? st.done / st.total : 0, ui.tab !== 'today');
}

function renderSheet() {
  morph($('#sheetRoot'), sheetHtml());
  morph($('#dialogRoot'), dialogHtml());
  root.classList.toggle('sheet-open', !!(ui.sheet || ui.dialog));
}

function renderNow() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  const view = $('#view');
  const flips = captureFlip(view);
  const html = ui.tab === 'today' ? viewToday() : ui.tab === 'goals' ? viewGoals() : ui.tab === 'rems' ? viewRems() : viewLevels();
  morph(view, html);
  playFlip(flips);
  ui.dayDir = 0;
  renderChrome();
  renderSheet();
}

/* ---------------------------------------------------------------- Toasts */
function toast(msg, { action, actionLabel = 'Rückgängig', ms = 4800 } = {}) {
  const host = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(actionLabel)}</button>` : ''}`;
  host.replaceChildren(el);
  const kill = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
  };
  const timer = setTimeout(kill, ms);
  if (action) {
    $('button', el).addEventListener('click', () => {
      clearTimeout(timer);
      kill();
      action();
    });
  }
}

function dialog(opts) {
  ui.dialog = opts;
  Sound.play('open');
  renderSheet();
}

function shake(sel) {
  const el = typeof sel === 'string' ? $(sel) : sel;
  Sound.play('deny');
  Haptic('deny');
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  if (el.focus && !isTouch()) el.focus();
}

/* ---------------------------------------------------------------- Sheets */
let histDepth = 0;
function openSheet(sheet) {
  const wasOpen = !!ui.sheet;
  ui.sheet = sheet;
  ui.sheetClosing = false;
  if (!wasOpen) {
    Sound.play('open');
    if (TARGET !== 'artifact') {
      try {
        history.pushState({ tw: 1 }, '');
        histDepth++;
      } catch {
        /* optional */
      }
    }
  }
  renderSheet();
  if (!wasOpen && !isTouch()) {
    const first = $('#sheetBody .big-input');
    if (first) first.focus();
  }
  const body = $('#sheetBody');
  if (body) body.scrollTop = 0;
}

function closeSheet(fromHistory = false) {
  if (!ui.sheet || ui.sheetClosing) return;
  ui.sheetClosing = true;
  Sound.play('close');
  renderSheet();
  if (!fromHistory && histDepth > 0) {
    histDepth--;
    history.back();
  }
  setTimeout(() => {
    ui.sheet = null;
    ui.sheetClosing = false;
    renderSheet();
  }, 210);
}

addEventListener('popstate', () => {
  if (ui.dialog) {
    ui.dialog = null;
    renderSheet();
  }
  if (ui.sheet) {
    histDepth = Math.max(0, histDepth - 1);
    closeSheet(true);
  }
});

function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
}
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}
const cleanXp = (v) => clamp(Math.round(Number(v) || 0), 0, 100000);

/* --------------------------------------------------------- Open the forms */
function openAdd(pane, remKind) {
  const chosen = pane || { today: 'task', goals: 'goal', rems: 'rem', levels: 'task' }[ui.tab];
  openSheet({
    kind: 'add',
    pane: chosen,
    task: newTaskDraft(),
    rem: newRemDraft(remKind || 'once'),
    goal: newGoalDraft(),
    added: {},
  });
}

function openEditTask(id, occ) {
  const t = S.tasks[id];
  const base = t.repeat ? t.repeat.start : t.date;
  openSheet({
    kind: 'edit-task',
    id,
    occ,
    task: {
      title: t.title,
      catId: t.catId,
      xp: t.xp,
      date: base,
      repeatOn: !!t.repeat,
      days: t.repeat ? [...t.repeat.days] : [weekdayOf(occ)],
      mode: t.repeat ? t.repeat.mode : 'weekly',
      saveTpl: false,
      calOpen: false,
      calMonth: monthOf(base),
    },
  });
}

function openEditRem(id) {
  const r = S.rems[id];
  const t = todayStr();
  const [mm, dd] = r.md ? r.md.split('-').map(Number) : [fromYmd(t).getMonth() + 1, fromYmd(t).getDate()];
  const date = r.date || t;
  openSheet({
    kind: 'edit-rem',
    id,
    rem: { title: r.title, kind: r.kind, date, time: r.time || '', lead: r.lead || 0, month: mm, day: dd, year: r.year || '', calOpen: false, calMonth: monthOf(date) },
  });
}

function openEditGoal(id) {
  const g = S.goals[id];
  const t = todayStr();
  openSheet({
    kind: 'edit-goal',
    id,
    goal: {
      title: g.title,
      kind: g.kind,
      week: g.kind === 'week' ? g.period : weekStart(t),
      month: g.kind === 'month' ? g.period : monthOf(t),
      target: g.target || null,
      catId: g.catId,
      xp: g.xp,
      steps: (g.steps || []).map((s) => ({ ...s })),
      stepText: '',
      calOpen: false,
      calMonth: monthOf(g.target || t),
    },
  });
}

/* -------------------------------------------------------------- Rewarding */
function xpTarget() {
  const sun = Scene.sunPoint();
  if (sun) return sun;
  const pill = $('#xpPill') || $('.foot-right');
  if (!pill) return null;
  const r = pill.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function reward(res, originEl, { big = false } = {}) {
  const cat = getCat(res.catId);
  const color = colorOf(cat);
  const r = originEl.getBoundingClientRect();
  const from = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  Fx.burst(from.x, from.y, color, big ? 38 : 16, big ? 2 : 1);
  const target = xpTarget();
  Fx.flyXp(from, target, `+${res.xp}`, color, () => {
    renderChrome();
    Scene.pulse();
    if (target) Fx.ring(target.x, target.y, '#FFF4E0', 64);
    const pill = $('#xpPill');
    if (pill && motionOK()) pill.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16)' }, { transform: 'scale(1)' }], { duration: 300 });
  });
  Hud.show(
    cat
      ? { emoji: cat.emoji, name: cat.name, color: cat.color, xp: res.xp, before: res.before.cat, after: res.after.cat }
      : { emoji: '☀️', name: 'Gesamt', color: '#FFC145', xp: res.xp, before: res.before.total, after: res.after.total },
  );
}

function levelUpItems(res) {
  const items = [];
  const cat = getCat(res.catId);
  if (cat && res.after.cat.level > res.before.cat.level) {
    items.push({ name: cat.name, emoji: cat.emoji, color: cat.color, from: res.before.cat.level, to: res.after.cat.level, rankBefore: rankOf(res.before.cat.level), rank: rankOf(res.after.cat.level) });
  }
  if (res.after.total.level > res.before.total.level) {
    const sky = Scene.themes().filter((t) => t.level > res.before.total.level && t.level <= res.after.total.level).pop();
    items.push({
      name: 'Gesamt-Level',
      emoji: '☀️',
      color: '#FFC145',
      from: res.before.total.level,
      to: res.after.total.level,
      rankBefore: rankOf(res.before.total.level),
      rank: rankOf(res.after.total.level),
      extra: sky ? `Neuer Himmel freigeschaltet: ${sky.name}` : '',
    });
  }
  return items;
}

function finaleNow() {
  Scene.finale();
  Sound.play('alldone');
  Haptic('heavy');
  Fx.confetti(150);
}

/** Freshly earned badges drop in once the level-up screens (and the day's finale) are through. */
function celebrateBadges(delay, afterFinale) {
  const fresh = badgesCollect();
  if (!fresh.length) return;
  LevelUp.afterAll(() => setTimeout(() => BadgeBanner.push(fresh), afterFinale ? 1900 : 0), delay);
}

/* ------------------------------------------------------------ Task actions */
function toggleTask(id, date, chk) {
  const t = S.tasks[id];
  if (!t) return;
  if (isDone(id, date)) {
    uncompleteTask(id, date);
    Sound.play('uncheck');
    Haptic('tick');
    renderNow();
    return;
  }
  const row = chk.closest('.row');
  if (row) row.classList.add('done', 'just-done');
  chk.setAttribute('aria-pressed', 'true');
  const step = dayStat(t.repeat || t.date >= todayStr() ? date : todayStr()).done;
  const res = completeTask(id, date);
  Sound.play('check', { step });
  Haptic('success');
  reward(res, chk);
  setTimeout(renderNow, 560);

  const st = dayStat(res.date);
  const clean = st.total > 0 && st.done === st.total && (res.date !== todayStr() || overdueTasks().length === 0);
  const levels = levelUpItems(res);
  if (levels.length) {
    setTimeout(() => levels.forEach(LevelUp.push), 1250);
    if (clean) LevelUp.afterAll(finaleNow, 1250);
  } else if (clean) {
    setTimeout(finaleNow, 820);
  }
  celebrateBadges(1300, clean);
}

function rowElement(id, date) {
  return $$('.row-wrap').find((w) => w.getAttribute('data-k') === `${id}|${date}`);
}

/** Row folds away before the data changes, so nothing jumps. */
function foldAway(el) {
  if (!el || !motionOK()) return Promise.resolve();
  const h = el.getBoundingClientRect().height;
  const anim = el.animate(
    [
      { height: `${h}px`, opacity: 1, transform: 'scale(1)' },
      { height: '0px', opacity: 0, transform: 'scale(.96)', marginBottom: '-8px' },
    ],
    { duration: 210, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' },
  );
  // Animations pause while the app is in the background; the change must still happen.
  return Promise.race([anim.finished.catch(() => {}), new Promise((resolve) => setTimeout(resolve, 280))]);
}

async function removeOneOff(id, date) {
  const doneEntries = Object.values(S.done).filter((e) => e.taskId === id && !e.del);
  Sound.play('remove');
  Haptic('swipe');
  if (ui.sheet) closeSheet();
  await foldAway(rowElement(id, date));
  deleteTask(id);
  renderNow();
  toast('Aufgabe gelöscht', {
    action: () => {
      restoreTask(id);
      doneEntries.forEach((e) => put('done', { ...e, del: false }));
      Sound.play('undo');
      renderNow();
    },
  });
}

function requestDeleteTask(id, date) {
  const t = S.tasks[id];
  if (!t) return;
  if (!t.repeat) {
    removeOneOff(id, date);
    return;
  }
  dialog({
    title: 'Was soll weg?',
    text: `„${t.title}“ wiederholt sich. Bereits erarbeitete XP bleiben in jedem Fall.`,
    actions: [
      {
        label: `Nur ${dayWord(date)}`,
        fn: async () => {
          Sound.play('remove');
          if (ui.sheet) closeSheet();
          await foldAway(rowElement(id, date));
          skipOccurrence(id, date);
          renderNow();
          toast('Dieser Termin ist übersprungen', {
            action: () => {
              unskipOccurrence(id, date);
              Sound.play('undo');
              renderNow();
            },
          });
        },
      },
      {
        label: 'Ganze Serie',
        kind: 'danger',
        fn: async () => {
          Sound.play('remove');
          if (ui.sheet) closeSheet();
          await foldAway(rowElement(id, date));
          deleteTask(id);
          renderNow();
          toast('Serie gelöscht', {
            action: () => {
              restoreTask(id);
              Sound.play('undo');
              renderNow();
            },
          });
        },
      },
      { label: 'Abbrechen' },
    ],
  });
}

async function moveTomorrow(id, date) {
  const t = S.tasks[id];
  if (!t) return;
  const today = todayStr();
  const to = addDays(date < today ? today : date, 1);
  const wasSeries = !!t.repeat;
  const prevDate = t.date;
  Sound.play('move');
  Haptic('swipe');
  if (ui.sheet) closeSheet();
  await foldAway(rowElement(id, date));
  const result = moveOccurrence(id, date, to);
  renderNow();
  toast(`Auf ${dayWord(to)} verschoben`, {
    action: () => {
      if (wasSeries) {
        unskipOccurrence(id, date);
        deleteTask(result.id);
      } else {
        updateTask(id, { date: prevDate });
      }
      Sound.play('undo');
      renderNow();
    },
  });
}

/* ------------------------------------------------------------ Goal actions */
function finishGoal(id, el) {
  const res = completeGoal(id);
  Sound.play('goal');
  Haptic('heavy');
  reward(res, el, { big: true });
  Fx.confetti(50, [colorOf(getCat(res.catId)), '#FFF4E0', '#FFC145']);
  setTimeout(renderNow, 520);
  const levels = levelUpItems(res);
  if (levels.length) setTimeout(() => levels.forEach(LevelUp.push), 1350);
  celebrateBadges(1400, false);
}

/* --------------------------------------------------------- Form submission */
function submitTask() {
  const sh = ui.sheet;
  const d = sh.task;
  // In a new task the words of the quick entry ("morgen", "50xp") are in the form by now and leave the title.
  const title = sh.kind === 'add' ? applyQuick(d).title : (d.title || '').trim();
  if (!title) return shake('#f-title');
  if (d.repeatOn && !d.days.length) return shake('#wdPick');
  const xp = cleanXp(d.xp);
  const repeat = d.repeatOn ? makeRepeat({ days: d.days, mode: d.mode, date: d.date }) : null;

  if (sh.kind === 'add') {
    if (repeat && !previewOccurrences(repeat, 1).length) return shake('.repeat-note');
    const t = addTask({ title, catId: d.catId, xp, date: d.date, repeat });
    if (d.saveTpl) addTpl({ title, catId: d.catId, xp });
    L.lastCat = d.catId;
    L.lastXp = xp;
    saveLocal();
    Sound.play('add');
    Haptic('success');
    closeSheet();
    if (!occursOn(t, ui.date)) {
      const first = repeat ? previewOccurrences(repeat, 1)[0] : d.date;
      toast(repeat ? `Eingeplant: ${repeatLabel(repeat)}` : `Für ${dayWord(first)} geplant`, {
        actionLabel: 'Anzeigen',
        action: () => goToDay(first),
      });
    } else if (!L.sortHint) {
      // Sorting has no button, so it is said once, the first time there is something to sort.
      const st = dayStat(ui.date);
      if (st.total - st.done >= 2) {
        L.sortHint = true;
        saveLocal();
        toast('Tipp: Aufgabe gedrückt halten und ziehen, dann sortierst du sie.', { ms: 7000 });
      }
    }
    renderNow();
    return;
  }

  const t = S.tasks[sh.id];
  const patch = { title, catId: d.catId, xp };
  if (repeat) {
    patch.repeat = { ...repeat, skips: (t.repeat && t.repeat.skips) || {} };
    patch.date = d.date;
  } else {
    patch.repeat = null;
    patch.date = t.repeat && d.date === t.repeat.start ? sh.occ : d.date;
    if (!t.repeat && t.date !== patch.date && isDone(t.id, t.date)) {
      const e = S.done[doneKey(t.id, t.date)];
      drop('done', e.id);
      put('done', { ...e, del: false, id: doneKey(t.id, patch.date), date: patch.date });
    }
  }
  updateTask(sh.id, patch);
  Sound.play('add');
  closeSheet();
  renderNow();
}

function submitRem() {
  const sh = ui.sheet;
  const d = sh.rem;
  const title = (d.title || '').trim();
  if (!title) return shake('#f-rem-title');
  const data = { title, kind: d.kind, lead: Number(d.lead) || 0 };
  if (d.kind === 'yearly') {
    const day = Math.min(Number(d.day), daysInMonth(2028, Number(d.month)));
    const y = Number(d.year);
    Object.assign(data, { md: `${pad2(Number(d.month))}-${pad2(day)}`, year: y >= 1000 && y <= 2200 ? y : null, date: null, time: '' });
  } else {
    Object.assign(data, { date: d.date, time: d.time || '', md: null, year: null });
  }
  if (sh.kind === 'add') {
    addRem(data);
    Sound.play('ding');
  } else {
    const old = S.rems[sh.id];
    if (old.date !== data.date || old.md !== data.md) Object.assign(data, { doneAt: null, seen: {} });
    updateRem(sh.id, data);
    Sound.play('add');
  }
  Haptic('success');
  closeSheet();
  if (sh.kind === 'add' && ui.tab !== 'rems') {
    const when = d.kind === 'yearly' ? 'Jährliche Erinnerung gespeichert' : `Erinnerung für ${dayWord(d.date)} gespeichert`;
    toast(when, { actionLabel: 'Anzeigen', action: () => switchTab('rems') });
  }
  renderNow();
}

function submitGoal() {
  const sh = ui.sheet;
  const d = sh.goal;
  const title = (d.title || '').trim();
  if (!title) return shake('#f-goal-title');
  const steps = [...d.steps];
  const pending = (d.stepText || '').trim();
  if (pending) steps.push({ id: uid(), t: pending, done: false });
  const period = d.kind === 'week' ? d.week : d.kind === 'month' ? d.month : null;
  const data = { title, kind: d.kind, period, target: d.kind === 'big' ? d.target : null, catId: d.catId, xp: cleanXp(d.xp), steps };
  if (sh.kind === 'add') {
    addGoal(data);
    L.lastCat = d.catId;
    saveLocal();
  } else {
    updateGoal(sh.id, data);
  }
  Sound.play('add');
  Haptic('success');
  closeSheet();
  if (sh.kind === 'add') {
    if (ui.tab === 'goals') {
      ui.goalKind = d.kind;
      if (d.kind === 'week') ui.goalWeek = d.week;
      if (d.kind === 'month') ui.goalMonth = d.month;
    } else {
      toast('Ziel gesetzt', {
        actionLabel: 'Anzeigen',
        action: () => {
          ui.goalKind = d.kind;
          if (d.kind === 'week') ui.goalWeek = d.week;
          if (d.kind === 'month') ui.goalMonth = d.month;
          switchTab('goals');
        },
      });
    }
  }
  renderNow();
}

function submitTpl() {
  const sh = ui.sheet;
  const d = sh.tpl;
  const title = (d.title || '').trim();
  if (!title) return shake('#f-tpl-title');
  const data = { title, catId: d.catId, xp: cleanXp(d.xp) };
  if (sh.id) updateTpl(sh.id, data);
  else addTpl(data);
  Sound.play('add');
  if (sh.back) {
    ui.sheet = sh.back;
    renderNow();
  } else {
    closeSheet();
  }
}

function submitCat() {
  const sh = ui.sheet;
  const d = sh.cat;
  const name = (d.name || '').trim();
  if (!name) return shake('#f-cat-name');
  let id = sh.id;
  if (id) updateCat(id, { name, emoji: d.emoji, color: d.color });
  else id = addCat({ name, emoji: d.emoji, color: d.color }).id;
  Sound.play('add');
  Haptic('success');
  if (sh.back) {
    if (sh.from) setPath(sh.back, sh.from, id);
    ui.sheet = sh.back;
    renderNow();
  } else {
    closeSheet();
    renderNow();
  }
}

function submitCurrent() {
  const sh = ui.sheet;
  if (!sh) return;
  if (sh.kind === 'add') {
    if (sh.pane === 'task') submitTask();
    else if (sh.pane === 'rem') submitRem();
    else if (sh.pane === 'goal') submitGoal();
  } else if (sh.kind === 'edit-task') submitTask();
  else if (sh.kind === 'edit-rem') submitRem();
  else if (sh.kind === 'edit-goal') submitGoal();
  else if (sh.kind === 'tpl') submitTpl();
  else if (sh.kind === 'cat') submitCat();
}

function addDraftStep() {
  const d = ui.sheet.goal;
  const t = (d.stepText || '').trim();
  if (!t) return;
  d.steps.push({ id: uid(), t, done: false });
  d.stepText = '';
  const input = $('#f-step');
  if (input) input.value = '';
  Sound.play('select', { i: d.steps.length });
  renderSheet();
}

/* -------------------------------------------------------------- Navigation */
function switchTab(tab) {
  if (ui.tab === tab) {
    scrollTo({ top: 0, behavior: motionOK() ? 'smooth' : 'auto' });
    return;
  }
  ui.tab = tab;
  root.dataset.tab = tab;
  scrollTo(0, 0);
  renderNow();
}

function goToDay(date) {
  ui.dayDir = Math.sign(diffDays(date, ui.date));
  ui.date = date;
  if (ui.tab !== 'today') {
    ui.tab = 'today';
    root.dataset.tab = 'today';
  }
  renderNow();
}

/* ------------------------------------------------------------ File saving */
async function saveFile(name, type, text) {
  if (TARGET === 'artifact') {
    const dl = window.claude ? await window.claude.use('downloads') : null;
    if (!dl) {
      toast('Speichern ist in dieser Ansicht nicht möglich.');
      return;
    }
    try {
      await dl.save({ filename: name, data: text });
      toast('Gespeichert');
    } catch (e) {
      if (e.code !== 'declined') toast('Das Speichern hat nicht geklappt.');
    }
    return;
  }
  const blob = new Blob([text], { type });
  if (isIOS() && navigator.canShare) {
    const file = new File([blob], name, { type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ----------------------------------------------------------------- Actions
   Every element with data-act="name" runs A[name](element, event). */
const A = {
  tab: (el) => {
    if (ui.sheet) closeSheet();
    switchTab(el.dataset.tab);
  },
  add: (el) => {
    Sound.play('add');
    Haptic('tap');
    openAdd(el.dataset.pane, el.dataset.remkind);
  },
  settings: () => openSheet({ kind: 'settings', token: '' }),
  day: (el) => {
    const d = el.dataset.date;
    if (d === ui.date) return;
    goToDay(d);
  },
  week: (el) => goToDay(addDays(ui.date, Number(el.dataset.dir) * 7)),
  'go-today': () => {
    if (ui.sheet) closeSheet();
    goToDay(todayStr());
  },
  'open-calendar': () => openSheet({ kind: 'calendar', month: monthOf(ui.date) }),

  toggle: (el) => toggleTask(el.dataset.id, el.dataset.date, el),
  'edit-task': (el) => openEditTask(el.dataset.id, el.dataset.date),
  'move-tomorrow': (el) => moveTomorrow(el.dataset.id, el.dataset.date),
  'delete-task': (el) => requestDeleteTask(el.dataset.id, el.dataset.date),

  'remove-demo': () =>
    dialog({
      title: 'Beispiele entfernen?',
      text: 'Alle Beispiel-Aufgaben, -Ziele und -Erinnerungen und ihre XP verschwinden. Die vier Kategorien bleiben, du kannst sie ändern oder löschen.',
      actions: [
        {
          label: 'Entfernen',
          kind: 'danger',
          fn: () => {
            removeDemo();
            badgesPrune();
            Sound.play('remove');
            if (ui.sheet) closeSheet();
            renderNow();
            toast('Alles sauber. Dein Tagwerk beginnt.');
          },
        },
        { label: 'Abbrechen' },
      ],
    }),
  install: () => {
    if (ui.installEvent) A['install-now']();
    else openSheet({ kind: 'settings', token: '' });
  },
  'install-now': async () => {
    if (!ui.installEvent) return;
    ui.installEvent.prompt();
    await ui.installEvent.userChoice.catch(() => {});
    ui.installEvent = null;
    renderNow();
  },
  'dismiss-install': () => {
    L.installDismissed = true;
    saveLocal();
    renderNow();
  },

  /* Goals */
  'goal-kind': (el) => {
    ui.goalKind = el.dataset.val;
    renderNow();
  },
  'goal-period': (el) => {
    const dir = Number(el.dataset.dir);
    if (ui.goalKind === 'week') ui.goalWeek = addDays(ui.goalWeek, dir * 7);
    else ui.goalMonth = addMonths(ui.goalMonth, dir);
    renderNow();
  },
  'edit-goal': (el) => openEditGoal(el.dataset.id),
  'toggle-step': (el) => {
    const g = S.goals[el.dataset.goal];
    const step = g.steps.find((s) => s.id === el.dataset.step);
    const turningOn = !step.done;
    toggleStep(el.dataset.goal, el.dataset.step);
    Sound.play(turningOn ? 'step' : 'uncheck', { i: g.steps.filter((s) => s.done).length });
    Haptic('tap');
    if (turningOn) {
      const r = $('.step-box', el).getBoundingClientRect();
      Fx.burst(r.left + r.width / 2, r.top + r.height / 2, colorOf(getCat(g.catId)), 8, 0.6);
    }
    renderNow();
  },
  'carry-goal': (el) => {
    const g = S.goals[el.dataset.id];
    updateGoal(g.id, { period: currentPeriod(g.kind) });
    Sound.play('move');
    renderNow();
  },
  'delete-goal': (el) => {
    const id = el.dataset.id;
    Sound.play('remove');
    deleteGoal(id);
    if (ui.sheet) closeSheet();
    renderNow();
    toast('Ziel gelöscht', {
      action: () => {
        put('goals', { ...S.goals[id], del: false });
        Sound.play('undo');
        renderNow();
      },
    });
  },
  'reopen-goal': (el) => {
    reopenGoal(el.dataset.id);
    Sound.play('undo');
    closeSheet();
    renderNow();
  },

  /* Reminders */
  'edit-rem': (el) => openEditRem(el.dataset.id),
  'dismiss-rem': async (el) => {
    const id = el.dataset.id;
    const prev = { doneAt: S.rems[id].doneAt || null, seen: { ...S.rems[id].seen } };
    Sound.play('ding');
    Haptic('tap');
    await foldAway(el.closest('[data-k]'));
    dismissRem(id, el.dataset.occ, Number(el.dataset.until));
    renderNow();
    toast('Abgehakt', {
      action: () => {
        updateRem(id, prev);
        Sound.play('undo');
        renderNow();
      },
    });
  },
  'reopen-rem': (el) => {
    reopenRem(el.dataset.id);
    Sound.play('undo');
    renderNow();
  },
  'delete-rem': (el) => {
    const id = el.dataset.id;
    Sound.play('remove');
    deleteRem(id);
    closeSheet();
    renderNow();
    toast('Erinnerung gelöscht', {
      action: () => {
        put('rems', { ...S.rems[id], del: false });
        Sound.play('undo');
        renderNow();
      },
    });
  },
  'rem-ics': () => {
    const rem = S.rems[ui.sheet.id];
    if (rem) saveFile(`${rem.title.replace(/[^\wäöüÄÖÜß -]/g, '') || 'erinnerung'}.ics`, 'text/calendar', icsFor(rem));
  },

  /* Levels and categories */
  heat: (el) => {
    ui.heatTip = el.dataset.tip;
    const tip = $('#heatTip');
    if (tip) tip.textContent = ui.heatTip;
    Sound.play('tap');
  },
  'new-cat': (el) => {
    const used = new Set(live('cats').map((c) => c.color));
    const color = CAT_COLORS.find((c) => !used.has(c)) || CAT_COLORS[0];
    const back = ui.sheet && ui.sheet.kind !== 'settings' ? ui.sheet : null;
    openSheet({ kind: 'cat', id: null, cat: { name: '', emoji: CAT_EMOJI[30], color }, back, from: el.dataset.from });
  },
  'edit-cat': (el) => {
    const c = S.cats[el.dataset.id];
    openSheet({ kind: 'cat', id: c.id, cat: { name: c.name, emoji: c.emoji, color: c.color } });
  },
  'delete-cat': (el) => {
    const id = el.dataset.id;
    dialog({
      title: 'Kategorie löschen?',
      text: `Aufgaben und Ziele aus „${S.cats[id].name}“ bleiben erhalten, nur ohne Kategorie. Ihre XP zählen weiter zum Gesamt-Level.`,
      actions: [
        {
          label: 'Löschen',
          kind: 'danger',
          fn: () => {
            Sound.play('remove');
            deleteCat(id);
            closeSheet();
            renderNow();
            toast('Kategorie gelöscht', {
              action: () => {
                put('cats', { ...S.cats[id], del: false });
                Sound.play('undo');
                renderNow();
              },
            });
          },
        },
        { label: 'Abbrechen' },
      ],
    });
  },

  /* Templates */
  'use-tpl': (el) => {
    const sh = ui.sheet;
    const id = el.dataset.id;
    useTpl(id, sh.task.date);
    sh.added[id] = (sh.added[id] || 0) + 1;
    Sound.play('add');
    Haptic('success');
    const r = el.getBoundingClientRect();
    Fx.burst(r.left + 28, r.top + r.height / 2, colorOf(getCat(S.tpls[id].catId)), 10, 0.7);
    renderNow();
  },
  'new-tpl': () => {
    openSheet({ kind: 'tpl', id: null, tpl: { title: '', catId: getCat(L.lastCat) ? L.lastCat : null, xp: L.lastXp || 25 }, back: ui.sheet });
  },
  'edit-tpl': (el) => {
    const t = S.tpls[el.dataset.id];
    openSheet({ kind: 'tpl', id: t.id, tpl: { title: t.title, catId: t.catId, xp: t.xp }, back: ui.sheet });
  },
  'delete-tpl': (el) => {
    const id = el.dataset.id;
    Sound.play('remove');
    deleteTpl(id);
    const back = ui.sheet.back;
    if (back) ui.sheet = back;
    else closeSheet();
    renderNow();
    toast('Vorlage gelöscht', {
      action: () => {
        put('tpls', { ...S.tpls[id], del: false });
        Sound.play('undo');
        renderNow();
      },
    });
  },

  /* Generic form helpers */
  set: (el) => {
    const raw = el.dataset.val;
    const value = el.dataset.num ? Number(raw) : raw === '' ? null : raw;
    setPath(ui.sheet, el.dataset.path, value);
    if (el.dataset.path === 'goal.target' && value === null) ui.sheet.goal.calOpen = false;
    Sound.play('select', { i: 2 });
    Haptic('tick');
    renderSheet();
  },
  'quick-off': (el) => {
    const d = ui.sheet && ui.sheet.task;
    if (!d) return;
    (d.quickOff || (d.quickOff = {}))[el.dataset.key] = true;
    applyQuick(d);
    Sound.play('close');
    Haptic('tick');
    renderSheet();
  },
  flip: (el) => {
    const path = el.dataset.path;
    if (path.startsWith('L.')) {
      const key = path.slice(2);
      L[key] = !L[key];
      saveLocal();
      if (key === 'sound' && L.sound) Sound.play('check', { step: 2 });
    } else {
      setPath(ui.sheet, path, !getPath(ui.sheet, path));
      if (path === 'task.repeatOn' && ui.sheet.task.repeatOn && !ui.sheet.task.days.length) {
        ui.sheet.task.days = [weekdayOf(ui.sheet.task.date)];
      }
    }
    Haptic('tick');
    renderSheet();
  },
  'toggle-day': (el) => {
    const d = ui.sheet.task;
    const w = Number(el.dataset.day);
    const on = !d.days.includes(w);
    d.days = on ? [...d.days, w].sort((a, b) => a - b) : d.days.filter((x) => x !== w);
    if (on) Sound.play('select', { i: w - 1 });
    else Sound.play('tap');
    Haptic('tick');
    renderSheet();
  },
  'set-mode': (el) => {
    ui.sheet.task.mode = el.dataset.val;
    renderSheet();
  },
  'set-pane': (el) => {
    ui.sheet.pane = el.dataset.val;
    renderSheet();
    const body = $('#sheetBody');
    if (body) body.scrollTop = 0;
  },
  'set-rem-kind': (el) => {
    const d = ui.sheet.rem;
    d.kind = el.dataset.val;
    if (d.kind === 'yearly' && !d.lead) d.lead = 7;
    renderSheet();
  },
  'set-goal-kind': (el) => {
    const d = ui.sheet.goal;
    const wasDefault = XP_GOAL[d.kind].includes(Number(d.xp));
    d.kind = el.dataset.val;
    if (wasDefault) d.xp = XP_GOAL[d.kind][1];
    renderSheet();
  },
  'set-pack': (el) => {
    L.pack = el.dataset.val;
    saveLocal();
    Sound.play('check', { step: 3 });
    renderSheet();
  },
  'cal-toggle': (el) => {
    const d = ui.sheet[el.dataset.prefix];
    d.calOpen = !d.calOpen;
    renderSheet();
  },
  'cal-nav': (el) => {
    const prefix = el.dataset.prefix;
    const dir = Number(el.dataset.dir);
    if (prefix === 'jump') ui.sheet.month = addMonths(ui.sheet.month, dir);
    else ui.sheet[prefix].calMonth = addMonths(ui.sheet[prefix].calMonth, dir);
    renderSheet();
  },
  'cal-pick': (el) => {
    const prefix = el.dataset.prefix;
    const date = el.dataset.date;
    if (prefix === 'jump') {
      closeSheet();
      goToDay(date);
      return;
    }
    const d = ui.sheet[prefix];
    if (prefix === 'goal') d.target = date;
    else d.date = date;
    d.calOpen = false;
    d.calMonth = monthOf(date);
    Sound.play('select', { i: 3 });
    Haptic('tick');
    renderSheet();
  },
  'draft-period': (el) => {
    const d = ui.sheet.goal;
    const dir = Number(el.dataset.dir);
    if (d.kind === 'week') d.week = addDays(d.week, dir * 7);
    else d.month = addMonths(d.month, dir);
    renderSheet();
  },
  'draft-step-add': addDraftStep,
  'draft-step-del': (el) => {
    const d = ui.sheet.goal;
    d.steps = d.steps.filter((s) => s.id !== el.dataset.id);
    renderSheet();
  },
  'close-sheet': () => closeSheet(),
  'sheet-back': () => {
    ui.sheet = ui.sheet.back;
    renderSheet();
  },
  'close-dialog': () => {
    ui.dialog = null;
    Sound.play('close');
    renderSheet();
  },
  'dialog-action': (el) => {
    const action = ui.dialog.actions[Number(el.dataset.i)];
    ui.dialog = null;
    renderSheet();
    if (action.fn) action.fn();
    else Sound.play('close');
  },
  'close-level': () => LevelUp.close(),

  /* Erfolge, Himmel, Wochenrückblick */
  badges: (el) => {
    BadgeBanner.hide();
    openSheet({ kind: 'badges', sel: el.dataset.id || '' });
  },
  badge: (el) => {
    ui.sheet.sel = el.dataset.id;
    renderSheet();
  },
  'set-sky': (el) => {
    const t = Scene.themes().find((x) => x.id === el.dataset.id);
    if (!t) return;
    if (totalLevel(derived().xpTotal).level < t.level) {
      shake(el);
      toast(`„${t.name}“ gibt es ab Gesamt-Level ${t.level}.`);
      return;
    }
    if (t.active) {
      Sound.play('tap');
      Scene.setTheme(t.id, true);
      return;
    }
    L.sky = t.id;
    saveLocal();
    Scene.setTheme(t.id, true);
    Sound.play('sky');
    Haptic('success');
    renderNow();
  },
  'ins-week': (el) => {
    const cur = weekStart(todayStr());
    const next = addDays(ui.insWeek || cur, Number(el.dataset.dir) * 7);
    if (next > cur) return;
    ui.insWeek = next;
    ui.insDay = null;
    renderNow();
  },
  'ins-day': (el) => {
    ui.insDay = ui.insDay === el.dataset.date ? null : el.dataset.date;
    Sound.play('tap');
    renderNow();
  },

  'submit-task': submitTask,
  'submit-rem': submitRem,
  'submit-goal': submitGoal,
  'submit-tpl': submitTpl,
  'submit-cat': submitCat,

  /* Data and sync */
  export: () => saveFile(`tagwerk-sicherung-${todayStr()}.json`, 'application/json', exportPayload()),
  wipe: () =>
    dialog({
      title: 'Wirklich alles löschen?',
      text: 'Aufgaben, Ziele, Erinnerungen, Kategorien und XP verschwinden, auch auf deinen verbundenen Geräten. Das lässt sich nicht rückgängig machen.',
      actions: [
        {
          label: 'Alles löschen',
          kind: 'danger',
          fn: () => {
            wipeAll();
            badgesPrune();
            Sound.play('remove');
            closeSheet();
            renderNow();
          },
        },
        { label: 'Abbrechen' },
      ],
    }),
  'sync-connect': async () => {
    const token = (ui.sheet.token || '').trim();
    if (!token) return shake('#f-token');
    const ok = await Sync.connectGist(token);
    if (ui.sheet && ui.sheet.kind === 'settings') ui.sheet.token = '';
    renderNow();
    if (ok) {
      Sound.play('ding');
      toast('Verbunden. Dieses Gerät bleibt jetzt synchron.');
    } else {
      Sound.play('deny');
    }
  },
  'sync-now': () => Sync.run(),
  'sync-off': () =>
    dialog({
      title: 'Verbindung trennen?',
      text: 'Deine Daten bleiben auf diesem Gerät und im Gist. Änderungen werden nur nicht mehr übertragen.',
      actions: [
        {
          label: 'Trennen',
          kind: 'danger',
          fn: () => {
            Sync.disconnect();
            renderNow();
          },
        },
        { label: 'Abbrechen' },
      ],
    }),
};

/* --------------------------------------------------------------- Listeners */
let suppressClickUntil = 0;

function bindEvents() {
  document.addEventListener('pointerdown', () => Sound.unlock(), { passive: true });

  // Tapping a chip of the quick entry must not take the cursor out of the title (and the keyboard away).
  document.addEventListener('mousedown', (e) => {
    if (e.target.closest && e.target.closest('.qchip')) e.preventDefault();
  });

  document.addEventListener('click', (e) => {
    if (performance.now() < suppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const hold = e.target.closest('[data-hold]');
    if (hold) {
      // A keyboard "click" has detail 0: no need to hold there.
      if (e.detail === 0) finishGoal(hold.dataset.hold, hold);
      return;
    }
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = A[el.dataset.act];
    if (!fn) return;
    const fx = el.dataset.fx;
    if (fx === 'tab') {
      Sound.play('tab');
      Haptic('tap');
    } else if (fx !== 'none') {
      Sound.play('tap');
      Haptic('tick');
    }
    fn(el, e);
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.local === 'volume') {
      L.volume = Number(el.value) / 100;
      saveLocal();
      return;
    }
    const path = el.dataset.bind;
    if (!path || !ui.sheet) return;
    if (path === 'token') {
      ui.sheet.token = el.value;
      return;
    }
    setPath(ui.sheet, path, el.dataset.num ? (el.value === '' ? '' : Number(el.value)) : el.value);
    if (path === 'task.title' && ui.sheet.kind === 'add') {
      // Quick entry: "morgen", "50xp", "#schule" and the like fill in the form while typing.
      const q = applyQuick(ui.sheet.task);
      if (q.fresh) {
        Sound.play('select', { i: 3 });
        Haptic('tick');
      }
      if (q.touched) renderSheet();
    }
    if (el.dataset.rerender) renderSheet();
  });

  document.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.dataset.local === 'volume') {
      Sound.play('check', { step: 2 });
      return;
    }
    if (el.dataset.bind && el.type === 'number') renderSheet();
    if (el.hasAttribute('data-import') && el.files && el.files[0]) {
      try {
        const changed = importPayload(await el.files[0].text());
        Sound.play('add');
        toast(changed ? 'Sicherung geladen und zusammengeführt.' : 'Alles schon auf dem neuesten Stand.');
        renderNow();
      } catch {
        Sound.play('deny');
        toast('Diese Datei ist keine Tagwerk-Sicherung.');
      }
      el.value = '';
    }
  });

  document.addEventListener('mouseover', (e) => {
    const cell = e.target.closest && e.target.closest('.hm-cell[data-tip]');
    if (cell) {
      const tip = $('#heatTip');
      if (tip) tip.textContent = cell.dataset.tip;
    }
    const bar = e.target.closest && e.target.closest('.wkc-col[data-tip]');
    if (bar) {
      const tip = $('#insTip');
      if (tip) tip.textContent = bar.dataset.tip;
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (!e.target.closest || !e.target.closest('.wkc-chart')) return;
    if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.wkc-chart')) return;
    const tip = $('#insTip');
    if (tip) tip.textContent = tip.dataset.rest;
  });

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    if (e.key === 'Escape') {
      if (LevelUp.open) LevelUp.close();
      else if (ui.dialog) A['close-dialog']();
      else if (ui.sheet) closeSheet();
      return;
    }
    if (e.key === 'Enter' && typing) {
      const mode = document.activeElement.dataset.enter;
      if (mode === 'submit') {
        e.preventDefault();
        submitCurrent();
      } else if (mode === 'step') {
        e.preventDefault();
        addDraftStep();
      }
      return;
    }
    if (typing || ui.sheet || ui.dialog || LevelUp.open || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      Sound.play('add');
      openAdd();
    } else if (e.key === 't' || e.key === 'T') {
      if (ui.tab !== 'today') switchTab('today');
      goToDay(todayStr());
    } else if (e.key === 'ArrowLeft' && ui.tab === 'today') {
      goToDay(addDays(ui.date, -1));
    } else if (e.key === 'ArrowRight' && ui.tab === 'today') {
      goToDay(addDays(ui.date, 1));
    } else if (['1', '2', '3', '4'].includes(e.key)) {
      Sound.play('tab');
      switchTab(TABS[Number(e.key) - 1][0]);
    }
  });

  addEventListener('scroll', () => root.classList.toggle('collapsed', scrollY > 96), { passive: true });

  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    ui.installEvent = e;
    render();
  });
  addEventListener('appinstalled', () => {
    ui.installEvent = null;
    L.installDismissed = true;
    saveLocal();
    render();
  });

  const save = () => saveStoreNow();
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
    else checkDateChange();
  });
  setInterval(checkDateChange, 20000);

  const vv = window.visualViewport;
  if (vv) {
    const update = () => {
      root.style.setProperty('--kb', `${Math.max(0, innerHeight - vv.height - vv.offsetTop)}px`);
      root.style.setProperty('--vvh', `${vv.height}px`);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
  }
}

function checkDateChange() {
  const now = todayStr();
  if (now === ui.today) return;
  if (ui.date === ui.today) ui.date = now;
  ui.today = now;
  ui.goalWeek = weekStart(now);
  ui.goalMonth = monthOf(now);
  renderNow();
}

/* ---------------------------------------------------------------- Gestures */
function initRowSwipe() {
  const MOVE_AT = 76;
  const DELETE_AT = 168;
  const DONE_AT = 76;
  let s = null;

  const stageFor = (dx) => (dx >= DONE_AT ? 'done' : dx <= -DELETE_AT ? 'del' : dx <= -MOVE_AT ? 'move' : '');

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse') return;
      const row = e.target.closest('[data-swipe]');
      if (!row || e.target.closest('.chk')) return;
      s = { row, wrap: row.closest('.row-wrap'), id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, active: false, stage: '' };
    },
    { passive: true },
  );

  document.addEventListener(
    'pointermove',
    (e) => {
      if (!s || e.pointerId !== s.id) return;
      if (dragActive) {
        // The row was picked up for sorting: no swipe any more.
        s = null;
        return;
      }
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (!s.active) {
        if (Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx)) {
          s = null;
          return;
        }
        if (Math.abs(dx) < 9) return;
        s.active = true;
        s.wrap.classList.add('swiping');
        try {
          s.row.setPointerCapture(s.id);
        } catch {
          /* optional */
        }
      }
      s.dx = dx;
      const max = dx > 0 ? 120 : 220;
      const eased = Math.sign(dx) * (Math.abs(dx) < max ? Math.abs(dx) : max + (Math.abs(dx) - max) * 0.25);
      s.row.style.transform = `translateX(${eased}px)`;
      s.wrap.dataset.dir = dx > 0 ? 'right' : 'left';
      const stage = stageFor(dx);
      if (stage !== s.stage) {
        s.stage = stage;
        s.wrap.dataset.stage = stage;
        if (stage) {
          Haptic('swipe');
          Sound.play('tap');
        }
      }
    },
    { passive: true },
  );

  const finish = (e) => {
    if (!s || e.pointerId !== s.id) return;
    const { row, wrap, active, stage } = s;
    s = null;
    if (!active) return;
    suppressClickUntil = performance.now() + 350;
    wrap.classList.remove('swiping');
    const id = row.dataset.id;
    const date = row.dataset.date;
    const reset = () => {
      row.style.transition = 'transform .32s cubic-bezier(.2,1.25,.4,1)';
      row.style.transform = '';
      setTimeout(() => {
        row.style.transition = '';
        delete wrap.dataset.dir;
        delete wrap.dataset.stage;
      }, 330);
    };
    if (e.type === 'pointercancel' || !stage) return reset();
    if (stage === 'done') {
      reset();
      toggleTask(id, date, $('.chk', row));
    } else if (stage === 'move') {
      moveTomorrow(id, date);
    } else {
      const t = S.tasks[id];
      if (t && t.repeat) reset();
      requestDeleteTask(id, date);
    }
  };
  document.addEventListener('pointerup', finish);
  document.addEventListener('pointercancel', finish);
}

function initStripSwipe() {
  let s = null;
  document.addEventListener(
    'pointerdown',
    (e) => {
      const view = e.target.closest('.wk-view');
      if (!view) return;
      s = { view, track: $('.wk-track', view), id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, active: false, w: view.clientWidth };
    },
    { passive: true },
  );
  document.addEventListener(
    'pointermove',
    (e) => {
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (!s.active) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
          s = null;
          return;
        }
        if (Math.abs(dx) < 8) return;
        s.active = true;
        try {
          s.view.setPointerCapture(s.id);
        } catch {
          /* optional */
        }
      }
      s.dx = dx;
      s.track.style.transform = `translateX(calc(-33.3333% + ${dx}px))`;
    },
    { passive: true },
  );
  const finish = (e) => {
    if (!s || e.pointerId !== s.id) return;
    const { track, active, dx, w } = s;
    s = null;
    if (!active) return;
    suppressClickUntil = performance.now() + 300;
    const dir = dx < -w * 0.16 ? 1 : dx > w * 0.16 ? -1 : 0;
    track.style.transition = 'transform .26s cubic-bezier(.2,.9,.25,1)';
    track.style.transform = `translateX(${-33.3333 - dir * 33.3333}%)`;
    if (dir) {
      Sound.play('tab');
      Haptic('tick');
    }
    setTimeout(() => {
      track.style.transition = '';
      track.style.transform = '';
      if (dir) goToDay(addDays(ui.date, dir * 7));
    }, 260);
  };
  document.addEventListener('pointerup', finish);
  document.addEventListener('pointercancel', finish);
}

/** Press and hold to finish a goal: the ring charges, the sound climbs, then it bursts. */
function initHold() {
  let h = null;
  const setRing = (btn, p) => {
    const fill = $('.h-fill', btn);
    if (fill) fill.style.strokeDasharray = `${(p * 100).toFixed(1)} 100`;
    btn.style.setProperty('--h', p.toFixed(3));
  };
  const clear = () => {
    if (!h) return;
    cancelAnimationFrame(h.raf);
    h.stopSound();
    const { btn } = h;
    btn.classList.remove('holding');
    h = null;
    return btn;
  };
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('[data-hold]');
    if (!btn || e.button > 0) return;
    e.preventDefault();
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {
      /* optional */
    }
    Haptic('tap');
    h = { btn, id: e.pointerId, t0: performance.now(), lastTick: 0, raf: 0, stopSound: Sound.holdStart() };
    btn.classList.add('holding');
    const loop = (now) => {
      if (!h) return;
      const p = clamp((now - h.t0) / HOLD_MS, 0, 1);
      setRing(btn, p);
      if (now - h.lastTick > 120) {
        h.lastTick = now;
        Haptic('tick');
      }
      if (p >= 1) {
        const id = btn.dataset.hold;
        clear();
        finishGoal(id, btn);
        return;
      }
      h.raf = requestAnimationFrame(loop);
    };
    h.raf = requestAnimationFrame(loop);
  });
  const release = (e) => {
    if (!h || e.pointerId !== h.id) return;
    const short = performance.now() - h.t0 < 240;
    const btn = clear();
    if (btn) {
      setRing(btn, 0);
      if (short) {
        btn.classList.remove('shake');
        void btn.offsetWidth;
        btn.classList.add('shake');
        toast('Gedrückt halten, um das Ziel abzuschließen', { ms: 2200 });
      }
    }
  };
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest && e.target.closest('[data-hold]')) e.preventDefault();
  });
}

function initSheetDrag() {
  let s = null;
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse') return;
      const grip = e.target.closest('[data-grip]');
      if (!grip || e.target.closest('button')) return;
      s = { panel: $('#sheetPanel'), id: e.pointerId, y: e.clientY, dy: 0, t0: performance.now() };
    },
    { passive: true },
  );
  document.addEventListener(
    'pointermove',
    (e) => {
      if (!s || e.pointerId !== s.id) return;
      s.dy = Math.max(0, e.clientY - s.y);
      s.panel.style.transition = 'none';
      s.panel.style.transform = `translateY(${s.dy}px)`;
    },
    { passive: true },
  );
  const finish = (e) => {
    if (!s || e.pointerId !== s.id) return;
    const { panel, dy, t0 } = s;
    s = null;
    const fast = dy > 40 && dy / (performance.now() - t0) > 0.5;
    panel.style.transition = '';
    if (dy > 110 || fast) {
      panel.style.transform = 'translateY(100%)';
      closeSheet();
      setTimeout(() => {
        panel.style.transform = '';
      }, 260);
    } else {
      panel.style.transform = '';
    }
  };
  document.addEventListener('pointerup', finish);
  document.addEventListener('pointercancel', finish);
}

/* ------------------------------------------------------------- Service worker */
/** The fonts of the very first visit load before the worker runs. Fetch them once more through it, for offline use. */
function warmFontCache() {
  const link = $('link[rel="stylesheet"][href*="fonts.googleapis"]');
  if (!link) return;
  fetch(link.href)
    .then((r) => r.text())
    .then((css) => {
      for (const m of css.matchAll(/url\((https:[^)]+)\)/g)) fetch(m[1], { mode: 'cors' }).catch(() => {});
    })
    .catch(() => {});
}

function registerServiceWorker() {
  if (TARGET === 'artifact' || !('serviceWorker' in navigator)) return;
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (location.protocol !== 'https:' && !local) return;
  // While developing locally the cache would hide every rebuild. ?sw turns it on for testing.
  if (local && !location.search.includes('sw')) {
    navigator.serviceWorker.getRegistrations().then((list) => list.forEach((r) => r.unregister()));
    return;
  }
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true;
      warmFontCache();
      return;
    }
    toast('Neue Version ist da.', { actionLabel: 'Neu laden', action: () => location.reload(), ms: 15000 });
  });
}

/* ------------------------------------------------------------------ Start */
function makeGrain() {
  try {
    const size = 140;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const img = x.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() < 0.5 ? 0 : 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = Math.random() * 13;
    }
    x.putImageData(img, 0, 0);
    root.style.setProperty('--grain', `url(${c.toDataURL('image/png')})`);
  } catch {
    /* Grain is decoration only. */
  }
}

/** App shortcuts (long press on the home screen icon) open the app with a wish in the address. */
function openFromLink() {
  if (TARGET !== 'pwa') return;
  let q;
  try {
    q = new URLSearchParams(location.search);
  } catch {
    return;
  }
  const neu = q.get('neu');
  const tab = q.get('tab');
  if (!neu && !tab) return;
  try {
    // The wish is for this start only: a reload must not open the form again.
    history.replaceState(null, '', location.pathname);
  } catch {
    /* optional */
  }
  if (['today', 'goals', 'rems', 'levels'].includes(tab)) switchTab(tab);
  const pane = { aufgabe: 'task', erinnerung: 'rem', ziel: 'goal' }[neu];
  if (pane) openAdd(pane);
}

function start() {
  loadStore();
  let warned = false;
  onSaveFailed = () => {
    if (warned || TARGET === 'artifact') return;
    warned = true;
    toast('Speichern hat nicht geklappt. Im privaten Modus oder bei vollem Speicher gehen Änderungen verloren.', { ms: 9000 });
  };
  const firstRun = !L.seeded;
  if (!L.seeded) {
    if (!COLS.some((c) => Object.keys(S[c]).length)) seedDemo();
    L.seeded = true;
    saveLocal();
  }
  // What is already earned counts as celebrated: fanfare is only for what comes from now on.
  const knewBadges = L.badges != null;
  const earned = badgesMarkQuietly();
  root.dataset.tab = ui.tab;
  root.classList.toggle('t-artifact', TARGET === 'artifact');
  makeGrain();
  Fx.init();
  Scene.mount($('#scene'));
  bindEvents();
  initRowSwipe();
  initRowDrag();
  initStripSwipe();
  initHold();
  initSheetDrag();
  renderNow();
  openFromLink();
  if (!knewBadges && !firstRun && earned) {
    setTimeout(() => {
      toast(`Neu: Erfolge. ${earned === 1 ? 'Einen' : earned} hast du schon freigeschaltet.`, {
        actionLabel: 'Ansehen',
        action: () => openSheet({ kind: 'badges', sel: '' }),
        ms: 9000,
      });
    }, 1200);
  }
  Sync.init({
    onRemoteChange: () => {
      badgesMarkQuietly();
      render();
    },
    onStatus: () => {
      if (ui.sheet && ui.sheet.kind === 'settings') renderSheet();
    },
  });
  registerServiceWorker();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => root.classList.add('fonts-in'));
}

start();
