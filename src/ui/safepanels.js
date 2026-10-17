// DeVios safe-room panels. All rules are delegated to systems/* (campaign, economy, run).
import { ui, esc } from './ui.js';
import { app } from '../app.js';
import { audio } from '../systems/audio.js';
import * as campaign from '../systems/campaign.js';
import { STATION_UPGRADES, SUPPLIES, upgradePrice, shopEntryFromSupply } from '../systems/economy.js';
import { equipFromStash, unequip, MAX_SLOTS } from '../systems/run.js';
import { openShop } from './shop.js';
import { ERAS, MAIN_ERAS, SECRET_ERA } from '../data/eras.js';
import { ARTIFACTS } from '../data/artifacts.js';
import { COMPONENTS } from '../data/components.js';
import { ALLIES, ALLY_BY_ID } from '../data/allies.js';
import { WEAPON_BY_ID } from '../data/weapons.js';

const img = (k, cls = '') => `<img class="${cls}" src="${app.images[k] || ''}" alt="">`;

export function timeCircuitConfig(save, destEra = null) {
  const prog = campaign.repairProgress(save);
  const last = save.run && save.run.lastEra ? ERAS[save.run.lastEra].date : 'OCT 26 205X';
  const next = destEra || campaign.nextEra(save);
  const dest = next ? ERAS[next].date : (campaign.canReturnHome(save) ? 'OCT 26 205X' : '--- -- ----');
  const stable = prog.installed >= prog.total;
  const status = stable ? 'TIME CIRCUITS STABLE — navigation restored' : `REPAIR ${prog.installed}/${prog.total} — ${prog.installed === 0 ? 'navigation MALFUNCTIONING' : prog.installed < 3 ? 'navigation drifting…' : 'nearly stable'}`;
  return { dest, present: 'DEVIOS SAFE ROOM', last, glitch: !stable, status, small: true };
}

// ---- Armory / inventory -------------------------------------------------------------------
export function openArmory(scene, { allowStash = true } = {}) {
  const run = scene.run;
  const render = (m) => {
    m.body.innerHTML = `
      <p>Equipped (${run.loadout.length}/${MAX_SLOTS}). Use <kbd>1-4</kbd>/<kbd>Tab</kbd> or SWAP to switch in combat.</p>
      <div class="list">${run.loadout.map((w, i) => {
        const d = WEAPON_BY_ID[w.id];
        return `<div class="row">${img(`w_${w.id}`)}<div class="grow"><div class="t">${i + 1}. ${esc(d.name)}${w.level ? ` +${w.level}` : ''} <span class="tag">${d.category}</span>${i === run.current ? '<span class="tag done">active</span>' : ''}</div><div class="d">${esc(d.desc)}</div></div>
          <button class="btn" data-sel="${i}" ${i === run.current ? 'disabled' : ''}>Use</button>
          ${allowStash ? `<button class="btn" data-un="${i}" ${run.loadout.length <= 1 ? 'disabled' : ''}>Stash</button>` : ''}</div>`;
      }).join('')}</div>
      ${allowStash ? `<h3>DeVios stash</h3>${run.stash.length ? `<div class="list">${run.stash.map((id) => {
        const d = WEAPON_BY_ID[id];
        return `<div class="row">${img(`w_${id}`)}<div class="grow"><div class="t">${esc(d.name)} <span class="tag">${d.category}</span></div><div class="d">${esc(d.desc)}</div></div><button class="btn primary" data-eq="${id}">Equip</button></div>`;
      }).join('')}</div>` : '<p class="d">Empty. Weapons you swap out are kept here for this run.</p>'}` : ''}
      <h3>Consumables</h3><p>Chrono Bomb ×${run.consumables.bomb} · Med Patch ×${run.consumables.patch} · Shield Bubble ×${run.consumables.shield}</p>
      <p>◆ <b style="color:var(--gold)">${run.shards}</b> Time Shards</p>`;
    m.body.querySelectorAll('[data-sel]').forEach((b) => b.addEventListener('click', () => { scene.player.switchTo(+b.dataset.sel); render(m); }));
    m.body.querySelectorAll('[data-un]').forEach((b) => b.addEventListener('click', () => { unequip(run, +b.dataset.un); scene.player.refreshWeapon(); audio.play('select', { gap: 0 }); render(m); }));
    m.body.querySelectorAll('[data-eq]').forEach((b) => b.addEventListener('click', () => { equipFromStash(run, b.dataset.eq, run.loadout.length < MAX_SLOTS ? undefined : run.current); scene.player.refreshWeapon(); audio.play('pickup', { gap: 0 }); render(m); }));
  };
  const m = scene.modalPaused({ title: 'Inventory & Equipment', content: '', cls: 'wide', buttons: [{ label: 'Done', cls: 'primary', action: (mm) => mm.close() }], onClose: () => scene.onPanelClosed && scene.onPanelClosed() });
  render(m);
  return m;
}

