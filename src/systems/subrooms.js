// Sub-level planning: picks room templates, enemy waves and optional sub-rooms.
import { COMBAT_ROOMS, SUBROOM_TYPES } from '../data/rooms.js';
import { ARTIFACT_BY_ERA } from '../data/artifacts.js';
import { ERAS } from '../data/eras.js';
import { DIFFICULTY } from '../config.js';

export const OPTIONAL_ROOM_CHANCE = 0.75;

export function pickWeighted(rng, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng.next() * total;
  for (const [k, w] of entries) {
    roll -= w;
    if (roll < 0) return k;
  }
  return entries[entries.length - 1][0];
}

export const DEFAULT_WEIGHTS = Object.fromEntries(Object.entries(SUBROOM_TYPES).map(([k, v]) => [k, v.weight]));

export function makeWaves(rng, sub, difficulty, stronger) {
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.easy;
  const pool = sub === 0 ? ['grunt', 'grunt', 'shooter', 'runner'] : ['grunt', 'shooter', 'runner', 'armored', 'bomber'];
  const base = sub === 0 ? 5 : 6;
  const count = Math.max(3, Math.round(base * diff.enemyCount) + (stronger ? 2 : 0));
  const waves = [];
  for (let w = 0; w < diff.waves; w++) {
    const n = w === 0 ? count : Math.max(2, count - 2);
    const wave = [];
    for (let i = 0; i < n; i++) wave.push({ type: rng.pick(pool), elite: false });
    waves.push(wave);
  }
  // One elite per room in the second sub-level (and sometimes the first on Normal).
  if (sub === 1 || difficulty === 'hard' || (difficulty === 'normal' && rng.chance(0.4))) {
    const last = waves[waves.length - 1];
    last[0] = { type: rng.pick(['grunt', 'armored', 'shooter']), elite: true };
  }
  // Hard mode: the first wave of later rooms brings a second elite.
  if (difficulty === 'hard' && sub === 1) waves[0][1] = { type: rng.pick(['armored', 'bomber', 'shooter']), elite: true };
  return waves;
}

/**
 * Build the plan for one sub-level.
 * @returns {{eraId, sub, isBoss, rooms: Array}}
 */
export function planSublevel({ rng, eraId, sub, difficulty = 'easy', save, weights = DEFAULT_WEIGHTS }) {
  const era = ERAS[eraId];
  if (sub === 2) {
    return { eraId, sub, isBoss: true, rooms: [{ id: `${eraId}-2-boss`, kind: 'boss', template: 'arena', bosses: era.boss.slice() }] };
  }
  const templates = rng.shuffle(COMBAT_ROOMS.map((r) => r.id));
  const rooms = [];
  for (let i = 0; i < 2; i++) {
    const room = {
      id: `${eraId}-${sub}-${i}`,
      kind: 'combat',
      template: templates[i],
      waves: makeWaves(rng, sub, difficulty),
      side: null,
      recruit: null,
      special: null,
      guaranteedWeapon: null,
    };
    const g = (era.guaranteed || []).find((x) => x.sub === sub && x.room === i);
    if (g) room.guaranteedWeapon = g.weapon;
    const r = (era.recruits || []).find((x) => x.sub === sub && x.room === i);
    if (r) room.recruit = r.ally;
    const sp = (era.special || []).find((x) => x.sub === sub && x.room === i);
    if (sp) room.special = { ...sp };
    rooms.push(room);
  }

  // Optional slot after the first combat room.
  if (rng.chance(OPTIONAL_ROOM_CHANCE)) {
    const kind = pickWeighted(rng, weights);
    rooms[0].side = { id: `${rooms[0].id}-side`, kind, hidden: kind === 'hidden' };
  }
  // The era's artifact vault is always offered in the last room of sub-level 2 while the
  // artifact is missing, so artifacts are never left to chance and are always recoverable.
  const artifact = ARTIFACT_BY_ERA[eraId];
  if (sub === 1 && artifact) {
    const owned = save && save.artifacts.includes(artifact.id);
    rooms[1].side = { id: `${rooms[1].id}-vault`, kind: owned ? 'treasure' : 'vault', artifact: owned ? null : artifact.id };
  } else if (sub === 0 && !rooms[1].side && rng.chance(0.35)) {
    // A second, lighter optional room (never a shop detour right before a boss: sub 2 has none).
    const kind = pickWeighted(rng, { treasure: 25, healing: 15, rest: 10, shrine: 10 });
    rooms[1].side = { id: `${rooms[1].id}-side`, kind, hidden: false };
  }
  return { eraId, sub, isBoss: false, rooms };
}
