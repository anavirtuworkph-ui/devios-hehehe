// Short, skippable cinematics drawn with in-engine sprites: the opening, the time-circuit
// malfunction/departure, era launches/returns, and both endings.
import Phaser from 'phaser';
import { app, persistRun } from '../app.js';
import { ui } from '../ui/ui.js';
import { audio } from '../systems/audio.js';
import { input } from '../systems/input.js';
import { ERAS } from '../data/eras.js';
import { createRun } from '../systems/run.js';
import { rand } from '../systems/rng.js';

const W = 320, H = 180;

export class CinematicScene extends Phaser.Scene {
  constructor() { super('Cinematic'); }

  init(data) { this.cfg = data || { kind: 'opening' }; }

  create() {
    this.done = false;
    this.arcs = 0;
    this.shakeAmt = 0;
    ui.showHud(false);
    ui.touch.setVisible(false);
    ui.screen(null);
    ui.closeAllModals();
    ui.rotateHint(false);
    ui.prompt(null);
    input.reset();
    this.cameras.main.setBackgroundColor('#000');
    this.g = this.add.graphics().setDepth(50);
    this.fit();
    this.onResize = () => this.fit();
    this.game.events.on('app-resize', this.onResize);
    this.events.once('shutdown', () => {
      this.game.events.off('app-resize', this.onResize);
      ui.caption(null); ui.skip(null); ui.timeCircuits(null);
      window.removeEventListener('keydown', this.onKey);
    });
    ui.skip(() => this.finish());
    this.onKey = (e) => { if (e.code === 'Escape') this.finish(); };
    window.addEventListener('keydown', this.onKey);
    const fn = this[`play_${this.cfg.kind}`];
    if (!fn) { this.finish(); return; }
    fn.call(this).catch((err) => { console.error(err); this.finish(); });
  }

  fit() {
    const cam = this.cameras.main;
    const zoom = Math.min(this.scale.width / W, this.scale.height / H);
    cam.setZoom(zoom);
    cam.centerOn(W / 2, H / 2);
  }

  wait(ms) { return new Promise((r) => this.time.delayedCall(ms, r)); }

  say(text) { if (!this.done) ui.caption(text); }

  flash(color = 0xffffff, ms = 400) {
    const f = this.add.rectangle(W / 2, H / 2, W * 2, H * 2, color).setDepth(100);
    this.tweens.add({ targets: f, alpha: 0, duration: ms, onComplete: () => f.destroy() });
  }

  update(t, dt) {
    this.g.clear();
    if (this.arcs > 0 && this.car) {
      this.g.lineStyle(1.2, 0xbff8ff, 0.9);
      const n = Math.ceil(this.arcs * 6);
      for (let k = 0; k < n; k++) {
        let x = this.car.x + (Math.random() - 0.5) * this.car.displayWidth;
        let y = this.car.y - Math.random() * this.car.displayHeight;
        this.g.beginPath(); this.g.moveTo(x, y);
        for (let i = 0; i < 4; i++) { x += (Math.random() - 0.5) * 22; y += (Math.random() - 0.5) * 16; this.g.lineTo(x, y); }
        this.g.strokePath();
      }
      if (Math.random() < this.arcs * 0.3) audio.play('zap', { gap: 90 });
    }
    if (this.distort && this.car) {
      this.g.lineStyle(1, 0x7ff6ff, 0.5);
      const r = 20 + ((t / 6) % 50);
      this.g.strokeEllipse(this.car.x, this.car.y - 14, r * 2.4, r);
    }
    if (this.shakeAmt > 0) this.cameras.main.shake(60, this.shakeAmt);
    if (this.dust) for (const d of this.dust) { d.x += d.vx * dt / 1000; if (d.x > W + 10) d.x = -10; }
  }

