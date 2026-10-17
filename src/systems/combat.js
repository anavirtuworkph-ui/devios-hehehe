// Combat services shared by every actor: projectiles, explosions, damage numbers,
// telegraphed hazards, particles and pickups. Owned by GameScene (one per scene instance).
import Phaser from 'phaser';
import { DEPTH } from '../config.js';
import { audio } from './audio.js';
import { rand } from './rng.js';

const MAX_BULLETS = 220;
const MAX_PARTICLES = 160;

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.pBullets = scene.physics.add.group({ maxSize: MAX_BULLETS });
    this.eBullets = scene.physics.add.group({ maxSize: MAX_BULLETS });
    this.telegraphs = [];
    this.tg = scene.add.graphics().setDepth(DEPTH.telegraph);
    this.fxg = scene.add.graphics().setDepth(DEPTH.fx);
    this.particles = [];
    this.texts = [];
    this.pickups = [];
    this.timers = [];
  }

  // ---- projectiles ---------------------------------------------------------------------
  // team: 'player' | 'enemy'. opts: damage, range, texture, tint, pierce, aoe, poison, slow, stun,
  // knock, wobble, split, lob {tx, ty}, scale, onExpire, source (weapon def), crit.
  bullet(team, x, y, angle, speed, opts = {}) {
    const group = team === 'player' ? this.pBullets : this.eBullets;
    const b = group.get(x, y, opts.texture || (team === 'player' ? 'b_small' : 'b_enemy'));
    if (!b) return null;
    b.enableBody(true, x, y, true, true);
    b.setTexture(opts.texture || (team === 'player' ? 'b_small' : 'b_enemy'));
    b.setDepth(DEPTH.bullet).setRotation(angle).setScale(opts.scale || 1).setAlpha(1);
    if (opts.tint) b.setTint(opts.tint); else b.clearTint();
    const r = Math.max(2, Math.min(b.width, b.height) * 0.4 * (opts.scale || 1));
    b.body.setCircle(r, b.width / 2 - r, b.height / 2 - r);
    b.body.setAllowGravity(false);
    b.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    b.team = team;
    b.dmg = opts.damage ?? 2;
    b.speed = speed;
    b.angle0 = angle;
    b.dist = 0;
    b.range = opts.range ?? 300;
    b.pierce = opts.pierce || 0;
    b.hitSet = new Set();
    b.opts = opts;
    b.born = this.scene.time.now;
    b.wobblePhase = rand.next() * Math.PI * 2;
    b.lastX = x; b.lastY = y;
    return b;
  }

  updateBullets(dt) {
    for (const group of [this.pBullets, this.eBullets]) {
      group.children.each((b) => {
        if (!b.active) return;
        const dx = b.x - b.lastX, dy = b.y - b.lastY;
        b.dist += Math.hypot(dx, dy);
        b.lastX = b.x; b.lastY = b.y;
        if (b.opts.wobble) {
          const t = (this.scene.time.now - b.born) / 1000;
          const a = b.angle0 + Math.sin(t * 14 + b.wobblePhase) * 0.35;
          b.setVelocity(Math.cos(a) * b.speed, Math.sin(a) * b.speed);
          b.setRotation(a);
          if (b.opts.confetti && rand.chance(0.3)) this.burst(b.x, b.y, rand.pick([0xff5fd2, 0xffd400, 0x47e0ff]), 1, 30);
        }
        if (b.opts.lob) {
          const p = Math.min(1, b.dist / b.range);
          b.setScale((b.opts.scale || 1) * (1 + Math.sin(p * Math.PI) * 0.8));
        }
        if (b.opts.smoke && rand.chance(0.5)) this.burst(b.x, b.y, 0x999999, 1, 15);
        if (b.dist >= b.range) this.expireBullet(b, true);
      });
    }
  }

  expireBullet(b, reachedEnd = false) {
    if (!b.active) return;
    const o = b.opts;
    if (o.aoe) this.explode(b.x, b.y, o.aoe, b.dmg, b.team, o);
    else if (!reachedEnd) this.burst(b.x, b.y, o.tint || 0xffffff, 3, 40);
    if (o.split && o.aoe) {
      for (let i = 0; i < o.split; i++) {
        const a = b.angle0 + (i - (o.split - 1) / 2) * 0.5;
        this.bullet(b.team, b.x, b.y, a, 220, { damage: Math.round(b.dmg * 0.4), range: 70, texture: 'b_rocket', scale: 0.6, aoe: 30, source: o.source });
      }
    }
    if (o.ink) this.decal(b.x, b.y, 0x1a1a4a, o.ink);
    b.disableBody(true, true);
  }

  // ---- damage -------------------------------------------------------------------------------
  explode(x, y, radius, damage, team, opts = {}) {
    audio.play('explosion', { gap: 60 });
    const color = opts.confetti ? 0xff5fd2 : 0xffa040;
    this.ring(x, y, radius, color);
    this.burst(x, y, color, opts.confetti ? 18 : 12, radius * 2.2);
    if (opts.confetti) for (let i = 0; i < 14; i++) this.burst(x, y, rand.pick([0xff5fd2, 0xffd400, 0x47e0ff, 0x9dff6a]), 1, radius * 3);
    this.shake(opts.big ? 0.012 : 0.006, 140);
    if (team === 'player') {
      for (const e of this.scene.enemies) {
        if (e.dead) continue;
        const d = Phaser.Math.Distance.Between(x, y, e.sprite.x, e.sprite.y);
        if (d <= radius + e.radius) this.hitEnemy(e, damage * (d < radius * 0.5 ? 1 : 0.7), { ...opts, aoe: true, angle: Math.atan2(e.sprite.y - y, e.sprite.x - x) });
      }
    } else {
      const p = this.scene.player;
      if (p && Phaser.Math.Distance.Between(x, y, p.sprite.x, p.sprite.y) <= radius + 4) p.hurt(damage, { x, y });
    }
  }

  hitEnemy(enemy, amount, opts = {}) {
    if (!enemy || enemy.dead) return 0;
    const p = this.scene.player;
    let dmg = amount;
    let crit = false;
    if (!opts.fixed && p) {
      dmg *= p.damageMultiplier();
      if (rand.next() < p.critChance()) { crit = true; dmg *= 2; }
    }
    const dealt = enemy.damage(dmg, opts);
    if (dealt > 0) {
      this.floatText(enemy.sprite.x, enemy.sprite.y - enemy.height * 0.6, String(Math.max(1, Math.round(dealt))), crit ? '#ffd400' : '#ffffff', crit);
      audio.play(crit ? 'crit' : 'hit', { gap: 40 });
    }
    return dealt;
  }

  // ---- hazards with clear warnings ---------------------------------------------------------
  // kind: circle {x,y,r} | line {x1,y1,x2,y2,w} | cone {x,y,r,angle,arc}. Damage fires after `ms`.
  telegraph(kind, geo, ms, onFire, color = 0xff3030) {
    const t = { kind, geo, ms, t: 0, onFire, color, done: false };
    this.telegraphs.push(t);
    audio.play('telegraph', { gap: 80 });
    return t;
  }

  updateTelegraphs(dt) {
    const g = this.tg;
    g.clear();
    for (const t of this.telegraphs) {
      t.t += dt;
      const p = Math.min(1, t.t / t.ms);
      const a = 0.18 + 0.25 * p;
      const blink = p > 0.75 && Math.floor(t.t / 70) % 2 === 0;
      const { geo } = t;
      if (t.kind === 'circle') {
        g.fillStyle(t.color, a * 0.6).fillCircle(geo.x, geo.y, geo.r * p);
        g.lineStyle(1.5, blink ? 0xffffff : t.color, 0.9).strokeCircle(geo.x, geo.y, geo.r);
      } else if (t.kind === 'line') {
        const ang = Math.atan2(geo.y2 - geo.y1, geo.x2 - geo.x1);
        const len = Math.hypot(geo.x2 - geo.x1, geo.y2 - geo.y1);
        const nx = -Math.sin(ang) * geo.w / 2, ny = Math.cos(ang) * geo.w / 2;
        g.fillStyle(t.color, a * 0.6);
        g.fillPoints([{ x: geo.x1 + nx, y: geo.y1 + ny }, { x: geo.x1 + Math.cos(ang) * len * p + nx, y: geo.y1 + Math.sin(ang) * len * p + ny },
          { x: geo.x1 + Math.cos(ang) * len * p - nx, y: geo.y1 + Math.sin(ang) * len * p - ny }, { x: geo.x1 - nx, y: geo.y1 - ny }], true);
        g.lineStyle(1, blink ? 0xffffff : t.color, 0.9).lineBetween(geo.x1, geo.y1, geo.x2, geo.y2);
      } else if (t.kind === 'cone') {
        g.fillStyle(t.color, a * 0.7);
        g.slice(geo.x, geo.y, geo.r, geo.angle - geo.arc / 2, geo.angle + geo.arc / 2, false).fillPath();
        g.lineStyle(1.5, blink ? 0xffffff : t.color, 0.9);
        g.beginPath(); g.arc(geo.x, geo.y, geo.r, geo.angle - geo.arc / 2, geo.angle + geo.arc / 2); g.strokePath();
      }
      if (t.t >= t.ms && !t.done) {
        t.done = true;
        try { t.onFire && t.onFire(t); } catch (err) { console.error(err); }
      }
    }
    this.telegraphs = this.telegraphs.filter((t) => !t.done);
  }

  cancelTelegraphs() { this.telegraphs = []; this.tg.clear(); }

  // Geometry tests for hazards against the player.
  playerInCircle(x, y, r) { const p = this.scene.player.sprite; return Phaser.Math.Distance.Between(x, y, p.x, p.y) <= r + 4; }
  playerInLine(geo) {
    const p = this.scene.player.sprite;
    const l = new Phaser.Geom.Line(geo.x1, geo.y1, geo.x2, geo.y2);
    const pt = Phaser.Geom.Line.GetNearestPoint(l, new Phaser.Geom.Point(p.x, p.y));
    const onSeg = Math.min(geo.x1, geo.x2) - 2 <= pt.x && pt.x <= Math.max(geo.x1, geo.x2) + 2 && Math.min(geo.y1, geo.y2) - 2 <= pt.y && pt.y <= Math.max(geo.y1, geo.y2) + 2;
    return onSeg && Phaser.Math.Distance.Between(pt.x, pt.y, p.x, p.y) <= geo.w / 2 + 3;
  }
  playerInCone(geo) {
    const p = this.scene.player.sprite;
    const d = Phaser.Math.Distance.Between(geo.x, geo.y, p.x, p.y);
    if (d > geo.r + 4) return false;
    const a = Math.atan2(p.y - geo.y, p.x - geo.x);
    return Math.abs(Phaser.Math.Angle.Wrap(a - geo.angle)) <= geo.arc / 2 + 0.1;
  }

  // ---- FX -----------------------------------------------------------------------------------
  floatText(x, y, text, color = '#fff', big = false) {
    if (this.texts.length > 40) { const old = this.texts.shift(); old.destroy(); }
    const t = this.scene.add.text(x, y, text, { fontFamily: 'monospace', fontSize: big ? '10px' : '8px', color, stroke: '#000', strokeThickness: 2 })
      .setOrigin(0.5).setDepth(DEPTH.text).setResolution(4);
    this.texts.push(t);
    this.scene.tweens.add({ targets: t, y: y - 14, alpha: 0, duration: 650, onComplete: () => { t.destroy(); this.texts = this.texts.filter((x2) => x2 !== t); } });
  }

  burst(x, y, color, n = 6, speed = 60, life = 400) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const a = rand.next() * Math.PI * 2;
      const s = speed * (0.3 + rand.next() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: rand.chance(0.3) ? 2 : 1 });
    }
  }

  ring(x, y, r, color = 0xffffff) { this.particles.push({ ring: true, x, y, r, life: 260, max: 260, color }); }

  decal(x, y, color, r = 4) {
    const d = this.scene.add.circle(x, y, r, color, 0.7).setDepth(DEPTH.decal);
    this.scene.tweens.add({ targets: d, alpha: 0, delay: 2500, duration: 1500, onComplete: () => d.destroy() });
  }

  arc(x, y, r, angle, arc, color = 0xffffff, life = 120) { this.particles.push({ slash: true, x, y, r, angle, arc, life, max: life, color }); }

  lightning(x1, y1, x2, y2, color = 0x9ff6ff, life = 120) { this.particles.push({ bolt: true, x1, y1, x2, y2, life, max: life, color, seed: rand.next() }); }

  updateFx(dt) {
    const g = this.fxg;
    g.clear();
    const s = dt / 1000;
    for (const p of this.particles) {
      p.life -= dt;
      const a = Math.max(0, p.life / p.max);
      if (p.ring) {
        g.lineStyle(2, p.color, a).strokeCircle(p.x, p.y, p.r * (1.1 - a * 0.3));
      } else if (p.slash) {
        g.lineStyle(3, p.color, a * 0.9);
        g.beginPath(); g.arc(p.x, p.y, p.r, p.angle - p.arc / 2, p.angle + p.arc / 2); g.strokePath();
        g.lineStyle(1, 0xffffff, a); g.beginPath(); g.arc(p.x, p.y, p.r - 3, p.angle - p.arc / 3, p.angle + p.arc / 3); g.strokePath();
      } else if (p.bolt) {
        g.lineStyle(1.5, p.color, a);
        g.beginPath(); g.moveTo(p.x1, p.y1);
        const n = 6;
        for (let i = 1; i < n; i++) {
          const t = i / n;
          g.lineTo(p.x1 + (p.x2 - p.x1) * t + (Math.sin((p.seed + i) * 91) * 6), p.y1 + (p.y2 - p.y1) * t + (Math.cos((p.seed + i) * 57) * 6));
        }
        g.lineTo(p.x2, p.y2); g.strokePath();
      } else {
        p.x += p.vx * s; p.y += p.vy * s; p.vx *= 0.92; p.vy *= 0.92;
        g.fillStyle(p.color, a).fillRect(p.x, p.y, p.size, p.size);
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  shake(intensity = 0.005, ms = 100) { this.scene.cameras.main.shake(ms, intensity); }

  // ---- pickups -------------------------------------------------------------------------------
  // kind: shard | heart | ammo. Shards fly to the player; all are auto-collected when a room clears.
  dropShards(x, y, amount, texture) {
    let left = amount;
    while (left > 0) {
      const v = left >= 5 ? 5 : 1;
      left -= v;
      const s = this.scene.add.image(x, y, texture).setDepth(DEPTH.pickup).setScale(v === 5 ? 1.3 : 1);
      const a = rand.next() * Math.PI * 2;
      this.pickups.push({ kind: 'shard', value: v, sprite: s, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, delay: 250, magnet: false });
    }
  }

  dropItem(kind, x, y) {
    const s = this.scene.add.image(x, y, kind).setDepth(DEPTH.pickup);
    this.scene.tweens.add({ targets: s, y: y - 2, yoyo: true, repeat: -1, duration: 500 });
    this.pickups.push({ kind, sprite: s, vx: 0, vy: 0, delay: 300, magnet: false });
  }

  magnetAll() { for (const p of this.pickups) if (p.kind === 'shard') { p.magnet = true; p.delay = 0; } }

  updatePickups(dt) {
    const player = this.scene.player;
    if (!player) return;
    const px = player.sprite.x, py = player.sprite.y;
    const s = dt / 1000;
    for (const p of this.pickups) {
      if (p.taken) continue;
      p.delay -= dt;
      p.sprite.x += p.vx * s; p.sprite.y += p.vy * s;
      p.vx *= 0.9; p.vy *= 0.9;
      const d = Phaser.Math.Distance.Between(px, py, p.sprite.x, p.sprite.y);
      if (p.kind === 'shard' && p.delay <= 0 && (p.magnet || d < 56)) {
        const a = Math.atan2(py - p.sprite.y, px - p.sprite.x);
        const sp = p.magnet ? 260 : 160;
        p.sprite.x += Math.cos(a) * sp * s; p.sprite.y += Math.sin(a) * sp * s;
      }
      if (p.delay <= 0 && d < 10) {
        if (p.kind === 'heart' && player.hp >= player.maxHp) continue;
        p.taken = true;
        this.scene.onPickup(p);
        p.sprite.destroy();
      }
    }
    this.pickups = this.pickups.filter((p) => !p.taken);
  }

  // Collect everything left on the floor (used on room clear and before leaving a room).
  collectAll() {
    for (const p of this.pickups) {
      if (p.taken) continue;
      if (p.kind !== 'shard') continue;
      p.taken = true;
      this.scene.onPickup(p);
      p.sprite.destroy();
    }
    this.pickups = this.pickups.filter((p) => !p.taken);
  }

  clearAll() {
    this.pBullets.children.each((b) => b.active && b.disableBody(true, true));
    this.eBullets.children.each((b) => b.active && b.disableBody(true, true));
    this.cancelTelegraphs();
    this.particles = [];
    for (const p of this.pickups) p.sprite.destroy();
    this.pickups = [];
    for (const t of this.texts) t.destroy();
    this.texts = [];
  }

  clearEnemyBullets() { this.eBullets.children.each((b) => b.active && b.disableBody(true, true)); }
}
