// Checks the date, repeat, level, reminder and merge logic without a browser.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const code =
  readFileSync(new URL('../src/js/00-util.js', import.meta.url), 'utf8') +
  readFileSync(new URL('../src/js/10-store.js', import.meta.url), 'utf8') +
  `
  globalThis.__t = { addDays, diffDays, weekStart, isoWeek, weekdayOf, fmtWeekRange, addMonths,
    makeRepeat, repeatHits, occursOn, previewOccurrences, repeatLabel, levelOf, catLevel, totalLevel, rankOf,
    addTask, dayTasks, completeTask, uncompleteTask, isDone, dayStat, overdueTasks, moveOccurrence, skipOccurrence,
    deleteTask, routineStreak, streakInfo, addRem, remsForDay, dismissRem, nextOf, ageAt, yearlyDate,
    addGoal, completeGoal, reopenGoal, goalsFor, staleGoals, currentPeriod, derived, mergeRemote, needsPush,
    seedDemo, hasDemo, removeDemo, wipeAll, levelSnapshot, addCat, addTpl, useTpl, icsFor, importPayload, exportPayload,
    shardState, assembleShards, updateTask,
    getS: () => S, reset: () => { S = blankState(); rev++; }, setS: (x) => { S = x; rev++; } };
`;
const store = new Map();
const ctx = vm.createContext({
  console,
  setTimeout: () => 0,
  clearTimeout: () => {},
  localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
});
vm.runInContext(code, ctx);
const t = ctx.__t;

let passed = 0;
const test = (name, fn) => {
  t.reset();
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`FAIL ${name}\n`, e.message);
    process.exitCode = 1;
  }
};
const plain = (x) => JSON.parse(JSON.stringify(x));

test('Datumsrechnung', () => {
  assert.equal(t.addDays('2026-03-28', 2), '2026-03-30'); // Zeitumstellung
  assert.equal(t.addDays('2026-10-24', 2), '2026-10-26'); // Zeitumstellung
  assert.equal(t.diffDays('2026-11-08', '2026-11-01'), 7);
  assert.equal(t.weekdayOf('2026-11-08'), 7); // Sonntag
  assert.equal(t.weekStart('2026-11-08'), '2026-11-02');
  assert.equal(t.weekStart('2026-11-09'), '2026-11-09');
  assert.equal(t.isoWeek('2026-11-08'), 45);
  assert.equal(t.isoWeek('2021-01-03'), 53);
  assert.equal(t.isoWeek('2026-01-01'), 1);
  assert.equal(t.addMonths('2026-11', 2), '2027-01');
  assert.equal(t.fmtWeekRange('2026-11-09'), '9.–15. Nov');
  assert.equal(t.fmtWeekRange('2026-11-30'), '30. Nov – 6. Dez');
});

test('Wiederholung: jede Woche Donnerstag und Freitag', () => {
  const r = t.makeRepeat({ days: [5, 4], mode: 'weekly', date: '2026-11-09' });
  assert.equal(t.repeatHits(r, '2026-11-12'), true); // Do
  assert.equal(t.repeatHits(r, '2026-11-13'), true); // Fr
  assert.equal(t.repeatHits(r, '2026-11-14'), false); // Sa
  assert.equal(t.repeatHits(r, '2026-11-19'), true); // Folgewoche
  assert.equal(t.repeatHits(r, '2026-11-05'), false); // vor dem Start
  assert.equal(t.repeatLabel(r), 'Do, Fr');
});

test('Wiederholung: nur in dieser einen Woche', () => {
  const r = t.makeRepeat({ days: [4, 5], mode: 'week', date: '2026-11-09' });
  assert.equal(t.repeatHits(r, '2026-11-12'), true);
  assert.equal(t.repeatHits(r, '2026-11-13'), true);
  assert.equal(t.repeatHits(r, '2026-11-19'), false);
  assert.deepEqual(plain(t.previewOccurrences(r, 5)), ['2026-11-12', '2026-11-13']);
  assert.equal(t.repeatLabel(r), 'Do, Fr · nur KW 46');
  // Bereits vergangene Tage derselben Woche kommen nicht mehr vor
  const late = t.makeRepeat({ days: [1, 4], mode: 'week', date: '2026-11-11' });
  assert.deepEqual(plain(t.previewOccurrences(late, 5)), ['2026-11-12']);
});

