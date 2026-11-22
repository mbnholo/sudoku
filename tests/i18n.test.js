const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..', 'src');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const catalogContext = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'translations.js'), 'utf8'), catalogContext);
const translations = catalogContext.window.SUDOKU_TRANSLATIONS;
const engine = require(path.join(root, 'engine.js'));
vm.runInNewContext(fs.readFileSync(path.join(root, 'puzzles.js'), 'utf8'), catalogContext);
const seeds = catalogContext.window.SUDOKU_SEEDS;

test('all languages cover the interface keys and interpolation variables', () => {
  assert.deepEqual(Object.keys(translations).sort(), ['en', 'es', 'fr', 'it', 'pt']);
  const keys = Object.keys(translations.en).sort();
  const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [language, copy] of Object.entries(translations)) {
    assert.deepEqual(Object.keys(copy).sort(), keys, `${language} keys`);
    for (const key of keys) {
      assert.deepEqual(placeholders(copy[key]), placeholders(translations.en[key]), `${language}.${key} placeholders`);
    }
  }
  for (const match of html.matchAll(/data-i18n(?:-aria-label|-title|-content)?="([^"]+)"/g)) {
    assert.ok(Object.hasOwn(translations.en, match[1]), `Missing key ${match[1]}`);
  }
  for (const match of appSource.matchAll(/\b(?:t|announce)\('([^']+)'/g)) {
    assert.ok(Object.hasOwn(translations.en, match[1]), `Missing runtime key ${match[1]}`);
  }
  for (const language of Object.keys(translations)) {
    assert.match(html, new RegExp(`data-language="${language}"[^>]*><img src="\\./assets/flags/${language}\\.svg" alt="">[^<]+</button>`));
    assert.ok(fs.existsSync(path.join(root, `assets/flags/${language}.svg`)));
  }
  assert.match(html, /<summary id="language" class="round-button"/);
  const offlineCache = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(offlineCache, /\.\/translations\.js/);
  for (const asset of ['undo', 'erase', 'notes', 'hint', 'help']) {
    assert.ok(fs.existsSync(path.join(root, `assets/ui/${asset}.svg`)));
    assert.ok(offlineCache.includes(`./assets/ui/${asset}.svg`));
  }
  for (const language of Object.keys(translations)) {
    assert.ok(offlineCache.includes(`./assets/flags/${language}.svg`));
  }
});

function createApp({ browserLanguages, savedLanguage, savedGame, savedStats } = {}) {
  const elements = new Map();
  function node() {
    return {
      children: [], handlers: {}, dataset: {}, attributes: {},
      classList: { add() {}, toggle() {} },
      addEventListener(type, handler) { this.handlers[type] = handler; },
      setAttribute(name, value) { this.attributes[name] = value; },
      removeAttribute(name) { delete this.attributes[name]; },
      focus() { this.focused = true; },
      contains(target) { return this === target || this.children.includes(target); },
      appendChild(child) { this.children.push(child); },
      replaceChildren(fragment) { this.children = fragment.children; },
      querySelectorAll() { return this.children; },
      showModal() { this.open = true; },
      close() { this.open = false; }
    };
  }
  const staticNodes = [
    Object.assign(node(), { dataset: { i18n: 'howToPlay' } }),
    Object.assign(node(), { dataset: { i18n: 'languageLabel' } }),
    Object.assign(node(), { dataset: { i18nAriaLabel: 'helpButtonLabel' } })
  ];
  const languageOptions = ['en', 'fr', 'es', 'it', 'pt'].map(language =>
    Object.assign(node(), { dataset: { language } }));
  const document = {
    documentElement: { lang: 'en' }, hidden: false, handlers: {},
    getElementById(id) { if (!elements.has(id)) elements.set(id, node()); return elements.get(id); },
    createElement: node, createDocumentFragment: node,
    querySelectorAll(selector) {
      if (selector === '[data-i18n]') return staticNodes.slice(0, 2);
      if (selector === '[data-i18n-aria-label]') return staticNodes.slice(2);
      if (selector === '[data-language]') return languageOptions;
      return [];
    },
    addEventListener(type, handler) { this.handlers[type] = handler; }
  };
  const storage = new Map();
  if (savedLanguage !== undefined) storage.set('sudoku-language', JSON.stringify(savedLanguage));
  if (savedGame) storage.set('sudoku-calmo-game-v1', JSON.stringify(savedGame));
  if (savedStats) storage.set('sudoku-calmo-stats-v1', JSON.stringify(savedStats));
  const localStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, value); }
  };
  const context = {
    window: { SudokuEngine: engine, SUDOKU_SEEDS: seeds, SUDOKU_TRANSLATIONS: translations, addEventListener() {} },
    navigator: { languages: browserLanguages, language: browserLanguages?.[0], onLine: true },
    document, localStorage, Date, console,
    confirm() { return true; }, setInterval() {}, setTimeout() {}, clearTimeout() {}
  };
  vm.runInNewContext(appSource, context);
  return { elements, document, storage, staticNodes, languageOptions };
}

