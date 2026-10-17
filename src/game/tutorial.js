// 205X tutorial: short, interactive, skippable and replayable.
import { DEPTH, TILE } from '../config.js';
import { ui, esc } from '../ui/ui.js';
import { audio } from '../systems/audio.js';
import { input } from '../systems/input.js';
import { createRun, giveWeapon, ownsWeapon } from '../systems/run.js';
import { persistRun } from '../app.js';
import { TUTORIAL_ROOM } from '../data/rooms.js';
import { enemyDef } from '../data/enemies.js';
import { Enemy } from '../entities/Enemy.js';
import { tileCenter, addImage, addGlow } from './helpers.js';

const STEPS = [
  { id: 'move', title: 'Movement', text: 'Move around the lab.', keys: '<kbd>W A S D</kbd>', touch: 'left joystick', hl: '.t-left' },
  { id: 'shoot', title: 'Aim & shoot', text: 'Destroy the training target with the Chrono Pistol.', keys: 'aim with the <kbd>mouse</kbd>, hold <kbd>left click</kbd>', touch: 'hold FIRE (tap auto-aims, drag to aim)', hl: '.t-attack' },
  { id: 'melee', title: 'Melee', text: 'Switch to the Plasma Wrench and smack the next target up close. Melee swings also destroy enemy bullets!', keys: '<kbd>2</kbd> or <kbd>Tab</kbd> to switch, then attack', touch: 'SWAP, then FIRE', hl: '.t-swap' },
  { id: 'dodge', title: 'Dodge', text: 'Dash! You are invulnerable for a split second while dodging.', keys: '<kbd>Space</kbd> or <kbd>Shift</kbd>', touch: 'DODGE', hl: '.t-dodge' },
  { id: 'pickup', title: 'Weapon pickups', text: 'Pick up the Prototype Scatter-Blaster. You can carry 4 weapons.', keys: 'walk over and press <kbd>E</kbd>', touch: 'USE', hl: '.t-interact' },
  { id: 'health', title: 'Health', text: 'Your health bar is top-left. Step through the low-voltage floor on the testing floor (east), then grab the heart.', keys: '', touch: '', hl: null },
  { id: 'fight', title: 'Practice fight', text: 'Defeat the training drones. Time Shards (currency) drop from enemies!', keys: '', touch: '', hl: '.t-attack' },
  { id: 'devios', title: 'The DeVios', text: 'Walk up to the DeVios and interact to configure the time circuits.', keys: '<kbd>E</kbd>', touch: 'USE', hl: '.t-interact' },
];

export class TutorialController {
  constructor(scene, data) { this.scene = scene; this.replay = !!(data && data.replay); this.i = -1; }