test('Wiederholung: alle 2 Wochen', () => {
  const r = t.makeRepeat({ days: [1], mode: 'biweekly', date: '2026-11-09' });
  assert.equal(t.repeatHits(r, '2026-11-09'), true);
  assert.equal(t.repeatHits(r, '2026-11-16'), false);
  assert.equal(t.repeatHits(r, '2026-11-23'), true);
});

test('Vorplanen und abhaken', () => {
  const a = t.addTask({ title: 'Heute', xp: 25, date: '2026-11-08', catId: 'c1' });
  const b = t.addTask({ title: 'Übermorgen', xp: 10, date: '2026-11-10', catId: 'c1' });
  assert.equal(t.dayTasks('2026-11-08').length, 1);
  assert.equal(t.dayTasks('2026-11-10')[0].task.id, b.id);
  const res = t.completeTask(a.id, '2026-11-08', '2026-11-08');
  assert.equal(res.xp, 25);
  assert.equal(t.derived().xpCat.c1, 25);
  assert.equal(t.dayStat('2026-11-08').done, 1);
  t.uncompleteTask(a.id, '2026-11-08');
  assert.equal(t.derived().xpTotal, 0);
});

test('Überfällige Aufgabe zählt beim Abhaken für heute', () => {
  const a = t.addTask({ title: 'Alt', xp: 10, date: '2026-11-01' });
  assert.equal(t.overdueTasks('2026-11-08').length, 1);
  const res = t.completeTask(a.id, '2026-11-01', '2026-11-08');
  assert.equal(res.date, '2026-11-08');
  assert.equal(t.overdueTasks('2026-11-08').length, 0);
  assert.equal(t.isDone(a.id, '2026-11-08'), true);
});

test('Serien: jeder Tag zählt einzeln, Verschieben und Überspringen', () => {
  const a = t.addTask({ title: 'Lesen', xp: 10, date: '2026-11-02', repeat: t.makeRepeat({ days: [1, 2, 3, 4, 5, 6, 7], mode: 'weekly', date: '2026-11-02' }) });
  t.completeTask(a.id, '2026-11-06', '2026-11-08');
  t.completeTask(a.id, '2026-11-07', '2026-11-08');
  assert.equal(t.routineStreak(t.getS().tasks[a.id], '2026-11-08'), 2); // heute noch offen bricht nichts
  t.completeTask(a.id, '2026-11-08', '2026-11-08');
  assert.equal(t.routineStreak(t.getS().tasks[a.id], '2026-11-08'), 3);
  t.moveOccurrence(a.id, '2026-11-09', '2026-11-10');
  assert.equal(t.dayTasks('2026-11-09').length, 0);
  assert.equal(t.dayTasks('2026-11-10').length, 2); // Serie + Kopie
  t.skipOccurrence(a.id, '2026-11-11');
  assert.equal(t.dayTasks('2026-11-11').length, 0);
  assert.equal(t.dayTasks('2026-11-12').length, 1);
  t.deleteTask(a.id);
  assert.equal(t.derived().xpTotal, 30); // erarbeitete XP einer Serie bleiben
});

test('Einmalige Aufgabe löschen nimmt ihre XP mit', () => {
  const a = t.addTask({ title: 'X', xp: 40, date: '2026-11-08' });
  t.completeTask(a.id, '2026-11-08', '2026-11-08');
  t.deleteTask(a.id);
  assert.equal(t.derived().xpTotal, 0);
});

test('Level und Ränge', () => {
  assert.equal(t.catLevel(0).level, 1);
  assert.equal(t.catLevel(99).level, 1);
  assert.equal(t.catLevel(100).level, 2);
  assert.equal(t.catLevel(249).level, 2);
  assert.equal(t.catLevel(250).level, 3);
  assert.equal(t.catLevel(250).need, 200);
  assert.equal(t.totalLevel(250).level, 2);
  assert.equal(t.rankOf(1), 'Funke');
  assert.equal(t.rankOf(6), 'Flamme');
  assert.equal(t.rankOf(50), 'Supernova');
});

