// Enemy archetypes + era-specific variants.
//
// Story framing: every hostile is a "Temporal Echo" (or a confused wild animal) spawned by
// the DeVios malfunction, wearing the trappings of the era. They represent arcade threats,
// never a real-world ethnic or national group.
export const ARCHETYPES = {
  grunt: { hp: 24, speed: 46, damage: 3, ai: 'melee', reach: 16, windup: 380, cooldown: 900, shards: [1, 2] },
  shooter: { hp: 18, speed: 36, damage: 2, ai: 'ranged', keepAway: 110, fireEvery: 1900, bulletSpeed: 130, shards: [1, 3] },
  runner: { hp: 12, speed: 88, damage: 2, ai: 'melee', reach: 14, windup: 220, cooldown: 700, shards: [1, 2] },
  armored: { hp: 58, speed: 28, damage: 4, ai: 'melee', reach: 18, windup: 520, cooldown: 1100, armor: 0.4, spreadShot: true, shards: [2, 3] },
  bomber: { hp: 20, speed: 40, damage: 4, ai: 'bomber', keepAway: 90, fireEvery: 2600, aoe: 30, shards: [1, 3] },
};

const L = (o) => o; // readability helper for looks

export const ERA_ENEMIES = {
  lab: {
    grunt: { name: 'Training Drone', look: L({ robot: true, top: '#5d6b7a', top2: '#47e0ff' }) },
    shooter: { name: 'Target Turret', look: L({ robot: true, top: '#7a5d5d', top2: '#ff7a47' }) },
  },
  precolonial: {
    grunt: { name: 'Rogue Sailor Echo', look: L({ skin: '#9fb7c9', hair: '#2b2b2b', top: '#7a5233', top2: '#c7a777', bottom: '#4a3a2a', hat: 'bandana', hatColor: '#8a2a2a', echo: true }) },
    shooter: { name: 'Arquebus Echo', look: L({ skin: '#9fb7c9', hair: '#2b2b2b', top: '#6a6a7a', top2: '#c0c0c0', bottom: '#3a3a4a', hat: 'morion', hatColor: '#b8b8b8', echo: true }) },
    runner: { name: 'Wild Boar', look: L({ beast: 'boar', top: '#4a3a2e', top2: '#d9cbb0' }) },
    armored: { name: 'Halberd Echo', look: L({ skin: '#9fb7c9', hair: '#2b2b2b', top: '#9a9aa8', top2: '#d0d0d8', bottom: '#4a4a5a', hat: 'morion', hatColor: '#d0d0d8', echo: true, build: 'wide' }) },
    bomber: { name: 'Powder Monkey Echo', look: L({ skin: '#9fb7c9', hair: '#2b2b2b', top: '#5a4a3a', top2: '#2a2a2a', bottom: '#4a3a2a', hat: 'bandana', hatColor: '#3a5a8a', echo: true }) },
  },
  spanish: {
    grunt: { name: 'Guardia Echo', look: L({ skin: '#a9b9d9', hair: '#2b2b2b', top: '#2f4a7a', top2: '#e0d090', bottom: '#e9e4d2', hat: 'kepi', hatColor: '#2f4a7a', echo: true }) },
    shooter: { name: 'Rifle Guardia Echo', look: L({ skin: '#a9b9d9', hair: '#2b2b2b', top: '#3a5a8a', top2: '#e0d090', bottom: '#e9e4d2', hat: 'kepi', hatColor: '#3a5a8a', echo: true }) },
    runner: { name: 'Sacristan Echo', look: L({ skin: '#a9b9d9', hair: '#2b2b2b', top: '#1a1a1a', top2: '#ffffff', bottom: '#1a1a1a', echo: true, build: 'slim' }) },
    armored: { name: 'Cuirassier Echo', look: L({ skin: '#a9b9d9', hair: '#2b2b2b', top: '#9aa0b0', top2: '#e0d090', bottom: '#2f4a7a', hat: 'helmet', hatColor: '#c0c4d0', echo: true, build: 'wide' }) },
    bomber: { name: 'Censor Echo', look: L({ skin: '#a9b9d9', hair: '#5a5a5a', top: '#5a3a2a', top2: '#c0a060', bottom: '#5a3a2a', echo: true }) },
  },
  american: {
    grunt: { name: 'Doughboy Echo', look: L({ skin: '#b9c9a9', hair: '#5a4a2a', top: '#5a6a3a', top2: '#c0a060', bottom: '#5a6a3a', hat: 'campaign', hatColor: '#7a6a42', echo: true }) },
    shooter: { name: 'Rifleman Echo', look: L({ skin: '#b9c9a9', hair: '#5a4a2a', top: '#4a5a8a', top2: '#c0a060', bottom: '#4a5a8a', hat: 'campaign', hatColor: '#7a6a42', echo: true }) },
    runner: { name: 'Messenger Echo', look: L({ skin: '#b9c9a9', hair: '#5a4a2a', top: '#7a6a42', top2: '#ffffff', bottom: '#5a4a2a', hat: 'cap', hatColor: '#7a6a42', echo: true, build: 'slim' }) },
    armored: { name: 'Sandbag Brute Echo', look: L({ skin: '#b9c9a9', hair: '#5a4a2a', top: '#7a6a42', top2: '#4a3a1a', bottom: '#5a6a3a', hat: 'helmet', hatColor: '#5a6a3a', echo: true, build: 'wide' }) },
    bomber: { name: 'Mortar Echo', look: L({ skin: '#b9c9a9', hair: '#5a4a2a', top: '#5a6a3a', top2: '#2a2a2a', bottom: '#5a6a3a', hat: 'helmet', hatColor: '#4a5a2a', echo: true }) },
  },
  japanese: {
    grunt: { name: 'Patrol Phantom', look: L({ skin: '#b0b8c0', hair: '#202020', top: '#6b6b4a', top2: '#4a4a3a', bottom: '#6b6b4a', hat: 'cap', hatColor: '#5b5b3a', echo: true }) },
    shooter: { name: 'Rifle Phantom', look: L({ skin: '#b0b8c0', hair: '#202020', top: '#5b5b3a', top2: '#3a3a2a', bottom: '#5b5b3a', hat: 'helmet', hatColor: '#4b4b2a', echo: true }) },
    runner: { name: 'Stray Dog', look: L({ beast: 'dog', top: '#7a6a5a', top2: '#c9b9a0' }) },
    armored: { name: 'Armored Phantom', look: L({ skin: '#b0b8c0', hair: '#202020', top: '#4b4b3a', top2: '#2a2a2a', bottom: '#4b4b3a', hat: 'helmet', hatColor: '#3b3b2a', echo: true, build: 'wide' }) },
    bomber: { name: 'Grenadier Phantom', look: L({ skin: '#b0b8c0', hair: '#202020', top: '#5b5b3a', top2: '#7a2a2a', bottom: '#5b5b3a', hat: 'helmet', hatColor: '#4b4b2a', echo: true }) },
  },
  marcos: {
    grunt: { name: 'Checkpoint Echo', look: L({ skin: '#c9b0a0', hair: '#1a1a1a', top: '#4a5a3a', top2: '#c0c0c0', bottom: '#4a5a3a', hat: 'helmet', hatColor: '#3a4a2a', echo: true }) },
    shooter: { name: 'Riot Rifle Echo', look: L({ skin: '#c9b0a0', hair: '#1a1a1a', top: '#3a4a6a', top2: '#c0c0c0', bottom: '#3a4a6a', hat: 'helmet', hatColor: '#2a3a5a', echo: true }) },
    runner: { name: 'Goon on a Bike Echo', look: L({ skin: '#c9b0a0', hair: '#1a1a1a', top: '#8a2a2a', top2: '#f0f0f0', bottom: '#2a2a2a', echo: true, build: 'slim', hat: 'cap', hatColor: '#222' }) },
    armored: { name: 'Riot Shield Echo', look: L({ skin: '#c9b0a0', hair: '#1a1a1a', top: '#2a3a5a', top2: '#9ab0d0', bottom: '#2a3a5a', hat: 'helmet', hatColor: '#9ab0d0', echo: true, build: 'wide' }) },
    bomber: { name: 'Tear-Gas Echo', look: L({ skin: '#c9b0a0', hair: '#1a1a1a', top: '#4a5a3a', top2: '#9adf6a', bottom: '#4a5a3a', hat: 'helmet', hatColor: '#3a4a2a', echo: true }) },
  },
  modern: {
    grunt: { name: 'Glitch Troll', look: L({ skin: '#c0a0e0', hair: '#202040', top: '#2a2a3a', top2: '#ff4fd8', bottom: '#2a2a3a', echo: true, glitch: true }) },
    shooter: { name: 'Fake-News Drone', look: L({ robot: true, top: '#3a3a5a', top2: '#ff4fd8' }) },
    runner: { name: 'Delivery Rider Echo', look: L({ skin: '#c0a0e0', hair: '#202040', top: '#2fb04a', top2: '#ffffff', bottom: '#2a2a3a', hat: 'helmet', hatColor: '#2fb04a', echo: true, build: 'slim' }) },
    armored: { name: 'Mecha Traffic Enforcer', look: L({ robot: true, top: '#4a4a6a', top2: '#ffd400', big: true }) },
    bomber: { name: 'Spam-Bot Lobber', look: L({ robot: true, top: '#5a2a5a', top2: '#9dff6a' }) },
  },
};

export function enemyDef(eraId, type) {
  const arche = ARCHETYPES[type];
  const variant = (ERA_ENEMIES[eraId] && ERA_ENEMIES[eraId][type]) || ERA_ENEMIES.precolonial[type];
  return { ...arche, ...variant, type, era: eraId, key: `en_${eraId}_${type}` };
}
