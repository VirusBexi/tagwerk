/* =================================================================== SHEETS
   Bottom sheets on the phone, centered panels on the PC. ui.sheet holds the
   current form as plain data; inputs write into it through data-bind. */

const XP_TASK = [5, 10, 15, 25, 50, 100];
const XP_GOAL = { week: [25, 50, 75, 100], month: [100, 150, 200, 300], big: [250, 500, 750, 1000] };
const CAT_COLORS = ['#FF7A59', '#FFC145', '#B5E048', '#5FE3A1', '#37D5D6', '#5CB8FF', '#8F9BFF', '#C08CFF', '#F07FD8', '#FF6F91', '#E3C08F', '#B9C2D8'];
const CAT_EMOJI = ['📚', '💪', '🎮', '🏠', '🧠', '💻', '🎨', '🎵', '💰', '🥗', '😴', '🧘', '🏃', '⚽', '🚴', '📖', '✍️', '🧪', '🗣️', '❤️', '👥', '🌱', '🧹', '🛠️', '🚗', '📷', '🎬', '🍳', '🐶', '✈️', '⭐', '🔥'];

/* ------------------------------------------------------------ New drafts */
function newTaskDraft() {
  const days = [weekdayOf(ui.date)];
  return {
    title: '',
    catId: getCat(L.lastCat) ? L.lastCat : null,
    xp: L.lastXp || 25,
    date: ui.date >= todayStr() ? ui.date : todayStr(),
    repeatOn: false,
    days,
    mode: 'weekly',
    saveTpl: false,
    calOpen: false,
    calMonth: monthOf(ui.date),
  };
}
function newRemDraft(kind = 'once') {
  const base = ui.date >= todayStr() ? ui.date : todayStr();
  const d = fromYmd(base);
  return {
    title: '',
    kind,
    date: base,
    time: '',
    lead: kind === 'yearly' ? 7 : 0,
    month: d.getMonth() + 1,
    day: d.getDate(),
    year: '',
    calOpen: false,
    calMonth: monthOf(base),
  };
}
function newGoalDraft() {
  const kind = ui.tab === 'goals' ? ui.goalKind : 'week';
  return {
    title: '',
    kind,
    week: ui.tab === 'goals' ? ui.goalWeek : weekStart(todayStr()),
    month: ui.tab === 'goals' ? ui.goalMonth : monthOf(todayStr()),
    target: null,
    catId: getCat(L.lastCat) ? L.lastCat : null,
    xp: XP_GOAL[kind][1],
    steps: [],
    stepText: '',
    calOpen: false,
    calMonth: monthOf(todayStr()),
  };
}

/* ------------------------------------------------------- Shared controls */
function catPicker(path, value) {
  const cats = sortedCats();
  return `<div class="field"><span class="field-l">Kategorie</span>
    <div class="chips">
      ${cats.map((c) => `<button type="button" class="chip cat ${value === c.id ? 'on' : ''}" style="--c:${c.color}" data-act="set" data-path="${path}" data-val="${c.id}" aria-pressed="${value === c.id}">${esc(c.emoji)} ${esc(c.name)}</button>`).join('')}
      <button type="button" class="chip ${!value ? 'on' : ''}" data-act="set" data-path="${path}" data-val="" aria-pressed="${!value}">Keine</button>
      <button type="button" class="chip ghost" data-act="new-cat" data-from="${path}">${I.plus}Neu</button>
    </div></div>`;
}

function xpPicker(path, value, presets) {
  const custom = !presets.includes(Number(value));
  return `<div class="field"><span class="field-l">XP bei Abschluss</span>
    <div class="chips">
      ${presets.map((x) => `<button type="button" class="chip xp ${Number(value) === x ? 'on' : ''}" data-act="set" data-num="1" data-path="${path}" data-val="${x}" aria-pressed="${Number(value) === x}">+${x}</button>`).join('')}
      <label class="chip-input ${custom ? 'on' : ''}"><span>Eigene</span><input id="f-xp-${path.replace('.', '-')}" type="number" inputmode="numeric" min="0" max="100000" data-bind="${path}" data-num="1" value="${custom ? esc(value) : ''}" aria-label="Eigene XP"></label>
    </div></div>`;
}

