// Era stage flow: sub-levels -> combat rooms (+ optional sub-rooms) -> boss arena.
import Phaser from 'phaser';
import { TILE, DEPTH } from '../config.js';
import { ui } from '../ui/ui.js';
import { audio } from '../systems/audio.js';
import { input } from '../systems/input.js';
import { makeRng, rand } from '../systems/rng.js';
import { planSublevel } from '../systems/subrooms.js';
import { rollReward } from '../systems/economy.js';
import { giveWeapon, ownsWeapon } from '../systems/run.js';
import * as campaign from '../systems/campaign.js';
import { COMBAT_ROOMS, BOSS_ROOM, SUB_ROOM, SUBROOM_TYPES } from '../data/rooms.js';
import { ERAS } from '../data/eras.js';
import { BOSSES } from '../data/bosses.js';
import { ALLY_BY_ID } from '../data/allies.js';
import { ARTIFACT_BY_ID, ARTIFACTS } from '../data/artifacts.js';
import { WEAPON_BY_ID, weaponsForEra } from '../data/weapons.js';
import { COMPONENT_BY_ERA } from '../data/components.js';
import { Boss } from '../entities/Boss.js';
import { tileCenter, groupCells, insideDoor, addNpc, addImage, addGlow } from './helpers.js';
import { buildSubroom } from './subroomContent.js';

export class StageController {
  constructor(scene, data) {
    this.scene = scene;
    this.eraId = data.eraId;
    this.sub = data.sub || 0;
    this.era = ERAS[this.eraId];
    this.roomStates = {};
    this.waveIndex = 0;
    this.victory = false;
  }

  start() {
    if (!this.prepare()) return;
    this.enterRoom(this.rooms[0], 'start');
  }

  // Shared sub-level setup: launch validation, checkpoint, RNG, plan, music, banner.
  prepare() {
    const sc = this.scene;
    const save = sc.save.data;
    const v = campaign.validateLaunch(save, this.eraId, this.sub);
    if (!v.ok) {
      ui.toast(v.reason, 'bad');
      sc.scene.restart({ mode: 'safe' });
      return false;
    }
    if (this.sub === 0 && sc.data_.fromSafe) sc.run.hp = 0; // full health when departing from the DeVios
    sc.run.location = { era: this.eraId, sub: this.sub };
    sc.run.lastEra = this.eraId;
    sc.checkpoint();
    this.rng = makeRng((Date.now() ^ (this.sub * 7919)) >>> 0);
    this.plan = planSublevel({ rng: this.rng, eraId: this.eraId, sub: this.sub, difficulty: save.settings.difficulty, save });
    this.rooms = this.plan.rooms;
    audio.music(this.plan.isBoss ? 'boss' : this.eraId);
    ui.banner(this.era.name, `${this.sub + 1}/3 · ${this.era.subs[this.sub]}`, 2200);
    return true;
  }

  describe() { return `Sub-level ${this.sub + 1}/3: ${this.era.subs[this.sub]}`; }
  hudTitle() { return `${this.era.short} · ${this.sub + 1}/3 ${this.era.subs[this.sub]}`; }
  canRestart() { return !this.scene.ended; }
  restartLabel() { return this.plan && this.plan.isBoss ? 'Restart boss fight' : 'Restart sub-level'; }
  restart() { this.scene.scene.restart({ mode: 'stage', eraId: this.eraId, sub: this.sub }); }

  objective() {
    const st = this.current && this.state(this.current);
    if (this.trial && this.trial.active) return `Weapon Trial: defeat every enemy! ${Math.max(0, Math.ceil(this.trial.left / 1000))}s`;
    if (!this.current) return '';
    if (this.current.kind === 'boss') {
      if (this.victory) return this.eraId === 'modern' ? 'Victory! Step into the exit to return… home?' : 'Victory! Take the exit to return to the DeVios.';
      return `Defeat ${this.era.boss.map((b) => BOSSES[b].name).join(' & ')}!`;
    }
    if (this.inSub) return this.subObjective || `${SUBROOM_TYPES[this.inSub.kind] ? SUBROOM_TYPES[this.inSub.kind].label : 'Artifact Vault'} — exit through the left door when done.`;
    if (!st.cleared) return `Defeat the temporal echoes (${this.aliveCount()} left)`;
    const last = this.rooms.indexOf(this.current) === this.rooms.length - 1;
    if (this.current.side && !st.sideVisited && !this.current.side.hidden) return `Room clear! Optional room to the side — or head north${last ? ' to the next sub-level' : ''}.`;
    return `Room clear! Head through the north door${last ? ' to the next sub-level' : ''}.`;
  }

