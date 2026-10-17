import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT_ROOMS, BOSS_ROOM, SUB_ROOM, SAFE_ROOM, TUTORIAL_ROOM } from '../src/data/rooms.js';

const all = [...COMBAT_ROOMS, BOSS_ROOM, SUB_ROOM, SAFE_ROOM, TUTORIAL_ROOM];

// Flood fill from P over walkable tiles: every spawn, chest, NPC and door must be reachable.
function reachable(map) {
  const h = map.length, w = map[0].length;
  let start;
  map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'P') start = [x, y]; }));
  const seen = new Set([start.join()]);
  const q = [start];
  const walk = (ch) => ch !== '#' && ch !== 'o' && ch !== ' ';
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ch = map[ny][nx];
      const k = `${nx},${ny}`;
      if (seen.has(k) || !walk(ch)) continue;
      seen.add(k);
      // Doors are on the boundary: reachable but not expanded through.
      if (!'XSB'.includes(ch)) q.push([nx, ny]);
    }
  }
  return seen;
}

test('room templates are rectangular, enclosed and fully reachable', () => {
  for (const r of all) {
    const w = r.map[0].length;
    for (const row of r.map) assert.equal(row.length, w, `${r.id} row width`);
    assert.equal(r.map.join('').split('P').length - 1, 1, `${r.id} has one P`);
    const h = r.map.length;
    const seen = reachable(r.map);
    r.map.forEach((row, y) => [...row].forEach((ch, x) => {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      if (edge) assert.ok('#XSB'.includes(ch), `${r.id} edge ${x},${y} must be wall/door`);
      if ('ecnmXSB'.includes(ch)) assert.ok(seen.has(`${x},${y}`), `${r.id} ${ch} at ${x},${y} unreachable`);
    }));
  }
  for (const r of COMBAT_ROOMS) {
    assert.ok(r.map[0].includes('XX'), `${r.id} exit on top wall`);
    assert.ok(r.map.join('').includes('S'), `${r.id} has side door`);
  }
});
