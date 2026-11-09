/* ==================================================================== STORE
   All synced data lives in S as collections of entities keyed by id. Every
   entity has `u` (last change, ms) and is never removed outright: deleting sets
   `del: true`. That makes merging two devices trivial and safe: per entity, the
   newer `u` wins. Device settings (sound, sync token, …) live in L and never sync. */

const STORE_KEY = 'tagwerk.state.v1';
const LOCAL_KEY = 'tagwerk.local.v1';
const COLS = ['cats', 'tasks', 'done', 'tpls', 'rems', 'goals'];
const TOMBSTONE_MAX_AGE = 180 * 864e5;

const DEFAULT_LOCAL = {
  sound: true,
  volume: 0.8,
  pack: 'kristall',
  haptics: true,
  motion: true,
  seeded: false,
  lastCat: null,
  lastXp: 25,
  sync: null,
  installDismissed: false,
};

const blankState = () => ({ v: 1, cats: {}, tasks: {}, done: {}, tpls: {}, rems: {}, goals: {} });

let S = blankState();
let L = { ...DEFAULT_LOCAL };
let rev = 0;
let saveTimer = 0;
let onStoreChange = () => {};

const safeGet = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
    return true;
  } catch {
    return false;
  }
};

function loadStore() {
  try {
    const raw = safeGet(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      S = blankState();
      for (const c of COLS) S[c] = parsed[c] || {};
    }
  } catch {
    S = blankState();
  }
  try {
    const raw = safeGet(LOCAL_KEY);
    if (raw) L = { ...DEFAULT_LOCAL, ...JSON.parse(raw) };
  } catch {
    L = { ...DEFAULT_LOCAL };
  }
  pruneTombstones();
  rev++;
}

function pruneTombstones() {
  const limit = Date.now() - TOMBSTONE_MAX_AGE;
  for (const c of COLS) {
    for (const [id, e] of Object.entries(S[c])) if (e.del && e.u < limit) delete S[c][id];
  }
}

let onSaveFailed = () => {};
const saveStoreNow = () => {
  clearTimeout(saveTimer);
  saveTimer = 0;
  if (!safeSet(STORE_KEY, JSON.stringify(S))) onSaveFailed();
};
const saveStoreSoon = () => {
  if (!saveTimer) saveTimer = setTimeout(saveStoreNow, 120);
};
const saveLocal = () => safeSet(LOCAL_KEY, JSON.stringify(L));

function touch() {
  rev++;
  saveStoreSoon();
  onStoreChange();
}
function put(col, obj) {
  obj.u = Date.now();
  S[col][obj.id] = obj;
  touch();
  return obj;
}
function drop(col, id) {
  const e = S[col][id];
  if (!e) return;
  e.del = true;
  e.u = Date.now();
  touch();
}
const live = (col) => Object.values(S[col]).filter((e) => !e.del);

/* -------------------------------------------------------------- Merging */

/** Pull newer entities from `remote` into S. Returns whether anything changed. */
function mergeRemote(remote) {
  let changed = false;
  for (const c of COLS) {
    const entries = remote[c] || {};
    for (const id of Object.keys(entries)) {
      const r = entries[id];
      const l = S[c][id];
      if (!l || r.u > l.u) {
        S[c][id] = r;
        changed = true;
      }
    }
  }
  if (changed) {
    rev++;
    saveStoreSoon();
  }
  return changed;
}

/** True when S holds something `remote` does not have yet. */
function needsPush(remote) {
  for (const c of COLS) {
    const entries = remote[c] || {};
    for (const id of Object.keys(S[c])) {
      const r = entries[id];
      if (!r || S[c][id].u > r.u) return true;
    }
  }
  return false;
}

/** Splits the state into documents of at most 256 KiB: tasks and check-offs by month. */
function shardState(st) {
  const out = { core: { v: 1, cats: st.cats, tpls: st.tpls, rems: st.rems, goals: st.goals, tasks: {} } };
  for (const [id, t] of Object.entries(st.tasks)) {
    if (t.repeat || !t.date) {
      out.core.tasks[id] = t;
    } else {
      const key = `tasks-${t.date.slice(0, 7)}`;
      (out[key] = out[key] || { tasks: {} }).tasks[id] = t;
    }
  }
  for (const [id, d] of Object.entries(st.done)) {
    const key = `done-${d.date.slice(0, 7)}`;
    (out[key] = out[key] || { done: {} }).done[id] = d;
  }
  return out;
}

