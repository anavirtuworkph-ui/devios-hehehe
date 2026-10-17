// Anon, the player character. Reads abstract actions from the shared input layer.
import Phaser from 'phaser';
import { DEPTH } from '../config.js';
import { input } from '../systems/input.js';
import { audio } from '../systems/audio.js';
import { tryFire, weaponDef, startReload, finishReload, isReloading } from '../systems/weapons.js';
import { maxHpFor } from '../systems/run.js';

const SPEED = 96;
const DODGE_SPEED = 240;
const DODGE_TIME = 190;
const DODGE_IFRAMES = 280;
const HURT_IFRAMES = 850;
export const ITEMS = [
  { key: 'bomb', label: 'Chrono Bomb' },
  { key: 'patch', label: 'Med Patch' },
  { key: 'shield', label: 'Shield Bubble' },
];

export class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.run = scene.run;
    this.save = scene.save.data;
    this.sprite = scene.physics.add.sprite(x, y, 'ch_anon', 0).setDepth(DEPTH.actor);
    this.sprite.body.setSize(8, 6).setOffset(5, 18);
    this.sprite.setCollideWorldBounds(false);
    this.shadow = scene.add.image(x, y + 10, 'shadow').setDepth(DEPTH.actor - 1);
    this.gun = scene.add.image(x, y, 'w_chrono_pistol').setOrigin(0.28, 0.5).setDepth(DEPTH.actor + 1);
    this.reticle = scene.add.image(x, y, 'reticle').setDepth(DEPTH.fx).setAlpha(0.8);
    this.blast = scene.add.circle(0, 0, 10, 0xffa040, 0.15).setStrokeStyle(1, 0xffa040, 0.8).setDepth(DEPTH.telegraph).setVisible(false);
    this.maxHp = maxHpFor(this.run, this.save);
    this.hp = this.run.hp > 0 ? Math.min(this.run.hp, this.maxHp) : this.maxHp;
    this.invulnUntil = 0;
    this.dodgeUntil = 0;
    this.dodgeReadyAt = 0;
    this.dodgeDir = { x: 1, y: 0 };
    this.aim = 0;
    this.facing = 1;
    this.buffs = [];
    this.itemIndex = 0;
    this.shieldUntil = 0;
    this.dead = false;
    this.firingSlow = 1;
    this.animT = 0;
    this.lungeV = null;
    this.frozen = false;
    this.refreshWeapon();
  }

  currentInst() { return this.run.loadout[this.run.current]; }
  currentDef() { return weaponDef(this.currentInst()); }

  refreshWeapon() {
    const def = this.currentDef();
    this.gun.setTexture(`w_${def.id}`);
    this.scene.events.emit('hud-dirty');
  }

  switchTo(i) {
    if (i < 0 || i >= this.run.loadout.length || i === this.run.current) return;
    this.run.current = i;
    audio.play('select', { gap: 0 });
    this.refreshWeapon();
  }

  cycleWeapon(dir = 1) {
    const n = this.run.loadout.length;
    this.switchTo((this.run.current + dir + n) % n);
  }

  // ---- stats --------------------------------------------------------------------------------
  buffValue(type) { return this.buffs.filter((b) => b.type === type).reduce((s, b) => s + b.value, 0); }

  damageMultiplier() {
    let m = 1 + 0.1 * this.run.upgrades.damage + this.buffValue('damage');
    if (this.scene.ally && this.scene.ally.buffsPlayer()) m += 0.15;
    return Math.max(0.2, m);
  }

  critChance() { return 0.05 + this.buffValue('crit'); }

  cooldownMultiplier() { return 1; }

  speed() {
    return SPEED * (1 + this.buffValue('speed')) * this.firingSlow;
  }

  addBuff(type, value, duration, label, bad = false) {
    const names = { damage: 'DMG', speed: 'SPD', crit: 'CRIT', defenseDown: 'DEF↓', slow: 'SLOW' };
    const now = this.scene.time.now;
    this.buffs = this.buffs.filter((b) => !(b.type === type && b.label === (label || names[type])));
    this.buffs.push({ type, value, until: now + duration, label: label || `${names[type] || type} ${value > 0 ? '+' : ''}${Math.round(value * 100)}%`, bad });
    this.scene.events.emit('hud-dirty');
  }

  heal(n) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    if (this.hp > before) {
      audio.play('heal');
      this.scene.combat.floatText(this.sprite.x, this.sprite.y - 14, `+${Math.round(this.hp - before)}`, '#5fff8a');
    }
    this.scene.events.emit('hud-dirty');
    return this.hp - before;
  }

  hurt(amount, src) {
    const now = this.scene.time.now;
    if (this.dead || this.scene.safeMode || now < this.invulnUntil || now < this.shieldUntil || this.frozen) return false;
    const diff = this.scene.diff;
    let dmg = amount * diff.enemyDmg * (1 - 0.1 * this.run.upgrades.armor);
    if (this.buffs.some((b) => b.type === 'defenseDown')) dmg *= 1.25;
    dmg = Math.max(1, Math.round(dmg));
    this.hp -= dmg;
    this.invulnUntil = now + HURT_IFRAMES;
    audio.play('hurt', { gap: 0 });
    this.scene.combat.shake(0.008, 140);
    this.scene.combat.floatText(this.sprite.x, this.sprite.y - 14, `-${dmg}`, '#ff5a6a', true);
    this.sprite.setTint(0xff4a4a);
    this.scene.time.delayedCall(120, () => this.sprite.active && this.sprite.clearTint());
    if (src) {
      const a = Math.atan2(this.sprite.y - src.y, this.sprite.x - src.x);
      this.lungeV = { x: Math.cos(a) * 140, y: Math.sin(a) * 140, until: now + 90 };
    }
    this.scene.events.emit('hud-dirty');
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.sprite.setVelocity(0, 0);
      this.scene.onPlayerDeath();
    }
    return true;
  }

  muzzle(angle) {
    return { x: this.sprite.x + Math.cos(angle) * 12, y: this.sprite.y + 2 + Math.sin(angle) * 12 };
  }

  recoil(angle, amt) {
    this.gun.x -= Math.cos(angle) * amt;
    this.gun.y -= Math.sin(angle) * amt;
  }

  lunge(angle, dist) {
    if (!dist) return;
    this.lungeV = { x: Math.cos(angle) * dist * 10, y: Math.sin(angle) * dist * 10, until: this.scene.time.now + 100 };
  }

  useItem() {
    const it = ITEMS[this.itemIndex];
    const c = this.run.consumables;
    if (!it || c[it.key] <= 0) {
      const next = ITEMS.findIndex((x) => c[x.key] > 0);
      if (next < 0) { audio.play('deny'); return; }
      this.itemIndex = next;
      return this.useItem();
    }
    if (it.key === 'patch' && this.hp >= this.maxHp) { this.scene.toast('Already at full health.'); return; }
    c[it.key] -= 1;
    if (it.key === 'bomb') {
      const { x, y } = this.sprite;
      this.scene.combat.ring(x, y, 110, 0x7ff6ff);
      this.scene.combat.burst(x, y, 0x7ff6ff, 24, 200);
      audio.play('explosion', { gap: 0 });
      for (const e of this.scene.enemies) if (!e.dead && Phaser.Math.Distance.Between(x, y, e.sprite.x, e.sprite.y) < 110) this.scene.combat.hitEnemy(e, 40, { fixed: true });
      this.scene.combat.clearEnemyBullets();
    } else if (it.key === 'patch') {
      this.heal(8);
    } else if (it.key === 'shield') {
      this.shieldUntil = this.scene.time.now + 5000;
      audio.play('pickup');
    }
    this.scene.events.emit('hud-dirty');
  }

  // ---- per-frame -------------------------------------------------------------------------------
  update(dt, now) {
    if (this.dead) return;
    const sp = this.sprite;
    // Expire buffs
    const nb = this.buffs.length;
    this.buffs = this.buffs.filter((b) => b.until > now);
    if (nb !== this.buffs.length) this.scene.events.emit('hud-dirty');
    for (const inst of this.run.loadout) if (inst._reloadUntil && now >= inst._reloadUntil) { finishReload(inst); this.scene.events.emit('hud-dirty'); }

    const mv = this.frozen ? { x: 0, y: 0 } : input.getMove();
    // Weapon switching / items / reload
    if (!this.frozen) {
      if (input.consume('swap')) this.cycleWeapon(1);
      if (input.wheel) { this.cycleWeapon(input.wheel > 0 ? 1 : -1); input.wheel = 0; }
      for (let i = 1; i <= 4; i++) if (input.consume(`slot${i}`)) this.switchTo(i - 1);
      if (input.consume('reload')) startReload(this.currentInst(), now);
      if (input.consume('cycleItem')) { this.itemIndex = (this.itemIndex + 1) % ITEMS.length; this.scene.events.emit('hud-dirty'); }
      if (input.consume('item')) this.useItem();
    }

    // Aim
    const aimPoint = this.scene.getAimPoint(this);
    if (aimPoint) this.aim = Math.atan2(aimPoint.y - sp.y, aimPoint.x - sp.x);
    else if (mv.x || mv.y) this.aim = Math.atan2(mv.y, mv.x);
    this.facing = Math.cos(this.aim) < 0 ? -1 : 1;

    // Dodge
    if (!this.frozen && input.consume('dodge') && now >= this.dodgeReadyAt) {
      const d = mv.x || mv.y ? mv : { x: Math.cos(this.aim), y: Math.sin(this.aim) };
      const l = Math.hypot(d.x, d.y) || 1;
      this.dodgeDir = { x: d.x / l, y: d.y / l };
      this.dodgeUntil = now + DODGE_TIME;
      this.invulnUntil = Math.max(this.invulnUntil, now + DODGE_IFRAMES);
      this.dodgeReadyAt = now + 800 * (1 - 0.2 * this.run.upgrades.dodge);
      audio.play('dodge', { gap: 0 });
      this.scene.events.emit('dodged');
    }

    // Firing
    const def = this.currentDef();
    let firing = false;
    if (!this.frozen && input.isFiring() && !this.scene.safeMode) {
      firing = tryFire(this.scene, this, this.currentInst(), this.aim, aimPoint) || (def.special && def.special.moveSlow && def.mag && this.currentInst().ammo > 0);
      if (firing) this.scene.events.emit('fired', def);
    }
    const slow = def.special && def.special.moveSlow;
    this.firingSlow = input.isFiring() && slow ? slow : 1;

    // Movement
    if (now < this.dodgeUntil) {
      sp.setVelocity(this.dodgeDir.x * DODGE_SPEED, this.dodgeDir.y * DODGE_SPEED);
      if (Math.random() < 0.5) this.scene.combat.burst(sp.x, sp.y + 8, 0x7ff6ff, 1, 20, 250);
    } else if (this.lungeV && now < this.lungeV.until) {
      sp.setVelocity(this.lungeV.x + mv.x * 30, this.lungeV.y + mv.y * 30);
    } else {
      const s = this.speed();
      sp.setVelocity(mv.x * s, mv.y * s);
    }
    const moving = mv.x || mv.y;
    this.animT += dt;
    if (moving && this.animT > 160) { this.animT = 0; sp.setFrame(sp.frame.name === 0 ? 1 : 0); }
    if (!moving) sp.setFrame(0);
    sp.setFlipX(this.facing < 0);
    // Blink while invulnerable after damage
    const inv = now < this.invulnUntil && now >= this.dodgeUntil;
    sp.setAlpha(inv ? (Math.floor(now / 70) % 2 ? 0.35 : 1) : 1);
    if (now < this.shieldUntil) sp.setTint(0x9ff6ff); else if (!sp.isTinted || sp.tintTopLeft === 0x9ff6ff) sp.clearTint();
    sp.setDepth(DEPTH.actor + sp.y * 0.001);

    // Attachments
    this.shadow.setPosition(sp.x, sp.y + 11);
    const gx = sp.x + Math.cos(this.aim) * 4, gy = sp.y + 4 + Math.sin(this.aim) * 3;
    this.gun.x += (gx - this.gun.x) * 0.5;
    this.gun.y += (gy - this.gun.y) * 0.5;
    this.gun.setRotation(this.aim).setFlipY(this.facing < 0).setDepth(sp.depth + (Math.sin(this.aim) > 0 ? 0.01 : -0.01));
    this.gun.setVisible(!this.scene.safeMode || this.scene.mode === 'tutorial');
    const showRet = !!aimPoint && !this.scene.safeMode && input.lastDevice === 'mouse';
    this.reticle.setVisible(showRet);
    if (aimPoint) this.reticle.setPosition(aimPoint.x, aimPoint.y);
    if (def.special && def.special.showBlast && aimPoint && !this.scene.safeMode) {
      const dist = Phaser.Math.Clamp(Phaser.Math.Distance.Between(sp.x, sp.y, aimPoint.x, aimPoint.y), 40, def.range);
      this.blast.setPosition(sp.x + Math.cos(this.aim) * dist, sp.y + Math.sin(this.aim) * dist).setRadius(def.aoe).setVisible(true);
    } else this.blast.setVisible(false);
    this.reloading = isReloading(this.currentInst(), now);
  }

  destroy() {
    [this.sprite, this.shadow, this.gun, this.reticle, this.blast].forEach((o) => o.destroy());
  }
}