test('browser language is used, and unsupported or unavailable language falls back to English', () => {
  for (const [languages, expected] of [
    [['fr-FR'], 'fr'], [['es-MX'], 'es'], [['it-IT'], 'it'], [['pt-BR'], 'pt'],
    [['de-DE'], 'en'], [undefined, 'en']
  ]) {
    const app = createApp({ browserLanguages: languages });
    assert.equal(app.document.documentElement.lang, expected);
    assert.equal(app.elements.get('languageFlag').src, `./assets/flags/${expected}.svg`);
    assert.equal(app.staticNodes[0].textContent, translations[expected].howToPlay);
    assert.equal(app.staticNodes[2].attributes['aria-label'], translations[expected].helpButtonLabel);
  }
});

test('manual choice persists and updates the game without changing its progress', () => {
  const sample = seeds.medium[0];
  const puzzle = [...sample.puzzle].map(Number);
  const game = {
    level: 'medio', puzzle, solution: [...sample.solution].map(Number),
    values: puzzle.slice(), notes: Array(81).fill(0), history: [],
    hints: 0, seconds: 0, completed: false
  };
  const app = createApp({
    browserLanguages: ['fr-FR'], savedLanguage: 'it', savedGame: game,
    savedStats: { medio: { completed: 2, best: 120 } }
  });
  assert.equal(app.document.documentElement.lang, 'it');
  assert.equal(JSON.parse(app.storage.get('sudoku-calmo-game-v1')).level, 'medium');
  const progress = app.storage.get('sudoku-calmo-game-v1');
  app.languageOptions.find(option => option.dataset.language === 'es').handlers.click();
  assert.equal(app.document.documentElement.lang, 'es');
  assert.equal(app.elements.get('languageFlag').src, './assets/flags/es.svg');
  assert.equal(app.languageOptions.find(option => option.dataset.language === 'es').attributes['aria-current'], 'true');
  assert.equal(JSON.parse(app.storage.get('sudoku-language')), 'es');
  assert.equal(app.storage.get('sudoku-calmo-game-v1'), progress);
  assert.equal(app.staticNodes[2].attributes['aria-label'], translations.es.helpButtonLabel);
  assert.match(app.elements.get('board').children[0].attributes['aria-label'], /^Fila 1, columna 1:/);
  app.elements.get('helpBtn').handlers.click();
  assert.match(app.elements.get('statsLine').textContent, /2 Sudokus completados/);
  assert.equal(createApp({ browserLanguages: ['fr-FR'], savedLanguage: 'es' }).document.documentElement.lang, 'es');
});

test('Escape closes the language menu and returns focus to its button', () => {
  const app = createApp();
  app.elements.get('languageMenu').open = true;
  app.document.handlers.keydown({ key: 'Escape', target: app.elements.get('language') });
  assert.equal(app.elements.get('languageMenu').open, false);
  assert.equal(app.elements.get('language').focused, true);
});
