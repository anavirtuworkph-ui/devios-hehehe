// Contents of optional sub-rooms: shop, treasure, healing, weapon trial, temporal anomaly
// (shrine), rest room, hidden room and the artifact vault.
import { ui, esc } from '../ui/ui.js';
import { app } from '../app.js';
import { audio } from '../systems/audio.js';
import { rand } from '../systems/rng.js';
import { generateShopInventory, rollReward, SUPPLIES } from '../systems/economy.js';
import { giveWeapon, ownsWeapon, makeWeaponInstance, spendShards } from '../systems/run.js';
import * as campaign from '../systems/campaign.js';
import { ERAS } from '../data/eras.js';
import { ARTIFACT_BY_ID, ARTIFACT_BY_ERA } from '../data/artifacts.js';
import { WEAPON_BY_ID, weaponsForEra } from '../data/weapons.js';
import { openShop } from '../ui/shop.js';
import { openArmory } from '../ui/safepanels.js';
import { tileCenter, addNpc, addImage, addGlow } from './helpers.js';

export function buildSubroom(ctrl, side, st, r) {
  const fn = BUILDERS[side.kind] || BUILDERS.treasure;
  fn(ctrl, side, st, r);
}

const spot = (r, k, i = 0) => tileCenter(r.spots[k][Math.min(i, r.spots[k].length - 1)]);

const SHRINE_OFFERS = [
  { id: 'fury', title: 'Fury of the Ages', good: '+30% damage for 120 s', bad: 'Take 25% more damage for 60 s',
    apply: (sc) => { sc.player.addBuff('damage', 0.3, 120000, 'FURY +30%'); sc.player.addBuff('defenseDown', 0, 60000, 'FRAGILE', true); } },
  { id: 'haste', title: 'Temporal Haste', good: '+25% move speed for 120 s', bad: 'The next combat room has stronger enemies',
    apply: (sc) => { sc.player.addBuff('speed', 0.25, 120000, 'HASTE +25%'); sc.run.nextStronger = true; } },
  { id: 'greed', title: 'Paradox Payout', good: '+15 Time Shards right now', bad: '-30% move speed for 30 s',
    apply: (sc) => { sc.combat.dropShards(sc.player.sprite.x, sc.player.sprite.y - 20, 15, sc.shardTexture()); sc.player.addBuff('speed', -0.3, 30000, 'SLUGGISH', true); } },
  { id: 'luck', title: 'Lucky Loop', good: '+20% critical-hit chance for 120 s', bad: 'Take 25% more damage for 45 s',
    apply: (sc) => { sc.player.addBuff('crit', 0.2, 120000, 'CRIT +20%'); sc.player.addBuff('defenseDown', 0, 45000, 'FRAGILE', true); } },
];