/** Puts documents back together. A moved task can sit in two of them: the newer copy wins. */
function assembleShards(bodies) {
  const out = blankState();
  for (const body of bodies) {
    const data = JSON.parse(JSON.stringify(body || {}));
    for (const c of COLS) {
      for (const [id, e] of Object.entries(data[c] || {})) {
        if (!out[c][id] || e.u > out[c][id].u) out[c][id] = e;
      }
    }
  }
  return out;
}

/* ------------------------------------------------------- Derived numbers */
let derivedCache = null;
let statCache = { rev: -1, map: {} };

function derived() {
  if (derivedCache && derivedCache.rev === rev) return derivedCache;
  const d = { rev, byDate: {}, xpCat: {}, countCat: {}, xpDay: {}, xpTotal: 0, taskCount: 0, goalCount: 0 };
  const add = (catId, xp, date) => {
    d.xpTotal += xp;
    if (catId) {
      d.xpCat[catId] = (d.xpCat[catId] || 0) + xp;
      d.countCat[catId] = (d.countCat[catId] || 0) + 1;
    }
    if (date) d.xpDay[date] = (d.xpDay[date] || 0) + xp;
  };
  for (const e of Object.values(S.done)) {
    if (e.del) continue;
    (d.byDate[e.date] = d.byDate[e.date] || []).push(e);
    add(e.catId, e.xp, e.date);
    d.taskCount++;
  }
  for (const g of Object.values(S.goals)) {
    if (g.del || !g.doneAt) continue;
    add(g.catId, g.xp, g.doneOn);
    d.goalCount++;
  }
  derivedCache = d;
  return d;
}

/* ---------------------------------------------------------------- Levels
   Each level costs more than the last. A category levels up faster than the
   overall level, which sums everything. */
function levelOf(xp, base, step) {
  let level = 1;
  let need = base;
  let rest = Math.max(0, xp);
  while (rest >= need) {
    rest -= need;
    level++;
    need = base + step * (level - 1);
  }
  return { level, into: rest, need, pct: rest / need, xp };
}
const catLevel = (xp) => levelOf(xp, 100, 50);
const totalLevel = (xp) => levelOf(xp, 250, 100);

const RANKS = [
  [1, 'Funke'],
  [3, 'Glut'],
  [6, 'Flamme'],
  [10, 'Feuer'],
  [15, 'Sonne'],
  [25, 'Nova'],
  [40, 'Supernova'],
];
const rankOf = (level) => {
  let name = RANKS[0][1];
  for (const [min, n] of RANKS) if (level >= min) name = n;
  return name;
};

function levelSnapshot(catId) {
  const d = derived();
  return {
    cat: catId ? catLevel(d.xpCat[catId] || 0) : null,
    total: totalLevel(d.xpTotal),
  };
}

/* ------------------------------------------------------------ Categories */
const getCat = (id) => {
  const c = id ? S.cats[id] : null;
  return c && !c.del ? c : null;
};
const sortedCats = () => live('cats').sort((a, b) => (a.order || 0) - (b.order || 0));
const addCat = ({ name, emoji, color }) => put('cats', { id: uid(), name, emoji, color, order: Date.now() });
const updateCat = (id, patch) => put('cats', { ...S.cats[id], ...patch });
const deleteCat = (id) => drop('cats', id);

/* --------------------------------------------------------------- Repeats
   repeat = { days:[1..7], mode:'weekly'|'biweekly'|'week', start, anchor, skips:{date:1} }
   `anchor` is the Monday of the week the series was planned in. */