// ---- Time-circuit console / destination select -------------------------------------------
export function openConsole(scene, onLaunch) {
  const save = app.save.data;
  ui.timeCircuits(timeCircuitConfig(save));
  audio.play('safe', { gap: 0 });
  const dests = campaign.destinations(save);
  const prog = campaign.repairProgress(save);
  const next = campaign.nextEra(save);
  const rows = dests.map((d) => {
    const era = ERAS[d.id];
    if (d.secret && !d.unlocked) {
      const have = save.artifacts.length;
      return `<div class="row locked"><div class="grow"><div class="t">??? — an unstable destination</div><div class="d">Requires all five historical artifacts (${have}/5) and clearing 1985.</div></div></div>`;
    }
    if (!d.unlocked) return `<div class="row locked"><div class="grow"><div class="t">${esc(era.name)} <span class="tag">locked</span></div><div class="d">Defeat the previous era’s boss to unlock.</div></div></div>`;
    const subBtns = d.complete
      ? [0, 1, 2].map((s) => `<button class="btn ${s === 0 ? 'primary' : ''}" data-go="${d.id}" data-sub="${s}">${s + 1}${s === 2 ? ' (boss)' : ''}</button>`).join('')
      : `<button class="btn primary" data-go="${d.id}" data-sub="0">Travel</button>`;
    const art = ARTIFACTS.find((a) => a.era === d.id);
    return `<div class="row"><div class="grow"><div class="t">${esc(era.name)} <span class="tag">${era.date}</span>${d.complete ? '<span class="tag done">cleared</span>' : d.id === next ? '<span class="tag rare">next</span>' : ''}</div>
      <div class="d">${art ? `Artifact: ${esc(art.name)} ${d.artifactFound ? '✔' : '— not found'}` : 'Secret era'}${d.complete ? ' · revisit any sub-level' : ''}</div></div>${subBtns}</div>`;
  }).join('');
  const home = campaign.canReturnHome(save)
    ? `<div class="row"><div class="grow"><div class="t">Return to 205X <span class="tag rare">canon ending</span></div><div class="d">The DeVios is repaired. Go home${campaign.isSecretUnlocked(save) && !save.endings.secret ? ' — or try the mysterious 202X destination first' : ''}.</div></div><button class="btn primary" data-home="1">Go home</button></div>` : '';
  const m = scene.modalPaused({
    title: 'Time-Circuit Console',
    content: `<p>Current location: DeVios safe room · Repair ${prog.installed}/${prog.total}${prog.recovered > prog.installed ? ' — <b style="color:var(--gold)">uninstalled components waiting at the repair station!</b>' : ''}</p><div class="list">${home}${rows}</div>`,
    cls: 'wide',
    buttons: [{ label: 'Close', action: (mm) => mm.close() }],
    onClose: () => { ui.timeCircuits(null); },
  });
  m.body.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
    const era = b.dataset.go, sub = +b.dataset.sub;
    const v = campaign.validateLaunch(save, era, sub);
    if (!v.ok) { audio.play('deny', { gap: 0 }); ui.toast(v.reason, 'bad'); return; }
    confirmDeparture(scene, era, sub, () => { m.close(); onLaunch({ era, sub }); });
  }));
  const hb = m.body.querySelector('[data-home]');
  if (hb) hb.addEventListener('click', async () => {
    if (!campaign.canReturnHome(save)) return;
    const extra = campaign.isSecretUnlocked(save) && !save.endings.secret ? ' You could still visit 202X first.' : (!campaign.hasAllArtifacts(save) ? ` (Artifacts: ${save.artifacts.length}/5 — missing ones unlock a secret.)` : '');
    if (await ui.confirm(`Set the time circuits for 205X and go home?${extra}`, 'Go home', 'Not yet')) { m.close(); onLaunch({ home: true }); }
  });
  return m;
}