  aliveCount() { return this.scene.enemies.filter((e) => !e.dead).length + (this.pendingSpawns || 0); }

  state(room) {
    if (!this.roomStates[room.id]) this.roomStates[room.id] = { cleared: false, taken: new Set(), rewards: null, sideVisited: false, hiddenFound: false, hiddenHits: 0 };
    return this.roomStates[room.id];
  }

  // ---------------------------------------------------------------------------------------
  enterRoom(room, entrance) {
    const sc = this.scene;
    this.current = room;
    this.inSub = null;
    this.subObjective = null;
    sc.transitioning = false;
    if (room.kind === 'boss') return this.enterBoss(room);
    const st = this.state(room);
    const template = COMBAT_ROOMS.find((t) => t.id === room.template) || COMBAT_ROOMS[0];
    const r = sc.buildRoom(template, this.eraId);
    // Exit door (north)
    this.exitDoor = sc.addDoor('exit', r.spots.X, { locked: !st.cleared, onEnter: () => this.leaveRoom(room) });
    // Optional side door
    this.sideDoor = null;
    if (room.side) {
      const g = groupCells(r.spots.S)[0];
      const info = SUBROOM_TYPES[room.side.kind] || { icon: '◆', color: 0xffd400, label: 'Artifact Vault' };
      this.sideDoor = sc.addDoor('side', g, {
        locked: !st.cleared, hidden: room.side.hidden && !st.hiddenFound,
        icon: room.side.kind === 'vault' ? '◆' : info.icon, color: room.side.kind === 'vault' ? 0xffd400 : info.color,
        onEnter: () => this.enterSub(room),
      });
      if (room.side.hidden && !st.hiddenFound) this.addCrackedWallHint(room, g);
      if (room.side.kind === 'vault' && !st.cleared) this.vaultHint = true;
    }
    const spawn = entrance === 'side' && this.sideDoor ? insideDoor(r, this.sideDoor.cells) : tileCenter(r.spots.P[0]);
    sc.spawnPlayer(spawn.x, spawn.y);
    sc.wirePhysics();
    if (!st.cleared) {
      this.waveIndex = 0;
      this.stronger = !!sc.run.nextStronger;
      if (this.stronger) { sc.run.nextStronger = false; ui.toast('The anomaly strengthens these enemies!', 'bad'); }
      sc.time.delayedCall(700, () => this.startWave(room, 0));
    } else {
      this.spawnClearRewards(room, st);
    }
  }

  startWave(room, i) {
    const sc = this.scene;
    if (this.current !== room || sc.ended) return;
    const wave = room.waves[i];
    this.waveIndex = i;
    if (i > 0) ui.toast(`Wave ${i + 1}!`, 'bad');
    const spots = rand.shuffle((room.spots || sc.room.spots).e.map(tileCenter));
    this.pendingSpawns = 0;
    wave.forEach((en, k) => {
      let pt = spots[k % spots.length];
      pt = { x: pt.x + (rand.next() - 0.5) * 12, y: pt.y + (rand.next() - 0.5) * 12 };
      if (Phaser.Math.Distance.Between(pt.x, pt.y, sc.player.sprite.x, sc.player.sprite.y) < 70) pt = sc.safeSpawnPoint(null, 90);
      sc.spawnEnemy(en.type, pt.x, pt.y, { elite: en.elite, stronger: this.stronger });
    });
    this.hudPing();
  }

  hudPing() { this.scene.hudDirty = true; }

  onEnemyKilled(e) {
    const sc = this.scene;
    sc.hudDirty = true;
    if (this.trial && this.trial.active) {
      if (this.aliveAfter(e) === 0) this.trialWon();
      return;
    }
    if (this.vaultFight && this.aliveAfter(e) === 0) { this.vaultFight(); return; }
    if (this.current && this.current.kind === 'boss') {
      if (e.isBoss) this.bossDown(e);
      return;
    }
    if (this.inSub || !this.current) return;
    if (this.aliveAfter(e) > 0) return;
    const room = this.current;
    const st = this.state(room);
    if (st.cleared) return;
    if (this.waveIndex + 1 < room.waves.length) {
      const next = this.waveIndex + 1;
      this.waveIndex = next;
      sc.time.delayedCall(700, () => this.startWave(room, next));
      return;
    }
    this.roomCleared(room);
  }

