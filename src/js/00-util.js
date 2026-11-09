'use strict';

/* ------------------------------------------------------------------ DOM */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC_MAP[c]);

/* ----------------------------------------------------------------- Math */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------------------------------------------------------- Dates
   Every calendar date in the app is a local 'YYYY-MM-DD' string. Dates are
   parsed at noon so daylight-saving jumps can never shift them to another day.
   Weekdays run 1 (Montag) to 7 (Sonntag). */
const WD_LONG = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const WD_SHORT = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const pad2 = (n) => String(n).padStart(2, '0');
const toYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromYmd = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
const todayStr = () => toYmd(new Date());
const addDays = (s, n) => {
  const d = fromYmd(s);
  d.setDate(d.getDate() + n);
  return toYmd(d);
};
/** Whole days from b to a (a - b). */
const diffDays = (a, b) => Math.round((fromYmd(a) - fromYmd(b)) / 864e5);
const weekdayOf = (s) => {
  const w = fromYmd(s).getDay();
  return w === 0 ? 7 : w;
};
const weekStart = (s) => addDays(s, 1 - weekdayOf(s));
const isoWeek = (s) => {
  const thursday = addDays(s, 4 - weekdayOf(s));
  return Math.floor(diffDays(thursday, `${thursday.slice(0, 4)}-01-01`) / 7) + 1;
};
const monthOf = (s) => s.slice(0, 7);
const addMonths = (m, n) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + n, 1, 12);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

const fmtDay = (s) => {
  const d = fromYmd(s);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
};
const fmtDayShort = (s) => {
  const d = fromYmd(s);
  return `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`;
};
const fmtWdShort = (s) => `${WD_SHORT[weekdayOf(s)]}, ${fmtDayShort(s)}`;
const fmtMonth = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return `${MONTHS[mo - 1]} ${y}`;
};
const fmtWeekRange = (monday) => {
  const a = fromYmd(monday);
  const b = fromYmd(addDays(monday, 6));
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}.–${b.getDate()}. ${MONTHS_SHORT[b.getMonth()]}`;
  return `${a.getDate()}. ${MONTHS_SHORT[a.getMonth()]} – ${b.getDate()}. ${MONTHS_SHORT[b.getMonth()]}`;
};

/** 'Heute', 'Morgen', … for nearby days, otherwise null. */
const relDay = (s, today = todayStr()) => {
  const n = diffDays(s, today);
  return { '-2': 'Vorgestern', '-1': 'Gestern', 0: 'Heute', 1: 'Morgen', 2: 'Übermorgen' }[n] || null;
};
/** For use inside a sentence: 'morgen', or 'Mi, 11. Nov' further away. */
const dayWord = (s, today = todayStr()) => {
  const rel = relDay(s, today);
  return rel ? rel.toLowerCase() : fmtWdShort(s);
};

const countdown = (n) => {
  if (n === 0) return 'heute';
  if (n === 1) return 'morgen';
  if (n === 2) return 'übermorgen';
  if (n === -1) return 'gestern';
  if (n < 0) return `vor ${-n} Tagen`;
  return `in ${n} Tagen`;
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