  // ---- backdrops -------------------------------------------------------------------------------
  lab() {
    this.add.rectangle(W / 2, 60, W, 120, 0x1a2030);
    for (let x = 0; x < W; x += 32) this.add.rectangle(x + 16, 60, 30, 110, 0x222a3c).setStrokeStyle(1, 0x2e3850);
    this.add.rectangle(W / 2, 150, W, 60, 0x2a3140);
    for (let x = 0; x < W; x += 16) this.add.rectangle(x, 150, 1, 60, 0x323a4a);
    [['prop_tank', 30], ['prop_console', 58], ['prop_tank', 290], ['prop_crate_tech', 268]].forEach(([k, x]) => this.add.image(x, 126, k).setOrigin(0.5, 1).setScale(1.4));
    this.lights = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(60);
  }

  eraBackdrop(eraId) {
    const era = ERAS[eraId] || ERAS.lab;
    if (eraId === 'lab') return this.lab();
    const p = era.palette;
    const sky = { precolonial: 0x6ac0e8, spanish: 0xe8b080, american: 0xc8c090, japanese: 0x707478, marcos: 0x403050, modern: 0x201838 }[eraId] || 0x333333;
    this.add.rectangle(W / 2, 60, W, 120, sky);
    if (eraId === 'precolonial') this.add.rectangle(W / 2, 112, W, 16, 0x2a7ac0);
    this.add.rectangle(W / 2, 150, W, 60, Phaser.Display.Color.HexStringToColor(p.floor[0]).color);
    const props = era.props || [];
    for (let i = 0; i < 7; i++) this.add.image(20 + i * 48, 126, `prop_${props[i % props.length]}`).setOrigin(0.5, 1).setScale(1.3).setAlpha(0.9);
  }

