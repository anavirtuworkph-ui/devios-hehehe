// Data-driven weapon definitions.
//
// Fields:
//  id, name, era, category: melee | pistol | rifle | auto | shotgun | explosive | special
//  rarity: starter | common | rare
//  damage: number | [min, max]      cooldown: ms between attacks
//  range: px (projectile travel or melee reach)   speed: projectile px/s
//  mag / reload(ms) / reserve: magazine, reload time, max reserve ammo (Infinity = unlimited)
//  spread: degrees of random inaccuracy   pellets: projectiles per shot
//  aoe: explosion radius px          pierce: enemies a projectile passes through
//  melee: { arc (deg), lunge (px) }  special: misc ability flags (see systems/weapons.js)
//  look: procedural sprite parameters   bullet: projectile texture key
//  acquire: human-readable acquisition note   desc: flavour/mechanics text
export const WEAPONS = [
  // ---- 205X starters / tutorial --------------------------------------------------------
  {
    id: 'chrono_pistol', name: 'Chrono Pistol', era: 'lab', category: 'pistol', rarity: 'starter',
    damage: 6, cooldown: 260, range: 220, speed: 330, mag: 12, reload: 900, reserve: Infinity, spread: 3,
    bullet: 'b_energy', color: 0x6ff3ff, look: { type: 'pistol', color: '#cfd8e3', accent: '#47e0ff' },
    desc: 'Anon’s trusty lab sidearm. Unlimited reserve energy.', acquire: 'Starting weapon.',
  },
  {
    id: 'plasma_wrench', name: 'Plasma Wrench', era: 'lab', category: 'melee', rarity: 'starter',
    damage: 11, cooldown: 380, range: 26, melee: { arc: 110, lunge: 4 },
    color: 0x6ff3ff, look: { type: 'wrench', color: '#9aa7b8', accent: '#47e0ff' },
    desc: 'Melee. Swings deflect enemy bullets.', acquire: 'Starting weapon.',
  },
  {
    id: 'proto_scatter', name: 'Prototype Scatter-Blaster', era: 'lab', category: 'shotgun', rarity: 'common',
    damage: 4, pellets: 5, cooldown: 620, range: 130, speed: 300, mag: 6, reload: 1300, reserve: 60, spread: 22,
    bullet: 'b_pellet', color: 0x9dff6a, look: { type: 'shotgun', color: '#6b7b8c', accent: '#9dff6a' },
    desc: 'Short-range spread of experimental pellets.', acquire: 'Tutorial pickup; shops.',
  },

  // ---- Pre-colonial ---------------------------------------------------------------------
  {
    id: 'poison_spear', name: 'Poison Spear', era: 'precolonial', category: 'melee', rarity: 'common',
    damage: 12, cooldown: 520, range: 44, melee: { arc: 36, lunge: 10, thrust: true },
    special: { poison: { dps: 4, duration: 3000 } },
    color: 0x7dff4a, look: { type: 'spear', color: '#8b5a2b', accent: '#7dff4a' },
    desc: 'Long thrust that poisons (4 dmg/s for 3 s).', acquire: 'Pre-colonial rooms, chests and shops.',
  },
  {
    id: 'kris', name: 'Kris', era: 'precolonial', category: 'melee', rarity: 'common',
    damage: 9, cooldown: 210, range: 24, melee: { arc: 120, lunge: 6, wavy: true },
    color: 0xffd36b, look: { type: 'kris', color: '#c9c9c9', accent: '#d4a017' },
    desc: 'Wavy blade with very short recovery. Deflects bullets.', acquire: 'Pre-colonial rooms, chests and shops.',
  },

  // ---- Spanish colonial ------------------------------------------------------------------
  {
    id: 'bolo', name: 'Bolo', era: 'spanish', category: 'melee', rarity: 'common',
    damage: 16, cooldown: 430, range: 28, melee: { arc: 140, lunge: 6 },
    color: 0xffffff, look: { type: 'blade', color: '#d0d0d0', accent: '#6b3e1f' },
    desc: 'Wide, heavy chop. Deflects bullets.', acquire: 'Spanish-era rooms, chests and shops.',
  },
  {
    id: 'rolling_block', name: 'Rolling Block', era: 'spanish', category: 'rifle', rarity: 'common',
    damage: 42, cooldown: 1150, range: 320, speed: 520, mag: 1, reload: 700, reserve: 40, spread: 0, pierce: 1,
    bullet: 'b_rifle', color: 0xfff1a8, look: { type: 'rifle', color: '#5a3a1e', accent: '#888' },
    desc: 'Single-shot, slow, hits like a cart. Pierces one enemy.', acquire: 'Spanish-era rooms, chests and shops.',
  },
  {
    id: 'm93', name: 'M93', era: 'spanish', category: 'rifle', rarity: 'common',
    damage: 24, cooldown: 640, range: 300, speed: 480, mag: 5, reload: 1600, reserve: 60, spread: 1,
    bullet: 'b_rifle', color: 0xfff1a8, look: { type: 'rifle', color: '#6b4426', accent: '#666' },
    desc: '5-round bolt action. Accurate and steady.', acquire: 'Spanish-era rooms, chests and shops.',
  },
  {
    id: 'c96', name: 'C96', era: 'spanish', category: 'pistol', rarity: 'common',
    damage: 7, cooldown: 150, range: 200, speed: 360, mag: 10, reload: 1400, reserve: 120, spread: 6,
    bullet: 'b_small', color: 0xffe08a, look: { type: 'pistol', color: '#3a3a3a', accent: '#7a4a20' },
    desc: 'Fast-firing pistol; lower damage per shot than rifles.', acquire: 'Spanish-era rooms, chests and shops.',
  },
  {
    id: 'rizal_quill', name: 'Rizal’s Quill and Book', era: 'spanish', category: 'special', rarity: 'rare',
    damage: [4, 6], cooldown: 360, range: 230, speed: 300, mag: 0, reserve: Infinity, spread: 0,
    special: { literary: true },
    bullet: 'b_ink', color: 0x2a2a5a, look: { type: 'book', color: '#6b2a1a', accent: '#f2e6c8' },
    desc: 'Fires ink. El Filibusterismo: 3 quick ink shots (4–6). Noli Me Tangere: heavy ink blot (10–15). '
      + 'Mi Último Adiós: 1-in-200 chance per shot to instantly defeat ordinary enemies within 3 m.',
    acquire: 'Guaranteed in Spanish Era sub-level 1. Can sketch an ally into being…',
  },

  // ---- American colonial -----------------------------------------------------------------
  {
    id: 'howitzer', name: 'Howitzer', era: 'american', category: 'explosive', rarity: 'rare',
    damage: 60, cooldown: 1900, range: 210, speed: 210, mag: 1, reload: 2100, reserve: 14, spread: 0, aoe: 58,
    special: { lob: true, showBlast: true },
    bullet: 'b_shell', color: 0xffa040, look: { type: 'heavy', color: '#3f4a32', accent: '#222' },
    desc: 'Lobs a shell that bursts where you aim. Shows its blast radius. Very slow.', acquire: 'American-era rooms, chests and shops.',
  },
  {
    id: 'colt_saa', name: 'Colt Single Action', era: 'american', category: 'pistol', rarity: 'common',
    damage: 15, cooldown: 460, range: 230, speed: 400, mag: 6, reload: 2000, reserve: 72, spread: 2,
    bullet: 'b_small', color: 0xffe08a, look: { type: 'revolver', color: '#9a9a9a', accent: '#5a3a1e' },
    desc: 'Deliberate six-shooter rhythm. Strong per shot.', acquire: 'American-era rooms, chests and shops.',
  },
  {
    id: 'springfield', name: 'Springfield', era: 'american', category: 'rifle', rarity: 'common',
    damage: 32, cooldown: 900, range: 380, speed: 560, mag: 5, reload: 1800, reserve: 50, spread: 0, pierce: 2,
    bullet: 'b_rifle', color: 0xfff1a8, look: { type: 'rifle', color: '#5c3b20', accent: '#555', long: true },
    desc: 'Long range, slow fire, pierces two enemies.', acquire: 'American-era rooms, chests and shops.',
  },
  {
    id: 'model_1987', name: 'Model 1987', era: 'american', category: 'shotgun', rarity: 'common',
    damage: 5, pellets: 6, cooldown: 780, range: 140, speed: 330, mag: 5, reload: 2200, reserve: 45, spread: 26,
    bullet: 'b_pellet', color: 0xffd080, look: { type: 'shotgun', color: '#5c3b20', accent: '#444' },
    desc: 'Game interpretation: a pump-action lever-era scattergun. Name preserved as supplied; stats are fictional.',
    acquire: 'American-era rooms, chests and shops.',
  },

  // ---- Japanese occupation ---------------------------------------------------------------
  {
    id: 'type38', name: 'Type 38 Arisaka', era: 'japanese', category: 'rifle', rarity: 'common',
    damage: 28, cooldown: 900, range: 380, speed: 560, mag: 5, reload: 1700, reserve: 50, spread: 0, pierce: 1,
    bullet: 'b_rifle', color: 0xfff1a8, look: { type: 'rifle', color: '#6b4426', accent: '#555', long: true },
    desc: 'Very accurate, long reach, mild recoil.', acquire: 'Japanese-era rooms, chests and shops.',
  },
  {
    id: 'type99', name: 'Type 99 Arisaka', era: 'japanese', category: 'rifle', rarity: 'common',
    damage: 38, cooldown: 1050, range: 320, speed: 520, mag: 5, reload: 1800, reserve: 45, spread: 1,
    special: { knockback: 90 },
    bullet: 'b_rifle', color: 0xfff1a8, look: { type: 'rifle', color: '#5a3a1e', accent: '#444' },
    desc: 'Heavier round: more damage and knockback, shorter reach.', acquire: 'Japanese-era rooms, chests and shops.',
  },
  {
    id: 'nambu', name: 'Nambu', era: 'japanese', category: 'pistol', rarity: 'common',
    damage: 8, cooldown: 300, range: 200, speed: 340, mag: 8, reload: 1300, reserve: 96, spread: 4,
    bullet: 'b_small', color: 0xffe08a, look: { type: 'pistol', color: '#4a4a3a', accent: '#5a3a1e' },
    desc: 'Light, reliable sidearm.', acquire: 'Japanese-era rooms, chests and shops.',
  },
  {
    id: 'katana', name: 'Katana', era: 'japanese', category: 'melee', rarity: 'rare',
    damage: 19, cooldown: 300, range: 30, melee: { arc: 130, lunge: 14 },
    color: 0xffffff, look: { type: 'katana', color: '#e6e6e6', accent: '#2a2a2a' },
    desc: 'Fast lunging slash. Deflects bullets.', acquire: 'Japanese-era rooms, chests and shops.',
  },
  {
    id: 'bar', name: 'BAR', era: 'japanese', alsoEras: ['marcos'], category: 'auto', rarity: 'rare',
    damage: 11, cooldown: 125, range: 280, speed: 470, mag: 20, reload: 2400, reserve: 160, spread: 5,
    special: { moveSlow: 0.7 },
    bullet: 'b_rifle', color: 0xfff1a8, look: { type: 'heavy', color: '#4a3a2a', accent: '#333', long: true },
    desc: 'Sustained automatic fire. You move 30% slower while firing.', acquire: 'Japanese & Marcos-era rooms, chests and shops.',
  },
  {
    id: 'thompson', name: 'Thompson', era: 'japanese', alsoEras: ['marcos'], category: 'auto', rarity: 'common',
    damage: 7, cooldown: 85, range: 170, speed: 380, mag: 30, reload: 2000, reserve: 240, spread: 9,
    bullet: 'b_small', color: 0xffe08a, look: { type: 'smg', color: '#3a3a3a', accent: '#6b4426', drum: true },
    desc: 'High rate of fire, best at short-to-medium range.', acquire: 'Japanese & Marcos-era rooms, chests and shops.',
  },
  {
    id: 'bayonet', name: 'Bayonet', era: 'japanese', category: 'melee', rarity: 'common',
    damage: 14, cooldown: 450, range: 38, melee: { arc: 40, lunge: 12, thrust: true },
    color: 0xffffff, look: { type: 'knife', color: '#c8c8c8', accent: '#3a3a3a', long: true },
    desc: 'Long-reach thrust. Deflects bullets in a narrow line.', acquire: 'Japanese-era rooms, chests and shops.',
  },

  // ---- Marcos era, 1985 -----------------------------------------------------------------
  {
    id: 'm1_garand', name: 'M1 Garand', era: 'marcos', category: 'rifle', rarity: 'common',
    damage: 21, cooldown: 300, range: 320, speed: 520, mag: 8, reload: 1700, reserve: 96, spread: 1,
    special: { enBloc: true },
    bullet: 'b_rifle', color: 0xfff1a8, look: { type: 'rifle', color: '#6b4426', accent: '#444' },
    desc: 'Semi-auto 8-round clip with its signature *ping* when emptied. Only reloads when empty.', acquire: 'Marcos-era rooms, chests and shops.',
  },
  {
    id: 'm1_carbine', name: 'M1 Carbine', era: 'marcos', category: 'rifle', rarity: 'common',
    damage: 11, cooldown: 190, range: 260, speed: 460, mag: 15, reload: 1400, reserve: 150, spread: 3,
    bullet: 'b_small', color: 0xffe08a, look: { type: 'rifle', color: '#7a5030', accent: '#444' },
    desc: 'Lighter and quicker than the Garand.', acquire: 'Marcos-era rooms, chests and shops.',
  },
  {
    id: 'grease_gun', name: 'Grease Gun', era: 'marcos', category: 'auto', rarity: 'common',
    damage: 9, cooldown: 140, range: 170, speed: 340, mag: 30, reload: 1900, reserve: 210, spread: 7,
    bullet: 'b_small', color: 0xffe08a, look: { type: 'smg', color: '#5a5a5a', accent: '#333' },
    desc: 'Slow, chunky automatic fire. Easy to control.', acquire: 'Marcos-era rooms, chests and shops.',
  },
  {
    id: 'm60', name: 'M60', era: 'marcos', category: 'auto', rarity: 'rare',
    damage: 12, cooldown: 95, range: 290, speed: 480, mag: 60, reload: 3500, reserve: 240, spread: 7,
    special: { moveSlow: 0.6 },
    bullet: 'b_rifle', color: 0xfff1a8, look: { type: 'heavy', color: '#2e3326', accent: '#111', long: true },
    desc: 'Huge belt, long reload; you move 40% slower while firing.', acquire: 'Marcos-era rooms, chests and shops.',
  },
  {
    id: 'bongbong_rl', name: 'Bongbong Rocket Launcher', era: 'marcos', category: 'explosive', rarity: 'rare',
    damage: 45, cooldown: 900, range: 260, speed: 230, mag: 2, reload: 2500, reserve: 16, spread: 4, aoe: 50,
    special: { wobble: true, confetti: true, kazoo: true },
    bullet: 'b_rocket', color: 0xff5fd2, look: { type: 'launcher', color: '#e04fb0', accent: '#ffd400' },
    desc: 'Deliberately absurd satirical launcher. Wobbly rockets, kazoo noises, confetti explosions.', acquire: 'Marcos-era rooms, chests and shops.',
  },
  {
    id: 'm1911', name: 'M1911', era: 'marcos', category: 'pistol', rarity: 'common',
    damage: 12, cooldown: 260, range: 210, speed: 360, mag: 7, reload: 1300, reserve: 84, spread: 3,
    bullet: 'b_small', color: 0xffe08a, look: { type: 'pistol', color: '#555', accent: '#222' },
    desc: 'Dependable semi-automatic pistol.', acquire: 'Marcos-era rooms, chests and shops.',
  },

  // ---- Secret 202X ------------------------------------------------------------------------
  {
    id: 'beretta', name: 'Beretta', era: 'modern', category: 'pistol', rarity: 'common',
    damage: 10, cooldown: 210, range: 220, speed: 380, mag: 15, reload: 1300, reserve: 150, spread: 3,
    bullet: 'b_small', color: 0xb0f0ff, look: { type: 'pistol', color: '#2a2a2a', accent: '#888' },
    desc: 'Modern semi-auto pistol.', acquire: '202X rooms, chests and shops.',
  },
  {
    id: 'barrett', name: 'Barrett', era: 'modern', category: 'rifle', rarity: 'rare',
    damage: 75, cooldown: 1400, range: 460, speed: 700, mag: 5, reload: 2600, reserve: 30, spread: 0, pierce: 4,
    special: { knockback: 140 },
    bullet: 'b_rifle', color: 0xb0f0ff, look: { type: 'rifle', color: '#2a2a2a', accent: '#555', long: true, scope: true },
    desc: 'Enormous damage, pierces four enemies, slow rate of fire.', acquire: '202X rooms, chests and shops.',
  },
  {
    id: 'galil_ace', name: 'IWI Galil ACE', era: 'modern', category: 'auto', rarity: 'common',
    damage: 12, cooldown: 125, range: 290, speed: 480, mag: 30, reload: 1900, reserve: 210, spread: 4,
    bullet: 'b_rifle', color: 0xb0f0ff, look: { type: 'smg', color: '#3a3a30', accent: '#222', long: true },
    desc: 'Balanced damage, rate and accuracy.', acquire: '202X rooms, chests and shops.',
  },
  {
    id: 'balisong', name: 'Butterfly Knife (Balisong)', era: 'modern', category: 'melee', rarity: 'common',
    damage: 8, cooldown: 150, range: 22, melee: { arc: 100, lunge: 5, flip: true },
    color: 0xffffff, look: { type: 'knife', color: '#d8d8d8', accent: '#b07a2a' },
    desc: 'Lightning-fast flicks. Deflects bullets.', acquire: '202X rooms, chests and shops.',
  },
  {
    id: 'mmaw', name: 'MMAW', era: 'modern', category: 'explosive', rarity: 'rare',
    damage: 80, cooldown: 1200, range: 300, speed: 300, mag: 1, reload: 3000, reserve: 10, spread: 0, aoe: 70,
    bullet: 'b_rocket', color: 0xffa040, look: { type: 'launcher', color: '#4a5a3a', accent: '#222' },
    desc: 'Heavy anti-armour rocket. Massive blast, long reload, scarce ammo.', acquire: '202X rooms, chests and shops.',
  },
  {
    id: 'improvised_rpg', name: 'Improvised RPG', era: 'modern', category: 'explosive', rarity: 'rare',
    damage: 50, cooldown: 1000, range: 250, speed: 240, mag: 1, reload: 2000, reserve: 16, spread: 8, aoe: 56,
    special: { wobble: true, split: 3 },
    bullet: 'b_rocket', color: 0xffe14a, look: { type: 'launcher', color: '#8a7a5a', accent: '#c0c0c0', tape: true },
    desc: 'Held together with duct tape. Wobbles, then splits into three mini-rockets.', acquire: '202X rooms, chests and shops.',
  },
];

export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

export function weaponsForEra(eraId) {
  return WEAPONS.filter((w) => w.era === eraId || (w.alsoEras && w.alsoEras.includes(eraId)));
}

// Rough "power" score used for shop prices.
export function weaponPrice(def) {
  if (def.rarity === 'starter') return 6;
  const base = def.rarity === 'rare' ? 24 : 12;
  const dmg = Array.isArray(def.damage) ? (def.damage[0] + def.damage[1]) / 2 : def.damage;
  const dps = (dmg * (def.pellets || 1) * 1000) / def.cooldown;
  const bonus = Math.min(8, Math.round(dps / 25)) + (def.aoe ? 3 : 0);
  return Math.min(def.rarity === 'rare' ? 35 : 18, base + bonus);
}
