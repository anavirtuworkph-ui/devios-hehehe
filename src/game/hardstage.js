// Hard mode: each non-boss sub-level is one connected floor (Soul Knight style). Walking into
// an uncleared combat room seals its doors and spawns waves; side branches hold shops,
// treasure, vaults and other optional rooms; a time rift in the exit room ends the floor.
import Phaser from 'phaser';
import { TILE, DEPTH } from '../config.js';
import { ui } from '../ui/ui.js';
import { audio } from '../systems/audio.js';
import { generateDungeon } from '../systems/dungeon.js';
import { SUBROOM_TYPES } from '../data/rooms.js';
import { StageController } from './stage.js';
import { buildSubroom } from './subroomContent.js';
import { tileCenter, addImage, addGlow } from './helpers.js';

export class HardStageController extends StageController {
  start() {
    if (!this.prepare()) return;
    const sc = this.scene;
    const save = sc.save.data;
    this.dg = generateDungeon({ rng: this.rng, eraId: this.eraId, sub: this.sub, difficulty: 'hard', save });
    this.roomById = new Map(this.dg.rooms.map((r) => [r.id, r]));
    sc.buildRoom({ id: 'floor', map: this.dg.map }, this.eraId);
    // Doorways: open until their room starts a fight.
    for (const r of this.dg.rooms) {
      r.doors = [];
      for (const g of r.gates) {
        if (g.link.hidden && g.link.a === r) continue; // sealed by a cracked wall until found
        r.doors.push(sc.addDoor('gate', g.cells, { locked: false }));
      }
    }
    for (const link of this.dg.links.filter((l) => l.hidden)) {
      for (const c of link.crack) sc.layer.putTileAt(6, c.x, c.y);
      const mid = { x: (link.crack[0].x + link.crack[1].x + 1) / 2 * TILE, y: (link.crack[0].y + link.crack[1].y + 1) / 2 * TILE };
      sc.addInteractable({
        x: mid.x, y: mid.y, r: 30, label: 'Inspect the cracked wall',
        enabled: () => !link.found && this.state(link.a).cleared,
        use: () => this.revealLink(link),
      });
    }
    const start = this.roomById.get(this.dg.startId);
    sc.spawnPlayer(start.center.x * TILE + 8, start.center.y * TILE + 8);
    sc.wirePhysics();
    // The time rift out of this floor
    const exit = this.roomById.get(this.dg.exitId);
    this.riftPos = { x: exit.center.x * TILE + 8, y: exit.center.y * TILE + 8 };
    addGlow(sc, this.riftPos.x, this.riftPos.y - 6, 0x47e0ff, 22);
    const rift = addImage(sc, 'portal', this.riftPos.x, this.riftPos.y, { depth: DEPTH.decal + 1 });
    rift.setScale(2.4);
    sc.tweens.add({ targets: rift, angle: 360, repeat: -1, duration: 2400 });
    this.visited = new Set([start.id]);
    this.current = start;
    this.leaving = false;
    this.drawMap();
    ui.toast('HARD MODE: explore the floor, clear every combat room on the way, and find the time rift.', 'gold');
  }

  hudTitle() { return `${this.era.short} · ${this.sub + 1}/3 ${this.era.subs[this.sub]} (Hard)`; }
  describe() { return `Hard floor ${this.sub + 1}/3: ${this.era.subs[this.sub]}`; }

  combatRooms() { return this.dg.rooms.filter((r) => r.kind === 'combat'); }

  objective() {
    if (this.trial && this.trial.active) return super.objective();
    const r = this.current;
    if (!r) return '';
    if (r.kind === 'side') return this.subObjective || 'Side room';
    if (r.kind === 'combat' && this.state(r).active && !this.state(r).cleared) return `Defeat the temporal echoes (${this.aliveCount()} left)`;
    if (r.kind === 'exit') return 'Step into the time rift to continue.';
    const done = this.combatRooms().filter((x) => this.state(x).cleared).length;
    return `Explore the floor — rooms cleared ${done}/${this.combatRooms().length}. Find the time rift.`;
  }

