// Shared input layer. Keyboard, mouse and touch all translate into the same abstract
// actions, so desktop and mobile run the exact same combat code.
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'dodge', ShiftLeft: 'dodge', ShiftRight: 'dodge', KeyE: 'interact', KeyR: 'reload', KeyQ: 'item', KeyC: 'cycleItem',
  Tab: 'swap', Escape: 'pause', KeyP: 'pause', Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4', Enter: 'confirm',
};
const ONE_SHOT = new Set(['dodge', 'interact', 'reload', 'item', 'cycleItem', 'swap', 'pause', 'slot1', 'slot2', 'slot3', 'slot4', 'confirm']);

class InputManager {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();
    this.mouseDown = false;
    this.wheel = 0;
    this.touch = { move: { x: 0, y: 0 }, aim: null, fire: false, active: false };
    this.lastDevice = 'mouse';
    this.enabled = true;
    this.listeners = new Set();
    this._bound = false;
  }

  bind() {
    if (this._bound) return;
    this._bound = true;
    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      // Don't hijack keys while the user is typing in a form field.
      if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
      if (a === 'swap' || a === 'dodge' || e.code.startsWith('Arrow')) e.preventDefault();
      this.lastDevice = 'mouse';
      if (!this.held.has(a) && ONE_SHOT.has(a)) this.pressed.add(a);
      this.held.add(a);
      for (const l of this.listeners) l(a, e);
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.held.delete(a);
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    window.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    // Anything that can strand a held key/touch resets the whole state.
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
  }

  // Global key hook used by menus (Escape to close etc.).
  onAction(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  setMouseDown(v) { this.mouseDown = v; if (v) this.lastDevice = 'mouse'; }

  consume(action) {
    if (this.pressed.has(action)) {
      this.pressed.delete(action);
      return this.enabled;
    }
    return false;
  }

  press(action) { this.pressed.add(action); }

  clearPressed() { this.pressed.clear(); this.wheel = 0; }

  reset() {
    this.held.clear();
    this.pressed.clear();
    this.mouseDown = false;
    this.touch.move.x = 0;
    this.touch.move.y = 0;
    this.touch.aim = null;
    this.touch.fire = false;
    for (const l of this.listeners) l('__reset');
  }

  getMove() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0, y = 0;
    if (this.held.has('left')) x -= 1;
    if (this.held.has('right')) x += 1;
    if (this.held.has('up')) y -= 1;
    if (this.held.has('down')) y += 1;
    x += this.touch.move.x;
    y += this.touch.move.y;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  isFiring() {
    return this.enabled && (this.mouseDown || this.touch.fire);
  }
}

export const input = new InputManager();
