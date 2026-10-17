// On-screen touch controls built from DOM elements with Pointer Events. Each control tracks
// its own pointerId so moving, aiming and firing work simultaneously, and every control is
// released on pointercancel / lostpointercapture / blur so nothing can get stuck.
import { input } from '../systems/input.js';

export function createTouchControls(root) {
  const el = document.createElement('div');
  el.id = 'touch';
  el.innerHTML = `
    <div class="t-zone t-left" data-zone="move"><div class="t-stick"><div class="t-knob"></div></div></div>
    <div class="t-right">
      <div class="t-btn t-attack" data-zone="aim"><div class="t-knob t-aimknob"></div><span>FIRE</span></div>
      <button class="t-btn t-small t-dodge" data-act="dodge">DODGE</button>
      <button class="t-btn t-small t-swap" data-act="swap">SWAP</button>
      <button class="t-btn t-small t-reload" data-act="reload">RELOAD</button>
      <button class="t-btn t-small t-item" data-act="item">ITEM</button>
      <button class="t-btn t-small t-interact" data-act="interact">USE</button>
    </div>`;
  root.appendChild(el);

  const left = el.querySelector('.t-left');
  const stick = el.querySelector('.t-stick');
  const knob = stick.querySelector('.t-knob');
  const attack = el.querySelector('.t-attack');
  const aimKnob = el.querySelector('.t-aimknob');
  const RADIUS = 46;

  let movePid = null, origin = null;
  const releaseMove = () => {
    movePid = null;
    input.touch.move.x = 0; input.touch.move.y = 0;
    stick.classList.remove('on');
    knob.style.transform = 'translate(-50%,-50%)';
  };
  left.addEventListener('pointerdown', (e) => {
    if (movePid !== null) return;
    e.preventDefault();
    movePid = e.pointerId;
    try { left.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
    input.lastDevice = 'touch';
    const r = left.getBoundingClientRect();
    origin = { x: e.clientX, y: e.clientY };
    stick.style.left = `${e.clientX - r.left}px`;
    stick.style.top = `${e.clientY - r.top}px`;
    stick.classList.add('on');
  });
  left.addEventListener('pointermove', (e) => {
    if (e.pointerId !== movePid) return;
    let dx = e.clientX - origin.x, dy = e.clientY - origin.y;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) { dx = (dx / len) * RADIUS; dy = (dy / len) * RADIUS; }
    const dead = 6;
    input.touch.move.x = len < dead ? 0 : dx / RADIUS;
    input.touch.move.y = len < dead ? 0 : dy / RADIUS;
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) left.addEventListener(ev, (e) => { if (e.pointerId === movePid) releaseMove(); });

  // Attack button doubles as an aim stick: tap = fire with auto-aim, drag = manual aim.
  let aimPid = null, aimOrigin = null;
  const releaseAim = () => {
    aimPid = null;
    input.touch.fire = false;
    input.touch.aim = null;
    attack.classList.remove('on');
    aimKnob.style.transform = 'translate(-50%,-50%)';
  };
  attack.addEventListener('pointerdown', (e) => {
    if (aimPid !== null) return;
    e.preventDefault();
    aimPid = e.pointerId;
    try { attack.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    input.lastDevice = 'touch';
    const r = attack.getBoundingClientRect();
    aimOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    input.touch.fire = true;
    input.touch.aim = null;
    attack.classList.add('on');
  });
  attack.addEventListener('pointermove', (e) => {
    if (e.pointerId !== aimPid) return;
    const dx = e.clientX - aimOrigin.x, dy = e.clientY - aimOrigin.y;
    const len = Math.hypot(dx, dy);
    if (len > 14) input.touch.aim = { x: dx / len, y: dy / len };
    const k = Math.min(len, 30);
    if (len > 0) aimKnob.style.transform = `translate(calc(-50% + ${(dx / len) * k}px), calc(-50% + ${(dy / len) * k}px))`;
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) attack.addEventListener(ev, (e) => { if (e.pointerId === aimPid) releaseAim(); });

  el.querySelectorAll('[data-act]').forEach((b) => {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      input.lastDevice = 'touch';
      input.press(b.dataset.act);
      b.classList.add('on');
    });
    const off = () => b.classList.remove('on');
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
  });

  input.onAction((a) => { if (a === '__reset') { releaseMove(); releaseAim(); } });
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    el,
    setVisible(v) { el.classList.toggle('show', v); if (!v) { releaseMove(); releaseAim(); } },
    setInteract(v) { el.querySelector('.t-interact').classList.toggle('hot', !!v); },
    setReload(v) { el.querySelector('.t-reload').classList.toggle('dim', !v); },
  };
}