function calendarHtml(prefix, month, selected) {
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const offset = weekdayOf(first) - 1;
  const count = daysInMonth(y, m);
  const t = todayStr();
  let cells = '';
  for (let i = 0; i < offset; i++) cells += '<span></span>';
  for (let d = 1; d <= count; d++) {
    const date = `${month}-${pad2(d)}`;
    const st = dayStat(date);
    const hasRem = remsForDay(date).some((r) => r.until === 0);
    cells += `<button type="button" class="cal-d ${date === selected ? 'sel' : ''} ${date === t ? 'today' : ''} ${date < t ? 'past' : ''}" data-act="cal-pick" data-prefix="${prefix}" data-date="${date}" aria-label="${esc(fmtDay(date))}">
      <b>${d}</b><span class="cal-marks">${st.total ? `<i class="${st.done === st.total ? 'full' : ''}"></i>` : ''}${hasRem ? '<i class="rem"></i>' : ''}</span></button>`;
  }
  return `<div class="cal">
    <div class="cal-h">
      <button type="button" class="icon-btn" data-act="cal-nav" data-prefix="${prefix}" data-dir="-1" aria-label="Vorheriger Monat">${I.left}</button>
      <b>${esc(fmtMonth(month))}</b>
      <button type="button" class="icon-btn" data-act="cal-nav" data-prefix="${prefix}" data-dir="1" aria-label="Nächster Monat">${I.right}</button>
    </div>
    <div class="cal-w">${WD_SHORT.slice(1).map((w) => `<span>${w}</span>`).join('')}</div>
    <div class="cal-g">${cells}</div>
  </div>`;
}

function datePicker(prefix, draft, label) {
  const t = todayStr();
  const quick = [[t, 'Heute'], [addDays(t, 1), 'Morgen'], [addDays(t, 2), 'Übermorgen']];
  const isQuick = quick.some(([d]) => d === draft.date);
  return `<div class="field"><span class="field-l">${label}</span>
    <div class="chips">
      ${quick.map(([d, l]) => `<button type="button" class="chip ${draft.date === d ? 'on' : ''}" data-act="cal-pick" data-prefix="${prefix}" data-date="${d}" aria-pressed="${draft.date === d}">${l}</button>`).join('')}
      <button type="button" class="chip ${!isQuick ? 'on' : ''}" data-act="cal-toggle" data-prefix="${prefix}">${I.calendar}${isQuick ? 'Anderer Tag' : esc(fmtWdShort(draft.date))}</button>
    </div>
    ${draft.calOpen ? calendarHtml(prefix, draft.calMonth, draft.date) : ''}
  </div>`;
}

function toggleRow(path, on, title, sub = '') {
  return `<button type="button" class="toggle-row" role="switch" aria-checked="${!!on}" data-act="flip" data-path="${path}">
    <span class="toggle-t"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>
    <span class="switch ${on ? 'on' : ''}"><i></i></span>
  </button>`;
}

function repeatEditor(d) {
  if (!d.repeatOn) return toggleRow('task.repeatOn', false, 'Wiederholen', 'Zum Beispiel jeden Donnerstag und Freitag');
  const r = makeRepeat({ days: d.days.length ? d.days : [1], mode: d.mode, date: d.date });
  const week = weekStart(d.date);
  const next = d.days.length ? previewOccurrences(r, 4, todayStr()) : [];
  let preview;
  if (!d.days.length) preview = 'Wähle mindestens einen Wochentag.';
  else if (!next.length) preview = `In KW ${isoWeek(week)} sind diese Tage schon vorbei. Wähle einen späteren Tag bei „Ab wann?“ oder nimm eine andere Wiederholung.`;
  else preview = `Nächste Termine: ${next.map((x) => fmtWdShort(x).replace(/ /g, ' ')).join(' · ')}`;
  return `<div class="repeat-box">
    ${toggleRow('task.repeatOn', true, 'Wiederholen')}
    <div class="wd-pick" id="wdPick" role="group" aria-label="Wochentage">
      ${[1, 2, 3, 4, 5, 6, 7].map((w) => `<button type="button" class="wd-c ${d.days.includes(w) ? 'on' : ''}" data-act="toggle-day" data-fx="none" data-day="${w}" aria-pressed="${d.days.includes(w)}" aria-label="${WD_LONG[w]}">${WD_SHORT[w]}</button>`).join('')}
    </div>
    ${segmented('set-mode', [['weekly', 'Jede Woche'], ['biweekly', 'Alle 2 Wochen'], ['week', 'Nur diese Woche']], d.mode)}
    <p class="repeat-note ${next.length ? '' : 'warn'}">${esc(preview)}</p>
  </div>`;
}

