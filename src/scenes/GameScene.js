// GameScene hosts every playable space: the 205X tutorial lab, era stages (combat rooms,
// optional sub-rooms, boss arenas) and the DeVios safe room. Mode-specific flow lives in
// controllers (src/game/*), while this class owns the shared world, physics and HUD feed.
import Phaser from 'phaser';
import { TILE, DEPTH, DIFFICULTY, VIEW_W, VIEW_H } from '../config.js';
import { app, persistRun } from '../app.js';
import { ui } from '../ui/ui.js';
import { input } from '../systems/input.js';
import { audio } from '../systems/audio.js';
import { Combat } from '../systems/combat.js';
import { Player, ITEMS } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Companion } from '../entities/Companion.js';
import { enemyDef } from '../data/enemies.js';
import { ERAS } from '../data/eras.js';
import { ALLY_BY_ID } from '../data/allies.js';
import { ARTIFACTS } from '../data/artifacts.js';
import { WEAPON_BY_ID } from '../data/weapons.js';
import { createRun, addShards, maxHpFor, clone } from '../systems/run.js';
import { ammoText } from '../systems/weapons.js';
import { rand } from '../systems/rng.js';
import { openSettings, openControls } from '../ui/panels.js';
import { touchWanted } from '../settings.js';
import { StageController } from '../game/stage.js';
import { HardStageController } from '../game/hardstage.js';
import { TutorialController } from '../game/tutorial.js';
import { SafeRoomController } from '../game/saferoom.js';