  placeCar(x = W / 2 + 30, y = 140, key = 'devios_side') {
    this.car = this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(10);
    this.carGlow = this.add.image(x, y, 'devios_side_glow').setOrigin(0.5, 1).setDepth(11).setAlpha(0);
    // Flight mode: hover gently on the folded wheels.
    this.tweens.add({ targets: [this.car, this.carGlow], y: y - 3, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.easeInOut' });
    return this.car;
  }

  anon(x, y = 140) { return this.add.sprite(x, y, 'ch_anon', 0).setOrigin(0.5, 1).setDepth(12).setScale(1.2); }

  async powerUp(ms = 2600) {
    audio.play('charge', { gap: 0, dur: ms / 1000 });
    this.distort = true;
    const steps = 10;
    for (let i = 1; i <= steps && !this.done; i++) {
      this.arcs = i / steps;
      this.shakeAmt = 0.001 + 0.006 * (i / steps);
      this.carGlow.setAlpha(i % 2 ? 0.9 : 0.4);
      await this.wait(ms / steps);
    }
  }

  async vanish() {
    audio.play('timetravel', { gap: 0 });
    this.flash(0xe8ffff, 700);
    const x = this.car.x;
    this.car.setVisible(false); this.carGlow.setVisible(false);
    this.arcs = 0; this.distort = false; this.shakeAmt = 0;
    // Twin fire trails left behind
    for (const dy of [-2, 6]) {
      const trail = this.add.rectangle(x - 10, 138 + dy, 200, 2, 0xff8a20).setOrigin(1, 0.5).setDepth(9);
      this.tweens.add({ targets: trail, alpha: 0, duration: 1600 });
    }
  }

  async arrive(x = W / 2 + 30) {
    this.flash(0xe8ffff, 600);
    audio.play('explosion', { gap: 0 });
    this.placeCar(x);
    this.carGlow.setAlpha(0.8);
    this.tweens.add({ targets: this.carGlow, alpha: 0, duration: 1200 });
    for (let i = 0; i < 30; i++) {
      const s = this.add.image(x + (rand.next() - 0.5) * 120, 130 - rand.next() * 40, 'spark').setDepth(13).setTint(0x9ff6ff);
      this.tweens.add({ targets: s, y: s.y - 20, alpha: 0, duration: 700 + rand.next() * 600, onComplete: () => s.destroy() });
    }
  }

  // ---- cinematics --------------------------------------------------------------------------------
  async play_opening() {
    audio.music('lab');
    this.lab();
    const bench = this.add.rectangle(80, 128, 50, 6, 0x5a3a20).setDepth(5);
    this.add.rectangle(62, 140, 4, 22, 0x5a3a20); this.add.rectangle(98, 140, 4, 22, 0x5a3a20);
    const flask = this.add.circle(86, 118, 6, 0x5fff8a).setDepth(6);
    this.add.rectangle(86, 110, 4, 6, 0x9fd0d0).setDepth(6);
    const a = this.anon(60, 132);
    this.placeCar(225, 140);
    this.car.setVisible(false);
    const sheet = this.add.rectangle(225, 118, 140, 46, 0x8a8aa0).setDepth(14).setStrokeStyle(1, 0x5a5a70);
    const bubbles = this.time.addEvent({ delay: 140, loop: true, callback: () => { const b = this.add.circle(86 + (Math.random() - 0.5) * 6, 114, 1.5, 0x9ff6ff).setDepth(7); this.tweens.add({ targets: b, y: 96, alpha: 0, duration: 800, onComplete: () => b.destroy() }); } });
    this.say('The year is 205X.');
    await this.wait(2000);
    this.say('Anon, an eccentric scientist, is experimenting with a mysterious material linked to time-machine technology…');
    this.tweens.add({ targets: a, y: 130, yoyo: true, repeat: 6, duration: 200 });
    await this.wait(3000);
    this.say('Anon: Just a pinch more… and a little more… and—');
    flask.setFillStyle(0xffd400);
    await this.wait(1500);
    if (this.done) return;
    this.flash(0xffffff, 600);
    audio.play('explosion', { gap: 0 });
    this.cameras.main.shake(400, 0.01);
    for (let i = 0; i < 24; i++) { const s = this.add.image(86, 116, 'spark').setDepth(20).setTint(rand.pick([0x9ff6ff, 0xffd400, 0x5fff8a])); this.tweens.add({ targets: s, x: 86 + (Math.random() - 0.5) * 120, y: 116 + (Math.random() - 0.7) * 90, alpha: 0, duration: 900, onComplete: () => s.destroy() }); }
    flask.setFillStyle(0x7ff6ff);
    this.say('He miscalculated the mixture — and accidentally recreated the conditions for TIME TRAVEL!');
    for (let i = 0; i < 6; i++) { this.lights.setAlpha(i % 2 ? 0 : 0.6); await this.wait(140); }
    bubbles.remove();
    await this.wait(1600);
    this.say('Anon: I know exactly what to put this in.');
    this.tweens.add({ targets: a, x: 140, duration: 1200 });
    await this.wait(1300);
    this.tweens.add({ targets: sheet, y: 40, alpha: 0, duration: 700 });
    this.car.setVisible(true);
    audio.play('ending', { gap: 0 });
    this.carGlow.setAlpha(1);
    this.tweens.add({ targets: this.carGlow, alpha: 0.2, duration: 900 });
    const title = this.add.text(W / 2, 34, 'THE DeVIOS', { fontFamily: '"Press Start 2P", monospace', fontSize: '16px', color: '#ffd400', stroke: '#b02020', strokeThickness: 4 }).setOrigin(0.5).setDepth(70).setResolution(4);
    title.setScale(0.2);
    this.tweens.add({ targets: title, scale: 1, duration: 500, ease: 'Back.easeOut' });
    this.say('A 2026 Toyota Vios — rebuilt into a time machine. Meet the DeVios.');
    await this.wait(2800);
    this.say('Exposed wiring. A rear-mounted temporal reactor. Glowing time circuits. A flux-style power core. Overengineered? Absolutely.');
    const labels = [['Rear temporal reactor', 175, 82, 186, 108], ['Exposed cables', 205, 160, 215, 128], ['Time circuits', 262, 80, 245, 112], ['Flux core', 150, 56, 178, 100]];
    for (const [txt, lx, ly, px, py] of labels) {
      if (this.done) return;
      const t = this.add.text(lx, ly, txt, { fontFamily: 'monospace', fontSize: '7px', color: '#7ff6ff', backgroundColor: '#000a', padding: { x: 2, y: 1 } }).setOrigin(0.5).setDepth(70).setResolution(4);
      const ln = this.add.line(0, 0, lx, ly + 4, px, py, 0x7ff6ff).setOrigin(0).setDepth(69);
      this.time.delayedCall(2200, () => { t.destroy(); ln.destroy(); });
      await this.wait(700);
    }
    await this.wait(1200);
    title.destroy();
    this.say('Anon’s plan: visit 202X to see the world thirty years earlier. What could possibly go wrong?');
    await this.wait(3000);
    this.finish();
  }

  // Tutorial scenes 9-10 / opening steps 6-11: time circuits, malfunction, accident.
  async play_departure() {
    this.lab();
    this.placeCar(190, 140);
    const a = this.anon(90, 140);
    this.say('Anon: Everything checks out. Time to set the time circuits.');
    this.tweens.add({ targets: a, x: 170, duration: 1400 });
    await this.wait(1500);
    this.tweens.add({ targets: a, alpha: 0, duration: 300 });
    audio.play('door', { gap: 0 });
    await this.wait(400);
    ui.timeCircuits({ dest: 'OCT 26 202X', present: 'OCT 26 205X', last: '--- -- ----', status: 'Destination set: 202X' });
    audio.play('safe', { gap: 0 });
    this.say('DESTINATION: 202X. Thirty years into the past. The display is working perfectly…');
    await this.wait(2600);
    if (this.done) return;
    this.say('Anon: Reactor online. Flux core charging. Here we go!');
    const pu = this.powerUp(3600);
    await this.wait(1200);
    // The navigation system malfunctions.
    const glitches = ['APR 27 1521', 'OCT 26 202X', 'MAR 21 1887', 'OCT 26 202X', 'APR 27 1521', 'J#L 0? 19?3', 'APR 27 1521'];
    for (const g of glitches) {
      if (this.done) return;
      ui.timeCircuits({ dest: g, present: 'OCT 26 205X', last: '--- -- ----', glitch: true, status: 'NAVIGATION ERROR' });
      audio.play('glitch', { gap: 0 });
      await this.wait(260);
    }
    this.say('The time circuits flicker… and lock onto an unintended destination: APRIL 27, 1521!');
    await pu;
    this.say('Anon: Wait— 1521?! That’s not— ABORT! ABORT!   (He noticed too late.)');
    this.shakeAmt = 0.012;
    this.arcs = 1.4;
    await this.wait(1600);
    if (this.done) return;
    ui.timeCircuits(null);
    await this.vanish();
    this.say('*FWOOOSH*');
    await this.wait(1400);
    if (this.done) return;
    this.children.list.filter((c) => c !== this.g).forEach((c) => c.destroy());
    this.eraBackdrop('precolonial');
    audio.music('precolonial');
    await this.arrive(170);
    const a2 = this.anon(130, 140);
    a2.setAlpha(0);
    await this.wait(900);
    this.tweens.add({ targets: a2, alpha: 1, x: 110, duration: 600 });
    this.say('APRIL 27, 1521 — Mactan. The DeVios lands with a crunch, its components scattered across time.');
    await this.wait(3000);
    this.say('Anon: The navigation gyro… the flux regulator… GONE. I’ll have to find them all to get home.');
    await this.wait(3000);
    this.finish();
  }

  async play_launch() {
    const era = ERAS[this.cfg.era];
    this.lab();
    this.placeCar(180, 140);
    ui.timeCircuits({ dest: era.date, present: 'DEVIOS SAFE ROOM', last: app.save.data.run && app.save.data.run.lastEra ? ERAS[app.save.data.run.lastEra].date : 'OCT 26 205X', status: `Destination: ${era.name}` });
    this.say(`Setting the time circuits for ${era.name}…`);
    await this.powerUp(1600);
    if (this.done) return;
    ui.timeCircuits(null);
    await this.vanish();
    await this.wait(700);
    if (this.done) return;
    this.children.list.filter((c) => c !== this.g).forEach((c) => c.destroy());
    this.eraBackdrop(this.cfg.era);
    await this.arrive(170);
    this.say(`${era.date} — ${era.name}`);
    await this.wait(1600);
    this.finish();
  }

  async play_return() {
    const era = ERAS[this.cfg.era];
    this.eraBackdrop(this.cfg.era);
    this.placeCar(180, 140);
    const a = this.anon(100);
    this.say(`${era.name} secured. Back to the DeVios safe room!`);
    this.tweens.add({ targets: a, x: 160, alpha: 0, duration: 1000 });
    await this.wait(1000);
    await this.powerUp(1200);
    if (this.done) return;
    await this.vanish();
    await this.wait(700);
    this.finish();
  }

  async play_canon() {
    const s = app.save.data;
    this.lab();
    audio.music('canon');
    ui.timeCircuits({ dest: 'OCT 26 205X', present: 'OCT 26 205X', last: s.run && s.run.lastEra ? ERAS[s.run.lastEra].date : 'NOV 03 1985', status: 'TIME CIRCUITS STABLE — ARRIVAL CONFIRMED' });
    this.say('The repaired DeVios tears back into 205X…');
    await this.wait(1400);
    for (const dy of [-2, 6]) { const tr = this.add.rectangle(0, 138 + dy, 160, 2, 0xff8a20).setOrigin(0, 0.5).setDepth(9); this.tweens.add({ targets: tr, alpha: 0, delay: 600, duration: 1600 }); }
    await this.arrive(190);
    this.carGlow.setAlpha(0.5);
    this.tweens.add({ targets: this.carGlow, alpha: 0.15, yoyo: true, repeat: -1, duration: 700 });
    await this.wait(1200);
    ui.timeCircuits(null);
    const a = this.anon(150);
    a.setAlpha(0);
    this.tweens.add({ targets: a, alpha: 1, x: 120, duration: 600 });
    await this.wait(700);
    this.tweens.add({ targets: a, y: 124, yoyo: true, repeat: -1, duration: 260, ease: 'Quad.easeOut' });
    audio.play('ending', { gap: 0 });
    const conf = this.time.addEvent({ delay: 60, loop: true, callback: () => { const c = this.add.rectangle(Math.random() * W, -4, 2, 3, rand.pick([0xff5fd2, 0xffd400, 0x47e0ff, 0x9dff6a])).setDepth(80); this.tweens.add({ targets: c, y: H + 10, angle: 360, duration: 2000 + Math.random() * 1500, onComplete: () => c.destroy() }); } });
    this.say('Anon: I DID IT! Time travel! (Mostly on purpose!)');
    await this.wait(3000);
    this.say('He is home, relieved — and very, very proud. The DeVios hums happily, every circuit glowing just right.');
    await this.wait(3500);
    const t = this.add.text(W / 2, 40, 'THE END', { fontFamily: '"Press Start 2P", monospace', fontSize: '18px', color: '#ffd400', stroke: '#b02020', strokeThickness: 4 }).setOrigin(0.5).setDepth(90).setResolution(4);
    this.add.text(W / 2, 62, 'Canon ending', { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' }).setOrigin(0.5).setDepth(90).setResolution(4);
    this.tweens.add({ targets: t, scale: { from: 0.3, to: 1 }, duration: 600, ease: 'Back.easeOut' });
    this.say(s.artifacts.length < 5 ? `Artifacts found: ${s.artifacts.length}/5. Rumour has it that collecting all five reveals a very different destination…` : 'Thanks for playing Anon’s Time Crisis!');
    await this.wait(4500);
    conf.remove();
    this.finish();
  }

  async play_secret() {
    this.eraBackdrop('modern');
    this.placeCar(180, 140);
    this.say('Anon tries to return to 205X…');
    await this.powerUp(1600);
    if (this.done) return;
    await this.vanish();
    await this.wait(900);
    if (this.done) return;
    this.children.list.filter((c) => c !== this.g).forEach((c) => c.destroy());
    audio.music('secret');
    // A desolate, restrained wasteland of rusted 202X technology.
    this.add.rectangle(W / 2, 60, W, 120, 0x4a4038);
    this.add.circle(250, 40, 14, 0xa89070, 0.6);
    this.add.rectangle(W / 2, 150, W, 60, 0x5a4a3a);
    const junk = ['prop_car', 'prop_billboard', 'prop_server', 'prop_barrier', 'prop_car', 'prop_server', 'prop_sign'];
    junk.forEach((k, i) => this.add.image(16 + i * 50, 128 + (i % 2) * 4, k).setOrigin(0.5, 1).setScale(1.3).setTint(0x8a6a4a).setAngle((i % 3 - 1) * 8));
    this.dust = [];
    for (let i = 0; i < 30; i++) this.dust.push(this.add.rectangle(Math.random() * W, 60 + Math.random() * 110, 1, 1, 0xc8b090, 0.6).setDepth(40));
    this.dust.forEach((d) => { d.vx = 10 + Math.random() * 25; });
    audio.play('wind', { gap: 0 });
    this.flash(0xc8b090, 900);
    this.placeCar(180, 140);
    // Components flicker weakly
    this.tweens.add({ targets: this.carGlow, alpha: { from: 0, to: 0.35 }, yoyo: true, repeat: -1, duration: 160, repeatDelay: 900 });
    const sky = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(45);
    this.tweens.add({ targets: sky, alpha: 0.25, duration: 4000 });
    await this.wait(1600);
    this.say('…but the DeVios arrives somewhere else entirely.');
    await this.wait(2600);
    const a = this.anon(150);
    a.setAlpha(0).setTint(0xc8b8a8);
    this.tweens.add({ targets: a, alpha: 1, x: 120, duration: 1400 });
    await this.wait(1600);
    this.say('Rusted 202X technology stretches to the horizon. No people. No sound. Only wind.');
    await this.wait(3400);
    this.say('Anon: …What happened here?');
    await this.wait(2800);
    const t = this.add.text(W / 2, 40, 'NON-CANON ENDING', { fontFamily: '"Press Start 2P", monospace', fontSize: '11px', color: '#d8c8b0', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(90).setResolution(4).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 1500 });
    this.say('Something went catastrophically wrong with the timeline. (This ending is non-canon.)');
    audio.play('ending', { gap: 0 });
    await this.wait(4500);
    this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.arcs = 0; this.shakeAmt = 0; this.distort = false;
    ui.caption(null); ui.skip(null); ui.timeCircuits(null);
    const s = app.save.data;
    const kind = this.cfg.kind;
    let next = ['Menu', {}];
    if (kind === 'opening') { s.openingSeen = true; next = ['Game', { mode: 'tutorial' }]; }
    if (kind === 'departure') {
      if (this.cfg.replay) { next = ['Menu', {}]; ui.toast('Tutorial replay complete!', 'good'); } else {
        if (!s.run) persistRun(createRun(s));
        next = ['Game', { mode: 'stage', eraId: 'precolonial', sub: 0, fromSafe: true }];
      }
    }
    if (kind === 'launch') next = ['Game', { mode: 'stage', eraId: this.cfg.era, sub: this.cfg.sub || 0, fromSafe: true }];
    if (kind === 'return') next = ['Game', { mode: 'safe' }];
    if (kind === 'canon') { s.endings.canon = true; ui.toast('Canon ending reached!', 'gold'); }
    if (kind === 'secret') { s.endings.secret = true; ui.toast('Secret (non-canon) ending reached!', 'gold'); }
    app.save.commit();
    ui.fade(true, 300).then(() => { this.scene.start(next[0], next[1]); ui.fade(false, 300); });
  }
}
