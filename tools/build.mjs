// Builds the two outputs from src/:
//   docs/        the installable app (GitHub Pages serves this folder)
//   build/artifact.html   the same app as a Claude artifact page
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const VERSION = '1.0.0';
const src = (p) => new URL(`../src/${p}`, import.meta.url);
const read = (p) => readFileSync(src(p), 'utf8');

const FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Onest:wght@400;500;600;700&display=swap';

const css = read('styles.css');
const body = read('body.html');
const jsFiles = readdirSync(src('js')).filter((f) => f.endsWith('.js')).sort();
const js = jsFiles.map((f) => read(`js/${f}`)).join('\n');

const script = (target) =>
  `(() => {\nconst TARGET = '${target}';\nconst APP_VERSION = '${VERSION}';\n${js}\n})();`;

const fontLinks = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">`;

const pwa = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-visual">
<title>Tagwerk</title>
<meta name="description" content="Aufgaben, Ziele, Erinnerungen und Level. Jede erledigte Aufgabe lässt die Sonne steigen.">
<meta name="theme-color" content="#0B0E27">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Tagwerk">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
${fontLinks}
<style>
${css}
</style>
</head>
<body>
${body}
<script>
${script('pwa')}
</script>
</body>
</html>
`;

// The artifact viewer wraps the page in its own document skeleton.
const artifact = `<title>Tagwerk</title>
<meta name="claude:viewport-fit-sides" content="cover">
${fontLinks}
<style>
${css}
</style>
${body}
<script>
${script('artifact')}
</script>
`;

const manifest = {
  name: 'Tagwerk',
  short_name: 'Tagwerk',
  description: 'Aufgaben, Ziele, Erinnerungen und Level. Jede erledigte Aufgabe lässt die Sonne steigen.',
  lang: 'de',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'any',
  background_color: '#0B0D24',
  theme_color: '#0B0E27',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

const out = (p) => new URL(`../${p}`, import.meta.url);
mkdirSync(out('docs'), { recursive: true });
mkdirSync(out('build'), { recursive: true });

const hash = createHash('sha1').update(pwa).digest('hex').slice(0, 10);
writeFileSync(out('docs/index.html'), pwa);
writeFileSync(out('docs/manifest.webmanifest'), JSON.stringify(manifest, null, 2));
writeFileSync(out('docs/sw.js'), read('sw.js').replace('__VERSION__', hash));
writeFileSync(out('docs/.nojekyll'), '');
writeFileSync(out('build/artifact.html'), artifact);
writeFileSync(out('build/app-check.js'), script('pwa'));

execFileSync(process.execPath, ['--check', fileURLToPath(out('build/app-check.js'))], { stdio: 'inherit' });
execFileSync(process.execPath, [fileURLToPath(new URL('./make-icons.mjs', import.meta.url))], { stdio: 'inherit' });

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(0)} KB`;
console.log(`Gebaut: docs/index.html ${kb(pwa)}, build/artifact.html ${kb(artifact)}, Version ${hash}`);
