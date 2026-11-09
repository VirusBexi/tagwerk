# Tagwerk

Habit-Tracker als installierbare Web-App: Aufgaben mit Wiederholungen, Vorlagen, Erinnerungen, Ziele und Level pro Kategorie. Jede erledigte Aufgabe lässt die Sonne im Himmel über der Liste steigen.

**App öffnen:** https://virusbexi.github.io/tagwerk/

Die App hat keine Abhängigkeiten. Alle Sounds werden live erzeugt, und sie läuft nach dem ersten Besuch auch offline. Deine Daten stehen nicht in diesem Repository: Sie liegen im Browser deines Geräts und, wenn du den Sync einschaltest, in einem geheimen Gist unter deinem GitHub-Konto.

## Entwickeln

```bash
node tools/test-logic.mjs
```

```bash
node tools/build.mjs
```

```bash
node tools/serve.mjs
```

Danach läuft die App auf http://localhost:5173. Mit `?sw` in der Adresse ist auch der Offline-Modus aktiv, ohne das lädt jeder Reload den neuesten Build.

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `src/js/` | Logik und Oberfläche, wird in Dateinamen-Reihenfolge zusammengefügt |
| `src/styles.css` | Das komplette Design |
| `docs/` | Fertig gebaute App, GitHub Pages liefert diesen Ordner aus |
| `tools/` | Build, Icons, lokaler Server, Logik-Tests |