function confirmDeparture(scene, eraId, sub, go) {
  const save = app.save.data;
  const run = scene.run;
  const era = ERAS[eraId];
  ui.timeCircuits({ ...timeCircuitConfig(save, eraId), status: `DESTINATION LOCKED: ${era.name}` });
  scene.modalPaused({
    title: `Depart for ${era.name}?`,
    content: `<p><b>Destination:</b> ${esc(era.name)} (${era.date}) — sub-level ${sub + 1}: ${esc(era.subs[sub])}</p>
      <p><b>Equipment:</b> ${run.loadout.map((w) => esc(WEAPON_BY_ID[w.id].name)).join(', ')}</p>
      <p><b>Ally:</b> ${save.activeAlly ? esc(ALLY_BY_ID[save.activeAlly].name) : 'none'} · <b>Time Shards:</b> ◆${run.shards}</p>
      <p><b>Artifacts:</b> ${ARTIFACTS.map((a) => `${save.artifacts.includes(a.id) ? '◆' : '◇'} ${esc(a.name)}`).join(' · ')}</p>
      <p class="d">You arrive at full health. Last chance to shop or change equipment!</p>`,
    buttons: [
      { label: 'Activate the DeVios!', cls: 'primary', action: (mm) => { mm.close(); go(); } },
      { label: 'Not yet', action: (mm) => mm.close() },
    ],
  });
}

// ---- Upgrade station -------------------------------------------------------------------------
export function openUpgrades(scene) {
  const save = app.save.data;
  const entries = Object.entries(STATION_UPGRADES).map(([key, u]) => ({
    key, kind: u.kind, name: u.name, desc: u.desc, price: 0,
    level: () => (u.kind === 'permUpgrade' ? save.permanent[u.stat] : scene.run.upgrades[u.stat]),
    maxed: () => (u.kind === 'permUpgrade' ? save.permanent[u.stat] : scene.run.upgrades[u.stat]) >= u.cap,
    levelText: () => `Lv ${u.kind === 'permUpgrade' ? save.permanent[u.stat] : scene.run.upgrades[u.stat]}/${u.cap}`,
  }));
  return openShop(scene, {
    title: 'Upgrade Station',
    intro: 'Run upgrades reset when you start a new run. PERMANENT upgrades are modest, capped, and kept forever.',
    entries,
    priceFor: (e) => upgradePrice(STATION_UPGRADES[e.key], e.level()),
    onPurchased: () => { scene.refreshMaxHp(); app.save.commit(); },
  });
}

export function openSupplies(scene) {
  const entries = ['heal_small', 'heal_full', 'ammo', 'patch', 'bomb', 'shield', 'buff_damage', 'up_weapon'].map((k) => shopEntryFromSupply(k, 99));
  entries.forEach((e) => { delete e.stock; });
  return openShop(scene, { title: 'DeVios Supply Locker', intro: 'Anon’s emergency stash, restocked by the time circuits. Unlimited stock.', entries });
}

// ---- Repair station ---------------------------------------------------------------------------
export function openRepair(scene) {
  const save = app.save.data;
  const render = (m) => {
    const prog = campaign.repairProgress(save);
    m.body.innerHTML = `<p>Repairs are always free. Each main-era boss guards one DeVios component.</p>
      <div class="progress"><div style="width:${(prog.installed / prog.total) * 100}%"></div></div><p>Installed ${prog.installed}/${prog.total} · Recovered ${prog.recovered}/${prog.total}</p>
      <div class="list">${COMPONENTS.map((c) => {
        const inst = save.installed.includes(c.id), rec = save.components.includes(c.id);
        return `<div class="row ${rec ? '' : 'locked'}">${img('component', 'sq')}<div class="grow"><div class="t">${esc(c.name)} ${inst ? '<span class="tag done">installed</span>' : rec ? '<span class="tag rare">recovered</span>' : '<span class="tag">missing</span>'}</div><div class="d">${esc(c.desc)} — ${esc(ERAS[c.era].name)}</div></div>
          ${rec && !inst ? `<button class="btn primary" data-i="${c.id}">Install (free)</button>` : ''}</div>`;
      }).join('')}</div>`;
    m.body.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => {
      if (campaign.installComponent(save, b.dataset.i)) {
        app.save.commit();
        audio.play('charge', { gap: 0, dur: 0.6 });
        ui.toast('Component installed. The time circuits flicker a little less.', 'good');
        scene.onRepair && scene.onRepair();
      }
      render(m);
    }));
  };
  const m = scene.modalPaused({ title: 'Repair Station', content: '', cls: 'wide', buttons: [{ label: 'Done', cls: 'primary', action: (mm) => mm.close() }] });
  render(m);
  return m;
}

