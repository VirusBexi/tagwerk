/* ============================================================== QUICK ENTRY
   "Mathe lernen morgen 50xp #schule": words in the title that fill in the form.
   The parser is pure (no DOM, no state), so the tests run it directly. */

const QUICK_WD = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'];
const QUICK_WD_SHORT = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
const QUICK_MONTHS = ['januar', 'februar', 'm(?:ä|ae)rz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];
const QUICK_NUM = { ein: 1, eine: 1, einem: 1, einer: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10 };
const QUICK_ORDER = ['date', 'repeat', 'xp', 'cat'];

/** Lowercase without accents, to compare names. */
const quickFold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

/** Every place where `body` stands as a word of its own. No lookbehind (older iPhones do not know it):
    the character before is captured, the one after is only looked at. */
function quickFind(low, body) {
  const out = [];
  const re = new RegExp(`(^|[\\s(])(${body})(?=$|[\\s,.;:!?)])`, 'gu');
  for (const m of low.matchAll(re)) {
    const start = m.index + m[1].length;
    out.push({ start, end: start + m[2].length, text: m[2], g: m.slice(3) });
  }
  return out;
}

/** 'montag, mi und freitags' → [1, 3, 5] */
function quickDays(s) {
  const days = new Set();
  for (const w of s.split(/[\s,]+/)) {
    const base = w.length > 2 && w.endsWith('s') ? w.slice(0, -1) : w;
    const at = QUICK_WD.includes(base) ? QUICK_WD.indexOf(base) : QUICK_WD_SHORT.indexOf(w);
    if (at >= 0) days.add(at + 1);
  }
  return [...days].sort((a, b) => a - b);
}

function quickRepeatHits(low) {
  const sep = '(?:\\s*,\\s*|\\s+und\\s+|\\s+)';
  // A list of one sort only: "jeden Montag so viel lernen" must not turn "so" into Sunday.
  const list = (names) => `(?:${names.join('|')})(?:${sep}(?:${names.join('|')}))*`;
  const hits = [];
  const add = (body, read) => quickFind(low, body).forEach((h) => hits.push({ ...h, days: [], mode: 'weekly', ...read(h) }));
  add('t(?:ä|ae)glich|jeden\\s+tag', () => ({ days: [1, 2, 3, 4, 5, 6, 7] }));
  add('werktags', () => ({ days: [1, 2, 3, 4, 5] }));
  add('jedes\\s+wochenende', () => ({ days: [6, 7] }));
  add(`jeden\\s+(?:${list(QUICK_WD)}|${list(QUICK_WD_SHORT)})`, (h) => ({ days: quickDays(h.text.slice(5)) }));
  add(list(QUICK_WD.map((w) => `${w}s`)), (h) => ({ days: quickDays(h.text) }));
  add('alle\\s+(?:2|zwei)\\s+wochen|jede\\s+zweite\\s+woche|alle\\s+14\\s+tage', () => ({ mode: 'biweekly' }));
  add('w(?:ö|oe)chentlich|jede\\s+woche', () => ({}));
  return hits.sort((a, b) => a.start - b.start);
}

/** A day and month as a date string. Without a year it is the next time that day comes. */
function quickYmd(day, month, year, today) {
  const d = Number(day);
  const m = Number(month);
  const thisYear = Number(today.slice(0, 4));
  let y = year ? Number(year) : thisYear;
  if (year && year.length === 2) y += 2000;
  if (m < 1 || m > 12 || d < 1 || y > thisYear + 5) return null;
  const make = (yy) => (d <= daysInMonth(yy, m) ? `${yy}-${pad2(m)}-${pad2(d)}` : null);
  let s = make(y);
  if (s && !year && s < today) s = make(y + 1);
  return s && s >= today ? s : null;
}

function quickDateHits(low, today) {
  const pre = '(?:(?:am|bis|ab|f(?:ü|ue)r)\\s+)?';
  const hits = [];
  const add = (body, read) =>
    quickFind(low, body).forEach((h) => {
      const date = read(h);
      if (date) hits.push({ ...h, date });
    });
  // "Heute Abend" is today, but the words belong together and stay in the title.
  const dayPart = /^\s+(?:morgen|fr(?:ü|ue)h|vormittag|mittag|nachmittag|abend|nacht)(?=$|[\s,.;:!?)])/;
  quickFind(low, `${pre}heute`).forEach((h) => hits.push({ ...h, date: today, keep: dayPart.test(low.slice(h.end)) }));
  // "Guten Morgen", "heute Morgen", "am Morgen", "jeden Morgen": the morning, not tomorrow.
  add('(?:(?:bis|ab|f(?:ü|ue)r)\\s+)?morgen', (h) => (/(?:^|\s)(?:guten|heute|gestern|am|jeden|den|im)\s+$/.test(low.slice(0, h.start)) ? null : addDays(today, 1)));
  add(`${pre}(?:ü|ue)bermorgen`, () => addDays(today, 2));
  add(`(?:(?:am|bis|ab|f(?:ü|ue)r|n(?:ä|ae)chsten|kommenden)\\s+)?(${QUICK_WD.join('|')})`, (h) => {
    const ahead = (QUICK_WD.indexOf(h.g[0]) + 1 - weekdayOf(today) + 7) % 7 || 7;
    return addDays(today, ahead);
  });
  add(`${pre}n(?:ä|ae)chste\\s+woche`, () => addDays(weekStart(today), 7));
  add(`in\\s+(\\d{1,3}|${Object.keys(QUICK_NUM).join('|')})\\s+(tag|tagen|woche|wochen)`, (h) => {
    const n = QUICK_NUM[h.g[0]] || Number(h.g[0]);
    return n > 0 && n <= 365 ? addDays(today, n * (h.g[1][0] === 'w' ? 7 : 1)) : null;
  });
  // 12.11. or 12.11.2026. Without the last dot only after "am", so that "2.5 km" stays a distance.
  add('((?:am|bis|ab)\\s+)?(\\d{1,2})\\.\\s?(\\d{1,2})(\\.(\\d{4}|\\d{2})?)?', (h) => (h.g[0] || h.g[3] ? quickYmd(h.g[1], h.g[2], h.g[4], today) : null));
  add(`${pre}(\\d{1,2})\\.\\s?(${QUICK_MONTHS.join('|')})(?:\\s+(\\d{4}))?`, (h) => {
    const month = QUICK_MONTHS.findIndex((m) => new RegExp(`^${m}$`).test(h.g[1])) + 1;
    return quickYmd(h.g[0], month, h.g[2], today);
  });
  return hits;
}

