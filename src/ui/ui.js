// DOM user interface: HUD, menus, modals, dialogue, captions and the DeVios time circuits.
// Gameplay rules never live here; UI calls back into scenes/systems.
import { input } from '../systems/input.js';
import { audio } from '../systems/audio.js';
import { createTouchControls } from './touch.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export { esc };

class UI {
  init(root) {
    this.root = root;
    root.innerHTML = `
      <div id="hud" class="hidden">
        <div class="hud-tl">
          <div class="hp"><div class="hp-fill"></div><span class="hp-text"></span></div>
          <div class="shards"><i class="shard-icon"></i><span class="shard-n">0</span></div>
          <div class="buffs"></div>
        </div>
        <div class="hud-tc"><div class="era"></div><div class="objective"></div><div id="bossbars"></div></div>
        <div class="hud-tr">
          <button class="pause-btn" aria-label="Pause">II</button>
          <div class="artifacts" title="Historical artifacts"></div>
          <div class="ally"></div>
          <canvas id="minimap" class="hidden" aria-label="Floor map"></canvas>
        </div>
        <div class="hud-bl">
          <div class="weapon"><img class="w-img" alt=""><div><div class="w-name"></div><div class="w-ammo"></div></div></div>
          <div class="slots"></div>
          <div class="items"></div>
        </div>
        <div class="prompt hidden"></div>
      </div>
      <div id="banner" class="hidden"><div class="b-title"></div><div class="b-sub"></div></div>
      <div id="toasts"></div>
      <div id="caption" class="hidden"></div>
      <div id="timecircuits" class="hidden"></div>
      <div id="dialog" class="hidden"><div class="d-who"></div><div class="d-text"></div><div class="d-more">▼ tap / E</div></div>
      <div id="screen" class="hidden"></div>
      <div id="modal-layer"></div>
      <div id="fade"></div>
      <div id="rotate-hint" class="hidden">Rotate your device to landscape for the best experience. <button>OK</button></div>
      <button id="skip" class="hidden">Skip ▶▶</button>`;
    this.$ = (sel) => root.querySelector(sel);
    this.hudEl = this.$('#hud');
    this.touch = createTouchControls(root);
    this.modals = [];
    this.$('.pause-btn').addEventListener('click', () => { audio.unlock(); input.press('pause'); });
    this.$('#rotate-hint button').addEventListener('click', () => { this.rotateDismissed = true; this.$('#rotate-hint').classList.add('hidden'); });
    input.onAction((a, e) => {
      if (a === 'pause' && this.modals.length) {
        const top = this.modals[this.modals.length - 1];
        if (top.closable) { e && e.preventDefault(); top.close(); input.pressed.delete('pause'); }
      }
    });
    this._hudCache = {};
  }

  setScale(s) { document.documentElement.style.setProperty('--ui', String(s)); }

  showHud(v) { this.hudEl.classList.toggle('hidden', !v); }

  updateHud(h) {
    const c = this._hudCache;
    const set = (key, val, fn) => { if (c[key] !== val) { c[key] = val; fn(val); } };
    set('hp', `${h.hp}/${h.maxHp}`, () => {
      this.$('.hp-fill').style.width = `${Math.max(0, (h.hp / h.maxHp) * 100)}%`;
      this.$('.hp-text').textContent = `${Math.ceil(h.hp)} / ${h.maxHp}`;
      this.$('.hp').classList.toggle('low', h.hp / h.maxHp <= 0.3);
    });
    set('shards', h.shards, (v) => {
      const n = this.$('.shard-n');
      n.textContent = v;
      n.parentElement.classList.remove('bump');
      void n.offsetWidth;
      n.parentElement.classList.add('bump');
    });
    set('shardKind', h.shardKind, (v) => { this.$('.shard-icon').dataset.kind = v; });
    set('era', h.eraLabel, (v) => { this.$('.era').textContent = v; });
    set('obj', h.objective, (v) => { this.$('.objective').textContent = v || ''; });
    set('weapon', `${h.weaponId}|${h.weaponName}|${h.level}`, () => {
      this.$('.w-name').textContent = h.weaponName + (h.level ? ` +${h.level}` : '');
      const img = this.$('.w-img');
      if (h.weaponImg) img.src = h.weaponImg;
    });
    set('ammo', h.ammoText, (v) => { this.$('.w-ammo').textContent = v; });
    set('slots', h.slotsKey, () => {
      this.$('.slots').innerHTML = h.slots.map((s, i) => `<button class="slot ${s.active ? 'on' : ''}" data-i="${i}" title="${esc(s.name)}">${i + 1}<img src="${s.img}" alt=""></button>`).join('');
      this.$('.slots').querySelectorAll('.slot').forEach((b) => b.addEventListener('click', () => input.press(`slot${+b.dataset.i + 1}`)));
    });
    set('items', h.itemsKey, () => {
      this.$('.items').innerHTML = h.items.map((it) => `<span class="item ${it.selected ? 'on' : ''}">${esc(it.label)} ×${it.n}</span>`).join('') + (h.items.length ? '<small>Q use · C cycle</small>' : '');
    });
    set('artifacts', h.artifactsKey, () => {
      this.$('.artifacts').innerHTML = h.artifacts.map((a) => `<span class="art ${a.have ? 'have' : ''}" title="${esc(a.name)}">${a.have ? '◆' : '◇'}</span>`).join('') + `<b>${h.artifacts.filter((a) => a.have).length}/5</b>`;
    });
    set('ally', h.allyName || '', (v) => { this.$('.ally').textContent = v ? `Ally: ${v}` : 'No ally'; });
    set('buffs', h.buffsKey, () => { this.$('.buffs').innerHTML = h.buffs.map((b) => `<span class="buff ${b.bad ? 'bad' : ''}">${esc(b.label)}</span>`).join(''); });
  }

