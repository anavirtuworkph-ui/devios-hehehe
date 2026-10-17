import Phaser from 'phaser';
import './style.css';
import { app } from './app.js';
import { ui } from './ui/ui.js';
import { input } from './systems/input.js';
import { audio } from './systems/audio.js';
import { applySettings, touchWanted } from './settings.js';
import { MAX_DPR } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { CinematicScene } from './scenes/CinematicScene.js';
import { GameScene } from './scenes/GameScene.js';
import { installDebug } from './debug.js';

ui.init(document.getElementById('ui'));
input.bind();
applySettings();

const dpr = () => Math.min(MAX_DPR, window.devicePixelRatio || 1);
app.dpr = dpr();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0b14',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE, width: Math.round(window.innerWidth * app.dpr), height: Math.round(window.innerHeight * app.dpr) },
  physics: { default: 'arcade', arcade: { debug: false, fps: 60 } },
  input: { activePointers: 4, touch: { capture: false } },
  render: { antialias: false, powerPreference: 'high-performance' },
  disableContextMenu: true,
  scene: [BootScene, MenuScene, CinematicScene, GameScene],
});
app.game = game;

// Render at device-pixel resolution (capped) while CSS stretches the canvas to the window.
function resize() {
  app.dpr = dpr();
  const w = Math.round(window.innerWidth * app.dpr), h = Math.round(window.innerHeight * app.dpr);
  if (game.scale.width !== w || game.scale.height !== h) game.scale.resize(w, h);
  game.scale.updateBounds();
  game.events.emit('app-resize');
  const portrait = window.innerHeight > window.innerWidth * 1.1;
  ui.rotateHint(portrait && touchWanted() && game.scene.isActive('Game'));
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
game.events.once('ready', resize);

// First user gesture unlocks audio (autoplay policy); first touch switches to touch UI.
const unlock = (e) => {
  audio.unlock();
  if (e.pointerType === 'touch') { input.lastDevice = 'touch'; applySettings(); game.events.emit('touch-detected'); }
};
window.addEventListener('pointerdown', unlock, { capture: true });
window.addEventListener('keydown', () => audio.unlock(), { capture: true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.suspend(); else audio.resume();
});

// Prevent pinch-zoom / double-tap zoom and page scroll during play.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (!e.target.closest('.m-body, #screen')) e.preventDefault(); }, { passive: false });

if (app.save.warning) setTimeout(() => ui.toast(app.save.warning, 'bad'), 800);

installDebug(game);