function quickCat(tag, cats) {
  const want = quickFold(tag);
  const named = cats.map((c) => ({ c, n: quickFold(c.name || '') }));
  const hit =
    named.find((x) => x.n === want) ||
    named.find((x) => x.n.startsWith(want)) ||
    named.find((x) => x.n.split(/[^a-z0-9]+/).some((w) => w.startsWith(want)));
  return hit ? hit.c : null;
}

/**
 * Reads date, repeat, XP and category out of a title.
 * `off` holds the keys the user waved away: those words stay plain text.
 * A repeat with no days means "on the weekday of the start date".
 */
function parseQuick(text, today, cats, off) {
  const src = String(text || '').normalize('NFC');
  const low = src.toLowerCase();
  const res = { title: src.trim(), parts: [], date: null, xp: null, catId: null, repeat: null };
  if (low.length !== src.length || !src.trim()) return res;
  const skip = off || {};
  const cut = [];
  const lastOf = (hits, kind) => {
    const live = hits.filter((h) => !skip[`${kind}:${h.text}`]).sort((a, b) => a.start - b.start || a.end - b.end);
    return live[live.length - 1] || null;
  };

  // Repeats first, and their words are hidden from the date search: "jeden Montag" is not "next Monday".
  const rep = quickRepeatHits(low);
  const chars = low.split('');
  for (const h of rep) chars.fill(' ', h.start, h.end);
  if (rep.length) {
    const key = `repeat:${rep.map((h) => h.text).join('+')}`;
    if (!skip[key]) {
      const days = [...new Set(rep.flatMap((h) => h.days))].sort((a, b) => a - b);
      const mode = rep.some((h) => h.mode === 'biweekly') ? 'biweekly' : 'weekly';
      res.repeat = { days, mode };
      const label = days.length ? repeatLabel({ days, mode }) : mode === 'biweekly' ? 'Alle 2 Wochen' : 'Jede Woche';
      res.parts.push({ kind: 'repeat', key, label });
      cut.push(...rep);
    }
  }

  const day = lastOf(quickDateHits(chars.join(''), today), 'date');
  if (day) {
    res.date = day.date;
    const year = day.date.slice(0, 4) === today.slice(0, 4) ? '' : ` ${day.date.slice(0, 4)}`;
    res.parts.push({ kind: 'date', key: `date:${day.text}`, label: relDay(day.date, today) || fmtWdShort(day.date) + year });
    if (!day.keep) cut.push(day);
  }

  const xp = lastOf(
    quickFind(low, '\\+?(\\d{1,4})\\s?xp|\\+(\\d{1,4})')
      .map((h) => ({ ...h, xp: Number(h.g[0] || h.g[1]) }))
      .filter((h) => h.xp > 0),
    'xp',
  );
  if (xp) {
    res.xp = xp.xp;
    res.parts.push({ kind: 'xp', key: `xp:${xp.text}`, label: `+${xp.xp} XP` });
    cut.push(xp);
  }

  const cat = lastOf(
    quickFind(low, '#([\\p{L}\\p{N}_-]+)')
      .map((h) => ({ ...h, cat: quickCat(h.g[0], cats || []) }))
      .filter((h) => h.cat),
    'cat',
  );
  if (cat) {
    res.catId = cat.cat.id;
    res.parts.push({ kind: 'cat', key: `cat:${cat.text}`, label: `${cat.cat.emoji ? `${cat.cat.emoji} ` : ''}${cat.cat.name}` });
    cut.push(cat);
  }

  res.parts.sort((a, b) => QUICK_ORDER.indexOf(a.kind) - QUICK_ORDER.indexOf(b.kind));
  if (!cut.length) return res;
  const rest = src.split('');
  for (const h of cut) rest.fill('\n', h.start, h.end);
  res.title = rest
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.;:!?])/g, '$1')
    .replace(/^[\s,;:.–-]+|[\s,;:–-]+$/g, '');
  return res;
}