  aliveAfter(e) { return this.scene.enemies.filter((x) => !x.dead && x !== e).length; }

  roomCleared(room) {
    const sc = this.scene;
    const st = this.state(room);
    if (st.cleared) return;
    st.cleared = true;
    audio.play('chest', { gap: 0 });
    ui.banner('ROOM CLEARED', this.vaultHint && room.side && room.side.kind === 'vault' ? 'A glinting vault door opens to the side…' : '', 1500);
    sc.openDoor(this.exitDoor);
    if (this.sideDoor && !this.sideDoor.hidden) sc.openDoor(this.sideDoor);
    sc.combat.magnetAll();
    sc.time.delayedCall(1500, () => sc.combat.collectAll());
    this.spawnClearRewards(room, st);
    sc.hudDirty = true;
  }

  rollRewards(room) {
    const run = this.scene.run;
    const out = [];
    let w = room.guaranteedWeapon && !ownsWeapon(run, room.guaranteedWeapon) ? room.guaranteedWeapon : null;
    if (!w && rand.chance(0.45)) {
      const pool = weaponsForEra(this.eraId).filter((d) => !ownsWeapon(run, d.id));
      if (pool.length) w = rand.pick(pool).id;
    }
    if (w) out.push({ id: `${room.id}-w`, kind: 'weapon', weapon: w });
    if (rand.chance(0.3)) out.push({ id: `${room.id}-chest`, kind: 'chest', size: 'small' });
    return out;
  }

  spawnClearRewards(room, st) {
    const sc = this.scene;
    if (!st.rewards) st.rewards = this.rollRewards(room);
    const roomSpots = room.spots || sc.room.spots;
    const c = tileCenter(roomSpots.c[0]);
    st.rewards.forEach((rw, i) => {
      if (st.taken.has(rw.id)) return;
      const x = c.x + (i - (st.rewards.length - 1) / 2) * 28, y = c.y;
      if (rw.kind === 'weapon') this.addWeaponPickup(rw, st, x, y);
      if (rw.kind === 'chest') this.addChest(rw, st, x, y, 'small');
    });
    const n = tileCenter(roomSpots.n[0]);
    if (room.recruit && !sc.save.data.allies.includes(room.recruit)) this.addRecruit(room.recruit, n.x, n.y);
    if (room.special && !sc.save.data.allies.includes(room.special.ally)) this.addSpecial(room.special, n.x + (room.recruit ? 40 : 0), n.y);
  }

  addWeaponPickup(rw, st, x, y) {
    const sc = this.scene;
    const def = WEAPON_BY_ID[rw.weapon];
    const glow = addGlow(sc, x, y, def.rarity === 'rare' ? 0xc080ff : 0xffd400, 12);
    const img = addImage(sc, `w_${def.id}`, x, y, { bob: true, depth: DEPTH.pickup });
    const it = sc.addInteractable({
      x, y, r: 22,
      label: () => `Take ${def.name} (${def.category})${sc.run.loadout.length >= 4 ? ' — swaps current weapon to your stash' : ''}`,
      use: () => {
        if (st.taken.has(rw.id)) return;
        st.taken.add(rw.id);
        const res = giveWeapon(sc.run, def.id);
        audio.play('pickup', { gap: 0 });
        ui.toast(res === 'swapped' ? `Equipped ${def.name}. Previous weapon moved to your DeVios stash.` : `Got ${def.name}!`, 'good');
        sc.player.refreshWeapon();
        img.destroy(); glow.destroy();
        sc.removeInteractable(it);
      },
    });
  }

