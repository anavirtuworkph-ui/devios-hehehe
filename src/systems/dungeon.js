// Hard-mode floor generator: Soul Knight-style sub-levels made of a grid of rooms joined by
// corridors. Produces one big tile map plus per-room metadata (pure data, unit-tested).
import { COMBAT_ROOMS, SUB_ROOM } from '../data/rooms.js';
import { ARTIFACT_BY_ERA } from '../data/artifacts.js';
import { ERAS } from '../data/eras.js';
import { makeWaves, pickWeighted, DEFAULT_WEIGHTS } from './subrooms.js';
import { HISTORY } from '../data/history.js';

export const CELL_W = 30;
export const CELL_H = 19;
const DIRS = { E: [1, 0], W: [-1, 0], S: [0, 1], N: [0, -1] };
const OPP = { E: 'W', W: 'E', S: 'N', N: 'S' };

export const FLOOR_SHAPE = [
  { gw: 5, gh: 3, combat: 5, branches: 2 },
  { gw: 5, gh: 4, combat: 6, branches: 2 },
];

// Strip door/marker characters from a template; keep walls, floor and props.
function cleanTemplate(tpl) {
  const spots = { e: [], c: [], n: [], m: [], P: [] };
  const rows = tpl.map.map((row, y) => [...row].map((ch, x) => {
    if (spots[ch]) { spots[ch].push({ x, y }); return '.'; }
    if ('XSB'.includes(ch)) return '#';
    if (ch === '~') return '.';
    return ch;
  }));
  return { rows, w: rows[0].length, h: rows.length, spots };
}

function randomPath(rng, gw, gh, len) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const start = { x: rng.int(0, gw - 1), y: rng.int(0, gh - 1) };
    const path = [start];
    const used = new Set([`${start.x},${start.y}`]);
    while (path.length < len) {
      const cur = path[path.length - 1];
      const opts = Object.entries(DIRS)
        .map(([d, [dx, dy]]) => ({ d, x: cur.x + dx, y: cur.y + dy }))
        .filter((c) => c.x >= 0 && c.y >= 0 && c.x < gw && c.y < gh && !used.has(`${c.x},${c.y}`));
      if (!opts.length) break;
      const nxt = rng.pick(opts);
      path.push({ x: nxt.x, y: nxt.y });
      used.add(`${nxt.x},${nxt.y}`);
    }
    if (path.length === len) return path;
  }
  throw new Error('Could not lay out a floor path');
}

const dirBetween = (a, b) => Object.keys(DIRS).find((d) => a.x + DIRS[d][0] === b.x && a.y + DIRS[d][1] === b.y);

/**
 * @returns {{ W, H, gw, gh, map: string[], rooms: Array, links: Array, startId, exitId }}
 */
