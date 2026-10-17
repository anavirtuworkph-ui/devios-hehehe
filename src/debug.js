// Small console/testing hook used by the automated browser tests (scripts/e2e.mjs).
import { app } from './app.js';
import { createRun } from './systems/run.js';
import { ARTIFACTS } from './data/artifacts.js';
import * as campaign from './systems/campaign.js';

export function installDebug(game) {
  window.__ATC = {
    app,
    game,
    campaign,
    errors: [],
    scene: () => game.scene.getScenes(true).map((s) => s.scene.key),
    game_: () => game.scene.getScene('Game'),
    newRun() { app.save.data.run = createRun(app.save.data); app.save.data.tutorialDone = true; app.save.data.openingSeen = true; app.save.commit(); },
    start(data) { game.scene.getScenes(true).forEach((s) => s.scene.stop()); game.scene.start('Game', data); },
    cinematic(kind, data = {}) { game.scene.getScenes(true).forEach((s) => s.scene.stop()); game.scene.start('Cinematic', { kind, ...data }); },
    killAll() { const g = game.scene.getScene('Game'); if (g && g.enemies) for (const e of g.enemies.slice()) if (!e.dead) { if (e.isBoss) e.active = true; e.spawning = false; e.damage(1e6, { fixed: true }); } },
    player() { const g = game.scene.getScene('Game'); return g && g.player; },
    tp(x, y) { const p = this.player(); if (p) { p.sprite.setPosition(x, y); p.sprite.body.reset(x, y); } },
    door(kind) {
      const g = game.scene.getScene('Game');
      const d = g && g.doors.find((x) => x.kind === kind && !x.locked && !x.hidden);
      if (!d) return false;
      this.tp(d.cx, d.cy);
      return true;
    },
    state() {
      const g = game.scene.getScene('Game');
      if (!g || !game.scene.isActive('Game')) return { scenes: this.scene() };
      const c = g.ctrl || {};
      return {
        scenes: this.scene(), mode: g.mode, era: c.eraId, sub: c.sub, room: c.current && c.current.id, kind: c.current && c.current.kind,
        inSub: c.inSub && c.inSub.kind, alive: g.enemies.filter((e) => !e.dead).length, doors: g.doors.map((d) => `${d.kind}:${d.locked ? 'L' : d.hidden ? 'H' : 'O'}`),
        shards: g.run && g.run.shards, hp: g.player && g.player.hp, victory: c.victory, modals: document.querySelectorAll('.modal').length,
        dialog: !document.getElementById('dialog').classList.contains('hidden'), interact: g.interactables.length,
      };
    },
    grantAll() { for (const a of ARTIFACTS) campaign.collectArtifact(app.save.data, a.id); app.save.commit(); },
    defeatMain(upTo = 5) { ['magellan', 'damaso', 'mckinley', 'saitoh', 'marcos'].slice(0, upTo).forEach((b) => campaign.recordBossDefeat(app.save.data, b)); app.save.commit(); },
  };
  window.addEventListener('error', (e) => window.__ATC.errors.push(String(e.message || e)));
  window.addEventListener('unhandledrejection', (e) => window.__ATC.errors.push(String(e.reason)));
}