function makeRepeat({ days, mode, date, skips }) {
  return { days: [...days].sort((a, b) => a - b), mode, start: date, anchor: weekStart(date), skips: skips || {} };
}
function repeatHits(r, date) {
  if (date < r.start) return false;
  if (!r.days.includes(weekdayOf(date))) return false;
  if (r.mode === 'week') return weekStart(date) === r.anchor;
  if (r.mode === 'biweekly') return (diffDays(weekStart(date), r.anchor) / 7) % 2 === 0;
  return true;
}
function occursOn(task, date) {
  if (task.del) return false;
  if (task.repeat) return repeatHits(task.repeat, date) && !(task.repeat.skips && task.repeat.skips[date]);
  return task.date === date;
}
function previewOccurrences(r, count = 3, from = r.start) {
  const out = [];
  let d = from > r.start ? from : r.start;
  for (let i = 0; i < 400 && out.length < count; i++) {
    if (r.mode === 'week' && d > addDays(r.anchor, 6)) break;
    if (repeatHits(r, d)) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}
function repeatDaysLabel(days) {
  const s = [...days].sort((a, b) => a - b);
  if (s.length === 7) return 'Täglich';
  if (s.join() === '1,2,3,4,5') return 'Mo–Fr';
  return s.map((d) => WD_SHORT[d]).join(', ');
}
function repeatLabel(r) {
  const d = repeatDaysLabel(r.days);
  if (r.mode === 'week') return `${d} · nur KW ${isoWeek(r.anchor)}`;
  if (r.mode === 'biweekly') return `${d} · alle 2 Wochen`;
  return d;
}

/* ----------------------------------------------------------------- Tasks */
const doneKey = (id, date) => `${id}|${date}`;
const isDone = (id, date) => {
  const e = S.done[doneKey(id, date)];
  return !!e && !e.del;
};

function dayTasks(date) {
  return live('tasks')
    .filter((t) => occursOn(t, date))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((task) => ({ task, date, done: isDone(task.id, date) }));
}

function overdueTasks(today = todayStr()) {
  return live('tasks')
    .filter((t) => !t.repeat && t.date < today && !isDone(t.id, t.date))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function dayStat(date) {
  if (statCache.rev !== rev) statCache = { rev, map: {} };
  if (statCache.map[date]) return statCache.map[date];
  const items = dayTasks(date);
  const stat = { total: items.length, done: 0, xp: 0, xpDone: 0 };
  for (const it of items) {
    stat.xp += it.task.xp;
    if (it.done) {
      stat.done++;
      stat.xpDone += it.task.xp;
    }
  }
  statCache.map[date] = stat;
  return stat;
}

function addTask({ title, catId, xp, date, repeat }) {
  return put('tasks', {
    id: uid(),
    title,
    catId: catId || null,
    xp,
    date,
    repeat: repeat || null,
    order: Date.now(),
  });
}
const updateTask = (id, patch) => put('tasks', { ...S.tasks[id], ...patch });

/** Marks one occurrence done. Late one-off tasks count for today. */
function completeTask(id, date, today = todayStr()) {
  const t = S.tasks[id];
  if (!t.repeat && t.date < today && date < today) {
    updateTask(id, { date: today });
    date = today;
  }
  const before = levelSnapshot(t.catId);
  const entry = { id: doneKey(id, date), taskId: id, title: t.title, date, xp: t.xp, catId: t.catId, at: Date.now() };
  if (t.demo) entry.demo = true;
  put('done', entry);
  const after = levelSnapshot(t.catId);
  return { xp: t.xp, catId: t.catId, date, before, after };
}
const uncompleteTask = (id, date) => drop('done', doneKey(id, date));

/** Removes one day from a series. */
function skipOccurrence(id, date) {
  const t = S.tasks[id];
  if (!t.repeat) return;
  updateTask(id, { repeat: { ...t.repeat, skips: { ...t.repeat.skips, [date]: 1 } } });
  uncompleteTask(id, date);
}
function unskipOccurrence(id, date) {
  const t = S.tasks[id];
  const skips = { ...t.repeat.skips };
  delete skips[date];
  updateTask(id, { repeat: { ...t.repeat, skips } });
}

/** Deletes a one-off task along with its XP. Series keep the XP already earned. */
function deleteTask(id) {
  const t = S.tasks[id];
  if (!t) return;
  if (!t.repeat) {
    for (const e of Object.values(S.done)) if (e.taskId === id && !e.del) drop('done', e.id);
  }
  drop('tasks', id);
}
function restoreTask(id) {
  const t = S.tasks[id];
  if (t) put('tasks', { ...t, del: false });
}

/** Moves an occurrence to another day. A series gets a one-off copy there. */
function moveOccurrence(id, date, toDate) {
  const t = S.tasks[id];
  if (t.repeat) {
    skipOccurrence(id, date);
    return addTask({ title: t.title, catId: t.catId, xp: t.xp, date: toDate });
  }
  updateTask(id, { date: toDate });
  return t;
}

/** Habit streak of a series: how many scheduled days in a row were done. */
function routineStreak(t, upTo = todayStr()) {
  let n = 0;
  let d = upTo;
  for (let i = 0; i < 400 && d >= t.repeat.start; i++, d = addDays(d, -1)) {
    if (!occursOn(t, d)) continue;
    if (isDone(t.id, d)) n++;
    else if (d !== upTo) break;
  }
  return n;
}

/** Days in a row with at least one finished task. Today only adds, it never breaks it. */
function streakInfo(today = todayStr()) {
  const by = derived().byDate;
  const doneToday = !!by[today];
  let d = doneToday ? today : addDays(today, -1);
  let n = 0;
  while (by[d]) {
    n++;
    d = addDays(d, -1);
  }
  return { n, doneToday };
}

function perfectDays() {
  return Object.keys(derived().byDate).filter((date) => {
    const s = dayStat(date);
    return s.total > 0 && s.done === s.total;
  }).length;
}

/* ------------------------------------------------------------- Templates */
const sortedTpls = () =>
  live('tpls').sort((a, b) => (b.uses || 0) - (a.uses || 0) || a.title.localeCompare(b.title, 'de'));
const addTpl = ({ title, catId, xp }) => put('tpls', { id: uid(), title, catId: catId || null, xp, uses: 0 });
const updateTpl = (id, patch) => put('tpls', { ...S.tpls[id], ...patch });
const deleteTpl = (id) => drop('tpls', id);
function useTpl(id, date) {
  const t = S.tpls[id];
  put('tpls', { ...t, uses: (t.uses || 0) + 1 });
  return addTask({ title: t.title, catId: t.catId, xp: t.xp, date });
}

/* ------------------------------------------------------------- Reminders
   kind 'once':   date 'YYYY-MM-DD'
   kind 'yearly': md 'MM-DD', year optional (birth year, for the age)
   `seen` remembers dismissals per occurrence; the notice ahead of time and the
   day itself are dismissed separately, so a birthday still shows on the day. */
const addRem = (r) => put('rems', { id: uid(), seen: {}, ...r });
const updateRem = (id, patch) => put('rems', { ...S.rems[id], ...patch });
const deleteRem = (id) => drop('rems', id);

function yearlyDate(rem, year) {
  if (rem.md === '02-29' && !isLeap(year)) return `${year}-02-28`;
  return `${year}-${rem.md}`;
}
function nextYearly(rem, from) {
  const y = Number(from.slice(0, 4));
  const d = yearlyDate(rem, y);
  return d >= from ? d : yearlyDate(rem, y + 1);
}
const nextOf = (rem, from = todayStr()) => (rem.kind === 'yearly' ? nextYearly(rem, from) : rem.date);

function remsForDay(date, today = todayStr()) {
  const out = [];
  for (const rem of live('rems')) {
    const lead = rem.lead || 0;
    const seen = rem.seen || {};
    if (rem.kind === 'once' && rem.doneAt) continue;
    const occ = nextOf(rem, date);
    const until = diffDays(occ, date);
    if (rem.kind === 'once' && until < 0) {
      if (date === today) out.push({ rem, occ, until, late: true });
      continue;
    }
    if (until === 0) {
      if (!seen[occ]) out.push({ rem, occ, until });
    } else if (until <= lead && !seen[`${occ}:lead`]) {
      out.push({ rem, occ, until });
    }
  }
  return out.sort((a, b) => a.until - b.until);
}

function dismissRem(id, occ, until) {
  const rem = S.rems[id];
  if (rem.kind === 'once' && until <= 0) {
    return updateRem(id, { doneAt: Date.now() });
  }
  return updateRem(id, { seen: { ...rem.seen, [until > 0 ? `${occ}:lead` : occ]: 1 } });
}
const reopenRem = (id) => updateRem(id, { doneAt: null, seen: {} });

const ageAt = (rem, occ) => (rem.year ? Number(occ.slice(0, 4)) - rem.year : null);

/* ----------------------------------------------------------------- Goals
   kind 'week': period = Monday of that week · 'month': period = 'YYYY-MM' · 'big': none */
const addGoal = (g) => put('goals', { id: uid(), steps: [], doneAt: null, order: Date.now(), ...g });
const updateGoal = (id, patch) => put('goals', { ...S.goals[id], ...patch });
const deleteGoal = (id) => drop('goals', id);

const currentPeriod = (kind, today = todayStr()) =>
  kind === 'week' ? weekStart(today) : kind === 'month' ? monthOf(today) : null;

function goalsFor(kind, period) {
  return live('goals')
    .filter((g) => g.kind === kind && (kind === 'big' || g.period === period))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}
/** Unfinished goals of earlier weeks or months, offered for carrying over. */
function staleGoals(kind, period) {
  if (kind === 'big') return [];
  return live('goals')
    .filter((g) => g.kind === kind && g.period < period && !g.doneAt)
    .sort((a, b) => (a.period < b.period ? 1 : -1));
}
function completeGoal(id, today = todayStr()) {
  const g = S.goals[id];
  const before = levelSnapshot(g.catId);
  updateGoal(id, { doneAt: Date.now(), doneOn: today, steps: (g.steps || []).map((s) => ({ ...s, done: true })) });
  const after = levelSnapshot(g.catId);
  return { xp: g.xp, catId: g.catId, before, after };
}
const reopenGoal = (id) => updateGoal(id, { doneAt: null, doneOn: null });
function toggleStep(goalId, stepId) {
  const g = S.goals[goalId];
  updateGoal(goalId, { steps: g.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s)) });
}

