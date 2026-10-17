// Boss framework: phases, telegraphed attack patterns, intro/defeat hooks.
import Phaser from 'phaser';
import { Enemy } from './Enemy.js';
import { DEPTH } from '../config.js';
import { audio } from '../systems/audio.js';
import { rand } from '../systems/rng.js';

const BIG = new Set(['spiral', 'rain', 'radial', 'slam', 'lines', 'summon']);

export class Boss extends Enemy {
  constructor(scene, bossDef, x, y) {
    const def = { ...bossDef, key: `ch_boss_${bossDef.id}`, ai: 'boss', damage: 3 };
    super(scene, def, x, y, {});
    this.isBoss = true;
    this.bossDef = bossDef;
    this.maxHp = Math.round(bossDef.hp * scene.diff.enemyHp);
    this.hp = this.maxHp;
    this.radius = 14;
    this.height = 48;
    scene.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(bossDef.scale);
    this.sprite.body.setSize(12, 10).setOffset(3, 14);
    this.shadow.setScale(2.2);
    this.phase = 0;
    this.busy = false;
    this.active = false; // becomes true after the intro
    this.nextAttack = 0;
    this.lastPattern = null;
    this.spawning = false;
    this.sprite.setAlpha(1);
    this.contactCd = 0;
  }

  begin() { this.active = true; this.nextAttack = this.scene.time.now + 900; }

  currentPhase() {
    const frac = this.hp / this.maxHp;
    const phases = this.bossDef.phases;
    let idx = phases.findIndex((p) => frac > p.until);
    if (idx < 0) idx = phases.length - 1;
    if (idx !== this.phase) {
      this.phase = idx;
      this.scene.onBossPhase(this, idx);
    }
    return phases[this.phase];
  }

  damage(amount, opts = {}) {
    if (!this.active) return 0;
    return super.damage(amount, opts);
  }

  update(dt, now) {
    if (this.dead) return;
    const sp = this.sprite;
    this.shadow.setPosition(sp.x, sp.y + 22);
    sp.setDepth(DEPTH.actor + sp.y * 0.001);
    if (!this.active) { sp.setVelocity(0, 0); return; }
    const player = this.scene.player;
    if (!player || player.dead) { sp.setVelocity(0, 0); return; }
    const ps = player.sprite;
    const dist = Phaser.Math.Distance.Between(sp.x, sp.y, ps.x, ps.y);
    sp.setFlipX(ps.x < sp.x);
    this.animT += dt;
    if (this.animT > 220) { this.animT = 0; sp.setFrame(sp.frame.name === 0 ? 1 : 0); }
    // Contact damage
    if (dist < this.radius + 8 && now > this.contactCd) { this.contactCd = now + 900; player.hurt(2, sp); }
    if (this.charging) return;
    if (!this.busy) {
      // Drift to a comfortable distance
      if (dist > 120) this.moveToward(ps.x, ps.y, this.def.speed);
      else if (dist < 60) this.moveToward(ps.x, ps.y, this.def.speed * 0.7, true);
      else sp.setVelocity(0, 0);
      const phase = this.currentPhase();
      if (now >= this.nextAttack) this.attack(phase, now);
    } else sp.setVelocity(0, 0);
    this.checkStuck(dt, !this.busy && dist > 120);
  }

  attack(phase, now) {
    let options = phase.patterns.filter((p) => p !== this.lastPattern || phase.patterns.length === 1);
    // Duo coordination: if the partner just used a big attack, pick a lighter one.
    const cond = this.scene.bossConductor;
    if (cond && now - cond.lastBig < 1800 && cond.lastBigBy !== this) {
      const light = options.filter((p) => !BIG.has(p.type));
      if (light.length) options = light;
      else { this.nextAttack = now + 600; return; }
    }
    // Limit summons so the arena never floods.
    const minions = this.scene.enemies.filter((e) => !e.dead && !e.isBoss).length;
    if (minions >= 4) options = options.filter((p) => p.type !== 'summon');
    if (!options.length) options = phase.patterns.filter((p) => p.type !== 'summon');
    const pat = rand.pick(options);
    this.lastPattern = pat;
    if (cond && BIG.has(pat.type)) { cond.lastBig = now; cond.lastBigBy = this; }
    this.scene.showAttackName(this, pat.name);
    audio.play('boss_attack', { gap: 100 });
    this.busy = true;
    const done = (extra = 0) => {
      this.busy = false;
      this.nextAttack = this.scene.time.now + (phase.cooldown + extra) * this.scene.diff.bossCooldown;
    };
    const fn = PATTERNS[pat.type];
    if (!fn) { done(); return; }
    fn(this, pat, done);
  }