/* What each kind of word sets in the form of a new task. */
const QUICK_FIELDS = { date: ['date', 'calMonth'], xp: ['xp'], cat: ['catId'], repeat: ['repeatOn', 'days', 'mode'] };

/**
 * Brings the form in line with the title. Each word is applied once: what the user then sets by hand stays,
 * and when the word goes away again, the form returns to what it was before.
 * Returns whether something changed, and whether a new word was picked up.
 */
function applyQuick(d, today = todayStr()) {
  const q = parseQuick(d.title, today, sortedCats(), d.quickOff);
  const held = d.quickHeld || (d.quickHeld = {});
  let touched = false;
  let fresh = false;
  for (const kind of QUICK_ORDER) {
    const keys = QUICK_FIELDS[kind];
    const snap = () => JSON.stringify(keys.map((k) => d[k]));
    const part = q.parts.find((p) => p.kind === kind);
    const h = held[kind];
    // "Jede Woche" follows the weekday of the date, so a new date makes it a new word.
    const follows = part && kind === 'repeat' && !q.repeat.days.length;
    const key = part ? part.key + (follows ? `@${weekdayOf(d.date)}` : '') : '';
    if (part && h && h.key === key) continue;
    const byHand = h && snap() !== h.now;
    if (byHand && follows && h.key.split('@')[0] === part.key) {
      h.key = key;
      continue;
    }
    let prev = keys.map((k) => (Array.isArray(d[k]) ? [...d[k]] : d[k]));
    if (h) {
      if (!byHand) {
        keys.forEach((k, i) => (d[k] = h.prev[i]));
        prev = h.prev;
      }
      delete held[kind];
      touched = true;
    }
    if (!part) continue;
    if (kind === 'date') {
      d.date = q.date;
      d.calMonth = monthOf(q.date);
    } else if (kind === 'xp') {
      d.xp = q.xp;
    } else if (kind === 'cat') {
      d.catId = q.catId;
    } else {
      d.repeatOn = true;
      d.days = q.repeat.days.length ? [...q.repeat.days] : [weekdayOf(d.date)];
      d.mode = q.repeat.mode;
    }
    const now = snap();
    // "#s", "#sc", "#sch" all mean the same category: that is one catch, not three.
    if (!h || h.now !== now) fresh = true;
    held[kind] = { key, prev, now };
    touched = true;
  }
  const sig = q.parts.map((p) => `${p.key}=${p.label}`).join('|');
  if (sig !== (d.quickSig || '')) touched = true;
  d.quickSig = sig;
  d.quickParts = q.parts;
  return { touched, fresh, title: q.title };
}
