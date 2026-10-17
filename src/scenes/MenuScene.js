import Phaser from 'phaser';
import { app } from '../app.js';
import { ui, esc } from '../ui/ui.js';
import { audio } from '../systems/audio.js';
import { input } from '../systems/input.js';
import { createRun } from '../systems/run.js';
import { openSettings, openControls, openCredits } from '../ui/panels.js';
import { ERAS } from '../data/eras.js';
import { rand } from '../systems/rng.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    ui.showHud(false);
    ui.touch.setVisible(false);
    ui.timeCircuits(null);
    ui.caption(null);
    ui.skip(null);
    ui.closeAllModals();
    ui.rotateHint(false);
    input.enabled = true;
    input.reset();
    audio.music('menu');
    this.cameras.main.setBackgroundColor('#07070f');
    // Starfield + garage floor + the DeVios, crackling with temporal energy.
    this.stars = [];
    for (let i = 0; i < 90; i++) this.stars.push(this.add.image(rand.next() * 400, rand.next() * 140, 'star').setAlpha(rand.next()));
    this.floor = this.add.rectangle(200, 190, 600, 100, 0x161a24);
    this.add.rectangle(200, 141, 600, 2, 0x2a3140);
    for (let x = -100; x < 520; x += 40) this.add.rectangle(x, 170, 1, 60, 0x222838).setAngle(20);
    this.car = this.add.image(200, 132, 'devios_side').setOrigin(0.5, 1);
    this.glow = this.add.image(200, 132, 'devios_side_glow').setOrigin(0.5, 1).setAlpha(0);
    this.g = this.add.graphics();
    this.anon = this.add.sprite(124, 134, 'ch_anon', 0).setOrigin(0.5, 1);
    this.tweens.add({ targets: this.anon, y: 132, yoyo: true, repeat: -1, duration: 600 });
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => { this.scale.off('resize', this.layout, this); document.getElementById('screen').classList.remove('menu-left'); });
    this.boltT = 0;
    this.showMenu();
  }

  layout() {
    const cam = this.cameras.main;
    const w = this.scale.width, h = this.scale.height;
    cam.setZoom(Math.max(1, Math.min(w / 400, h / 230)));
    // On wide screens the menu sits on the left and the DeVios is shown on the right.
    const wide = w / h > 1.25;
    document.getElementById('screen').classList.toggle('menu-left', wide);
    cam.centerOn(wide ? 200 - (w / cam.zoom) * 0.2 : 200, wide ? 100 : 112);
  }

  update(time, delta) {
    for (const s of this.stars) { s.alpha += (Math.random() - 0.5) * 0.08; s.alpha = Phaser.Math.Clamp(s.alpha, 0.1, 1); }
    this.boltT -= delta;
    this.g.clear();
    if (this.boltT < 0) {
      this.boltT = 600 + Math.random() * 1600;
      this.glow.setAlpha(0.9);
      this.tweens.add({ targets: this.glow, alpha: 0, duration: 400 });
      this.bolt = 120;
    }
    if (this.bolt > 0) {
      this.bolt -= delta;
      this.g.lineStyle(1.5, 0xbff8ff, this.bolt / 120);
      for (let k = 0; k < 3; k++) {
        let x = 140 + Math.random() * 120, y = 90 + Math.random() * 30;
        this.g.beginPath(); this.g.moveTo(x, y);
        for (let i = 0; i < 5; i++) { x += (Math.random() - 0.5) * 24; y += (Math.random() - 0.5) * 18; this.g.lineTo(x, y); }
        this.g.strokePath();
      }
    }
  }

  showMenu() {
    const s = app.save.data;
    const canContinue = !!s.run && s.tutorialDone;
    const loc = s.run && s.run.location ? `${ERAS[s.run.location.era].short} · sub-level ${s.run.location.sub + 1}` : 'DeVios safe room';
    const el = ui.screen(`
      <div class="menu">
        <h1 class="logo">ANON'S<br>TIME CRISIS<small>starring the DeVios</small></h1>
        ${canContinue ? `<button class="btn primary" data-a="continue">Continue <small>(${esc(loc)})</small></button>` : ''}
        <button class="btn ${canContinue ? '' : 'primary'}" data-a="play">${canContinue ? 'New Run' : 'Play'}</button>
        <button class="btn" data-a="tutorial">Tutorial</button>
        <button class="btn" data-a="settings">Settings</button>
        <button class="btn" data-a="controls">Controls</button>
        <button class="btn" data-a="credits">Credits</button>
        <div class="foot">Alternate-history comedy & satire. All characters are fictionalized; events are invented.<br>
        ${s.completedEras.length ? `Eras cleared: ${s.completedEras.length} · Artifacts: ${s.artifacts.length}/5${s.endings.canon ? ' · Canon ending ✓' : ''}${s.endings.secret ? ' · Secret ending ✓' : ''}` : 'Best on landscape. Desktop: WASD + mouse. Mobile: touch controls.'}</div>
      </div>`);
    el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => { audio.unlock(); audio.play('select', { gap: 0 }); this.action(b.dataset.a); }));
    if (input.lastDevice !== 'touch') setTimeout(() => { const f = el.querySelector('.btn.primary'); if (f) f.focus({ preventScroll: true }); }, 50);
  }

  async action(a) {
    const s = app.save.data;
    if (a === 'continue') return this.go('Game', s.run.location ? { mode: 'stage', eraId: s.run.location.era, sub: s.run.location.sub } : { mode: 'safe' });
    if (a === 'play') {
      if (!s.openingSeen) return this.go('Cinematic', { kind: 'opening' });
      if (!s.tutorialDone) return this.go('Game', { mode: 'tutorial' });
      if (s.run && !(await ui.confirm('Start a new run? Your current run’s Time Shards, weapons and run upgrades reset. Campaign progress, artifacts, allies and permanent upgrades are kept.', 'New run'))) return;
      s.run = createRun(s);
      s.stats.runs += 1;
      app.save.commit();
      return this.go('Game', { mode: 'safe', fresh: true });
    }
    if (a === 'tutorial') return this.go('Game', { mode: 'tutorial', replay: s.tutorialDone });
    if (a === 'settings') return openSettings({ onReset: () => this.showMenu() });
    if (a === 'controls') return openControls();
    if (a === 'credits') return openCredits();
    return null;
  }

  go(key, data) {
    ui.screen(null);
    ui.fade(true, 250).then(() => { this.scene.start(key, data); ui.fade(false, 300); });
  }
}
