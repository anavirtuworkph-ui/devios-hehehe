// Global tuning constants shared by every module.
export const TILE = 16;
// One in-game "meter". Used for radius rules such as Mi Último Adiós (3 m).
export const METER = 24;
// Minimum world area (in world pixels) the camera should show.
export const VIEW_W = 420;
export const VIEW_H = 250;
export const MAX_DPR = 2;

export const DEPTH = {
  floor: 0,
  decal: 2,
  telegraph: 3,
  pickup: 4,
  prop: 5,
  actor: 10,
  bullet: 20,
  fx: 30,
  text: 40,
};

export const DIFFICULTY = {
  easy: {
    label: 'Easy',
    enemyHp: 0.75,
    enemyDmg: 0.7,
    enemyCount: 0.75,
    waves: 1,
    healDrop: 0.16,
    bossCooldown: 1.35,
    telegraph: 1.4,
    bulletSpeed: 0.8,
    playerHp: 24,
  },
  normal: {
    label: 'Normal',
    enemyHp: 1,
    enemyDmg: 1,
    enemyCount: 1,
    waves: 2,
    healDrop: 0.08,
    bossCooldown: 1,
    telegraph: 1,
    bulletSpeed: 1,
    playerHp: 20,
  },
  // Hard: Soul Knight-style full floors (see systems/dungeon.js) plus tougher stats.
  hard: {
    label: 'Hard',
    enemyHp: 1.3,
    enemyDmg: 1.3,
    enemyCount: 1.15,
    waves: 2,
    healDrop: 0.06,
    bossCooldown: 0.8,
    telegraph: 0.85,
    bulletSpeed: 1.15,
    playerHp: 18,
  },
};
