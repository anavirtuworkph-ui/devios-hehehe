// Applies persisted settings to audio, UI and touch controls.
import { app } from './app.js';
import { audio } from './systems/audio.js';
import { ui } from './ui/ui.js';
import { input } from './systems/input.js';

export function touchWanted() {
  const mode = app.save.data.settings.touchControls;
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  return coarse || input.lastDevice === 'touch';
}

export function applySettings() {
  const s = app.save.data.settings;
  audio.apply({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted });
  ui.setScale(s.uiScale);
  document.body.classList.toggle('touch', touchWanted());
}