/* ------------------------------------------------------------- Demo data
   Fixed ids and u:1 make the examples identical on every device, and any real
   change or removal automatically beats them when two devices merge. */
function seedDemo(today = todayStr()) {
  const raw = (col, obj) => {
    S[col][obj.id] = { ...obj, u: 1 };
  };
  [
    ['cat-schule', 'Schule', '📚', '#FFC145'],
    ['cat-sport', 'Sport', '💪', '#FF7A59'],
    ['cat-projekte', 'Projekte', '🎮', '#8F9BFF'],
    ['cat-alltag', 'Alltag', '🏠', '#37D5D6'],
  ].forEach(([id, name, emoji, color], i) => raw('cats', { id, name, emoji, color, order: i + 1 }));

  const wd = weekdayOf(today);
  const task = (id, title, catId, xp, order, extra = {}) =>
    raw('tasks', { id, title, catId, xp, date: today, repeat: null, order, demo: true, ...extra });
  task('demo-t1', 'Biochemie wiederholen', 'cat-schule', 25, 1);
  task('demo-t2', '30 Minuten laufen', 'cat-sport', 50, 2, {
    repeat: makeRepeat({ days: [...new Set([wd, 2, 4])], mode: 'weekly', date: addDays(today, -21) }),
  });
  task('demo-t3', 'Am Spiel weiterbauen', 'cat-projekte', 25, 3);
  task('demo-t4', 'Zimmer aufräumen', 'cat-alltag', 10, 4);
  task('demo-t5', 'Mathe-Hausaufgaben', 'cat-schule', 25, 5, { date: addDays(today, 1) });
  task('demo-t6', 'Präsentation vorbereiten', 'cat-schule', 50, 6, { date: addDays(today, 2) });

  // Earlier days, so the levels, the streak and the activity map have something to show.
  // Sport stops just short of level 3: the first run of the day levels it up.
  const history = [
    ['cat-sport', [50, 50, 35, 50, 50]],
    ['cat-schule', [25, 25, 50, 25, 25, 50, 25, 25]],
    ['cat-projekte', [50, 25, 50, 25, 25, 25]],
    ['cat-alltag', [10, 15, 10, 15, 10]],
  ];
  history.forEach(([catId, xps], c) => {
    xps.forEach((xp, i) => {
      const date = addDays(today, -(1 + ((i * 2 + c) % 16)));
      const id = `demo-h${c}${i}`;
      raw('done', { id, taskId: id, title: 'Beispiel', date, xp, catId, at: fromYmd(date).getTime(), demo: true });
    });
  });

  raw('tpls', { id: 'demo-v1', title: 'Müll rausbringen', catId: 'cat-alltag', xp: 10, uses: 3, demo: true });
  raw('tpls', { id: 'demo-v2', title: 'Wäsche waschen', catId: 'cat-alltag', xp: 15, uses: 2, demo: true });
  raw('tpls', { id: 'demo-v3', title: 'Vokabeln lernen', catId: 'cat-schule', xp: 20, uses: 1, demo: true });
  raw('tpls', { id: 'demo-v4', title: 'Krafttraining', catId: 'cat-sport', xp: 50, uses: 0, demo: true });

  const birthday = fromYmd(addDays(today, 12));
  raw('rems', {
    id: 'demo-r1', kind: 'yearly', title: 'Geburtstag von Mama', md: `${pad2(birthday.getMonth() + 1)}-${pad2(birthday.getDate())}`,
    year: null, lead: 7, seen: {}, demo: true,
  });
  raw('rems', { id: 'demo-r2', kind: 'once', title: 'Zahnarzt', date: addDays(today, 3), time: '15:30', lead: 3, seen: {}, demo: true });
  raw('rems', { id: 'demo-r3', kind: 'once', title: 'Pfandflaschen mitnehmen', date: today, time: '', lead: 0, seen: {}, demo: true });

  const goal = (id, title, kind, period, catId, xp, steps = [], extra = {}) =>
    raw('goals', { id, title, kind, period, catId, xp, steps, doneAt: null, order: Number(id.slice(-1)), demo: true, ...extra });
  const s = (id, t, done = false) => ({ id, t, done });
  goal('demo-g1', 'Dreimal Sport diese Woche', 'week', weekStart(today), 'cat-sport', 75, [s('a', 'Einheit 1', true), s('b', 'Einheit 2'), s('c', 'Einheit 3')]);
  goal('demo-g2', 'Bio-Kapitel 4 durcharbeiten', 'week', weekStart(today), 'cat-schule', 50);
  goal('demo-g3', 'Erste Spielversion veröffentlichen', 'month', monthOf(today), 'cat-projekte', 200, [s('a', 'Hauptmechanik fertig', true), s('b', 'Testen lassen'), s('c', 'Veröffentlichen')]);
  goal('demo-g4', 'Abitur schaffen', 'big', null, 'cat-schule', 1000, [], { target: `${Number(today.slice(0, 4)) + 1}-06-30` });

  rev++;
  saveStoreNow();
}

