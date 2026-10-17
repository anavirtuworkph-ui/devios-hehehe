// Procedural WebAudio sound + tiny chiptune music sequencer. No external assets.
// Audio is only created after an explicit user gesture (browser autoplay rules).
const SCALES = {
  lab: { root: 57, steps: [0, 3, 7, 10, 12, 15], tempo: 120, wave: 'square', bass: 'triangle' },
  menu: { root: 57, steps: [0, 3, 7, 10, 12, 15], tempo: 104, wave: 'square', bass: 'triangle' },
  precolonial: { root: 60, steps: [0, 2, 4, 7, 9, 12], tempo: 112, wave: 'triangle', bass: 'triangle' },
  spanish: { root: 57, steps: [0, 1, 4, 5, 7, 8, 11], tempo: 108, wave: 'square', bass: 'triangle' },
  american: { root: 60, steps: [0, 4, 7, 9, 12, 16], tempo: 126, wave: 'square', bass: 'square' },
  japanese: { root: 52, steps: [0, 1, 5, 7, 8, 12], tempo: 84, wave: 'triangle', bass: 'sine' },
  marcos: { root: 55, steps: [0, 3, 5, 7, 10, 12], tempo: 118, wave: 'sawtooth', bass: 'square' },
  modern: { root: 50, steps: [0, 3, 6, 7, 10, 13], tempo: 132, wave: 'sawtooth', bass: 'square' },
  safe: { root: 60, steps: [0, 4, 7, 11, 12, 14], tempo: 90, wave: 'triangle', bass: 'sine' },
  boss: { root: 48, steps: [0, 1, 3, 6, 7, 10], tempo: 140, wave: 'sawtooth', bass: 'square' },
  canon: { root: 60, steps: [0, 4, 7, 12, 16, 19], tempo: 120, wave: 'square', bass: 'triangle' },
  secret: { root: 45, steps: [0, 1, 5, 6, 10], tempo: 60, wave: 'sine', bass: 'sine' },
};

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.settings = { master: 0.8, music: 0.45, sfx: 0.8, muted: false };
    this.track = null;
    this._timer = null;
    this._lastPlay = {};
  }

  // Must be called from a user gesture handler.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);
    this.musicGain.connect(this.master);
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.apply(this.settings);
    if (this.track) this.music(this.track, true);
  }

  apply(settings) {
    this.settings = { ...this.settings, ...settings };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.master, t, 0.02);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfx, t, 0.02);
    this.musicGain.gain.setTargetAtTime(this.settings.music * 0.35, t, 0.02);
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  tone({ freq = 440, to = null, dur = 0.1, type = 'square', vol = 0.2, delay = 0, out = null }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out || this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise({ dur = 0.2, vol = 0.3, filter = 1200, to = null, delay = 0, type = 'lowpass' }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(filter, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // Named effects. A small per-name throttle prevents rapid-fire weapons from clipping.
  play(name, opts = {}) {
    if (!this.ctx || this.settings.muted) return;
    const now = performance.now();
    const gap = opts.gap ?? 30;
    if (this._lastPlay[name] && now - this._lastPlay[name] < gap) return;
    this._lastPlay[name] = now;
    const fx = SFX[name];
    if (fx) fx(this, opts);
  }

  music(name, force = false) {
    if (this.track === name && !force) return;
    this.track = name;
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    if (!this.ctx || !name) return;
    const sc = SCALES[name] || SCALES.menu;
    const stepDur = 60 / sc.tempo / 2;
    let step = 0;
    // Deterministic little melody per track.
    let seed = [...name].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const melody = Array.from({ length: 32 }, () => (rnd() < 0.72 ? sc.steps[Math.floor(rnd() * sc.steps.length)] : null));
    const bassline = [0, 0, 7, 0, 5, 5, 7, 3].map((x) => (sc.steps.includes(x) ? x : sc.steps[0]));
    this._timer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const i = step % 32;
      const m = melody[i];
      if (m !== null) this.tone({ freq: midi(sc.root + 12 + m), dur: stepDur * 0.9, type: sc.wave, vol: 0.06, out: this.musicGain });
      if (i % 4 === 0) this.tone({ freq: midi(sc.root - 12 + bassline[(i / 4) % 8]), dur: stepDur * 3.5, type: sc.bass, vol: 0.09, out: this.musicGain });
      if (name !== 'secret' && name !== 'safe' && i % 8 === 4) {
        const t = this.ctx.currentTime;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        src.connect(g).connect(this.musicGain);
        src.start(t);
        src.stop(t + 0.1);
      }
      step++;
    }, stepDur * 1000);
  }
}

