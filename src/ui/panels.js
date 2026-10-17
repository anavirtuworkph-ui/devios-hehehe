// Shared modal panels: settings, controls, credits, pause.
import { ui, esc } from './ui.js';
import { app } from '../app.js';
import { audio } from '../systems/audio.js';
import { applySettings } from '../settings.js';

export function openSettings({ inGame = false, onReplayTutorial = null, onReset = null } = {}) {
  const s = app.save.data.settings;
  const html = `
    <div class="settings">
      <label>Difficulty
        <select data-k="difficulty">
          <option value="easy" ${s.difficulty === 'easy' ? 'selected' : ''}>Easy (default)</option>
          <option value="normal" ${s.difficulty === 'normal' ? 'selected' : ''}>Normal</option>
          <option value="hard" ${s.difficulty === 'hard' ? 'selected' : ''}>Hard — full floors</option>
        </select></label>
      <p class="d" style="color:var(--muted);margin:2px 0 6px">Hard turns each non-boss sub-level into a full floor: a maze of connected combat rooms, side rooms and a minimap, ending at a time rift. Enemies hit harder too.</p>
      <p class="d" style="color:var(--muted);margin:2px 0 6px">${inGame ? 'Difficulty changes apply from the next sub-level or room you enter.' : 'Nothing is locked behind difficulty.'}</p>
      <label>Master volume <input type="range" min="0" max="1" step="0.05" data-k="master" value="${s.master}"></label>
      <label>Music volume <input type="range" min="0" max="1" step="0.05" data-k="music" value="${s.music}"></label>
      <label>Effects volume <input type="range" min="0" max="1" step="0.05" data-k="sfx" value="${s.sfx}"></label>
      <label>Mute all audio <input type="checkbox" data-k="muted" ${s.muted ? 'checked' : ''}></label>
      <label>UI scale <input type="range" min="0.8" max="1.4" step="0.1" data-k="uiScale" value="${s.uiScale}"></label>
      <label>Mobile auto-aim <input type="checkbox" data-k="autoAim" ${s.autoAim ? 'checked' : ''}></label>
      <label>Touch controls
        <select data-k="touchControls">
          <option value="auto" ${s.touchControls === 'auto' ? 'selected' : ''}>Auto-detect</option>
          <option value="on" ${s.touchControls === 'on' ? 'selected' : ''}>Always show</option>
          <option value="off" ${s.touchControls === 'off' ? 'selected' : ''}>Hide</option>
        </select></label>
    </div>`;
  const buttons = [];
  if (onReplayTutorial) buttons.push({ label: 'Replay tutorial', action: (m) => { m.close(); onReplayTutorial(); } });
  if (onReset) {
    buttons.push({
      label: 'Reset progress', cls: 'danger', action: async (m) => {
        if (await ui.confirm('Erase ALL campaign progress, artifacts, allies and upgrades? Settings are kept. This cannot be undone.', 'Erase everything')) {
          app.save.reset();
          m.close();
          ui.toast('Progress reset.', 'bad');
          onReset();
        }
      },
    });
  }
  buttons.push({ label: 'Done', cls: 'primary', action: (m) => m.close() });
  const m = ui.modal({ title: 'Settings', content: html, buttons });
  m.body.querySelectorAll('[data-k]').forEach((el) => {
    el.addEventListener('input', () => {
      const k = el.dataset.k;
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'range') v = parseFloat(v);
      app.save.data.settings[k] = v;
      app.save.commit();
      applySettings();
      if (k === 'sfx' || k === 'master') audio.play('select', { gap: 120 });
    });
  });
  return m;
}

export function openControls() {
  const html = `
    <div class="grid2">
      <div><h3>Desktop</h3>
        <p><kbd>W A S D</kbd> move</p><p><kbd>Mouse</kbd> aim</p><p><kbd>Left click</kbd> fire / attack (hold)</p>
        <p><kbd>Space</kbd> / <kbd>Shift</kbd> dodge</p><p><kbd>E</kbd> interact</p><p><kbd>1-4</kbd>, <kbd>Tab</kbd>, mouse wheel: switch weapon</p>
        <p><kbd>R</kbd> reload</p><p><kbd>Q</kbd> use item, <kbd>C</kbd> cycle item</p><p><kbd>Esc</kbd> pause</p></div>
      <div><h3>Mobile</h3>
        <p><b>Left side:</b> virtual joystick (touch anywhere)</p>
        <p><b>FIRE:</b> hold to attack. Tap = auto-aim at the nearest enemy; drag the button to aim manually.</p>
        <p><b>DODGE / SWAP / RELOAD / ITEM</b> buttons</p><p><b>USE</b> appears near anything interactive</p>
        <p><b>II</b> (top right) pauses</p><p>Auto-aim can be toggled in Settings.</p></div>
    </div>`;
  return ui.modal({ title: 'Controls', content: html, buttons: [{ label: 'OK', cls: 'primary', action: (m) => m.close() }] });
}

export function openCredits() {
  const html = `
    <p><b>Anon's Time Crisis</b> — a browser action roguelike.</p>
    <p>Design, code, procedural pixel art and synthesized audio: generated for this project. No third-party game art, film stills or sound files are used.</p>
    <p>Engine: Phaser 3. Fonts: Press Start 2P & VT323 (Google Fonts, SIL OFL).</p>
    <p><b>Inspirations:</b> the general room-based combat of <i>Soul Knight</i>; the DeVios's time-machine gear is an homage to the kind of modifications seen on the DeLorean in <i>Back to the Future</i>. The DeVios itself is a 2026 Toyota Vios. No affiliation with or endorsement by any of these rights holders.</p>
    <p><b>Disclaimer:</b> This is alternate-history comedy and satire. Real historical and political figures appear only as fictionalized arcade characters; all dialogue and events are invented and are not factual claims. Padre Dámaso and Crisostomo Ibarra are fictional characters from José Rizal's novels. Colonel Yuta Saitoh and Hiroshi Tanaka are fictional characters inspired by GMA's <i>Pulang Araw</i>. Enemies are "temporal echoes" and do not represent any real people or nation.</p>`;
  return ui.modal({ title: 'Credits', content: html, buttons: [{ label: 'Close', cls: 'primary', action: (m) => m.close() }] });
}

export { esc };