const hasDemo = () => COLS.some((c) => Object.values(S[c]).some((e) => e.demo && !e.del));

function removeDemo() {
  for (const c of COLS) {
    for (const e of Object.values(S[c])) {
      if (e.demo && !e.del) {
        e.del = true;
        e.u = Date.now();
      }
    }
  }
  touch();
}

function wipeAll() {
  for (const c of COLS) {
    for (const e of Object.values(S[c])) {
      if (!e.del) {
        e.del = true;
        e.u = Date.now();
      }
    }
  }
  touch();
}

const exportPayload = () => JSON.stringify({ app: 'tagwerk', exportedAt: new Date().toISOString(), state: S }, null, 1);

/** Merges a backup file into the current data. Throws on files from elsewhere. */
function importPayload(text) {
  const parsed = JSON.parse(text);
  const incoming = parsed.state || parsed;
  if (!COLS.some((c) => incoming[c])) throw new Error('Keine Tagwerk-Daten');
  const changed = mergeRemote(incoming);
  if (changed) onStoreChange();
  return changed;
}

/* ---------------------------------------------------- Calendar file (.ics)
   A web app can't wake itself up while it is closed. The phone's calendar can,
   so a reminder can be handed over to it, with an alarm attached. */
function icsFor(rem, today = todayStr()) {
  const occ = nextOf(rem, today);
  const stamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
  const text = (s) => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const day = occ.replace(/-/g, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tagwerk//DE',
    'BEGIN:VEVENT',
    `UID:${rem.id}@tagwerk`,
    `DTSTAMP:${stamp}`,
  ];
  if (rem.time) {
    lines.push(`DTSTART:${day}T${rem.time.replace(':', '')}00`, 'DURATION:PT1H');
  } else {
    lines.push(`DTSTART;VALUE=DATE:${day}`);
  }
  lines.push(`SUMMARY:${text(rem.title)}`);
  if (rem.kind === 'yearly') lines.push('RRULE:FREQ=YEARLY');
  const alarm = (trigger) => lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(rem.title)}`, `TRIGGER:${trigger}`, 'END:VALARM');
  alarm(rem.time ? '-PT30M' : 'PT9H');
  if (rem.lead) alarm(`-P${rem.lead}D`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}
