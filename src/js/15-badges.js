/* =================================================================== ERFOLGE
   Badges are never stored: each one is a pure function of the data that is
   there anyway, so they follow you to every device and can't get out of step.
   Only "this device already celebrated it" is remembered, in L.badges. */

const BADGE_GROUPS = [
  { id: 'tasks', name: 'Aufgaben', color: '#FFC145' },
  { id: 'streak', name: 'Serien', color: '#FF7A59' },
  { id: 'perfect', name: 'Perfekte Tage', color: '#FFE28C' },
  { id: 'xp', name: 'XP', color: '#8F9BFF' },
  { id: 'day', name: 'Tagesform', color: '#37D5D6' },
  { id: 'time', name: 'Uhrzeit', color: '#FF6F91' },
  { id: 'goals', name: 'Ziele', color: '#5FE3A1' },
  { id: 'level', name: 'Level', color: '#FA9537' },
];

/* [id, group, emoji, name, description, goal, stat]. ­ marks where a long name may break. */
const BADGES = [
  ['first', 'tasks', '👣', 'Erster Schritt', 'Erledige deine erste Aufgabe.', 1, 'tasks'],
  ['t10', 'tasks', '🏃', 'Warm­gelaufen', 'Erledige 10 Aufgaben.', 10, 'tasks'],
  ['t50', 'tasks', '💪', 'Macher', 'Erledige 50 Aufgaben.', 50, 'tasks'],
  ['t100', 'tasks', '💯', 'Drei­stellig', 'Erledige 100 Aufgaben.', 100, 'tasks'],
  ['t500', 'tasks', '🤖', 'Maschine', 'Erledige 500 Aufgaben.', 500, 'tasks'],

  ['s3', 'streak', '🌱', 'Dran­bleiben', '3 Tage in Folge mindestens eine Aufgabe.', 3, 'streak'],
  ['s7', 'streak', '📆', 'Eine ganze Woche', '7 Tage in Folge mindestens eine Aufgabe.', 7, 'streak'],
  ['s14', 'streak', '⚡', 'Zwei Wochen stark', '14 Tage in Folge mindestens eine Aufgabe.', 14, 'streak'],
  ['s30', 'streak', '🌙', 'Monat ohne Lücke', '30 Tage in Folge mindestens eine Aufgabe.', 30, 'streak'],
  ['s100', 'streak', '🚀', 'Unauf­haltsam', '100 Tage in Folge mindestens eine Aufgabe.', 100, 'streak'],
  ['r7', 'streak', '🐾', 'Gewohn­heits­tier', 'Erledige eine Serien-Aufgabe 7-mal hintereinander.', 7, 'habit'],

  ['p1', 'perfect', '✨', 'Reiner Tisch', 'Schaffe an einem Tag alles, was anstand.', 1, 'perfect'],
  ['p7', 'perfect', '🌞', 'Sieben Sonnen', 'Schaffe 7 perfekte Tage.', 7, 'perfect'],
  ['p30', 'perfect', '🌻', 'Dauer­sonne', 'Schaffe 30 perfekte Tage.', 30, 'perfect'],

  ['x1000', 'xp', '⭐', 'Tausender', 'Sammle 1.000 XP.', 1000, 'xp'],
  ['x5000', 'xp', '🌟', 'Fünf­tausender', 'Sammle 5.000 XP.', 5000, 'xp'],
  ['x20000', 'xp', '🗻', 'Gipfel­stürmer', 'Sammle 20.000 XP.', 20000, 'xp'],
  ['w500', 'xp', '💎', 'Starke Woche', 'Sammle 500 XP in einer einzigen Woche.', 500, 'weekXp'],

  ['d100', 'day', '👍', 'Guter Tag', 'Sammle 100 XP an einem Tag.', 100, 'dayXp'],
  ['d250', 'day', '🍰', 'Sahnetag', 'Sammle 250 XP an einem Tag.', 250, 'dayXp'],
  ['d5', 'day', '🎳', 'Fünf auf einen Streich', 'Erledige 5 Aufgaben an einem Tag.', 5, 'dayTasks'],
  ['big', 'day', '🐘', 'Dicker Brocken', 'Erledige eine Aufgabe mit 100 XP oder mehr.', 100, 'bigTask'],

  ['early', 'time', '🐓', 'Früh­aufsteher', 'Hake eine Aufgabe vor 8 Uhr morgens ab.', 1, 'early'],
  ['night', 'time', '🦉', 'Nachteule', 'Hake eine Aufgabe nach 22 Uhr ab.', 1, 'night'],
  ['weekend', 'time', '🎉', 'Wochenend-Held', 'Erledige am Samstag und am Sonntag etwas.', 1, 'weekend'],

  ['g1', 'goals', '🎯', 'Ziel­strebig', 'Erreiche dein erstes Ziel.', 1, 'goals'],
  ['g10', 'goals', '🏹', 'Voll­treffer', 'Erreiche 10 Ziele.', 10, 'goals'],
  ['gbig', 'goals', '🏆', 'Großes Ding', 'Erreiche ein großes Ziel.', 1, 'bigGoals'],

  ['l5', 'level', '📈', 'Auf­steiger', 'Erreiche Gesamt-Level 5.', 5, 'level'],
  ['l10', 'level', '🔥', 'Feuer und Flamme', 'Erreiche Gesamt-Level 10.', 10, 'level'],
  ['c5', 'level', '🎓', 'Spezia­list', 'Bringe eine Kategorie auf Level 5.', 5, 'catLevel'],
  ['all3', 'level', '🌈', 'All­rounder', 'Bringe 3 Kategorien auf Level 3.', 3, 'catsAt3'],
].map(([id, group, emoji, name, desc, goal, stat]) => ({
  id,
  group,
  emoji,
  name,
  desc,
  goal,
  stat,
  color: BADGE_GROUPS.find((g) => g.id === group).color,
}));