const BUILDERS = {
  shop(ctrl, side, st, r) {
    const sc = ctrl.scene;
    const era = ERAS[ctrl.eraId];
    const m = spot(r, 'm');
    addImage(sc, 'st_stall', m.x + 20, m.y + 2, { origin: [0.5, 0.75] });
    const merchant = era.merchant || { name: 'Merchant' };
    addNpc(sc, `ch_merchant_${ctrl.eraId}`, m.x, m.y, merchant.name);
    if (!st.inventory) st.inventory = generateShopInventory(ctrl.rng, ctrl.eraId, sc.run);
    ctrl.subObjective = `Shop — talk to ${merchant.name}. Leave any time via the left door.`;
    sc.addInteractable({
      x: m.x, y: m.y, r: 30, label: `Shop with ${merchant.name}`,
      use: () => openShop(sc, { title: merchant.name, intro: 'Prices in Time Shards. Everything takes effect immediately.', entries: st.inventory }),
    });
  },

  treasure(ctrl, side, st, r) {
    const sc = ctrl.scene;
    ctrl.subObjective = 'Treasure Room — open the chests.';
    const c = spot(r, 'c');
    ctrl.addChest({ id: `${side.id}-big` }, st, c.x, c.y, 'large', (x, y) => maybeWeaponDrop(ctrl, st, side, x + 26, y, 0.5));
    if (!st.secondChest) st.secondChest = rand.chance(0.5) ? 'yes' : 'no';
    if (st.secondChest === 'yes') ctrl.addChest({ id: `${side.id}-small` }, st, c.x - 40, c.y + 10, 'small');
    artifactClue(ctrl, r);
  },

  healing(ctrl, side, st, r) {
    const sc = ctrl.scene;
    ctrl.subObjective = 'Healing Room — a free sip from the spring, or a paid full restore.';
    const m = spot(r, 'm');
    addImage(sc, 'st_fountain', m.x, m.y, { origin: [0.5, 0.75] });
    addGlow(sc, m.x, m.y, 0x5fff8a, 16);
    sc.addInteractable({
      x: m.x, y: m.y, r: 28, label: 'Use the healing spring',
      use: () => {
        const html = `<p>The spring hums with stabilized time. HP: <b>${Math.ceil(sc.player.hp)}/${sc.player.maxHp}</b> · ◆ ${sc.run.shards}</p>`;
        const btns = [
          { label: st.freeUsed ? 'Free sip used' : 'Free sip (+6 HP)', disabled: !!st.freeUsed, cls: 'primary', action: (mm) => { st.freeUsed = true; sc.player.heal(6); rest(sc); mm.close(); } },
          { label: 'Full restore (◆12)', disabled: sc.run.shards < 12 || sc.player.hp >= sc.player.maxHp, action: (mm) => { if (spendShards(sc.run, 12)) { sc.player.heal(999); audio.play('buy', { gap: 0 }); rest(sc); } mm.close(); } },
          { label: 'Buy Med Patch (◆8)', disabled: sc.run.shards < 8, action: (mm) => { if (spendShards(sc.run, 8)) { sc.run.consumables.patch += 1; audio.play('buy', { gap: 0 }); ui.toast('Med Patch added (Q / ITEM to use).', 'good'); } mm.close(); } },
          { label: 'Leave', action: (mm) => mm.close() },
        ];
        sc.modalPaused({ title: 'Healing Spring', content: html, buttons: btns });
      },
    });
  },

  trial(ctrl, side, st, r) {
    const sc = ctrl.scene;
    const c = spot(r, 'c');
    ctrl.subObjective = st.done ? 'Weapon Trial complete.' : 'Weapon Trial — optional challenge at the pedestal.';
    if (st.done) return;
    const pool = weaponsForEra(ctrl.eraId);
    if (!st.weapon) st.weapon = (pool.find((w) => w.rarity === 'rare') || pool[0] || WEAPON_BY_ID.proto_scatter).id;
    const def = WEAPON_BY_ID[st.weapon];
    addGlow(sc, c.x, c.y, 0xff5050, 14);
    const img = addImage(sc, `w_${def.id}`, c.x, c.y, { bob: true });
    const it = sc.addInteractable({
      x: c.x, y: c.y, r: 24, label: 'Begin the Weapon Trial',
      use: () => {
        sc.modalPaused({
          title: 'Weapon Trial',
          content: `<p>Borrow the <b>${esc(def.name)}</b> and defeat every enemy within <b>45 seconds</b>.</p><p>Reward: Time Shards plus a weapon tune-up or a consumable. Failing costs nothing — the borrowed weapon is returned either way.</p>`,
          buttons: [
            { label: 'Start!', cls: 'primary', action: (mm) => { mm.close(); startTrial(); } },
            { label: 'Not now', action: (mm) => mm.close() },
          ],
        });
      },
    });
    const startTrial = () => {
      sc.removeInteractable(it);
      img.destroy();
      sc.lockDoor(ctrl.backDoor);
      const inst = makeWeaponInstance(def.id, 2);
      inst.temp = true;
      sc.run.loadout.push(inst);
      sc.player.switchTo(sc.run.loadout.length - 1);
      ctrl.trial = { active: true, left: 45000 };
      const spots = r.spots.e.map(tileCenter);
      const types = ['grunt', 'shooter', 'runner', 'grunt', 'bomber'];
      const n = sc.diff === undefined ? 4 : Math.round(5 * sc.diff.enemyCount) + 1;
      for (let i = 0; i < n; i++) { const p = spots[i % spots.length]; sc.spawnEnemy(types[i % types.length], p.x + (rand.next() - 0.5) * 10, p.y, {}); }
      ui.banner('TRIAL START', '45 seconds!', 1000);
    };
    const endTrial = () => {
      ctrl.trial.active = false;
      sc.run.loadout = sc.run.loadout.filter((w) => !w.temp);
      sc.run.current = Math.min(sc.run.current, sc.run.loadout.length - 1);
      sc.player.refreshWeapon();
      sc.openDoor(ctrl.backDoor);
      st.done = true;
      ctrl.subObjective = 'Weapon Trial complete.';
    };
    ctrl.trialWon = () => {
      if (!ctrl.trial.active) return;
      endTrial();
      ui.banner('TRIAL COMPLETE!', 'Rewards granted', 1600);
      audio.play('chest', { gap: 0 });
      sc.combat.dropShards(c.x, c.y, rollReward(ctrl.rng, 'trial', sc.save.data.settings.difficulty), sc.shardTexture());
      sc.time.delayedCall(400, () => sc.combat.magnetAll());
      const w = sc.run.loadout[sc.run.current];
      if (w && w.level < 3 && WEAPON_BY_ID[w.id].rarity !== 'starter' && rand.chance(0.6)) { w.level += 1; ui.toast(`${WEAPON_BY_ID[w.id].name} tuned up (+15% damage)!`, 'good'); }
      else { sc.run.consumables.bomb = Math.min(9, sc.run.consumables.bomb + 1); ui.toast('Reward: Chrono Bomb!', 'good'); }
    };
    ctrl.trialLost = () => {
      if (!ctrl.trial.active) return;
      endTrial();
      for (const e of sc.enemies.slice()) if (!e.dead) { e.noReward = true; e.die(); }
      ui.banner('TIME UP', 'No penalty — try another trial later.', 1600);
    };
  },

  shrine(ctrl, side, st, r) {
    const sc = ctrl.scene;
    const m = spot(r, 'm');
    ctrl.subObjective = 'Temporal Anomaly — a deal with consequences (all temporary).';
    addImage(sc, 'st_shrine', m.x, m.y, { origin: [0.5, 0.75] });
    addGlow(sc, m.x, m.y - 6, 0xc080ff, 18);
    if (!st.offers) st.offers = rand.shuffle(SHRINE_OFFERS).slice(0, 2).map((o) => o.id);
    const it = sc.addInteractable({
      x: m.x, y: m.y, r: 28, label: () => (st.used ? 'The anomaly is quiet now' : 'Touch the temporal anomaly'),
      use: () => {
        if (st.used) return;
        const offers = st.offers.map((id) => SHRINE_OFFERS.find((o) => o.id === id));
        sc.modalPaused({
          title: 'Temporal Anomaly',
          content: `<p>A wobble in the timeline left by the DeVios. It offers a bargain. Effects are temporary — experimenting never permanently punishes you.</p><div class="list">${offers.map((o) => `<div class="row"><div class="grow"><div class="t">${esc(o.title)}</div><div class="d" style="color:var(--green)">▲ ${esc(o.good)}</div><div class="d" style="color:var(--red)">▼ ${esc(o.bad)}</div></div></div>`).join('')}</div>`,
          buttons: [
            ...offers.map((o) => ({ label: `Accept: ${o.title}`, cls: 'primary', action: (mm) => { st.used = true; o.apply(sc); audio.play('glitch', { gap: 0 }); ui.toast(`${o.title} accepted.`, 'gold'); mm.close(); } })),
            { label: 'Decline', action: (mm) => mm.close() },
          ],
        });
      },
    });
    return it;
  },

  rest(ctrl, side, st, r) {
    const sc = ctrl.scene;
    const era = ERAS[ctrl.eraId];
    ctrl.subObjective = 'Rest Room — no combat here. Read, chat, or swap weapons.';
    const m = spot(r, 'm');
    addImage(sc, 'st_note', m.x, m.y, { origin: [0.5, 0.75] });
    sc.addInteractable({
      x: m.x, y: m.y, r: 26, label: 'Read the historical note',
      use: () => sc.modalPaused({ title: 'Historical note', content: `<p>${esc(rand.pick(era.notes || ['The timeline is quiet here.']))}</p><p class="d" style="color:var(--muted)">Notes are simplified for a game; the boss fights are pure fiction.</p>`, buttons: [{ label: 'OK', cls: 'primary', action: (mm) => mm.close() }] }),
    });
    const n = spot(r, 'n');
    addNpc(sc, 'ch_villager', n.x, n.y, 'Weary traveller');
    sc.addInteractable({
      x: n.x, y: n.y, r: 24, label: 'Chat',
      use: () => ui.dialog([rand.pick([
        'Traveller: Strange lights have been popping up all over. People say a shining carriage fell from the sky.',
        'Traveller: Rest a while. The echoes never come in here — something about this room feels… anchored.',
        `Traveller: ${ARTIFACT_BY_ERA[ctrl.eraId] ? ARTIFACT_BY_ERA[ctrl.eraId].clue : 'Keep your eyes open, stranger.'}`,
      ])]),
    });
    const c = spot(r, 'c');
    addImage(sc, 'st_bench', c.x, c.y, { origin: [0.5, 0.75] });
    sc.addInteractable({ x: c.x, y: c.y, r: 26, label: 'Review inventory & swap weapons', use: () => openArmory(sc, { allowStash: true }) });
  },

  hidden(ctrl, side, st, r) {
    const sc = ctrl.scene;
    ctrl.subObjective = 'A hidden room! Grab the cache.';
    const c = spot(r, 'c');
    addGlow(sc, c.x, c.y, 0xffffff, 16);
    ctrl.addChest({ id: `${side.id}-cache` }, st, c.x, c.y, 'hidden', (x, y) => {
      maybeWeaponDrop(ctrl, st, side, x + 28, y, 0.6, true);
      sc.time.delayedCall(500, () => ui.dialog([rand.pick([
        'A note inside reads: "If you found this, you are as nosy as I was. — A previous time traveller"',
        'Scratched into the wall: "ANON WAS HERE". Anon has no memory of writing it.',
        'A faded photo of a silver Vios. Someone circled the trunk and wrote "reactor goes here?"',
      ])]));
    });
    artifactClue(ctrl, r);
  },

  vault(ctrl, side, st, r) {
    const sc = ctrl.scene;
    const art = ARTIFACT_BY_ID[side.artifact];
    const c = spot(r, 'c');
    const save = sc.save.data;
    if (!art || save.artifacts.includes(art.id)) return BUILDERS.treasure(ctrl, side, st, r);
    ctrl.subObjective = `Artifact Vault — ${st.guardiansDown ? 'open the vault!' : 'defeat the vault guardians!'}`;
    const openVault = () => {
      ctrl.vaultFight = null;
      st.guardiansDown = true;
      ctrl.subObjective = 'Artifact Vault — open the vault!';
      sc.openDoor(ctrl.backDoor);
      addGlow(sc, c.x, c.y, 0xffd400, 18);
      ctrl.addChest({ id: `${side.id}-vault` }, st, c.x, c.y, 'vault', (x, y) => {
        const img = addImage(sc, `art_${art.id}`, x, y - 10, { depth: 60 });
        sc.tweens.add({ targets: img, y: y - 30, scale: 2, duration: 700, yoyo: true, hold: 600, onComplete: () => img.destroy() });
        if (campaign.collectArtifact(save, art.id)) {
          sc.save.commit(); // artifacts persist immediately, even if Anon falls later
          audio.play('artifact', { gap: 0 });
          ui.banner(`Artifact found: ${art.name}`, `${save.artifacts.length}/5 historical artifacts`, 3000);
          if (campaign.hasAllArtifacts(save)) sc.time.delayedCall(3200, () => ui.banner('All five artifacts!', 'Defeat the 1985 boss to unlock the secret 202X destination.', 3000));
        }
        ctrl.subObjective = 'Artifact secured! Head back through the left door.';
        sc.hudDirty = true;
      });
    };
    if (st.guardiansDown) {
      if (!st.taken.has(`${side.id}-vault`)) openVault();
      return null;
    }
    sc.lockDoor(ctrl.backDoor);
    addImage(sc, 'chest_vault', c.x, c.y).setAlpha(0.4);
    const spots = r.spots.e.map(tileCenter);
    sc.time.delayedCall(600, () => {
      sc.spawnEnemy('armored', spots[0].x, spots[0].y, { elite: true });
      sc.spawnEnemy('shooter', spots[1].x, spots[1].y, {});
      if (save.settings.difficulty === 'normal') sc.spawnEnemy('runner', spots[2].x, spots[2].y, {});
      ui.toast('Vault guardians!', 'bad');
    });
    ctrl.vaultFight = openVault;
    return null;
  },
};