const SOLID = [3, 4, 6, 7];
const SHARD_KIND = { lab: 'lab', precolonial: 'gold', spanish: 'coin', american: 'brass', japanese: 'crystal', marcos: 'retro', modern: 'digital' };

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.data_ = data || { mode: 'safe' };
    this.mode = this.data_.mode;
  }

  create() {
    this.save = app.save;
    const s = this.save.data;
    if (!s.run) { s.run = createRun(s); this.save.commit(); }
    // The live run is a copy; the saved run is the last checkpoint (sub-level start / safe room).
    this.run = clone(s.run);
    // Scene instances are reused between starts: reset every per-run reference.
    this.player = null;
    this.ally = null;
    this.room = null;
    this.layer = null;
    this.tilemap = null;
    this.enemyGroup = null;
    this.spawnBounds = null;
    this.transitioning = false;
    this.nearInteract = undefined;
    this.bossBarsShown = false;
    this.hudDirty = true;
    this.diff = DIFFICULTY[s.settings.difficulty] || DIFFICULTY.easy;
    this.enemies = [];
    this.interactables = [];
    this.doors = [];
    this.roomObjects = [];
    this.roomColliders = [];
    this.safeMode = false;
    this.ended = false;
    this.paused = false;
    this.bossConductor = null;
    this.combat = new Combat(this);
    this.cameras.main.setBackgroundColor('#05050a');
    this.physics.world.setBoundsCollision(true, true, true, true);

    ui.screen(null);
    ui.showHud(true);
    ui.timeCircuits(null);
    ui.caption(null);
    ui.skip(null);
    ui.bossBars(null);
    this.updateTouch();
    input.reset();
    input.enabled = true;

    // Mouse fire on the canvas (touch is handled by the DOM controls).
    this.input.on('pointerdown', (p) => { if (!p.wasTouch && p.button === 0 && !ui.modals.length) { audio.unlock(); input.setMouseDown(true); } });
    this.input.on('pointerup', (p) => { if (!p.wasTouch && p.button === 0) input.setMouseDown(false); });

    this.onResize = () => this.fitCamera();
    this.game.events.on('app-resize', this.onResize);
    this.onTouchDetected = () => this.updateTouch();
    this.game.events.on('touch-detected', this.onTouchDetected);
    this.onVisibility = () => { if (document.hidden && !this.paused && !this.ended && !ui.modals.length) this.openPause(); };
    document.addEventListener('visibilitychange', this.onVisibility);
    this.onBlur = () => { if (!this.paused && !this.ended && !ui.modals.length && this.mode !== 'safe') this.openPause(); };
    window.addEventListener('blur', this.onBlur);
    this.events.once('shutdown', () => this.teardownScene());
    this.events.on('hud-dirty', () => { this.hudDirty = true; });
    this.hudTimer = 0;

    if (this.mode === 'tutorial') this.ctrl = new TutorialController(this, this.data_);
    else if (this.mode === 'stage') {
      // Hard mode replaces the short room chains with full floors (boss arenas stay the same).
      const hard = s.settings.difficulty === 'hard' && (this.data_.sub || 0) < 2;
      this.ctrl = hard ? new HardStageController(this, this.data_) : new StageController(this, this.data_);
    }
    else this.ctrl = new SafeRoomController(this, this.data_);
    this.ctrl.start();
  }

  teardownScene() {
    this.game.events.off('app-resize', this.onResize);
    this.game.events.off('touch-detected', this.onTouchDetected);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    ui.prompt(null);
    ui.bossBars(null);
    ui.minimap(null);
    ui.touch.setVisible(false);
    if (this.ctrl && this.ctrl.destroy) this.ctrl.destroy();
    this.input.removeAllListeners();
  }

  updateTouch() {
    ui.touch.setVisible(touchWanted() && !this.ended);
    document.body.classList.toggle('touch', touchWanted());
  }

  // ---------------------------------------------------------------------------------------
  // Room construction
  // ---------------------------------------------------------------------------------------
  clearRoom() {
    for (const c of this.roomColliders) c.destroy();
    this.roomColliders = [];
    for (const e of this.enemies) if (!e.dead) e.destroy();
    this.enemies = [];
    for (const o of this.roomObjects) if (o && o.destroy) o.destroy();
    this.roomObjects = [];
    this.interactables = [];
    this.doors = [];
    this.combat.clearAll();
    if (this.enemyGroup) { this.enemyGroup.destroy(); this.enemyGroup = null; }
    if (this.layer) { this.layer.destroy(); this.layer = null; }
    if (this.tilemap) { this.tilemap.destroy(); this.tilemap = null; }
    ui.prompt(null);
    ui.bossBars(null);
  }

  // Builds a tile room. Returns { w, h, spots, eraId }. `opts.propTypes` overrides era props.
  buildRoom(template, eraId, opts = {}) {
    this.clearRoom();
    const map = template.map;
    const H = map.length, W = map[0].length;
    const era = ERAS[eraId] || ERAS.lab;
    const tileKey = `tiles_${eraId in ERAS ? eraId : 'lab'}`;
    const spots = { P: [], e: [], c: [], n: [], m: [], X: [], S: [], B: [], o: [], '~': [] };
    const grid = [];
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < W; x++) {
        const ch = map[y][x];
        if (spots[ch]) spots[ch].push({ x, y });
        row.push(ch === '#' ? 1 : ch === ' ' ? 2 : 0); // ' ' = void outside the rooms
      }
      grid.push(row);
    }
    const floorAt = (x, y) => y >= 0 && y < H && x >= 0 && x < W && grid[y][x] === 0;
    const data = [];
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < W; x++) {
        const ch = map[y][x];
        if (grid[y][x] === 2) row.push(-1);
        else if (grid[y][x] === 1) row.push(floorAt(x, y + 1) ? 4 : 3);
        else if (ch === '~') row.push(5);
        else if (ch === 'o') row.push(7);
        else {
          const hsh = (x * 73856093) ^ (y * 19349663);
          const v = Math.abs(hsh) % 10;
          row.push(v < 6 ? 0 : v < 9 ? 1 : 2);
        }
      }
      data.push(row);
    }
    // Door tiles: closed/hidden doors stay solid until opened.
    for (const k of ['X', 'S', 'B']) for (const p of spots[k]) data[p.y][p.x] = 3;
    this.tilemap = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    // Build an 8-tile set: 0-2 floor, 3 wall top, 4 wall face, 5 hazard, 6 cracked, 7 prop base (floor look)
    const tsKey = `${tileKey}_set`;
    if (!this.textures.exists(tsKey)) {
      const src = this.textures.get(tileKey).getSourceImage();
      const t = this.textures.createCanvas(tsKey, TILE * 8, TILE);
      const ctx = t.getContext();
      ctx.drawImage(src, 0, 0);
      ctx.drawImage(src, 0, 0, TILE, TILE, TILE * 7, 0, TILE, TILE);
      t.refresh();
    }
    const ts = this.tilemap.addTilesetImage(tsKey, tsKey, TILE, TILE, 0, 0);
    this.layer = this.tilemap.createLayer(0, ts, 0, 0).setDepth(DEPTH.floor);
    this.layer.setCollision(SOLID);
    this.room = { w: W * TILE, h: H * TILE, W, H, spots, eraId, data, template };
    this.physics.world.setBounds(0, 0, W * TILE, H * TILE);

    // Props on 'o' tiles
    const props = opts.propTypes || era.props || ['crate'];
    for (const p of spots.o) {
      const type = props[Math.abs((p.x * 7 + p.y * 13)) % props.length];
      const img = this.add.image(p.x * TILE + 8, p.y * TILE + 16, `prop_${type}`).setOrigin(0.5, 1).setDepth(DEPTH.actor + (p.y * TILE + 14) * 0.001);
      this.roomObjects.push(img);
    }
    // Era ambience
    if (era.restrained) this.cameras.main.setBackgroundColor('#08080a');
    this.addAmbience(eraId);
    this.fitCamera();
    return this.room;
  }

  addAmbience(eraId) {
    const { w, h } = this.room;
    const tint = { precolonial: 0xfff2b0, spanish: 0xffe0c0, american: 0xfff0d0, japanese: 0xc0c8d0, marcos: 0xffd0e0, modern: 0xc0f0ff, lab: 0xc0f0ff }[eraId] || 0xffffff;
    // Gentle drifting motes (cheap: a handful of images with tweens)
    const n = eraId === 'japanese' ? 10 : 6;
    for (let i = 0; i < n; i++) {
      const m = this.add.image(rand.next() * w, rand.next() * h, 'px').setDepth(DEPTH.fx).setTint(eraId === 'japanese' ? 0x9a9a9a : tint).setAlpha(0.35);
      this.tweens.add({ targets: m, x: m.x + (rand.next() - 0.5) * 60, y: m.y + (eraId === 'japanese' ? 40 : -30), alpha: 0, duration: 4000 + rand.next() * 3000, repeat: -1 });
      this.roomObjects.push(m);
    }
    if (eraId === 'modern') {
      const glitch = this.add.rectangle(w / 2, h / 2, w, 3, 0xff4fd8, 0.0).setDepth(DEPTH.fx);
      this.tweens.add({ targets: glitch, alpha: { from: 0, to: 0.25 }, y: { from: 0, to: h }, duration: 2600, repeat: -1, yoyo: true });
      this.roomObjects.push(glitch);
    }
  }

  // Opens a door group (tiles become walkable + sprite swap) and registers its trigger.
  addDoor(kind, cells, { locked = true, label = '', icon = null, color = 0xffd400, onEnter, hidden = false } = {}) {
    if (!cells.length) return null;
    const xs = cells.map((c) => c.x), ys = cells.map((c) => c.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const horizontal = maxX > minX || minY === 0 || maxY === this.room.H - 1;
    const cx = ((minX + maxX + 1) / 2) * TILE, cy = ((minY + maxY + 1) / 2) * TILE;
    const door = { kind, cells, locked, hidden, onEnter, cx, cy, horizontal, label };
    const key = horizontal ? (locked ? 'door_locked' : 'door_open') : (locked ? 'door_side_locked' : 'door_side');
    door.sprite = this.add.image(cx, cy, key).setDepth(DEPTH.prop).setVisible(!hidden);
    if (hidden) for (const c of cells) this.layer.putTileAt(6, c.x, c.y);
    if (icon) {
      door.sign = this.add.text(cx + (horizontal ? 0 : (minX === 0 ? 14 : -14)), cy + (horizontal ? 14 : -18), icon, { fontFamily: 'monospace', fontSize: '10px', color: `#${color.toString(16).padStart(6, '0')}`, stroke: '#000', strokeThickness: 3 })
        .setOrigin(0.5).setDepth(DEPTH.fx).setResolution(4).setVisible(!hidden);
      this.tweens.add({ targets: door.sign, alpha: 0.5, yoyo: true, repeat: -1, duration: 600 });
      this.roomObjects.push(door.sign);
    }
    this.roomObjects.push(door.sprite);
    this.doors.push(door);
    if (!locked && !hidden) this.openDoor(door, true);
    return door;
  }

  openDoor(door, silent = false) {
    door.locked = false;
    door.hidden = false;
    for (const c of door.cells) this.layer.putTileAt(0, c.x, c.y);
    door.sprite.setTexture(door.horizontal ? 'door_open' : 'door_side').setVisible(true);
    if (door.sign) door.sign.setVisible(true);
    if (!silent) audio.play('door', { gap: 0 });
  }

  lockDoor(door) {
    door.locked = true;
    for (const c of door.cells) this.layer.putTileAt(3, c.x, c.y);
    door.sprite.setTexture(door.horizontal ? 'door_locked' : 'door_side_locked');
  }

  // Wires physics for the freshly built room.
  wirePhysics() {
    const L = this.layer;
    const p = this.player.sprite;
    p.setCollideWorldBounds(true);
    this.roomColliders.push(this.physics.add.collider(p, L));
    if (this.ally) this.roomColliders.push(this.physics.add.collider(this.ally.sprite, L));
    this.enemyGroup = this.physics.add.group();
    this.roomColliders.push(this.physics.add.collider(this.enemyGroup, L));
    this.roomColliders.push(this.physics.add.collider(this.enemyGroup, this.enemyGroup));
    this.roomColliders.push(this.physics.add.collider(this.combat.pBullets, L, (b, tile) => this.bulletHitsWall(b, tile)));
    this.roomColliders.push(this.physics.add.collider(this.combat.eBullets, L, (b) => this.combat.expireBullet(b)));
    // Argument order differs between group/sprite overlaps, so pick objects by their tags.
    this.roomColliders.push(this.physics.add.overlap(this.combat.pBullets, this.enemyGroup, (a, b) => (a.enemy ? this.bulletHitsEnemy(b, a.enemy) : this.bulletHitsEnemy(a, b.enemy))));
    this.roomColliders.push(this.physics.add.overlap(this.combat.eBullets, p, (a, b) => this.bulletHitsPlayer(a.team ? a : b)));
  }

  bulletHitsWall(b, tile) {
    if (!b.active) return;
    if (tile && tile.index === 6) this.ctrl.onCrackedWallHit && this.ctrl.onCrackedWallHit(tile, b);
    this.combat.expireBullet(b);
  }

  bulletHitsEnemy(b, e) {
    if (!b.active || !e || e.dead || b.hitSet.has(e.id)) return;
    if (e.spawning || (e.isBoss && !e.active)) return;
    b.hitSet.add(e.id);
    if (b.opts.aoe) { this.combat.expireBullet(b); return; }
    this.combat.hitEnemy(e, b.dmg, { ...b.opts, angle: Math.atan2(b.body.velocity.y, b.body.velocity.x), knock: b.opts.knock || 20, fixed: b.opts.fixed });
    if (b.pierce > 0) b.pierce -= 1;
    else this.combat.expireBullet(b);
  }

  bulletHitsPlayer(b) {
    if (!b.active || !this.player || this.player.dead) return;
    const hit = this.player.hurt(b.dmg, b);
    if (hit || this.time.now >= this.player.invulnUntil) b.disableBody(true, true);
  }

  // ---------------------------------------------------------------------------------------
  // Actors
  // ---------------------------------------------------------------------------------------
  spawnPlayer(x, y) {
    if (this.player) {
      this.player.sprite.setPosition(x, y).setVelocity(0, 0);
      this.player.dead = false;
    } else {
      this.player = new Player(this, x, y);
    }
    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);
    this.spawnAlly();
    this.hudDirty = true;
  }

  spawnAlly() {
    const id = this.save.data.activeAlly;
    if (this.ally && (!id || this.ally.ally.id !== id)) { this.ally.destroy(); this.ally = null; }
    if (id && !this.ally && ALLY_BY_ID[id]) this.ally = new Companion(this, ALLY_BY_ID[id], this.player.sprite.x - 14, this.player.sprite.y + 4);
    if (this.ally) this.ally.teleportToPlayer();
  }

  spawnEnemy(type, x, y, opts = {}) {
    const def = enemyDef(opts.era || this.room.eraId, type);
    const e = new Enemy(this, def, x, y, opts);
    this.enemies.push(e);
    this.enemyGroup.add(e.sprite);
    return e;
  }

  spawnMinion(type, boss) {
    const pt = this.safeSpawnPoint(boss, 60);
    const e = this.spawnEnemy(type, pt.x, pt.y, { minion: true });
    e.minion = true;
    return e;
  }

  addBoss(boss) {
    this.enemies.push(boss);
    this.enemyGroup.add(boss.sprite);
  }

  inRoomBounds(x, y) {
    if (!this.room) return true;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    const b = this.spawnBounds; // hard-mode floors: the room currently in combat
    if (b) return tx > b.x && ty > b.y && tx < b.x + b.w - 1 && ty < b.y + b.h - 1;
    if (tx <= 0 || ty <= 0 || tx >= this.room.W - 1 || ty >= this.room.H - 1) return false;
    return true;
  }

  // A random walkable point inside the room, away from the player.
  safeSpawnPoint(entity, minDist = 80) {
    const { data, W, H } = this.room;
    const ps = this.player.sprite;
    const b = this.spawnBounds;
    for (let i = 0; i < 80; i++) {
      const tx = b ? rand.int(b.x + 1, b.x + b.w - 2) : rand.int(1, W - 2);
      const ty = b ? rand.int(b.y + 1, b.y + b.h - 2) : rand.int(1, H - 2);
      const t = data[ty][tx];
      if (t < 0 || t > 2) continue;
      if (this.layer.getTileAt(tx, ty) && SOLID.includes(this.layer.getTileAt(tx, ty).index)) continue;
      const x = tx * TILE + 8, y = ty * TILE + 8;
      if (Phaser.Math.Distance.Between(x, y, ps.x, ps.y) >= minDist) return { x, y };
    }
    if (b) return { x: (b.x + b.w / 2) * TILE, y: (b.y + b.h / 2) * TILE };
    return { x: this.room.w / 2, y: this.room.h / 2 };
  }

  // ---------------------------------------------------------------------------------------
  // Events from actors / systems
  // ---------------------------------------------------------------------------------------
  onEnemyKilled(e) {
    if (e.rewarded) return; // never pay twice for one enemy
    e.rewarded = true;
    if (!e.isBoss && !e.noReward) {
      const kind = e.elite ? 'elite' : 'enemy';
      const [a, b] = kind === 'elite' ? [4, 8] : (e.def.shards || [1, 3]);
      this.combat.dropShards(e.x, e.y, rand.int(a, b), this.shardTexture());
      if (rand.next() < this.diff.healDrop) this.combat.dropItem('heart', e.x + 4, e.y);
      else if (rand.next() < 0.1) this.combat.dropItem('ammo', e.x - 4, e.y);
    }
    if (this.ctrl.onEnemyKilled) this.ctrl.onEnemyKilled(e);
    // remove the dead enemy from the active list on the next tick
    this.time.delayedCall(0, () => { this.enemies = this.enemies.filter((x) => x !== e); });
  }

  onPickup(p) {
    if (p.kind === 'shard') {
      const g = addShards(this.run, this.save.data, p.value);
      audio.play('coin', { gap: 25 });
      if (g > 0) this.hudDirty = true;
    } else if (p.kind === 'heart') {
      this.player.heal(4);
    } else if (p.kind === 'ammo') {
      const inst = this.player.currentInst();
      const def = WEAPON_BY_ID[inst.id];
      if (def.mag && inst.reserve !== null) {
        const cap = Math.round(def.reserve * (0.5 + 0.15 * this.run.upgrades.ammo));
        inst.reserve = Math.min(cap, inst.reserve + Math.ceil(cap * 0.35));
      }
      audio.play('pickup');
      this.toast('Ammo +');
    }
  }

  onBossPhase(boss, idx) {
    if (idx > 0) {
      this.combat.shake(0.01, 300);
      ui.banner(`${boss.bossDef.name}`, 'enters a new phase!', 1200);
      boss.sprite.setTint(0xff8080);
      this.time.delayedCall(300, () => boss.sprite.active && boss.sprite.clearTint());
    }
  }

  showAttackName(boss, name) {
    const t = this.add.text(boss.x, boss.y - 44, name, { fontFamily: 'monospace', fontSize: '8px', color: '#ffe0a0', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(DEPTH.text).setResolution(4);
    this.tweens.add({ targets: t, y: t.y - 10, alpha: 0, delay: 600, duration: 500, onComplete: () => t.destroy() });
  }

  onPlayerDeath() {
    if (this.ended) return;
    this.ended = true;
    this.save.data.stats.deaths += 1;
    this.save.commit();
    audio.play('hurt', { gap: 0 });
    this.combat.cancelTelegraphs();
    this.tweens.add({ targets: this.player.sprite, angle: 90, alpha: 0.5, duration: 400 });
    this.time.delayedCall(700, () => this.ctrl.onDefeat ? this.ctrl.onDefeat() : this.defaultDefeat());
  }

  defaultDefeat() {
    this.scene.pause();
    ui.modal({
      title: 'Anon is down!', closable: false,
      content: '<p>The timeline wobbles. Your artifacts, allies and campaign progress are safe.</p>',
      buttons: [{ label: 'Main menu', action: (m) => { m.close(); this.toMenu(); } }],
    });
  }

  shardTexture() { return `shard_${SHARD_KIND[this.room ? this.room.eraId : 'lab'] || 'lab'}`; }

  toast(msg, kind) { ui.toast(msg, kind); }

  // Opens a DOM modal while freezing the world (shops, stations, pause...).
  modalPaused(opts) {
    if (!this.paused) { this.paused = true; this.scene.pause(); }
    const userClose = opts.onClose;
    return ui.modal({
      ...opts,
      onClose: () => {
        if (userClose) userClose();
        if (this.mode === 'safe' && !this.ended) this.checkpoint(); // safe-room purchases persist immediately
        if (!ui.modals.length && !this.ended) { this.paused = false; this.scene.resume(); input.reset(); }
      },
    });
  }

  openPause() {
    if (ui.modals.length || this.ended) return;
    audio.play('select', { gap: 0 });
    const ctrl = this.ctrl;
    const buttons = [
      { label: 'Resume', cls: 'primary', action: (m) => m.close() },
      { label: 'Controls', action: () => openControls() },
      { label: 'Settings', action: () => openSettings({ inGame: true }) },
    ];
    if (ctrl.canRestart && ctrl.canRestart()) {
      buttons.push({
        label: ctrl.restartLabel ? ctrl.restartLabel() : 'Restart stage', action: async (m) => {
          if (await ui.confirm('Restart from the beginning of this sub-level? Time Shards and items picked up since then are lost (artifacts and allies are kept).', 'Restart')) {
            m.close(); ctrl.restart();
          }
        },
      });
    }
    buttons.push({
      label: 'Main menu', cls: 'danger', action: async (m) => {
        const safe = this.mode === 'safe';
        if (safe || await ui.confirm('Return to the main menu? Progress since the start of this sub-level is not saved (artifacts and allies are).', 'Leave')) {
          m.close(); this.toMenu();
        }
      },
    });
    const era = this.room ? ERAS[this.room.eraId] : null;
    this.modalPaused({
      title: 'Paused',
      content: `<p>${era ? era.name : ''}${ctrl.describe ? ` — ${ctrl.describe()}` : ''}</p><p>Time Shards: <b style="color:var(--gold)">${this.run.shards}</b> · Artifacts: ${this.save.data.artifacts.length}/5</p>`,
      buttons,
    });
  }

  toMenu() {
    this.ended = true;
    ui.closeAllModals();
    ui.fade(true, 250).then(() => { this.scene.stop(); this.scene.start('Menu'); ui.fade(false, 300); });
  }

  goto(key, data) {
    this.ended = true;
    ui.closeAllModals();
    ui.prompt(null);
    ui.fade(true, 300).then(() => { this.scene.start(key, data); ui.fade(false, 300); });
  }

  checkpoint(extra = {}) {
    this.run.hp = this.player ? this.player.hp : this.run.hp;
    Object.assign(this.run, extra);
    persistRun(this.run);
  }

  // ---------------------------------------------------------------------------------------
  // Camera & aim
  // ---------------------------------------------------------------------------------------
  fitCamera() {
    const cam = this.cameras.main;
    const w = this.scale.width, h = this.scale.height;
    cam.setSize(w, h);
    const zoom = Math.max(1, Math.min(w / VIEW_W, h / VIEW_H));
    cam.setZoom(zoom);
    if (this.room) {
      const vw = w / zoom, vh = h / zoom;
      const bx = this.room.w < vw ? (this.room.w - vw) / 2 : 0;
      const by = this.room.h < vh ? (this.room.h - vh) / 2 : 0;
      cam.setBounds(bx, by, Math.max(this.room.w, vw), Math.max(this.room.h, vh));
    }
  }

  getAimPoint(player) {
    const sp = player.sprite;
    if (input.lastDevice === 'mouse') {
      const ptr = this.input.activePointer;
      const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      return { x: wp.x, y: wp.y };
    }
    if (input.touch.aim) return { x: sp.x + input.touch.aim.x * 120, y: sp.y + input.touch.aim.y * 120 };
    if (this.save.data.settings.autoAim) {
      let best = null, bd = 280;
      for (const e of this.enemies) {
        if (e.dead || e.spawning || (e.isBoss && !e.active)) continue;
        const d = Phaser.Math.Distance.Between(sp.x, sp.y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) return { x: best.x, y: best.y };
    }
    return null;
  }

  // ---------------------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------------------
  update(time, delta) {
    const dt = Math.min(delta, 50);
    if (!this.player) { if (this.ctrl.update) this.ctrl.update(dt, time); return; }
    if (input.consume('pause')) { this.openPause(); return; }
    this.player.update(dt, time);
    if (this.ally) this.ally.update(dt, time);
    for (const e of this.enemies) e.update(dt, time);
    this.combat.updateBullets(dt);
    this.combat.updateTelegraphs(dt);
    this.combat.updatePickups(dt);
    this.combat.updateFx(dt);
    this.updateInteract();
    this.updateDoors();
    if (this.ctrl.update) this.ctrl.update(dt, time);
    this.hudTimer += dt;
    if (this.hudDirty || this.hudTimer > 120) { this.hudTimer = 0; this.hudDirty = false; this.pushHud(); }
  }

  updateInteract() {
    const ps = this.player.sprite;
    let best = null, bd = Infinity;
    for (const it of this.interactables) {
      if (it.enabled && !it.enabled()) continue;
      const d = Phaser.Math.Distance.Between(ps.x, ps.y, it.x, it.y);
      if (d <= (it.r || 22) && d < bd) { bd = d; best = it; }
    }
    if (best !== this.nearInteract) {
      this.nearInteract = best;
      ui.prompt(best ? (typeof best.label === 'function' ? best.label() : best.label) : null);
    }
    if (input.consume('interact') && best && !this.player.dead) {
      audio.play('select', { gap: 0 });
      best.use();
      this.nearInteract = undefined;
    }
  }

  addInteractable(it) { this.interactables.push(it); return it; }
  removeInteractable(it) { this.interactables = this.interactables.filter((x) => x !== it); this.nearInteract = undefined; }

  updateDoors() {
    if (this.transitioning) return;
    const ps = this.player.sprite;
    for (const d of this.doors) {
      if (d.locked || d.hidden) continue;
      const near = d.horizontal ? Math.abs(ps.x - d.cx) < 18 && Math.abs(ps.y - d.cy) < 12 : Math.abs(ps.y - d.cy) < 18 && Math.abs(ps.x - d.cx) < 12;
      if (near && d.onEnter) {
        this.transitioning = true;
        this.combat.collectAll();
        audio.play('transition', { gap: 0 });
        d.onEnter(d);
        return;
      }
    }
  }

  pushHud() {
    const p = this.player;
    const run = this.run;
    const inst = p.currentInst();
    const def = WEAPON_BY_ID[inst.id];
    const s = this.save.data;
    const era = this.room ? ERAS[this.room.eraId] : ERAS.lab;
    const items = ITEMS.map((it, i) => ({ label: it.label, n: run.consumables[it.key], selected: i === p.itemIndex })).filter((x) => x.n > 0);
    ui.updateHud({
      hp: Math.ceil(p.hp), maxHp: p.maxHp,
      shards: run.shards, shardKind: SHARD_KIND[era.id] || 'lab',
      eraLabel: this.ctrl.hudTitle ? this.ctrl.hudTitle() : era.name,
      objective: this.ctrl.objective ? this.ctrl.objective() : '',
      weaponId: inst.id, weaponName: def.name, level: inst.level, weaponImg: app.images[`w_${inst.id}`],
      ammoText: ammoText(inst, this.time.now),
      slots: run.loadout.map((w, i) => ({ name: WEAPON_BY_ID[w.id].name, img: app.images[`w_${w.id}`], active: i === run.current })),
      slotsKey: run.loadout.map((w) => w.id).join(',') + run.current,
      items, itemsKey: items.map((i) => `${i.label}${i.n}${i.selected}`).join(','),
      artifacts: ARTIFACTS.map((a) => ({ name: a.name, have: s.artifacts.includes(a.id) })),
      artifactsKey: s.artifacts.join(','),
      allyName: this.ally ? this.ally.ally.name : '',
      buffs: p.buffs.map((b) => ({ label: b.label, bad: b.bad })),
      buffsKey: p.buffs.map((b) => b.label).join(','),
    });
    ui.touch.setReload(def.mag > 0);
    const bosses = this.enemies.filter((e) => e.isBoss && !e.dead);
    if (bosses.length || this.bossBarsShown) {
      this.bossBarsShown = bosses.length > 0;
      ui.bossBars(bosses.map((b) => ({ name: b.bossDef.name, hp: b.hp, max: b.maxHp })));
    }
  }

  refreshMaxHp() {
    if (!this.player) return;
    this.player.maxHp = maxHpFor(this.run, this.save.data);
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    this.hudDirty = true;
  }
}