  // Which room's interior is the player standing in (null in corridors)?
  roomAt(px, py, inset = 1) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    return this.dg.rooms.find((r) => tx >= r.rect.x + inset && ty >= r.rect.y + inset && tx <= r.rect.x + r.rect.w - 1 - inset && ty <= r.rect.y + r.rect.h - 1 - inset) || null;
  }

  update(dt, time) {
    super.update(dt, time);
    const sc = this.scene;
    if (!sc.player || sc.ended || !this.dg) return;
    const ps = sc.player.sprite;
    const r = this.roomAt(ps.x, ps.y);
    if (r && r !== this.current) this.onEnter(r);
    if (r && r.kind === 'combat' && !this.state(r).active && !this.state(r).cleared) {
      // Seal the room only once Anon is clear of the doorway.
      if (this.roomAt(ps.x, ps.y, 2) === r) this.activate(r);
    }
    if (!this.leaving && Phaser.Math.Distance.Between(ps.x, ps.y, this.riftPos.x, this.riftPos.y) < 14) {
      this.leaving = true;
      sc.combat.collectAll();
      audio.play('timetravel', { gap: 0 });
      this.completeSublevel();
    }
  }

  onEnter(r) {
    this.current = r;
    this.inSub = r.kind === 'side' ? r.side : null;
    if (!this.visited.has(r.id)) {
      this.visited.add(r.id);
      if (r.kind === 'side') {
        const st = this.state({ id: r.side.id });
        this.backDoor = r.doors[0];
        this.scene.spawnBounds = r.rect;
        buildSubroom(this, r.side, st, { spots: r.spots });
        ui.banner(r.side.kind === 'vault' ? 'Artifact Vault' : SUBROOM_TYPES[r.side.kind].label, '', 1100);
      }
      if (r.kind === 'exit') ui.banner('The time rift', 'Step in when you’re ready', 1400);
    }
    if (r.kind === 'side') { this.backDoor = r.doors[0]; this.scene.spawnBounds = r.rect; }
    this.drawMap();
    this.scene.hudDirty = true;
  }

  activate(r) {
    const sc = this.scene;
    const st = this.state(r);
    st.active = true;
    sc.spawnBounds = r.rect;
    for (const d of r.doors) sc.lockDoor(d);
    audio.play('door', { gap: 0 });
    this.waveIndex = 0;
    this.stronger = !!sc.run.nextStronger;
    if (this.stronger) { sc.run.nextStronger = false; ui.toast('The anomaly strengthens these enemies!', 'bad'); }
    sc.time.delayedCall(450, () => this.startWave(r, 0));
    this.drawMap();
  }

  onEnemyKilled(e) {
    const sc = this.scene;
    sc.hudDirty = true;
    if (this.trial && this.trial.active) { if (this.aliveAfter(e) === 0) this.trialWon(); return; }
    if (this.vaultFight && this.aliveAfter(e) === 0) { this.vaultFight(); return; }
    const r = this.current;
    if (!r || r.kind !== 'combat') return;
    const st = this.state(r);
    if (!st.active || st.cleared || this.aliveAfter(e) > 0) return;
    if (this.waveIndex + 1 < r.waves.length) {
      const next = this.waveIndex + 1;
      this.waveIndex = next;
      sc.time.delayedCall(700, () => this.startWave(r, next));
      return;
    }
    this.roomCleared(r);
  }

  roomCleared(r) {
    const sc = this.scene;
    const st = this.state(r);
    if (st.cleared) return;
    st.cleared = true;
    sc.spawnBounds = null;
    for (const d of r.doors) sc.openDoor(d);
    audio.play('chest', { gap: 0 });
    const left = this.combatRooms().filter((x) => !this.state(x).cleared).length;
    ui.banner('ROOM CLEARED', left ? `${left} combat room${left > 1 ? 's' : ''} left on this floor` : 'Floor cleared! Find the time rift.', 1400);
    sc.combat.magnetAll();
    sc.time.delayedCall(1500, () => sc.combat.collectAll());
    this.spawnClearRewards(r, st);
    this.drawMap();
  }

  onCrackedWallHit(tile, bullet) {
    const link = this.dg.links.find((l) => l.hidden && !l.found && l.crack.some((c) => c.x === tile.x && c.y === tile.y));
    if (!link) return;
    link.hits = (link.hits || 0) + (bullet.opts.aoe ? 3 : 1);
    this.scene.combat.burst(tile.pixelX + 8, tile.pixelY + 8, 0xc8b8a0, 4, 40);
    if (link.hits >= 3 && this.state(link.a).cleared) this.revealLink(link);
  }

  revealLink(link) {
    if (link.found) return;
    link.found = true;
    const sc = this.scene;
    for (const c of link.crack) sc.layer.putTileAt(0, c.x, c.y);
    link.a.doors.push(sc.addDoor('gate', link.crack, { locked: false }));
    sc.combat.burst(link.crack[0].x * TILE + 16, link.crack[0].y * TILE + 8, 0xc8b8a0, 20, 90);
    audio.play('explosion', { gap: 0 });
    ui.toast('The cracked wall crumbles — a hidden room!', 'gold');
    this.drawMap();
  }

  // Minimap: visited rooms plus rooms visible through an open doorway.
  drawMap() {
    if (!this.dg) return;
    const known = new Set(this.visited);
    for (const l of this.dg.links) {
      if (l.hidden && !l.found) continue;
      if (this.visited.has(l.a.id)) known.add(l.b.id);
      if (this.visited.has(l.b.id)) known.add(l.a.id);
    }
    const rooms = this.dg.rooms.filter((r) => known.has(r.id)).map((r) => ({
      x: r.cell.x, y: r.cell.y, current: r === this.current,
      state: this.visited.has(r.id) ? 'visited' : 'known',
      kind: r.kind === 'side' ? r.side.kind : r.kind === 'combat' && this.state(r).cleared ? 'cleared' : r.kind,
    }));
    const links = this.dg.links.filter((l) => !(l.hidden && !l.found)).map((l) => ({ a: l.a.cell, b: l.b.cell }));
    ui.minimap({ gw: this.dg.gw, gh: this.dg.gh, rooms, links });
  }

  destroy() { ui.minimap(null); }
}

export { tileCenter };