  addChest(rw, st, x, y, size = 'small', extra = null) {
    const sc = this.scene;
    const key = size === 'large' ? 'chest_large' : size === 'vault' ? 'chest_vault' : 'chest_small';
    const img = addImage(sc, key, x, y);
    const it = sc.addInteractable({
      x, y, r: 22, label: size === 'vault' ? 'Open the vault' : 'Open chest',
      use: () => {
        if (st.taken.has(rw.id)) return;
        st.taken.add(rw.id);
        sc.removeInteractable(it);
        img.setTexture('chest_open');
        audio.play('chest', { gap: 0 });
        sc.combat.burst(x, y, 0xffd400, 14, 80);
        const kind = size === 'large' ? 'chestLarge' : size === 'hidden' ? 'hidden' : 'chestSmall';
        sc.combat.dropShards(x, y - 6, rollReward(this.rng, kind, sc.save.data.settings.difficulty), sc.shardTexture());
        if (rand.chance(size === 'small' ? 0.25 : 0.4)) sc.combat.dropItem('heart', x + 10, y + 6);
        if (rand.chance(0.2)) {
          const k = rand.pick(['bomb', 'patch', 'shield']);
          if (sc.run.consumables[k] < 9) { sc.run.consumables[k] += 1; ui.toast(`Found a ${{ bomb: 'Chrono Bomb', patch: 'Med Patch', shield: 'Shield Bubble' }[k]}!`, 'good'); }
        }
        if (extra) extra(x, y);
        sc.hudDirty = true;
      },
    });
    return img;
  }

  addRecruit(allyId, x, y) {
    const sc = this.scene;
    const ally = ALLY_BY_ID[allyId];
    const npc = addNpc(sc, `ch_${ally.id}`, x, y, ally.name);
    const glow = addGlow(sc, x, y + 4, 0x5fff8a, 12);
    const it = sc.addInteractable({
      x, y, r: 24, label: `Talk to ${ally.name}`,
      use: async () => {
        sc.removeInteractable(it);
        await ui.dialog(ally.recruit);
        this.recruit(ally);
        npc.destroy(); glow.destroy();
      },
    });
  }

  recruit(ally) {
    const sc = this.scene;
    const first = campaign.unlockAlly(sc.save.data, ally.id);
    if (!sc.save.data.activeAlly) sc.save.data.activeAlly = ally.id;
    sc.save.commit();
    if (first) {
      audio.play('artifact', { gap: 0 });
      ui.banner(`${ally.name} joined!`, `${ally.roleLabel}. Choose your active ally in the DeVios.`, 2400);
      if (sc.save.data.activeAlly === ally.id) sc.spawnAlly();
    }
    sc.hudDirty = true;
  }

  addSpecial(sp, x, y) {
    const sc = this.scene;
    const ally = ALLY_BY_ID[sp.ally];
    if (sp.kind === 'easel') {
      const img = addImage(sc, 'st_easel', x, y, { origin: [0.5, 0.75] });
      const glow = addGlow(sc, x, y, 0x9a9aff, 12);
      const it = sc.addInteractable({
        x, y, r: 24,
        label: () => (ownsWeapon(sc.run, sp.needs) ? 'Sketch on the easel with Rizal’s Quill' : 'A blank easel. (Needs Rizal’s Quill and Book)'),
        use: async () => {
          if (!ownsWeapon(sc.run, sp.needs)) {
            ui.toast('You need Rizal’s Quill and Book to draw here. It appears early in this era.', 'bad');
            return;
          }
          sc.removeInteractable(it);
          await ui.dialog(['Anon dips Rizal’s Quill in ink and sketches a determined young man in a frock coat…', ...ally.recruit]);
          this.recruit(ally);
          img.setTexture('st_easel');
          glow.destroy();
        },
      });
    }
  }

  addCrackedWallHint(room, cells) {
    const sc = this.scene;
    const st = this.state(room);
    const pt = insideDoor(sc.room, cells);
    const it = sc.addInteractable({
      x: pt.x, y: pt.y, r: 26, label: 'Inspect the cracked wall', enabled: () => !st.hiddenFound && st.cleared,
      use: () => this.revealHidden(room),
    });
    this.crackIt = it;
  }

  onCrackedWallHit(tile, bullet) {
    const room = this.current;
    if (!room || !room.side || !room.side.hidden) return;
    const st = this.state(room);
    st.hiddenHits += bullet.opts.aoe ? 3 : 1;
    this.scene.combat.burst(tile.pixelX + 8, tile.pixelY + 8, 0xc8b8a0, 4, 40);
    if (st.hiddenHits >= 3 && st.cleared) this.revealHidden(room);
  }

