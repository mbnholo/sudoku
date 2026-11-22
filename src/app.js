/* Sudoku — local only, with no analytics, ads, or external services. */
(() => {
  'use strict';
  const E = window.SudokuEngine;
  const SEEDS = window.SUDOKU_SEEDS;
  const TRANSLATIONS = window.SUDOKU_TRANSLATIONS;
  const SAVE_KEY = 'sudoku-calmo-game-v1';
  const STATS_KEY = 'sudoku-calmo-stats-v1';
  const LANGUAGE_KEY = 'sudoku-language';
  // Keep existing storage keys so saved games and statistics survive the language change.
  const LEGACY_LEVELS = { 'facile': 'easy', 'medio': 'medium', 'difficile': 'hard', 'esperto': 'expert' };
  const $ = id => document.getElementById(id);
  const board = $('board');
  const difficulty = $('difficulty');
  const languageSelect = $('language');
  const timeLabel = $('timer');
  const feedback = $('feedback');
  const notesBtn = $('notesBtn');
  const hintBtn = $('hintBtn');
  const undoBtn = $('undoBtn');
  const eraseBtn = $('eraseBtn');
  const helpDialog = $('helpDialog');
  const winDialog = $('winDialog');
  let game = null;
  let selected = -1;
  let notesMode = false;
  let offlineReady = false;
  let lastTick = Date.now();
  let feedbackTimeout;

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (_) { return null; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  }
  function supportedLanguage(code) {
    return Object.prototype.hasOwnProperty.call(TRANSLATIONS, code);
  }
  function initialLanguage() {
    const saved = readJSON(LANGUAGE_KEY);
    if (supportedLanguage(saved)) return saved;
    const browserLanguages = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages : [navigator.language];
    for (const candidate of browserLanguages) {
      if (typeof candidate !== 'string') continue;
      const code = candidate.toLowerCase().split(/[-_]/)[0];
      if (supportedLanguage(code)) return code;
    }
    return 'en';
  }
  let language = initialLanguage();
  function t(key, values = {}) {
    const template = TRANSLATIONS[language][key] || TRANSLATIONS.en[key] || key;
    return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  }
  function applyLanguage() {
    document.documentElement.lang = language;
    languageSelect.value = language;
    for (const element of document.querySelectorAll('[data-i18n]')) {
      element.textContent = t(element.dataset.i18n);
    }
    for (const [attribute, name] of [['aria-label', 'i18nAriaLabel'], ['title', 'i18nTitle'], ['content', 'i18nContent']]) {
      for (const element of document.querySelectorAll(`[data-i18n-${attribute}]`)) {
        element.setAttribute(attribute, t(element.dataset[name]));
      }
    }
    for (const button of $('numberPad').querySelectorAll('button')) {
      button.setAttribute('aria-label', t('enterNumber', { number: button.textContent }));
    }
  }
  function isNineNumbers(a, allowZero = true) {
    return Array.isArray(a) && a.length === 81 && a.every(n =>
      Number.isInteger(n) && n >= (allowZero ? 0 : 1) && n <= 9);
  }
  function restoreGame() {
    const saved = readJSON(SAVE_KEY);
    const level = saved && (LEGACY_LEVELS[saved.level] || saved.level);
    if (!saved || !E.LEVELS.includes(level) ||
        !isNineNumbers(saved.puzzle) || !isNineNumbers(saved.solution, false) ||
        !isNineNumbers(saved.values) || !Array.isArray(saved.notes) ||
        saved.notes.length !== 81 || !saved.notes.every(n => Number.isInteger(n) && n >= 0 && n <= 1022)) {
      return null;
    }
    if (!saved.puzzle.every((v, i) => !v || (saved.solution[i] === v && saved.values[i] === v))) return null;
    const history = Array.isArray(saved.history) ? saved.history.filter(h =>
      h && isNineNumbers(h.values) && Array.isArray(h.notes) && h.notes.length === 81 &&
      h.notes.every(n => Number.isInteger(n) && n >= 0 && n <= 1022)).slice(-60) : [];
    return {
      level, puzzle: saved.puzzle, solution: saved.solution,
      values: saved.values, notes: saved.notes, history,
      hints: Math.max(0, Number(saved.hints) || 0),
      seconds: Math.max(0, Math.floor(Number(saved.seconds) || 0)),
      completed: Boolean(saved.completed)
    };
  }
  function readStats() {
    const stored = readJSON(STATS_KEY) || {};
    for (const [oldLevel, level] of Object.entries(LEGACY_LEVELS)) {
      if (Object.prototype.hasOwnProperty.call(stored, oldLevel)) {
        stored[level] = stored[oldLevel];
        delete stored[oldLevel];
      }
    }
    return stored;
  }
  function save() { if (game) writeJSON(SAVE_KEY, game); }
  function formatTime(total) {
    const mins = Math.floor(total / 60), secs = total % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  function chooseCell() {
    const empty = [];
    for (let i = 0; i < 81; i++) if (game.puzzle[i] === 0 && game.values[i] === 0) empty.push(i);
    selected = empty.length ? empty.sort((a, b) => Math.abs(a - 40) - Math.abs(b - 40))[0] : -1;
  }
  function hasProgress() {
    return game && game.values.some((v, i) => !game.puzzle[i] && v !== 0) ||
      game && game.notes.some(Boolean);
  }
  function newGame(level = 'medium', ask = true) {
    if (ask && game && !game.completed && hasProgress() &&
        !confirm(t('confirmNewGame'))) {
      difficulty.value = game.level;
      return false;
    }
    if (!E.LEVELS.includes(level)) level = 'medium';
    const data = E.makePuzzle(level, SEEDS);
    game = {
      level, puzzle: data.puzzle, solution: data.solution,
      values: data.puzzle.slice(), notes: Array(81).fill(0), history: [],
      hints: 0, seconds: 0, completed: false
    };
    difficulty.value = level;
    notesMode = false;
    chooseCell();
    lastTick = Date.now();
    save();
    draw();
    announce('newGameMessage');
    return true;
  }
  function snapshot() {
    game.history.push({ values: game.values.slice(), notes: game.notes.slice(), hints: game.hints });
    if (game.history.length > 60) game.history.shift();
  }
  function announce(key, values) {
    clearTimeout(feedbackTimeout);
    feedback.textContent = t(key, values);
    feedbackTimeout = setTimeout(() => { feedback.textContent = defaultMessage(); }, 3600);
  }
  function defaultMessage() {
    if (game.completed) return t('completedMessage');
    if (notesMode) return t('notesActive');
    const conflicts = E.conflicts(game.values);
    if (conflicts.size) return t('conflictMessage');
    return t('selectCellMessage');
  }
  function addNoteGrid(button, mask) {
    const container = document.createElement('span');
    container.className = 'note-grid';
    container.setAttribute('aria-hidden', 'true');
    for (let n = 1; n <= 9; n++) {
      const item = document.createElement('span');
      item.textContent = mask & (1 << n) ? String(n) : '';
      container.appendChild(item);
    }
    button.appendChild(container);
  }
  function drawBoard() {
    const frag = document.createDocumentFragment();
    const conflictSet = E.conflicts(game.values);
    const sr = selected < 0 ? -1 : Math.floor(selected / 9);
    const sc = selected < 0 ? -1 : selected % 9;
    const sv = selected < 0 ? 0 : game.values[selected];
    const sb = selected < 0 ? -1 : Math.floor(sr / 3) * 3 + Math.floor(sc / 3);
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9), c = i % 9, v = game.values[i];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cell';
      button.setAttribute('role', 'gridcell');
      const isGiven = Boolean(game.puzzle[i]);
      const related = selected >= 0 && (r === sr || c === sc || Math.floor(r / 3) * 3 + Math.floor(c / 3) === sb);
      if (related) button.classList.add('is-related');
      if (sv !== 0 && sv === v) button.classList.add('is-matching');
      if (isGiven) button.classList.add('is-given');
      if (conflictSet.has(i)) button.classList.add('is-conflict');
      if (selected === i) button.classList.add('is-selected');
      if (v) {
        button.textContent = String(v);
      } else if (game.notes[i]) {
        addNoteGrid(button, game.notes[i]);
      }
      const noteText = !v && game.notes[i] ? t('cellNotes', { numbers:
        Array.from({length: 9}, (_, x) => x + 1).filter(n => game.notes[i] & (1 << n)).join(' ') }) : '';
      button.setAttribute('aria-label', t('cellLabel', {
        row: r + 1, column: c + 1, value: v || t('cellEmpty'),
        given: isGiven ? t('cellGiven') : '', notes: noteText
      }));
      button.setAttribute('aria-selected', String(selected === i));
      button.dataset.index = i;
      frag.appendChild(button);
    }
    board.replaceChildren(frag);
  }
  function draw() {
    if (!game) return;
    drawBoard();
    timeLabel.textContent = formatTime(game.seconds);
    difficulty.value = game.level;
    notesBtn.classList.toggle('is-on', notesMode);
    notesBtn.setAttribute('aria-pressed', String(notesMode));
    const disabled = game.completed;
    undoBtn.disabled = disabled || game.history.length === 0;
    eraseBtn.disabled = disabled || selected === -1 || Boolean(game.puzzle[selected]);
    hintBtn.disabled = disabled;
    notesBtn.disabled = disabled;
    for (const b of $('numberPad').querySelectorAll('button')) b.disabled = disabled;
    feedback.textContent = defaultMessage();
  }
  function selectCell(index) {
    selected = index;
    draw();
  }
  function setNumber(n) {
    if (game.completed || selected < 0 || game.puzzle[selected]) return;
    const i = selected;
    if (notesMode) {
      if (game.values[i]) { announce('eraseBeforeNote'); return; }
      snapshot();
      game.notes[i] ^= 1 << n;
    } else {
      if (game.values[i] === n && game.notes[i] === 0) return;
      snapshot();
      game.values[i] = n;
      game.notes[i] = 0;
      for (const peer of E.peerIndices(i)) game.notes[peer] &= ~(1 << n);
    }
    finishAction();
  }
  function eraseCell() {
    if (game.completed || selected < 0 || game.puzzle[selected]) return;
    if (!game.values[selected] && !game.notes[selected]) return;
    snapshot();
    game.values[selected] = 0;
    game.notes[selected] = 0;
    finishAction();
  }
  function undoMove() {
    if (game.completed || !game.history.length) return;
    const previous = game.history.pop();
    game.values = previous.values;
    game.notes = previous.notes;
    game.hints = Number(previous.hints) || 0;
    save();
    draw();
    announce('moveUndone');
  }
  function showHint() {
    if (game.completed) return;
    let i = selected;
    if (i < 0 || game.puzzle[i] || game.values[i] === game.solution[i]) {
      i = game.values.findIndex((v, j) => !game.puzzle[j] && v !== game.solution[j]);
    }
    if (i < 0) return;
    snapshot();
    selected = i;
    const n = game.solution[i];
    game.values[i] = n;
    game.notes[i] = 0;
    for (const peer of E.peerIndices(i)) game.notes[peer] &= ~(1 << n);
    game.hints++;
    finishAction();
    if (!game.completed) announce('hintMessage', { number: n });
  }
  function updateWinSummary() {
    const key = game.hints === 0 ? 'winNoHints' : game.hints === 1 ? 'winOneHint' : 'winManyHints';
    $('winSummary').textContent = t(key, {
      level: t(game.level), time: formatTime(game.seconds), count: game.hints
    });
  }
  function updateStatsLine() {
    const total = Object.values(readStats()).reduce((sum, stats) => sum + (Number(stats.completed) || 0), 0);
    $('statsLine').textContent = t(total === 1 ? 'statsOne' : 'statsMany', { count: total });
  }
  function finishAction() {
    if (E.validComplete(game.values, game.solution)) {
      game.completed = true;
      const all = readStats();
      const stats = all[game.level] || { completed: 0, best: null };
      stats.completed = (stats.completed || 0) + 1;
      if (stats.best === null || game.seconds < stats.best) stats.best = game.seconds;
      all[game.level] = stats;
      writeJSON(STATS_KEY, all);
      updateWinSummary();
      setTimeout(() => { if (!winDialog.open) winDialog.showModal(); }, 160);
    }
    save();
    draw();
  }
  function moveSelection(key) {
    if (selected < 0) selected = 0;
    let r = Math.floor(selected / 9), c = selected % 9;
    if (key === 'ArrowLeft') c = (c + 8) % 9;
    if (key === 'ArrowRight') c = (c + 1) % 9;
    if (key === 'ArrowUp') r = (r + 8) % 9;
    if (key === 'ArrowDown') r = (r + 1) % 9;
    selectCell(r * 9 + c);
  }
  function syncOfflineBadge() {
    const status = $('offlineStatus');
    const dot = $('statusDot');
    if (!navigator.onLine && offlineReady) status.textContent = t('playingOffline');
    else if (offlineReady) status.textContent = t('readyOffline');
    else if (!navigator.onLine) status.textContent = t('offlineUnverified');
    else status.textContent = t('savedLocally');
    dot.classList.toggle('ready', offlineReady);
  }
  async function prepareOffline() {
    if (!('serviceWorker' in navigator)) { syncOfflineBadge(); return; }
    try {
      await navigator.serviceWorker.register('./sw.js', { scope: './' });
      await navigator.serviceWorker.ready;
      // The service worker caches all essential assets during installation.
      offlineReady = true;
      syncOfflineBadge();
    } catch (err) {
      console.warn(t('offlineCacheUnavailable'), err);
      syncOfflineBadge();
    }
  }

  // Grid and physical keyboard controls, including on iPad and Mac.
  board.addEventListener('click', event => {
    const cell = event.target.closest('[data-index]');
    if (cell) selectCell(Number(cell.dataset.index));
  });
  $('newBtn').addEventListener('click', () => newGame(difficulty.value));
  difficulty.addEventListener('change', () => newGame(difficulty.value));
  languageSelect.addEventListener('change', () => {
    language = supportedLanguage(languageSelect.value) ? languageSelect.value : 'en';
    writeJSON(LANGUAGE_KEY, language);
    clearTimeout(feedbackTimeout);
    applyLanguage();
    if (game) draw();
    if (game && game.completed) updateWinSummary();
    if (helpDialog.open) updateStatsLine();
    syncOfflineBadge();
  });
  notesBtn.addEventListener('click', () => { notesMode = !notesMode; draw(); });
  hintBtn.addEventListener('click', showHint);
  undoBtn.addEventListener('click', undoMove);
  eraseBtn.addEventListener('click', eraseCell);
  $('helpBtn').addEventListener('click', () => {
    updateStatsLine();
    helpDialog.showModal();
  });
  $('closeHelp').addEventListener('click', () => helpDialog.close());
  $('closeWin').addEventListener('click', () => winDialog.close());
  $('playAgain').addEventListener('click', () => { winDialog.close(); newGame(game.level, false); });
  document.addEventListener('keydown', event => {
    if (helpDialog.open || winDialog.open || event.target === difficulty) return;
    if (/^[1-9]$/.test(event.key)) { event.preventDefault(); setNumber(Number(event.key)); }
    else if (['Backspace', 'Delete', '0'].includes(event.key)) { event.preventDefault(); eraseCell(); }
    else if (event.key.startsWith('Arrow')) { event.preventDefault(); moveSelection(event.key); }
    else if (event.key.toLowerCase() === 'n') { notesMode = !notesMode; draw(); }
  });

  for (let n = 1; n <= 9; n++) {
    const b = document.createElement('button');
    b.className = 'number-btn'; b.type = 'button'; b.textContent = String(n);
    b.setAttribute('aria-label', t('enterNumber', { number: n }));
    b.addEventListener('click', () => setNumber(n));
    $('numberPad').appendChild(b);
  }
  applyLanguage();
  game = restoreGame();
  if (game) { difficulty.value = game.level; chooseCell(); save(); draw(); }
  else newGame('medium', false);
  syncOfflineBadge();
  window.addEventListener('online', syncOfflineBadge);
  window.addEventListener('offline', syncOfflineBadge);
  window.addEventListener('load', prepareOffline);
  document.addEventListener('visibilitychange', () => {
    lastTick = Date.now();
    if (document.hidden) save();
  });
  window.addEventListener('pagehide', save);
  setInterval(() => {
    const now = Date.now();
    if (!document.hidden && game && !game.completed) {
      const wholeSeconds = Math.floor((now - lastTick) / 1000);
      if (wholeSeconds > 0) {
        game.seconds += wholeSeconds;
        timeLabel.textContent = formatTime(game.seconds);
        lastTick += wholeSeconds * 1000;
        if (game.seconds % 5 === 0) save();
      }
    } else lastTick = now;
  }, 500);
})();