  start() {
    const sc = this.scene;
    sc.safeMode = false;
    // The tutorial never touches the saved run.
    sc.run = createRun(sc.save.data);
    const r = sc.buildRoom(TUTORIAL_ROOM, 'lab', { propTypes: ['tank', 'console', 'crate_tech'] });
    this.r = r;
    const p = tileCenter(r.spots.P[0]);
    sc.spawnPlayer(p.x, p.y);
    if (sc.ally) { sc.ally.destroy(); sc.ally = null; }
    sc.wirePhysics();
    audio.music('lab');
    // Decor
    r.spots.m.forEach((m, i) => { const c = tileCenter(m); addImage(sc, ['st_console', 'st_upgrade', 'st_repair'][i % 3], c.x, c.y, { origin: [0.5, 0.75] }); });
    // The DeVios parked on the testing floor
    const n = tileCenter(r.spots.n[0]);
    this.car = sc.physics.add.staticImage(n.x, n.y + 4, 'devios_top').setDepth(DEPTH.actor + (n.y + 40) * 0.001);
    this.car.body.setSize(40, 70).setOffset(2, 5);
    this.car.refreshBody();
    sc.roomObjects.push(this.car);
    sc.roomColliders.push(sc.physics.add.collider(sc.player.sprite, this.car));
    const tag = sc.add.text(n.x, n.y - 46, 'DeVios', { fontFamily: 'monospace', fontSize: '9px', color: '#47e0ff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(DEPTH.text).setResolution(4);
    sc.roomObjects.push(tag);

    this.panel = document.createElement('div');
    this.panel.id = 'tutorial';
    this.panel.innerHTML = '<div class="tp-title"></div><div class="tp-text"></div><div class="tp-keys"></div><div class="tp-btns"><button class="btn tp-next">Skip step ▶</button><button class="btn danger tp-skip">Skip tutorial</button></div>';
    ui.root.appendChild(this.panel);
    this.panel.querySelector('.tp-next').addEventListener('click', () => { audio.unlock(); this.next(); });
    this.panel.querySelector('.tp-skip').addEventListener('click', async () => {
      audio.unlock();
      if (await ui.confirm(this.replay ? 'Leave the tutorial?' : 'Skip the tutorial and head straight to the time-travel test?', 'Skip')) this.finish();
    });
    this.onDodge = () => { if (this.step && this.step.id === 'dodge') this.next(); };
    sc.events.on('dodged', this.onDodge);
    this.moved = 0;
    this.last = { ...p };
    sc.time.delayedCall(400, async () => {
      await ui.dialog([
        'The year is 205X. This is the laboratory of Anon, an eccentric (and slightly singed) scientist.',
        'Anon: My time-travel experiment is ALMOST ready. Let’s run the safety checklist first.',
        'Anon: And over there: my masterpiece. A 2026 Toyota Vios, rebuilt into the DeVios — time circuits, flux core, rear reactor, the works.',
      ]);
      this.next();
    });
  }

  objective() { return this.step ? `Tutorial: ${this.step.title}` : 'Tutorial'; }
  hudTitle() { return '205X — Anon’s Laboratory (Tutorial)'; }
  describe() { return 'Tutorial'; }

  next() {
    if (this.done) return;
    this.i++;
    document.querySelectorAll('.hl').forEach((e) => e.classList.remove('hl'));
    if (this.i >= STEPS.length) { this.finish(); return; }
    this.step = STEPS[this.i];
    audio.play('tutorial', { gap: 0 });
    const s = this.step;
    this.panel.querySelector('.tp-title').textContent = `${this.i + 1}/${STEPS.length} · ${s.title}`;
    this.panel.querySelector('.tp-text').textContent = s.text;
    this.panel.querySelector('.tp-keys').innerHTML = s.keys || s.touch ? `${s.keys ? `Desktop: ${s.keys}` : ''}${s.keys && s.touch ? '<br>' : ''}${s.touch ? `Mobile: ${esc(s.touch)}` : ''}` : '';
    if (s.hl) document.querySelectorAll(s.hl).forEach((e) => e.classList.add('hl'));
    this.scene.hudDirty = true;
    this.setupStep(s.id);
  }

  dummy(x, y) {
    const sc = this.scene;
    const def = { ...enemyDef('lab', 'shooter'), name: 'Target Dummy', hp: 30, key: 'en_lab_shooter', ai: 'dummy', armor: 0 };
    const e = new Enemy(sc, def, x, y, {});
    e.think = () => { e.sprite.setVelocity(0, 0); };
    e.noReward = true;
    e.maxHp = e.hp = 30;
    sc.enemies.push(e);
    sc.enemyGroup.add(e.sprite);
    e.sprite.body.setImmovable(true);
    return e;
  }

  setupStep(id) {
    const sc = this.scene;
    if (id === 'shoot') { this.target = this.dummy(10 * TILE, 3 * TILE); sc.player.switchTo(0); }
    if (id === 'melee') this.target = this.dummy(8 * TILE, 9 * TILE);
    if (id === 'pickup') {
      const x = 11 * TILE, y = 7 * TILE;
      const glow = addGlow(sc, x, y, 0xffd400, 12);
      const img = addImage(sc, 'w_proto_scatter', x, y, { bob: true });
      const it = sc.addInteractable({
        x, y, r: 22, label: 'Take Prototype Scatter-Blaster (shotgun)',
        use: () => { giveWeapon(sc.run, 'proto_scatter'); sc.player.refreshWeapon(); audio.play('pickup', { gap: 0 }); img.destroy(); glow.destroy(); sc.removeInteractable(it); if (this.step.id === 'pickup') this.next(); },
      });
      this.pickupIt = it;
    }
    if (id === 'health') { this.hurtSeen = false; this.healSeen = false; }
    if (id === 'fight') {
      const es = this.r.spots.e.map(tileCenter);
      sc.spawnEnemy('grunt', es[0].x, es[0].y, { era: 'lab' });
      sc.spawnEnemy('grunt', es[1].x, es[1].y, { era: 'lab' });
      sc.spawnEnemy('shooter', es[2].x, es[2].y, { era: 'lab' });
    }
    if (id === 'devios') {
      const it = sc.addInteractable({ x: this.car.x - 28, y: this.car.y, r: 34, label: 'Get in the DeVios', use: () => this.finish() });
      sc.addInteractable({ ...it, x: this.car.x + 28 });
      addGlow(sc, this.car.x, this.car.y, 0x47e0ff, 30);
    }
  }

  onEnemyKilled(e) {
    if (!this.step) return;
    const sc = this.scene;
    if (this.step.id === 'shoot' && e === this.target) sc.time.delayedCall(300, () => this.next());
    if (this.step.id === 'melee' && e === this.target) {
      if (sc.player.currentDef().category === 'melee') sc.time.delayedCall(300, () => this.next());
      else { ui.toast('Try it with the melee weapon (press 2 / SWAP)!'); sc.time.delayedCall(400, () => { this.target = this.dummy(8 * TILE, 9 * TILE); }); }
    }
    if (this.step.id === 'fight' && sc.enemies.filter((x) => !x.dead && x !== e).length === 0) {
      sc.combat.magnetAll();
      sc.time.delayedCall(800, () => this.next());
    }
  }

  update(dt) {
    const sc = this.scene;
    if (!sc.player || !this.step) return;
    const ps = sc.player.sprite;
    if (this.step.id === 'move') {
      this.moved += Math.hypot(ps.x - this.last.x, ps.y - this.last.y);
      if (this.moved > 90) this.next();
    }
    this.last = { x: ps.x, y: ps.y };
    // Training hazard: low-voltage floor deals 1 damage at most every ~0.9 s.
    const t = sc.layer.getTileAtWorldXY(ps.x, ps.y + 6);
    if (t && t.index === 5) {
      if (sc.player.hurt(1)) {
        sc.combat.lightning(ps.x - 6, ps.y + 8, ps.x + 6, ps.y - 6, 0x7ff6ff, 120);
        audio.play('zap', { gap: 0 });
        if (this.step.id === 'health' && !this.hurtSeen) {
          this.hurtSeen = true;
          ui.toast('Ouch! Health dropped. Grab the heart to heal.', 'bad');
          sc.combat.dropItem('heart', 22 * TILE, 9 * TILE);
        }
      }
    }
    if (this.step.id === 'health' && this.hurtSeen && !this.healSeen && sc.player.hp >= sc.player.maxHp) { this.healSeen = true; sc.time.delayedCall(300, () => this.next()); }
  }

  onDefeat() {
    // Lab safety protocol: no game over in the tutorial.
    const sc = this.scene;
    sc.ended = false;
    sc.player.dead = false;
    sc.player.hp = sc.player.maxHp;
    sc.player.sprite.setAngle(0).setAlpha(1);
    sc.player.invulnUntil = sc.time.now + 2000;
    ui.toast('Lab safety protocol engaged: health restored.', 'good');
  }

  finish() {
    if (this.done) return;
    this.done = true;
    const sc = this.scene;
    const save = sc.save.data;
    input.reset();
    if (!this.replay) {
      save.tutorialDone = true;
      save.openingSeen = true;
      // Keep the tutorial pickup for the first real run.
      const run = createRun(save);
      if (ownsWeapon(sc.run, 'proto_scatter')) giveWeapon(run, 'proto_scatter');
      run.current = 0;
      save.stats.runs += 1;
      persistRun(run);
    }
    sc.save.commit();
    sc.goto('Cinematic', { kind: 'departure', replay: this.replay });
  }

  canRestart() { return false; }

  destroy() {
    if (this.panel) this.panel.remove();
    document.querySelectorAll('.hl').forEach((e) => e.classList.remove('hl'));
    this.scene.events.off('dodged', this.onDodge);
  }
}