test('Erinnerungen: jährlich mit Vorlauf, einmalig, Schaltjahr', () => {
  const y = t.addRem({ kind: 'yearly', title: 'Geburtstag', md: '11-12', year: 2007, lead: 3 });
  assert.equal(t.nextOf(y, '2026-11-08'), '2026-11-12');
  assert.equal(t.nextOf(y, '2026-11-13'), '2027-11-12');
  assert.equal(t.ageAt(y, '2026-11-12'), 19);
  assert.equal(t.remsForDay('2026-11-08', '2026-11-08').length, 0);
  const lead = t.remsForDay('2026-11-09', '2026-11-08');
  assert.equal(lead[0].until, 3);
  assert.equal(t.remsForDay('2027-11-12', '2026-11-08')[0].until, 0); // auch nächstes Jahr
  // Hinweis wegklicken lässt den Tag selbst bestehen
  t.dismissRem(y.id, '2026-11-12', 3);
  assert.equal(t.remsForDay('2026-11-09', '2026-11-08').length, 0);
  assert.equal(t.remsForDay('2026-11-12', '2026-11-08').length, 1);
  t.dismissRem(y.id, '2026-11-12', 0);
  assert.equal(t.remsForDay('2026-11-12', '2026-11-08').length, 0);
  assert.equal(t.remsForDay('2027-11-12', '2026-11-08').length, 1); // nächstes Jahr wieder da

  const o = t.addRem({ kind: 'once', title: 'Zahnarzt', date: '2026-11-10', lead: 0 });
  assert.equal(t.remsForDay('2026-11-10', '2026-11-08').some((r) => r.rem.id === o.id), true);
  assert.equal(t.remsForDay('2026-11-09', '2026-11-08').some((r) => r.rem.id === o.id), false);
  // nicht weggeklickt: bleibt heute sichtbar, aber nur heute
  const late = t.remsForDay('2026-11-12', '2026-11-12').find((r) => r.rem.id === o.id);
  assert.equal(late.late, true);
  assert.equal(t.remsForDay('2026-11-12', '2026-11-20').some((r) => r.rem.id === o.id), false);
  t.dismissRem(o.id, '2026-11-10', -2);
  assert.equal(t.remsForDay('2026-11-12', '2026-11-12').some((r) => r.rem.id === o.id), false);

  const leap = t.addRem({ kind: 'yearly', title: 'Schaltjahr', md: '02-29', lead: 0 });
  assert.equal(t.yearlyDate(leap, 2027), '2027-02-28');
  assert.equal(t.yearlyDate(leap, 2028), '2028-02-29');
});

test('Ziele: XP, Zeitraum, offene aus der Vorwoche', () => {
  const g = t.addGoal({ title: 'A', kind: 'week', period: '2026-11-02', xp: 50, catId: 'c' });
  const m = t.addGoal({ title: 'B', kind: 'month', period: '2026-11', xp: 150, catId: 'c' });
  const b = t.addGoal({ title: 'C', kind: 'big', period: null, xp: 500, catId: 'd' });
  assert.equal(t.goalsFor('week', '2026-11-02').length, 1);
  assert.equal(t.goalsFor('week', '2026-11-09').length, 0);
  assert.equal(t.staleGoals('week', '2026-11-09')[0].id, g.id);
  assert.equal(t.goalsFor('big', null)[0].id, b.id);
  t.completeGoal(m.id, '2026-11-08');
  assert.equal(t.derived().xpCat.c, 150);
  assert.equal(t.derived().xpDay['2026-11-08'], 150);
  t.reopenGoal(m.id);
  assert.equal(t.derived().xpTotal, 0);
  assert.equal(t.currentPeriod('week', '2026-11-08'), '2026-11-02');
});

test('Sync: Änderungen beider Geräte bleiben erhalten, neuer gewinnt', () => {
  const a = t.addTask({ title: 'Original', xp: 10, date: '2026-11-08' });
  const remote = plain(t.getS());
  // Gerät B ändert den Titel und hakt etwas ab (neuere Zeitstempel)
  remote.tasks[a.id].title = 'Von Gerät B';
  remote.tasks[a.id].u += 1000;
  remote.done['x|2026-11-08'] = { id: 'x|2026-11-08', taskId: 'x', date: '2026-11-08', xp: 5, u: Date.now() };
  // Gerät A legt gleichzeitig etwas Neues an
  const c = t.addTask({ title: 'Von Gerät A', xp: 10, date: '2026-11-08' });
  assert.equal(t.needsPush(remote), true);
  assert.equal(t.mergeRemote(remote), true);
  assert.equal(t.getS().tasks[a.id].title, 'Von Gerät B');
  assert.equal(t.getS().tasks[c.id].title, 'Von Gerät A');
  assert.equal(t.getS().done['x|2026-11-08'].xp, 5);
  assert.equal(t.mergeRemote(remote), false); // zweites Mal ändert nichts
  // Gelöscht schlägt älter
  const older = plain(t.getS());
  t.deleteTask(c.id);
  assert.equal(t.mergeRemote(older), false);
  assert.equal(t.getS().tasks[c.id].del, true);
});