const SFX = {
  shoot_pistol: (a) => a.tone({ freq: 900, to: 300, dur: 0.07, vol: 0.12 }),
  shoot_energy: (a) => a.tone({ freq: 1400, to: 500, dur: 0.08, vol: 0.1, type: 'sawtooth' }),
  shoot_rifle: (a) => { a.noise({ dur: 0.12, vol: 0.25, filter: 3000, to: 400 }); a.tone({ freq: 220, to: 80, dur: 0.12, vol: 0.12 }); },
  shoot_auto: (a) => a.noise({ dur: 0.06, vol: 0.16, filter: 2500, to: 600 }),
  shoot_shotgun: (a) => { a.noise({ dur: 0.2, vol: 0.3, filter: 1800, to: 200 }); },
  shoot_explosive: (a) => { a.tone({ freq: 160, to: 60, dur: 0.25, vol: 0.2, type: 'sawtooth' }); a.noise({ dur: 0.18, vol: 0.15, filter: 900 }); },
  shoot_ink: (a) => a.tone({ freq: 500, to: 900, dur: 0.08, vol: 0.08, type: 'sine' }),
  kazoo: (a) => { a.tone({ freq: 330, to: 480, dur: 0.25, vol: 0.12, type: 'sawtooth' }); a.tone({ freq: 335, to: 470, dur: 0.25, vol: 0.06, type: 'square' }); },
  ping: (a) => a.tone({ freq: 2600, to: 2400, dur: 0.35, vol: 0.12, type: 'sine' }),
  melee: (a) => a.noise({ dur: 0.1, vol: 0.15, filter: 4000, to: 800, type: 'bandpass' }),
  deflect: (a) => a.tone({ freq: 1800, to: 2400, dur: 0.06, vol: 0.08, type: 'triangle' }),
  reload: (a) => { a.tone({ freq: 300, dur: 0.04, vol: 0.1 }); a.tone({ freq: 500, dur: 0.04, vol: 0.1, delay: 0.12 }); },
  empty: (a) => a.tone({ freq: 200, dur: 0.05, vol: 0.08 }),
  explosion: (a) => { a.noise({ dur: 0.5, vol: 0.45, filter: 1200, to: 80 }); a.tone({ freq: 90, to: 30, dur: 0.4, vol: 0.25, type: 'sine' }); },
  hit: (a) => a.tone({ freq: 300, to: 150, dur: 0.05, vol: 0.08 }),
  crit: (a) => a.tone({ freq: 1200, to: 600, dur: 0.08, vol: 0.1, type: 'triangle' }),
  enemy_die: (a) => { a.tone({ freq: 500, to: 80, dur: 0.18, vol: 0.12, type: 'sawtooth' }); a.noise({ dur: 0.1, vol: 0.08, filter: 2000 }); },
  hurt: (a) => { a.tone({ freq: 220, to: 90, dur: 0.2, vol: 0.2, type: 'square' }); },
  pickup: (a) => { a.tone({ freq: 660, dur: 0.06, vol: 0.1 }); a.tone({ freq: 990, dur: 0.08, vol: 0.1, delay: 0.06 }); },
  coin: (a) => { a.tone({ freq: 1320, dur: 0.05, vol: 0.07, type: 'triangle' }); a.tone({ freq: 1760, dur: 0.07, vol: 0.07, type: 'triangle', delay: 0.04 }); },
  buy: (a) => { [784, 988, 1175].forEach((f, i) => a.tone({ freq: f, dur: 0.08, vol: 0.1, type: 'triangle', delay: i * 0.06 })); },
  deny: (a) => { a.tone({ freq: 180, dur: 0.12, vol: 0.12 }); a.tone({ freq: 140, dur: 0.16, vol: 0.12, delay: 0.1 }); },
  chest: (a) => { [523, 659, 784, 1046].forEach((f, i) => a.tone({ freq: f, dur: 0.1, vol: 0.1, type: 'square', delay: i * 0.07 })); },
  heal: (a) => { [523, 784, 1046].forEach((f, i) => a.tone({ freq: f, dur: 0.12, vol: 0.08, type: 'sine', delay: i * 0.08 })); },
  dodge: (a) => a.noise({ dur: 0.12, vol: 0.1, filter: 600, to: 3000, type: 'bandpass' }),
  door: (a) => { a.tone({ freq: 200, to: 400, dur: 0.2, vol: 0.1, type: 'triangle' }); },
  boss_intro: (a) => { [0, 0.25, 0.5].forEach((d, i) => a.tone({ freq: 110 * (i + 1), dur: 0.5, vol: 0.18, type: 'sawtooth', delay: d })); },
  boss_attack: (a) => a.tone({ freq: 160, to: 320, dur: 0.15, vol: 0.12, type: 'sawtooth' }),
  telegraph: (a) => a.tone({ freq: 880, dur: 0.06, vol: 0.06, type: 'square' }),
  boss_defeat: (a) => { a.noise({ dur: 1.2, vol: 0.4, filter: 2000, to: 60 }); [392, 523, 659, 784].forEach((f, i) => a.tone({ freq: f, dur: 0.25, vol: 0.12, delay: 0.4 + i * 0.15, type: 'square' })); },
  transition: (a) => a.tone({ freq: 300, to: 1200, dur: 0.4, vol: 0.1, type: 'sine' }),
  tutorial: (a) => { a.tone({ freq: 880, dur: 0.06, vol: 0.08, type: 'sine' }); a.tone({ freq: 1320, dur: 0.1, vol: 0.08, type: 'sine', delay: 0.07 }); },
  charge: (a, o) => { a.tone({ freq: 80, to: 900, dur: o.dur || 2.2, vol: 0.12, type: 'sawtooth' }); a.noise({ dur: o.dur || 2.2, vol: 0.06, filter: 300, to: 5000, type: 'bandpass' }); },
  zap: (a) => a.noise({ dur: 0.08, vol: 0.12, filter: 5000, type: 'highpass' }),
  glitch: (a) => { for (let i = 0; i < 6; i++) a.tone({ freq: 200 + Math.random() * 1800, dur: 0.04, vol: 0.08, type: 'square', delay: i * 0.05 }); },
  timetravel: (a) => { a.noise({ dur: 1.0, vol: 0.5, filter: 6000, to: 100 }); a.tone({ freq: 1200, to: 40, dur: 0.9, vol: 0.25, type: 'sawtooth' }); },
  safe: (a) => { a.tone({ freq: 660, dur: 0.06, vol: 0.07, type: 'sine' }); a.tone({ freq: 880, dur: 0.06, vol: 0.07, type: 'sine', delay: 0.06 }); },
  select: (a) => a.tone({ freq: 740, dur: 0.04, vol: 0.06, type: 'square' }),
  artifact: (a) => { [523, 659, 784, 1046, 1318].forEach((f, i) => a.tone({ freq: f, dur: 0.2, vol: 0.1, type: 'triangle', delay: i * 0.09 })); },
  adios: (a) => { a.tone({ freq: 220, to: 110, dur: 1.2, vol: 0.2, type: 'sine' }); [440, 554, 659].forEach((f, i) => a.tone({ freq: f, dur: 0.8, vol: 0.08, type: 'sine', delay: 0.1 * i })); a.noise({ dur: 0.8, vol: 0.2, filter: 400 }); },
  ending: (a) => { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => a.tone({ freq: f, dur: 0.2, vol: 0.1, type: 'square', delay: i * 0.14 })); },
  wind: (a) => a.noise({ dur: 3, vol: 0.08, filter: 500, to: 300 }),
};

export const audio = new AudioSystem();