const titleInput = (id, path, value, placeholder) =>
  `<input id="${id}" class="big-input" type="text" data-bind="${path}" data-enter="submit" value="${esc(value)}" placeholder="${placeholder}" maxlength="140" autocomplete="off" enterkeyhint="done" aria-label="${placeholder}">`;

/** Under the title of a new task: what was read out of it, each one to wave away, or the tip how it works. */
function quickLine(d) {
  const parts = d.quickParts || [];
  const chips = parts
    .map(
      (p) =>
        `<button type="button" class="qchip" data-k="q-${p.kind}" data-act="quick-off" data-fx="none" data-key="${esc(p.key)}" title="Nicht übernehmen" aria-label="${esc(p.label)}, erkannt. Tippen, um es nicht zu übernehmen.">${esc(p.label)}${I.x}</button>`,
    )
    .join('');
  return `<div class="quick" data-k="quick" aria-live="polite">${chips || `<p class="hint">Tipp: „Mathe morgen 50xp #schule“ füllt alles aus.</p>`}</div>`;
}

/* ----------------------------------------------------------------- Forms */
function taskForm(d, isEdit) {
  return `
    ${titleInput('f-title', 'task.title', d.title, 'Was steht an?')}
    ${isEdit ? '' : quickLine(d)}
    ${catPicker('task.catId', d.catId)}
    ${xpPicker('task.xp', d.xp, XP_TASK)}
    ${datePicker('task', d, d.repeatOn ? 'Ab wann?' : 'Wann?')}
    ${repeatEditor(d)}
    ${isEdit ? '' : toggleRow('task.saveTpl', d.saveTpl, 'Auch als Vorlage speichern', 'Dann kannst du sie jederzeit mit einem Tipp wieder einplanen.')}
  `;
}

function tplPane(sh) {
  const d = sh.task;
  const tpls = sortedTpls();
  return `
    ${datePicker('task', d, 'Einplanen für')}
    <div class="tpl-list" data-k="tpl-list">
      ${tpls.map((t) => {
        const cat = getCat(t.catId);
        const n = sh.added && sh.added[t.id];
        return `<div class="tpl ${n ? 'added' : ''}" data-k="${t.id}" style="--c:${colorOf(cat)}">
          <button class="tpl-main" data-act="use-tpl" data-fx="none" data-id="${t.id}">
            <span class="tpl-plus">${n ? `×${n}` : I.plus}</span>
            <span class="tpl-txt"><span class="tpl-title">${esc(t.title)}</span><span class="row-meta">${catMeta(cat)}</span></span>
            <span class="stamp">+${t.xp}</span>
          </button>
          <button class="tool show" data-act="edit-tpl" data-id="${t.id}" aria-label="Vorlage bearbeiten" title="Bearbeiten">${I.pencil}</button>
        </div>`;
      }).join('') || `<div class="empty small"><p>Vorlagen sind für Aufgaben, die oft kommen, aber keinen festen Termin haben: Müll rausbringen, Wäsche, Einkaufen.</p></div>`}
    </div>
    <button class="add-row" data-act="new-tpl">${I.plus}Neue Vorlage</button>
  `;
}

