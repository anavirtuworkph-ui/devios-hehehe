// Shop catalogue, reward tables and purchase validation (pure game rules, no UI).
import { WEAPON_BY_ID, weaponsForEra, weaponPrice } from '../data/weapons.js';
import { spendShards, ownsWeapon, giveWeapon, refillAmmo, maxHpFor } from './run.js';

export const REWARDS = {
  enemy: [1, 3],
  elite: [4, 8],
  boss: [15, 30],
  chestSmall: [5, 10],
  chestLarge: [10, 20],
  trial: [8, 14],
  hidden: [10, 18],
};

export function rollReward(rng, kind, difficulty = 'easy') {
  const [a, b] = REWARDS[kind] || [1, 1];
  // Normal is harder, so it pays slightly more for special encounters.
  const scale = difficulty === 'normal' && (kind === 'trial' || kind === 'hidden') ? 1.2 : 1;
  return Math.round(rng.int(a, b) * scale);
}

// Consumables & services. `apply(ctx)` mutates run state; ctx = { run, save, hp: {get,set} }.
export const SUPPLIES = {
  heal_small: { name: 'Calamansi Juice', desc: 'Restore 6 HP.', price: 6, kind: 'heal', amount: 6 },
  heal_full: { name: 'Full Temporal Patch-Up', desc: 'Restore all HP.', price: 15, kind: 'heal', amount: 999 },
  ammo: { name: 'Ammo Crate', desc: 'Refill reserve ammo for every equipped gun.', price: 7, kind: 'ammo' },
  buff_damage: { name: 'Adrenaline Adobo', desc: '+25% damage for 90 s.', price: 10, kind: 'buff', buff: 'damage', value: 0.25, duration: 90000 },
  buff_speed: { name: 'Turbo Tsinelas', desc: '+20% move speed for 90 s.', price: 8, kind: 'buff', buff: 'speed', value: 0.2, duration: 90000 },
  buff_crit: { name: 'Lucky Agimat', desc: '+15% critical-hit chance for 90 s.', price: 12, kind: 'buff', buff: 'crit', value: 0.15, duration: 90000 },
  bomb: { name: 'Chrono Bomb', desc: 'Consumable: blast every nearby enemy for 40 damage.', price: 12, kind: 'consumable', item: 'bomb' },
  patch: { name: 'Med Patch', desc: 'Consumable: restore 8 HP whenever you need it.', price: 8, kind: 'consumable', item: 'patch' },
  shield: { name: 'Shield Bubble', desc: 'Consumable: 5 s of invulnerability.', price: 14, kind: 'consumable', item: 'shield' },
  up_weapon: { name: 'Weapon Tune-Up', desc: 'Current weapon +15% damage (max 3 levels).', price: 16, kind: 'weaponUpgrade' },
  up_armor: { name: 'Bamboo Plating', desc: 'Run upgrade: take 10% less damage (max 3).', price: 18, kind: 'runUpgrade', stat: 'armor', cap: 3 },
};

// Run (temporary) and permanent upgrades sold at the DeVios upgrade station.
export const STATION_UPGRADES = {
  run_maxhp: { name: 'Reinforced Lab Coat', desc: 'Run: +2 max HP (max 5).', price: 14, kind: 'runUpgrade', stat: 'maxHp', cap: 5, scale: 4 },
  run_damage: { name: 'Overclocked Barrels', desc: 'Run: +10% weapon damage (max 5).', price: 15, kind: 'runUpgrade', stat: 'damage', cap: 5, scale: 4 },
  run_dodge: { name: 'Spring-Loaded Sneakers', desc: 'Run: dodge recharges 20% faster (max 3).', price: 12, kind: 'runUpgrade', stat: 'dodge', cap: 3, scale: 4 },
  run_armor: { name: 'Bamboo Plating', desc: 'Run: take 10% less damage (max 3).', price: 18, kind: 'runUpgrade', stat: 'armor', cap: 3, scale: 5 },
  run_magnet: { name: 'Shard Magnet', desc: 'Run: +10% Time Shards collected (max 3).', price: 12, kind: 'runUpgrade', stat: 'magnet', cap: 3, scale: 4 },
  run_ammo: { name: 'Bigger Bandoliers', desc: 'Run: larger reserve ammo for new guns (max 3).', price: 10, kind: 'runUpgrade', stat: 'ammo', cap: 3, scale: 3 },
  perm_maxhp: { name: 'Permanent: Chrono-Vitals Implant', desc: 'PERMANENT across runs: +2 max HP (max 3).', price: 30, kind: 'permUpgrade', stat: 'maxHp', cap: 3, scale: 10 },
  perm_shards: { name: 'Permanent: Temporal Lens', desc: 'PERMANENT across runs: +5% Time Shards (max 2).', price: 25, kind: 'permUpgrade', stat: 'shardBonus', cap: 2, scale: 10 },
};