  // Hard-mode floor map. cfg: { gw, gh, rooms: [{x,y,kind,state,current}], links: [{a:{x,y}, b:{x,y}}] }
  // state: 'visited' | 'known' (seen from a doorway) ; kinds color the squares.
  minimap(cfg) {
    const c = this.$('#minimap');
    if (!cfg) { c.classList.add('hidden'); return; }
    const S = 14, G = 6, P = 4;
    const w = cfg.gw * (S + G) - G + P * 2, h = cfg.gh * (S + G) - G + P * 2;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr; c.height = h * dpr;
    c.style.width = `calc(${w}px * var(--ui))`; c.style.height = `calc(${h}px * var(--ui))`;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const pos = (cell) => ({ x: P + cell.x * (S + G), y: P + cell.y * (S + G) });
    const shown = new Set(cfg.rooms.map((r) => `${r.x},${r.y}`));
    ctx.fillStyle = '#5a5a7a';
    for (const l of cfg.links) {
      if (!shown.has(`${l.a.x},${l.a.y}`) || !shown.has(`${l.b.x},${l.b.y}`)) continue;
      const a = pos(l.a), b = pos(l.b);
      if (a.y === b.y) ctx.fillRect(Math.min(a.x, b.x) + S, a.y + S / 2 - 2, G, 4);
      else ctx.fillRect(a.x + S / 2 - 2, Math.min(a.y, b.y) + S, 4, G);
    }
    const COLORS = { start: '#e8e8f0', exit: '#47e0ff', combat: '#ff5a6a', cleared: '#5a6a80', shop: '#ffd400', treasure: '#ffa040', vault: '#ffd400', healing: '#5fff8a', trial: '#ff5050', shrine: '#c080ff', rest: '#7fc8ff', hidden: '#ffffff', history: '#9ad8ff' };
    for (const r of cfg.rooms) {
      const p = pos(r);
      ctx.globalAlpha = r.state === 'visited' ? 1 : 0.45;
      ctx.fillStyle = COLORS[r.kind] || '#888';
      ctx.fillRect(p.x, p.y, S, S);
      if (r.current) { ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(p.x - 1, p.y - 1, S + 2, S + 2); ctx.fillStyle = '#000'; ctx.fillRect(p.x + 5, p.y + 5, 4, 4); }
    }
    ctx.globalAlpha = 1;
    c.classList.remove('hidden');
  }

  prompt(text) {
    const p = this.$('.prompt');
    if (!text) { p.classList.add('hidden'); this.touch.setInteract(false); return; }
    const key = input.lastDevice === 'touch' ? 'USE' : 'E';
    p.innerHTML = `<b>${key}</b> ${esc(text)}`;
    p.classList.remove('hidden');
    this.touch.setInteract(true);
  }

  bossBars(list) {
    const el = this.$('#bossbars');
    if (!list || !list.length) { el.innerHTML = ''; this._bossKey = ''; return; }
    const key = list.map((b) => b.name).join('|');
    if (key !== this._bossKey) {
      this._bossKey = key;
      el.innerHTML = list.map((b) => `<div class="bossbar"><div class="bb-name">${esc(b.name)}</div><div class="bb-bar"><div class="bb-fill"></div></div></div>`).join('');
    }
    el.querySelectorAll('.bb-fill').forEach((f, i) => { f.style.width = `${Math.max(0, (list[i].hp / list[i].max) * 100)}%`; });
  }

  toast(msg, kind = '') {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = msg;
    this.$('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 2200);
    setTimeout(() => t.remove(), 2700);
  }

  banner(title, sub = '', ms = 1800) {
    const b = this.$('#banner');
    b.querySelector('.b-title').textContent = title;
    b.querySelector('.b-sub').textContent = sub;
    b.classList.remove('hidden', 'out');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => { b.classList.add('out'); setTimeout(() => b.classList.add('hidden'), 400); }, ms);
  }

  caption(text) {
    const c = this.$('#caption');
    if (!text) { c.classList.add('hidden'); return; }
    c.innerHTML = esc(text).replace(/\n/g, '<br>');
    c.classList.remove('hidden');
  }

  skip(cb) {
    const b = this.$('#skip');
    if (!cb) { b.classList.add('hidden'); b.onclick = null; return; }
    b.classList.remove('hidden');
    b.onclick = () => { audio.unlock(); cb(); };
  }

