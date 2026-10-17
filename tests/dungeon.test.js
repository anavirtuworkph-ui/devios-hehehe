import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeon } from '../src/systems/dungeon.js';
import { makeRng } from '../src/systems/rng.js';
import { defaultSave } from '../src/systems/save.js';
import { MAIN_ERAS } from '../src/data/eras.js';

// Walkable chars in the assembled map; cracked walls are opened for the reachability check.
function flood(map, start, opened) {
  const seen = new Set([`${start.x},${start.y}`]);
  const q = [start];
  while (q.length) {
    const { x, y } = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (seen.has(k) || ny < 0 || ny >= map.length || nx < 0 || nx >= map[0].length) continue;
      const ch = map[ny][nx];
      if (ch !== '.' && !opened.has(k)) continue;
      seen.add(k);
      q.push({ x: nx, y: ny });
    }
  }
  return seen;
}

test('hard-mode floors are connected, enclosed, and contain every room type they promise', () => {
  const save = defaultSave();
  for (const era of [...MAIN_ERAS, 'modern']) {
    for (const sub of [0, 1]) {
      for (let seed = 1; seed <= 40; seed++) {
        const d = generateDungeon({ rng: makeRng(seed * 977 + sub), eraId: era, sub, save });
        const start = d.rooms.find((r) => r.id === d.startId);
        const seen = flood(d.map, start.center, new Set());
        for (const r of d.rooms) {
          const hidden = d.links.some((l) => l.hidden && l.b === r);
          const reach = hidden ? flood(d.map, start.center, new Set(d.links.find((l) => l.b === r).crack.map((c) => `${c.x},${c.y}`))) : seen;
          for (const k of ['e', 'c']) for (const p of r.spots[k] || []) assert.ok(reach.has(`${p.x},${p.y}`), `${era}/${sub}/${seed}: ${r.kind} ${k} spot unreachable`);
          assert.ok(reach.has(`${r.center.x},${r.center.y}`) || d.map[r.center.y][r.center.x] === 'o', `${era}/${sub}/${seed}: ${r.kind} center unreachable`);
        }
        // Map edges never leak to the void
        for (const key of seen) {
          const [x, y] = key.split(',').map(Number);
          assert.ok(x > 0 && y > 0 && x < d.W - 1 && y < d.H - 1, 'walkable tile on map edge');
        }
        assert.equal(d.rooms.filter((r) => r.kind === 'combat').length, sub === 0 ? 5 : 6);
        if (sub === 1 && era !== 'modern') assert.ok(d.rooms.some((r) => r.side && r.side.kind === 'vault'), 'vault present when artifact missing');
      }
    }
  }
});