test('Sync im Artifact: Aufteilen und Zusammensetzen verliert nichts', () => {
  t.seedDemo('2026-11-08');
  const a = t.addTask({ title: 'Oktober', xp: 10, date: '2026-10-05' });
  t.completeTask(a.id, '2026-10-05', '2026-10-05');
  const shards = plain(t.shardState(t.getS()));
  assert.ok(shards.core && shards['tasks-2026-10'] && shards['tasks-2026-11'] && shards['done-2026-10']);
  assert.ok(shards.core.tasks['demo-t2'], 'Serien liegen im Kern-Dokument');
  assert.ok(Object.values(shards).every((s) => JSON.stringify(s).length < 256 * 1024));
  const back = plain(t.assembleShards(Object.values(shards)));
  for (const c of ['cats', 'tasks', 'done', 'tpls', 'rems', 'goals']) {
    assert.deepEqual(Object.keys(back[c]).sort(), Object.keys(plain(t.getS())[c]).sort(), c);
  }
  // Verschobene Aufgabe liegt kurz in zwei Monats-Dokumenten: die neuere Kopie zählt
  const old = plain(shards['tasks-2026-10']);
  const moved = { tasks: { [a.id]: { ...old.tasks[a.id], date: '2026-11-20', u: old.tasks[a.id].u + 5000 } } };
  assert.equal(t.assembleShards([moved, old]).tasks[a.id].date, '2026-11-20');
  assert.equal(t.assembleShards([old, moved]).tasks[a.id].date, '2026-11-20');
  // Eingefrorene Objekte aus der Datenbank bleiben veränderbar
  const frozen = Object.freeze({ tasks: Object.freeze({ x: Object.freeze({ id: 'x', u: 2, title: 'a' }) }) });
  const out = t.assembleShards([frozen]);
  out.tasks.x.title = 'b';
  assert.equal(out.tasks.x.title, 'b');
});

test('Beispieldaten: Sport steht kurz vor dem Level-up, Entfernen räumt auf', () => {
  t.seedDemo('2026-11-08');
  assert.equal(t.hasDemo(), true);
  const sport = t.catLevel(t.derived().xpCat['cat-sport']);
  assert.equal(sport.level, 2);
  assert.ok(sport.need - sport.into <= 50, 'der Lauf von heute soll Sport auf Level 3 bringen');
  assert.ok(t.dayTasks('2026-11-08').length >= 3);
  assert.ok(t.streakInfo('2026-11-08').n >= 1);
  // Echte Änderung gewinnt gegen die Beispiel-Version desselben Eintrags
  const deviceA = plain(t.getS());
  t.removeDemo();
  assert.equal(t.hasDemo(), false);
  assert.equal(t.derived().xpTotal, 0);
  assert.equal(t.mergeRemote(deviceA), false);
  assert.equal(t.hasDemo(), false);
});

test('Sicherung: Export und Import', () => {
  const a = t.addTask({ title: 'Sichern', xp: 10, date: '2026-11-08' });
  const file = t.exportPayload();
  t.reset();
  assert.equal(t.importPayload(file), true);
  assert.equal(t.getS().tasks[a.id].title, 'Sichern');
  assert.throws(() => t.importPayload('{"foo":1}'));
});

test('Kalenderdatei', () => {
  const y = t.addRem({ kind: 'yearly', title: 'Geburtstag, Lena', md: '11-12', lead: 7 });
  const ics = t.icsFor(y, '2026-11-08');
  assert.match(ics, /DTSTART;VALUE=DATE:20261112/);
  assert.match(ics, /RRULE:FREQ=YEARLY/);
  assert.match(ics, /SUMMARY:Geburtstag\\, Lena/);
  assert.match(ics, /TRIGGER:-P7D/);
  const o = t.addRem({ kind: 'once', title: 'Termin', date: '2026-12-01', time: '15:30' });
  assert.match(t.icsFor(o, '2026-11-08'), /DTSTART:20261201T153000/);
});

console.log(process.exitCode ? 'Tests fehlgeschlagen' : `${passed} Tests bestanden`);
