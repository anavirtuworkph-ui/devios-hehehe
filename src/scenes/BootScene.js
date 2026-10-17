import Phaser from 'phaser';
import { generateAll } from '../systems/textures.js';
import { WEAPONS } from '../data/weapons.js';
import { ALLIES } from '../data/allies.js';
import { ARTIFACTS } from '../data/artifacts.js';
import { app } from '../app.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    generateAll(this);
    // Data-URL copies of a few textures for the DOM UI (HUD, shop rows, panels).
    const img = (key) => this.textures.getBase64(key);
    for (const w of WEAPONS) app.images[`w_${w.id}`] = img(`w_${w.id}`);
    for (const a of ALLIES) app.images[`ch_${a.id}`] = img(`ch_${a.id}`);
    for (const a of ARTIFACTS) app.images[`art_${a.id}`] = img(`art_${a.id}`);
    for (const k of ['heart', 'ammo', 'component', 'chest_small', 'shard_lab', 'devios_top', 'devios_side', 'ch_anon']) app.images[k] = img(k);
    document.body.classList.add('booted');
    this.scene.start('Menu');
  }
}