export function upgradePrice(item, level) {
  return item.price + (item.scale || 0) * level;
}

export function shopEntryFromWeapon(id) {
  const def = WEAPON_BY_ID[id];
  return { key: `w:${id}`, kind: 'weapon', weapon: id, name: def.name, desc: def.desc, price: weaponPrice(def), rarity: def.rarity, stock: 1 };
}

export function shopEntryFromSupply(key, stock = 1) {
  const s = SUPPLIES[key];
  return { key, kind: s.kind, name: s.name, desc: s.desc, price: s.price, stock };
}

// Build a rotating inventory for an era shop.
export function generateShopInventory(rng, eraId, run) {
  const pool = weaponsForEra(eraId).filter((w) => !ownsWeapon(run, w.id));
  const weapons = rng.shuffle(pool).slice(0, 2).map((w) => shopEntryFromWeapon(w.id));
  const supplies = [shopEntryFromSupply('heal_small', 2), shopEntryFromSupply('heal_full'), shopEntryFromSupply('ammo', 2)];
  const extras = rng.shuffle(['buff_damage', 'buff_speed', 'buff_crit', 'bomb', 'patch', 'shield', 'up_weapon', 'up_armor']).slice(0, 3);
  return [...weapons, ...supplies, ...extras.map((k) => shopEntryFromSupply(k))];
}

// Validates and applies a purchase. ctx = { run, save, player } where player exposes
// heal(n), maxHp, hp, addBuff(type, value, duration). Returns { ok, message }.
export function purchase(entry, ctx) {
  const { run, save, player } = ctx;
  if (!entry) return { ok: false, message: 'Nothing to buy.' };
  if (entry.stock !== undefined && entry.stock <= 0) return { ok: false, message: 'Sold out.' };
  const price = entry.price;
  if (run.shards < price) return { ok: false, message: `Not enough Time Shards (need ${price}).` };

  // Pre-validate effects that could be wasted.
  if (entry.kind === 'weapon' && ownsWeapon(run, entry.weapon)) return { ok: false, message: 'You already own that weapon.' };
  if (entry.kind === 'heal' && player && player.hp >= player.maxHp) return { ok: false, message: 'Already at full health.' };
  if (entry.kind === 'consumable' && run.consumables[SUPPLIES[entry.key].item] >= 9) return { ok: false, message: 'You can’t carry more.' };
  if (entry.kind === 'weaponUpgrade') {
    const w = run.loadout[run.current];
    if (!w || w.level >= 3) return { ok: false, message: 'Current weapon is fully tuned.' };
  }
  let upgradeDef = null;
  if (entry.kind === 'runUpgrade' || entry.kind === 'permUpgrade') {
    upgradeDef = STATION_UPGRADES[entry.key] || SUPPLIES[entry.key];
    const level = entry.kind === 'permUpgrade' ? save.permanent[upgradeDef.stat] : run.upgrades[upgradeDef.stat];
    if (level >= upgradeDef.cap) return { ok: false, message: 'Already maxed out.' };
  }

  if (!spendShards(run, price)) return { ok: false, message: 'Purchase failed.' };

  switch (entry.kind) {
    case 'weapon': giveWeapon(run, entry.weapon); break;
    case 'heal': if (player) player.heal(SUPPLIES[entry.key].amount); break;
    case 'ammo': refillAmmo(run, 1); break;
    case 'buff': { const s = SUPPLIES[entry.key]; if (player) player.addBuff(s.buff, s.value, s.duration); break; }
    case 'consumable': run.consumables[SUPPLIES[entry.key].item] += 1; break;
    case 'weaponUpgrade': run.loadout[run.current].level += 1; break;
    case 'runUpgrade': {
      run.upgrades[upgradeDef.stat] += 1;
      if (upgradeDef.stat === 'maxHp' && player) { player.maxHp = maxHpFor(run, save); player.heal(2); }
      break;
    }
    case 'permUpgrade': {
      save.permanent[upgradeDef.stat] += 1;
      if (upgradeDef.stat === 'maxHp' && player) { player.maxHp = maxHpFor(run, save); player.heal(2); }
      break;
    }
    default: break;
  }
  if (entry.stock !== undefined) entry.stock -= 1;
  return { ok: true, message: `Bought ${entry.name}!` };
}
