// Shop / list-purchase modal used by era merchants, the DeVios supply locker and upgrades.
import { ui, esc } from './ui.js';
import { app } from '../app.js';
import { audio } from '../systems/audio.js';
import { purchase } from '../systems/economy.js';

const iconFor = (e) => (e.kind === 'weapon' ? app.images[`w_${e.weapon}`]
  : e.kind === 'heal' ? app.images.heart : e.kind === 'ammo' ? app.images.ammo : app.images.component);

export function openShop(scene, { title, intro = '', entries, onPurchased = null, priceFor = null }) {
  const render = (m) => {
    const run = scene.run;
    m.body.innerHTML = `${intro ? `<p>${esc(intro)}</p>` : ''}<div class="balance">◆ ${run.shards} Time Shards</div><div class="list">${entries.map((e, i) => {
      const price = priceFor ? priceFor(e) : e.price;
      const sold = e.stock !== undefined && e.stock <= 0;
      const maxed = e.maxed && e.maxed();
      const tag = e.rarity === 'rare' ? '<span class="tag rare">rare</span>' : e.kind === 'permUpgrade' ? '<span class="tag perm">permanent</span>' : e.kind === 'runUpgrade' ? '<span class="tag">this run</span>' : '';
      return `<div class="row ${sold || maxed ? 'sold' : ''}"><img src="${iconFor(e)}" alt=""><div class="grow"><div class="t">${esc(e.name)}${tag}${e.levelText ? ` <span class="tag">${esc(e.levelText())}</span>` : ''}</div><div class="d">${esc(e.desc)}</div></div>
        <div class="price">${sold ? 'SOLD' : maxed ? 'MAX' : `◆${price}`}</div>
        <button class="btn ${run.shards >= price && !sold && !maxed ? 'primary' : ''}" data-i="${i}" ${sold || maxed ? 'disabled' : ''}>Buy</button></div>`;
    }).join('')}</div>`;
    m.body.querySelectorAll('button[data-i]').forEach((b) => b.addEventListener('click', () => {
      const e = entries[+b.dataset.i];
      if (priceFor) e.price = priceFor(e);
      const res = purchase(e, { run: scene.run, save: app.save.data, player: scene.player });
      if (res.ok) {
        audio.play('buy', { gap: 0 });
        ui.toast(res.message, 'good');
        if (onPurchased) onPurchased(e);
        scene.hudDirty = true;
        if (scene.player) scene.player.refreshWeapon();
      } else {
        audio.play('deny', { gap: 0 });
        ui.toast(res.message, 'bad');
      }
      render(m);
    }));
  };
  const m = scene.modalPaused({ title, content: '', cls: 'wide', buttons: [{ label: 'Leave', action: (mm) => mm.close() }] });
  render(m);
  return m;
}