  revealHidden(room) {
    const sc = this.scene;
    const st = this.state(room);
    if (st.hiddenFound) return;
    st.hiddenFound = true;
    sc.openDoor(this.sideDoor);
    sc.combat.burst(this.sideDoor.cx, this.sideDoor.cy, 0xc8b8a0, 20, 90);
    audio.play('explosion', { gap: 0 });
    ui.toast('The cracked wall crumbles — a hidden room!', 'gold');
  }

  leaveRoom(room) {
    const idx = this.rooms.indexOf(room);
    if (idx < this.rooms.length - 1) {
      ui.fade(true, 200).then(() => { this.enterRoom(this.rooms[idx + 1], 'start'); ui.fade(false, 250); });
    } else this.completeSublevel();
  }

  completeSublevel() {
    const sc = this.scene;
    const nextSub = this.sub + 1;
    sc.checkpoint({ location: { era: this.eraId, sub: nextSub } });
    sc.ended = true;
    ui.fade(true, 350).then(() => { sc.scene.restart({ mode: 'stage', eraId: this.eraId, sub: nextSub }); ui.fade(false, 350); });
  }

  // ---------------------------------------------------------------------------------------
  // Optional sub-rooms
  // ---------------------------------------------------------------------------------------
  enterSub(parent) {
    const sc = this.scene;
    const side = parent.side;
    this.state(parent).sideVisited = true;
    const st = this.state({ id: side.id });
    ui.fade(true, 200).then(() => {
      this.current = parent;
      this.inSub = side;
      sc.transitioning = false;
      const r = sc.buildRoom(SUB_ROOM, this.eraId);
      this.backDoor = sc.addDoor('back', r.spots.B, { locked: false, onEnter: () => ui.fade(true, 200).then(() => { this.enterRoom(parent, 'side'); ui.fade(false, 250); }) });
      const spawn = insideDoor(r, r.spots.B);
      sc.spawnPlayer(spawn.x, spawn.y);
      sc.wirePhysics();
      buildSubroom(this, side, st, r);
      const label = side.kind === 'vault' ? 'Artifact Vault' : SUBROOM_TYPES[side.kind].label;
      ui.banner(label, '', 1100);
      ui.fade(false, 250);
    });
  }

  // ---------------------------------------------------------------------------------------
  // Boss arena
  // ---------------------------------------------------------------------------------------
  enterBoss(room) {
    const sc = this.scene;
    const r = sc.buildRoom(BOSS_ROOM, this.eraId);
    this.exitDoor = sc.addDoor('exit', r.spots.X, { locked: true, onEnter: () => this.finishEra() });
    const p = tileCenter(r.spots.P[0]);
    sc.spawnPlayer(p.x, p.y);
    sc.wirePhysics();
    sc.player.frozen = true;
    const ids = room.bosses;
    if (ids.length > 1) sc.bossConductor = { lastBig: 0, lastBigBy: null };
    const es = r.spots.e.map(tileCenter);
    this.bosses = ids.map((id, i) => {
      const pt = ids.length > 1 ? es[1 + i] : es[0];
      const b = new Boss(sc, BOSSES[id], pt.x, pt.y);
      sc.addBoss(b);
      return b;
    });
    const intro = ids.flatMap((id) => BOSSES[id].intro);
    sc.time.delayedCall(500, async () => {
      if (sc.ended) return;
      audio.play('boss_intro', { gap: 0 });
      ui.banner(ids.map((id) => BOSSES[id].name).join(' & '), ids.map((id) => BOSSES[id].title).join(' · '), 2600);
      sc.cameras.main.pan(this.bosses[0].x, this.bosses[0].y, 500);
      await new Promise((res) => sc.time.delayedCall(900, res));
      await ui.dialog(intro);
      if (sc.ended) return;
      sc.cameras.main.startFollow(sc.player.sprite, true, 0.15, 0.15);
      sc.player.frozen = false;
      input.reset();
      for (const b of this.bosses) b.begin();
      sc.hudDirty = true;
    });
  }

  bossDown(boss) {
    const sc = this.scene;
    // Dramatic defeat burst
    for (let i = 0; i < 5; i++) sc.time.delayedCall(i * 140, () => { sc.combat.burst(boss.x + (rand.next() - 0.5) * 30, boss.y + (rand.next() - 0.5) * 30, 0xffa040, 12, 90); audio.play('explosion', { gap: 0 }); });
    sc.combat.shake(0.015, 500);
    if (this.bosses.every((b) => b.dead)) this.bossVictory();
    else ui.toast(`${boss.bossDef.name} is down! One more!`, 'gold');
  }