function rest(sc) {
  const z = sc.add.text(sc.player.sprite.x + 8, sc.player.sprite.y - 16, 'z z z', { fontFamily: 'monospace', fontSize: '8px', color: '#9ff6ff', stroke: '#000', strokeThickness: 3 }).setResolution(4).setDepth(60);
  sc.tweens.add({ targets: z, y: z.y - 14, alpha: 0, duration: 1400, onComplete: () => z.destroy() });
}

function maybeWeaponDrop(ctrl, st, side, x, y, chance, rareFirst = false) {
  const sc = ctrl.scene;
  if (!rand.chance(chance)) return;
  let pool = weaponsForEra(ctrl.eraId).filter((w) => !ownsWeapon(sc.run, w.id));
  if (rareFirst && pool.some((w) => w.rarity === 'rare')) pool = pool.filter((w) => w.rarity === 'rare');
  if (!pool.length) return;
  const rw = { id: `${side.id}-wdrop`, kind: 'weapon', weapon: rand.pick(pool).id };
  if (st.taken.has(rw.id)) return;
  ctrl.addWeaponPickup(rw, st, x, y);
}

function artifactClue(ctrl, r) {
  const sc = ctrl.scene;
  const art = ARTIFACT_BY_ERA[ctrl.eraId];
  if (!art || sc.save.data.artifacts.includes(art.id)) return;
  const n = tileCenter(r.spots.n[0]);
  const note = addImage(sc, 'st_note', n.x, n.y, { origin: [0.5, 0.75] });
  sc.addInteractable({ x: n.x, y: n.y, r: 24, label: 'Read the scribbled clue', use: () => ui.dialog([`Clue: ${art.clue}`, '(Artifact vaults appear in the second sub-level of each era.)']) });
  return note;
}

export { SUPPLIES, app, giveWeapon };