  fade(on, ms = 400) {
    const f = this.$('#fade');
    f.style.transitionDuration = `${ms}ms`;
    f.classList.toggle('on', on);
    return new Promise((r) => setTimeout(r, ms));
  }

  // Time circuits: three LED rows as on the DeVios dashboard.
  timeCircuits(cfg) {
    const el = this.$('#timecircuits');
    if (!cfg) { el.classList.add('hidden'); return; }
    const row = (cls, label, val) => `<div class="tc-row ${cls}"><div class="tc-val">${esc(val)}</div><div class="tc-label">${label}</div></div>`;
    el.innerHTML = row('dest', 'DESTINATION TIME', cfg.dest) + row('pres', 'PRESENT TIME', cfg.present) + row('last', 'LAST TIME DEPARTED', cfg.last)
      + (cfg.status ? `<div class="tc-status">${esc(cfg.status)}</div>` : '');
    el.classList.toggle('glitch', !!cfg.glitch);
    el.classList.toggle('small', !!cfg.small);
    el.classList.remove('hidden');
  }

  // Dialogue box. lines: strings like "Name: text" or plain narration.
  dialog(lines) {
    const box = this.$('#dialog');
    let i = 0;
    input.enabled = false;
    return new Promise((resolve) => {
      const show = () => {
        const raw = lines[i];
        const m = /^([^:]{1,32}):\s(.*)$/s.exec(raw);
        box.querySelector('.d-who').textContent = m ? m[1] : '';
        box.querySelector('.d-text').textContent = m ? m[2] : raw;
        box.classList.remove('hidden');
        audio.play('select', { gap: 0 });
      };
      const next = () => {
        i++;
        if (i >= lines.length) { cleanup(); resolve(); } else show();
      };
      const onKey = (e) => { if (['KeyE', 'Enter', 'Space'].includes(e.code)) { e.preventDefault(); next(); } };
      const onClick = (e) => { e.preventDefault(); next(); };
      const cleanup = () => {
        box.classList.add('hidden');
        window.removeEventListener('keydown', onKey, true);
        box.removeEventListener('pointerdown', onClick);
        input.enabled = !this.modals.length;
        input.clearPressed();
      };
      window.addEventListener('keydown', onKey, true);
      box.addEventListener('pointerdown', onClick);
      show();
    });
  }

  // Generic modal. content: HTML string or element. buttons: [{label, cls, action(close)}].
  modal({ title, content = '', buttons = [], closable = true, onClose = null, cls = '' }) {
    const layer = this.$('#modal-layer');
    const wrap = document.createElement('div');
    wrap.className = `modal ${cls}`;
    wrap.innerHTML = `<div class="m-box"><div class="m-head"><h2>${esc(title)}</h2>${closable ? '<button class="m-x" aria-label="Close">✕</button>' : ''}</div><div class="m-body"></div><div class="m-foot"></div></div>`;
    const body = wrap.querySelector('.m-body');
    if (typeof content === 'string') body.innerHTML = content; else body.appendChild(content);
    const foot = wrap.querySelector('.m-foot');
    let closed = false;
    const handle = {
      el: wrap, body, closable,
      close: () => {
        if (closed) return;
        closed = true;
        wrap.remove();
        this.modals = this.modals.filter((m) => m !== handle);
        input.enabled = this.modals.length === 0;
        input.clearPressed();
        if (onClose) onClose();
      },
      setButtons: (btns) => {
        foot.innerHTML = '';
        for (const b of btns) {
          const el = document.createElement('button');
          el.className = `btn ${b.cls || ''}`;
          el.textContent = b.label;
          if (b.disabled) el.disabled = true;
          el.addEventListener('click', () => { audio.unlock(); audio.play('select', { gap: 0 }); b.action(handle); });
          foot.appendChild(el);
        }
      },
    };
    handle.setButtons(buttons);
    if (closable) wrap.querySelector('.m-x').addEventListener('click', () => handle.close());
    layer.appendChild(wrap);
    this.modals.push(handle);
    input.enabled = false;
    input.reset();
    const first = foot.querySelector('button') || wrap.querySelector('button');
    if (first && input.lastDevice !== 'touch') setTimeout(() => first.focus({ preventScroll: true }), 30);
    return handle;
  }

  confirm(text, yes = 'Yes', no = 'Cancel') {
    return new Promise((resolve) => {
      let answered = false;
      this.modal({
        title: 'Are you sure?', content: `<p>${esc(text)}</p>`,
        buttons: [
          { label: yes, cls: 'danger', action: (m) => { answered = true; m.close(); resolve(true); } },
          { label: no, action: (m) => m.close() },
        ],
        onClose: () => { if (!answered) resolve(false); },
      });
    });
  }

  closeAllModals() { [...this.modals].forEach((m) => m.close()); }

  // Full-screen menus (main menu etc.).
  screen(html) {
    const s = this.$('#screen');
    if (html === null) { s.classList.add('hidden'); s.innerHTML = ''; return null; }
    s.innerHTML = html;
    s.classList.remove('hidden');
    return s;
  }

  rotateHint(show) {
    if (this.rotateDismissed) show = false;
    this.$('#rotate-hint').classList.toggle('hidden', !show);
  }
}

export const ui = new UI();