  bossVictory() {
    if (this.victory) return; // progression triggers exactly once
    this.victory = true;
    const sc = this.scene;
    const save = sc.save.data;
    sc.combat.clearEnemyBullets();
    sc.combat.cancelTelegraphs();
    for (const e of sc.enemies.slice()) if (!e.dead && !e.isBoss) { e.noReward = true; e.die(); }
    audio.play('boss_defeat', { gap: 0 });
    let comp = null;
    for (const b of this.bosses) {
      const res = campaign.recordBossDefeat(save, b.bossDef.id);
      if (res.component) comp = res.component;
      // Boss Time Shards are paid once per boss per run.
      const amount = sc.run.bossRewarded.includes(b.bossDef.id) ? 3 : rollReward(this.rng, 'boss');
      if (!sc.run.bossRewarded.includes(b.bossDef.id)) sc.run.bossRewarded.push(b.bossDef.id);
      sc.combat.dropShards(b.x, b.y, amount, sc.shardTexture());
    }
    sc.save.commit();
    sc.time.delayedCall(800, () => sc.combat.magnetAll());
    sc.time.delayedCall(1200, async () => {
      if (sc.ended) return;
      await ui.dialog(this.bosses.flatMap((b) => b.bossDef.defeat));
      if (sc.ended) return;
      const c = COMPONENT_BY_ERA[this.eraId];
      if (c) {
        ui.banner('DeVios component recovered!', comp ? c.name : `${c.name} (already installed)`, 2600);
        const pt = tileCenter(sc.room.spots.c[0]);
        const g = addImage(sc, 'component', pt.x, pt.y, { bob: true });
        sc.tweens.add({ targets: g, x: sc.player.sprite.x, y: sc.player.sprite.y, delay: 900, duration: 500, onComplete: () => g.destroy() });
      } else {
        ui.banner('VICTORY!', 'The timeline shudders…', 2400);
      }
      if (this.eraId === 'marcos') {
        const missing = ARTIFACTS.filter((a) => !save.artifacts.includes(a.id));
        sc.time.delayedCall(2800, () => {
          if (!missing.length) {
            ui.banner('All five artifacts collected!', 'The time circuits now accept a new destination: 202X', 3200);
            save.secretUnlockNotified = true;
            sc.save.commit();
          } else {
            ui.toast(`Missing artifacts: ${missing.map((a) => a.name).join(', ')}. Revisit their eras to unlock a secret destination.`, 'gold');
          }
        });
      }
      sc.openDoor(this.exitDoor);
      sc.combat.collectAll();
      sc.checkpoint({ location: null });
      sc.hudDirty = true;
    });
  }

  finishEra() {
    const sc = this.scene;
    sc.combat.collectAll();
    sc.checkpoint({ location: null });
    if (this.eraId === 'modern') sc.goto('Cinematic', { kind: 'secret' });
    else sc.goto('Cinematic', { kind: 'return', era: this.eraId });
  }

  // ---------------------------------------------------------------------------------------
  onDefeat() {
    const sc = this.scene;
    sc.scene.pause();
    ui.touch.setVisible(false);
    ui.modal({
      title: 'Anon is down!', closable: false,
      content: `<p>The timeline wobbles… but the DeVios can rewind to the start of <b>${this.era.subs[this.sub]}</b>.</p><p>Artifacts, allies and campaign progress are safe. Time Shards return to their amount at the start of this sub-level.</p>`,
      buttons: [
        { label: this.plan.isBoss ? 'Retry boss' : 'Retry sub-level', cls: 'primary', action: (m) => { m.close(); sc.scene.restart({ mode: 'stage', eraId: this.eraId, sub: this.sub }); } },
        { label: 'Return to the DeVios', action: (m) => { m.close(); const s = sc.save.data; if (s.run) { s.run.location = null; sc.save.commit(); } sc.goto('Game', { mode: 'safe' }); } },
        { label: 'Main menu', action: (m) => { m.close(); sc.toMenu(); } },
      ],
    });
  }

  update(dt) {
    if (this.trial && this.trial.active) {
      this.trial.left -= dt;
      if (this.trial.left <= 0) this.trialLost();
    }
  }

  destroy() {}
}

export { TILE };