// ---- Allies -------------------------------------------------------------------------------------
export function openAllies(scene) {
  const save = app.save.data;
  const render = (m) => {
    m.body.innerHTML = `<p>Choose one active companion. Allies are invulnerable helpers; they teleport back if they get lost.</p><div class="list">${ALLIES.map((a) => {
      const have = save.allies.includes(a.id);
      if (!have) return `<div class="row locked"><div class="grow"><div class="t">??? <span class="tag">${esc(ERAS[a.era].short)}</span></div><div class="d">Not yet recruited. Look for them in ${esc(ERAS[a.era].name)}.</div></div></div>`;
      const active = save.activeAlly === a.id;
      return `<div class="row">${img(`ch_${a.id}`, 'sq')}<div class="grow"><div class="t">${esc(a.name)} <span class="tag">${esc(a.roleLabel)}</span>${active ? '<span class="tag done">active</span>' : ''}</div><div class="d">${esc(a.desc)}</div></div>
        <button class="btn" data-talk="${a.id}">Talk</button><button class="btn primary" data-set="${a.id}" ${active ? 'disabled' : ''}>Select</button></div>`;
    }).join('')}</div>${save.activeAlly ? '<p><button class="btn" data-none="1">Go solo (no ally)</button></p>' : ''}`;
    m.body.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => { save.activeAlly = b.dataset.set; app.save.commit(); scene.spawnAlly(); scene.hudDirty = true; render(m); }));
    m.body.querySelectorAll('[data-talk]').forEach((b) => b.addEventListener('click', () => { const a = ALLY_BY_ID[b.dataset.talk]; ui.toast(`${a.name}: "${a.recruit[a.recruit.length - 1].replace(/^[^:]*:\s*/, '')}"`, 'gold'); }));
    const none = m.body.querySelector('[data-none]');
    if (none) none.addEventListener('click', () => { save.activeAlly = null; app.save.commit(); scene.spawnAlly(); scene.hudDirty = true; render(m); });
  };
  const m = scene.modalPaused({ title: 'Allies', content: '', cls: 'wide', buttons: [{ label: 'Done', cls: 'primary', action: (mm) => mm.close() }] });
  render(m);
  return m;
}

// ---- Artifacts ------------------------------------------------------------------------------------
export function openArtifacts(scene) {
  const save = app.save.data;
  const all = campaign.hasAllArtifacts(save);
  const html = `<p>${save.artifacts.length}/5 historical artifacts collected.${all ? ' <b style="color:var(--gold)">All five! The secret 202X destination opens once 1985 is cleared.</b>' : ' Collect all five to reveal a secret destination.'}</p>
    <div class="list">${ARTIFACTS.map((a) => {
      const have = save.artifacts.includes(a.id);
      return `<div class="row ${have ? '' : 'locked'}">${img(`art_${a.id}`, 'sq')}<div class="grow"><div class="t">${have ? esc(a.name) : '??? '}<span class="tag">${esc(ERAS[a.era].name)}</span>${have ? '<span class="tag done">collected</span>' : ''}</div><div class="d">${have ? esc(a.desc) : `Hint: ${esc(a.clue)}`}</div></div></div>`;
    }).join('')}</div>`;
  return scene.modalPaused({ title: 'Artifact Collection', content: html, cls: 'wide', buttons: [{ label: 'Close', cls: 'primary', action: (m) => m.close() }] });
}

export { MAIN_ERAS, SECRET_ERA, SUPPLIES };
