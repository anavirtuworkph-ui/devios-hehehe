import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SaveStore, defaultSave, sanitize, SAVE_KEY } from '../src/systems/save.js';
import * as C from '../src/systems/campaign.js';
import { createRun, giveWeapon, addShards, MAX_SLOTS, equipFromStash, unequip } from '../src/systems/run.js';
import { purchase, generateShopInventory, shopEntryFromSupply, STATION_UPGRADES } from '../src/systems/economy.js';
import { planSublevel, pickWeighted, DEFAULT_WEIGHTS } from '../src/systems/subrooms.js';
import { makeRng } from '../src/systems/rng.js';
import { ARTIFACTS } from '../src/data/artifacts.js';
import { WEAPONS, weaponPrice, weaponsForEra } from '../src/data/weapons.js';
import { ALLIES } from '../src/data/allies.js';
import { ERAS, MAIN_ERAS } from '../src/data/eras.js';
import { BOSSES } from '../src/data/bosses.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };

test('save: corrupt data falls back safely and keeps a backup', () => {
  const st = mem();
  st.setItem(SAVE_KEY, '{not json');
  const s = new SaveStore(st);
  assert.deepEqual(s.data.defeatedBosses, []);
  assert.ok(s.warning);
  assert.equal(st.getItem(SAVE_KEY + '.corrupt-backup'), '{not json');
});

test('save: migrates v1 artifact map and sanitizes junk', () => {
  const s = sanitize({ version: 1, artifacts: { gold_bracelet: true, conant_coin: false }, settings: { difficulty: 'nightmare', master: 7 }, permanent: { maxHp: 99 } });
  assert.deepEqual(s.artifacts, ['gold_bracelet']);
  assert.equal(s.settings.difficulty, 'easy');
  assert.equal(s.settings.master, 1);
  assert.equal(s.permanent.maxHp, 3);
});

test('save: round-trips through storage including run with infinite reserve', () => {
  const st = mem();
  const s = new SaveStore(st);
  s.data.run = createRun(s.data);
  s.data.artifacts.push('gold_bracelet');
  s.commit();
  const s2 = new SaveStore(st);
  assert.deepEqual(s2.data.artifacts, ['gold_bracelet']);
  assert.equal(s2.data.run.loadout[0].id, 'chrono_pistol');
  assert.equal(s2.data.run.loadout[0].reserve, null);
});

test('campaign: eras unlock in order and secret requires all artifacts + marcos', () => {
  const s = defaultSave();
  assert.ok(C.isEraUnlocked(s, 'precolonial'));
  assert.ok(!C.isEraUnlocked(s, 'spanish'));
  C.recordBossDefeat(s, 'magellan');
  assert.ok(C.isEraUnlocked(s, 'spanish'));
  assert.deepEqual(s.components, ['flux_regulator']);
  // idempotent
  C.recordBossDefeat(s, 'magellan');
  assert.equal(s.completedEras.length, 1);
  for (const b of ['damaso', 'mckinley', 'saitoh']) C.recordBossDefeat(s, b);
  assert.ok(!C.isSecretUnlocked(s));
  for (const a of ARTIFACTS) C.collectArtifact(s, a.id);
  assert.ok(!C.isSecretUnlocked(s), 'needs marcos too');
  C.recordBossDefeat(s, 'marcos');
  assert.ok(C.isSecretUnlocked(s));
  assert.ok(C.canReturnHome(s));
  assert.equal(C.validateLaunch(s, 'modern').ok, true);
});

test('campaign: secret era needs both bosses, launch validation blocks skipping', () => {
  const s = defaultSave();
  assert.equal(C.validateLaunch(s, 'japanese').ok, false);
  assert.equal(C.validateLaunch(s, 'modern').ok, false);
  assert.equal(C.validateLaunch(s, 'precolonial', 2).ok, false);
  s.run = createRun(s); s.run.location = { era: 'precolonial', sub: 2 };
  assert.equal(C.validateLaunch(s, 'precolonial', 2).ok, true, 'boss retry allowed');
  C.recordBossDefeat(s, 'bbm');
  assert.ok(!s.completedEras.includes('modern'));
  C.recordBossDefeat(s, 'duterte');
  assert.ok(s.completedEras.includes('modern'));
});

test('campaign: repairs are free and only for recovered components', () => {
  const s = defaultSave();
  assert.equal(C.installComponent(s, 'flux_regulator'), false);
  C.recordBossDefeat(s, 'magellan');
  assert.equal(C.installComponent(s, 'flux_regulator'), true);
  assert.equal(C.installComponent(s, 'flux_regulator'), false);
});

test('run: loadout caps at MAX_SLOTS and swaps into stash', () => {
  const s = defaultSave();
  const r = createRun(s);
  giveWeapon(r, 'kris'); giveWeapon(r, 'bolo');
  assert.equal(r.loadout.length, MAX_SLOTS);
  assert.equal(giveWeapon(r, 'm93'), 'swapped');
  assert.equal(r.loadout.length, MAX_SLOTS);
  assert.equal(r.stash.length, 1);
  assert.equal(giveWeapon(r, 'm93'), 'owned');
  assert.ok(equipFromStash(r, r.stash[0], 0));
  assert.ok(unequip(r, 0));
  assert.equal(r.loadout.length, MAX_SLOTS - 1);
});

