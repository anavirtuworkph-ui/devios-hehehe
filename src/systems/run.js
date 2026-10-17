// Run-based state: Time Shards, loadout, consumables and temporary upgrades.
// A run starts fresh (0 shards) but never touches permanent campaign progress.
import { WEAPON_BY_ID } from '../data/weapons.js';
import { DIFFICULTY } from '../config.js';

export const MAX_SLOTS = 4;

export function makeWeaponInstance(id, ammoUpgrade = 0) {
  const def = WEAPON_BY_ID[id];
  if (!def) throw new Error(`Unknown weapon ${id}`);
  const infinite = def.reserve === Infinity || def.reserve === undefined;
  const reserve = infinite ? null : Math.round(def.reserve * (0.5 + 0.15 * ammoUpgrade));
  return { id, ammo: def.mag || 0, reserve, level: 0 };
}

export function createRun(save) {
  return {
    id: String(Date.now()),
    shards: 0,
    loadout: [makeWeaponInstance('chrono_pistol'), makeWeaponInstance('plasma_wrench')],
    current: 0,
    stash: [],
    hp: 0, // 0 = full on next stage start
    consumables: { bomb: 1, patch: 1, shield: 0 },
    upgrades: { damage: 0, maxHp: 0, dodge: 0, armor: 0, magnet: 0, ammo: 0 },
    bossRewarded: [],
    location: null,
    lastEra: null,
    _permanentSeen: save ? save.permanent.maxHp : 0,
  };
}

export function maxHpFor(run, save) {
  const diff = DIFFICULTY[save.settings.difficulty] || DIFFICULTY.easy;
  return diff.playerHp + run.upgrades.maxHp * 2 + save.permanent.maxHp * 2;
}

export function addShards(run, save, amount) {
  const bonus = 1 + 0.1 * run.upgrades.magnet + 0.05 * save.permanent.shardBonus;
  const gained = Math.max(0, Math.round(amount * bonus));
  run.shards += gained;
  return gained;
}

export function spendShards(run, price) {
  if (!Number.isFinite(price) || price < 0) return false;
  if (run.shards < price) return false;
  run.shards -= price;
  return true;
}

export function ownsWeapon(run, id) {
  return run.loadout.some((w) => w.id === id) || run.stash.includes(id);
}

// Adds a weapon. If the loadout is full the *current* weapon is moved to the stash
// (it can be re-equipped from the DeVios armory). Returns 'equipped' | 'swapped' | 'owned'.
export function giveWeapon(run, id) {
  if (run.loadout.some((w) => w.id === id)) return 'owned';
  const inst = makeWeaponInstance(id, run.upgrades.ammo);
  run.stash = run.stash.filter((s) => s !== id);
  if (run.loadout.length < MAX_SLOTS) {
    run.loadout.push(inst);
    run.current = run.loadout.length - 1;
    return 'equipped';
  }
  const old = run.loadout[run.current];
  if (!run.stash.includes(old.id)) run.stash.push(old.id);
  run.loadout[run.current] = inst;
  return 'swapped';
}

export function equipFromStash(run, id, slot) {
  if (!run.stash.includes(id)) return false;
  run.stash = run.stash.filter((s) => s !== id);
  const inst = makeWeaponInstance(id, run.upgrades.ammo);
  if (slot === undefined || slot >= run.loadout.length) {
    if (run.loadout.length < MAX_SLOTS) {
      run.loadout.push(inst);
      return true;
    }
    slot = run.current;
  }
  const old = run.loadout[slot];
  if (old && !run.stash.includes(old.id)) run.stash.push(old.id);
  run.loadout[slot] = inst;
  return true;
}

export function unequip(run, slot) {
  if (run.loadout.length <= 1) return false;
  const [old] = run.loadout.splice(slot, 1);
  if (!run.stash.includes(old.id)) run.stash.push(old.id);
  run.current = Math.min(run.current, run.loadout.length - 1);
  return true;
}

export function refillAmmo(run, fraction = 1) {
  for (const w of run.loadout) {
    const def = WEAPON_BY_ID[w.id];
    if (!def || !def.mag || w.reserve === null) continue;
    const cap = Math.round(def.reserve * (0.5 + 0.15 * run.upgrades.ammo));
    w.reserve = Math.min(cap, w.reserve + Math.ceil(cap * fraction));
  }
}

export const clone = (o) => JSON.parse(JSON.stringify(o));
