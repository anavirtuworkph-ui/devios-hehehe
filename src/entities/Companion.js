// Recruited ally AI. Invulnerable helper that follows Anon, fights nearby enemies and
// teleports back to him if it falls behind or gets stuck. It never collides with Anon or
// doors, so it can never block an exit.
import Phaser from 'phaser';
import { DEPTH } from '../config.js';
import { audio } from '../systems/audio.js';

export class Companion {
  constructor(scene, ally, x, y) {
    this.scene = scene;
    this.ally = ally;
    this.sprite = scene.physics.add.sprite(x, y, `ch_${ally.id}`, 0).setDepth(DEPTH.actor);
    this.sprite.body.setSize(8, 6).setOffset(5, 18);
    this.shadow = scene.add.image(x, y + 10, 'shadow').setDepth(DEPTH.actor - 1);
    this.marker = scene.add.triangle(x, y - 16, 0, 0, 6, 0, 3, 4, 0x5fff8a).setDepth(DEPTH.fx);
    this.nextAttack = 0;
    this.nextHeal = scene.time.now + ((ally.attack.heal && ally.attack.heal.every) || 0);
    this.animT = 0;
    this.stuck = { x, y, t: 0 };
    this.target = null;
  }

  // MacArthur Jr.'s inspiring presence boosts Anon's damage while nearby.
  buffsPlayer() {
    const b = this.ally.attack.buff;
    if (!b) return false;
    const p = this.scene.player.sprite;
    return Phaser.Math.Distance.Between(p.x, p.y, this.sprite.x, this.sprite.y) <= b.radius;
  }

  teleportToPlayer() {
    const p = this.scene.player.sprite;
    this.sprite.setPosition(p.x - 14, p.y + 4);
    this.scene.combat.burst(this.sprite.x, this.sprite.y, 0x5fff8a, 6, 40);
  }

  findTarget(range) {
    let best = null, bd = range;
    for (const e of this.scene.enemies) {
      if (e.dead || e.spawning || (e.isBoss && !e.active)) continue;
      const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  update(dt, now) {
    const sp = this.sprite;
    const player = this.scene.player;
    if (!player) return;
    const ps = player.sprite;
    const a = this.ally.attack;
    const dToP = Phaser.Math.Distance.Between(sp.x, sp.y, ps.x, ps.y);
    if (dToP > 220) this.teleportToPlayer();

    const combat = !this.scene.safeMode;
    const target = combat ? this.findTarget(a.kind === 'melee' ? 150 : a.range) : null;
    let vx = 0, vy = 0;
    const scale = this.scene.save.data.settings.difficulty === 'normal' ? 0.9 : 1;
    if (target && a.kind === 'melee') {
      const d = Phaser.Math.Distance.Between(sp.x, sp.y, target.x, target.y);
      if (d > a.reach + target.radius) {
        const ang = Math.atan2(target.y - sp.y, target.x - sp.x);
        vx = Math.cos(ang) * a.speed; vy = Math.sin(ang) * a.speed;
      } else if (now >= this.nextAttack) {
        this.nextAttack = now + a.cooldown;
        const ang = Math.atan2(target.y - sp.y, target.x - sp.x);
        this.scene.combat.arc(sp.x, sp.y, a.reach + 6, ang, 1.8, 0x9dff6a, 120);
        audio.play('melee', { gap: 60 });
        this.scene.combat.hitEnemy(target, a.damage * scale * (target.isBoss ? 0.6 : 1), { fixed: true, angle: ang, knock: 50 });
      }
    } else {
      if (target && now >= this.nextAttack) {
        this.nextAttack = now + a.cooldown;
        const ang = Math.atan2(target.y - sp.y, target.x - sp.x);
        this.scene.combat.bullet('player', sp.x, sp.y, ang, a.speed, {
          damage: a.damage * scale * (target.isBoss ? 0.6 : 1), range: a.range + 30, texture: this.ally.id === 'rizal' || this.ally.id === 'ibarra' ? 'b_ink' : 'b_small',
          tint: 0x9dff6a, pierce: a.pierce || 0, fixed: true, slow: a.slow, stun: a.stun,
        });
        audio.play('shoot_pistol', { gap: 80 });
      }
      // Keep a loose follow position behind Anon.
      const fx = ps.x - player.facing * 18, fy = ps.y + 6;
      const d = Phaser.Math.Distance.Between(sp.x, sp.y, fx, fy);
      if (d > 10) {
        const ang = Math.atan2(fy - sp.y, fx - sp.x);
        const s = Math.min(130, d * 3);
        vx = Math.cos(ang) * s; vy = Math.sin(ang) * s;
      }
    }
    if (!target && a.kind === 'melee') {
      const fx = ps.x - player.facing * 18, fy = ps.y + 6;
      const d = Phaser.Math.Distance.Between(sp.x, sp.y, fx, fy);
      if (d > 10) { const ang = Math.atan2(fy - sp.y, fx - sp.x); const s = Math.min(130, d * 3); vx = Math.cos(ang) * s; vy = Math.sin(ang) * s; }
    }
    sp.setVelocity(vx, vy);
    // Healing support (only matters in combat areas)
    if (a.heal && combat && now >= this.nextHeal) {
      this.nextHeal = now + a.heal.every;
      if (player.hp < player.maxHp) { player.heal(a.heal.amount); this.scene.combat.lightning(sp.x, sp.y, ps.x, ps.y, 0x5fff8a, 200); }
    }
    // Stuck detection
    this.stuck.t += dt;
    if (this.stuck.t > 1500) {
      const moved = Phaser.Math.Distance.Between(this.stuck.x, this.stuck.y, sp.x, sp.y);
      if (moved < 2 && (vx || vy)) this.teleportToPlayer();
      this.stuck = { x: sp.x, y: sp.y, t: 0 };
    }
    this.animT += dt;
    if ((vx || vy) && this.animT > 170) { this.animT = 0; sp.setFrame(sp.frame.name === 0 ? 1 : 0); }
    sp.setFlipX(target ? target.x < sp.x : player.facing < 0);
    sp.setDepth(DEPTH.actor + sp.y * 0.001);
    this.shadow.setPosition(sp.x, sp.y + 11);
    this.marker.setPosition(sp.x, sp.y - 17);
  }

  destroy() { [this.sprite, this.shadow, this.marker].forEach((o) => o.destroy()); }
}