test('economy: purchases validate funds, stock and duplicates', () => {
  const s = defaultSave();
  const r = createRun(s);
  const player = { hp: 5, maxHp: 20, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addBuff() {} };
  const heal = shopEntryFromSupply('heal_small', 1);
  assert.equal(purchase(heal, { run: r, save: s, player }).ok, false);
  addShards(r, s, 20);
  assert.equal(r.shards, 20);
  const res = purchase(heal, { run: r, save: s, player });
  assert.ok(res.ok);
  assert.equal(r.shards, 20 - heal.price);
  assert.equal(player.hp, 11);
  assert.equal(purchase(heal, { run: r, save: s, player }).ok, false, 'sold out');
  const inv = generateShopInventory(makeRng(1), 'spanish', r);
  const w = inv.find((e) => e.kind === 'weapon');
  r.shards = 100;
  assert.ok(purchase(w, { run: r, save: s, player }).ok);
  assert.equal(purchase({ ...w, stock: 1 }, { run: r, save: s, player }).ok, false, 'already owned');
  // permanent upgrade caps
  s.permanent.maxHp = 3;
  assert.equal(purchase({ ...STATION_UPGRADES.perm_maxhp, key: 'perm_maxhp', price: 1 }, { run: r, save: s, player }).ok, false);
});

test('subrooms: weighted pick respects weights and artifact vault is guaranteed', () => {
  const rng = makeRng(42);
  const counts = {};
  for (let i = 0; i < 20000; i++) { const k = pickWeighted(rng, DEFAULT_WEIGHTS); counts[k] = (counts[k] || 0) + 1; }
  assert.ok(counts.shop > counts.healing && counts.healing > counts.hidden);
  const s = defaultSave();
  for (const era of MAIN_ERAS) {
    for (let seed = 0; seed < 30; seed++) {
      const p = planSublevel({ rng: makeRng(seed), eraId: era, sub: 1, save: s });
      assert.equal(p.rooms[1].side.kind, 'vault');
      const p0 = planSublevel({ rng: makeRng(seed), eraId: era, sub: 0, save: s, difficulty: 'normal' });
      assert.equal(p0.rooms.length, 2);
      assert.ok(p0.rooms[0].waves.length === 2);
      const pb = planSublevel({ rng: makeRng(seed), eraId: era, sub: 2, save: s });
      assert.ok(pb.isBoss && pb.rooms.length === 1 && !pb.rooms[0].side);
    }
  }
  s.artifacts.push('gold_bracelet');
  const p = planSublevel({ rng: makeRng(1), eraId: 'precolonial', sub: 1, save: s });
  assert.equal(p.rooms[1].side.kind, 'treasure');
});

test('data: every required weapon exists, prices fall in spec ranges', () => {
  const required = ['poison_spear', 'kris', 'bolo', 'rolling_block', 'm93', 'c96', 'rizal_quill', 'howitzer', 'colt_saa', 'springfield', 'model_1987',
    'type38', 'type99', 'nambu', 'katana', 'bar', 'thompson', 'bayonet', 'm1_garand', 'm1_carbine', 'grease_gun', 'm60', 'bongbong_rl', 'm1911',
    'beretta', 'barrett', 'galil_ace', 'balisong', 'mmaw', 'improvised_rpg'];
  const ids = new Set(WEAPONS.map((w) => w.id));
  for (const r of required) assert.ok(ids.has(r), r);
  for (const w of WEAPONS) {
    const p = weaponPrice(w);
    if (w.rarity === 'common') assert.ok(p >= 10 && p <= 18, `${w.id} ${p}`);
    if (w.rarity === 'rare') assert.ok(p >= 20 && p <= 35, `${w.id} ${p}`);
  }
  for (const e of [...MAIN_ERAS, 'modern']) {
    for (const g of ERAS[e].guaranteed) assert.ok(weaponsForEra(e).some((w) => w.id === g.weapon), `${e} guaranteed ${g.weapon}`);
    for (const b of ERAS[e].boss) {
      assert.ok(BOSSES[b], b);
      for (const ph of BOSSES[b].phases) assert.ok(ph.patterns.length >= 3, `${b} has >=3 attacks per phase`);
    }
  }
  assert.equal(ALLIES.length, 8);
  const recruitable = new Set(MAIN_ERAS.flatMap((e) => [...(ERAS[e].recruits || []).map((r) => r.ally), ...(ERAS[e].special || []).map((s) => s.ally)]));
  for (const a of ALLIES) assert.ok(recruitable.has(a.id), `${a.id} has a recruit event`);
});

test('history: every non-boss sub-level (normal & hard) has a Historical Archive with valid facts', async () => {
  const { HISTORY } = await import('../src/data/history.js');
  const { generateDungeon } = await import('../src/systems/dungeon.js');
  const s = defaultSave();
  for (const era of [...MAIN_ERAS, 'modern']) {
    const h = HISTORY[era];
    assert.ok(h && h.facts.length >= 4 && h.quiz.length >= 2, `${era} history data`);
    for (const q of h.quiz) assert.ok(q.answer >= 0 && q.answer < q.choices.length, `${era} quiz answer index`);
    for (let seed = 0; seed < 20; seed++) {
      for (const sub of [0, 1]) {
        for (const difficulty of ['easy', 'normal']) {
          const p = planSublevel({ rng: makeRng(seed), eraId: era, sub, save: s, difficulty });
          assert.ok(p.rooms.some((r) => r.side && r.side.kind === 'history'), `${era}/${sub} normal plan has history`);
        }
        const d = generateDungeon({ rng: makeRng(seed + 99), eraId: era, sub, save: s });
        assert.ok(d.rooms.some((r) => r.side && r.side.kind === 'history'), `${era}/${sub} hard floor has history`);
      }
    }
  }
  const spanish = HISTORY.spanish.facts.map((f) => f.text).join(' ');
  assert.ok(spanish.includes('Kataastaasan, Kagalanggalangang Katipunan ng mga Anak ng Bayan'));
  assert.ok(HISTORY.marcos.facts.some((f) => f.text.includes('22 to 25 February 1986')));
});
