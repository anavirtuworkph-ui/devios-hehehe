// Reusable enemy AI framework: melee chasers, ranged shooters, bombers; elites and statuses.
import Phaser from 'phaser';
import { DEPTH } from '../config.js';
import { audio } from '../systems/audio.js';
import { rand } from '../systems/rng.js';

let NEXT_ID = 1;

export class Enemy {
  constructor(scene, def, x, y, opts = {}) {
    this.scene = scene;
    this.def = def;
    this.id = NEXT_ID++;
    this.elite = !!opts.elite;
    this.isBoss = false;
    const diff = scene.diff;
    const mult = (this.elite ? 2.2 : 1) * (opts.stronger ? 1.3 : 1);
    this.maxHp = Math.round(def.hp * diff.enemyHp * mult);
    this.hp = this.maxHp;
    this.dmgMult = opts.stronger ? 1.25 : 1;
    this.radius = this.elite ? 9 : 7;
    this.height = this.elite ? 30 : 24;
    this.sprite = scene.physics.add.sprite(x, y, def.key, 0).setDepth(DEPTH.actor);
    this.sprite.body.setSize(10, 8).setOffset(4, 16);
    this.sprite.enemy = this;
    if (this.elite) this.sprite.setScale(1.3);
    this.shadow = scene.add.image(x, y + 10, 'shadow').setDepth(DEPTH.actor - 1).setScale(this.elite ? 1.3 : 1);
    if (this.elite) {
      this.aura = scene.add.ellipse(x, y + 10, 22, 8, 0xffd400, 0.35).setDepth(DEPTH.actor - 1);
    }
    this.dead = false;
    this.spawning = true;
    this.state = 'chase';
    this.stateT = 0;
    this.nextAttack = scene.time.now + 800 + rand.next() * 900;
    this.status = { poisonUntil: 0, poisonDps: 0, poisonTick: 0, slowUntil: 0, slow: 1, stunUntil: 0 };
    this.detour = null;
    this.stuck = { x, y, t: 0, n: 0 };
    this.animT = 0;
    this.knock = null;
    // Spawn-in: portal shimmer, invulnerable and harmless until it finishes.
    this.sprite.setAlpha(0).setScale(this.elite ? 0.4 : 0.3);
    const portal = scene.add.image(x, y + 4, 'portal').setDepth(DEPTH.decal).setAlpha(0.9);
    scene.tweens.add({ targets: portal, angle: 360, alpha: 0, scale: 1.6, duration: 650, onComplete: () => portal.destroy() });
    scene.tweens.add({
      targets: this.sprite, alpha: 1, scale: this.elite ? 1.3 : 1, duration: 600,
      onComplete: () => { this.spawning = false; },
    });
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }

  damage(amount, opts = {}) {
    if (this.dead || this.spawning) return 0;
    let dmg = amount;
    if (this.def.armor && !opts.fixed && !opts.aoe) dmg *= 1 - this.def.armor;
    dmg = Math.max(0.5, dmg);
    this.hp -= dmg;
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => { if (this.sprite.active) this.sprite.clearTint(); });
    const now = this.scene.time.now;
    if (opts.knock && opts.angle !== undefined && !this.isBoss) {
      const k = opts.knock * (this.elite ? 0.4 : 1);
      this.knock = { x: Math.cos(opts.angle) * k, y: Math.sin(opts.angle) * k, until: now + 90 };
    }
    if (opts.poison) { this.status.poisonUntil = now + opts.poison.duration; this.status.poisonDps = opts.poison.dps; this.sprite.setTint(0x7dff4a); }
    if (opts.slow) { this.status.slowUntil = now + 2500; this.status.slow = opts.slow; }
    if (opts.stun && !this.isBoss) this.status.stunUntil = now + opts.stun;
    this.scene.combat.burst(this.x, this.y, 0xff4040, 2, 40, 250);
    if (this.hp <= 0) this.die(opts);
    return dmg;
  }

  die(opts = {}) {
    if (this.dead) return;
    this.dead = true;
    this.sprite.body.enable = false;
    this.sprite.setVelocity(0, 0);
    audio.play('enemy_die', { gap: 40 });
    this.scene.combat.burst(this.x, this.y, this.elite ? 0xffd400 : 0x9ff6ff, 10, 80, 500);
    if (opts.instakill) this.scene.combat.burst(this.x, this.y, 0xfff3c0, 10, 60, 700);
    this.scene.tweens.add({
      targets: this.sprite, alpha: 0, scaleX: 1.6, scaleY: 0.2, angle: rand.pick([-25, 25]), duration: 320,
      onComplete: () => this.destroy(),
    });
    this.shadow.setVisible(false);
    if (this.aura) this.aura.setVisible(false);
    this.scene.onEnemyKilled(this);
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
    if (this.aura) this.aura.destroy();
  }

  // ---- movement helpers -------------------------------------------------------------------------
  moveToward(tx, ty, speed, away = false) {
    const sp = this.sprite;
    let a = Math.atan2(ty - sp.y, tx - sp.x);
    if (away) a += Math.PI;
    const now = this.scene.time.now;
    const b = sp.body.blocked;
    if ((b.left || b.right || b.up || b.down) && (!this.detour || now > this.detour.until)) {
      this.detour = { a: a + (rand.chance(0.5) ? 1 : -1) * (Math.PI / 2), until: now + 380 };
    }
    if (this.detour && now < this.detour.until) a = this.detour.a;
    sp.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
  }

  speed() {
    const now = this.scene.time.now;
    return this.def.speed * (now < this.status.slowUntil ? this.status.slow : 1);
  }

  // Safety net: an enemy that hasn't moved for ~4s while trying to, or is outside the room,
  // is relocated so rooms can always be completed.
  checkStuck(dt, wantsToMove) {
    this.stuck.t += dt;
    if (this.stuck.t < 1000) return;
    this.stuck.t = 0;
    const moved = Phaser.Math.Distance.Between(this.stuck.x, this.stuck.y, this.x, this.y);
    this.stuck.x = this.x; this.stuck.y = this.y;
    if (wantsToMove && moved < 3) this.stuck.n++; else this.stuck.n = 0;
    const out = !this.scene.inRoomBounds(this.x, this.y);
    if (this.stuck.n >= 4 || out) {
      const p = this.scene.safeSpawnPoint(this);
      this.sprite.setPosition(p.x, p.y);
      this.stuck.n = 0;
    }
  }

  update(dt, now) {
    if (this.dead) return;
    const sp = this.sprite;
    this.shadow.setPosition(sp.x, sp.y + 11 * (this.elite ? 1.3 : 1));
    if (this.aura) this.aura.setPosition(sp.x, sp.y + 12);
    sp.setDepth(DEPTH.actor + sp.y * 0.001);
    // Poison ticks
    if (now < this.status.poisonUntil) {
      this.status.poisonTick += dt;
      if (this.status.poisonTick >= 500) {
        this.status.poisonTick = 0;
        this.scene.combat.hitEnemy(this, this.status.poisonDps / 2, { fixed: true });
        if (this.dead) return;
      }
    } else if (this.status.poisonUntil) { this.status.poisonUntil = 0; sp.clearTint(); }
    if (this.spawning) { sp.setVelocity(0, 0); return; }
    if (this.knock && now < this.knock.until) { sp.setVelocity(this.knock.x, this.knock.y); return; }
    if (now < this.status.stunUntil) { sp.setVelocity(0, 0); return; }
    const player = this.scene.player;
    if (!player || player.dead) { sp.setVelocity(0, 0); return; }
    this.think(dt, now, player);
    // Walk animation
    this.animT += dt;
    if (this.animT > 180) { this.animT = 0; sp.setFrame(sp.frame.name === 0 ? 1 : 0); }
    sp.setFlipX(player.sprite.x < sp.x);
  }

  think(dt, now, player) {
    const sp = this.sprite;
    const d = this.def;
    const ps = player.sprite;
    const dist = Phaser.Math.Distance.Between(sp.x, sp.y, ps.x, ps.y);
    let moving = false;
    if (this.state === 'windup') {
      sp.setVelocity(0, 0);
      if (now >= this.stateT) this.strike(player);
      return;
    }
    if (d.ai === 'melee') {
      if (dist <= d.reach + this.radius + 4 && now >= this.nextAttack) {
        this.state = 'windup';
        this.stateT = now + d.windup * this.scene.diff.telegraph;
        sp.setTint(0xff8080);
        this.windAngle = Math.atan2(ps.y - sp.y, ps.x - sp.x);
        this.scene.combat.telegraph('cone', { x: sp.x, y: sp.y, r: d.reach + 12, angle: this.windAngle, arc: 1.4 }, d.windup * this.scene.diff.telegraph, null, 0xff6060);
        return;
      }
      if (d.spreadShot && now >= this.nextAttack && dist > 70 && dist < 200 && rand.chance(0.01)) { this.shoot(player, 3); this.nextAttack = now + 2200; }
      if (dist > d.reach + this.radius) { this.moveToward(ps.x, ps.y, this.speed()); moving = true; } else sp.setVelocity(0, 0);
    } else {
      const keep = d.keepAway || 100;
      if (dist > keep + 30) { this.moveToward(ps.x, ps.y, this.speed()); moving = true; }
      else if (dist < keep - 30) { this.moveToward(ps.x, ps.y, this.speed() * 0.8, true); moving = true; }
      else {
        // strafe
        const a = Math.atan2(ps.y - sp.y, ps.x - sp.x) + Math.PI / 2 * (this.id % 2 ? 1 : -1);
        sp.setVelocity(Math.cos(a) * this.speed() * 0.5, Math.sin(a) * this.speed() * 0.5);
        moving = true;
      }
      if (now >= this.nextAttack && dist < 260) {
        this.nextAttack = now + d.fireEvery * (0.8 + rand.next() * 0.5) / (this.elite ? 1.3 : 1);
        if (d.ai === 'bomber') this.lob(player); else this.shoot(player, this.elite ? 3 : 1);
      }
    }
    this.checkStuck(dt, moving);
  }

  strike(player) {
    const d = this.def;
    this.state = 'chase';
    this.sprite.clearTint();
    this.nextAttack = this.scene.time.now + d.cooldown;
    if (this.dead) return;
    const ps = player.sprite;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, ps.x, ps.y);
    const a = Math.atan2(ps.y - this.y, ps.x - this.x);
    this.scene.combat.arc(this.x, this.y, d.reach + 8, this.windAngle, 1.4, 0xff6060, 120);
    if (dist <= d.reach + this.radius + 10 && Math.abs(Phaser.Math.Angle.Wrap(a - this.windAngle)) < 1.0) player.hurt(d.damage * this.dmgMult, this.sprite);
  }

  shoot(player, n = 1) {
    if (this.dead) return;
    const ps = player.sprite;
    const base = Math.atan2(ps.y - this.y, ps.x - this.x);
    const spd = (this.def.bulletSpeed || 130) * this.scene.diff.bulletSpeed;
    for (let i = 0; i < n; i++) {
      const a = base + (n > 1 ? (i - (n - 1) / 2) * 0.22 : 0);
      this.scene.combat.bullet('enemy', this.x, this.y, a, spd, { damage: this.def.damage * this.dmgMult, range: 300 });
    }
    audio.play('shoot_pistol', { gap: 80 });
  }

  lob(player) {
    if (this.dead) return;
    const ps = player.sprite;
    const tx = ps.x + (rand.next() - 0.5) * 20, ty = ps.y + (rand.next() - 0.5) * 20;
    const ms = 950 * this.scene.diff.telegraph;
    const g = this.scene.add.image(this.x, this.y, 'b_grenade').setDepth(DEPTH.bullet);
    this.scene.tweens.add({ targets: g, x: tx, y: ty, duration: ms * 0.9, ease: 'Sine.easeOut', onComplete: () => g.destroy() });
    this.scene.tweens.add({ targets: g, scale: 1.8, yoyo: true, duration: ms * 0.45 });
    const r = this.def.aoe || 30;
    const dmg = this.def.damage * this.dmgMult;
    this.scene.combat.telegraph('circle', { x: tx, y: ty, r }, ms, () => {
      if (this.dead) { this.scene.combat.burst(tx, ty, 0x888888, 4, 30); return; } // fizzles if the thrower died
      this.scene.combat.ring(tx, ty, r, 0xffa040);
      this.scene.combat.burst(tx, ty, 0xffa040, 8, 90);
      audio.play('explosion', { gap: 80 });
      if (this.scene.combat.playerInCircle(tx, ty, r)) this.scene.player.hurt(dmg, { x: tx, y: ty });
    }, 0xffa040);
  }
}