function remForm(d, editing) {
  let when;
  if (d.kind === 'yearly') {
    const days = daysInMonth(2028, Number(d.month));
    when = `<div class="field"><span class="field-l">Jedes Jahr am</span>
      <div class="select-row">
        <label class="sel"><span class="vh">Tag</span><select id="f-rem-day" data-bind="rem.day" data-num="1">${Array.from({ length: days }, (_, i) => `<option value="${i + 1}" ${Number(d.day) === i + 1 ? 'selected' : ''}>${i + 1}.</option>`).join('')}</select></label>
        <label class="sel grow"><span class="vh">Monat</span><select id="f-rem-month" data-bind="rem.month" data-num="1" data-rerender="1">${MONTHS.map((m, i) => `<option value="${i + 1}" ${Number(d.month) === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        <label class="sel-year"><span class="vh">Geburtsjahr, optional</span><input id="f-rem-year" type="number" inputmode="numeric" placeholder="Jahr" min="1900" max="2100" data-bind="rem.year" value="${esc(d.year)}"></label>
      </div>
      <p class="hint">Mit Jahr zeigt die App auch das Alter an. Das Jahr kannst du weglassen.</p>
    </div>`;
  } else {
    when = `${datePicker('rem', d, 'Wann?')}
      <div class="field"><label class="field-l" for="f-rem-time">Uhrzeit, optional</label><input id="f-rem-time" class="time-input" type="time" data-bind="rem.time" value="${esc(d.time)}"></div>`;
  }
  const leads = [[0, 'Am Tag selbst'], [1, '1 Tag vorher'], [3, '3 Tage vorher'], [7, '1 Woche vorher']];
  const canIcs = editing && TARGET !== 'artifact';
  return `
    ${titleInput('f-rem-title', 'rem.title', d.title, d.kind === 'yearly' ? 'Geburtstag von …' : 'Woran soll ich dich erinnern?')}
    ${segmented('set-rem-kind', [['once', 'Normal'], ['yearly', 'Jährlich']], d.kind)}
    ${when}
    <div class="field"><span class="field-l">Anzeigen ab</span>
      <div class="chips">${leads.map(([v, l]) => `<button type="button" class="chip ${Number(d.lead) === v ? 'on' : ''}" data-act="set" data-num="1" data-path="rem.lead" data-val="${v}" aria-pressed="${Number(d.lead) === v}">${l}</button>`).join('')}</div>
    </div>
    ${canIcs ? `<button class="btn ghost wide" data-act="rem-ics">${I.calendar}In den Kalender des Handys übernehmen</button>
      <p class="hint">Der Kalender weckt dich auch dann, wenn die App geschlossen ist.</p>` : ''}
  `;
}

function goalForm(d) {
  let period = '';
  if (d.kind === 'week') {
    period = `<div class="field"><span class="field-l">Für welche Woche?</span><div class="period inline">
      <button type="button" class="icon-btn" data-act="draft-period" data-dir="-1" aria-label="Eine Woche zurück">${I.left}</button>
      <div class="period-t"><b>KW ${isoWeek(d.week)}</b><span>${esc(fmtWeekRange(d.week))}</span></div>
      <button type="button" class="icon-btn" data-act="draft-period" data-dir="1" aria-label="Eine Woche weiter">${I.right}</button></div></div>`;
  } else if (d.kind === 'month') {
    period = `<div class="field"><span class="field-l">Für welchen Monat?</span><div class="period inline">
      <button type="button" class="icon-btn" data-act="draft-period" data-dir="-1" aria-label="Ein Monat zurück">${I.left}</button>
      <div class="period-t"><b>${esc(fmtMonth(d.month))}</b></div>
      <button type="button" class="icon-btn" data-act="draft-period" data-dir="1" aria-label="Ein Monat weiter">${I.right}</button></div></div>`;
  } else {
    period = `<div class="field"><span class="field-l">Zieldatum, optional</span>
      <div class="chips">
        <button type="button" class="chip ${!d.target ? 'on' : ''}" data-act="set" data-path="goal.target" data-val="" aria-pressed="${!d.target}">Ohne Datum</button>
        <button type="button" class="chip ${d.target ? 'on' : ''}" data-act="cal-toggle" data-prefix="goal">${I.calendar}${d.target ? esc(`${fmtDayShort(d.target)} ${d.target.slice(0, 4)}`) : 'Datum wählen'}</button>
      </div>${d.calOpen ? calendarHtml('goal', d.calMonth, d.target) : ''}</div>`;
  }
  return `
    ${titleInput('f-goal-title', 'goal.title', d.title, 'Was willst du erreichen?')}
    ${segmented('set-goal-kind', [['week', 'Woche'], ['month', 'Monat'], ['big', 'Großes Ziel']], d.kind)}
    ${period}
    ${catPicker('goal.catId', d.catId)}
    ${xpPicker('goal.xp', d.xp, XP_GOAL[d.kind])}
    <div class="field"><span class="field-l">Zwischenschritte, optional</span>
      <div class="step-edit">
        ${d.steps.map((s) => `<div class="step-line" data-k="${s.id}"><span>${esc(s.t)}</span><button type="button" class="tool show" data-act="draft-step-del" data-id="${s.id}" aria-label="Schritt entfernen">${I.x}</button></div>`).join('')}
        <div class="step-add">
          <input id="f-step" type="text" data-bind="goal.stepText" data-enter="step" value="${esc(d.stepText)}" placeholder="Schritt hinzufügen" maxlength="100" autocomplete="off" enterkeyhint="done" aria-label="Schritt hinzufügen">
          <button type="button" class="icon-btn solid" data-act="draft-step-add" aria-label="Hinzufügen">${I.plus}</button>
        </div>
      </div>
    </div>
  `;
}

function catForm(sh) {
  const d = sh.cat;
  const existing = sh.id ? S.cats[sh.id] : null;
  const dd = derived();
  let stats = '';
  if (existing) {
    const l = catLevel(dd.xpCat[sh.id] || 0);
    const history = Object.values(S.done)
      .filter((e) => !e.del && e.catId === sh.id)
      .sort((a, b) => b.at - a.at)
      .slice(0, 6);
    stats = `
      <div class="cat-stat" style="--c:${esc(d.color)}">
        <div class="cat-stat-top"><b>Level ${l.level}</b><span>${rankOf(l.level)}</span><span class="grow"></span><span>${l.into} / ${l.need} XP</span></div>
        <span class="bar lg"><i style="width:${(l.pct * 100).toFixed(1)}%"></i></span>
      </div>
      ${history.length ? `<div class="field"><span class="field-l">Zuletzt</span><div class="hist">${history.map((h) => `<div class="hist-row"><span class="hist-t">${esc(h.title || 'Aufgabe')}</span><span class="hist-d">${esc(fmtDayShort(h.date))}</span><span class="hist-x">+${h.xp}</span></div>`).join('')}</div></div>` : ''}`;
  }
  return `
    ${titleInput('f-cat-name', 'cat.name', d.name, 'Name, zum Beispiel Sport')}
    ${stats}
    <div class="field"><span class="field-l">Symbol</span>
      <div class="emoji-grid">${CAT_EMOJI.map((e) => `<button type="button" class="emoji ${d.emoji === e ? 'on' : ''}" data-act="set" data-path="cat.emoji" data-val="${e}" aria-pressed="${d.emoji === e}">${e}</button>`).join('')}</div>
    </div>
    <div class="field"><span class="field-l">Farbe</span>
      <div class="swatches">${CAT_COLORS.map((c) => `<button type="button" class="swatch ${d.color === c ? 'on' : ''}" style="--c:${c}" data-act="set" data-path="cat.color" data-val="${c}" aria-label="Farbe ${c}" aria-pressed="${d.color === c}"></button>`).join('')}</div>
    </div>
  `;
}

function tplForm(d) {
  return `
    ${titleInput('f-tpl-title', 'tpl.title', d.title, 'Was kommt öfter vor?')}
    ${catPicker('tpl.catId', d.catId)}
    ${xpPicker('tpl.xp', d.xp, XP_TASK)}
  `;
}

/* -------------------------------------------------------------- Settings */
function syncSection() {
  const lastSeen = Sync.lastAt ? new Date(Sync.lastAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null;
  const statusText = {
    off: 'Nicht verbunden',
    connecting: 'Verbinde …',
    syncing: 'Synchronisiere …',
    ok: lastSeen ? `Synchron, zuletzt um ${lastSeen}` : 'Synchron',
    offline: 'Gerade nicht erreichbar',
    error: 'Verbindung fehlgeschlagen',
  }[Sync.status];

  if (TARGET === 'artifact') {
    return `<section class="set-sec"><h3>${I.cloud}Handy und PC</h3>
      <p class="set-status ${Sync.status}">${esc(statusText)}</p>
      <p class="hint">${esc(Sync.message || 'Deine Daten hängen an deinem Claude-Konto. Öffne denselben Link am anderen Gerät, und alles ist da.')}</p>
    </section>`;
  }
  if (Sync.connected) {
    return `<section class="set-sec"><h3>${I.cloud}Handy und PC</h3>
      <p class="set-status ${Sync.status}">${esc(statusText)}</p>
      ${Sync.message ? `<p class="hint">${esc(Sync.message)}</p>` : ''}
      <div class="note-btns"><button class="btn small" data-act="sync-now">Jetzt synchronisieren</button><button class="btn small ghost" data-act="sync-off">Trennen</button></div>
    </section>`;
  }
  const sh = ui.sheet;
  return `<section class="set-sec"><h3>${I.cloud}Handy und PC</h3>
    <p class="hint">Ohne Verbindung bleiben deine Daten nur auf diesem Gerät. Mit einem kostenlosen GitHub-Konto bleiben Handy und PC automatisch gleich. Deine Daten liegen dann in einem geheimen Gist unter deinem Konto.</p>
    <ol class="how">
      <li><a href="https://github.com/settings/tokens/new?description=Tagwerk%20Sync&amp;scopes=gist" target="_blank" rel="noopener">Token bei GitHub erstellen</a>. Das Recht „gist“ ist schon ausgewählt. Wähle unter „Expiration“ eine lange Laufzeit.</li>
      <li>Token kopieren und hier einfügen.</li>
      <li>Am anderen Gerät dasselbe tun. Es findet deine Daten von selbst.</li>
    </ol>
    <div class="token-row">
      <input id="f-token" type="password" data-bind="token" value="${esc(sh.token || '')}" placeholder="ghp_…" autocomplete="off" spellcheck="false" aria-label="GitHub-Token">
      <button class="btn small" data-act="sync-connect" ${Sync.status === 'connecting' ? 'disabled' : ''}>Verbinden</button>
    </div>
    ${Sync.message ? `<p class="hint warn">${esc(Sync.message)}</p>` : ''}
  </section>`;
}

function installSection() {
  if (TARGET === 'artifact' || isStandalone()) return '';
  const body = ui.installEvent
    ? `<button class="btn small" data-act="install-now">Jetzt installieren</button>`
    : isIOS()
      ? `<ol class="how"><li>Öffne diese Seite in Safari.</li><li>Tippe unten auf das Teilen-Symbol.</li><li>Wähle „Zum Home-Bildschirm“.</li></ol>`
      : `<ol class="how"><li>Öffne das Browser-Menü.</li><li>Wähle „Zum Startbildschirm hinzufügen“ oder „App installieren“.</li></ol>`;
  return `<section class="set-sec"><h3>${I.phone}Als App installieren</h3>${body}</section>`;
}

function settingsBody() {
  return `
    <section class="set-sec"><h3>Sound und Gefühl</h3>
      ${toggleRow('L.sound', L.sound, 'Soundeffekte')}
      ${L.sound ? `<div class="field"><label class="field-l" for="f-volume">Lautstärke</label><input id="f-volume" class="range" type="range" min="0" max="100" step="1" data-local="volume" value="${Math.round(L.volume * 100)}"></div>
      <div class="field"><span class="field-l">Klangfarbe</span>${segmented('set-pack', Object.entries(Sound.PACKS).map(([k, v]) => [k, v.label]), L.pack)}</div>` : ''}
      ${toggleRow('L.haptics', L.haptics, 'Vibration', 'Auf Android und ab iOS 18')}
      ${toggleRow('L.motion', L.motion, 'Animationen und Konfetti')}
    </section>
    ${syncSection()}
    ${installSection()}
    <section class="set-sec"><h3>Daten</h3>
      <div class="set-btns">
        <button class="btn small ghost" data-act="export">${I.down}Sicherung speichern</button>
        <label class="btn small ghost file-btn">${I.up}Sicherung laden<input id="f-import" type="file" accept="application/json,.json" data-import></label>
      </div>
      ${hasDemo() ? `<button class="btn small ghost wide" data-act="remove-demo">Beispieldaten entfernen</button>` : ''}
      <button class="btn small danger wide" data-act="wipe">Alle Daten löschen</button>
    </section>
    <p class="fineprint">Tagwerk ${APP_VERSION}. Sound komplett synthetisiert, läuft auch offline.</p>
  `;
}

/* ------------------------------------------------------------ Sheet frame */
const PANE_LABELS = [['task', 'Aufgabe'], ['tpl', 'Vorlage'], ['rem', 'Erinnerung'], ['goal', 'Ziel']];

function sheetContent() {
  const sh = ui.sheet;
  switch (sh.kind) {
    case 'add': {
      const pane = sh.pane;
      const body = pane === 'task' ? taskForm(sh.task, false) : pane === 'tpl' ? tplPane(sh) : pane === 'rem' ? remForm(sh.rem, false) : goalForm(sh.goal);
      const submit = { task: ['submit-task', 'Aufgabe hinzufügen'], rem: ['submit-rem', 'Erinnerung speichern'], goal: ['submit-goal', 'Ziel setzen'] }[pane];
      return {
        label: 'Neu anlegen',
        head: segmented('set-pane', PANE_LABELS, pane),
        body,
        foot: submit ? `<button class="btn wide" data-act="${submit[0]}" data-fx="none">${submit[1]}</button>` : `<button class="btn ghost wide" data-act="close-sheet">Fertig</button>`,
      };
    }
    case 'edit-task': {
      const t = S.tasks[sh.id];
      return {
        label: 'Aufgabe bearbeiten',
        head: `<h2>Aufgabe bearbeiten</h2>`,
        body: taskForm(sh.task, true) + (t && t.repeat ? `<p class="hint">Änderungen gelten für die ganze Serie. Bereits erarbeitete XP bleiben.</p>` : ''),
        foot: `<button class="btn ghost icon" data-act="delete-task" data-fx="none" data-id="${sh.id}" data-date="${sh.occ}" aria-label="Löschen">${I.trash}</button>
               <button class="btn ghost" data-act="move-tomorrow" data-id="${sh.id}" data-date="${sh.occ}">Auf morgen</button>
               <button class="btn grow" data-act="submit-task" data-fx="none">Speichern</button>`,
      };
    }
    case 'edit-rem':
      return {
        label: 'Erinnerung bearbeiten',
        head: `<h2>Erinnerung bearbeiten</h2>`,
        body: remForm(sh.rem, true),
        foot: `<button class="btn ghost icon" data-act="delete-rem" data-fx="none" data-id="${sh.id}" aria-label="Löschen">${I.trash}</button>
               <button class="btn grow" data-act="submit-rem" data-fx="none">Speichern</button>`,
      };
    case 'edit-goal': {
      const g = S.goals[sh.id];
      return {
        label: 'Ziel bearbeiten',
        head: `<h2>Ziel bearbeiten</h2>`,
        body: goalForm(sh.goal),
        foot: `<button class="btn ghost icon" data-act="delete-goal" data-fx="none" data-id="${sh.id}" aria-label="Löschen">${I.trash}</button>
               ${g && g.doneAt ? `<button class="btn ghost" data-act="reopen-goal" data-id="${sh.id}">Wieder öffnen</button>` : ''}
               <button class="btn grow" data-act="submit-goal" data-fx="none">Speichern</button>`,
      };
    }
    case 'tpl':
      return {
        label: sh.id ? 'Vorlage bearbeiten' : 'Neue Vorlage',
        head: `${sh.back ? `<button class="icon-btn" data-act="sheet-back" aria-label="Zurück">${I.back}</button>` : ''}<h2>${sh.id ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</h2>`,
        body: tplForm(sh.tpl),
        foot: `${sh.id ? `<button class="btn ghost icon" data-act="delete-tpl" data-fx="none" data-id="${sh.id}" aria-label="Löschen">${I.trash}</button>` : ''}
               <button class="btn grow" data-act="submit-tpl" data-fx="none">Speichern</button>`,
      };
    case 'cat':
      return {
        label: sh.id ? 'Kategorie bearbeiten' : 'Neue Kategorie',
        head: `${sh.back ? `<button class="icon-btn" data-act="sheet-back" aria-label="Zurück">${I.back}</button>` : ''}<h2>${sh.id ? esc(sh.cat.emoji + ' ' + sh.cat.name) : 'Neue Kategorie'}</h2>`,
        body: catForm(sh),
        foot: `${sh.id ? `<button class="btn ghost icon" data-act="delete-cat" data-fx="none" data-id="${sh.id}" aria-label="Löschen">${I.trash}</button>` : ''}
               <button class="btn grow" data-act="submit-cat" data-fx="none">Speichern</button>`,
      };
    case 'calendar':
      return {
        label: 'Datum wählen',
        head: `<h2>Zu welchem Tag?</h2>`,
        body: calendarHtml('jump', sh.month, ui.date),
        foot: `<button class="btn ghost wide" data-act="go-today">Zu heute</button>`,
      };
    case 'settings':
      return { label: 'Einstellungen', head: `<h2>Einstellungen</h2>`, body: settingsBody(), foot: `<button class="btn ghost wide" data-act="close-sheet">Fertig</button>` };
    case 'badges':
      return { label: 'Erfolge', head: `<h2>Erfolge <small class="h2-count">${badgeCount()} / ${BADGES.length}</small></h2>`, body: badgesBody(sh), foot: '' };
    default:
      return { label: '', head: '', body: '', foot: '' };
  }
}

function sheetHtml() {
  if (!ui.sheet) return '';
  const c = sheetContent();
  return `<div class="sheet-wrap ${ui.sheetClosing ? 'closing' : ''}" data-k="sheet" role="dialog" aria-modal="true" aria-label="${esc(c.label)}">
    <div class="sheet-back" data-act="close-sheet" data-fx="none"></div>
    <div class="sheet" id="sheetPanel">
      <div class="sheet-grip" data-grip aria-hidden="true"><i></i></div>
      <header class="sheet-head" data-grip>${c.head}
        <button class="icon-btn sheet-x" data-act="close-sheet" data-fx="none" aria-label="Schließen">${I.x}</button>
      </header>
      <div class="sheet-body" id="sheetBody">${c.body}</div>
      ${c.foot ? `<footer class="sheet-foot">${c.foot}</footer>` : ''}
    </div>
  </div>`;
}

/* ---------------------------------------------------------------- Dialog */
function dialogHtml() {
  const d = ui.dialog;
  if (!d) return '';
  return `<div class="dialog-wrap" data-k="dialog" role="alertdialog" aria-modal="true" aria-label="${esc(d.title)}">
    <div class="dialog-back" data-act="close-dialog" data-fx="none"></div>
    <div class="dialog">
      <h2>${esc(d.title)}</h2>
      ${d.text ? `<p>${esc(d.text)}</p>` : ''}
      <div class="dialog-btns">
        ${d.actions.map((a, i) => `<button class="btn small ${a.kind || 'ghost'}" data-act="dialog-action" data-fx="none" data-i="${i}">${esc(a.label)}</button>`).join('')}
      </div>
    </div>
  </div>`;
}