let badgeCache = null;

/** Everything the badges look at, worked out once per change. */
function badgeStats(today = todayStr()) {
  if (badgeCache && badgeCache.rev === rev && badgeCache.today === today) return badgeCache.stats;
  const d = derived();
  const dates = Object.keys(d.byDate).sort();

  let streak = 0;
  let run = 0;
  let prev = null;
  let dayTasks_ = 0;
  let bigTask = 0;
  let early = 0;
  let night = 0;
  let weekend = 0;
  for (const date of dates) {
    run = prev && diffDays(date, prev) === 1 ? run + 1 : 1;
    if (run > streak) streak = run;
    prev = date;
    const entries = d.byDate[date];
    if (entries.length > dayTasks_) dayTasks_ = entries.length;
    if (weekdayOf(date) === 6 && d.byDate[addDays(date, 1)]) weekend = 1;
    for (const e of entries) {
      if (e.xp > bigTask) bigTask = e.xp;
      // Demo history has no real clock time.
      if (e.demo || !e.at) continue;
      const h = new Date(e.at).getHours();
      if (h >= 4 && h < 8) early = 1;
      if (h >= 22 || h < 4) night = 1;
    }
  }

  let dayXp = 0;
  const weeks = {};
  for (const [date, xp] of Object.entries(d.xpDay)) {
    if (xp > dayXp) dayXp = xp;
    const w = weekStart(date);
    weeks[w] = (weeks[w] || 0) + xp;
  }
  const weekXp = Math.max(0, ...Object.values(weeks));

  let habit = 0;
  const from = addDays(today, -400);
  for (const t of live('tasks')) {
    if (!t.repeat) continue;
    let n = 0;
    for (let day = t.repeat.start > from ? t.repeat.start : from; day <= today; day = addDays(day, 1)) {
      if (!occursOn(t, day)) continue;
      if (isDone(t.id, day)) {
        n++;
        if (n > habit) habit = n;
      } else if (day !== today) n = 0;
    }
  }

  let catLevelMax = 0;
  let catsAt3 = 0;
  for (const c of live('cats')) {
    const lv = catLevel(d.xpCat[c.id] || 0).level;
    if (lv > catLevelMax) catLevelMax = lv;
    if (lv >= 3) catsAt3++;
  }

  const stats = {
    tasks: d.taskCount,
    streak,
    habit,
    perfect: perfectDays(),
    xp: d.xpTotal,
    weekXp,
    dayXp,
    dayTasks: dayTasks_,
    bigTask,
    early,
    night,
    weekend,
    goals: d.goalCount,
    bigGoals: live('goals').filter((g) => g.doneAt && g.kind === 'big').length,
    level: totalLevel(d.xpTotal).level,
    catLevel: catLevelMax,
    catsAt3,
  };
  badgeCache = { rev, today, stats };
  return stats;
}

/** All badges with their progress. `on` is the date it was celebrated here, if known. */
function badgeList(today = todayStr()) {
  const s = badgeStats(today);
  const seen = L.badges || {};
  return BADGES.map((b) => {
    const cur = Math.min(s[b.stat] || 0, b.goal);
    return { ...b, cur, done: cur >= b.goal, pct: cur / b.goal, on: seen[b.id] || '' };
  });
}

const badgeCount = () => badgeList().filter((b) => b.done).length;

/** The unfinished badges that are closest to done. */
const badgesNextUp = (n = 3) =>
  badgeList()
    .filter((b) => !b.done)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, n);

/** Marks everything already earned as celebrated, without any fanfare. Returns how many were new. */
function badgesMarkQuietly() {
  const seen = (L.badges = L.badges || {});
  let n = 0;
  for (const b of badgeList()) {
    if (b.done && !(b.id in seen)) {
      seen[b.id] = '';
      n++;
    }
  }
  if (n) saveLocal();
  return n;
}

/** Badges earned since the last look. Each one is returned exactly once per device. */
function badgesCollect(today = todayStr()) {
  const seen = (L.badges = L.badges || {});
  const fresh = badgeList(today).filter((b) => b.done && !(b.id in seen));
  for (const b of fresh) seen[b.id] = today;
  if (fresh.length) saveLocal();
  return fresh.map((b) => ({ ...b, on: today }));
}

/** After data was removed: forget celebrations for badges that are no longer earned. */
function badgesPrune() {
  if (!L.badges) return;
  const done = new Set(badgeList().filter((b) => b.done).map((b) => b.id));
  for (const id of Object.keys(L.badges)) if (!done.has(id)) delete L.badges[id];
  saveLocal();
}