export function generateDungeon({ rng, eraId, sub, difficulty = 'hard', save = null, weights = DEFAULT_WEIGHTS, attempt = 0 }) {
  const shape = FLOOR_SHAPE[Math.min(sub, 1)];
  const { gw, gh } = shape;
  const era = ERAS[eraId];
  const path = randomPath(rng, gw, gh, shape.combat + 2);
  const rooms = [];
  const byCell = new Map();
  const templates = rng.shuffle(COMBAT_ROOMS.map((t) => t.id));
  const addRoom = (cell, kind, extra = {}) => {
    const r = { id: `${eraId}-${sub}-${kind}-${rooms.length}`, kind, cell, gates: [], ...extra };
    rooms.push(r);
    byCell.set(`${cell.x},${cell.y}`, r);
    return r;
  };
  // Map era recruit/weapon slots (room 0 / room 1 of the normal layout) onto the floor.
  const slotIndex = (room) => (room === 0 ? 1 : Math.min(shape.combat, 3));
  path.forEach((cell, i) => {
    if (i === 0) return addRoom(cell, 'start');
    if (i === path.length - 1) return addRoom(cell, 'exit');
    const r = addRoom(cell, 'combat', { template: templates[(i - 1) % templates.length], waves: makeWaves(rng, sub, difficulty), combatIndex: i });
    const g = (era.guaranteed || []).find((x) => x.sub === sub && slotIndex(x.room) === i);
    if (g) r.guaranteedWeapon = g.weapon;
    const rc = (era.recruits || []).find((x) => x.sub === sub && slotIndex(x.room) === i);
    if (rc) r.recruit = rc.ally;
    const sp = (era.special || []).find((x) => x.sub === sub && slotIndex(x.room) === i);
    if (sp) r.special = { ...sp };
    return r;
  });
  const links = [];
  for (let i = 0; i < path.length - 1; i++) links.push({ a: byCell.get(`${path[i].x},${path[i].y}`), b: byCell.get(`${path[i + 1].x},${path[i + 1].y}`), hidden: false });

  // Side branches hang off combat rooms.
  const branchKinds = HISTORY[eraId] ? ['history'] : []; // archives in main eras only (not 202X)
  const art = ARTIFACT_BY_ERA[eraId];
  if (sub === 1 && art) branchKinds.push(save && save.artifacts.includes(art.id) ? 'treasure' : 'vault');
  for (let i = 0; i < shape.branches; i++) branchKinds.push(pickWeighted(rng, weights));
  for (const kind of branchKinds) {
    const hosts = rng.shuffle(rooms.filter((r) => r.kind === 'combat'));
    let placed = false;
    for (const host of hosts) {
      const free = Object.values(DIRS).map(([dx, dy]) => ({ x: host.cell.x + dx, y: host.cell.y + dy }))
        .filter((c) => c.x >= 0 && c.y >= 0 && c.x < gw && c.y < gh && !byCell.has(`${c.x},${c.y}`));
      if (!free.length) continue;
      const cell = rng.pick(free);
      const side = { id: `${eraId}-${sub}-side-${rooms.length}`, kind, hidden: kind === 'hidden', artifact: kind === 'vault' ? art.id : null };
      const r = addRoom(cell, 'side', { side });
      links.push({ a: host, b: r, hidden: side.hidden });
      placed = true;
      break;
    }
    if (!placed) {
      // The path boxed itself in: lay out a fresh floor so every promised side room exists.
      if (attempt < 30) return generateDungeon({ rng, eraId, sub, difficulty, save, weights, attempt: attempt + 1 });
      if (kind === 'vault') throw new Error('vault could not be placed'); // artifacts must stay reachable
    }
  }

  // ---- Assemble the tile map ------------------------------------------------------------
  const W = gw * CELL_W, H = gh * CELL_H;
  const grid = Array.from({ length: H }, () => Array(W).fill(' '));
  for (const r of rooms) {
    const tpl = r.kind === 'combat' ? COMBAT_ROOMS.find((t) => t.id === r.template) : SUB_ROOM;
    const t = cleanTemplate(tpl);
    const cx = r.cell.x * CELL_W + Math.floor(CELL_W / 2), cy = r.cell.y * CELL_H + Math.floor(CELL_H / 2);
    const ox = cx - Math.floor(t.w / 2), oy = cy - Math.floor(t.h / 2);
    for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) grid[oy + y][ox + x] = t.rows[y][x];
    r.rect = { x: ox, y: oy, w: t.w, h: t.h };
    r.spots = Object.fromEntries(Object.entries(t.spots).map(([k, v]) => [k, v.map((p) => ({ x: p.x + ox, y: p.y + oy }))]));
    r.center = { x: cx, y: cy };
    if (r.kind !== 'combat') r.spots.e = r.spots.e.length ? r.spots.e : [{ x: cx, y: cy }];
  }
  const carveInside = (x, y, dx, dy) => {
    for (let d = 1; d <= 4; d++) {
      const ch = grid[y + dy * d][x + dx * d];
      if (ch === '.') return;
      grid[y + dy * d][x + dx * d] = '.';
    }
  };
  for (const link of links) {
    const d = dirBetween(link.a.cell, link.b.cell);
    const [A, B, dir] = d === 'E' || d === 'S' ? [link.a, link.b, d] : [link.b, link.a, OPP[d]];
    if (dir === 'E') {
      const r0 = A.center.y - 1;
      const x0 = A.rect.x + A.rect.w - 1, x1 = B.rect.x;
      for (let x = x0; x <= x1; x++) {
        grid[r0][x] = '.'; grid[r0 + 1][x] = '.';
        if (grid[r0 - 1][x] === ' ') grid[r0 - 1][x] = '#';
        if (grid[r0 + 2][x] === ' ') grid[r0 + 2][x] = '#';
      }
      for (const yy of [r0, r0 + 1]) { carveInside(x0, yy, -1, 0); carveInside(x1, yy, 1, 0); }
      A.gates.push({ dir: 'E', cells: [{ x: x0, y: r0 }, { x: x0, y: r0 + 1 }], to: B.id, link });
      B.gates.push({ dir: 'W', cells: [{ x: x1, y: r0 }, { x: x1, y: r0 + 1 }], to: A.id, link });
    } else {
      const c0 = A.center.x - 1;
      const y0 = A.rect.y + A.rect.h - 1, y1 = B.rect.y;
      for (let y = y0; y <= y1; y++) {
        grid[y][c0] = '.'; grid[y][c0 + 1] = '.';
        if (grid[y][c0 - 1] === ' ') grid[y][c0 - 1] = '#';
        if (grid[y][c0 + 2] === ' ') grid[y][c0 + 2] = '#';
      }
      for (const xx of [c0, c0 + 1]) { carveInside(xx, y0, 0, -1); carveInside(xx, y1, 0, 1); }
      A.gates.push({ dir: 'S', cells: [{ x: c0, y: y0 }, { x: c0 + 1, y: y0 }], to: B.id, link });
      B.gates.push({ dir: 'N', cells: [{ x: c0, y: y1 }, { x: c0 + 1, y: y1 }], to: A.id, link });
    }
    // A hidden branch is sealed by a cracked wall on the host room's side.
    if (link.hidden) link.crack = link.a.gates.find((g) => g.link === link).cells;
  }
  const startRoom = rooms.find((r) => r.kind === 'start');
  const exitRoom = rooms.find((r) => r.kind === 'exit');
  return { W, H, gw, gh, map: grid.map((row) => row.join('')), rooms, links, startId: startRoom.id, exitId: exitRoom.id };
}
