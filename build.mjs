// Bundles the app into one self-contained HTML file for publishing/sharing.
// The published page has no filesystem to import from, so the ES modules are
// concatenated in dependency order and the import/export keywords stripped.
//
//   node build.mjs   ->  dist/vocabulario.html
//
// Output omits <!doctype>/<html>/<head>/<body>: the Artifact host supplies
// that skeleton and wraps whatever this file contains.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');

// Dependency order: a module may only appear after everything it imports.
const MODULES = [
  'source/random.js',
  'source/vocab.js',
  'source/srs.js',
  'source/stages.js',
  'source/quiz.js',
  'source/storage.js',
  'source/game.js',
  'source/api.js',
  'main.js'
];

/**
 * Drop `import ... from '...'` statements and the leading `export ` keyword.
 * Imports are matched across lines, since a long named-import list is usually
 * wrapped. Anything left that still looks like module syntax is a bug in this
 * function rather than something to emit and hope about, so it throws.
 */
function stripModuleSyntax(src, file) {
  const withoutImports = src.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?[ \t]*$/gm, '');

  const leftover = withoutImports
    .split('\n')
    .find((line) => /^\s*(import|export)\s/.test(line) && !/^export\s+(async\s+function|const|function|class|let)\b/.test(line));
  if (leftover) throw new Error(`${file}: unhandled module syntax -> ${leftover.trim()}`);

  return withoutImports
    .replace(/^export\s+(?=(async\s+function|const|function|class|let)\b)/gm, '')
    .replace(/\n{3,}/g, '\n\n');
}

const bundle = MODULES
  .map((f) => `// ---- ${f} ----\n${stripModuleSyntax(read(f), f)}`)
  .join('\n\n');

// Pull the markup out of index.html, minus the module <script> tag.
const html = read('index.html');
const body = html.slice(html.indexOf('<body>') + '<body>'.length, html.lastIndexOf('</body>'))
  .replace(/\s*<script type="module"[^>]*><\/script>/, '')
  .trim();

const css = read('style.css');

const out = `<title>Vocabulario</title>
<style>
/* The host's reset defaults to a light color-scheme; this page is committed
   dark, so native controls (select popups, scrollbars) are told to match. */
:root { color-scheme: dark; }

${css}
</style>

${body}

<script type="module">
${bundle}
</script>
`;

mkdirSync(new URL('dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('dist/vocabulario.html', import.meta.url), out);
console.log(`dist/vocabulario.html  (${(out.length / 1024).toFixed(1)} KB)`);
