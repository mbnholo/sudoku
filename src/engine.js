/* Sudoku — pure game engine with no dependencies or external requests. */
(function (root) {
  'use strict';
  const LEVELS = ['easy', 'medium', 'hard', 'expert'];

  function shuffle(items, random = Math.random) {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function rowOrColumnOrder(random) {
    return shuffle([0, 1, 2], random).flatMap(group =>
      shuffle([0, 1, 2], random).map(x => group * 3 + x));
  }

  // Transformations preserve each row, column, box, and the unique solution.
  function transform(seed, random = Math.random) {
    const rows = rowOrColumnOrder(random);
    const columns = rowOrColumnOrder(random);
    const symbols = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
    const transpose = random() < .5;
    function convert(serialized) {
      const out = [];
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const oldR = transpose ? rows[c] : rows[r];
          const oldC = transpose ? columns[r] : columns[c];
          const n = Number(serialized[oldR * 9 + oldC]);
          out.push(n === 0 ? 0 : symbols[n - 1]);
        }
      }
      return out;
    }
    return { puzzle: convert(seed.puzzle), solution: convert(seed.solution) };
  }

  function makePuzzle(level, seeds, random = Math.random) {
    if (!LEVELS.includes(level) || !Array.isArray(seeds[level]) || !seeds[level].length) {
      throw new Error('Invalid Sudoku difficulty');
    }
    const choices = seeds[level];
    const base = choices[Math.floor(random() * choices.length)];
    return transform(base, random);
  }

  function peerIndices(index) {
    const r = Math.floor(index / 9), c = index % 9;
    const peers = new Set();
    for (let x = 0; x < 9; x++) {
      peers.add(r * 9 + x);
      peers.add(x * 9 + c);
    }
    const r0 = Math.floor(r / 3) * 3, c0 = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) {
      peers.add((r0 + dr) * 9 + c0 + dc);
    }
    peers.delete(index);
    return Array.from(peers);
  }

  function conflicts(values) {
    const result = new Set();
    for (let i = 0; i < 81; i++) {
      if (!values[i]) continue;
      for (const other of peerIndices(i)) {
        if (values[other] === values[i]) { result.add(i); result.add(other); }
      }
    }
    return result;
  }

  function validComplete(values, solution) {
    return values.length === 81 && values.every((v, i) => v !== 0 && v === solution[i]);
  }

  root.SudokuEngine = { LEVELS, transform, makePuzzle, peerIndices, conflicts, validComplete };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SudokuEngine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