  // Short wrapper so pattern callbacks never act after death.
  later(ms, fn) { this.scene.time.delayedCall(ms, () => { if (!this.dead) fn(); }); }

  bullet(angle, speed, opts = {}) {
    if (this.dead) return;
    this.scene.combat.bullet('enemy', this.x, this.y, angle, speed * this.scene.diff.bulletSpeed, { damage: 3, range: 420, tint: this.bossDef.bulletColor, texture: opts.big ? 'b_enemy_big' : 'b_enemy', ...opts });
  }

  aimAt() { const ps = this.scene.player.sprite; return Math.atan2(ps.y - this.y, ps.x - this.x); }

  tele() { return this.scene.diff.telegraph; }
}

const PATTERNS = {
  radial(b, p, done) {
    b.sprite.setTint(0xffd0a0);
    b.later(450 * b.tele(), () => {
      b.sprite.clearTint();
      const off = rand.next() * Math.PI;
      for (let i = 0; i < p.count; i++) b.bullet(off + (i / p.count) * Math.PI * 2, p.speed);
      b.later(350, () => { for (let i = 0; i < p.count; i++) b.bullet(off + ((i + 0.5) / p.count) * Math.PI * 2, p.speed * 0.85); done(); });
    });
  },
  spiral(b, p, done) {
    let t = 0;
    const base = rand.next() * Math.PI * 2;
    const ev = b.scene.time.addEvent({
      delay: p.rate, loop: true, callback: () => {
        if (b.dead) { ev.remove(); return; }
        t += p.rate;
        for (let k = 0; k < p.arms; k++) b.bullet(base + t / 300 + (k / p.arms) * Math.PI * 2, p.speed);
        if (t >= p.duration) { ev.remove(); done(); }
      },
    });
  },
  aimed(b, p, done) {
    let n = 0;
    const ev = b.scene.time.addEvent({
      delay: p.interval, repeat: p.count - 1, callback: () => {
        if (b.dead) { ev.remove(); return; }
        b.bullet(b.aimAt() + (rand.next() - 0.5) * 0.12, p.speed);
        if (++n >= p.count) done();
      },
    });
  },
  spread(b, p, done) {
    const arc = Phaser.Math.DegToRad(p.arc);
    b.sprite.setTint(0xffd0a0);
    b.later(380 * b.tele(), () => {
      b.sprite.clearTint();
      const a0 = b.aimAt();
      for (let i = 0; i < p.count; i++) b.bullet(a0 - arc / 2 + (arc * i) / (p.count - 1), p.speed);
      b.later(420, () => {
        const a1 = b.aimAt();
        for (let i = 0; i < p.count - 1; i++) b.bullet(a1 - arc / 2 + (arc * (i + 0.5)) / (p.count - 1), p.speed * 0.9);
        done();
      });
    });
  },
  charge(b, p, done) {
    const ps = b.scene.player.sprite;
    const a = b.aimAt();
    const len = Math.min(220, Phaser.Math.Distance.Between(b.x, b.y, ps.x, ps.y) + 60);
    const geo = { x1: b.x, y1: b.y, x2: b.x + Math.cos(a) * len, y2: b.y + Math.sin(a) * len, w: 26 };
    b.scene.combat.telegraph('line', geo, 750 * b.tele(), () => {
      if (b.dead) return;
      b.charging = true;
      b.sprite.setVelocity(Math.cos(a) * p.speed, Math.sin(a) * p.speed);
      let hit = false;
      const dur = (len / p.speed) * 1000;
      const ev = b.scene.time.addEvent({
        delay: 30, loop: true, callback: () => {
          if (b.dead) { ev.remove(); return; }
          if (!hit && Phaser.Math.Distance.Between(b.x, b.y, ps.x, ps.y) < b.radius + 10) { hit = true; b.scene.player.hurt(p.damage, b.sprite); }
          b.scene.combat.burst(b.x, b.y + 16, 0xd0c0a0, 1, 20, 200);
          const bl = b.sprite.body.blocked;
          if (bl.left || bl.right || bl.up || bl.down) b.sprite.setVelocity(0, 0);
        },
      });
      b.later(dur, () => { ev.remove(); b.charging = false; b.sprite.setVelocity(0, 0); done(200); });
      b.scene.time.delayedCall(dur + 50, () => { ev.remove(); b.charging = false; });
    });
  },
  slam(b, p, done) {
    b.scene.combat.telegraph('circle', { x: b.x, y: b.y, r: p.radius }, 900 * b.tele(), () => {
      if (b.dead) return;
      b.scene.combat.ring(b.x, b.y, p.radius, 0xffa040);
      b.scene.combat.shake(0.01, 200);
      audio.play('explosion', { gap: 0 });
      if (b.scene.combat.playerInCircle(b.x, b.y, p.radius)) b.scene.player.hurt(p.damage, b.sprite);
      if (p.ring) for (let i = 0; i < p.ring; i++) b.bullet((i / p.ring) * Math.PI * 2, 100);
      done();
    });
  },
  rain(b, p, done) {
    const ps = b.scene.player.sprite;
    const ms = 1000 * b.tele();
    for (let i = 0; i < p.count; i++) {
      const tx = ps.x + (i === 0 ? 0 : (rand.next() - 0.5) * 150);
      const ty = ps.y + (i === 0 ? 0 : (rand.next() - 0.5) * 110);
      b.later(i * 120, () => {
        b.scene.combat.telegraph('circle', { x: tx, y: ty, r: p.radius }, ms, () => {
          if (b.dead) return;
          b.scene.combat.ring(tx, ty, p.radius, b.bossDef.bulletColor);
          b.scene.combat.burst(tx, ty, b.bossDef.bulletColor, 6, 80);
          audio.play('explosion', { gap: 60 });
          if (b.scene.combat.playerInCircle(tx, ty, p.radius)) b.scene.player.hurt(p.damage, { x: tx, y: ty });
        }, b.bossDef.bulletColor);
      });
    }
    b.later(p.count * 120 + ms, () => done());
  },
  sweep(b, p, done) {
    // Close the gap a bit first.
    const a = b.aimAt();
    const arc = Phaser.Math.DegToRad(p.arc);
    const geo = { x: b.x, y: b.y, r: p.radius, angle: a, arc };
    b.scene.combat.telegraph('cone', geo, 650 * b.tele(), () => {
      if (b.dead) return;
      b.scene.combat.arc(geo.x, geo.y, p.radius, a, arc, 0xffffff, 160);
      audio.play('melee', { gap: 0 });
      if (b.scene.combat.playerInCone(geo)) b.scene.player.hurt(p.damage, b.sprite);
      done();
    });
  },
  lines(b, p, done) {
    const ps = b.scene.player.sprite;
    const ms = 900 * b.tele();
    const base = Math.atan2(ps.y - b.y, ps.x - b.x);
    for (let i = 0; i < p.count; i++) {
      const a = base + (i - (p.count - 1) / 2) * 0.55;
      const geo = { x1: b.x, y1: b.y, x2: b.x + Math.cos(a) * 320, y2: b.y + Math.sin(a) * 320, w: 18 };
      b.scene.combat.telegraph('line', geo, ms, () => {
        if (b.dead) return;
        b.scene.combat.lightning(geo.x1, geo.y1, geo.x2, geo.y2, b.bossDef.bulletColor, 200);
        if (b.scene.combat.playerInLine(geo)) b.scene.player.hurt(p.damage, b.sprite);
      }, b.bossDef.bulletColor);
    }
    b.later(ms + 100, () => done());
  },
  summon(b, p, done) {
    for (let i = 0; i < p.count; i++) b.scene.spawnMinion(p.type2 || 'grunt', b);
    done(400);
  },
  blink(b, p, done) {
    b.sprite.setAlpha(0.3);
    b.scene.combat.burst(b.x, b.y, 0xc080ff, 12, 80);
    b.later(350, () => {
      const pt = b.scene.safeSpawnPoint(b, 90);
      b.sprite.setPosition(pt.x, pt.y);
      b.sprite.setAlpha(1);
      b.scene.combat.burst(b.x, b.y, 0xc080ff, 12, 80);
      // Follow-up shots so the blink is a real attack.
      const a = b.aimAt();
      for (let i = -2; i <= 2; i++) b.bullet(a + i * 0.2, 130);
      done(-300);
    });
  },
};
