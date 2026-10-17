// Weapon behaviour: turns a weapon definition + instance into attacks.
import Phaser from 'phaser';
import { WEAPON_BY_ID } from '../data/weapons.js';
import { METER } from '../config.js';
import { audio } from './audio.js';
import { rand } from './rng.js';

export const ADIOS_CHANCE = 1 / 200;
export const ADIOS_RADIUS = 3 * METER;

const rollDamage = (d) => (Array.isArray(d) ? rand.int(d[0], d[1]) : d);

export function weaponDef(inst) { return WEAPON_BY_ID[inst.id]; }

export function isReloading(inst, now) { return inst._reloadUntil && now < inst._reloadUntil; }

export function canReload(inst) {
  const def = weaponDef(inst);
  if (!def.mag) return false;
  if (inst.ammo >= def.mag) return false;
  if (def.special && def.special.enBloc && inst.ammo > 0) return false; // Garand: only when empty
  return inst.reserve === null || inst.reserve > 0;
}

// Reload completion is polled by Player.update (robust across pauses and weapon swaps).
export function startReload(inst, now) {
  if (!canReload(inst) || isReloading(inst, now)) return false;
  const def = weaponDef(inst);
  inst._reloadUntil = now + def.reload;
  audio.play('reload');
  return true;
}

export function finishReload(inst) {
  const def = weaponDef(inst);
  if (!inst._reloadUntil) return;
  inst._reloadUntil = 0;
  const need = def.mag - inst.ammo;
  const take = inst.reserve === null ? need : Math.min(need, inst.reserve);
  inst.ammo += take;
  if (inst.reserve !== null) inst.reserve -= take;
}

export function ammoText(inst, now) {
  const def = weaponDef(inst);
  if (def.category === 'melee') return 'MELEE';
  if (!def.mag) return 'INK ∞';
  if (isReloading(inst, now)) return 'RELOADING…';
  return `${inst.ammo}/${def.mag}  ${inst.reserve === null ? '∞' : inst.reserve}`;
}

// Attempt to attack. Returns true if an attack happened.
export function tryFire(scene, player, inst, angle, aimPoint) {
  const now = scene.time.now;
  const def = weaponDef(inst);
  if (!def) return false;
  if (inst._cd && now < inst._cd) return false;
  if (isReloading(inst, now)) return false;

  if (def.category === 'melee') {
    inst._cd = now + def.cooldown * player.cooldownMultiplier();
    melee(scene, player, def, angle);
    return true;
  }

  if (def.mag) {
    if (inst.ammo <= 0) {
      if (!startReload(inst, now)) { audio.play('empty', { gap: 200 }); inst._cd = now + 250; }
      return false;
    }
    inst.ammo -= 1;
  }
  inst._cd = now + def.cooldown * player.cooldownMultiplier();

  const muzzle = player.muzzle(angle);
  if (def.special && def.special.literary) {
    literary(scene, player, def, angle, muzzle);
  } else {
    const pellets = def.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const spread = Phaser.Math.DegToRad(def.spread || 0);
      const a = angle + (pellets > 1 ? (i / (pellets - 1) - 0.5) * spread + (rand.next() - 0.5) * spread * 0.2 : (rand.next() - 0.5) * spread);
      let range = def.range;
      if (def.special && def.special.lob && aimPoint) {
        range = Phaser.Math.Clamp(Phaser.Math.Distance.Between(muzzle.x, muzzle.y, aimPoint.x, aimPoint.y), 40, def.range);
      }
      scene.combat.bullet('player', muzzle.x, muzzle.y, a, def.speed, {
        damage: rollDamage(def.damage) * (1 + 0.15 * (inst.level || 0)),
        range: range * (pellets > 1 ? 0.8 + rand.next() * 0.3 : 1),
        texture: def.bullet,
        tint: def.bullet === 'b_rocket' || def.bullet === 'b_shell' ? null : def.color,
        pierce: def.pierce || 0,
        aoe: def.aoe || 0,
        knock: (def.special && def.special.knockback) || 0,
        wobble: def.special && def.special.wobble,
        confetti: def.special && def.special.confetti,
        split: def.special && def.special.split,
        lob: def.special && def.special.lob,
        smoke: def.category === 'explosive',
        big: def.aoe >= 60,
        source: def,
      });
    }
    player.recoil(angle, def.category === 'explosive' ? 3 : def.category === 'rifle' ? 1.5 : 0.6);
    const snd = def.special && def.special.kazoo ? 'kazoo'
      : def.bullet === 'b_energy' ? 'shoot_energy'
        : { pistol: 'shoot_pistol', rifle: 'shoot_rifle', auto: 'shoot_auto', shotgun: 'shoot_shotgun', explosive: 'shoot_explosive' }[def.category] || 'shoot_pistol';
    audio.play(snd, { gap: def.category === 'auto' ? 60 : 30 });
    scene.combat.burst(muzzle.x, muzzle.y, 0xfff0a0, 2, 30, 120);
  }

  if (def.mag && inst.ammo <= 0) {
    if (def.special && def.special.enBloc) audio.play('ping', { gap: 0 });
    startReload(inst, now);
  }
  return true;
}

function literary(scene, player, def, angle, muzzle) {
  const c = scene.combat;
  if (rand.next() < ADIOS_CHANCE || scene.debugForceAdios) {
    scene.debugForceAdios = false;
    miUltimoAdios(scene, player);
    return;
  }
  audio.play('shoot_ink');
  if (rand.next() < 0.6) {
    // El Filibusterismo: three quick ink shots, 4-6 damage each.
    for (let i = -1; i <= 1; i++) {
      c.bullet('player', muzzle.x, muzzle.y, angle + i * 0.12, def.speed, { damage: rand.int(4, 6), range: def.range, texture: 'b_ink', ink: 2, source: def, literary: 'filibusterismo' });
    }
  } else {
    // Noli Me Tangere: a heavy ink blot, 10-15 damage.
    c.bullet('player', muzzle.x, muzzle.y, angle, def.speed * 0.8, { damage: rand.int(10, 15), range: def.range, texture: 'b_ink_big', ink: 5, source: def, literary: 'noli' });
  }
}

// 1-in-200: instantly defeats ordinary enemies within 3 m of Anon. Bosses are immune to the
// instant kill and instead take a flat 40 damage if they are inside the radius.
export function miUltimoAdios(scene, player) {
  const c = scene.combat;
  const { x, y } = player.sprite;
  audio.play('adios', { gap: 0 });
  c.ring(x, y, ADIOS_RADIUS, 0xfff3c0);
  c.ring(x, y, ADIOS_RADIUS * 0.7, 0xc0a0ff);
  c.burst(x, y, 0xfff3c0, 30, ADIOS_RADIUS * 2.5, 700);
  c.shake(0.01, 300);
  const t = scene.add.text(x, y - 30, 'Mi Último Adiós', { fontFamily: 'serif', fontSize: '12px', fontStyle: 'italic', color: '#fff3c0', stroke: '#2a1a4a', strokeThickness: 3 })
    .setOrigin(0.5).setDepth(50).setResolution(4);
  scene.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 1800, onComplete: () => t.destroy() });
  for (const e of scene.enemies.slice()) {
    if (e.dead) continue;
    if (Phaser.Math.Distance.Between(x, y, e.sprite.x, e.sprite.y) > ADIOS_RADIUS + e.radius) continue;
    if (e.isBoss) c.hitEnemy(e, 40, { fixed: true });
    else e.damage(e.hp + 9999, { fixed: true, instakill: true });
  }
  scene.events.emit('adios');
}

function melee(scene, player, def, angle) {
  const c = scene.combat;
  const m = def.melee || { arc: 90, lunge: 4 };
  const arc = Phaser.Math.DegToRad(m.arc);
  const { x, y } = player.sprite;
  player.lunge(angle, m.lunge || 0);
  audio.play('melee');
  c.arc(x, y, def.range, angle, arc, def.color || 0xffffff, m.thrust ? 90 : 140);
  if (m.thrust) c.lightning(x, y, x + Math.cos(angle) * def.range, y + Math.sin(angle) * def.range, def.color || 0xffffff, 90);
  const dmg = rollDamage(def.damage);
  const inst = player.currentInst();
  for (const e of scene.enemies) {
    if (e.dead) continue;
    const d = Phaser.Math.Distance.Between(x, y, e.sprite.x, e.sprite.y);
    if (d > def.range + e.radius) continue;
    const a = Math.atan2(e.sprite.y - y, e.sprite.x - x);
    if (d > e.radius + 4 && Math.abs(Phaser.Math.Angle.Wrap(a - angle)) > arc / 2 + 0.15) continue;
    c.hitEnemy(e, dmg * (1 + 0.15 * (inst.level || 0)), { angle: a, knock: 60, poison: def.special && def.special.poison, source: def });
  }
  // Melee swings destroy enemy bullets inside the arc (Soul Knight-style deflect).
  let deflected = 0;
  c.eBullets.children.each((b) => {
    if (!b.active) return;
    const d = Phaser.Math.Distance.Between(x, y, b.x, b.y);
    if (d > def.range + 6) return;
    const a = Math.atan2(b.y - y, b.x - x);
    if (Math.abs(Phaser.Math.Angle.Wrap(a - angle)) > arc / 2 + 0.2) return;
    b.disableBody(true, true);
    c.burst(b.x, b.y, 0xffffff, 3, 40);
    deflected++;
  });
  if (deflected) audio.play('deflect');
}
